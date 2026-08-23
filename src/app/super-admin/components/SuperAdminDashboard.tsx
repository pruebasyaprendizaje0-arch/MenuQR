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
  superAdminUpdateRestaurantAction,
  updateRestaurantLeadStatusAction,
  addCrmNoteAction,
  createProspectLeadAction,
  updateProspectLeadAction,
  deleteProspectLeadAction,
  convertProspectToRestaurantAction
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
  Sparkles,
  MessageSquare,
  Clock,
  Send,
  UserCheck,
  Kanban,
  ListFilter,
  PhoneCall,
  Bell,
  FileText,
  ChevronDown
} from "lucide-react";
import { ecuadorData, parishData } from "@/lib/ecuador";

type CrmNote = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
};

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
  leadStatus?: string;
  nextFollowUpAt?: string | null;
  crmNotes?: CrmNote[];
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

type ProspectLead = {
  id: string;
  name: string;
  ownerName?: string | null;
  phone: string;
  email?: string | null;
  city?: string | null;
  status: string;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  crmNotes?: CrmNote[];
  createdAt: string;
  updatedAt: string;
};

type Metrics = {
  totalRestaurants: number;
  activeTrials: number;
  expiredTrials: number;
  totalCategories: number;
  totalDishes: number;
};

const CRM_STAGES = [
  { id: "LEAD_NUEVO", label: "Nuevos Leads", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "CONTACTADO", label: "Contactados", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { id: "EN_DEMO", label: "Demos Activas", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { id: "NEGOCIACION", label: "En Negociación", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "CLIENTE_PRO", label: "Clientes PRO ($5/mes)", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  { id: "EXPIRADO_INACTIVO", label: "Expirados / Inactivos", color: "bg-red-500/10 text-red-400 border-red-500/30" },
];

export function SuperAdminDashboard({ 
  restaurants,
  leads = [],
  metrics,
  whatsappSupport
}: { 
  restaurants: Restaurant[]; 
  leads?: ProspectLead[];
  metrics: Metrics; 
  whatsappSupport: string;
}) {
  const [activeTab, setActiveTab] = useState<"directory" | "kanban" | "prospects" | "reminders">("directory");
  const [searchTerm, setSearchTerm] = useState("");
  const [waSupport, setWaSupport] = useState(whatsappSupport);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);

  // CRM Note Modal state
  const [noteTarget, setNoteTarget] = useState<{ restaurant?: Restaurant; lead?: ProspectLead } | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  // Prospect Lead Modal state
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [prospectData, setProspectData] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    city: "",
    notes: "",
    nextFollowUpAt: ""
  });
  const [prospectLoading, setProspectLoading] = useState(false);

  // Convert Prospect state
  const [convertingLead, setConvertingLead] = useState<ProspectLead | null>(null);
  const [convertPassword, setConvertPassword] = useState("Menu1234*");

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

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.phone.includes(searchTerm) ||
      (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Reminders Due Today or Overdue
  const todayStr = new Date().toISOString().split("T")[0];
  const remindersCount = restaurants.filter(r => r.nextFollowUpAt && r.nextFollowUpAt.split("T")[0] <= todayStr).length +
    leads.filter(l => l.nextFollowUpAt && l.nextFollowUpAt.split("T")[0] <= todayStr).length;

  const handleExtendTrial = async (id: string, days: number, name: string) => {
    if (confirm(`¿Deseas extender el período de prueba de "${name}" por ${days} días?`)) {
      const res = await extendTrialAction(id, days);
      if (res?.success) {
        alert("Período de prueba extendido con éxito.");
      }
    }
  };

  const handleDeleteRestaurant = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente el restaurante "${name}"? Esta acción borrará todas sus categorías, platos y cuenta de usuario asociadas.`)) {
      const res = await deleteRestaurantAction(id);
      if (res?.success) {
        alert("Restaurante eliminado correctamente.");
      }
    }
  };

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

  // Add CRM Note submit
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTarget || !newNoteContent.trim()) return;

    setNoteLoading(true);
    const targetPayload = noteTarget.restaurant 
      ? { restaurantId: noteTarget.restaurant.id } 
      : { leadId: noteTarget.lead!.id };

    await addCrmNoteAction(targetPayload, newNoteContent);

    if (noteTarget.restaurant && nextFollowUpDate) {
      await updateRestaurantLeadStatusAction(
        noteTarget.restaurant.id, 
        noteTarget.restaurant.leadStatus || "LEAD_NUEVO", 
        nextFollowUpDate
      );
    }

    setNoteLoading(false);
    setNewNoteContent("");
    setNextFollowUpDate("");
    alert("Nota guardada en la bitácora CRM.");
  };

  // Quick WhatsApp message generator
  const sendWhatsAppMessage = (phone: string, templateType: "welcome" | "trial_expiry" | "pro_payment" | "custom", name: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    let text = "";

    if (templateType === "welcome") {
      text = `Hola ${name}, bienvenido a MenuQR Pro. Soy del equipo de soporte. Vi que creaste tu negocio y queremos ayudarte gratis a subir tus platos y fotos para que tu menú digital quede 100% listo hoy. ¿Te gustaría que te ayudemos?`;
    } else if (templateType === "trial_expiry") {
      text = `Hola ${name}, tu período de prueba en MenuQR Pro está por vencer. Para mantener activo tu menú digital e incluir pedidos por WhatsApp, puedes activar el Plan PRO por solo $5 USD al mes. ¿Deseas los datos para transferencia?`;
    } else if (templateType === "pro_payment") {
      text = `Hola ${name}, aquí tienes los datos para activar tu Plan PRO de MenuQR Pro ($5 USD/mes):\n\nBanco Pichincha - Cuenta de Ahorros\nN°: 2200XXXXXX\nTitular: MenuQR Pro\n\nPor favor envíanos el comprobante por aquí para activar tu cuenta inmediatamente.`;
    } else {
      text = `Hola ${name}, te saludamos de MenuQR Pro...`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight flex items-center gap-2">
                Super Admin Console <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">CRM v2.0</span>
              </h1>
              <p className="text-xs text-slate-400">Pipeline de Ventas, Gestión de Licencias y CRM Comercial</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form action={superAdminLogoutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-350 hover:bg-slate-750 border border-slate-700 transition"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Consola
              </button>
            </form>
          </div>
        </div>

        {/* CRM Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "directory" 
                ? "border-red-500 text-red-400 bg-red-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Store className="h-4 w-4" />
            Directorio de Clientes ({restaurants.length})
          </button>

          <button
            onClick={() => setActiveTab("kanban")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "kanban" 
                ? "border-amber-500 text-amber-400 bg-amber-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Kanban className="h-4 w-4" />
            Pipeline Kanban CRM
          </button>

          <button
            onClick={() => setActiveTab("prospects")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "prospects" 
                ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            Prospectos / Leads Faltantes ({leads.length})
          </button>

          <button
            onClick={() => setActiveTab("reminders")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap relative ${
              activeTab === "reminders" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bell className="h-4 w-4" />
            Recordatorios de Hoy
            {remindersCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {remindersCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">

        {/* TAB 1: DIRECTORIO DE CLIENTES */}
        {activeTab === "directory" && (
          <div className="space-y-6">
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
                  <h2 className="text-xl font-bold text-white">Directorio de Clientes</h2>
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
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Restaurante</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto & WhatsApp</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Etapa CRM</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan / Licencia</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Seguimiento</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones & Bitácora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredRestaurants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                            No se encontraron negocios registrados.
                          </td>
                        </tr>
                      ) : (
                        filteredRestaurants.map((res) => {
                          const trialEnds = new Date(res.trialEndsAt);
                          const isExpired = trialEnds < new Date();
                          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                          const stageInfo = CRM_STAGES.find(s => s.id === (res.leadStatus || "LEAD_NUEVO")) || CRM_STAGES[0];

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
                                    <User className="h-3.5 w-3.5 text-slate-500" />
                                    {res.userName || "Sin nombre"}
                                  </div>
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <select
                                  value={res.leadStatus || "LEAD_NUEVO"}
                                  onChange={async (e) => {
                                    await updateRestaurantLeadStatusAction(res.id, e.target.value, res.nextFollowUpAt);
                                  }}
                                  className={`text-xs rounded-xl px-2.5 py-1 font-bold border focus:outline-none cursor-pointer ${stageInfo.color}`}
                                >
                                  {CRM_STAGES.map(s => (
                                    <option key={s.id} value={s.id} className="bg-slate-900 text-white font-normal">
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <select
                                    value={res.plan}
                                    onChange={async (e) => {
                                      await changeUserPlanAction(res.id, e.target.value as "FREE" | "PRO");
                                      alert(`Plan de "${res.name}" cambiado a ${e.target.value} con éxito.`);
                                    }}
                                    className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                                  >
                                    <option value="FREE">FREE (Prueba)</option>
                                    <option value="PRO">PRO ($5/mes)</option>
                                  </select>
                                  <div className="text-[11px] text-slate-400">
                                    {isExpired ? (
                                      <span className="text-red-400 font-semibold">Expirada</span>
                                    ) : (
                                      <span className="text-emerald-400 font-semibold">{daysRemaining} días rest.</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                                {res.nextFollowUpAt ? (
                                  <div className="flex items-center gap-1.5 text-amber-400">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    {new Date(res.nextFollowUpAt).toLocaleDateString()}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">Sin fecha</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-1.5">
                                {/* Bitácora CRM Note Button */}
                                <button
                                  onClick={() => setNoteTarget({ restaurant: res })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-purple-400 bg-purple-950/30 border border-purple-900/40 hover:bg-purple-950/60 font-bold transition"
                                  title="Bitácora de Notas CRM"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Notas ({res.crmNotes?.length || 0})
                                </button>

                                {/* WhatsApp Fast Templates */}
                                <button
                                  onClick={() => sendWhatsAppMessage(res.whatsappNumber, "welcome", res.userName || res.name)}
                                  className="inline-flex items-center p-1.5 rounded-lg text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 hover:bg-emerald-950/60 transition"
                                  title="Enviar WhatsApp de Bienvenida & Puesta en Marcha"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Deseas ingresar al panel de "${res.name}" en Modo Puesta en Marcha / Asistencia?`)) {
                                      await impersonateUserAction(res.userId);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-950/60 font-bold transition"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                                  Asistir
                                </button>

                                <button
                                  onClick={() => handleOpenEdit(res)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-amber-400 bg-amber-950/20 border border-amber-900/30 hover:bg-amber-950/40 font-bold transition"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </button>

                                <button
                                  onClick={() => handleDeleteRestaurant(res.id, res.name)}
                                  className="inline-flex p-1.5 text-red-500/80 hover:text-red-400 bg-red-950/20 rounded-lg border border-red-900/20 transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </div>
        )}

        {/* TAB 2: KANBAN CRM PIPELINE */}
        {activeTab === "kanban" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Kanban className="h-5 w-5 text-amber-400" />
                  Embudo de Ventas (Kanban CRM)
                </h2>
                <p className="text-xs text-slate-400 mt-1">Arrastra o cambia de columna los clientes para gestionar la conversión a Plan PRO.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
              {CRM_STAGES.map((stage) => {
                const stageRestaurants = restaurants.filter(r => (r.leadStatus || "LEAD_NUEVO") === stage.id);

                return (
                  <div key={stage.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 flex flex-col min-w-[260px]">
                    <div className="flex items-center justify-between mb-3 px-1 pb-2 border-b border-slate-800">
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md">
                        {stageRestaurants.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-1">
                      {stageRestaurants.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-600 border border-dashed border-slate-800 rounded-xl">
                          Sin negocios
                        </div>
                      ) : (
                        stageRestaurants.map((res) => {
                          const trialEnds = new Date(res.trialEndsAt);
                          const isExpired = trialEnds < new Date();
                          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

                          return (
                            <div key={res.id} className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl space-y-3 shadow-md hover:border-slate-700 transition">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-white text-xs">{res.name}</h4>
                                  <span className="text-[11px] text-slate-400 block">{res.userName || res.email}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${res.plan === "PRO" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                                  {res.plan}
                                </span>
                              </div>

                              <div className="text-[11px] space-y-1 text-slate-300">
                                <div className="flex items-center gap-1.5 text-emerald-400">
                                  <Smartphone className="h-3 w-3 shrink-0" />
                                  <button
                                    onClick={() => sendWhatsAppMessage(res.whatsappNumber, "welcome", res.userName || res.name)}
                                    className="hover:underline font-semibold"
                                  >
                                    {res.whatsappNumber}
                                  </button>
                                </div>
                                <div className="flex items-center gap-1 text-slate-400">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>{isExpired ? "Expirado" : `${daysRemaining} días rest.`}</span>
                                </div>
                              </div>

                              {/* Stage Selector */}
                              <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2">
                                <select
                                  value={res.leadStatus || "LEAD_NUEVO"}
                                  onChange={async (e) => {
                                    await updateRestaurantLeadStatusAction(res.id, e.target.value, res.nextFollowUpAt);
                                  }}
                                  className="bg-slate-900 border border-slate-800 text-[10px] rounded-lg px-2 py-1 text-slate-300 font-semibold focus:outline-none focus:border-amber-500"
                                >
                                  {CRM_STAGES.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => setNoteTarget({ restaurant: res })}
                                  className="text-purple-400 hover:text-purple-300 p-1 rounded bg-purple-950/40"
                                  title="Añadir Nota CRM"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PROSPECTOS COMERCIALES (LEADS EN FRÍO) */}
        {activeTab === "prospects" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-blue-400" />
                  Prospectos Comerciales (Leads en Frío)
                </h2>
                <p className="text-xs text-slate-400 mt-1">Registra visitas o contactos previos a la creación de su cuenta en la plataforma.</p>
              </div>
              <button
                onClick={() => setIsProspectModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/20 transition duration-200"
              >
                <Plus className="h-4 w-4" />
                Registrar Prospecto
              </button>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-900/60">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio Prospecto</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto & WhatsApp</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ciudad</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Próximo Contacto</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones & Conversión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                          No se han registrado prospectos comerciales aún.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-semibold text-white">{lead.name}</div>
                              <div className="text-xs text-slate-400">{lead.notes || "Sin observaciones"}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1 text-xs text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-slate-500" />
                                {lead.ownerName || "Sin titular"}
                              </div>
                              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                                {lead.phone}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                            {lead.city || "No especificada"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                              lead.status === "CONVERTIDO" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-amber-400">
                            {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : "Sin fecha"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                            <button
                              onClick={() => setNoteTarget({ lead })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-purple-400 bg-purple-950/30 border border-purple-900/40 hover:bg-purple-950/60 font-bold transition"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Notas ({lead.crmNotes?.length || 0})
                            </button>

                            {lead.status !== "CONVERTIDO" && (
                              <button
                                onClick={() => setConvertingLead(lead)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 hover:bg-emerald-950/60 font-bold transition"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Convertir a Restaurante
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar prospecto "${lead.name}"?`)) {
                                  await deleteProspectLeadAction(lead.id);
                                }
                              }}
                              className="inline-flex p-1.5 text-red-500/80 hover:text-red-400 bg-red-950/20 rounded-lg border border-red-900/20 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECORDATORIOS DE HOY */}
        {activeTab === "reminders" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-400" />
                Seguimientos y Recordatorios Programados
              </h2>
              <p className="text-xs text-slate-400 mt-1">Clientes o prospectos que requieren una llamada o contacto el día de hoy.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {restaurants.filter(r => r.nextFollowUpAt && r.nextFollowUpAt.split("T")[0] <= todayStr).map((res) => (
                <div key={res.id} className="bg-slate-900/60 border border-amber-500/30 p-5 rounded-2xl flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Restaurante Registrado
                    </span>
                    <h3 className="font-bold text-white text-sm">{res.name}</h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" /> {res.userName} | <Smartphone className="h-3.5 w-3.5 text-slate-500" /> {res.whatsappNumber}
                    </p>
                    <p className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Fecha de contacto: {new Date(res.nextFollowUpAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => sendWhatsAppMessage(res.whatsappNumber, "custom", res.userName || res.name)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                    >
                      <Send className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                    <button
                      onClick={() => setNoteTarget({ restaurant: res })}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                    >
                      Bitácora
                    </button>
                  </div>
                </div>
              ))}

              {leads.filter(l => l.nextFollowUpAt && l.nextFollowUpAt.split("T")[0] <= todayStr).map((lead) => (
                <div key={lead.id} className="bg-slate-900/60 border border-blue-500/30 p-5 rounded-2xl flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      Prospecto Comercial
                    </span>
                    <h3 className="font-bold text-white text-sm">{lead.name}</h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" /> {lead.ownerName || "Sin nombre"} | <Smartphone className="h-3.5 w-3.5 text-slate-500" /> {lead.phone}
                    </p>
                    <p className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Fecha de contacto: {new Date(lead.nextFollowUpAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => sendWhatsAppMessage(lead.phone, "welcome", lead.ownerName || lead.name)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                    >
                      <Send className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                    <button
                      onClick={() => setNoteTarget({ lead })}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                    >
                      Bitácora
                    </button>
                  </div>
                </div>
              ))}

              {remindersCount === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-3xl">
                  🎉 ¡Excelente! No tienes recordatorios de seguimiento pendientes para hoy.
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* CRM BITÁCORA NOTES MODAL */}
      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-600/10 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Bitácora CRM: {noteTarget.restaurant?.name || noteTarget.lead?.name}
                  </h3>
                  <p className="text-xs text-slate-400">Historial de llamadas, notas e interacciones comerciales</p>
                </div>
              </div>
              <button 
                onClick={() => setNoteTarget(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Timeline Notes */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 text-xs">
              {((noteTarget.restaurant?.crmNotes || noteTarget.lead?.crmNotes) || []).length === 0 ? (
                <p className="text-slate-500 text-center py-4 italic">No hay notas registradas para este cliente aún.</p>
              ) : (
                ((noteTarget.restaurant?.crmNotes || noteTarget.lead?.crmNotes) || []).map((n) => (
                  <div key={n.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-purple-400">{n.author}</span>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{n.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add New Note Form */}
            <form onSubmit={handleAddNote} className="space-y-4 pt-4 border-t border-slate-800 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Agregar Nueva Nota / Comentario</label>
                <textarea
                  rows={3}
                  required
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="ej: Llamada realizada. Interesado en el Plan PRO anual, solicitó asistencia..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Programar Próximo Seguimiento (Opcional)</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={noteLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-white shadow-lg disabled:opacity-50"
                >
                  {noteLoading ? "Guardando..." : "Guardar Nota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PROSPECT LEAD MODAL */}
      {isProspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600/10 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Registrar Prospecto Comercial</h3>
                  <p className="text-xs text-slate-400">Añade un negocio prospectado antes de crear su cuenta</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProspectModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                setProspectLoading(true);
                await createProspectLeadAction(prospectData);
                setProspectLoading(false);
                setIsProspectModalOpen(false);
                setProspectData({ name: "", ownerName: "", phone: "", email: "", city: "", notes: "", nextFollowUpAt: "" });
                alert("Prospecto comercial guardado con éxito.");
              }} 
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-300 mb-1">Nombre del Negocio *</label>
                <input
                  type="text"
                  required
                  value={prospectData.name}
                  onChange={(e) => setProspectData({ ...prospectData, name: e.target.value })}
                  placeholder="ej: Pizzería Bella Italia"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Nombre del Dueño</label>
                  <input
                    type="text"
                    value={prospectData.ownerName}
                    onChange={(e) => setProspectData({ ...prospectData, ownerName: e.target.value })}
                    placeholder="ej: Carlos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Teléfono WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={prospectData.phone}
                    onChange={(e) => setProspectData({ ...prospectData, phone: e.target.value })}
                    placeholder="ej: 0999999999"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={prospectData.email}
                    onChange={(e) => setProspectData({ ...prospectData, email: e.target.value })}
                    placeholder="opcional@correo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Ciudad / Provincia</label>
                  <input
                    type="text"
                    value={prospectData.city}
                    onChange={(e) => setProspectData({ ...prospectData, city: e.target.value })}
                    placeholder="ej: Quito"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Observaciones Iniciales</label>
                <textarea
                  rows={2}
                  value={prospectData.notes}
                  onChange={(e) => setProspectData({ ...prospectData, notes: e.target.value })}
                  placeholder="ej: Contactado en visita comercial..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Programar Fecha de Seguimiento</label>
                <input
                  type="date"
                  value={prospectData.nextFollowUpAt}
                  onChange={(e) => setProspectData({ ...prospectData, nextFollowUpAt: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProspectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={prospectLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white shadow-lg disabled:opacity-50"
                >
                  {prospectLoading ? "Guardando..." : "Guardar Prospecto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT PROSPECT MODAL */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-600/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Convertir a Cuenta Activa</h3>
                  <p className="text-xs text-slate-400">Crear negocio para: {convertingLead.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setConvertingLead(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await convertProspectToRestaurantAction(convertingLead.id, convertPassword);
                if (res.error) {
                  alert(res.error);
                } else {
                  alert("¡Prospecto convertido en negocio activo correctamente!");
                  setConvertingLead(null);
                }
              }} 
              className="space-y-4 text-xs"
            >
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-300"><strong>Negocio:</strong> {convertingLead.name}</p>
                <p className="text-slate-300"><strong>Titular:</strong> {convertingLead.ownerName || convertingLead.name}</p>
                <p className="text-slate-300"><strong>Teléfono:</strong> {convertingLead.phone}</p>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Contraseña Inicial para el Cliente</label>
                <input
                  type="text"
                  required
                  value={convertPassword}
                  onChange={(e) => setConvertPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setConvertingLead(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white shadow-lg"
                >
                  Crear Cuenta y Activar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
