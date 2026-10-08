import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MesasClient } from "@/app/mesas/components/MesasClient";
import Link from "next/link";
import { Users, AlertCircle, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SlugMesasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      businessType: true,
      enableTableOrdering: true,
    },
  });

  if (!restaurant) {
    notFound();
  }

  // Validación: "siempre y cuando sea restaurant o bar todos los negocios que atiendan a mesas"
  const isRestaurantOrBar =
    restaurant.businessType === "RESTAURANT" || restaurant.enableTableOrdering === true;

  if (!isRestaurantOrBar) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Módulo Exclusivo para Restaurantes y Bares
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            El negocio <strong>{restaurant.name}</strong> está configurado en modo Catálogo Comercial o Servicios, por lo que no tiene atención de mesas activa.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/${restaurant.slug}`}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
            >
              <Store className="w-4 h-4" />
              <span>Ver Catálogo del Negocio</span>
            </Link>
            <Link
              href="/admin"
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
            >
              Volver al Panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <MesasClient initialSlug={restaurant.slug} />;
}
