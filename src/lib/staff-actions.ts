"use server";

import { prisma } from "@/lib/db";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface SecurityCustomLabels {
  kitchenPin?: string;
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

    // Consultar todos los meseros registrados (activos e inactivos)
    const { rows: camareros } = await pool.query(
      `SELECT id, negocio_id, nombre, pin, activo, created_at
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

    const kitchenPin = typeof customObj.kitchenPin === "string" ? customObj.kitchenPin : "";
    const kitchenPinRequired = Boolean(customObj.kitchenPinRequired && customObj.kitchenPin);
    const waiterPinRequired = customObj.waiterPinRequired !== false;

    return {
      success: true,
      camareros: camareros.map((c) => ({
        id: c.id,
        negocio_id: c.negocio_id,
        nombre: c.nombre,
        pin: c.pin || "1234",
        activo: c.activo ?? true,
        created_at: c.created_at,
      })),
      kitchenSecurity: {
        kitchenPin,
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
 * Crear un nuevo mesero
 */
export async function createWaiterAction(restaurantId: string, nombre: string, pin: string) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    const cleanNombre = nombre?.trim();
    if (!cleanNombre) {
      return { success: false, error: "El nombre del mesero es obligatorio." };
    }

    const cleanPin = pin?.trim() || "1234";
    if (cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
      return { success: false, error: "El PIN debe ser numérico de 4 a 8 dígitos (ej. 1234)." };
    }

    await ensureDbTables();

    // Sincronizar negocio si aún no existe en tabla relacional
    await pool.query(
      `INSERT INTO negocios (id, nombre, slug, numero_mesas)
       VALUES ($1, $2, $3, 10)
       ON CONFLICT (id) DO UPDATE SET slug = $3, nombre = $2`,
      [auth.restaurant.id, auth.restaurant.name, auth.restaurant.slug]
    );

    // Verificar si ya existe un mesero con el mismo nombre en este negocio
    const { rows: existing } = await pool.query(
      `SELECT id FROM camareros WHERE negocio_id = $1 AND LOWER(nombre) = LOWER($2)`,
      [auth.restaurant.id, cleanNombre]
    );

    if (existing.length > 0) {
      return { success: false, error: `Ya existe un mesero registrado con el nombre "${cleanNombre}".` };
    }

    // Insertar mesero
    const { rows } = await pool.query(
      `INSERT INTO camareros (negocio_id, nombre, pin, activo)
       VALUES ($1, $2, $3, true)
       RETURNING id, negocio_id, nombre, pin, activo, created_at`,
      [auth.restaurant.id, cleanNombre, cleanPin]
    );

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/mesas`);

    return {
      success: true,
      camarero: {
        id: rows[0].id,
        negocio_id: rows[0].negocio_id,
        nombre: rows[0].nombre,
        pin: rows[0].pin || "1234",
        activo: rows[0].activo ?? true,
        created_at: rows[0].created_at,
      },
      message: `Mesero "${cleanNombre}" agregado exitosamente con PIN ${cleanPin}.`,
    };
  } catch (err: unknown) {
    console.error("[createWaiterAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al crear mesero.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Editar datos de un mesero (nombre, PIN, estado activo)
 */
export async function updateWaiterAction(
  restaurantId: string,
  waiterId: string,
  data: { nombre: string; pin?: string; activo?: boolean }
) {
  try {
    const auth = await verifyRestaurantAccess(restaurantId);
    if (!auth.authorized || !auth.restaurant) {
      return { success: false, error: auth.error || "No autorizado" };
    }

    const cleanNombre = data.nombre?.trim();
    if (!cleanNombre) {
      return { success: false, error: "El nombre del mesero no puede estar vacío." };
    }

    let cleanPin: string | null = null;
    if (data.pin !== undefined && data.pin !== null && data.pin.trim() !== "") {
      const p = data.pin.trim();
      if (p.length < 4 || p.length > 8 || !/^\d+$/.test(p)) {
        return { success: false, error: "El PIN debe ser numérico de 4 a 8 dígitos (ej. 1234)." };
      }
      cleanPin = p;
    }

    await ensureDbTables();

    const { rows } = await pool.query(
      `UPDATE camareros
       SET
         nombre = $1,
         pin = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE pin END,
         activo = COALESCE($3, activo)
       WHERE id = $4 AND negocio_id = $5
       RETURNING id, negocio_id, nombre, pin, activo, created_at`,
      [cleanNombre, cleanPin, data.activo !== undefined ? data.activo : null, waiterId, auth.restaurant.id]
    );

    if (rows.length === 0) {
      return { success: false, error: "Mesero no encontrado o no pertenece a este negocio." };
    }

    revalidatePath("/admin");
    revalidatePath(`/${auth.restaurant.slug}/mesas`);

    return {
      success: true,
      camarero: {
        id: rows[0].id,
        negocio_id: rows[0].negocio_id,
        nombre: rows[0].nombre,
        pin: rows[0].pin || "1234",
        activo: rows[0].activo ?? true,
        created_at: rows[0].created_at,
      },
      message: "Mesero actualizado correctamente.",
    };
  } catch (err: unknown) {
    console.error("[updateWaiterAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al actualizar mesero.";
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
      if (p !== "" && (p.length < 4 || p.length > 8 || !/^\d+$/.test(p))) {
        return { success: false, error: "El PIN de cocina debe ser numérico de 4 a 8 dígitos (ej. 1234)." };
      }
      customObj.kitchenPin = p;
    }

    if (data.kitchenPinRequired !== undefined) {
      customObj.kitchenPinRequired = Boolean(data.kitchenPinRequired && customObj.kitchenPin);
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
        kitchenPin: customObj.kitchenPin || "",
        kitchenPinRequired: Boolean(customObj.kitchenPinRequired && customObj.kitchenPin),
        waiterPinRequired: customObj.waiterPinRequired !== false,
      },
    };
  } catch (err: unknown) {
    console.error("[saveKitchenSecurityAction] Error:", err);
    const errorMsg = err instanceof Error ? err.message : "Error al guardar configuración de seguridad.";
    return { success: false, error: errorMsg };
  }
}
