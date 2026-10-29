"use client";

import { useState, useEffect, useMemo } from "react";
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
  convertProspectToRestaurantAction,
  reassignRestaurantOwnerAction,
  createManualSubscriptionPaymentAction,
  approveManualSubscriptionPaymentAction,
  rejectManualSubscriptionPaymentAction,
  toggleRestaurantSuspensionAction,
  createEliteTaskAction,
  updateEliteTaskStatusAction,
  deleteEliteTaskAction,
  superAdminToggleRestaurantModuleAction
} from "@/lib/actions";
import { SmartLogo } from "@/components/SmartImage";
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
  ChevronDown,
  Bot,
  CheckCircle2,
  PauseCircle,
  Layers,
  DollarSign,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Wrench,
  Activity,
  CheckCheck,
  Pause,
  Play,
  Star,
  Crown,
  ArrowUpRight,
  Filter,
  BadgeAlert,
  HelpCircle,
  Boxes,
  Barcode,
  BarChart3,
  Megaphone,
  Server
} from "lucide-react";
import { SuperAdminAnalyticsTab } from "./SuperAdminAnalyticsTab";
import { SuperAdminAnnouncementsTab } from "./SuperAdminAnnouncementsTab";
import { SuperAdminOpsTab } from "./SuperAdminOpsTab";
import { ecuadorData, parishData } from "@/lib/ecuador";
import { resolveBusinessVertical, BusinessVertical } from "@/lib/business-labels";

export const VERTICAL_TABS: {
  id: "all" | BusinessVertical;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  badgeStyle: string;
  activeTabStyle: string;
  aliases: string[];
}[] = [
  {
    id: "all",
    label: "Todos los Negocios",
    shortLabel: "Todos",
    icon: "🏢",
    color: "text-slate-200",
    badgeStyle: "bg-slate-800 text-slate-300 border-slate-700",
    activeTabStyle: "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg shadow-red-500/25 border-red-500/50",
    aliases: [],
  },
  {
    id: "restaurante",
    label: "Restaurantes & Gastro",
    shortLabel: "Restaurante",
    icon: "🍔",
    color: "text-red-400",
    badgeStyle: "bg-red-500/10 text-red-400 border-red-500/30",
    activeTabStyle: "bg-red-600 text-white shadow-lg shadow-red-500/25 border-red-500",
    aliases: ["restaurante", "gastro", "gastronomia", "gastronomía", "comida", "plato", "menú", "menu", "cafeteria", "cafetería", "bar"],
  },
  {
    id: "retail",
    label: "Catálogos / Retail / Tiendas",
    shortLabel: "Retail / Catálogo",
    icon: "🛍️",
    color: "text-amber-400",
    badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    activeTabStyle: "bg-amber-600 text-white shadow-lg shadow-amber-500/25 border-amber-500",
    aliases: ["retail", "catálogo", "catalogo", "tienda", "licor", "licoreria", "licorería", "ropa", "moda", "producto", "sumeria"],
  },
  {
    id: "servicios",
    label: "Servicios Técnicos",
    shortLabel: "Servicios Técnicos",
    icon: "🔧",
    color: "text-cyan-400",
    badgeStyle: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    activeTabStyle: "bg-cyan-600 text-white shadow-lg shadow-cyan-500/25 border-cyan-500",
    aliases: ["servicio", "servicios", "tecnico", "técnico", "reparacion", "reparación", "plomer", "electric", "mantenimiento", "taller"],
  },
  {
    id: "citas",
    label: "Citas, Salud & Belleza",
    shortLabel: "Citas & Salud",
    icon: "📅",
    color: "text-purple-400",
    badgeStyle: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    activeTabStyle: "bg-purple-600 text-white shadow-lg shadow-purple-500/25 border-purple-500",
    aliases: ["cita", "citas", "salud", "clinica", "clínica", "dental", "odont", "odontologia", "barber", "barberia", "barbería", "estetica", "estética", "spa", "doctor"],
  },
  {
    id: "reservas",
    label: "Hospedaje & Cabañas",
    shortLabel: "Hospedaje",
    icon: "🏡",
    color: "text-emerald-400",
    badgeStyle: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    activeTabStyle: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border-emerald-500",
    aliases: ["reserva", "reservas", "hospedaje", "hotel", "hostal", "cabaña", "cabana", "glamping", "lodge", "habitacion", "habitación"],
  },
];

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
  whatsappBotEnabled?: boolean;
  businessType?: string | null;
  customLabels?: any;
  city?: string | null;
  province?: string | null;
  locality?: string | null;
  address?: string | null;
  slogan?: string | null;
  description?: string | null;
  schedule?: string | null;
  specialty?: string | null;
  trialEndsAt: string;
  createdAt: string;
  plan: "FREE" | "PRO" | "ELITE";
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
  ubicameUrl?: string | null;
  reservationUrl?: string | null;
  lastMaintenanceAt?: string | null;
  isSuspended?: boolean;
  suspendedReason?: string | null;
  health?: {
    totalDishes: number;
    dishesWithPhoto: number;
    photoPercentage: number;
    totalOrders: number;
    recentOrders: number;
    lastOrderDate: string | null;
  };
  _count: {
    categories: number;
    dishes?: number;
  };
};

type EliteTask = {
  id: string;
  restaurantId: string;
  restaurant?: {
    id: string;
    name: string;
    slug: string;
    plan: "FREE" | "PRO" | "ELITE";
    whatsapp: string;
    logoUrl?: string | null;
  };
  title: string;
  description?: string | null;
  requestType: "CARGA_MENU" | "ACTUALIZACION_PRECIOS" | "CAMBIO_FOTOS" | "ASESORIA_VENTAS" | "OTRO";
  priority: "ALTA" | "MEDIA" | "BAJA";
  status: "PENDIENTE" | "EN_PROCESO" | "COMPLETADO";
  dueDate?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
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
  { id: "CLIENTE_PRO", label: "Clientes Suscritos (PRO $15 / ELITE $20)", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  { id: "EXPIRADO_INACTIVO", label: "Expirados / Inactivos", color: "bg-red-500/10 text-red-400 border-red-500/30" },
];

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ManualPayment = {
  id: string;
  restaurantId: string;
  amount: number;
  currency: string;
  method: string;
  reference?: string | null;
  receiptUrl?: string | null;
  status: string;
  plan?: "PRO" | "ELITE";
  notes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  restaurant: { id: string; name: string; slug: string };
};

export function SuperAdminDashboard({ 
  restaurants,
  leads = [],
  metrics,
  whatsappSupport,
  subscriptionPaymentQrUrl,
  subscriptionBankName,
  subscriptionBankAccountType,
  subscriptionBankAccountNumber,
  subscriptionBankAccountName,
  subscriptionBankAccountDocument,
  subscriptionDeunaPhone,
  allUsers = [],
  manualPayments = [],
  eliteTasks = [],
  initialTab = "directory",
  analyticsData,
  globalAnnouncement,
}: { 
  restaurants: Restaurant[]; 
  leads?: ProspectLead[];
  metrics: Metrics; 
  whatsappSupport: string;
  subscriptionPaymentQrUrl: string;
  subscriptionBankName: string;
  subscriptionBankAccountType: string;
  subscriptionBankAccountNumber: string;
  subscriptionBankAccountName: string;
  subscriptionBankAccountDocument: string;
  subscriptionDeunaPhone: string;
  allUsers?: UserOption[];
  manualPayments?: ManualPayment[];
  eliteTasks?: EliteTask[];
  initialTab?: "directory" | "analytics" | "announcements" | "collections" | "elite_ops" | "kanban" | "prospects" | "reminders" | "bots" | "ops";
  analyticsData?: any;
  globalAnnouncement?: any;
}) {
  const validTabs = ["directory", "analytics", "announcements", "collections", "elite_ops", "kanban", "prospects", "reminders", "ops"];
  const [activeTab, setActiveTab] = useState<"directory" | "analytics" | "announcements" | "collections" | "elite_ops" | "kanban" | "prospects" | "reminders" | "ops">(
    initialTab && validTabs.includes(initialTab)
      ? (initialTab as any)
      : "directory"
  );
  const [restaurantList, setRestaurantList] = useState<Restaurant[]>(restaurants);

  useEffect(() => {
    setRestaurantList(restaurants);
  }, [restaurants]);
  const [eliteTaskList, setEliteTaskList] = useState<EliteTask[]>(eliteTasks);
  const [isCreateEliteTaskModalOpen, setIsCreateEliteTaskModalOpen] = useState(false);
  const [newEliteTaskData, setNewEliteTaskData] = useState({
    restaurantId: "",
    title: "",
    description: "",
    requestType: "CARGA_MENU" as "CARGA_MENU" | "ACTUALIZACION_PRECIOS" | "CAMBIO_FOTOS" | "ASESORIA_VENTAS" | "OTRO",
    priority: "MEDIA" as "ALTA" | "MEDIA" | "BAJA",
    dueDate: "",
    notes: "",
  });
  const [eliteFilterStatus, setEliteFilterStatus] = useState<"ALL" | "PENDIENTE" | "EN_PROCESO" | "COMPLETADO">("ALL");
  const [collectionsFilter, setCollectionsFilter] = useState<"ALL" | "URGENT" | "UPCOMING" | "OVERDUE" | "SUSPENDED">("ALL");
  const [selectedVertical, setSelectedVertical] = useState<"all" | BusinessVertical>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [waSupport, setWaSupport] = useState(whatsappSupport);
  const [subscriptionQrUrl, setSubscriptionQrUrl] = useState(subscriptionPaymentQrUrl);
  const [subscriptionBank, setSubscriptionBank] = useState({
    name: subscriptionBankName,
    accountType: subscriptionBankAccountType,
    accountNumber: subscriptionBankAccountNumber,
    accountName: subscriptionBankAccountName,
    document: subscriptionBankAccountDocument,
    deunaPhone: subscriptionDeunaPhone,
  });
  const [paymentList, setPaymentList] = useState<ManualPayment[]>(manualPayments);
  const [paymentRestaurantId, setPaymentRestaurantId] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<"PRO" | "ELITE">("PRO");
  const [paymentAmount, setPaymentAmount] = useState("15");
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "deuna">("transferencia");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentHistorySearch, setPaymentHistorySearch] = useState("");
  const [paymentHistoryStatus, setPaymentHistoryStatus] = useState<"ALL" | "APPROVED" | "PENDING" | "REJECTED">("ALL");
  const [paymentHistoryPlan, setPaymentHistoryPlan] = useState<"ALL" | "PRO" | "ELITE">("ALL");


  // Reassign / Adjudicate Modal State
  const [reassignModalTarget, setReassignModalTarget] = useState<Restaurant | null>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignMsg, setReassignMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Owner mode for Create Restaurant Modal
  const [ownerMode, setOwnerMode] = useState<"new" | "existing">("new");

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
    plan: "FREE" as "FREE" | "PRO" | "ELITE",
    vertical: "restaurante" as BusinessVertical,
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
    slogan: "",
    description: "",
    schedule: "",
    specialty: "",
    plan: "FREE" as "FREE" | "PRO" | "ELITE",
    vertical: "restaurante" as BusinessVertical,
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
    bankAccountName: "",
    bankAccountDocument: "",
    bankAccountEmail: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    ubicameUrl: "",
    reservationUrl: ""
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Conteos dinámicos en tiempo real por cada categoría / vertical de negocio
  const verticalCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: restaurantList.length,
      restaurante: 0,
      retail: 0,
      servicios: 0,
      citas: 0,
      reservas: 0,
    };
    for (const r of restaurantList) {
      const v = resolveBusinessVertical(r);
      counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }, [restaurantList]);

  const filteredRestaurants = restaurantList.filter((r) => {
    const vertical = resolveBusinessVertical(r);
    if (selectedVertical !== "all" && vertical !== selectedVertical) {
      return false;
    }

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase().trim();
    const tabConfig = VERTICAL_TABS.find((t) => t.id === vertical);
    const matchesVerticalAlias = tabConfig?.aliases.some((alias) => alias.includes(term) || term.includes(alias));

    const matchesFields =
      r.name.toLowerCase().includes(term) ||
      r.slug.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      (r.userName && r.userName.toLowerCase().includes(term)) ||
      (r.city && r.city.toLowerCase().includes(term)) ||
      (r.province && r.province.toLowerCase().includes(term)) ||
      (r.locality && r.locality.toLowerCase().includes(term)) ||
      (r.specialty && r.specialty.toLowerCase().includes(term)) ||
      (r.description && r.description.toLowerCase().includes(term));

    return matchesFields || matchesVerticalAlias;
  });

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      l.phone.includes(searchTerm) ||
      (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );


  // Reminders Due Today or Overdue
  const todayStr = new Date().toISOString().split("T")[0];
  const remindersCount = restaurantList.filter(r => r.nextFollowUpAt && r.nextFollowUpAt.split("T")[0] <= todayStr).length +
    leads.filter(l => l.nextFollowUpAt && l.nextFollowUpAt.split("T")[0] <= todayStr).length;

  // Calculos de Cobranzas & MRR
  const now = new Date();
  const proCount = restaurantList.filter(r => r.plan === "PRO").length;
  const eliteCount = restaurantList.filter(r => r.plan === "ELITE").length;
  const currentMRR = (proCount * 15) + (eliteCount * 20);

  const restaurantsWithExpiry = restaurantList.map(r => {
    const trialEnd = new Date(r.trialEndsAt);
    const diffMs = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays < 0;
    const isUrgent = diffDays >= 0 && diffDays <= 1;
    const isUpcoming = diffDays > 1 && diffDays <= 5;
    const isSuspended = Boolean(r.isSuspended);

    return {
      restaurant: r,
      trialEnd,
      diffDays,
      isOverdue,
      isUrgent,
      isUpcoming,
      isSuspended,
      planAmount: r.plan === "ELITE" ? 20 : 15
    };
  });

  const urgentCollections = restaurantsWithExpiry.filter(item => item.isUrgent && !item.isSuspended);
  const upcomingCollections = restaurantsWithExpiry.filter(item => item.isUpcoming && !item.isSuspended);
  const overdueCollections = restaurantsWithExpiry.filter(item => item.isOverdue && !item.isSuspended);
  const suspendedCollections = restaurantsWithExpiry.filter(item => item.isSuspended);
  const totalCollectionsPending = urgentCollections.length + upcomingCollections.length + overdueCollections.length;
  const pendingEliteTasksCount = eliteTaskList.filter(t => t.status !== "COMPLETADO").length;
  const completedEliteTasksThisMonth = eliteTaskList.filter(t => {
    if (t.status !== "COMPLETADO" || !t.completedAt) return false;
    const compDate = new Date(t.completedAt);
    return compDate.getMonth() === now.getMonth() && compDate.getFullYear() === now.getFullYear();
  });

  const handleToggleSuspension = async (res: Restaurant) => {
    const isCurrentlySuspended = Boolean(res.isSuspended);
    const actionName = isCurrentlySuspended ? "reactivar" : "pausar por mora";
    const reason = isCurrentlySuspended ? "" : prompt(`Motivo de pausa para "${res.name}" (ej: Falta de pago de mensualidad):`, "Mora en pago de suscripción mensual");
    if (!isCurrentlySuspended && reason === null) return;

    const resAction = await toggleRestaurantSuspensionAction(res.id, !isCurrentlySuspended, reason || undefined);
    if (resAction?.success) {
      setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, isSuspended: !isCurrentlySuspended, suspendedReason: reason || null } : r));
      alert(`Menú de "${res.name}" ${isCurrentlySuspended ? "reactivado con éxito" : "pausado temporalmente"}.`);
    } else {
      alert(resAction?.error || "Error al actualizar estado.");
    }
  };

  const handleSendCollectionWhatsApp = (item: typeof restaurantsWithExpiry[0]) => {
    const cleanPhone = item.restaurant.whatsappNumber.replace(/[^0-9]/g, "");
    const name = item.restaurant.userName || item.restaurant.name;
    const planName = item.restaurant.plan === "ELITE" ? "Plan ELITE ($20 USD/mes)" : "Plan PRO ($15 USD/mes)";
    const amount = item.planAmount;
    let text = "";

    if (item.isSuspended) {
      text = `Hola ${name}, te saludamos de MenuQR Pro. Tu menú digital se encuentra actualmente en pausa comercial por pago pendiente de tu ${planName}.\n\nPara reactivarlo inmediatamente hoy mismo, puedes transferir $${amount} USD a:\n• Banco: ${subscriptionBank.name || "Banco Pichincha"}\n• Cuenta: ${subscriptionBank.accountType || "Ahorros"} N° ${subscriptionBank.accountNumber || "2200XXXXXX"}\n• Titular: ${subscriptionBank.accountName || "MenuQR Pro"}\n• Deuna: ${subscriptionBank.deunaPhone || ""}\n\nEnvíanos tu comprobante por aquí para reactivar tu menú de inmediato.`;
    } else if (item.isOverdue) {
      text = `Hola ${name}, esperamos que estés teniendo excelentes ventas. Te escribimos de MenuQR Pro para recordarte que tu suscripción ${planName} venció hace ${Math.abs(item.diffDays)} días.\n\nPara evitar la pausa automática de tu carta digital, por favor realiza tu pago de $${amount} USD a:\n• Banco: ${subscriptionBank.name || "Banco Pichincha"} (${subscriptionBank.accountType || "Ahorros"} N° ${subscriptionBank.accountNumber || "2200XXXXXX"})\n• Titular: ${subscriptionBank.accountName || "MenuQR Pro"}\n• Deuna: ${subscriptionBank.deunaPhone || ""}\n\nEnvíanos tu comprobante para registrar tu renovación. ¡Muchas gracias!`;
    } else if (item.isUrgent) {
      text = `Hola ${name}, te escribimos de MenuQR Pro. Tu suscripción ${planName} vence ${item.diffDays === 0 ? "HOY" : "MAÑANA"}.\n\nPuedes renovar tus 30 días por $${amount} USD a:\n• Banco: ${subscriptionBank.name || "Banco Pichincha"} (${subscriptionBank.accountType || "Ahorros"} N° ${subscriptionBank.accountNumber || "2200XXXXXX"})\n• Deuna: ${subscriptionBank.deunaPhone || ""}\n\nPor favor envíanos tu comprobante para mantener tu servicio sin interrupciones.`;
    } else {
      text = `Hola ${name}, te saludamos de MenuQR Pro. Te recordamos que tu período de ${planName} finaliza en ${item.diffDays} días (el ${item.trialEnd.toLocaleDateString()}).\n\nSi deseas adelantar tu pago de $${amount} USD para el próximo mes, puedes hacerlo a:\n• ${subscriptionBank.name || "Banco Pichincha"} N° ${subscriptionBank.accountNumber || "2200XXXXXX"}\n• Deuna: ${subscriptionBank.deunaPhone || ""}\n\n¡Gracias por confiar en MenuQR Pro!`;
    }

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCreateEliteTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEliteTaskData.restaurantId || !newEliteTaskData.title) {
      alert("Por favor selecciona un restaurante y escribe el título de la tarea.");
      return;
    }
    const res = await createEliteTaskAction(newEliteTaskData);
    if (res?.success && res.task) {
      setEliteTaskList(prev => [res.task as any, ...prev]);
      setIsCreateEliteTaskModalOpen(false);
      setNewEliteTaskData({
        restaurantId: "",
        title: "",
        description: "",
        requestType: "CARGA_MENU",
        priority: "MEDIA",
        dueDate: "",
        notes: "",
      });
      alert("¡Tarea de soporte Elite registrada con éxito!");
    } else {
      alert(res?.error || "Error al registrar tarea.");
    }
  };

  const handleUpdateEliteStatus = async (taskId: string, newStatus: "PENDIENTE" | "EN_PROCESO" | "COMPLETADO") => {
    const res = await updateEliteTaskStatusAction(taskId, newStatus);
    if (res?.success) {
      setEliteTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completedAt: newStatus === "COMPLETADO" ? new Date().toISOString() : null } : t));
      if (newStatus === "COMPLETADO") {
        setRestaurantList(prev => prev.map(r => r.id === res.task?.restaurantId ? { ...r, lastMaintenanceAt: new Date().toISOString() } : r));
      }
    } else {
      alert(res?.error || "Error al actualizar estado.");
    }
  };

  const handleDeleteEliteTask = async (taskId: string) => {
    if (!confirm("¿Deseas eliminar esta tarea de soporte?")) return;
    const res = await deleteEliteTaskAction(taskId);
    if (res?.success) {
      setEliteTaskList(prev => prev.filter(t => t.id !== taskId));
    } else {
      alert(res?.error || "Error al eliminar tarea.");
    }
  };

  const handleNotifyEliteCompleted = (task: EliteTask) => {
    const phone = task.restaurant?.whatsapp || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const restName = task.restaurant?.name || "tu restaurante";
    const text = `Hola, te saludamos del equipo VIP de MenuQR Pro. Te confirmamos que hemos completado con éxito la solicitud de tu Plan ELITE para ${restName}:\n\n✅ Tarea: "${task.title}"\n${task.notes ? `📝 Notas: ${task.notes}\n` : ""}Tu menú interactivo ya se encuentra actualizado y listo para recibir clientes. ¡Cualquier ajuste adicional, estamos a tu disposición!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

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
      slogan: res.slogan || "",
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
      tiktok: res.tiktok || "",
      ubicameUrl: res.ubicameUrl || "https://ubicame.info",
      reservationUrl: res.reservationUrl || "https://reservaciones.ubicame.cc",
      vertical: resolveBusinessVertical(res)
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleToggleModule = async (
    restaurantId: string,
    moduleKey: "inventory" | "caja" | "ruleta",
    currentActive: boolean
  ) => {
    const nextActive = !currentActive;

    // Actualización optimista inmediata en la UI
    setRestaurantList(prev => prev.map(r => {
      if (r.id !== restaurantId) return r;
      let curObj: any = {};
      if (r.customLabels) {
        try {
          curObj = typeof r.customLabels === "string" ? JSON.parse(r.customLabels) : r.customLabels;
        } catch {
          curObj = {};
        }
      }
      let curDisabled: string[] = Array.isArray(curObj.disabledModules) ? [...curObj.disabledModules] : [];
      if (nextActive) {
        curDisabled = curDisabled.filter(m => m !== moduleKey);
      } else {
        if (!curDisabled.includes(moduleKey)) curDisabled.push(moduleKey);
      }
      curObj.disabledModules = curDisabled;
      return {
        ...r,
        customLabels: JSON.stringify(curObj),
      };
    }));

    const resAction = await superAdminToggleRestaurantModuleAction(restaurantId, moduleKey, nextActive);
    if (resAction?.error) {
      alert(resAction.error);
      // Revertir si hubo error
      setRestaurantList(prev => prev.map(r => {
        if (r.id !== restaurantId) return r;
        let curObj: any = {};
        if (r.customLabels) {
          try {
            curObj = typeof r.customLabels === "string" ? JSON.parse(r.customLabels) : r.customLabels;
          } catch {
            curObj = {};
          }
        }
        let curDisabled: string[] = Array.isArray(curObj.disabledModules) ? [...curObj.disabledModules] : [];
        if (currentActive) {
          curDisabled = curDisabled.filter(m => m !== moduleKey);
        } else {
          if (!curDisabled.includes(moduleKey)) curDisabled.push(moduleKey);
        }
        curObj.disabledModules = curDisabled;
        return {
          ...r,
          customLabels: JSON.stringify(curObj),
        };
      }));
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalTarget) return;

    setReassignLoading(true);
    setReassignMsg(null);

    const res = await reassignRestaurantOwnerAction(reassignModalTarget.id, reassignEmail);
    setReassignLoading(false);

    if (res?.error) {
      setReassignMsg({ type: "error", text: res.error });
    } else {
      setReassignMsg({ type: "success", text: res?.message || "Propietario reasignado con éxito." });
      setTimeout(() => {
        setReassignModalTarget(null);
        setReassignMsg(null);
      }, 1500);
    }
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
        plan: "FREE",
        vertical: "restaurante"
      });
      window.location.reload();
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
      window.location.reload();
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
      setRestaurantList(prev => prev.map(r => r.id === noteTarget.restaurant!.id ? { ...r, nextFollowUpAt: nextFollowUpDate } : r));
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
      text = `Hola ${name}, bienvenido a MenuQR Pro. Soy del equipo de soporte. Vi que creaste tu negocio y queremos ayudarte gratis a configurar tu menú digital y pedidos por WhatsApp para que quede 100% listo hoy. ¿Te gustaría que te guiemos?`;
    } else if (templateType === "trial_expiry") {
      text = `Hola ${name}, tu período de prueba en MenuQR Pro está por vencer. Disponemos de dos planes a tu medida:\n\n1️⃣ Plan PRO ($15 USD/mes): Autogestión de tu menú interactivo, pedidos por WhatsApp, QR por mesa e inventario.\n2️⃣ Plan ELITE ($20 USD/mes): Servicio llave en mano donde nuestro equipo se encarga de subir toda tu información y fotos, con mantenimientos mensuales y asesoramiento premium para impulsar tus ventas.\n\n¿Con cuál plan deseas continuar para enviarte los datos de activación?`;
    } else if (templateType === "pro_payment") {
      text = `Hola ${name}, aquí tienes los datos para activar tu plan en MenuQR Pro:\n\n• Plan PRO: $15 USD/mes (Autogestionado)\n• Plan ELITE: $20 USD/mes (Gestión completa, mantenimientos y asesoría VIP)\n\nBanco Pichincha - Cuenta de Ahorros\nN°: 2200XXXXXX\nTitular: MenuQR Pro\n\nPor favor envíanos tu comprobante por aquí para activar tu cuenta inmediatamente.`;
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
                Super Admin Console <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">Unificado v2.0</span>
              </h1>
              <p className="text-xs text-slate-400">Pipeline Comercial, Gestión de Licencias y Operaciones SaaS</p>
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
            Directorio de Clientes ({restaurantList.length})
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "analytics" 
                ? "border-teal-500 text-teal-400 bg-teal-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="h-4 w-4 text-teal-400" />
            Analítica & GMV
            {analyticsData?.gmvTotal > 0 && (
              <span className="bg-teal-500/20 text-teal-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                ${Math.round(analyticsData.gmvTotal).toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("announcements")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap relative ${
              activeTab === "announcements" 
                ? "border-purple-500 text-purple-400 bg-purple-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Megaphone className="h-4 w-4 text-purple-400" />
            Anuncios & Difusión
            {globalAnnouncement?.active && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("collections")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap relative ${
              activeTab === "collections" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Cobranzas & Churn (PRO/ELITE)
            {totalCollectionsPending > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {totalCollectionsPending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("elite_ops")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap relative ${
              activeTab === "elite_ops" 
                ? "border-amber-500 text-amber-400 bg-amber-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crown className="h-4 w-4 text-amber-400" />
            Operaciones Plan Elite (VIP)
            {pendingEliteTasksCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingEliteTasksCount}
              </span>
            )}
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


          <button
            onClick={() => setActiveTab("ops")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "ops" 
                ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Server className="h-4 w-4 text-blue-400" />
            Salud & Reportes
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
                  const [whatsappResult, qrResult] = await Promise.all([
                    updateSystemSettingAction("whatsapp_support", waSupport),
                    updateSystemSettingAction("subscription_payment_qr_url", subscriptionQrUrl),
                  ]);
                  const bankingEntries = [
                    ["subscription_bank_name", subscriptionBank.name],
                    ["subscription_bank_account_type", subscriptionBank.accountType],
                    ["subscription_bank_account_number", subscriptionBank.accountNumber],
                    ["subscription_bank_account_name", subscriptionBank.accountName],
                    ["subscription_bank_account_document", subscriptionBank.document],
                    ["subscription_deuna_phone", subscriptionBank.deunaPhone],
                  ] as const;
                  const bankingResults = await Promise.all(
                    bankingEntries.map(([key, value]) => updateSystemSettingAction(key, value))
                  );
                  const firstError = [whatsappResult, qrResult, ...bankingResults].find((result) => result?.error);
                  if (firstError?.error) {
                    alert(firstError.error);
                    return;
                  }
                  alert("Configuración de cobros manuales actualizada con éxito.");
                }}
                className="flex flex-col gap-4 max-w-2xl"
              >
                <div className="flex flex-col sm:flex-row gap-4 items-end w-full">
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
                </div>
                <div className="space-y-1.5 w-full">
                  <label className="text-xs font-semibold text-slate-350 block">URL HTTPS del QR de Deuna para suscripciones</label>
                  <input
                    type="url"
                    name="subscription_payment_qr_url"
                    value={subscriptionQrUrl}
                    onChange={(e) => setSubscriptionQrUrl(e.target.value)}
                    placeholder="https://tu-dominio.com/qr-deuna.webp"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-slate-400">Debe ser una URL pública HTTPS que apunte directamente a la imagen del QR.</p>
                </div>
                <div className="border-t border-slate-800/80 pt-4 space-y-3 w-full">
                  <div>
                    <h3 className="text-sm font-bold text-white">Datos bancarios para suscripciones</h3>
                    <p className="text-[11px] text-slate-400">Información privada para mostrar en las instrucciones de pago de MenuQR Pro.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input aria-label="Banco de suscripciones" value={subscriptionBank.name} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, name: e.target.value })} placeholder="Banco" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                    <input aria-label="Tipo de cuenta de suscripciones" value={subscriptionBank.accountType} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, accountType: e.target.value })} placeholder="Tipo de cuenta" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                    <input aria-label="Número de cuenta de suscripciones" value={subscriptionBank.accountNumber} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, accountNumber: e.target.value.replace(/[^0-9-]/g, "") })} placeholder="Número de cuenta" inputMode="numeric" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                    <input aria-label="Titular de cuenta de suscripciones" value={subscriptionBank.accountName} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, accountName: e.target.value })} placeholder="Titular de la cuenta" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                    <input aria-label="Identificación de cuenta de suscripciones" value={subscriptionBank.document} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, document: e.target.value.replace(/[^0-9-]/g, "") })} placeholder="Cédula / RUC (opcional)" inputMode="numeric" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                    <input aria-label="Teléfono Deuna de suscripciones" value={subscriptionBank.deunaPhone} onChange={(e) => setSubscriptionBank({ ...subscriptionBank, deunaPhone: e.target.value.replace(/[^0-9+ -]/g, "") })} placeholder="Teléfono Deuna" inputMode="tel" className="w-full bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-xl text-white text-sm" />
                  </div>
                </div>
              </form>
            </div>

            {/* Manual subscription payments & Historial de Pagos */}
            {(() => {
              const approvedRevenue = paymentList
                .filter((p) => p.status === "APPROVED")
                .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

              const pendingList = paymentList.filter((p) => p.status === "PENDING");
              const proCount = paymentList.filter((p) => p.status === "APPROVED" && (p.plan === "PRO" || (!p.plan && p.amount < 20))).length;
              const eliteCount = paymentList.filter((p) => p.status === "APPROVED" && (p.plan === "ELITE" || (!p.plan && p.amount >= 20))).length;

              const filteredHistory = paymentList.filter((p) => {
                if (paymentHistoryStatus !== "ALL" && p.status !== paymentHistoryStatus) return false;
                if (paymentHistoryPlan !== "ALL") {
                  const itemPlan = p.plan || (p.amount >= 20 ? "ELITE" : "PRO");
                  if (itemPlan !== paymentHistoryPlan) return false;
                }
                if (paymentHistorySearch.trim()) {
                  const q = paymentHistorySearch.toLowerCase().trim();
                  const restName = p.restaurant?.name?.toLowerCase() || "";
                  const restSlug = p.restaurant?.slug?.toLowerCase() || "";
                  const ref = p.reference?.toLowerCase() || "";
                  const notes = p.notes?.toLowerCase() || "";
                  if (!restName.includes(q) && !restSlug.includes(q) && !ref.includes(q) && !notes.includes(q)) {
                    return false;
                  }
                }
                return true;
              });

              return (
                <div className="bg-slate-900/40 border border-emerald-500/20 p-6 rounded-2xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        Gestión de Pagos de Suscripciones (PRO $15 / ELITE $20)
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Registra transferencias o Deuna, aprueba pagos y audita el historial completo de cobros de los clientes.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                        Total Aprobado: ${approvedRevenue.toFixed(2)} USD
                      </span>
                      {pendingList.length > 0 && (
                        <span className="text-xs px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                          ⚠️ {pendingList.length} Pendiente{pendingList.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Formulario de Registro de Pago */}
                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      1. Registrar Nuevo Pago de Suscripción
                    </span>
                    <form
                      className="grid grid-cols-1 md:grid-cols-4 gap-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!paymentRestaurantId) {
                          alert("Por favor selecciona un restaurante.");
                          return;
                        }
                        const result = await createManualSubscriptionPaymentAction({
                          restaurantId: paymentRestaurantId,
                          amount: Number(paymentAmount),
                          method: paymentMethod,
                          reference: paymentReference,
                          receiptUrl: paymentReceiptUrl,
                          notes: paymentNotes,
                          plan: paymentPlan,
                        });
                        if (result.error) {
                          alert(result.error);
                          return;
                        }
                        alert(`¡Pago de $${paymentAmount} USD registrado como pendiente para ${paymentPlan === "ELITE" ? "Plan ELITE" : "Plan PRO"}!`);
                        window.location.reload();
                      }}
                    >
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Restaurante / Negocio *</label>
                        <select
                          aria-label="Restaurante del pago"
                          required
                          value={paymentRestaurantId}
                          onChange={(e) => setPaymentRestaurantId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500"
                        >
                          <option value="">Selecciona restaurante</option>
                          {restaurants.map((restaurant) => (
                            <option key={restaurant.id} value={restaurant.id}>
                              {restaurant.name} (Plan {restaurant.plan})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Plan a Contratar *</label>
                        <select
                          aria-label="Plan del pago"
                          value={paymentPlan}
                          onChange={(e) => {
                            const newPlan = e.target.value as "PRO" | "ELITE";
                            setPaymentPlan(newPlan);
                            if (paymentAmount === "15" || paymentAmount === "20" || paymentAmount === "10") {
                              setPaymentAmount(newPlan === "ELITE" ? "20" : "15");
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-bold focus:border-emerald-500"
                        >
                          <option value="PRO">Plan PRO ($15.00/mes) - Autogestión</option>
                          <option value="ELITE">⭐ Plan ELITE ($20.00/mes) - Gestión & Asesoría VIP</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Importe USD *</label>
                        <input
                          aria-label="Importe del pago"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Importe USD"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono font-bold focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Método de Pago</label>
                        <select
                          aria-label="Método del pago"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as "transferencia" | "deuna")}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500"
                        >
                          <option value="transferencia">Transferencia Bancaria</option>
                          <option value="deuna">Deuna (QR / Teléfono)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Referencia / Comprobante</label>
                        <input
                          aria-label="Referencia del pago"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="N° Comprobante o Ref."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">URL HTTPS Comprobante (opcional)</label>
                        <input
                          aria-label="URL del comprobante"
                          type="url"
                          value={paymentReceiptUrl}
                          onChange={(e) => setPaymentReceiptUrl(e.target.value)}
                          placeholder="https://... (Foto o PDF)"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Notas / Observaciones</label>
                        <input
                          aria-label="Notas del pago"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="Ej: Pago adelantado de 1 mes de servicio"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-emerald-500"
                        />
                      </div>

                      <div className="md:col-span-4 flex items-center justify-between pt-1">
                        <div className="text-[11px] text-slate-400">
                          {paymentPlan === "ELITE" ? (
                            <span className="text-amber-300 font-medium">
                              ⭐ <strong>Plan Elite ($20/mes):</strong> La empresa se encarga de subir toda la información, mantenimientos y asesoría premium.
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium">
                              <strong>Plan Pro ($15/mes):</strong> Autogestión del cliente para menú interactivo, pedidos WhatsApp y QR.
                            </span>
                          )}
                        </div>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-md shadow-emerald-600/20 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar pago pendiente (${paymentAmount} USD)
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* BANDEJA: Pagos Pendientes por Aprobar */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      2. Pagos Pendientes por Verificar y Aprobar ({pendingList.length})
                    </h3>

                    <div className="space-y-2">
                      {pendingList.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 text-xs shadow-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-white text-sm">{payment.restaurant.name}</strong>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  payment.plan === "ELITE" || (!payment.plan && payment.amount >= 20)
                                    ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {payment.plan === "ELITE" || (!payment.plan && payment.amount >= 20) ? "⭐ Plan Elite ($20)" : "Plan Pro ($15)"}
                              </span>
                              <span className="font-mono font-bold text-emerald-400 text-sm">
                                ${payment.amount.toFixed(2)} USD
                              </span>
                              <span className="text-slate-400 uppercase text-[10px] font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {payment.method}
                              </span>
                            </div>
                            <div className="text-slate-400 flex items-center gap-2 flex-wrap">
                              <span>Ref: <strong className="text-slate-200">{payment.reference || "Sin referencia"}</strong></span>
                              <span>· Registrado: {new Date(payment.createdAt).toLocaleDateString()}</span>
                              {payment.notes && <span className="italic text-slate-400">· &ldquo;{payment.notes}&rdquo;</span>}
                              {payment.receiptUrl && (
                                <a
                                  className="text-amber-400 underline font-bold hover:text-amber-300 ml-1"
                                  href={payment.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver Comprobante Adjunto ↗
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await approveManualSubscriptionPaymentAction(payment.id);
                                if (result.error) alert(result.error);
                                else {
                                  alert(`¡Pago de "${payment.restaurant.name}" APROBADO! Se activó el Plan ${payment.plan || "PRO"} por 30 días.`);
                                  window.location.reload();
                                }
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aprobar y Activar Plan
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const note = prompt("Motivo del rechazo (opcional):", "Comprobante no verificado en cuenta");
                                if (note === null) return;
                                const result = await rejectManualSubscriptionPaymentAction(payment.id, note);
                                if (result.error) alert(result.error);
                                else window.location.reload();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs transition"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      ))}

                      {pendingList.length === 0 && (
                        <p className="text-xs text-slate-500 italic py-1">No hay pagos pendientes de verificación en este momento.</p>
                      )}
                    </div>
                  </div>

                  {/* 3. HISTORIAL COMPLETO DE PAGOS DE LOS CLIENTES */}
                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          3. Historial de Pagos de los Clientes ({filteredHistory.length})
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Auditoría de todos los pagos registrados con desglose de planes PRO ($15) y ELITE ($20).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="Buscar negocio o ref..."
                          value={paymentHistorySearch}
                          onChange={(e) => setPaymentHistorySearch(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />

                        <select
                          value={paymentHistoryStatus}
                          onChange={(e) => setPaymentHistoryStatus(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-500"
                        >
                          <option value="ALL">Todos los Estados</option>
                          <option value="APPROVED">✓ Solo Aprobados</option>
                          <option value="PENDING">⏳ Solo Pendientes</option>
                          <option value="REJECTED">✕ Solo Rechazados</option>
                        </select>

                        <select
                          value={paymentHistoryPlan}
                          onChange={(e) => setPaymentHistoryPlan(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none focus:border-emerald-500"
                        >
                          <option value="ALL">Todos los Planes</option>
                          <option value="PRO">Plan PRO ($15)</option>
                          <option value="ELITE">Plan ELITE ($20)</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Restaurante</th>
                            <th className="px-4 py-3">Plan</th>
                            <th className="px-4 py-3">Monto & Método</th>
                            <th className="px-4 py-3">Comprobante / Ref</th>
                            <th className="px-4 py-3">Vigencia</th>
                            <th className="px-4 py-3 text-right">Estado / Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {filteredHistory.map((p) => {
                            const isElite = p.plan === "ELITE" || (!p.plan && p.amount >= 20);
                            const isApproved = p.status === "APPROVED";
                            const isPending = p.status === "PENDING";
                            const isRejected = p.status === "REJECTED";

                            return (
                              <tr key={p.id} className="hover:bg-slate-950/40 transition">
                                <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                                  {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                                  <span className="text-[10px] text-slate-500 block">
                                    {new Date(p.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <strong className="text-white block">{p.restaurant?.name || "Desconocido"}</strong>
                                  {p.restaurant?.slug && (
                                    <span className="text-[10px] font-mono text-slate-400">/{p.restaurant.slug}</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  {isElite ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-slate-900 text-amber-300 border border-amber-500/40"
                                      title="Plan Elite: subida de información por MenuQR, mantenimientos mensuales y asesoramiento premium"
                                    >
                                      ⭐ ELITE ($20)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      PRO ($15)
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="font-mono font-bold text-white text-sm block">
                                    ${p.amount.toFixed(2)} USD
                                  </span>
                                  <span className="text-[10px] uppercase text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {p.method}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <span className="font-mono text-slate-300 block">{p.reference || "Sin referencia"}</span>
                                    {p.receiptUrl && (
                                      <a
                                        href={p.receiptUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-amber-400 hover:text-amber-300 underline font-semibold text-[11px] inline-flex items-center gap-1"
                                      >
                                        Ver Comprobante ↗
                                      </a>
                                    )}
                                    {p.notes && <p className="text-[10px] text-slate-400 italic">Notas: {p.notes}</p>}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                                  {p.startsAt && p.expiresAt ? (
                                    <div>
                                      <span className="text-slate-300">
                                        {new Date(p.startsAt).toLocaleDateString()} al {new Date(p.expiresAt).toLocaleDateString()}
                                      </span>
                                      <span className="text-[10px] text-emerald-400 block font-sans">
                                        (30 días activos)
                                      </span>
                                    </div>
                                  ) : isApproved && p.expiresAt ? (
                                    <span>Hasta {new Date(p.expiresAt).toLocaleDateString()}</span>
                                  ) : (
                                    <span className="text-slate-500">—</span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {isApproved && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Aprobado
                                    </span>
                                  )}
                                  {isPending && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const res = await approveManualSubscriptionPaymentAction(p.id);
                                          if (res.error) alert(res.error);
                                          else window.location.reload();
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                                      >
                                        Aprobar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const res = await rejectManualSubscriptionPaymentAction(p.id);
                                          if (res.error) alert(res.error);
                                          else window.location.reload();
                                        }}
                                        className="px-2 py-1 rounded-lg bg-red-600/70 hover:bg-red-600 text-white font-bold text-[11px]"
                                      >
                                        Rechazar
                                      </button>
                                    </div>
                                  )}
                                  {isRejected && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                      Rechazado
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {filteredHistory.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                No se encontraron registros de pagos con los filtros seleccionados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

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

              {/* Pestañas de Segmentos / Categorías con Contadores Dinámicos */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
                {VERTICAL_TABS.map((tab) => {
                  const isSelected = selectedVertical === tab.id;
                  const count = verticalCounts[tab.id] ?? 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedVertical(tab.id)}
                      className={`group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 border whitespace-nowrap shrink-0 ${
                        isSelected
                          ? tab.activeTabStyle
                          : "bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                {(selectedVertical !== "all" || searchTerm.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVertical("all");
                      setSearchTerm("");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-850 border border-slate-800 transition shrink-0 ml-auto"
                    title="Restablecer filtros"
                  >
                    <X className="h-3.5 w-3.5 text-slate-400" />
                    <span>Limpiar filtros</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-900/60">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio & Categoría</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacto & WhatsApp</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Etapa CRM</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Salud del Menú</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan / Licencia</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Herramientas</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Seguimiento</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones & Bitácora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredRestaurants.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <Store className="h-8 w-8 text-slate-600" />
                              <p className="text-slate-300 font-semibold">
                                {selectedVertical !== "all"
                                  ? `No hay negocios en la categoría "${VERTICAL_TABS.find(t => t.id === selectedVertical)?.label}"`
                                  : "No se encontraron negocios registrados."}
                              </p>
                              <p className="text-xs text-slate-500">
                                {searchTerm.trim()
                                  ? `Ningún resultado coincide con la búsqueda "${searchTerm}".`
                                  : "Prueba seleccionando otra categoría o crea un nuevo negocio."}
                              </p>
                              {(selectedVertical !== "all" || searchTerm.trim()) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVertical("all");
                                    setSearchTerm("");
                                  }}
                                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline font-medium"
                                >
                                  Ver todos los negocios ({restaurantList.length})
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredRestaurants.map((res) => {
                          const trialEnds = new Date(res.trialEndsAt);
                          const isExpired = trialEnds < new Date();
                          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                          const stageInfo = CRM_STAGES.find(s => s.id === (res.leadStatus || "LEAD_NUEVO")) || CRM_STAGES[0];
                          const resVertical = resolveBusinessVertical(res);
                          const tabInfo = VERTICAL_TABS.find((t) => t.id === resVertical) || VERTICAL_TABS[1];

                          return (
                            <tr key={res.id} className="hover:bg-slate-900/20 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-start gap-3">
                                  {res.logoUrl ? (
                                    <img src={res.logoUrl} alt={res.name} className="h-10 w-10 rounded-xl object-cover border border-slate-800 shrink-0 mt-0.5" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-xl bg-slate-850 flex items-center justify-center font-bold text-white uppercase text-sm shrink-0 mt-0.5">
                                      {res.name.charAt(0)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-semibold text-white flex items-center gap-1">
                                      {res.name}
                                      {(() => {
                                        const cleanSlug = encodeURIComponent((res.slug || "").trim());
                                        const targetHref = resVertical === "retail" 
                                          ? `/ctalo/${cleanSlug}` 
                                          : resVertical === "reservas"
                                          ? `/reservas/${cleanSlug}`
                                          : resVertical === "servicios"
                                          ? `/servicios/${cleanSlug}`
                                          : resVertical === "citas"
                                          ? `/citas/${cleanSlug}`
                                          : `/${cleanSlug}`;
                                        return (
                                          <a href={targetHref} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition" title={`Abrir ${tabInfo.label}`}>
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        );
                                      })()}
                                    </div>
                                    <div className="text-xs text-slate-400">/{res.slug}</div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${tabInfo.badgeStyle}`}>
                                        <span>{tabInfo.icon}</span>
                                        <span>{tabInfo.shortLabel}</span>
                                      </span>
                                      {(res.city || res.locality) && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-slate-400 bg-slate-800/80 border border-slate-700/60 max-w-[130px] truncate" title={res.city || res.locality || ""}>
                                          <MapPin className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                                          <span className="truncate">{res.city || res.locality}</span>
                                        </span>
                                      )}
                                    </div>
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
                                    const newStatus = e.target.value;
                                    const oldStatus = res.leadStatus;
                                    setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, leadStatus: newStatus } : r));
                                    const resAction = await updateRestaurantLeadStatusAction(res.id, newStatus);
                                    if (resAction?.error) {
                                      alert(resAction.error);
                                      setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, leadStatus: oldStatus } : r));
                                    }
                                  }}
                                  className={`text-xs rounded-xl px-2.5 py-1 font-bold border focus:outline-none cursor-pointer transition-colors ${stageInfo.color}`}
                                >
                                  {CRM_STAGES.map(s => (
                                    <option key={s.id} value={s.id} className="bg-slate-900 text-white font-normal">
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* SALUD DEL MENÚ (HEALTH SCORE) */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {(() => {
                                  const health = res.health || {
                                    totalDishes: res._count?.dishes || 0,
                                    dishesWithPhoto: 0,
                                    photoPercentage: 0,
                                    totalOrders: 0,
                                    recentOrders: 0,
                                    lastOrderDate: null
                                  };
                                  const isSuspended = Boolean(res.isSuspended);
                                  const isElite = res.plan === "ELITE";
                                  const needsUpsell = !isElite && health.totalDishes > 0 && health.photoPercentage < 60;
                                  const isAtRisk = !isSuspended && health.totalDishes < 3;

                                  return (
                                    <div className="space-y-1.5 min-w-[150px]">
                                      <div className="flex items-center gap-1.5">
                                        {isSuspended ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                                            <Pause className="w-2.5 h-2.5" /> Pausado (Mora)
                                          </span>
                                        ) : needsUpsell ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                            <Sparkles className="w-2.5 h-2.5 text-purple-400" /> Candidato Elite ($20)
                                          </span>
                                        ) : isAtRisk ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                            <AlertTriangle className="w-2.5 h-2.5" /> En Riesgo
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                            <CheckCircle2 className="w-2.5 h-2.5" /> Saludable
                                          </span>
                                        )}
                                      </div>

                                      {/* Barra de Fotos */}
                                      <div className="space-y-0.5">
                                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                          <span>Fotos: {health.dishesWithPhoto}/{health.totalDishes}</span>
                                          <span className={health.photoPercentage >= 70 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                            {health.photoPercentage}%
                                          </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full transition-all ${
                                              health.photoPercentage >= 70 ? "bg-emerald-500" : health.photoPercentage >= 40 ? "bg-amber-500" : "bg-red-500"
                                            }`}
                                            style={{ width: `${health.photoPercentage}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Botón WhatsApp Upsell Elite */}
                                      {needsUpsell && (
                                        <button
                                          onClick={() => {
                                            const cleanPhone = res.whatsappNumber.replace(/[^0-9]/g, "");
                                            const text = `Hola ${res.userName || res.name}, te saluda el equipo de MenuQR Pro. Estuvimos revisando tu menú digital y notamos que varios de tus platos aún no tienen fotos. En nuestro Plan ELITE ($20 USD/mes), nosotros nos encargamos de subir todas tus fotos profesionales, mantener tu carta actualizada mensualmente y asesorarte para multiplicar tus pedidos por WhatsApp. ¿Te gustaría que nos encarguemos de todo para impulsar tus ventas?`;
                                            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
                                          }}
                                          className="w-full text-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950/40 border border-purple-800/40 text-purple-300 hover:bg-purple-900/50 transition flex items-center justify-center gap-1"
                                          title="Enviar propuesta de Plan Elite por WhatsApp"
                                        >
                                          <Sparkles className="w-2.5 h-2.5" /> Ofrecer Elite ($20)
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-1">
                                  <select
                                    value={res.plan}
                                    onChange={async (e) => {
                                      const newPlan = e.target.value as "FREE" | "PRO" | "ELITE";
                                      await changeUserPlanAction(res.id, newPlan);
                                      setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, plan: newPlan } : r));
                                      alert(`Plan de "${res.name}" cambiado a ${newPlan} con éxito.`);
                                    }}
                                    className="bg-slate-950 border border-slate-800 text-xs rounded-xl px-2.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-semibold cursor-pointer"
                                  >
                                    <option value="FREE">FREE (Prueba)</option>
                                    <option value="PRO">PRO ($15/mes)</option>
                                    <option value="ELITE">⭐ ELITE ($20/mes)</option>
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

                              {/* HERRAMIENTAS ON/OFF (BODEGA, CAJA POS, RULETA) */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {(() => {
                                  let customObj: any = {};
                                  if (res.customLabels) {
                                    try {
                                      customObj = typeof res.customLabels === "string" 
                                        ? JSON.parse(res.customLabels) 
                                        : res.customLabels;
                                    } catch {
                                      customObj = {};
                                    }
                                  }
                                  const disabledMods: string[] = Array.isArray(customObj.disabledModules) 
                                    ? customObj.disabledModules 
                                    : [];

                                  const isInventoryOn = !disabledMods.includes("inventory");
                                  const isCajaOn = !disabledMods.includes("caja");
                                  const isRuletaOn = !disabledMods.includes("ruleta");

                                  return (
                                    <div className="flex flex-col gap-1 min-w-[135px]">
                                      {/* Bodega & Stock Switch */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleModule(res.id, "inventory", isInventoryOn)}
                                        className={`inline-flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition shadow-sm cursor-pointer ${
                                          isInventoryOn
                                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50"
                                            : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-850"
                                        }`}
                                        title={isInventoryOn ? "Bodega y Stock ACTIVA (clic para apagar)" : "Bodega y Stock DESACTIVADA (clic para activar)"}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <Boxes className={`h-3 w-3 ${isInventoryOn ? "text-emerald-400" : "text-slate-500"}`} />
                                          <span>Bodega</span>
                                        </span>
                                        <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                          isInventoryOn ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
                                        }`}>
                                          {isInventoryOn ? "ON" : "OFF"}
                                        </span>
                                      </button>

                                      {/* Caja POS Switch */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleModule(res.id, "caja", isCajaOn)}
                                        className={`inline-flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition shadow-sm cursor-pointer ${
                                          isCajaOn
                                            ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50"
                                            : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-850"
                                        }`}
                                        title={isCajaOn ? "Caja POS Escáner ACTIVA (clic para apagar)" : "Caja POS Escáner DESACTIVADA (clic para activar)"}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <Barcode className={`h-3 w-3 ${isCajaOn ? "text-cyan-400" : "text-slate-500"}`} />
                                          <span>Caja POS</span>
                                        </span>
                                        <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                          isCajaOn ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-500"
                                        }`}>
                                          {isCajaOn ? "ON" : "OFF"}
                                        </span>
                                      </button>

                                      {/* Ruleta Switch */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleModule(res.id, "ruleta", isRuletaOn)}
                                        className={`inline-flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition shadow-sm cursor-pointer ${
                                          isRuletaOn
                                            ? "bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50"
                                            : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-850"
                                        }`}
                                        title={isRuletaOn ? "Ruleta de Premios ACTIVA (clic para apagar)" : "Ruleta de Premios DESACTIVADA (clic para activar)"}
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <Sparkles className={`h-3 w-3 ${isRuletaOn ? "text-amber-400" : "text-slate-500"}`} />
                                          <span>Ruleta</span>
                                        </span>
                                        <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                                          isRuletaOn ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-500"
                                        }`}>
                                          {isRuletaOn ? "ON" : "OFF"}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })()}
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
                                      await impersonateUserAction(res.userId, res.id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-950/60 font-bold transition"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                                  Asistir
                                </button>

                                {/* Botón Pausar / Reactivar por Mora */}
                                <button
                                  onClick={() => handleToggleSuspension(res)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                                    res.isSuspended
                                      ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/40 hover:bg-emerald-900/60"
                                      : "text-amber-400 bg-amber-950/30 border-amber-800/40 hover:bg-amber-900/50"
                                  }`}
                                  title={res.isSuspended ? "Reactivar menú público" : "Pausar menú por mora de pago"}
                                >
                                  {res.isSuspended ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                  {res.isSuspended ? "Reactivar" : "Pausar"}
                                </button>

                                <button
                                  onClick={() => {
                                    setReassignModalTarget(res);
                                    setReassignEmail(res.email || "");
                                    setReassignMsg(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-blue-400 bg-blue-950/30 border border-blue-800/40 hover:bg-blue-950/60 font-bold transition"
                                  title="Adjudicar o reasignar propiedad a otro usuario"
                                >
                                  <UserCheck className="h-3.5 w-3.5 text-blue-300" />
                                  Adjudicar
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

        {/* TAB: CENTRO DE COBRANZAS & CHURN GUARDIAN */}
        {activeTab === "collections" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  Centro de Cobranzas Inteligente & Churn Guardian
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Control financiero del MRR (PRO $15 / ELITE $20), alertas preventivas, cobros por WhatsApp y suspensión por mora.
                </p>
              </div>

              {/* Botón rápido a pagos manuales */}
              <button
                onClick={() => {
                  setActiveTab("directory");
                  setTimeout(() => {
                    const el = document.getElementById("gestion-pagos-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-750 text-slate-300 hover:text-white flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Ir a Registro de Pagos
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">MRR Facturable Actual</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-1">${currentMRR} USD</p>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">{proCount} PRO</span> ($15) + <span className="text-amber-400 font-bold">{eliteCount} ELITE</span> ($20)
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Cobros Urgentes (0-1d)</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {urgentCollections.length} <span className="text-xs font-normal text-slate-400">negocios</span>
                </p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Monto por recaudar: <strong className="text-white">${urgentCollections.reduce((s, i) => s + i.planAmount, 0)} USD</strong>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Vencidos en Mora</span>
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-red-400 mt-1">
                  {overdueCollections.length} <span className="text-xs font-normal text-slate-400">negocios</span>
                </p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Riesgo de churn: <strong className="text-white">${overdueCollections.reduce((s, i) => s + i.planAmount, 0)} USD</strong>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Menús Pausados</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Pause className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-purple-300 mt-1">
                  {suspendedCollections.length} <span className="text-xs font-normal text-slate-400">pausados</span>
                </p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Acceso público en pausa por mora
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setCollectionsFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  collectionsFilter === "ALL"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Todos ({restaurantsWithExpiry.length})
              </button>
              <button
                onClick={() => setCollectionsFilter("URGENT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  collectionsFilter === "URGENT"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Vence Hoy / Mañana ({urgentCollections.length})
              </button>
              <button
                onClick={() => setCollectionsFilter("UPCOMING")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  collectionsFilter === "UPCOMING"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Preventivo 3-5 días ({upcomingCollections.length})
              </button>
              <button
                onClick={() => setCollectionsFilter("OVERDUE")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  collectionsFilter === "OVERDUE"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                En Mora ({overdueCollections.length})
              </button>
              <button
                onClick={() => setCollectionsFilter("SUSPENDED")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  collectionsFilter === "SUSPENDED"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                <Pause className="w-3.5 h-3.5 text-purple-400" />
                Pausados ({suspendedCollections.length})
              </button>
            </div>

            {/* Collections Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const list = restaurantsWithExpiry.filter(item => {
                  if (collectionsFilter === "URGENT") return item.isUrgent && !item.isSuspended;
                  if (collectionsFilter === "UPCOMING") return item.isUpcoming && !item.isSuspended;
                  if (collectionsFilter === "OVERDUE") return item.isOverdue && !item.isSuspended;
                  if (collectionsFilter === "SUSPENDED") return item.isSuspended;
                  return true;
                });

                if (list.length === 0) {
                  return (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                      No hay negocios en esta categoría de cobranza.
                    </div>
                  );
                }

                return list.map((item) => {
                  const r = item.restaurant;
                  const isElite = r.plan === "ELITE";
                  return (
                    <div
                      key={r.id}
                      className={`p-5 rounded-2xl border backdrop-blur-md flex flex-col justify-between gap-4 transition ${
                        item.isSuspended
                          ? "bg-purple-950/20 border-purple-800/40"
                          : item.isOverdue
                          ? "bg-red-950/20 border-red-800/40"
                          : item.isUrgent
                          ? "bg-amber-950/20 border-amber-800/40"
                          : "bg-slate-900/40 border-slate-800"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {r.logoUrl ? (
                              <img src={r.logoUrl} alt={r.name} className="w-9 h-9 rounded-xl object-cover border border-slate-800" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-850 flex items-center justify-center font-bold text-white text-xs">
                                {r.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                                {r.name}
                                <a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </h3>
                              <p className="text-xs text-slate-400">/{r.slug} • {r.whatsappNumber}</p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isElite
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          }`}>
                            {isElite ? "⭐ ELITE $20" : "PRO $15"}
                          </span>
                        </div>

                        {/* Status Bar */}
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-850 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Vigencia:</span>
                            <span className="font-semibold text-white">{item.trialEnd.toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Situación:</span>
                            {item.isSuspended ? (
                              <span className="text-purple-400 font-bold flex items-center gap-1">
                                <Pause className="w-3 h-3" /> Pausado por mora
                              </span>
                            ) : item.isOverdue ? (
                              <span className="text-red-400 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Vencido hace {Math.abs(item.diffDays)}d
                              </span>
                            ) : item.isUrgent ? (
                              <span className="text-amber-400 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Vence en {item.diffDays}d
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-medium">
                                Al día ({item.diffDays}d restantes)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleSendCollectionWhatsApp(item)}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10"
                          title="Enviar mensaje de cobro a WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Cobrar (${item.planAmount})
                        </button>

                        <button
                          onClick={() => handleToggleSuspension(r)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                            item.isSuspended
                              ? "bg-purple-950/40 text-purple-300 border-purple-800/40 hover:bg-purple-900/50"
                              : "bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
                          }`}
                        >
                          {item.isSuspended ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                          {item.isSuspended ? "Reactivar" : "Pausar Menú"}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* TAB: OPERACIONES PLAN ELITE (VIP) */}
        {activeTab === "elite_ops" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  Operaciones Plan ELITE ($20 USD/mes) - Servicio Llave en Mano
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Bandeja de solicitudes de mantenimiento, subida de fotos, actualización de cartas y asesoría VIP.
                </p>
              </div>

              <button
                onClick={() => setIsCreateEliteTaskModalOpen(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                Nueva Solicitud Elite
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Restaurantes Elite</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Crown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-400 mt-1">{eliteCount} <span className="text-xs font-normal text-slate-400">negocios</span></p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Facturación mensual: <strong className="text-white">${eliteCount * 20} USD/mes</strong>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Tareas Pendientes</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Wrench className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-1">{pendingEliteTasksCount} <span className="text-xs font-normal text-slate-400">por atender</span></p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Carga de fotos, cartas y soporte VIP
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Completadas este Mes</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCheck className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {completedEliteTasksThisMonth.length} <span className="text-xs font-normal text-slate-400">resueltas</span>
                </p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Garantía de servicio mensual cumplida
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Total Solicitudes</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-1">{eliteTaskList.length}</p>
                <div className="text-[11px] text-slate-400 mt-1">
                  Histórico de trabajo VIP acumulado
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setEliteFilterStatus("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  eliteFilterStatus === "ALL"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Todas ({eliteTaskList.length})
              </button>
              <button
                onClick={() => setEliteFilterStatus("PENDIENTE")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  eliteFilterStatus === "PENDIENTE"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Pendientes ({eliteTaskList.filter(t => t.status === "PENDIENTE").length})
              </button>
              <button
                onClick={() => setEliteFilterStatus("EN_PROCESO")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  eliteFilterStatus === "EN_PROCESO"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                En Proceso ({eliteTaskList.filter(t => t.status === "EN_PROCESO").length})
              </button>
              <button
                onClick={() => setEliteFilterStatus("COMPLETADO")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  eliteFilterStatus === "COMPLETADO"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                Completadas ({eliteTaskList.filter(t => t.status === "COMPLETADO").length})
              </button>
            </div>

            {/* Elite Tasks Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const filteredTasks = eliteTaskList.filter(t => {
                  if (eliteFilterStatus !== "ALL" && t.status !== eliteFilterStatus) return false;
                  return true;
                });

                if (filteredTasks.length === 0) {
                  return (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                      No hay solicitudes en esta categoría. Puedes registrar una con el botón "+ Nueva Solicitud Elite".
                    </div>
                  );
                }

                return filteredTasks.map((task) => {
                  const r = restaurantList.find(res => res.id === task.restaurantId);
                  const requestTypeLabels: Record<string, string> = {
                    CARGA_MENU: "Carga de Menú Completo",
                    ACTUALIZACION_PRECIOS: "Ajuste de Precios",
                    CAMBIO_FOTOS: "Fotografía y Platos",
                    ASESORIA_VENTAS: "Asesoría en Ventas",
                    OTRO: "Mantenimiento General"
                  };

                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-2xl border bg-slate-900/40 border-slate-800 backdrop-blur-md flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {r?.logoUrl ? (
                              <img src={r.logoUrl} alt={r?.name || ""} className="w-8 h-8 rounded-lg object-cover border border-slate-800" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-xs">
                                {r?.name?.charAt(0) || "E"}
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-sm text-white">{r?.name || "Restaurante"}</h4>
                              <p className="text-[11px] text-slate-400">{new Date(task.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            task.priority === "ALTA"
                              ? "bg-red-500/10 text-red-400 border-red-500/30"
                              : task.priority === "MEDIA"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}>
                            Prioridad {task.priority}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                            {requestTypeLabels[task.requestType] || task.requestType}
                          </span>
                          <h3 className="font-bold text-sm text-slate-100">{task.title}</h3>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-1 whitespace-pre-line bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Status Select */}
                        <div className="flex items-center justify-between pt-1">
                          <label className="text-[11px] text-slate-400 font-semibold">Estado:</label>
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateEliteStatus(task.id, e.target.value as any)}
                            className={`text-xs rounded-xl px-2.5 py-1 font-bold border focus:outline-none cursor-pointer ${
                              task.status === "COMPLETADO"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : task.status === "EN_PROCESO"
                                ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            <option value="PENDIENTE" className="bg-slate-900 text-white font-normal">Pendiente</option>
                            <option value="EN_PROCESO" className="bg-slate-900 text-white font-normal">En Proceso</option>
                            <option value="COMPLETADO" className="bg-slate-900 text-white font-normal">Completado</option>
                          </select>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                        {r?.userId && (
                          <button
                            onClick={async () => {
                              if (confirm(`¿Deseas ingresar al panel de "${r.name}" para subir fotos y editar platos en Modo Asistencia?`)) {
                                await impersonateUserAction(r.userId, r.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1.5"
                            title="Entrar al panel admin de este restaurante para gestionar platos"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Editar Carta
                          </button>
                        )}

                        <div className="flex items-center gap-1.5">
                          {task.status === "COMPLETADO" && (
                            <button
                              onClick={() => handleNotifyEliteCompleted(task)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1"
                              title="Avisar al cliente por WhatsApp que el trabajo fue completado"
                            >
                              <Send className="w-3 h-3" />
                              Avisar
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEliteTask(task.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition rounded-lg"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
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
                const stageRestaurants = restaurantList.filter(r => (r.leadStatus || "LEAD_NUEVO") === stage.id);

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
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  res.plan === "ELITE"
                                    ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30"
                                    : res.plan === "PRO"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-slate-800 text-slate-400"
                                }`}>
                                  {res.plan === "ELITE" ? "⭐ ELITE ($20)" : res.plan === "PRO" ? "PRO ($15)" : "FREE"}
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
                                    const newStatus = e.target.value;
                                    const oldStatus = res.leadStatus;
                                    setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, leadStatus: newStatus } : r));
                                    const resAction = await updateRestaurantLeadStatusAction(res.id, newStatus);
                                    if (resAction?.error) {
                                      alert(resAction.error);
                                      setRestaurantList(prev => prev.map(r => r.id === res.id ? { ...r, leadStatus: oldStatus } : r));
                                    }
                                  }}
                                  className="bg-slate-900 border border-slate-800 text-[10px] rounded-lg px-2 py-1 text-slate-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
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
              {restaurantList.filter(r => r.nextFollowUpAt && r.nextFollowUpAt.split("T")[0] <= todayStr).map((res) => (
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



        {/* TAB 8: ANALÍTICA & GMV */}
        {activeTab === "analytics" && (
          <SuperAdminAnalyticsTab
            gmvTotal={analyticsData?.gmvTotal || 0}
            totalOrdersCount={analyticsData?.totalOrdersCount || 0}
            ordersLast30DaysGmv={analyticsData?.ordersLast30DaysGmv || 0}
            ordersLast30DaysCount={analyticsData?.ordersLast30DaysCount || 0}
            analyticsEventStats={analyticsData?.analyticsEventStats || { qrScans: 0, menuViews: 0, whatsappClicks: 0, dishViews: 0, totalEvents: 0 }}
            restaurants={restaurantList}
          />
        )}

        {/* TAB 9: ANUNCIOS & DIFUSIÓN */}
        {activeTab === "announcements" && (
          <SuperAdminAnnouncementsTab
            initialAnnouncement={globalAnnouncement || { text: "", type: "info", link: "", active: false }}
            restaurants={restaurantList}
          />
        )}

        {/* TAB 10: SALUD INFRAESTRUCTURA & REPORTES */}
        {activeTab === "ops" && (
          <SuperAdminOpsTab
            restaurants={restaurantList}
            manualPayments={paymentList}
            leads={leads}
          />
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

      {/* REASSIGN / ADJUDICATE MODAL */}
      {reassignModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-blue-600/10 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Adjudicar Negocio</h3>
                  <p className="text-[11px] text-slate-400">Reasigna la propiedad a otro usuario</p>
                </div>
              </div>
              <button 
                onClick={() => setReassignModalTarget(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Negocio Seleccionado</span>
              <p className="text-sm font-bold text-white">{reassignModalTarget.name}</p>
              <p className="text-xs text-slate-400">Propietario Actual: <span className="text-amber-400 font-semibold">{reassignModalTarget.userName} ({reassignModalTarget.email || "Sin email"})</span></p>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              {reassignMsg && (
                <div className={`p-3 rounded-xl border ${reassignMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                  {reassignMsg.text}
                </div>
              )}

              <div className="space-y-2">
                <label className="block font-medium text-slate-300">Seleccionar Usuario Registrado</label>
                <select
                  value={allUsers.some(u => u.email.toLowerCase() === reassignEmail.toLowerCase()) ? allUsers.find(u => u.email.toLowerCase() === reassignEmail.toLowerCase())?.email : ""}
                  onChange={(e) => setReassignEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
                >
                  <option value="">-- O selecciona de la lista ({allUsers.length} usuarios) --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-slate-300">O escribe el Correo del Nuevo Propietario *</label>
                <input
                  type="email"
                  required
                  value={reassignEmail}
                  onChange={(e) => setReassignEmail(e.target.value)}
                  placeholder="ej: usuario@ejemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassignModalTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reassignLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserCheck className="h-4 w-4" />
                  {reassignLoading ? "Procesando..." : "Adjudicar Negocio"}
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

              {/* Owner Mode Selector */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400">Tipo de Asignación de Usuario</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOwnerMode("new")}
                    className={`flex-1 py-2 px-3 rounded-xl font-extrabold border transition ${ownerMode === "new" ? "bg-red-600 text-white border-red-500 shadow-md" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850"}`}
                  >
                    ✨ Crear Nuevo Usuario
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerMode("existing")}
                    className={`flex-1 py-2 px-3 rounded-xl font-extrabold border transition ${ownerMode === "existing" ? "bg-blue-600 text-white border-blue-500 shadow-md" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850"}`}
                  >
                    👤 Adjudicar a Usuario Existente
                  </button>
                </div>

                {ownerMode === "existing" && (
                  <div className="pt-2">
                    <label className="block text-slate-300 mb-1 font-medium">Seleccionar Propietario Existente</label>
                    <select
                      onChange={(e) => {
                        const target = allUsers.find(u => u.id === e.target.value);
                        if (target) {
                          setCreateData({
                            ...createData,
                            userName: target.name,
                            email: target.email,
                            password: "N/A"
                          });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Elige un usuario de la lista ({allUsers.length}) --</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

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
                    onChange={(e) => setCreateData({ ...createData, plan: e.target.value as "FREE" | "PRO" | "ELITE" })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="FREE">FREE (Demo 30 días)</option>
                    <option value="PRO">PRO ($15/mes - Autogestión)</option>
                    <option value="ELITE">⭐ ELITE ($20/mes - Gestión & Asesoría VIP)</option>
                  </select>
                </div>
              </div>

              {/* Selector de Categoría / Tipo de Negocio */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Categoría y Tipo de Negocio *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Configura automáticamente la vista móvil, módulos y catálogo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {VERTICAL_TABS.filter((t) => t.id !== "all").map((v) => {
                    const isSelected = createData.vertical === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setCreateData({ ...createData, vertical: v.id as BusinessVertical })}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-slate-900 border-amber-500 shadow-md ring-1 ring-amber-500/50"
                            : "bg-slate-950/80 hover:bg-slate-900/60 border-slate-800/90 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-xl p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                          {v.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold leading-tight ${isSelected ? "text-white" : "text-slate-300"}`}>
                            {v.label}
                          </div>
                          <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                            {v.id === "restaurante" && "Menús QR, comandas de cocina, split-bill y delivery"}
                            {v.id === "retail" && "Catálogo interactivo, tallas, colores y pedidos WhatsApp"}
                            {v.id === "servicios" && "Cotizador de reparaciones, repuestos y soporte técnico"}
                            {v.id === "citas" && "Agendamiento interactivo para clínicas, barberías y spa"}
                            {v.id === "reservas" && "Catálogo de habitaciones, hospedaje, tarifas y reservas"}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
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
                      onChange={(e) => {
                        const clean = e.target.value
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9-]+/g, "-");
                        setEditData({ ...editData, slug: clean });
                      }}
                      placeholder="ej: mi-negocio-online"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Solo minúsculas, números y guiones. Sin espacios ni tildes.</p>
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
                      onChange={(e) => setEditData({ ...editData, plan: e.target.value as "FREE" | "PRO" | "ELITE" })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="FREE">FREE (Prueba)</option>
                      <option value="PRO">PRO ($15/mes - Autogestión)</option>
                      <option value="ELITE">⭐ ELITE ($20/mes - Gestión & Asesoría VIP)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Categoría / Tipo de Negocio</label>
                    <select
                      value={editData.vertical}
                      onChange={(e) => setEditData({ ...editData, vertical: e.target.value as BusinessVertical })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                    >
                      {VERTICAL_TABS.filter((t) => t.id !== "all").map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.icon} {v.label}
                        </option>
                      ))}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Slogan / Frase Corta</label>
                    <input
                      type="text"
                      value={editData.slogan || ""}
                      onChange={(e) => setEditData({ ...editData, slogan: e.target.value })}
                      placeholder="ej: ¡La mejor calidad, eso es todo!"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Descripción del Negocio / Historia</label>
                    <textarea
                      rows={2}
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      placeholder="Breve reseña o historia del negocio..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>
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
                  <div className="sm:col-span-3">
                    <label className="block text-sky-400 mb-1 font-bold">📍 Enlace de Ubicame.info (Botón "Ubicame.info")</label>
                    <input
                      type="text"
                      value={editData.ubicameUrl}
                      onChange={(e) => setEditData({ ...editData, ubicameUrl: e.target.value })}
                      placeholder="https://ubicame.info"
                      className="w-full bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-amber-400 mb-1 font-bold">📅 Enlace de Reservaciones (Botón "Reservar Ahora")</label>
                    <input
                      type="text"
                      value={editData.reservationUrl}
                      onChange={(e) => setEditData({ ...editData, reservationUrl: e.target.value })}
                      placeholder="https://reservaciones.ubicame.cc"
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    handleDeleteRestaurant(editingRestaurant.id, editingRestaurant.name);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 font-bold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar Negocio
                </button>
                <div className="flex gap-2">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Nueva Solicitud Plan Elite */}
      {isCreateEliteTaskModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-white">Nueva Solicitud Plan Elite</h3>
              </div>
              <button
                onClick={() => setIsCreateEliteTaskModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEliteTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Restaurante / Negocio *</label>
                <select
                  required
                  value={newEliteTaskData.restaurantId}
                  onChange={(e) => setNewEliteTaskData({ ...newEliteTaskData, restaurantId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500"
                >
                  <option value="">Selecciona un restaurante...</option>
                  {restaurantList.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} ({res.plan === "ELITE" ? "⭐ Plan ELITE" : `Plan ${res.plan}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título de la Solicitud *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cargar 6 nuevos platos de mariscos y fotos"
                  value={newEliteTaskData.title}
                  onChange={(e) => setNewEliteTaskData({ ...newEliteTaskData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Solicitud</label>
                  <select
                    value={newEliteTaskData.requestType}
                    onChange={(e) => setNewEliteTaskData({ ...newEliteTaskData, requestType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500"
                  >
                    <option value="CARGA_MENU">Carga de Menú Completo</option>
                    <option value="ACTUALIZACION_PRECIOS">Ajuste de Precios</option>
                    <option value="CAMBIO_FOTOS">Fotografía y Platos</option>
                    <option value="ASESORIA_VENTAS">Asesoría en Ventas</option>
                    <option value="OTRO">Mantenimiento General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prioridad</label>
                  <select
                    value={newEliteTaskData.priority}
                    onChange={(e) => setNewEliteTaskData({ ...newEliteTaskData, priority: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500"
                  >
                    <option value="ALTA">Alta (Urgente)</option>
                    <option value="MEDIA">Media (Estándar)</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Detalle o Notas del Cliente</label>
                <textarea
                  rows={3}
                  placeholder="Detalla los platos, precios solicitados, enlaces de Google Drive o fotos enviadas por WhatsApp..."
                  value={newEliteTaskData.description}
                  onChange={(e) => setNewEliteTaskData({ ...newEliteTaskData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateEliteTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                >
                  Guardar Solicitud Elite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
