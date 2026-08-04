"use client";

import { useState } from "react";
import { 
  superAdminLogoutAction, 
  extendTrialAction, 
  deleteRestaurantAction,
  impersonateUserAction,
  changeUserPlanAction,
  resetUserPasswordAction
} from "@/lib/actions";
import { 
  Building, 
  Smartphone, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  LogOut, 
  ExternalLink,
  Store,
  Utensils
} from "lucide-react";

type Restaurant = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  email: string;
  logoUrl: string | null;
  whatsappNumber: string;
  trialEndsAt: string;
  createdAt: string;
  plan: "FREE" | "PRO";
  _count: {
    categories: number;
  };
};

type Metrics = {
  totalRestaurants: number;
  activeTrials: number;
  expiredTrials: number;
  totalCategories: number;
  totalDishes: number;
};

export function SuperAdminDashboard({ 
  restaurants, 
  metrics 
}: { 
  restaurants: Restaurant[]; 
  metrics: Metrics; 
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExtendTrial = async (id: string, days: number, name: string) => {
    if (confirm(`¿Deseas extender el período de prueba de "${name}" por ${days} días?`)) {
      const res = await extendTrialAction(id, days);
      if (res?.success) {
        alert("Período de prueba extendido con éxito.");
      }
    }
  };

  const handleDeleteRestaurant = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente el restaurante "${name}"? Esta acción borrará todas sus categorías, platos y fotos asociadas.`)) {
      const res = await deleteRestaurantAction(id);
      if (res?.success) {
        alert("Restaurante eliminado correctamente.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight">Super Admin Console</h1>
              <p className="text-xs text-slate-400">Control de Licencias y Métricas Globales</p>
            </div>
          </div>

          <form action={superAdminLogoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-350 hover:bg-slate-750 transition"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Consola
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-md flex items-center gap-4">
            <div className="h-12 w-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center shrink-0">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-450 uppercase font-semibold">Total Restaurantes</span>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.totalRestaurants}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-md flex items-center gap-4">
            <div className="h-12 w-12 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-450 uppercase font-semibold">Demos Activas</span>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.activeTrials}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-md flex items-center gap-4">
            <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-450 uppercase font-semibold">Demos Expiradas</span>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.expiredTrials}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-md flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-450 uppercase font-semibold">Platos Creados</span>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.totalDishes}</p>
            </div>
          </div>
        </div>

        {/* Listing & Search */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Directorio de Clientes</h2>
              <p className="text-xs text-slate-400 mt-1">Gestiona las licencias y vigencia de las cuentas del sistema.</p>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, slug, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 w-full md:max-w-xs transition"
            />
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Restaurante</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Registro</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado Licencia</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Vigencia / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                        No se encontraron restaurantes registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map((res) => {
                      const trialEnds = new Date(res.trialEndsAt);
                      const isExpired = trialEnds < new Date();
                      const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

                      return (
                        <tr key={res.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {res.logoUrl ? (
                                <img src={res.logoUrl} alt={res.name} className="h-10 w-10 rounded-xl object-cover border border-slate-800" />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-slate-850 flex items-center justify-center font-bold text-white uppercase text-sm">
                                  {res.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-semibold text-white flex items-center gap-1">
                                  {res.name}
                                  <a href={`/${res.slug}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                <div className="text-xs text-slate-400">/{res.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-slate-500" />
                                {res.email}
                              </div>
                              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                                {res.whatsappNumber}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              {new Date(res.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={res.plan}
                              onChange={async (e) => {
                                await changeUserPlanAction(res.id, e.target.value as "FREE" | "PRO");
                                alert(`Plan de "${res.name}" cambiado a ${e.target.value} con éxito.`);
                              }}
                              className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-red-500 font-semibold cursor-pointer"
                            >
                              <option value="FREE">FREE</option>
                              <option value="PRO">PRO</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                  <ShieldAlert className="h-3.5 w-3.5" /> Expirada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Activa ({daysRemaining} d)
                                </span>
                              )}
                              <div className="text-xs text-slate-500 font-medium">
                                Vence: {trialEnds.toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                            <button
                              onClick={async () => {
                                if (confirm(`¿Deseas simular el acceso como el usuario administrador de "${res.name}"? Esto te redirigirá automáticamente a su panel.`)) {
                                  await impersonateUserAction(res.userId);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-blue-400 bg-blue-950/20 border border-blue-900/30 hover:bg-blue-950/40 font-bold transition"
                            >
                              Acceso
                            </button>
                            <button
                              onClick={async () => {
                                const pass = prompt(`Ingresa la nueva contraseña para el administrador de "${res.name}":`);
                                if (pass) {
                                  const r = await resetUserPasswordAction(res.userId, pass);
                                  if (r?.success) {
                                    alert("Contraseña restablecida correctamente.");
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-purple-400 bg-purple-950/20 border border-purple-900/30 hover:bg-purple-950/40 font-bold transition"
                            >
                              Clave
                            </button>
                            <button
                              onClick={() => handleExtendTrial(res.id, 30, res.name)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-750 font-bold border border-slate-700 transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              +30 Días
                            </button>
                            <button
                              onClick={() => handleExtendTrial(res.id, 365, res.name)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-amber-400 bg-amber-950/20 border border-amber-900/30 hover:bg-amber-950/40 font-bold transition"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Acceso Anual
                            </button>
                            <button
                              onClick={() => handleDeleteRestaurant(res.id, res.name)}
                              className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
