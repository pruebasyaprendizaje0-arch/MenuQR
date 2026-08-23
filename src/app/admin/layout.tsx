import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

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
      {children}
    </>
  );
}
