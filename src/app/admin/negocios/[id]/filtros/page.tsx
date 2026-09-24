import { getUserSession, getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import ElementFiltersAdminTab from "../../../components/ElementFiltersAdminTab";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NegocioElementFiltersAdminPage({ params }: Props) {
  const { id } = await params;
  const [session, superAdmin] = await Promise.all([
    getUserSession(),
    getSuperAdminSession(),
  ]);

  if (!session && !superAdmin) {
    redirect("/login");
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: session ? { id, userId: session.userId } : { id },
    select: {
      id: true,
      name: true,
      slug: true,
      themeColor: true,
    },
  });

  if (!restaurant) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center gap-1 text-xs font-bold border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>

        <ElementFiltersAdminTab restaurant={restaurant} />
      </div>
    </div>
  );
}
