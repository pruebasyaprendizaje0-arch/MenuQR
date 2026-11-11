"use server";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import { getUserSession, getSuperAdminSession, refreshUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function getReservationDb(): PrismaClient {
  if ((prisma as any)?.tableReservation?.create) {
    return prisma as PrismaClient;
  }
  try {
    const fresh = new PrismaClient();
    (globalThis as any).prismaMain = fresh;
    return fresh;
  } catch {
    return prisma as PrismaClient;
  }
}

let schemaEnsured = false;
async function ensureTableReservationSchema(client: PrismaClient) {
  if (schemaEnsured) return;
  try {
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TableReservation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "restaurantId" TEXT NOT NULL,
        "customerName" TEXT NOT NULL,
        "customerPhone" TEXT NOT NULL,
        "peopleCount" INTEGER NOT NULL DEFAULT 2,
        "reservationDate" TIMESTAMP(3) NOT NULL,
        "reservationTime" TEXT NOT NULL,
        "tableName" TEXT,
        "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "depositPaid" BOOLEAN NOT NULL DEFAULT false,
        "depositMethod" TEXT,
        "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
        "notes" TEXT,
        "usedInOrderId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await client.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_reservationDate_idx" ON "TableReservation"("restaurantId", "reservationDate")`
      );
    } catch {}
    try {
      await client.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_status_idx" ON "TableReservation"("restaurantId", "status")`
      );
    } catch {}
    try {
      await client.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TableReservation_restaurantId_customerPhone_idx" ON "TableReservation"("restaurantId", "customerPhone")`
      );
    } catch {}
    schemaEnsured = true;
  } catch (err) {
    console.error("[ensureTableReservationSchema] Error creating TableReservation table:", err);
    throw err;
  }
}

async function verifyRestaurantOwnership(restaurantId: string): Promise<{ authorized: boolean; error?: string }> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) return { authorized: true };

  const session = await getUserSession();
  if (!session || !session.userId) {
    return { authorized: false, error: "No autenticado. Por favor inicie sesión." };
  }

  const db = getReservationDb();
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, userId: true },
  });

  if (!restaurant) {
    return { authorized: false, error: "Negocio no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    return { authorized: false, error: "No tiene permisos para modificar este negocio." };
  }

  return { authorized: true };
}

export interface SerializedTableReservation {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  peopleCount: number;
  reservationDate: string; // ISO date string
  reservationTime: string; // e.g. "20:00"
  tableName: string | null;
  depositAmount: number;
  depositPaid: boolean;
  depositMethod: string | null;
  status: "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes: string | null;
  usedInOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableReservationInput {
  restaurantId: string;
  customerName: string;
  customerPhone?: string;
  peopleCount?: number;
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // e.g. "20:00"
  tableName?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  depositMethod?: "EFECTIVO" | "TRANSFERENCIA" | "DEUNA" | "TARJETA";
  notes?: string;
}

/**
 * Crea una reserva de mesa con o sin abono anticipado
 */
export async function createTableReservationAction(
  data: CreateTableReservationInput
): Promise<{ success: boolean; reservation?: SerializedTableReservation; error?: string }> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(data.restaurantId);
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    if (!data.customerName?.trim()) {
      return { success: false, error: "El nombre del cliente es obligatorio." };
    }
    if (!data.reservationDate?.trim()) {
      return { success: false, error: "La fecha de la reserva es obligatoria." };
    }
    if (!data.reservationTime?.trim()) {
      return { success: false, error: "La hora de la reserva es obligatoria." };
    }

    const people = Math.max(1, parseInt(String(data.peopleCount)) || 2);
    const deposit = Math.max(0, parseFloat(String(data.depositAmount || 0)) || 0);
    const depositPaid = deposit > 0 ? (data.depositPaid ?? true) : false;

    // Normalizar fecha al mediodía UTC para evitar desfases de huso horario
    const dateObj = new Date(`${data.reservationDate}T12:00:00.000Z`);
    const cleanPhone = data.customerPhone?.trim() || "";

    const db = getReservationDb();
    await ensureTableReservationSchema(db);

    let reservation: any = null;

    if ((db as any).tableReservation?.create) {
      reservation = await (db as any).tableReservation.create({
        data: {
          restaurantId: data.restaurantId,
          customerName: data.customerName.trim(),
          customerPhone: cleanPhone,
          peopleCount: people,
          reservationDate: dateObj,
          reservationTime: data.reservationTime.trim(),
          tableName: data.tableName?.trim() || null,
          depositAmount: deposit,
          depositPaid,
          depositMethod: data.depositMethod?.trim() || (deposit > 0 ? "EFECTIVO" : null),
          status: "CONFIRMED",
          notes: data.notes?.trim() || null,
        },
      });
    } else {
      // Fallback robusto con SQL directo si Next.js retuvo una instancia previa de Prisma en memoria
      const newId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      await db.$executeRawUnsafe(
        `INSERT INTO "TableReservation" (
          "id", "restaurantId", "customerName", "customerPhone", "peopleCount",
          "reservationDate", "reservationTime", "tableName", "depositAmount",
          "depositPaid", "depositMethod", "status", "notes", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        newId,
        data.restaurantId,
        data.customerName.trim(),
        cleanPhone,
        people,
        dateObj,
        data.reservationTime.trim(),
        data.tableName?.trim() || null,
        deposit,
        depositPaid,
        data.depositMethod?.trim() || (deposit > 0 ? "EFECTIVO" : null),
        "CONFIRMED",
        data.notes?.trim() || null,
        now,
        now
      );
      reservation = {
        id: newId,
        restaurantId: data.restaurantId,
        customerName: data.customerName.trim(),
        customerPhone: cleanPhone,
        peopleCount: people,
        reservationDate: dateObj,
        reservationTime: data.reservationTime.trim(),
        tableName: data.tableName?.trim() || null,
        depositAmount: deposit,
        depositPaid,
        depositMethod: data.depositMethod?.trim() || (deposit > 0 ? "EFECTIVO" : null),
        status: "CONFIRMED",
        notes: data.notes?.trim() || null,
        usedInOrderId: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    // Sincronizar contacto en el CRM de Clientes
    try {
      if (cleanPhone) {
        const existingCustomer = await db.customer.findFirst({
          where: { restaurantId: data.restaurantId, phone: cleanPhone },
        });
        if (existingCustomer) {
          await db.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: data.customerName.trim() || existingCustomer.name,
            },
          });
        } else {
          await db.customer.create({
            data: {
              restaurantId: data.restaurantId,
              name: data.customerName.trim(),
              phone: cleanPhone,
              totalOrders: 0,
              totalSpent: 0,
            },
          });
        }
      }
    } catch (crmErr) {
      console.warn("[Reservas] No se pudo sincronizar CRM:", crmErr);
    }

    revalidatePath("/caja");
    revalidatePath("/admin");

    const dateStr = reservation.reservationDate instanceof Date
      ? reservation.reservationDate.toISOString()
      : String(reservation.reservationDate);
    const createdStr = reservation.createdAt instanceof Date
      ? reservation.createdAt.toISOString()
      : String(reservation.createdAt);
    const updatedStr = reservation.updatedAt instanceof Date
      ? reservation.updatedAt.toISOString()
      : String(reservation.updatedAt);

    return {
      success: true,
      reservation: {
        id: reservation.id,
        restaurantId: reservation.restaurantId,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        peopleCount: reservation.peopleCount,
        reservationDate: dateStr,
        reservationTime: reservation.reservationTime,
        tableName: reservation.tableName,
        depositAmount: Number(reservation.depositAmount) || 0,
        depositPaid: Boolean(reservation.depositPaid),
        depositMethod: reservation.depositMethod,
        status: reservation.status as any,
        notes: reservation.notes,
        usedInOrderId: reservation.usedInOrderId,
        createdAt: createdStr,
        updatedAt: updatedStr,
      },
    };
  } catch (err: any) {
    console.error("Error al crear reserva de mesa:", err);
    return { success: false, error: err.message || "Error al registrar la reserva." };
  }
}

/**
 * Consulta reservas con filtros por fecha, estado o mes
 */
export async function getTableReservationsAction(
  restaurantId: string,
  filters?: {
    date?: string; // YYYY-MM-DD
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; reservations: SerializedTableReservation[]; error?: string }> {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { success: false, reservations: [], error: auth.error };

    const db = getReservationDb();
    await ensureTableReservationSchema(db);

    let items: any[] = [];

    if ((db as any).tableReservation?.findMany) {
      const whereClause: any = { restaurantId };

      if (filters?.status && filters.status !== "ALL") {
        whereClause.status = filters.status;
      }

      if (filters?.date) {
        const startOfDay = new Date(`${filters.date}T00:00:00.000Z`);
        const endOfDay = new Date(`${filters.date}T23:59:59.999Z`);
        whereClause.reservationDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      } else if (filters?.startDate && filters?.endDate) {
        whereClause.reservationDate = {
          gte: new Date(`${filters.startDate}T00:00:00.000Z`),
          lte: new Date(`${filters.endDate}T23:59:59.999Z`),
        };
      }

      items = await (db as any).tableReservation.findMany({
        where: whereClause,
        orderBy: [{ reservationDate: "asc" }, { reservationTime: "asc" }],
      });
    } else {
      let query = `SELECT * FROM "TableReservation" WHERE "restaurantId" = $1`;
      const params: any[] = [restaurantId];
      if (filters?.status && filters.status !== "ALL") {
        params.push(filters.status);
        query += ` AND "status" = $${params.length}`;
      }
      if (filters?.date) {
        params.push(new Date(`${filters.date}T00:00:00.000Z`));
        params.push(new Date(`${filters.date}T23:59:59.999Z`));
        query += ` AND "reservationDate" >= $${params.length - 1} AND "reservationDate" <= $${params.length}`;
      }
      query += ` ORDER BY "reservationDate" ASC, "reservationTime" ASC`;
      items = await db.$queryRawUnsafe(query, ...params);
    }

    const serialized: SerializedTableReservation[] = items.map((r) => {
      const rawDate = r.reservationDate || r.reservationdate;
      const rawCreated = r.createdAt || r.createdat;
      const rawUpdated = r.updatedAt || r.updatedat;
      const dateStr = rawDate instanceof Date ? rawDate.toISOString() : String(rawDate || "");
      const createdStr = rawCreated instanceof Date ? rawCreated.toISOString() : String(rawCreated || "");
      const updatedStr = rawUpdated instanceof Date ? rawUpdated.toISOString() : String(rawUpdated || "");
      const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
      return {
        id: r.id,
        restaurantId: r.restaurantId || r.restaurantid,
        customerName: r.customerName || r.customername,
        customerPhone: r.customerPhone || r.customerphone,
        peopleCount: Number(r.peopleCount || r.peoplecount) || 2,
        reservationDate: cleanDate,
        reservationTime: r.reservationTime || r.reservationtime,
        tableName: r.tableName || r.tablename || null,
        depositAmount: Number(r.depositAmount || r.depositamount) || 0,
        depositPaid: Boolean(r.depositPaid !== undefined ? r.depositPaid : r.depositpaid),
        depositMethod: r.depositMethod || r.depositmethod || null,
        status: (r.status as any) || "CONFIRMED",
        notes: r.notes || null,
        usedInOrderId: r.usedInOrderId || r.usedinorderid || null,
        createdAt: createdStr,
        updatedAt: updatedStr,
      };
    });

    return { success: true, reservations: serialized };
  } catch (err: any) {
    console.error("Error al obtener reservas de mesa:", err);
    return { success: false, reservations: [], error: err.message };
  }
}

/**
 * Actualiza el estado de la reserva (CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW)
 */
export async function updateTableReservationStatusAction(
  reservationId: string,
  status: "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
  details?: {
    tableName?: string | null;
    usedInOrderId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await refreshUserSession();
    const db = getReservationDb();
    await ensureTableReservationSchema(db);

    let existing: any = null;
    if ((db as any).tableReservation?.findUnique) {
      existing = await (db as any).tableReservation.findUnique({
        where: { id: reservationId },
      });
    } else {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM "TableReservation" WHERE "id" = $1 LIMIT 1`, reservationId);
      existing = rows[0] || null;
    }

    if (!existing) return { success: false, error: "Reserva no encontrada." };

    const auth = await verifyRestaurantOwnership(existing.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const effectiveTable = details?.tableName !== undefined ? details.tableName : existing.tableName;
    const effectiveOrder = details?.usedInOrderId !== undefined ? details.usedInOrderId : existing.usedInOrderId;

    if ((db as any).tableReservation?.update) {
      await (db as any).tableReservation.update({
        where: { id: reservationId },
        data: {
          status,
          tableName: effectiveTable,
          usedInOrderId: effectiveOrder,
        },
      });
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "TableReservation" SET "status" = $1, "tableName" = $2, "usedInOrderId" = $3, "updatedAt" = $4 WHERE "id" = $5`,
        status,
        effectiveTable,
        effectiveOrder,
        new Date(),
        reservationId
      );
    }

    revalidatePath("/caja");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("Error actualizando estado de reserva:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Elimina una reserva
 */
export async function deleteTableReservationAction(
  reservationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await refreshUserSession();
    const db = getReservationDb();
    await ensureTableReservationSchema(db);

    let existing: any = null;
    if ((db as any).tableReservation?.findUnique) {
      existing = await (db as any).tableReservation.findUnique({
        where: { id: reservationId },
      });
    } else {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM "TableReservation" WHERE "id" = $1 LIMIT 1`, reservationId);
      existing = rows[0] || null;
    }

    if (!existing) return { success: false, error: "Reserva no encontrada." };

    const auth = await verifyRestaurantOwnership(existing.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    if ((db as any).tableReservation?.delete) {
      await (db as any).tableReservation.delete({
        where: { id: reservationId },
      });
    } else {
      await db.$executeRawUnsafe(`DELETE FROM "TableReservation" WHERE "id" = $1`, reservationId);
    }

    revalidatePath("/caja");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("Error al eliminar reserva:", err);
    return { success: false, error: err.message };
  }
}
