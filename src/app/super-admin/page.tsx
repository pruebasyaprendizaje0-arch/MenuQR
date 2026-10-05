import { getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SuperAdminLoginForm } from "./components/SuperAdminLoginForm";
import { BotToggleButton } from "@/app/admin/components/BotToggleButton";
import { 
  Bot, 
  Store, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  PauseCircle, 
  Utensils, 
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const isSuperAdmin = await getSuperAdminSession();

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  // 1. Consulta directa a PostgreSQL optimizada con Prisma
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      whatsappBotEnabled: true,
      plan: true,
      createdAt: true,
      _count: {
        select: {
          dishes: true,
          categories: true,
        },
      },
    },
  });

  // Métricas dinámicas en tiempo real
  const total = restaurants.length;
  const activos = restaurants.filter((r) => r.whatsappBotEnabled).length;
  const pausados = total - activos;
  const totalDishes = restaurants.reduce((acc, r) => acc + r._count.dishes, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabecera Principal */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-inner">
                <Bot className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Panel de Control SuperAdmin
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    En Vivo
                  </span>
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Gestión integral de WhatsApp nativo (Baileys) en puerto 3000 sin intermediarios externos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> PostgreSQL Cifrado (AES-256)
            </span>
          </div>
        </header>

        {/* Tarjetas de Telemetría y Métricas en Tiempo Real */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Restaurantes</p>
              <p className="text-2xl font-bold text-white mt-1">{total}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl text-slate-300">
              <Store className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-emerald-400">Bots Activos (ON)</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activos}</p>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-amber-400">Bots en Pausa (OFF)</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{pausados}</p>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <PauseCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-blue-400">Platos Activos</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{totalDishes}</p>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Tabla de Restaurantes y Control On/Off de WhatsApp Bot */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/60">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Control de Negocios y Automatización WhatsApp
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Los cambios de estado del bot se aplican de forma inmediata en PostgreSQL y en la memoria del servidor.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700 w-fit">
              Node.js Event-Loop
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Negocio / Slug</th>
                  <th className="px-6 py-4">WhatsApp Conectado</th>
                  <th className="px-6 py-4">Platos en Menú</th>
                  <th className="px-6 py-4">Plan SaaS</th>
                  <th className="px-6 py-4 text-right">Interruptor de Bot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="hover:bg-slate-800/40 transition">
                    {/* Nombre y Enlace al Menú Público */}
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase border border-emerald-500/20 shadow-inner">
                          {restaurant.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {restaurant.name}
                            <a
                              href={`https://menuqr.ubicame.cc/${restaurant.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Ver carta digital"
                              className="text-slate-500 hover:text-emerald-400 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            /{restaurant.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Número de WhatsApp Oficial */}
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {restaurant.whatsapp ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-300">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                          {restaurant.whatsapp}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No configurado</span>
                      )}
                    </td>

                    {/* Conteo de Platos y Categorías */}
                    <td className="px-6 py-4 text-xs font-medium text-slate-400">
                      <span className="text-slate-200 font-semibold">{restaurant._count.dishes}</span> platos
                      <span className="text-slate-500 text-[11px] block">
                        ({restaurant._count.categories} categorías)
                      </span>
                    </td>

                    {/* Badge de Plan */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          restaurant.plan === "PRO"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {restaurant.plan}
                      </span>
                    </td>

                    {/* Control de Bot en Tiempo Real */}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-block text-left">
                        <BotToggleButton
                          restaurantId={restaurant.id}
                          restaurantName={restaurant.name}
                          initialState={restaurant.whatsappBotEnabled}
                          compact={true}
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {restaurants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No se encontraron restaurantes registrados en la base de datos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
