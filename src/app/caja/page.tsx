import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CajaClient } from "./CajaClient";
import { getActiveCashShift } from "@/lib/caja-actions";
import Link from "next/link";
import { Store, ArrowLeft, Barcode } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja POS Escáner | MenuQR Pro",
  description: "Terminal punto de venta con lector de código de barras para entradas de stock y ventas rápidas.",
};

export default async function CajaPage({
  searchParams,
}: {
  searchParams?: Promise<{ citaId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedCitaId = resolvedSearchParams?.citaId || null;
  const session = await getUserSession();
  const isSuperAdmin = await getSuperAdminSession();

  if (!session && !isSuperAdmin) {
    redirect("/login?next=/caja");
  }

  const cookieStore = await cookies();
  const sessionUserId = session?.userId || "";
  const activeRestaurantId = session?.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  type CajaRestaurant = NonNullable<Awaited<ReturnType<typeof prisma.restaurant.findFirst<{
    select: {
      id: true;
      name: true;
      slug: true;
      themeColor: true;
      customLabels: true;
      qrCobroUrl: true;
      bankName: true;
      bankAccountType: true;
      bankAccountNumber: true;
      bankAccountName: true;
      tablesConfig: true;
      businessType: true;
      ivaPercent: true;
      servicePercent: true;
      ivaOnTable: true;
      serviceOnTable: true;
      ivaOnTakeout: true;
      serviceOnTakeout: true;
      deliveryCost: true;
      deliveryEnabled: true;
      deliveryRates: true;
      datilConfig: {
        select: {
          isEnabled: true;
          environment: true;
          ruc: true;
          razonSocial: true;
          nombreComercial: true;
          direccionMatriz: true;
          regimen: true;
          obligadoContabilidad: true;
          establecimiento: true;
          puntoEmision: true;
        };
      };
    };
  }>>>>;

  let restaurant: CajaRestaurant | null = null;

  try {
    if (activeRestaurantId) {
      restaurant = await prisma.restaurant.findFirst({
        where: isSuperAdmin
          ? { id: activeRestaurantId }
          : { id: activeRestaurantId, ...(sessionUserId ? { userId: sessionUserId } : {}) },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          qrCobroUrl: true,
          bankName: true,
          bankAccountType: true,
          bankAccountNumber: true,
          bankAccountName: true,
          tablesConfig: true,
          businessType: true,
          ivaPercent: true,
          servicePercent: true,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: true,
          deliveryCost: true,
          deliveryEnabled: true,
          deliveryRates: true,
          datilConfig: {
            select: {
              isEnabled: true,
              environment: true,
              ruc: true,
              razonSocial: true,
              nombreComercial: true,
              direccionMatriz: true,
              regimen: true,
              obligadoContabilidad: true,
              establecimiento: true,
              puntoEmision: true,
            },
          },
        },
      });
    }

    if (!restaurant && sessionUserId) {
      restaurant = await prisma.restaurant.findFirst({
        where: { userId: sessionUserId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          qrCobroUrl: true,
          bankName: true,
          bankAccountType: true,
          bankAccountNumber: true,
          bankAccountName: true,
          tablesConfig: true,
          businessType: true,
          ivaPercent: true,
          servicePercent: true,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: true,
          deliveryCost: true,
          deliveryEnabled: true,
          deliveryRates: true,
          datilConfig: {
            select: {
              isEnabled: true,
              environment: true,
              ruc: true,
              razonSocial: true,
              nombreComercial: true,
              direccionMatriz: true,
              regimen: true,
              obligadoContabilidad: true,
              establecimiento: true,
              puntoEmision: true,
            },
          },
        },
      });
    }

    if (!restaurant && isSuperAdmin) {
      restaurant = await prisma.restaurant.findFirst({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          themeColor: true,
          customLabels: true,
          qrCobroUrl: true,
          bankName: true,
          bankAccountType: true,
          bankAccountNumber: true,
          bankAccountName: true,
          tablesConfig: true,
          businessType: true,
          ivaPercent: true,
          servicePercent: true,
          ivaOnTable: true,
          serviceOnTable: true,
          ivaOnTakeout: true,
          serviceOnTakeout: true,
          deliveryCost: true,
          deliveryEnabled: true,
          deliveryRates: true,
          datilConfig: {
            select: {
              isEnabled: true,
              environment: true,
              ruc: true,
              razonSocial: true,
              nombreComercial: true,
              direccionMatriz: true,
              regimen: true,
              obligadoContabilidad: true,
              establecimiento: true,
              puntoEmision: true,
            },
          },
        },
      });
    }
  } catch (dbErr) {
    console.error("Error querying restaurant in CajaPage:", dbErr);
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">No se encontró ningún negocio</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Necesitas tener al menos un negocio activo en tu cuenta para poder operar la Caja POS.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20"
        >
          <ArrowLeft className="w-4 h-4" /> Ir al Panel de Control
        </Link>
      </div>
    );
  }

  // Verify if Caja POS is disabled by Super Admin
  let customObj: Record<string, unknown> = {};
  if (restaurant.customLabels) {
    try {
      customObj = typeof restaurant.customLabels === "string" 
        ? JSON.parse(restaurant.customLabels) 
        : restaurant.customLabels;
    } catch {}
  }
  const disabledModules: string[] = Array.isArray(customObj.disabledModules) 
    ? customObj.disabledModules 
    : [];

  if (disabledModules.includes("caja")) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <Barcode className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Herramienta no habilitada</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          El módulo de <strong>Caja POS Móvil</strong> no se encuentra activo para tu negocio. Comunícate con soporte de Ubicame.cc para activarlo en tu cuenta.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel de Control
        </Link>
      </div>
    );
  }

  // Fetch categories for quick product creation
  let categories: { id: string; name: string }[] = [];
  try {
    categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
  } catch (catErr) {
    console.error("Error querying categories for Caja:", catErr);
  }

  // Fetch active cash shift (Arqueo y Sesión)
  let initialShift = null;
  try {
    const shiftRes = await getActiveCashShift(restaurant.id);
    if (shiftRes.success && shiftRes.shift) {
      initialShift = shiftRes.shift;
    }
  } catch (shiftErr) {
    console.error("Error querying active cash shift for Caja:", shiftErr);
  }

  // Fetch available dishes for quick touch POS grid
  let dishes: any[] = [];
  try {
    dishes = await prisma.dish.findMany({
      where: { restaurantId: restaurant.id, isAvailable: true },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        barcode: true,
        sku: true,
        stock: true,
        trackStock: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        modifierGroups: {
          include: {
            options: {
              orderBy: { extraPrice: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (dishErr) {
    console.error("Error querying dishes for Caja touch grid:", dishErr);
  }

  const serializedDishes = dishes.map((d: any) => ({
    id: d.id,
    name: d.name,
    price: Number(d.price) || 0,
    imageUrl: d.imageUrl || null,
    barcode: d.barcode || null,
    sku: d.sku || null,
    stock: d.stock !== null ? Number(d.stock) : null,
    trackStock: Boolean(d.trackStock),
    categoryId: d.categoryId || null,
    category: d.category ? { id: d.category.id, name: d.category.name } : null,
    modifierGroups: (d.modifierGroups || []).map((mg: any) => ({
      id: mg.id,
      name: mg.name,
      required: Boolean(mg.required),
      minSelect: Number(mg.minSelect) || 0,
      maxSelect: Number(mg.maxSelect) || 1,
      options: (mg.options || []).map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        extraPrice: Number(opt.extraPrice) || 0,
        isDefault: Boolean(opt.isDefault),
      })),
    })),
  }));

  let initialCitaOrder: any = null;
  let citasDelDia: any[] = [];
  if (restaurant) {
    try {
      await ensureDbTables();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { rows: citasRows } = await pool.query(
        `SELECT id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata
         FROM pedidos
         WHERE negocio_id = $1 
           AND vertical = 'citas'
           AND created_at >= $2
           AND estado NOT IN ('cancelada')
         ORDER BY created_at ASC`,
        [restaurant.id, todayStart.toISOString()]
      );

      const cIds = citasRows.map((r: any) => r.id);
      let itemsMap: Record<string, any[]> = {};
      if (cIds.length > 0) {
        const { rows: itemRows } = await pool.query(
          `SELECT id, pedido_id, nombre, cantidad, precio::float, notas FROM pedido_items WHERE pedido_id = ANY($1)`,
          [cIds]
        );
        for (const it of itemRows) {
          if (!itemsMap[it.pedido_id]) itemsMap[it.pedido_id] = [];
          itemsMap[it.pedido_id].push(it);
        }
      }

      citasDelDia = citasRows.map((r: any) => {
        let meta: any = {};
        try {
          meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : (r.metadata || {});
        } catch {}
        return {
          id: String(r.id),
          negocio_id: String(r.negocio_id),
          mesa: r.mesa ? String(r.mesa) : "CITA",
          estado: String(r.estado),
          total: Number(r.total) || 0,
          created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ""),
          cliente_nombre: r.cliente_nombre ? String(r.cliente_nombre) : "",
          cliente_telefono: r.cliente_telefono ? String(r.cliente_telefono) : "",
          vertical: r.vertical ? String(r.vertical) : "citas",
          metadata: meta,
          items: (itemsMap[r.id] || []).map((it: any) => ({
            id: String(it.id),
            nombre: String(it.nombre || ""),
            cantidad: Number(it.cantidad) || 1,
            precio: Number(it.precio) || 0,
            notas: it.notas ? String(it.notas) : null,
          })),
        };
      });

      if (requestedCitaId) {
        const found = citasDelDia.find((c) => c.id === requestedCitaId);
        if (found) {
          initialCitaOrder = found;
        } else {
          const { rows } = await pool.query(
            `SELECT id, negocio_id, mesa, estado, total::float, created_at, cliente_nombre, cliente_telefono, vertical, metadata
             FROM pedidos
             WHERE id = $1 AND negocio_id = $2 AND vertical = 'citas'
             LIMIT 1`,
            [requestedCitaId, restaurant.id]
          );
          if (rows.length > 0) {
            const c = rows[0];
            const { rows: itemRows } = await pool.query(
              `SELECT id, nombre, cantidad, precio::float, notas FROM pedido_items WHERE pedido_id = $1`,
              [c.id]
            );
            let meta: any = {};
            try {
              meta = typeof c.metadata === "string" ? JSON.parse(c.metadata) : (c.metadata || {});
            } catch {}
            initialCitaOrder = {
              id: String(c.id),
              negocio_id: String(c.negocio_id),
              mesa: c.mesa ? String(c.mesa) : "CITA",
              estado: String(c.estado),
              total: Number(c.total) || 0,
              created_at: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at || ""),
              cliente_nombre: c.cliente_nombre ? String(c.cliente_nombre) : "",
              cliente_telefono: c.cliente_telefono ? String(c.cliente_telefono) : "",
              vertical: c.vertical ? String(c.vertical) : "citas",
              metadata: meta,
              items: itemRows.map((it: any) => ({
                id: String(it.id),
                nombre: String(it.nombre || ""),
                cantidad: Number(it.cantidad) || 1,
                precio: Number(it.precio) || 0,
                notas: it.notas ? String(it.notas) : null,
              })),
            };
          }
        }
      }
    } catch (e) {
      console.error("Error loading citas in CajaPage:", e);
    }
  }

  const currentUser = {
    id: session?.userId || "admin",
    name: session?.email?.split("@")[0] || "Administrador",
    email: session?.email || "admin@ubicame.cc",
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <CajaClient
        initialCitaOrder={initialCitaOrder}
        initialCitasDelDia={citasDelDia}
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          themeColor: restaurant.themeColor || "#059669",
          qrCobroUrl: restaurant.qrCobroUrl || null,
          bankName: restaurant.bankName || null,
          bankAccountType: restaurant.bankAccountType || null,
          bankAccountNumber: restaurant.bankAccountNumber || null,
          bankAccountName: restaurant.bankAccountName || null,
          tablesConfig: restaurant.tablesConfig || "1,2,3,4,5,6,7,8,9,10",
          businessType: restaurant.businessType || "RESTAURANT",
          customLabels: restaurant.customLabels || null,
          ivaPercent: typeof restaurant.ivaPercent === "number" ? restaurant.ivaPercent : 15,
          servicePercent: typeof restaurant.servicePercent === "number" ? restaurant.servicePercent : 10,
          ivaOnTable: restaurant.ivaOnTable ?? true,
          serviceOnTable: restaurant.serviceOnTable ?? true,
          ivaOnTakeout: restaurant.ivaOnTakeout ?? restaurant.ivaOnTable ?? true,
          serviceOnTakeout: restaurant.serviceOnTakeout ?? restaurant.serviceOnTable ?? true,
          deliveryCost: typeof restaurant.deliveryCost === "number" ? restaurant.deliveryCost : 0,
          deliveryEnabled: restaurant.deliveryEnabled ?? true,
          deliveryRates: (restaurant as any).deliveryRates || null,
          datilConfig: (restaurant as any).datilConfig || null,
        }}
        categories={categories}
        initialShift={initialShift}
        currentUser={currentUser}
        dishes={serializedDishes}
      />
    </main>
  );
}
