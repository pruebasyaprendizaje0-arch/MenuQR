"use client";

import { useState } from "react";
import { 
  superAdminLogoutAction, 
  extendTrialAction, 
  deleteRestaurantAction,
  impersonateUserAction,
  changeUserPlanAction,
  resetUserPasswordAction,
  updateSystemSettingAction,
  superAdminCreateRestaurantAction,
  superAdminUpdateRestaurantAction
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
  Utensils,
  Pencil,
  X,
  User,
  MapPin,
  Globe,
  CreditCard,
  Check,
  Sparkles
} from "lucide-react";
import { ecuadorData, parishData } from "@/lib/ecuador";

type Restaurant = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  userName?: string;
  email: string;
  logoUrl: string | null;
  whatsappNumber: string;
  locality?: string | null;
  address?: string | null;
  description?: string | null;
  schedule?: string | null;
  specialty?: string | null;
  trialEndsAt: string;
  createdAt: string;
  plan: "FREE" | "PRO";
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountDocument?: string | null;
  bankAccountEmail?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
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
  metrics,
  whatsappSupport
}: { 
  restaurants: Restaurant[]; 
  metrics: Metrics; 
  whatsappSupport: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [waSupport, setWaSupport] = useState(whatsappSupport);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);

  // Create Form State
  const [createData, setCreateData] = useState({
    userName: "",
    email: "",
    password: "",
    restaurantName: "",
    whatsapp: "",
    province: "",
    canton: "",
    parroquia: "",
    sector: "",
    plan: "FREE" as "FREE" | "PRO"
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Form State
  const [editData, setEditData] = useState({
    userName: "",
    email: "",
    restaurantName: "",
    slug: "",
    whatsapp: "",
    locality: "",
    address: "",
    description: "",
    schedule: "",
    specialty: "",
    plan: "FREE" as "FREE" | "PRO",
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
    bankAccountName: "",
    bankAccountDocument: "",
    bankAccountEmail: "",
    instagram: "",
    facebook: "",
    tiktok: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.userName && r.userName.toLowerCase().includes(searchTerm.toLowerCase()))
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
    if (confirm(`¿Estás seguro de eliminar permanentemente el restaurante "${name}"? Esta acción borrará todas sus categorías, platos y cuenta de usuario si no tiene otros negocios.`)) {
      const res = await deleteRestaurantAction(id);
      if (res?.success) {
        alert("Restaurante eliminado correctamente.");
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (res: Restaurant) => {
    setEditingRestaurant(res);
    setEditData({
      userName: res.userName || "",
      email: res.email || "",
      restaurantName: res.name || "",
      slug: res.slug || "",
      whatsapp: res.whatsappNumber || "",
      locality: res.locality || "",
      address: res.address || "",
      description: res.description || "",
      schedule: res.schedule || "",
      specialty: res.specialty || "",
      plan: res.plan || "FREE",
      bankName: res.bankName || "",
      bankAccountType: res.bankAccountType || "",
      bankAccountNumber: res.bankAccountNumber || "",
      bankAccountName: res.bankAccountName || "",
      bankAccountDocument: res.bankAccountDocument || "",
      bankAccountEmail: res.bankAccountEmail || "",
      instagram: res.instagram || "",
      facebook: res.facebook || "",
      tiktok: res.tiktok || ""
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  // Submit Create Form
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");

    const res = await superAdminCreateRestaurantAction(createData);
    setCreateLoading(false);

    if (res?.error) {
      setCreateError(res.error);
    } else {
      alert("¡Nuevo negocio creado con éxito!");
      setIsCreateModalOpen(false);
      setCreateData({
        userName: "",
        email: "",
        password: "",
        restaurantName: "",
        whatsapp: "",
        province: "",
        canton: "",
        parroquia: "",
        sector: "",
        plan: "FREE"
      });
    }
  };

  // Submit Edit Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    setEditLoading(true);
    setEditError("");

    const res = await superAdminUpdateRestaurantAction(editingRestaurant.id, editData);
    setEditLoading(false);

    if (res?.error) {
      setEditError(res.error);
    } else {
      alert("¡Información del negocio guardada con éxito!");
      setIsEditModalOpen(false);
      setEditingRestaurant(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center justify-center">
              <Building className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight">Super Admin Console</h1>
              <p className="text-xs text-slate-400">Gestión Global de Negocios y Licencias</p>
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
        
        {/* Global Settings Panel */}
        <div className="bg-slate-900/40 border border-slate-850/80 p-6 rounded-2xl backdrop-blur-md space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-white">Configuración Global de la Plataforma</h2>
            <p className="text-xs text-slate-400">Edita parámetros del sistema que se reflejarán públicamente en la landing page.</p>
          </div>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              await updateSystemSettingAction("whatsapp_support", waSupport);
              alert("Configuración de WhatsApp de soporte actualizada con éxito.");
            }}
            className="flex flex-col sm:flex-row gap-4 items-end max-w-xl"
          >
            <div className="flex-1 space-y-1.5 w-full">
              <label className="text-xs font-semibold text-slate-350 block">WhatsApp de Soporte Comercial (Código de país + número, sin &quot;+&quot;)</label>
              <input
                type="text"
                name="whatsapp_support"
                value={waSupport}
                onChange={(e) => setWaSupport(e.target.value)}
                placeholder="ej: 593999999999"
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 w-full sm:w-auto rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-650 to-amber-600 hover:from-red-500 hover:to-amber-500 transition duration-200"
            >
              Guardar Configuración
            </button>
          </form>
        </div>

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
              <h2 className="text-xl font-bold text-white">Directorio de Clientes y Negocios</h2>
              <p className="text-xs text-slate-400 mt-1">Crea, edita, guarda cambios o gestiona accesos y licencias de los negocios.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Buscar por nombre, slug, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-64 transition"
              />
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-600/20 transition duration-200 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Crear Nuevo Negocio
              </button>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Restaurante / Negocio</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto & Ubicación</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Registro</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado Licencia</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones & Edición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                        No se encontraron restaurantes o negocios registrados.
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
                                  <a href={`/${res.slug}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition" title="Ver Menú Público">
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
                                <User className="h-3.5 w-3.5 text-slate-500" />
                                {res.userName || "Sin nombre registrado"}
                              </div>
                              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-slate-500" />
                                {res.email}
                              </div>
                              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                                {res.whatsappNumber}
                              </div>
                              {res.locality && (
                                <div className="text-[11px] text-amber-400/90 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-amber-500" />
                                  {res.locality}
                                </div>
                              )}
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
                              className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                            >
                              <option value="FREE">FREE (Prueba)</option>
                              <option value="PRO">PRO ($5/mes)</option>
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
                                if (confirm(`¿Deseas ingresar al panel de "${res.name}" en Modo Puesta en Marcha / Asistencia? Podrás crear categorías, agregar platos, subir imágenes y configurar su perfil completo.`)) {
                                  await impersonateUserAction(res.userId);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-950/60 font-bold transition shadow-sm"
                              title="Entrar como este negocio para configurar su carta, categorías, fotos, horarios y datos de cobro"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                              Puesta en Marcha / Asistir
                            </button>
                            <button
                              onClick={() => handleOpenEdit(res)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-amber-400 bg-amber-950/20 border border-amber-900/30 hover:bg-amber-950/40 font-bold transition"
                              title="Editar Datos Institucionales y del Usuario"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={async () => {
                                const pass = prompt(`Ingresa la nueva contraseña para el usuario de "${res.name}":`);
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
                              +30D
                            </button>
                            <button
                              onClick={() => handleDeleteRestaurant(res.id, res.name)}
                              className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
                              title="Borrar Negocio Permanentemente"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-600/10 border border-red-500/30 rounded-xl flex items-center justify-center text-red-500">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Crear Nuevo Negocio</h3>
                  <p className="text-xs text-slate-400">Registra un cliente o negocio directamente en la plataforma</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nombre del Dueño/Administrador *</label>
                  <input
                    type="text"
                    required
                    value={createData.userName}
                    onChange={(e) => setCreateData({ ...createData, userName: e.target.value })}
                    placeholder="ej: Juan Pérez"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={createData.email}
                    onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                    placeholder="contacto@restaurante.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Contraseña Inicial *</label>
                  <input
                    type="password"
                    required
                    value={createData.password}
                    onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nombre del Negocio/Restaurante *</label>
                  <input
                    type="text"
                    required
                    value={createData.restaurantName}
                    onChange={(e) => setCreateData({ ...createData, restaurantName: e.target.value })}
                    placeholder="ej: Asadero El Gaucho"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">WhatsApp de Pedidos *</label>
                  <input
                    type="text"
                    required
                    value={createData.whatsapp}
                    onChange={(e) => setCreateData({ ...createData, whatsapp: e.target.value })}
                    placeholder="ej: 0999999999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Plan Inicial</label>
                  <select
                    value={createData.plan}
                    onChange={(e) => setCreateData({ ...createData, plan: e.target.value as "FREE" | "PRO" })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="FREE">FREE (Demo 30 días)</option>
                    <option value="PRO">PRO ($5/mes)</option>
                  </select>
                </div>
              </div>

              {/* Location Selectors */}
              <div className="border-t border-slate-800 pt-3 mt-3">
                <span className="block font-semibold text-slate-300 mb-2">Ubicación del Negocio (Ecuador)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Provincia</label>
                    <select
                      value={createData.province}
                      onChange={(e) => {
                        setCreateData({ ...createData, province: e.target.value, canton: "", parroquia: "" });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                    >
                      <option value="">Seleccionar...</option>
                      {Object.keys(ecuadorData).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cantón</label>
                    <select
                      value={createData.canton}
                      disabled={!createData.province}
                      onChange={(e) => {
                        setCreateData({ ...createData, canton: e.target.value, parroquia: "" });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
                    >
                      <option value="">Seleccionar...</option>
                      {createData.province && ecuadorData[createData.province]?.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Parroquia / Localidad</label>
                    {createData.canton && parishData[createData.canton] ? (
                      <select
                        value={createData.parroquia}
                        onChange={(e) => setCreateData({ ...createData, parroquia: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="">Seleccionar...</option>
                        {parishData[createData.canton].map((pa) => (
                          <option key={pa} value={pa}>{pa}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={createData.parroquia}
                        onChange={(e) => setCreateData({ ...createData, parroquia: e.target.value })}
                        placeholder="ej: Centro"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-bold text-white shadow-lg disabled:opacity-50"
                >
                  {createLoading ? "Guardando..." : "Crear Negocio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && editingRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-600/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-500">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Negocio: {editingRestaurant.name}</h3>
                  <p className="text-xs text-slate-400">Modifica y guarda directamente cualquier información del negocio y del usuario</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl">
                  {editError}
                </div>
              )}

              {/* Datos Generales y Usuario */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <span className="font-bold text-amber-400 text-xs block uppercase tracking-wider">1. Datos de la Cuenta y Negocio</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Nombre del Dueño</label>
                    <input
                      type="text"
                      required
                      value={editData.userName}
                      onChange={(e) => setEditData({ ...editData, userName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Nombre del Restaurante/Negocio</label>
                    <input
                      type="text"
                      required
                      value={editData.restaurantName}
                      onChange={(e) => setEditData({ ...editData, restaurantName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Identificador Único (Slug URL)</label>
                    <input
                      type="text"
                      required
                      value={editData.slug}
                      onChange={(e) => setEditData({ ...editData, slug: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Teléfono WhatsApp</label>
                    <input
                      type="text"
                      required
                      value={editData.whatsapp}
                      onChange={(e) => setEditData({ ...editData, whatsapp: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Plan del Sistema</label>
                    <select
                      value={editData.plan}
                      onChange={(e) => setEditData({ ...editData, plan: e.target.value as "FREE" | "PRO" })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="FREE">FREE (Prueba)</option>
                      <option value="PRO">PRO ($5/mes)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Detalles y Ubicación */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <span className="font-bold text-amber-400 text-xs block uppercase tracking-wider">2. Ubicación y Perfil Comercial</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Localidad / Sector / Ciudad</label>
                    <input
                      type="text"
                      value={editData.locality}
                      onChange={(e) => setEditData({ ...editData, locality: e.target.value })}
                      placeholder="ej: Quito, Pichincha, Centro"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Dirección Física Exacta</label>
                    <input
                      type="text"
                      value={editData.address}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      placeholder="Av. Amazonas N24-15"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Especialidad</label>
                    <input
                      type="text"
                      value={editData.specialty}
                      onChange={(e) => setEditData({ ...editData, specialty: e.target.value })}
                      placeholder="ej: Mariscos, Cortes de Carne, Comida Rápida"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Horario de Atención</label>
                    <input
                      type="text"
                      value={editData.schedule}
                      onChange={(e) => setEditData({ ...editData, schedule: e.target.value })}
                      placeholder="Lunes a Sábado: 09:00 - 22:00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Descripción Corta</label>
                  <textarea
                    rows={2}
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    placeholder="Breve reseña del negocio..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              </div>

              {/* Datos Bancarios */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <span className="font-bold text-amber-400 text-xs block uppercase tracking-wider">3. Datos Bancarios (Transferencias Directas)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Banco</label>
                    <input
                      type="text"
                      value={editData.bankName}
                      onChange={(e) => setEditData({ ...editData, bankName: e.target.value })}
                      placeholder="ej: Banco Pichincha"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Tipo de Cuenta</label>
                    <input
                      type="text"
                      value={editData.bankAccountType}
                      onChange={(e) => setEditData({ ...editData, bankAccountType: e.target.value })}
                      placeholder="Ahorros / Corriente"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Número de Cuenta</label>
                    <input
                      type="text"
                      value={editData.bankAccountNumber}
                      onChange={(e) => setEditData({ ...editData, bankAccountNumber: e.target.value })}
                      placeholder="2200XXXXXX"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Nombre del Titular</label>
                    <input
                      type="text"
                      value={editData.bankAccountName}
                      onChange={(e) => setEditData({ ...editData, bankAccountName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Cédula / RUC Titular</label>
                    <input
                      type="text"
                      value={editData.bankAccountDocument}
                      onChange={(e) => setEditData({ ...editData, bankAccountDocument: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Correo Notificación Pago</label>
                    <input
                      type="email"
                      value={editData.bankAccountEmail}
                      onChange={(e) => setEditData({ ...editData, bankAccountEmail: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Redes Sociales */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <span className="font-bold text-amber-400 text-xs block uppercase tracking-wider">4. Redes Sociales</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Instagram</label>
                    <input
                      type="text"
                      value={editData.instagram}
                      onChange={(e) => setEditData({ ...editData, instagram: e.target.value })}
                      placeholder="@usuario"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Facebook</label>
                    <input
                      type="text"
                      value={editData.facebook}
                      onChange={(e) => setEditData({ ...editData, facebook: e.target.value })}
                      placeholder="facebook.com/pagina"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">TikTok</label>
                    <input
                      type="text"
                      value={editData.tiktok}
                      onChange={(e) => setEditData({ ...editData, tiktok: e.target.value })}
                      placeholder="@usuario"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900 py-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  {editLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
