import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { Sparkles, ArrowLeft, ChefHat, Users, LayoutDashboard, Trees, Calendar, Wrench, ShoppingBag, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { RestaurantSwitcher } from "./components/RestaurantSwitcher";
import { getActiveNotificationsForRestaurant } from "@/lib/notifications";
import { AdminNotificationHost, AdminNotificationBell } from "./components/notifications";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const isSuperAdmin = await getSuperAdminSession();
  const cookieStore = await cookies();
  const sessionUserId = session.userId || "";
  const activeRestaurantId = session.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  // Lista de todos los negocios del usuario para el selector multi-empresa
  const userRestaurants = await prisma.restaurant.findMany({
    where: isSuperAdmin && !sessionUserId ? {} : { userId: sessionUserId },
    select: {
      id: true,
      name: true,
      slug: true,
      businessType: true,
      logoUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Resolución estricta del negocio activo: prioriza el ID de sesión/cookie sobre el primer registro del usuario
  let userRestaurant = null;
  if (activeRestaurantId) {
    userRestaurant = await prisma.restaurant.findFirst({
      where: isSuperAdmin
        ? { id: activeRestaurantId }
        : { id: activeRestaurantId, userId: sessionUserId },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        enableTableOrdering: true,
        customLabels: true,
      },
    });
  }

  if (!userRestaurant) {
    userRestaurant = await prisma.restaurant.findFirst({
      where: { userId: sessionUserId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        enableTableOrdering: true,
        customLabels: true,
      },
    });
  }

  const parsedLabels = (() => {
    try {
      return userRestaurant?.customLabels ? JSON.parse(userRestaurant.customLabels) : {};
    } catch {
      return {};
    }
  })();

  const disabledModules: string[] = Array.isArray(parsedLabels.disabledModules) ? parsedLabels.disabledModules : [];
  const enabledModules: string[] = Array.isArray(parsedLabels.enabledModules) ? parsedLabels.enabledModules : [];

  const isReservas = parsedLabels.vertical === "reservas" || parsedLabels.businessSubType === "RESERVAS";
  const isServicios = parsedLabels.vertical === "servicios" || parsedLabels.businessSubType === "SERVICIOS";
  const isCitas = parsedLabels.vertical === "citas" || parsedLabels.businessSubType === "CITAS";
  const isRetail = parsedLabels.vertical === "catalogo" || parsedLabels.vertical === "retail" || userRestaurant?.businessType === "RETAIL" || userRestaurant?.businessType === "GENERAL_CATALOG";

  const hasGastroForced = enabledModules.includes("tables") || enabledModules.includes("gastro");
  const isGastroDisabled = disabledModules.includes("tables") || disabledModules.includes("gastro") || userRestaurant?.enableTableOrdering === false;

  const isGastro = !isGastroDisabled && (
    hasGastroForced || 
    (userRestaurant?.businessType === "RESTAURANT" && !isReservas && !isServicios && !isCitas)
  );

  // Carga SSR de notificaciones in-app vigentes (directas + globales)
  const activeNotifications = userRestaurant?.id
    ? await getActiveNotificationsForRestaurant(userRestaurant.id)
    : [];

  return (
    <AdminNotificationHost
      restaurantId={userRestaurant?.id || ""}
      initialNotifications={activeNotifications}
    >
      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-red-650 via-amber-600 to-amber-500 text-white text-xs py-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xl relative z-50 border-b border-amber-400/30">
          <div className="flex items-center gap-2.5 font-bold">
            <div className="h-6 w-6 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            </div>
            <span>
              Modo Puesta en Marcha / Asistencia Super Admin — Estás configurando el perfil y menú digital de: <strong>{session.email}</strong> {userRestaurant ? `(${userRestaurant.name})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/super-admin"
              className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-950 text-white font-extrabold px-3.5 py-1.5 rounded-xl border border-white/20 transition shadow-md"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-400" />
              Volver a Consola Super Admin
            </Link>
          </div>
        </div>
      )}

      {/* Barra de Accesos Rápidos Operativos Adaptativa */}
      <div className="bg-slate-900 border-b border-slate-800 text-xs py-2 px-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <Link
            href="/admin"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-medium"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Panel Admin</span>
          </Link>

          {isGastro && (
            <>
              <Link
                href={userRestaurant?.slug ? `/${userRestaurant.slug}/cocina` : "/cocina"}
                target="_blank"
                className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition font-bold"
              >
                <ChefHat className="w-3.5 h-3.5 text-orange-400" />
                <span>Módulo Cocina</span>
              </Link>
              <Link
                href={userRestaurant?.slug ? `/${userRestaurant.slug}/mesas` : "/mesas"}
                target="_blank"
                className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition font-bold"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Módulo Mesero</span>
              </Link>
            </>
          )}

          {isReservas && userRestaurant?.slug && (
            <Link
              href={`/reservas/${userRestaurant.slug}`}
              target="_blank"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition font-bold"
            >
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Motor Reservas</span>
              <ExternalLink className="w-3 h-3 text-emerald-400/70" />
            </Link>
          )}

          {!isReservas && isServicios && userRestaurant?.slug && (
            <Link
              href={`/servicios/${userRestaurant.slug}`}
              target="_blank"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition font-bold"
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ver Cotizador Express</span>
              <ExternalLink className="w-3 h-3 text-cyan-400/70" />
            </Link>
          )}

          {!isReservas && !isServicios && isCitas && userRestaurant?.slug && (
            <Link
              href={`/citas/${userRestaurant.slug}`}
              target="_blank"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition font-bold"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Ver Agenda Online</span>
              <ExternalLink className="w-3 h-3 text-purple-400/70" />
            </Link>
          )}

          {!isGastro && isRetail && userRestaurant?.slug && (
            <Link
              href={`/ctalo/${userRestaurant.slug}`}
              target="_blank"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition font-bold"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Catálogo E-Commerce</span>
              <ExternalLink className="w-3 h-3 text-amber-400/70" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <AdminNotificationBell />

          {userRestaurant && userRestaurants.length > 1 && (
            <RestaurantSwitcher
              currentRestaurantId={userRestaurant.id}
              restaurants={userRestaurants}
            />
          )}

          <div className="text-[11px] text-slate-400 hidden md:block">
            Sincronización en tiempo real vía Socket.IO y Postgres
          </div>
        </div>
      </div>

      {children}
    </AdminNotificationHost>
  );
}
