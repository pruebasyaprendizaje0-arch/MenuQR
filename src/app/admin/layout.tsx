import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowLeft, ChefHat, Users, LayoutDashboard } from "lucide-react";

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

  return (
    <>
      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-red-650 via-amber-600 to-amber-500 text-white text-xs py-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xl relative z-50 border-b border-amber-400/30">
          <div className="flex items-center gap-2.5 font-bold">
            <div className="h-6 w-6 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            </div>
            <span>
              Modo Puesta en Marcha / Asistencia Super Admin — Estás configurando el perfil y menú digital de: <strong>{session.email}</strong>
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

      {/* Barra de Accesos Rápidos Operativos (Admin / Cocina / Mesas) */}
      <div className="bg-slate-900 border-b border-slate-800 text-xs py-2 px-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Link
            href="/admin"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-medium"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Panel Admin</span>
          </Link>
          <Link
            href="/cocina"
            target="_blank"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition font-bold"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-400" />
            <span>Módulo Cocina</span>
          </Link>
          <Link
            href="/mesas"
            target="_blank"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition font-bold"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Módulo Mesero</span>
          </Link>
        </div>
        <div className="text-[11px] text-slate-400 hidden sm:block">
          Sincronización en tiempo real vía Socket.IO y Postgres
        </div>
      </div>

      {children}
    </>
  );
}
