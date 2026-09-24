import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import RuletaAdminTab from "../../../components/RuletaAdminTab";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }> | { id: string };
}

export default async function NegocioRuletaAdminPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id || "";
  const [session, superAdmin] = await Promise.all([
    getUserSession(),
    getSuperAdminSession(),
  ]);

  if (!session && !superAdmin) {
    redirect("/login");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      themeColor: true,
      logoUrl: true,
      whatsapp: true,
      userId: true,
    },
  });

  if (!restaurant) {
    notFound();
  }

  if (session && !superAdmin && restaurant.userId !== session.userId) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center gap-1 text-xs font-bold border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>

        <RuletaAdminTab restaurant={restaurant} />
      </div>
    </div>
  );
}
