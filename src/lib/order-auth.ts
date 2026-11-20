import { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { verifyStaffToken, verifyTableSessionToken, StaffRole, TableSessionPayload } from "@/lib/jwt";
import { prisma } from "@/lib/db";
import { pool } from "@/lib/db-pool";

export interface OrderAuthContext {
  authorized: boolean;
  role?: StaffRole;
  negocioId?: string;
  userId?: string;
  staffId?: string;
  staffNombre?: string;
  error?: string;
  status?: number; // 401 | 403
}

/**
 * Valida de forma estricta en el servidor las credenciales del solicitante para interactuar con pedidos.
 * Acepta:
 * 1. SuperAdmin (vía cookie super_admin_session)
 * 2. Token de personal firmado (Cocina, Mesero, Cajero) vía header Authorization Bearer, x-staff-token o cookies staff_session/cocina_session/mesero_session
 * 3. Administrador / Dueño (vía cookie session_token validada contra Prisma)
 *
 * Rechaza:
 * - Solicitudes anónimas (401 Unauthorized)
 * - Solicitudes de personal o administradores pertenecientes a otro negocio (403 Forbidden)
 */
export async function verifyOrderStaffAuth(
  req?: NextRequest,
  targetNegocioId?: string
): Promise<OrderAuthContext> {
  // 1. SuperAdmin tiene acceso global irrestricto
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) {
    return {
      authorized: true,
      role: "SUPERADMIN",
      negocioId: targetNegocioId || "superadmin",
    };
  }

  // 2. Extraer token de personal desde headers o cookies
  let staffToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      staffToken = authHeader.substring(7).trim();
    }
    if (!staffToken) {
      staffToken = req.headers.get("x-staff-token") || undefined;
    }
    if (!staffToken) {
      staffToken = req.cookies.get("staff_session")?.value;
    }
    if (!staffToken) {
      const cocinaCookie = req.cookies.getAll().find((c) => c.name.startsWith("cocina_session"));
      if (cocinaCookie) staffToken = cocinaCookie.value;
    }
    if (!staffToken) {
      staffToken = req.cookies.get("mesero_session")?.value;
    }
  }

  // Fallback a cookies() de Next.js
  if (!staffToken) {
    try {
      const cookieStore = await cookies();
      staffToken = cookieStore.get("staff_session")?.value;
      if (!staffToken) {
        const cocinaCookie = cookieStore.getAll().find((c) => c.name.startsWith("cocina_session"));
        if (cocinaCookie) staffToken = cocinaCookie.value;
      }
      if (!staffToken) {
        staffToken = cookieStore.get("mesero_session")?.value;
      }
    } catch {}
  }

  // Fallback a headers() de Next.js
  if (!staffToken) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        staffToken = authHeader.substring(7).trim();
      }
      if (!staffToken) {
        staffToken = headerStore.get("x-staff-token") || undefined;
      }
    } catch {}
  }

  // Si encontramos un token de staff firmado criptográficamente:
  if (staffToken) {
    const decoded = verifyStaffToken(staffToken);
    if (decoded) {
      // Control estricto multi-tenant: el token debe pertenecer al negocio consultado
      if (targetNegocioId && decoded.negocioId !== targetNegocioId) {
        return {
          authorized: false,
          error: "No autorizado para operar en un negocio ajeno.",
          status: 403,
        };
      }
      return {
        authorized: true,
        role: decoded.role,
        negocioId: decoded.negocioId,
        staffId: decoded.staffId,
        staffNombre: decoded.staffNombre,
      };
    }
  }

  // 3. Verificar sesión de Propietario / Administrador web (session_token)
  const userSession = await getUserSession();
  if (userSession?.userId) {
    if (!targetNegocioId || userSession.restaurantId === targetNegocioId) {
      return {
        authorized: true,
        role: "ADMIN",
        negocioId: targetNegocioId || userSession.restaurantId,
        userId: userSession.userId,
      };
    }

    // Verificar en Prisma si el usuario es dueño del restaurante
    try {
      const owned = await prisma.restaurant.findFirst({
        where: { id: targetNegocioId, userId: userSession.userId },
        select: { id: true },
      });
      if (owned) {
        return {
          authorized: true,
          role: "ADMIN",
          negocioId: targetNegocioId,
          userId: userSession.userId,
        };
      }
    } catch {}

    // Verificar en tabla legacy negocios
    try {
      const { rows } = await pool.query(
        "SELECT id FROM negocios WHERE id::text = $1 AND (user_id = $2 OR admin_id = $2)",
        [targetNegocioId, userSession.userId]
      );
      if (rows.length > 0) {
        return {
          authorized: true,
          role: "ADMIN",
          negocioId: targetNegocioId,
          userId: userSession.userId,
        };
      }
    } catch {}

    return {
      authorized: false,
      error: "No autorizado. Su cuenta de administrador no tiene acceso a este restaurante.",
      status: 403,
    };
  }

  // 4. Si no presentó credenciales válidas
  return {
    authorized: false,
    error: "Acceso no autorizado. Inicie sesión en el panel o valide su PIN de terminal en el restaurante.",
    status: 401,
  };
}

/**
 * Valida la matriz de permisos de transición de estados según el rol de la credencial autenticada en el servidor.
 * - COCINA: Solo puede cambiar a "en_cocina" o "listo".
 *   Tiene PROHIBIDO: "pagado", "por_pagar", "cancelado", "nuevo".
 * - MESERO / CAJERO / ADMIN / SUPERADMIN: Pueden gestionar el ciclo completo según corresponda.
 */
export function checkRoleCanTransitionOrder(
  role: StaffRole,
  newEstado?: string | null
): { allowed: boolean; error?: string } {
  if (!newEstado) return { allowed: true };

  if (role === "COCINA") {
    const allowedCocinaStates = ["en_cocina", "listo"];
    if (!allowedCocinaStates.includes(newEstado)) {
      return {
        allowed: false,
        error: `El rol de Cocina no tiene permisos para cobrar, anular ni cambiar el pedido al estado '${newEstado}'.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Valida si el rol autenticado tiene permisos para anular / eliminar un pedido completo.
 * - COCINA: PROHIBIDO anular pedidos.
 * - MESERO / CAJERO / ADMIN / SUPERADMIN: Permitido.
 */
export function checkRoleCanDeleteOrder(
  role: StaffRole
): { allowed: boolean; error?: string } {
  if (role === "COCINA") {
    return {
      allowed: false,
      error: "El rol de Cocina no tiene permisos para anular o eliminar pedidos.",
    };
  }
  return { allowed: true };
}

export interface TableAuthContext {
  authorized: boolean;
  negocioId?: string;
  mesa?: string;
  orderId?: string;
  customerName?: string;
  error?: string;
  status?: number;
}

/**
 * Extrae el token de sesión de mesa exclusivamente desde encabezados o cookies httpOnly.
 * Por política de seguridad estricta, NUNCA se admiten credenciales en parámetros de la URL.
 */
export function extractTableToken(req?: NextRequest): string | undefined {
  if (!req) return undefined;

  const headerToken = req.headers.get("x-table-session");
  if (headerToken?.trim()) return headerToken.trim();

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.substring(7).trim();
    const decoded = verifyTableSessionToken(candidate);
    if (decoded) return candidate;
  }

  const cookieToken = req.cookies.get("table_session")?.value || req.cookies.get("menuqr_table_session")?.value;
  if (cookieToken) return cookieToken;

  const tableCookie = req.cookies.getAll().find((c) => c.name.startsWith("table_session_"));
  if (tableCookie) return tableCookie.value;

  return undefined;
}

/**
 * Valida de forma criptográfica y estricta en el servidor que la petición provenga
 * de un comensal con sesión activa autorizada en la mesa y comanda correspondiente.
 * 
 * Garantías de Seguridad:
 * - El token fue firmado por el servidor con JWT_SECRET (imposible de falsificar desde JS cliente o con el salt público del QR).
 * - Está restringido al negocio correspondiente (no permite saltar de un restaurante a otro).
 * - Está restringido a la mesa correspondiente (un token de Mesa #2 no puede consultar la cuenta de Mesa #5).
 * - Está vinculado a la comanda exacta (orderId), impidiendo acceder a comandas de grupos posteriores en la misma mesa.
 * - Rechaza terminantemente credenciales en la URL.
 */
export async function verifyTableSessionAuth(
  req: NextRequest,
  targetNegocioId: string,
  targetMesa: string
): Promise<TableAuthContext> {
  const token = extractTableToken(req);
  if (!token) {
    return {
      authorized: false,
      error: "Acceso no autorizado a la cuenta de mesa. Se requiere una sesión activa validada en el servidor.",
      status: 401,
    };
  }

  const decoded = verifyTableSessionToken(token);
  if (!decoded) {
    return {
      authorized: false,
      error: "Token de sesión de mesa inválido, expirado o adulterado.",
      status: 401,
    };
  }

  // 1. Control multi-tenant estricto de negocio
  if (decoded.negocioId !== targetNegocioId) {
    return {
      authorized: false,
      error: "No autorizado para consultar la cuenta de un negocio ajeno.",
      status: 403,
    };
  }

  // 2. Control de aislamiento de mesa
  const cleanMesa = (m: string) => String(m || "").replace(/^(mesa\s*#?|#)/i, "").trim().toLowerCase();
  if (cleanMesa(decoded.mesa) !== cleanMesa(targetMesa)) {
    return {
      authorized: false,
      error: "El token de sesión no corresponde a la mesa consultada.",
      status: 403,
    };
  }

  // 3. Vinculación estricta a comanda exacta
  if (!decoded.orderId) {
    return {
      authorized: false,
      error: "Token de mesa no contiene comanda válida vinculada.",
      status: 401,
    };
  }

  return {
    authorized: true,
    negocioId: decoded.negocioId,
    mesa: decoded.mesa,
    orderId: decoded.orderId,
    customerName: decoded.customerName,
  };
}

