"use server";

import { prisma } from "@/lib/db";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { validatePinFormat, hashPin, isHashedPin } from "@/lib/security-pins";

export type StaffRole = "MESERO" | "CAJERO" | "REPARTIDOR";

export interface StaffMemberData {
  id: string;
  negocio_id: string;
  nombre: string;
  hasPin: boolean;
  rol: StaffRole;
  telefono: string | null;
  activo: boolean;
  created_at?: string;
}

interface SecurityCustomLabels {
  kitchenPin?: string;
  kitchenPinHash?: string | null;
  kitchenPinRequired?: boolean;
  waiterPinRequired?: boolean;
  [key: string]: unknown;
}

/**
 * Multi-tenant Authorization Helper: Verifies that the current user owns the restaurant
 * or is logged in as SuperAdmin.
 */
async function verifyRestaurantAccess(restaurantId: string) {
  const isSuperAdmin = await getSuperAdminSession();
  const session = await getUserSession();

  if (!session && !isSuperAdmin) {
    return { authorized: false, error: "No autenticado. Por favor inicia sesión." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      customLabels: true,
    },
  });

  if (!restaurant) {
    return { authorized: false, error: "Restaurante no encontrado." };
  }

  if (!isSuperAdmin && session?.userId !== restaurant.userId) {
    return { authorized: false, error: "No tienes permisos para administrar este negocio." };
  }

  return { authorized: true, restaurant };
}

/**
 * Obtener listado de meseros y configuración de seguridad de cocina para el negocio
 */
export async function getStaffDataAction(restaurantId: string) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    await ensureDbTables();

    // Sincronizar negocio en tabla negocios si aún no existe
    await pool.query(
      `INSERT INTO negocios (id, nombre, slug, numero_mesas)
       VALUES ($1, $2, $3, 10)
       ON CONFLICT (id) DO UPDATE SET slug = $3, nombre = $2`,
      [auth.restaurant.id, auth.restaurant.name, auth.restaurant.slug]
    );

    // Consultar todo el personal registrado (meseros, cajeros, repartidores)
    const { rows: camareros } = await pool.query(
      `SELECT id, negocio_id, nombre, pin, COALESCE(rol, 'MESERO') as rol, telefono, activo, created_at
       FROM camareros
       WHERE negocio_id = $1
       ORDER BY created_at ASC`,
      [auth.restaurant.id]
    );

    // Parsear configuración de seguridad de customLabels
    let customObj: SecurityCustomLabels = {};
    if (auth.restaurant.customLabels) {
      try {
        customObj = typeof auth.restaurant.customLabels === "string"
          ? JSON.parse(auth.restaurant.customLabels)
          : (auth.restaurant.customLabels as unknown as SecurityCustomLabels);
      } catch {}
    }

    const kitchenPinHash = typeof customObj.kitchenPinHash === "string" ? customObj.kitchenPinHash : null;
    const kitchenPinSet = Boolean(kitchenPinHash && isHashedPin(kitchenPinHash));
    const kitchenPinRequired = Boolean(customObj.kitchenPinRequired && kitchenPinSet);
    const waiterPinRequired = customObj.waiterPinRequired !== false;

    return {
      success: true,
      camareros: camareros.map((c) => ({
        id: c.id,
        negocio_id: c.negocio_id,
        nombre: c.nombre,
        hasPin: Boolean(c.pin && isHashedPin(c.pin)),
        rol: (c.rol as StaffRole) || "MESERO",
        telefono: c.telefono || null,
        activo: c.activo ?? true,
        created_at: c.created_at,
      })),
      kitchenSecurity: {
        kitchenPinSet,
        kitchenPinRequired,
        waiterPinRequired,
      },
    };
  } catch (err: unknown) {
    console.error("[getStaffDataAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al cargar datos del equipo.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Crear un nuevo integrante del equipo (Mesero, Cajero o Repartidor)
 * El administrador autorizado debe asignar obligatoriamente un PIN numérico no predeterminado (4 a 8 dígitos).
 * Se almacena únicamente como hash seguro bcrypt.
 */
export async function createWaiterAction(
  restaurantId: string,
  nombre: string,
  pin: string,
  rol: StaffRole = "MESERO",
  telefono?: string | null
) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    const cleanNombre = nombre?.trim();
    if (!cleanNombre) {
      return { success: false, error: "El nombre del integrante es obligatorio." };
    }

    const pinVal = validatePinFormat(pin);
    if (!pinVal.valid || !pinVal.cleanPin) {
      return { success: false, error: pinVal.error || "PIN inválido." };
    }

    const hashedPin = hashPin(pinVal.cleanPin);
    const cleanRol: StaffRole = rol === "CAJERO" || rol === "REPARTIDOR" ? rol : "MESERO";
    const cleanPhone = telefono?.trim() || null;

    await ensureDbTables();

    // Sincronizar negocio si aún no existe en tabla relacional
    await pool.query(
      `INSERT INTO negocios (id, nombre, slug, numero_mesas)
       VALUES ($1, $2, $3, 10)
       ON CONFLICT (id) DO UPDATE SET slug = $3, nombre = $2`,
      [auth.restaurant.id, auth.restaurant.name, auth.restaurant.slug]
    );

    // Verificar si ya existe alguien con el mismo nombre en este negocio
    const { rows: existing } = await pool.query(
      `SELECT id FROM camareros WHERE negocio_id = $1 AND LOWER(nombre) = LOWER($2)`,
      [auth.restaurant.id, cleanNombre]
    );

    if (existing.length > 0) {
      return { success: false, error: `Ya existe un integrante registrado con el nombre "${cleanNombre}".` };
    }

    // Insertar miembro de equipo con hash seguro de PIN
    const { rows } = await pool.query(
      `INSERT INTO camareros (negocio_id, nombre, pin, rol, telefono, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, negocio_id, nombre, pin, rol, telefono, activo, created_at`,
      [auth.restaurant.id, cleanNombre, hashedPin, cleanRol, cleanPhone]
    );

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/mesas`);
    revalidatePath(`/caja`);
    revalidatePath(`/${auth.restaurant.slug}/repartidor`);

    const rolLabel = cleanRol === "CAJERO" ? "Cajero" : cleanRol === "REPARTIDOR" ? "Repartidor" : "Mesero";

    return {
      success: true,
      camarero: {
        id: rows[0].id,
        negocio_id: rows[0].negocio_id,
        nombre: rows[0].nombre,
        hasPin: true,
        rol: (rows[0].rol as StaffRole) || cleanRol,
        telefono: rows[0].telefono || null,
        activo: rows[0].activo ?? true,
        created_at: rows[0].created_at,
      },
      message: `${rolLabel} "${cleanNombre}" agregado exitosamente con PIN seguro asignado.`,
    };
  } catch (err: unknown) {
    console.error("[createWaiterAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al crear integrante.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Editar datos de un integrante del equipo (nombre, PIN, rol, teléfono, estado activo)
 */
export async function updateWaiterAction(
  restaurantId: string,
  waiterId: string,
  data: { nombre: string; pin?: string; rol?: StaffRole; telefono?: string | null; activo?: boolean }
) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    const cleanNombre = data.nombre?.trim();
    if (!cleanNombre) {
      return { success: false, error: "El nombre no puede estar vacío." };
    }

    let cleanPin: string | null = null;
    if (data.pin !== undefined && data.pin !== null && data.pin.trim() !== "") {
      const pinVal = validatePinFormat(data.pin);
      if (!pinVal.valid || !pinVal.cleanPin) {
        return { success: false, error: pinVal.error || "PIN inválido." };
      }
      cleanPin = hashPin(pinVal.cleanPin);
    }

    const cleanRol: StaffRole | null =
      data.rol === "CAJERO" || data.rol === "REPARTIDOR" || data.rol === "MESERO" ? data.rol : null;

    const shouldUpdatePhone = data.telefono !== undefined;
    const cleanPhone = data.telefono ? data.telefono.trim() : null;

    await ensureDbTables();

    const { rows } = await pool.query(
      `UPDATE camareros
       SET
         nombre = $1,
         pin = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE pin END,
         rol = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE rol END,
         telefono = CASE WHEN $4::boolean = true THEN $5::text ELSE telefono END,
         activo = COALESCE($6, activo)
       WHERE id = $7 AND negocio_id = $8
       RETURNING id, negocio_id, nombre, pin, rol, telefono, activo, created_at`,
      [
        cleanNombre,
        cleanPin,
        cleanRol,
        shouldUpdatePhone,
        cleanPhone,
        data.activo !== undefined ? data.activo : null,
        waiterId,
        auth.restaurant.id,
      ]
    );

    if (rows.length === 0) {
      return { success: false, error: "Integrante no encontrado o no pertenece a este negocio." };
    }

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/mesas`);
    revalidatePath(`/caja`);
    revalidatePath(`/${auth.restaurant.slug}/repartidor`);

    return {
      success: true,
      camarero: {
        id: rows[0].id,
        negocio_id: rows[0].negocio_id,
        nombre: rows[0].nombre,
        hasPin: Boolean(rows[0].pin && isHashedPin(rows[0].pin)),
        rol: (rows[0].rol as StaffRole) || "MESERO",
        telefono: rows[0].telefono || null,
        activo: rows[0].activo ?? true,
        created_at: rows[0].created_at,
      },
      message: "Datos del personal actualizados correctamente.",
    };
  } catch (err: unknown) {
    console.error("[updateWaiterAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al actualizar integrante.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Eliminar un mesero
 */
export async function deleteWaiterAction(restaurantId: string, waiterId: string) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    await ensureDbTables();

    const { rowCount } = await pool.query(
      `DELETE FROM camareros WHERE id = $1 AND negocio_id = $2`,
      [waiterId, auth.restaurant.id]
    );

    if (!rowCount || rowCount === 0) {
      return { success: false, error: "Mesero no encontrado o no pertenece a este negocio." };
    }

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/mesas`);

    return { success: true, message: "Mesero eliminado correctamente." };
  } catch (err: unknown) {
    console.error("[deleteWaiterAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al eliminar mesero.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Guardar configuración de seguridad de Pantalla Cocina KDS y Comandero de Mesas
 * Los PINs se almacenan estrictamente como hashes bcrypt (nunca en texto plano).
 */
export async function saveKitchenSecurityAction(
  restaurantId: string,
  data: {
    kitchenPin?: string;
    kitchenPinRequired?: boolean;
    waiterPinRequired?: boolean;
  }
) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    let customObj: SecurityCustomLabels = {};
    if (auth.restaurant.customLabels) {
      try {
        customObj = typeof auth.restaurant.customLabels === "string"
          ? JSON.parse(auth.restaurant.customLabels)
          : (auth.restaurant.customLabels as unknown as SecurityCustomLabels);
      } catch {}
    }

    if (data.kitchenPin !== undefined) {
      const p = data.kitchenPin.trim();
      if (p === "") {
        // Deshabilitar/limpiar PIN de cocina
        delete customObj.kitchenPin;
        customObj.kitchenPinHash = null;
      } else {
        const pinVal = validatePinFormat(p);
        if (!pinVal.valid || !pinVal.cleanPin) {
          return { success: false, error: pinVal.error || "PIN de cocina inválido." };
        }
        customObj.kitchenPinHash = hashPin(pinVal.cleanPin);
        delete customObj.kitchenPin; // Eliminar cualquier vestigio en texto plano
      }
    }

    const hasKitchenHash = Boolean(customObj.kitchenPinHash && isHashedPin(String(customObj.kitchenPinHash)));

    if (data.kitchenPinRequired !== undefined) {
      customObj.kitchenPinRequired = Boolean(data.kitchenPinRequired && hasKitchenHash);
    }

    if (data.waiterPinRequired !== undefined) {
      customObj.waiterPinRequired = Boolean(data.waiterPinRequired);
    }

    await prisma.restaurant.update({
      where: { id: auth.restaurant.id },
      data: {
        customLabels: JSON.stringify(customObj),
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/cocina`);
    revalidatePath(`/${auth.restaurant.slug}/mesas`);

    return {
      success: true,
      message: "Configuración de seguridad y claves guardada correctamente.",
      kitchenSecurity: {
        kitchenPinSet: hasKitchenHash,
        kitchenPinRequired: Boolean(customObj.kitchenPinRequired && hasKitchenHash),
        waiterPinRequired: customObj.waiterPinRequired !== false,
      },
    };
  } catch (err: unknown) {
    console.error("[saveKitchenSecurityAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al guardar configuración de seguridad.";
    return { success: false, error: errorMsg };
  }
}
