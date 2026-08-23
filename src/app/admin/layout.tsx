import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

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
        <div className="bg-gradient-to-r from-amber-600 to-red-600 text-white text-xs py-2.5 px-4 flex flex-wrap items-center justify-between gap-2 shadow-lg relative z-50">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              Modo Asistencia Super Admin — Estás editando este negocio como el usuario <strong>{session.email}</strong>
            </span>
          </div>
          <Link
            href="/super-admin"
            className="flex items-center gap-1.5 bg-slate-950/60 hover:bg-slate-950 text-white font-bold px-3 py-1.5 rounded-lg border border-white/20 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Super Admin
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
