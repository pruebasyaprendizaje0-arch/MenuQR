"use client";

import React, { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import { getBusinessLabels } from "@/lib/business-labels";
import { 
  logoutUserAction, 
  updateRestaurantAction, 
  createCategoryAction, 
  updateCategoryAction, 
  deleteCategoryAction, 
  moveCategoryOrderAction,
  reorderCategoriesAction,
  createDishAction, 
  updateDishAction, 
  deleteDishAction, 
  toggleDishAvailabilityAction, 
  quickUpdateDishStockAction, 
  updateOrderStatusAction, 
  updateRestaurantTablesAction, 
  updateRestaurantChargesConfigAction, 
  createManualSubscriptionPaymentAction,
  createSeasonRateAction,
  updateSeasonRateAction,
  deleteSeasonRateAction,
  toggleSeasonRateAction,
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
  importCustomersAction,
  updateRestaurantSchedulesAction,
  getRestaurantCouponsAction,
  createCouponAction,
  deleteCouponAction,
  toggleCouponStatusAction,
  toggleRestaurantTestModeAction,
  purgeTestDataAction,
  getComprehensiveBusinessBackupAction
} from "@/lib/actions";
import { SmartLogo } from "@/components/SmartImage";
import { 
  WeeklySchedule, 
  BlockedDateItem, 
  parseWeeklySchedule, 
  parseBlockedDates, 
  DAY_LABELS, 
  DEFAULT_WEEKLY_SCHEDULE 
} from "@/lib/schedule";
import { sanitizeMapEmbedUrl } from "@/lib/map-utils";
import { parseDishImages, serializeDishImages, getPrimaryDishImage } from "@/lib/dish-images";
import { 
  Store, 
  Barcode,
  Sliders,
  FolderHeart, 
  Soup, 
  QrCode, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  LineChart, 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Camera, 
  Truck, 
  Upload, 
  CreditCard, 
  Crown, 
  Sparkles, 
  Search, 
  FileSpreadsheet, 
  UserCheck, 
  Heart, 
  MessageSquare, 
  CalendarDays, 
  Percent, 
  Tag, 
  MapPin, 
  Utensils,
  Globe,
  ChevronUp,
  ChevronDown,
  Loader2,
  Download,
  Cake,
  Gift,
  Award,
  ShieldAlert,
  Wheat,
  History,
  Star,
  Flame,
  User,
  FileText,
  CheckSquare,
  Square,
  Bot,
  Smartphone,
  FlaskConical,
  RefreshCw,
  Package,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Boxes,
  Receipt,
  Trees,
  BedDouble,
  Wrench,
  Layers,
  Image as ImageIcon,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import RuletaAdminTab from "./RuletaAdminTab";
import CampaignsAdminTab from "./CampaignsAdminTab";
import InventoryAdminTab from "./InventoryAdminTab";
import CitasAdminTab from "./CitasAdminTab";
import ReservasAdminTab from "./ReservasAdminTab";
import OrderTicketModal from "./OrderTicketModal";
import { WhatsAppConnectTab } from "./WhatsAppConnectTab";
import StaffAdminTab from "./StaffAdminTab";
import { getSuggestedDishIdsAction, toggleSuggestedDishAction } from "@/lib/suggested-dishes-actions";
import { generateTableToken, buildTableQrUrl } from "@/lib/table-token";

type SeasonRate = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  percentageBonus: number;
  fixedBonus: number;
  isHoliday: boolean;
  isActive: boolean;
};

type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrder: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};
import { QRCodeCanvas } from "qrcode.react";
import { ecuadorData, parishData, communeData } from "@/lib/ecuador";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  sku?: string | null;
  barcode?: string | null;
  costPrice?: number | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  stock?: number | null;
  minStock?: number | null;
  trackStock?: boolean;
  variants?: string | null;
};

type Category = {
  id: string;
  name: string;
  order: number;
  imageAspectRatio?: string | null;
  dishes: Dish[];
};

type OrderItem = {
  id: string;
  orderId: string;
  dishName: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  orderNumber?: number;
  restaurantId: string;
  tableName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  status: "PENDING" | "PREPARING" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
  subtotal: number;
  iva: number;
  serviceCharge: number;
  tip: number;
  deliveryCost?: number;
  couponCode?: string | null;
  discountAmount?: number;
  total: number;
  paymentMethod: string;
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  plan?: "FREE" | "PRO" | "ELITE";
  logoUrl: string | null;
  coverUrl: string | null;
  paymentQrUrl: string | null;
  deunaPhone?: string | null;
  payphoneUrl?: string | null;
  payphonePhone?: string | null;
  payphoneQrUrl?: string | null;
  whatsappNumber: string;
  themeColor: string;
  trialEndsAt: string | Date;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  address: string | null;
  slogan?: string | null;
  description: string | null;
  locality: string | null;
  schedule: string | null;
  localSchedule?: string | null;
  deliverySchedule?: string | null;
  blockedDates?: string | null;
  specialty: string | null;
  services: string | null;
  contactNumbers: string | null;
  ubicameUrl: string | null;
  reservationUrl?: string | null;
  mapEmbedUrl?: string | null;
  googleBusinessUrl?: string | null;
  priceRange?: string | null;
  structuredSchedule?: string | null;
  tablesConfig: string;
  ivaPercent: number;
  servicePercent: number;
  deliveryCost: number;
  deliveryEnabled: boolean;
  deliveryRates?: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankAccountDocument: string | null;
  bankAccountEmail: string | null;
  ivaOnTable: boolean;
  ivaOnTakeout: boolean;
  serviceOnTable: boolean;
  serviceOnTakeout: boolean;
  whatsapp?: string;
  whatsappBotEnabled?: boolean;
  testMode?: boolean;
  city?: string | null;
  province?: string | null;
  parish?: string | null;
  sector?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  seoImage?: string | null;
  categories: Category[];
  suppliers?: any[];
  orders: Order[];
  seasonRates?: SeasonRate[];
  coupons?: Coupon[];
  customers?: Customer[];
};

type SubscriptionPaymentDetails = {
  qrUrl: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountName: string;
  document: string;
  deunaPhone: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  category: string;
  notes?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerMetadata = {
  dietary?: string[]; // ["VEGAN", "VEGETARIAN", "GLUTEN_FREE", "LACTOSE_FREE", "KETO", "HALAL"]
  allergies?: string;
  birthDate?: string; // "YYYY-MM-DD"
  points?: number;
  favoriteDish?: string;
  customNotes?: string;
  lastService?: string;
  equipmentBrand?: string;
  equipmentTech?: string;
  symptoms?: string[];
  preferredTimeSlot?: string;
  lastQuoteAt?: string;
};

export const DIETARY_PREFERENCES_LIST = [
  { id: "VEGAN", label: "Vegano", emoji: "🌱", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  { id: "VEGETARIAN", label: "Vegetariano", emoji: "🥗", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  { id: "GLUTEN_FREE", label: "Sin Gluten / Celíaco", emoji: "🌾", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  { id: "LACTOSE_FREE", label: "Sin Lactosa", emoji: "🥛", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { id: "KETO", label: "Keto / Low Carb", emoji: "🥑", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  { id: "HALAL", label: "Halal", emoji: "🍖", color: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
];

export const SERVICIOS_MARCAS_COMUNES = [
  "Samsung",
  "LG",
  "Mabe",
  "Whirlpool",
  "Electrolux",
  "Haceb",
  "Indurama",
  "Bosch",
  "TCL",
  "General Electric",
  "Otra",
];

export const SERVICIOS_TECNOLOGIAS = [
  { id: "Inverter ⚡", label: "Inverter ⚡", desc: "Ahorro / Digital" },
  { id: "Convencional", label: "Convencional", desc: "Estándar / Análogo" },
  { id: "Smart / WiFi", label: "Smart / WiFi", desc: "Control inteligente" },
  { id: "Industrial", label: "Industrial", desc: "Comercial / Trifásico" },
];

export const SERVICIOS_SINTOMAS_HABITUALES = [
  "❄️ No enfría / congela",
  "🔊 Ruido extraño / vibra",
  "💧 Fuga de agua / goteo",
  "⚡ Salta breaker / no prende",
  "🔥 No calienta / sin chispa",
  "⚠️ Código de error",
  "🧼 No centrifuga / desagua",
  "⚙️ Mantenimiento preventivo",
];

export const SERVICIOS_FRANJAS_HORARIAS = [
  { id: "☀️ Mañana (08:00 - 12:00)", label: "☀️ Mañana (08:00 - 12:00)" },
  { id: "🌤️ Tarde (13:00 - 17:00)", label: "🌤️ Tarde (13:00 - 17:00)" },
  { id: "🌙 Fin de Jornada (17:00 - 19:30)", label: "🌙 Fin de Jornada (17:00 - 19:30)" },
  { id: "🚨 Urgencia Inmediata", label: "🚨 Urgencia Inmediata" },
];

export function parseCustomerMetadata(notesString?: string | null): CustomerMetadata {
  if (!notesString) {
    return { dietary: [], allergies: "", birthDate: "", points: 0, favoriteDish: "", customNotes: "" };
  }
  try {
    const trimmed = notesString.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      return {
        dietary: Array.isArray(parsed.dietary) ? parsed.dietary : [],
        allergies: typeof parsed.allergies === "string" ? parsed.allergies : "",
        birthDate: typeof parsed.birthDate === "string" ? parsed.birthDate : "",
        points: typeof parsed.points === "number" ? parsed.points : 0,
        favoriteDish: typeof parsed.favoriteDish === "string" ? parsed.favoriteDish : "",
        customNotes: typeof parsed.customNotes === "string" ? parsed.customNotes : "",
        lastService: typeof parsed.lastService === "string" ? parsed.lastService : "",
        equipmentBrand: typeof parsed.equipmentBrand === "string" ? parsed.equipmentBrand : "",
        equipmentTech: typeof parsed.equipmentTech === "string" ? parsed.equipmentTech : "",
        symptoms: Array.isArray(parsed.sintomas_detectados) ? parsed.sintomas_detectados : (Array.isArray(parsed.symptoms) ? parsed.symptoms : []),
        preferredTimeSlot: typeof parsed.preferredTimeSlot === "string" ? parsed.preferredTimeSlot : "",
        lastQuoteAt: typeof parsed.lastQuoteAt === "string" ? parsed.lastQuoteAt : "",
      };
    }
  } catch (e) {
    // fallback
  }
  return { dietary: [], allergies: "", birthDate: "", points: 0, favoriteDish: "", customNotes: notesString };
}

export function formatCustomerMetadata(meta: CustomerMetadata): string {
  return JSON.stringify({
    dietary: meta.dietary || [],
    allergies: meta.allergies || "",
    birthDate: meta.birthDate || "",
    points: meta.points || 0,
    favoriteDish: meta.favoriteDish || "",
    customNotes: meta.customNotes || "",
    lastService: meta.lastService || "",
    equipmentBrand: meta.equipmentBrand || "",
    equipmentTech: meta.equipmentTech || "",
    symptoms: meta.symptoms || [],
    preferredTimeSlot: meta.preferredTimeSlot || "",
    lastQuoteAt: meta.lastQuoteAt || "",
  });
}

export function getCustomerInsights(cust: Customer, orders: Order[], meta: CustomerMetadata) {
  const cleanPhone = (cust.phone || "").replace(/\D/g, "");
  const matchingOrders = (orders || []).filter((o) => {
    if (!o.customerPhone) return false;
    const oPhone = o.customerPhone.replace(/\D/g, "");
    return oPhone && (oPhone === cleanPhone || oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone));
  });

  const dishCountMap: Record<string, number> = {};
  matchingOrders.forEach((o) => {
    (o.items || []).forEach((it) => {
      dishCountMap[it.dishName] = (dishCountMap[it.dishName] || 0) + it.quantity;
    });
  });

  let topDishFromOrders = "";
  let maxQty = 0;
  Object.entries(dishCountMap).forEach(([dish, qty]) => {
    if (qty > maxQty) {
      maxQty = qty;
      topDishFromOrders = dish;
    }
  });

  const favoriteDish = meta.favoriteDish?.trim() || topDishFromOrders || "Por determinar";

  let isBirthdayToday = false;
  let isBirthdayThisMonth = false;
  let daysUntilBirthday: number | null = null;
  let formattedBirthday = "";

  if (meta.birthDate) {
    const today = new Date();
    const parts = meta.birthDate.split("-");
    if (parts.length === 3) {
      const bMonth = parseInt(parts[1], 10) - 1;
      const bDay = parseInt(parts[2], 10);
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      formattedBirthday = `${bDay} de ${months[bMonth] || ""}`;

      if (today.getMonth() === bMonth && today.getDate() === bDay) {
        isBirthdayToday = true;
      }
      if (today.getMonth() === bMonth) {
        isBirthdayThisMonth = true;
      }

      let nextBday = new Date(today.getFullYear(), bMonth, bDay);
      if (nextBday.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
        nextBday = new Date(today.getFullYear() + 1, bMonth, bDay);
      }
      const diffTime = nextBday.getTime() - today.getTime();
      daysUntilBirthday = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
  }

  const avgTicket = cust.totalOrders > 0 ? cust.totalSpent / cust.totalOrders : 0;

  return {
    matchingOrders,
    favoriteDish,
    topDishQty: maxQty,
    isBirthdayToday,
    isBirthdayThisMonth,
    daysUntilBirthday,
    formattedBirthday,
    avgTicket,
  };
}

function MapEmbedConfigField({ 
  initialValue, 
  address, 
  cityName 
}: { 
  initialValue?: string | null; 
  address?: string | null; 
  cityName?: string | null;
}) {
  const [val, setVal] = useState(initialValue || "");
  const [showPreview, setShowPreview] = useState(false);
  
  const previewSrc = sanitizeMapEmbedUrl(val) || (address ? sanitizeMapEmbedUrl(`${address}${cityName ? `, ${cityName}` : ""}, Ecuador`) : null);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-400">
            URL de iframe de Google Maps o código Embed (`&lt;iframe src="..."&gt;&lt;/iframe&gt;`)
          </label>
          {previewSrc && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? "Ocultar Vista Previa" : "Ver Vista Previa del Mapa"}
            </button>
          )}
        </div>
        <textarea
          name="mapEmbedUrl"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          rows={2}
          placeholder='Para la ficha exacta: pega el código de “Insertar un mapa” de Google Maps'
          className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {val.trim() && sanitizeMapEmbedUrl(val) ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mapa detectado y validado automáticamente (sin errores de pb)
            </span>
          ) : !val.trim() && address ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-medium">
              <MapPin className="w-3.5 h-3.5" />
              Se usará la dirección física automáticamente para el mapa público
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          💡 Para que el mapa muestre la tarjeta del negocio y su pin sea clicable, usa en Google Maps: Compartir → Insertar un mapa → Copiar HTML. Un enlace de dirección o coordenadas solo centra el mapa y puede llevar a un punto cercano.
        </p>
      </div>

      {showPreview && previewSrc && (
        <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-950 shadow-xl p-3 space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5 text-white">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              Vista Previa en Vivo del Mapa
            </span>
            <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs">{previewSrc}</span>
          </div>
          <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-800">
            <iframe
              src={previewSrc}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { TableSplitMonitor } from "./TableSplitMonitor";
import BatchDishModal from "./BatchDishModal";


export type VisitStats = {
  total: number;
  today: number;
  week: number;
  month: number;
};

export function AdminDashboard({ 
  restaurant, 
  subscriptionPaymentDetails,
  visitStats,
  visitStatsReal,
  visitStatsTest,
  globalAnnouncement,
}: { 
  restaurant: Restaurant; 
  subscriptionPaymentDetails?: SubscriptionPaymentDetails;
  visitStats?: VisitStats;
  visitStatsReal?: VisitStats;
  visitStatsTest?: VisitStats;
  globalAnnouncement?: {
    text: string;
    type: "info" | "success" | "warning" | "promo";
    link?: string;
    active: boolean;
  } | null;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"metrics" | "restaurant" | "categories" | "dishes" | "inventory" | "seasons" | "coupons" | "ruleta" | "campaigns" | "qr" | "whatsapp" | "orders" | "split-bill" | "staff" | "crm" | "citas" | "reservas" | "subscription">("metrics");

  // --- Módulo de Pruebas (Sandbox) y Respaldo Excel ---
  const [isTestMode, setIsTestMode] = useState<boolean>(Boolean(restaurant.testMode ?? false));
  const [metricViewMode, setMetricViewMode] = useState<"REAL" | "TEST" | "ALL">(
    restaurant.testMode ? "TEST" : "REAL"
  );
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState("");
  const [purgeSuccessBanner, setPurgeSuccessBanner] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportDataSource, setExportDataSource] = useState<"REAL" | "TEST" | "ALL">("REAL");
  const [exportTimeframe, setExportTimeframe] = useState<"ALL" | "MONTH" | "WEEK" | "TODAY">("ALL");
  const [exportSuccessMsg, setExportSuccessMsg] = useState("");

  // --- Estados de Desglose de Pedidos y Ticket / Comanda ---
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ticketModalOrder, setTicketModalOrder] = useState<Order | null>(null);

  const handlePrintThermalReceipt = (order: Order) => {
    const printWindow = window.open("", "_blank", "width=420,height=650");
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para imprimir el ticket.");
      return;
    }
    const formattedDate = new Date(order.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
    const channelLabel = order.tableName === "Llevar" 
      ? "🛍 PARA LLEVAR" 
      : order.tableName === "Domicilio" 
        ? "🛵 A DOMICILIO" 
        : `🪑 MESA #${order.tableName}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Ticket #${order.orderNumber || order.id.slice(0, 6)}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
              width: 76mm;
              margin: 0 auto;
              padding: 8px 4px;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed { border-top: 1px dashed #000; margin: 6px 0; }
            .double { border-top: 2px solid #000; margin: 6px 0; }
            .flex { display: flex; justify-content: space-between; }
            .title { font-size: 15px; font-weight: bold; text-transform: uppercase; }
            .channel-badge {
              font-size: 13px;
              font-weight: bold;
              border: 1.5px solid #000;
              padding: 3px 6px;
              display: inline-block;
              margin: 4px 0;
              border-radius: 4px;
            }
            .item-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px; }
            .item-name { max-width: 52mm; word-break: break-word; }
            .total-row { font-size: 15px; font-weight: bold; margin: 4px 0; }
            @media print {
              body { width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">${restaurant.name}</div>
            <div>${formattedDate}</div>
            <div class="channel-badge">${channelLabel}</div>
            <div class="bold" style="font-size: 13px;">ORDEN #${order.orderNumber || order.id.slice(0, 6)}</div>
          </div>

          <div class="dashed"></div>

          ${order.customerName ? `<div><strong>Cliente:</strong> ${order.customerName}</div>` : ""}
          ${order.customerPhone ? `<div><strong>Teléfono:</strong> ${order.customerPhone}</div>` : ""}
          ${order.customerAddress ? `<div><strong>Dirección:</strong> ${order.customerAddress}</div>` : ""}
          <div><strong>Método de Pago:</strong> ${order.paymentMethod === "qr" ? "QR de Cobro" : "Efectivo / Transferencia"}</div>

          <div class="dashed"></div>
          <div class="bold item-row" style="font-size: 10px; text-transform: uppercase;">
            <span>CANT / PRODUCTO</span>
            <span>TOTAL</span>
          </div>
          <div class="dashed"></div>

          ${(order.items || []).map((it) => `
            <div class="item-row">
              <span class="item-name"><strong>${it.quantity}x</strong> ${it.dishName}</span>
              <span class="right bold">$${(it.price * it.quantity).toFixed(2)}</span>
            </div>
          `).join("")}

          <div class="dashed"></div>

          <div class="flex"><span>Subtotal:</span><span>$${Number(order.subtotal || 0).toFixed(2)}</span></div>
          ${(order.deliveryCost || 0) > 0 ? `<div class="flex"><span>Envío / Delivery:</span><span>+$${Number(order.deliveryCost).toFixed(2)}</span></div>` : ""}
          ${(order.discountAmount || 0) > 0 ? `<div class="flex"><span>Descuento cupón:</span><span>-$${Number(order.discountAmount).toFixed(2)}</span></div>` : ""}
          ${(order.iva || 0) > 0 ? `<div class="flex"><span>IVA:</span><span>+$${Number(order.iva).toFixed(2)}</span></div>` : ""}

          <div class="double"></div>
          <div class="flex total-row">
            <span>TOTAL A COBRAR:</span>
            <span>$${Number(order.total).toFixed(2)}</span>
          </div>
          <div class="dashed"></div>

          <div class="center" style="font-size: 10px; margin-top: 8px;">
            ¡Muchas gracias por su compra!<br/>
            Comprobante emitido con MenuQR Pro
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleToggleTestMode = async () => {
    const nextMode = !isTestMode;
    setIsTogglingMode(true);
    try {
      const res = await toggleRestaurantTestModeAction(restaurant.id, nextMode);
      if (res.error) {
        alert(res.error);
        return;
      }
      setIsTestMode(nextMode);
      setMetricViewMode(nextMode ? "TEST" : "REAL");
    } catch (err: any) {
      alert("Error al alternar modo: " + err.message);
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handlePurgeTestData = async () => {
    if (purgeConfirmInput.trim().toUpperCase() !== "ELIMINAR") {
      alert("Escribe la palabra ELIMINAR para confirmar la purga.");
      return;
    }
    setIsPurgingData(true);
    try {
      const res = await purgeTestDataAction(restaurant.id);
      if (res.error) {
        alert(res.error);
        return;
      }
      setShowPurgeModal(false);
      setPurgeConfirmInput("");
      setPurgeSuccessBanner("¡Datos de prueba eliminados correctamente!");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      alert("Error al purgar datos: " + err.message);
    } finally {
      setIsPurgingData(false);
    }
  };

  const handleGenerateExcelBackup = async (sourceFilter: "REAL" | "TEST" | "ALL" = exportDataSource) => {
    setIsExportingExcel(true);
    try {
      const res = await getComprehensiveBusinessBackupAction(restaurant.id, sourceFilter);
      if (res.error || !res.orders) {
        alert(res.error || "No se pudieron obtener los datos para el respaldo.");
        return;
      }

      const ordersData = res.orders;
      const waitersData = res.waiters || [];
      const analyticsData = res.analytics || [];

      const now = new Date();
      const filteredOrders = ordersData.filter((o: any) => {
        if (exportTimeframe === "ALL") return true;
        const oDate = new Date(o.createdAt);
        if (exportTimeframe === "TODAY") {
          return oDate.toDateString() === now.toDateString();
        }
        if (exportTimeframe === "WEEK") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          return oDate >= sevenDaysAgo;
        }
        if (exportTimeframe === "MONTH") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          return oDate >= thirtyDaysAgo;
        }
        return true;
      });

      const totalFacturacion = filteredOrders.reduce((sum: number, o: any) => sum + (o.status !== "CANCELLED" ? o.total : 0), 0);
      const totalSubtotal = filteredOrders.reduce((sum: number, o: any) => sum + (o.status !== "CANCELLED" ? o.subtotal : 0), 0);
      const totalIva = filteredOrders.reduce((sum: number, o: any) => sum + (o.status !== "CANCELLED" ? o.iva : 0), 0);
      const totalServicio = filteredOrders.reduce((sum: number, o: any) => sum + (o.status !== "CANCELLED" ? o.serviceCharge : 0), 0);
      const totalPropinas = filteredOrders.reduce((sum: number, o: any) => sum + (o.status !== "CANCELLED" ? o.tip : 0), 0);
      const ordersCompleted = filteredOrders.filter((o: any) => o.status !== "CANCELLED").length;
      const ordersCancelled = filteredOrders.filter((o: any) => o.status === "CANCELLED").length;
      const ticketPromedio = ordersCompleted > 0 ? totalFacturacion / ordersCompleted : 0;

      const resumenRows = [
        { "MÉTRICA / INDICADOR": "NOMBRE DEL NEGOCIO", "VALOR": restaurant.name },
        { "MÉTRICA / INDICADOR": "SLUG / ENLACE", "VALOR": restaurant.slug },
        { "MÉTRICA / INDICADOR": "FECHA DE GENERACIÓN DEL RESPALDO", "VALOR": new Date().toLocaleString() },
        { "MÉTRICA / INDICADOR": "ALCANCE DEL REPORTE", "VALOR": exportTimeframe === "ALL" ? "Histórico Total" : exportTimeframe === "MONTH" ? "Últimos 30 días" : exportTimeframe === "WEEK" ? "Últimos 7 días" : "Hoy" },
        { "MÉTRICA / INDICADOR": "ORIGEN DE DATOS", "VALOR": sourceFilter === "REAL" ? "Ventas y Visitas Reales (Producción)" : sourceFilter === "TEST" ? "Datos de Prueba (Sandbox)" : "Consolidado Completo" },
        { "MÉTRICA / INDICADOR": "ESTADO DEL MODO PRUEBAS", "VALOR": isTestMode ? "Activo (Sandbox)" : "Inactivo (Producción)" },
        { "MÉTRICA / INDICADOR": "----------------------------------------", "VALOR": "----------------------------------------" },
        { "MÉTRICA / INDICADOR": "FACTURACIÓN TOTAL ($)", "VALOR": `$${totalFacturacion.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "SUBTOTAL TOTAL ($)", "VALOR": `$${totalSubtotal.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "TOTAL IVA RECAUDADO (15%) ($)", "VALOR": `$${totalIva.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "TOTAL SERVICIO (10%) ($)", "VALOR": `$${totalServicio.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "TOTAL PROPINAS VOLUNTARIAS ($)", "VALOR": `$${totalPropinas.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "TOTAL DE PEDIDOS REGISTRADOS", "VALOR": filteredOrders.length },
        { "MÉTRICA / INDICADOR": "PEDIDOS COMPLETADOS / ACTIVOS", "VALOR": ordersCompleted },
        { "MÉTRICA / INDICADOR": "PEDIDOS CANCELADOS", "VALOR": ordersCancelled },
        { "MÉTRICA / INDICADOR": "TICKET PROMEDIO POR PEDIDO ($)", "VALOR": `$${ticketPromedio.toFixed(2)}` },
        { "MÉTRICA / INDICADOR": "----------------------------------------", "VALOR": "----------------------------------------" },
        { "MÉTRICA / INDICADOR": "TOTAL VISITAS / ESCANEOS EN REGISTRO", "VALOR": analyticsData.length },
        { "MÉTRICA / INDICADOR": "TASA DE CONVERSIÓN ESTIMADA", "VALOR": analyticsData.length > 0 ? `${((ordersCompleted / analyticsData.length) * 100).toFixed(1)}%` : "N/A" },
      ];

      const pedidosRows = filteredOrders.map((o: any) => ({
        "Nº Pedido": o.orderNumber ? `#${o.orderNumber}` : o.id.slice(0, 8),
        "Fecha y Hora": new Date(o.createdAt).toLocaleString(),
        "Mesa": o.tableName,
        "Cliente": o.customerName,
        "Teléfono": o.customerPhone,
        "Estado": o.status,
        "Método de Pago": o.paymentMethod,
        "Subtotal ($)": Number(o.subtotal.toFixed(2)),
        "IVA ($)": Number(o.iva.toFixed(2)),
        "Servicio ($)": Number(o.serviceCharge.toFixed(2)),
        "Propina ($)": Number(o.tip.toFixed(2)),
        "Descuento ($)": Number(o.discountAmount.toFixed(2)),
        "Total Final ($)": Number(o.total.toFixed(2)),
        "Tipo": o.isTest ? "Prueba (Sandbox)" : "Real (Producción)",
      }));

      const platosRows: any[] = [];
      filteredOrders.forEach((o: any) => {
        (o.items || []).forEach((it: any) => {
          platosRows.push({
            "Nº Pedido": o.orderNumber ? `#${o.orderNumber}` : o.id.slice(0, 8),
            "Fecha": new Date(o.createdAt).toLocaleDateString(),
            "Mesa / Canal": o.tableName === "Domicilio" ? "Domicilio" : o.tableName === "Llevar" || !o.tableName ? "Para Llevar" : bLabels.isGastro ? `Mesa #${o.tableName}` : `Canal: ${o.tableName}`,
            [bLabels.itemSingle]: it.dishName,
            "Cantidad": it.quantity,
            "Precio Unitario ($)": Number(it.price.toFixed(2)),
            "Total Ítem ($)": Number((it.price * it.quantity).toFixed(2)),
            "Estado Pedido": o.status,
            "Tipo": o.isTest ? "Prueba" : "Real",
          });
        });
      });

      const camarerosRows = waitersData.map((w: any) => ({
        "Camarero / Mesero": w.camarero_nombre,
        "Total Pedidos": w.total_pedidos || 0,
        "Total Facturado ($)": Number((w.total_facturado || 0).toFixed(2)),
        "Mesas Atendidas": w.mesas_atendidas || 0,
      }));

      const traficoRows = analyticsData.map((a: any) => ({
        "ID Evento": a.id.slice(0, 8),
        "Fecha y Hora": new Date(a.createdAt).toLocaleString(),
        "Tipo de Evento": a.eventType === "QR_SCAN" ? "Escaneo de Código QR" : a.eventType === "MENU_VIEW" ? "Consulta de Menú Digital" : a.eventType === "RESTAURANT_VIEW" ? "Vista de Restaurante" : a.eventType,
        "Tipo": a.isTest ? "Prueba" : "Real",
      }));

      const wb = XLSX.utils.book_new();

      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      wsResumen["!cols"] = [{ wch: 45 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen_Ejecutivo");

      if (pedidosRows.length > 0) {
        const wsPedidos = XLSX.utils.json_to_sheet(pedidosRows);
        wsPedidos["!cols"] = [
          { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 16 },
          { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
          { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(wb, wsPedidos, "Historial_Pedidos");
      }

      if (platosRows.length > 0) {
        const wsPlatos = XLSX.utils.json_to_sheet(platosRows);
        wsPlatos["!cols"] = [
          { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 32 },
          { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, wsPlatos, bLabels.isGastro ? "Platos_Vendidos" : "Productos_Vendidos");
      }

      if (bLabels.isGastro && camarerosRows.length > 0) {
        const wsCamareros = XLSX.utils.json_to_sheet(camarerosRows);
        wsCamareros["!cols"] = [{ wch: 25 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsCamareros, "Rendimiento_Meseros");
      }

      if (traficoRows.length > 0) {
        const wsTrafico = XLSX.utils.json_to_sheet(traficoRows);
        wsTrafico["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 32 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsTrafico, "Trafico_Visitas_QR");
      }

      const fileDate = new Date().toISOString().split("T")[0];
      const sourceSuffix = sourceFilter === "REAL" ? "REAL" : sourceFilter === "TEST" ? "PRUEBAS" : "TOTAL";
      const fileName = `Respaldo_MenuQR_${restaurant.slug}_${sourceSuffix}_${fileDate}.xlsx`;

      XLSX.writeFile(wb, fileName);
      setExportSuccessMsg(`¡Respaldo descargado con éxito: ${fileName}!`);
      setShowExportModal(false);
      setTimeout(() => setExportSuccessMsg(""), 5000);
    } catch (err: any) {
      console.error("Error generando Excel:", err);
      alert("Error al generar el archivo Excel: " + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Si el bot de WhatsApp no está habilitado por SuperAdmin, bloquear acceso a la pestaña
  useEffect(() => {
    if (activeTab === "whatsapp" && !restaurant.whatsappBotEnabled) {
      setActiveTab("metrics");
    }
  }, [activeTab, restaurant.whatsappBotEnabled]);
  const isLikelyStore = /licor|tienda|boutique|farmacia|ferreter|repuesto|minimarket|comercio/i.test(restaurant.name || "");
  const defaultBusinessType = (restaurant as any).businessType && (restaurant as any).businessType !== "RESTAURANT"
    ? (restaurant as any).businessType
    : (isLikelyStore ? "RETAIL" : "RESTAURANT");

  const initialCustomLabels: any = (() => {
    try {
      return (restaurant as any).customLabels ? JSON.parse((restaurant as any).customLabels) : {};
    } catch {
      return {};
    }
  })();

  const isLodgingInitial = Boolean(
    initialCustomLabels.vertical === "reservas" ||
    initialCustomLabels.businessSubType === "RESERVAS" ||
    /cabaña|hospedaje|glamping|hostal|hotel|lodge/i.test(restaurant.name || "")
  );

  const isServiciosTecnicosInitial = Boolean(
    initialCustomLabels.vertical === "servicios" ||
    initialCustomLabels.businessSubType === "SERVICIOS" ||
    initialCustomLabels.businessSubType === "TECNICO"
  );

  const initialPreset: "RESTAURANT" | "RETAIL" | "SERVICIOS" | "CITAS" | "RESERVAS" = (() => {
    if (isLodgingInitial) return "RESERVAS";
    if (isServiciosTecnicosInitial) return "SERVICIOS";
    if (initialCustomLabels.vertical === "citas" || initialCustomLabels.businessSubType === "CITAS") return "CITAS";
    if (defaultBusinessType === "SERVICES") return "CITAS";
    if (defaultBusinessType === "RETAIL" || defaultBusinessType === "GENERAL_CATALOG" || isLikelyStore) return "RETAIL";
    return "RESTAURANT";
  })();

  const defaultDisabledModules: string[] = (() => {
    if (initialCustomLabels.disabledModules && Array.isArray(initialCustomLabels.disabledModules)) {
      return initialCustomLabels.disabledModules;
    }
    if (initialPreset === "RESERVAS") return ["tables", "gastro", "split-bill"];
    if (initialPreset === "SERVICIOS") return ["tables", "gastro", "split-bill", "ruleta"];
    if (initialPreset === "CITAS") return ["tables", "gastro", "split-bill"];
    if (initialPreset === "RETAIL") return ["tables", "gastro", "split-bill"];
    return [];
  })();

  const [selectedPreset, setSelectedPreset] = useState<"RESTAURANT" | "RETAIL" | "SERVICIOS" | "CITAS" | "RESERVAS">(initialPreset);
  const [isLodgingState, setIsLodgingState] = useState<boolean>(initialPreset === "RESERVAS");
  const isLodging = isLodgingState;
  const isServiciosTecnicos = selectedPreset === "SERVICIOS";

  const [selectedBusinessType, setSelectedBusinessType] = useState<string>(
    initialPreset === "RESTAURANT" ? "RESTAURANT" : initialPreset === "RETAIL" ? "RETAIL" : "SERVICES"
  );
  const [selectedCatalogMode, setSelectedCatalogMode] = useState<string>(
    (restaurant as any).catalogMode || (initialPreset === "RESTAURANT" ? "MENU" : "CATALOG")
  );
  const [enableTableOrdering, setEnableTableOrdering] = useState<boolean>(() => {
    if (typeof (restaurant as any).enableTableOrdering === "boolean") {
      if (initialPreset !== "RESTAURANT") {
        return (restaurant as any).enableTableOrdering && !defaultDisabledModules.includes("tables");
      }
      return (restaurant as any).enableTableOrdering;
    }
    return initialPreset === "RESTAURANT";
  });
  const [enablePickup, setEnablePickup] = useState<boolean>(
    (restaurant as any).enablePickup ?? true
  );
  const [enableDeliveryState, setEnableDeliveryState] = useState<boolean>(
    (restaurant as any).enableDelivery ?? (restaurant as any).deliveryEnabled ?? true
  );

  const defaultItemChoice = initialCustomLabels.items === "Platos" || initialCustomLabels.items === "Productos" || initialCustomLabels.items === "Servicios" || initialCustomLabels.items === "Cabañas / Habitaciones"
    ? initialCustomLabels.items
    : initialCustomLabels.items 
      ? "CUSTOM" 
      : (defaultBusinessType === "RESTAURANT" && initialPreset === "RESTAURANT" ? "Platos" : isLodging ? "Cabañas / Habitaciones" : defaultBusinessType === "SERVICES" ? "Servicios" : "Productos");

  const [customItemChoice, setCustomItemChoice] = useState<string>(defaultItemChoice);
  const [customItemsPlural, setCustomItemsPlural] = useState<string>(initialCustomLabels.items || (isLodging ? "Cabañas / Habitaciones" : ""));
  const [customItemSingle, setCustomItemSingle] = useState<string>(initialCustomLabels.itemSingle || (isLodging ? "Cabaña" : ""));

  const defaultCatalogTabChoice = initialCustomLabels.catalogTabTitle === "Menú Digital" || initialCustomLabels.catalogTabTitle === "Productos" || initialCustomLabels.catalogTabTitle === "Catálogo de Productos" || initialCustomLabels.catalogTabTitle === "Servicios" || initialCustomLabels.catalogTabTitle === "Hospedaje"
    ? initialCustomLabels.catalogTabTitle
    : initialCustomLabels.catalogTabTitle
      ? "CUSTOM"
      : (defaultBusinessType === "RESTAURANT" && initialPreset === "RESTAURANT" ? "Menú Digital" : isLodging ? "Hospedaje" : defaultBusinessType === "SERVICES" ? "Servicios" : "Productos");

  const [customCatalogTabChoice, setCustomCatalogTabChoice] = useState<string>(defaultCatalogTabChoice);
  const [customCatalogTabInput, setCustomCatalogTabInput] = useState<string>(initialCustomLabels.catalogTabTitle || (isLodging ? "Hospedaje" : ""));

  const [disabledModules, setDisabledModules] = useState<string[]>(defaultDisabledModules);
  const [enabledModules, setEnabledModules] = useState<string[]>(
    Array.isArray(initialCustomLabels.enabledModules) ? initialCustomLabels.enabledModules : []
  );

  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "9:16">(
    initialCustomLabels.imageAspectRatio || "1:1"
  );
  const [suggestedAspectRatio, setSuggestedAspectRatio] = useState<"1:1" | "9:16">(
    initialCustomLabels.suggestedAspectRatio || initialCustomLabels.imageAspectRatio || "1:1"
  );
  const [popularAspectRatio, setPopularAspectRatio] = useState<"1:1" | "9:16">(
    initialCustomLabels.popularAspectRatio || initialCustomLabels.imageAspectRatio || "1:1"
  );

  const [galleryImages, setGalleryImages] = useState<string[]>(() => {
    if (Array.isArray(initialCustomLabels.galleryImages)) {
      const loaded = initialCustomLabels.galleryImages
        .filter((u: any) => typeof u === "string" && u.trim().length > 0)
        .slice(0, 4);
      while (loaded.length < 4) loaded.push("");
      return loaded;
    }
    return ["", "", "", ""];
  });

  const catalogTabTitleValue = customCatalogTabChoice === "CUSTOM"
    ? customCatalogTabInput
    : customCatalogTabChoice;

  const currentCustomLabelsJSON = JSON.stringify({
    ...initialCustomLabels,
    vertical: selectedPreset === "RESERVAS" 
      ? "reservas" 
      : selectedPreset === "SERVICIOS" 
        ? "servicios" 
        : selectedPreset === "CITAS" 
          ? "citas" 
          : selectedPreset === "RETAIL" 
            ? "ctalo" 
            : "menuqr",
    businessSubType: selectedPreset,
    items: customItemChoice === "CUSTOM" ? customItemsPlural : customItemChoice,
    itemSingle: customItemChoice === "CUSTOM" ? customItemSingle : (customItemChoice === "Productos" ? "Producto" : customItemChoice === "Servicios" ? "Servicio" : isLodging ? "Cabaña" : "Plato"),
    catalogTabTitle: catalogTabTitleValue,
    subTitle: catalogTabTitleValue === "Menú Digital"
      ? "Menú Digital Auténtico"
      : catalogTabTitleValue === "Productos"
        ? "Catálogo Digital de Productos"
        : `Catálogo Digital de ${customItemChoice === "CUSTOM" ? customItemsPlural : customItemChoice}`,
    imageAspectRatio: imageAspectRatio,
    suggestedAspectRatio: suggestedAspectRatio,
    popularAspectRatio: popularAspectRatio,
    disabledModules: disabledModules,
    enabledModules: enabledModules,
    showSplitBill: !disabledModules.includes("split-bill"),
    galleryImages: galleryImages.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 4),
  });

  const bLabels = getBusinessLabels(currentCustomLabelsJSON, selectedBusinessType);
  const isRetail = selectedBusinessType !== "RESTAURANT";
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<15 | 20>(15);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO" | "ELITE">(restaurant.plan || "FREE");
  const [currentTrialEndsAt, setCurrentTrialEndsAt] = useState<Date>(
    restaurant.trialEndsAt ? new Date(restaurant.trialEndsAt) : new Date()
  );
  // Legacy card-form state is kept only because the hidden migration block below still type-checks.
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardDocId, setCardDocId] = useState("");
  const [manualPaymentMethod, setManualPaymentMethod] = useState<"transferencia" | "deuna">("transferencia");
  const [manualPaymentReference, setManualPaymentReference] = useState("");
  const [manualPaymentReceiptUrl, setManualPaymentReceiptUrl] = useState("");
  const handleSubscribePremium = (e: React.FormEvent) => {
    e.preventDefault();
    alert("El pago con tarjeta está deshabilitado. Usa transferencia o Deuna.");
  };

  const handleManualSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPayment(true);
    const result = await createManualSubscriptionPaymentAction({
      restaurantId: restaurant.id,
      amount: selectedPlanPrice,
      method: manualPaymentMethod,
      reference: manualPaymentReference,
      receiptUrl: manualPaymentReceiptUrl,
      plan: selectedPlanPrice === 20 ? "ELITE" : "PRO",
      notes: selectedPlanPrice === 20 
        ? "Plan Elite ($20.00 USD) - Carga de información, mantenimientos mensuales y asesoramiento premium" 
        : "Plan Pro ($15.00 USD) - Autogestión",
    });
    setIsSubmittingPayment(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setPaymentSuccessMsg("Solicitud enviada. Verificaremos tu pago y activaremos el plan cuando sea aprobado.");
    setManualPaymentReference("");
    setManualPaymentReceiptUrl("");
  };
  const [copied, setCopied] = useState(false);
  const [suggestedDishIds, setSuggestedDishIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadSuggestedDishes() {
      try {
        const ids = await getSuggestedDishIdsAction(restaurant.id);
        setSuggestedDishIds(ids || []);
      } catch (err) {
        console.error("Error al cargar platos sugeridos:", err);
      }
    }
    loadSuggestedDishes();
  }, [restaurant.id]);

  const handleToggleSuggestedDish = async (dishId: string) => {
    // Optimistic update
    setSuggestedDishIds((prev) =>
      prev.includes(dishId) ? prev.filter((id) => id !== dishId) : [...prev, dishId]
    );
    try {
      const res = await toggleSuggestedDishAction(restaurant.id, dishId);
      if (!res.success) {
        // Revert on failure
        const rollback = await getSuggestedDishIdsAction(restaurant.id);
        setSuggestedDishIds(rollback);
      }
    } catch (err) {
      console.error("Error al actualizar plato sugerido:", err);
    }
  };
  const [tablesConfig, setTablesConfig] = useState(restaurant.tablesConfig || "1,2,3,4,5,6,7,8,9,10");
  const [savingTables, setSavingTables] = useState(false);
  const [tablesMessage, setTablesMessage] = useState("");
  const [qrSubTab, setQrSubTab] = useState<"general" | "tables">("general");
  const [selectedQrTable, setSelectedQrTable] = useState<string>("");
  const [isBatchPrinting, setIsBatchPrinting] = useState<boolean>(false);
  const [copiedTableLink, setCopiedTableLink] = useState<boolean>(false);

  const [ivaPercent, setIvaPercent] = useState(restaurant.ivaPercent);
  const [servicePercent, setServicePercent] = useState(restaurant.servicePercent);
  const [deliveryCost, setDeliveryCost] = useState(restaurant.deliveryCost);
  const [deliveryEnabled, setDeliveryEnabled] = useState(restaurant.deliveryEnabled);
  const [ivaOnTable, setIvaOnTable] = useState(restaurant.ivaOnTable);
  const [ivaOnTakeout, setIvaOnTakeout] = useState(restaurant.ivaOnTakeout);
  const [serviceOnTable, setServiceOnTable] = useState(restaurant.serviceOnTable);
  const [serviceOnTakeout, setServiceOnTakeout] = useState(restaurant.serviceOnTakeout);

  const [kmRates, setKmRates] = useState<{ id: string; label: string; price: number; minOrder?: number }[]>(() => {
    const rawRates = restaurant?.deliveryRates || null;
    if (rawRates) {
      try {
        const parsed = JSON.parse(rawRates);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            id: item.id || `km-${Math.random()}`,
            label: item.label || "",
            price: typeof item.price === "number" ? item.price : 0,
            minOrder: typeof item.minOrder === "number" ? item.minOrder : (typeof item.minPurchase === "number" ? item.minPurchase : 0),
          }));
        }
      } catch (e) {
        console.error("Error parsing deliveryRates:", e);
      }
    }
    return [
      { id: "km-1", label: "Hasta 2 KM", price: 1.50, minOrder: 0 },
      { id: "km-2", label: "De 2 a 5 KM", price: 2.50, minOrder: 0 },
      { id: "km-3", label: "De 5 a 10 KM", price: 4.00, minOrder: 0 },
      { id: "km-4", label: "Más de 10 KM", price: 6.00, minOrder: 0 },
    ];
  });

  const [savingCharges, setSavingCharges] = useState(false);
  const [chargesMessage, setChargesMessage] = useState("");

  // Coupons System State Variables
  const [coupons, setCoupons] = useState<Coupon[]>(() => (restaurant as any).coupons || []);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [couponValue, setCouponValue] = useState("");
  const [couponMinOrder, setCouponMinOrder] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);

  useEffect(() => {
    if (activeTab === "coupons") {
      getRestaurantCouponsAction(restaurant.id).then((res) => {
        if (res.coupons) {
          setCoupons(res.coupons as any);
        }
      });
    }
  }, [activeTab, restaurant.id]);

  // Advanced Schedules & Blocked Dates State Variables
  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule>(() => parseWeeklySchedule(restaurant.localSchedule));
  const [sameDeliverySchedule, setSameDeliverySchedule] = useState<boolean>(!restaurant.deliverySchedule);
  const [deliverySchedule, setDeliverySchedule] = useState<WeeklySchedule>(() => parseWeeklySchedule(restaurant.deliverySchedule || restaurant.localSchedule));
  const [blockedDatesList, setBlockedDatesList] = useState<BlockedDateItem[]>(() => parseBlockedDates(restaurant.blockedDates));

  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newBlockFullDay, setNewBlockFullDay] = useState(true);
  const [newBlockStartTime, setNewBlockStartTime] = useState("12:00");
  const [newBlockEndTime, setNewBlockEndTime] = useState("18:00");

  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const handleAddBlockedDate = () => {
    if (!newBlockDate) {
      alert("Por favor selecciona una fecha a bloquear.");
      return;
    }
    const newItem: BlockedDateItem = {
      id: "blk-" + Date.now(),
      date: newBlockDate,
      reason: newBlockReason.trim() || "Cierre Especial",
      fullDay: newBlockFullDay,
      startTime: newBlockFullDay ? undefined : newBlockStartTime,
      endTime: newBlockFullDay ? undefined : newBlockEndTime,
    };
    setBlockedDatesList(prev => [...prev, newItem]);
    setNewBlockDate("");
    setNewBlockReason("");
    setNewBlockFullDay(true);
  };

  const handleRemoveBlockedDate = (id: string) => {
    setBlockedDatesList(prev => prev.filter(b => b.id !== id));
  };

  const handleCopyMondayToAllLocal = () => {
    const mondayConf = localSchedule.monday;
    setLocalSchedule({
      monday: { ...mondayConf },
      tuesday: { ...mondayConf },
      wednesday: { ...mondayConf },
      thursday: { ...mondayConf },
      friday: { ...mondayConf },
      saturday: { ...mondayConf },
      sunday: { ...mondayConf },
    });
  };

  const handleSaveSchedules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setScheduleMsg("");

    const localScheduleJson = JSON.stringify(localSchedule);
    const deliveryScheduleJson = sameDeliverySchedule ? null : JSON.stringify(deliverySchedule);
    const blockedDatesJson = JSON.stringify(blockedDatesList);

    const res = await updateRestaurantSchedulesAction(restaurant.id, {
      localSchedule: localScheduleJson,
      deliverySchedule: deliveryScheduleJson,
      blockedDates: blockedDatesJson,
    });

    setSavingSchedule(false);
    if (res.error) {
      setScheduleMsg("Error: " + res.error);
    } else {
      setScheduleMsg("¡Horarios y fechas congeladas guardados con éxito!");
      setTimeout(() => setScheduleMsg(""), 4000);
    }
  };

  // CRM State Variables & Handlers
  const [crmSearch, setCrmSearch] = useState("");
  const [crmCategoryFilter, setCrmCategoryFilter] = useState("TODOS");
  const [crmDietaryFilter, setCrmDietaryFilter] = useState("TODOS");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer360, setSelectedCustomer360] = useState<Customer | null>(null);

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custCategory, setCustCategory] = useState("NUEVO");
  const [custDietary, setCustDietary] = useState<string[]>([]);
  const [custAllergies, setCustAllergies] = useState("");
  const [custBirthDate, setCustBirthDate] = useState("");
  const [custPoints, setCustPoints] = useState(0);
  const [custFavoriteDish, setCustFavoriteDish] = useState("");
  const [custCustomNotes, setCustCustomNotes] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Technical Services Customer Modal Fields (Opción 2: Ficha Técnica Modular)
  const [custModalTab, setCustModalTab] = useState<"contacto" | "tecnico" | "visitas">("contacto");
  const [custEquipmentBrand, setCustEquipmentBrand] = useState("Samsung");
  const [custCustomBrand, setCustCustomBrand] = useState("");
  const [custEquipmentTech, setCustEquipmentTech] = useState("Inverter ⚡");
  const [custSymptoms, setCustSymptoms] = useState<string[]>([]);
  const [custCustomSymptom, setCustCustomSymptom] = useState("");
  const [custPreferredTimeSlot, setCustPreferredTimeSlot] = useState("☀️ Mañana (08:00 - 12:00)");
  const [custLastService, setCustLastService] = useState("");
  const [custLastQuoteAt, setCustLastQuoteAt] = useState("");
  const [custGpsLoading, setCustGpsLoading] = useState(false);

  const handleDetectCustomerGps = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("La geolocalización no está soportada en este navegador.");
      return;
    }
    setCustGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const cleanAddr = custAddress.replace(/\s*\[GPS:.*?\]/g, "").trim();
        setCustAddress(cleanAddr ? `${cleanAddr} [GPS: ${lat},${lng}]` : `[GPS: ${lat},${lng}]`);
        setCustGpsLoading(false);
      },
      () => {
        alert("No se pudo obtener la ubicación GPS.");
        setCustGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleCustomerSymptom = (sym: string) => {
    setCustSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleAddCustomSymptom = () => {
    const trimmed = custCustomSymptom.trim();
    if (trimmed && !custSymptoms.includes(trimmed)) {
      setCustSymptoms((prev) => [...prev, trimmed]);
      setCustCustomSymptom("");
    }
  };

  // Quick Points Adjustment in 360 modal
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<number>(10);
  const [adjustPointsReason, setAdjustPointsReason] = useState("");
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

  const handleOpenCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustName(customer.name);
      setCustPhone(customer.phone);
      setCustEmail(customer.email || "");
      setCustAddress(customer.address || "");
      setCustCity(customer.city || "");
      setCustCategory(customer.category || "NUEVO");
      const meta = parseCustomerMetadata(customer.notes);
      setCustDietary(meta.dietary || []);
      setCustAllergies(meta.allergies || "");
      setCustBirthDate(meta.birthDate || "");
      setCustPoints(meta.points || 0);
      setCustFavoriteDish(meta.favoriteDish || "");
      setCustCustomNotes(meta.customNotes || "");

      // Technical metadata
      const rawBrand = meta.equipmentBrand || "";
      const isPredefined = SERVICIOS_MARCAS_COMUNES.filter((b) => b !== "Otra").includes(rawBrand);
      if (isPredefined || !rawBrand) {
        setCustEquipmentBrand(rawBrand || "Samsung");
        setCustCustomBrand("");
      } else {
        setCustEquipmentBrand("Otra");
        setCustCustomBrand(rawBrand);
      }
      setCustEquipmentTech(meta.equipmentTech || "Inverter ⚡");
      setCustSymptoms(Array.isArray(meta.symptoms) ? meta.symptoms : []);
      setCustCustomSymptom("");
      setCustPreferredTimeSlot(meta.preferredTimeSlot || "☀️ Mañana (08:00 - 12:00)");
      setCustLastService(meta.lastService || meta.favoriteDish || "");
      setCustLastQuoteAt(meta.lastQuoteAt || "");
      setCustModalTab("contacto");
    } else {
      setEditingCustomer(null);
      setCustName("");
      setCustPhone("");
      setCustEmail("");
      setCustAddress("");
      setCustCity("");
      setCustCategory("NUEVO");
      setCustDietary([]);
      setCustAllergies("");
      setCustBirthDate("");
      setCustPoints(0);
      setCustFavoriteDish("");
      setCustCustomNotes("");

      // Technical metadata reset
      setCustEquipmentBrand("Samsung");
      setCustCustomBrand("");
      setCustEquipmentTech("Inverter ⚡");
      setCustSymptoms([]);
      setCustCustomSymptom("");
      setCustPreferredTimeSlot("☀️ Mañana (08:00 - 12:00)");
      setCustLastService("");
      setCustLastQuoteAt("");
      setCustModalTab("contacto");
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      alert("Por favor ingrese al menos Nombre y Teléfono/WhatsApp del cliente.");
      return;
    }
    setSavingCustomer(true);

    const resolvedBrand = isServiciosTecnicos
      ? (custEquipmentBrand === "Otra" ? (custCustomBrand.trim() || "Otra Marca") : custEquipmentBrand)
      : (custEquipmentBrand || "");

    const effectiveService = isServiciosTecnicos
      ? (custLastService.trim() || custFavoriteDish.trim() || "Servicio Técnico")
      : custFavoriteDish.trim();

    const serializedNotes = formatCustomerMetadata({
      dietary: custDietary,
      allergies: custAllergies.trim(),
      birthDate: custBirthDate,
      points: Number(custPoints) || 0,
      favoriteDish: effectiveService,
      customNotes: custCustomNotes.trim(),
      lastService: effectiveService,
      equipmentBrand: resolvedBrand,
      equipmentTech: isServiciosTecnicos ? custEquipmentTech : "",
      symptoms: isServiciosTecnicos ? custSymptoms : [],
      preferredTimeSlot: isServiciosTecnicos ? custPreferredTimeSlot : "",
      lastQuoteAt: custLastQuoteAt || (editingCustomer ? "" : new Date().toISOString()),
    });

    if (editingCustomer) {
      const res = await updateCustomerAction(editingCustomer.id, {
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: custAddress,
        city: custCity,
        category: custCategory,
        notes: serializedNotes,
      });
      setSavingCustomer(false);
      if (res.error) {
        alert(res.error);
      } else {
        setIsCustomerModalOpen(false);
        window.location.reload();
      }
    } else {
      const res = await createCustomerAction({
        restaurantId: restaurant.id,
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: custAddress,
        city: custCity,
        category: custCategory,
        notes: serializedNotes,
      });
      setSavingCustomer(false);
      if (res.error) {
        alert(res.error);
      } else {
        setIsCustomerModalOpen(false);
        window.location.reload();
      }
    }
  };

  const handleQuickAdjustPoints = async (customer: Customer, delta: number) => {
    setIsAdjustingPoints(true);
    const meta = parseCustomerMetadata(customer.notes);
    const newPoints = Math.max(0, (meta.points || 0) + delta);
    meta.points = newPoints;
    const serializedNotes = formatCustomerMetadata(meta);

    const res = await updateCustomerAction(customer.id, {
      notes: serializedNotes,
    });
    setIsAdjustingPoints(false);
    if (res.error) {
      alert(res.error);
    } else {
      // Update local state
      if (selectedCustomer360 && selectedCustomer360.id === customer.id) {
        setSelectedCustomer360({
          ...selectedCustomer360,
          notes: serializedNotes,
        });
      }
      window.location.reload();
    }
  };

  const handleExportCustomersCSV = () => {
    const list = restaurant.customers || [];
    if (list.length === 0) {
      alert("No hay clientes registrados para exportar.");
      return;
    }
    const headers = "Nombre,Telefono,Email,Direccion,Ciudad,Categoria,Notas,TotalPedidos,TotalGastado,UltimoPedido\n";
    const rows = list.map(c => 
      `"${(c.name || "").replace(/"/g, '""')}","${(c.phone || "").replace(/"/g, '""')}","${(c.email || "").replace(/"/g, '""')}","${(c.address || "").replace(/"/g, '""')}","${(c.city || "").replace(/"/g, '""')}","${c.category}","${(c.notes || "").replace(/"/g, '""')}",${c.totalOrders},${c.totalSpent},"${c.lastOrderAt}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clientes_${restaurant.slug}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDishesExcel = () => {
    const allDishes: Array<{
      Categoria: string;
      Nombre: string;
      Descripcion: string;
      Precio: number;
      Costo_Compra: number | string;
      Margen_Estimado: number | string;
      Proveedor_Habitual: string;
      Codigo_Barras_SKU: string;
      Disponible: string;
      Controla_Stock: string;
      Stock_Disponible: number | string;
      Stock_Minimo: number | string;
      URL_Imagen: string;
    }> = [];

    const cats = categoriesList && categoriesList.length > 0 ? categoriesList : (restaurant.categories || []);

    cats.forEach((cat) => {
      (cat.dishes || []).forEach((dish) => {
        const itemPrice = typeof dish.price === "number" ? dish.price : parseFloat((dish.price as any) || "0");
        const itemCost = typeof dish.costPrice === "number" ? dish.costPrice : parseFloat((dish.costPrice as any) || "0");
        const profitMargin = itemPrice > 0 && itemCost > 0 ? Number((itemPrice - itemCost).toFixed(2)) : "N/A";

        allDishes.push({
          Categoria: cat.name,
          Nombre: dish.name,
          Descripcion: dish.description || "",
          Precio: itemPrice,
          Costo_Compra: itemCost > 0 ? itemCost : "N/A",
          Margen_Estimado: profitMargin,
          Proveedor_Habitual: dish.supplier?.name || "No asignado",
          Codigo_Barras_SKU: dish.barcode || dish.sku || "",
          Disponible: dish.isAvailable ? "SI" : "NO",
          Controla_Stock: dish.trackStock ? "SI" : "NO",
          Stock_Disponible: dish.trackStock ? (dish.stock ?? 0) : "N/A",
          Stock_Minimo: dish.trackStock ? (dish.minStock ?? 0) : "N/A",
          URL_Imagen: getPrimaryDishImage(dish.imageUrl) || dish.imageUrl || "",
        });
      });
    });

    if (allDishes.length === 0) {
      alert(`No hay ${bLabels.items.toLowerCase()} registrados en el catálogo para exportar.`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(allDishes);

    worksheet["!cols"] = [
      { wch: 22 }, // Categoria
      { wch: 32 }, // Nombre
      { wch: 48 }, // Descripcion
      { wch: 12 }, // Precio
      { wch: 14 }, // Costo_Compra
      { wch: 16 }, // Margen_Estimado
      { wch: 24 }, // Proveedor_Habitual
      { wch: 20 }, // Codigo_Barras_SKU
      { wch: 14 }, // Disponible
      { wch: 14 }, // Controla_Stock
      { wch: 16 }, // Stock_Disponible
      { wch: 14 }, // Stock_Minimo
      { wch: 38 }, // URL_Imagen
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, bLabels.items);

    const fileName = `catalogo_${restaurant.slug}_${bLabels.items.toLowerCase()}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Import Contacts States & Handlers
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTextContent, setImportTextContent] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const parseImportContent = (text: string, filename?: string) => {
    const results: { name: string; phone: string; email?: string; address?: string; city?: string; category?: string; notes?: string }[] = [];
    const isVcard = filename?.toLowerCase().endsWith(".vcf") || text.includes("BEGIN:VCARD");

    if (isVcard) {
      const cards = text.split("END:VCARD");
      for (const card of cards) {
        let name = "";
        let phone = "";
        let email = "";

        const fnMatch = card.match(/FN[;:](.+)/i) || card.match(/N[;:](.+)/i);
        if (fnMatch && fnMatch[1]) {
          name = fnMatch[1].replace(/;/g, " ").trim();
        }

        const telMatch = card.match(/TEL[;:].*?([0-9+\s\-()]+)/i);
        if (telMatch && telMatch[1]) {
          phone = telMatch[1].trim();
        }

        const emailMatch = card.match(/EMAIL[;:].*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch && emailMatch[1]) {
          email = emailMatch[1].trim();
        }

        if (name && phone) {
          results.push({ name, phone, email, category: "NUEVO" });
        }
      }
    } else {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let startIndex = 0;

      if (lines.length > 0) {
        const headerLine = lines[0].toLowerCase();
        if (headerLine.includes("nombre") || headerLine.includes("name") || headerLine.includes("phone") || headerLine.includes("telefono")) {
          startIndex = 1;
        }
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.includes(";") ? line.split(";") : line.includes("\t") ? line.split("\t") : line.split(",");

        if (parts.length >= 2) {
          const name = parts[0].replace(/^["']|["']$/g, "").trim();
          const phone = parts[1].replace(/^["']|["']$/g, "").trim();
          const email = parts[2] ? parts[2].replace(/^["']|["']$/g, "").trim() : undefined;
          const address = parts[3] ? parts[3].replace(/^["']|["']$/g, "").trim() : undefined;
          const city = parts[4] ? parts[4].replace(/^["']|["']$/g, "").trim() : undefined;
          const category = parts[5] ? parts[5].replace(/^["']|["']$/g, "").trim() : "NUEVO";
          const notes = parts[6] ? parts[6].replace(/^["']|["']$/g, "").trim() : undefined;

          if (name && phone) {
            results.push({ name, phone, email, address, city, category, notes });
          }
        }
      }
    }

    return results;
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setImportTextContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importTextContent.trim()) {
      alert("Por favor selecciona un archivo (CSV / VCF) o pega el contenido de los contactos a importar.");
      return;
    }
    setIsImporting(true);
    setImportMessage("");

    const parsedCustomers = parseImportContent(importTextContent, importFileName);

    if (parsedCustomers.length === 0) {
      setIsImporting(false);
      alert("No se pudieron detectar contactos válidos. Asegúrate de incluir Nombre y Teléfono.");
      return;
    }

    const res = await importCustomersAction(restaurant.id, parsedCustomers);
    setIsImporting(false);

    if (res.error) {
      setImportMessage(`Error: ${res.error}`);
    } else {
      setImportMessage(`¡Importación exitosa! ${res.importedCount} contactos nuevos registrados, ${res.updatedCount} clientes actualizados.`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        window.location.reload();
      }, 2000);
    }
  };

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [logoUrlInput, setLogoUrlInput] = useState(restaurant.logoUrl || "");
  const [coverUrlInput, setCoverUrlInput] = useState(restaurant.coverUrl || "");
  const [paymentQrUrlInput, setPaymentQrUrlInput] = useState(restaurant.paymentQrUrl || "");
  const [payphoneQrUrlInput, setPayphoneQrUrlInput] = useState(restaurant.payphoneQrUrl || "");
  const [logoHasError, setLogoHasError] = useState(false);
  const [coverHasError, setCoverHasError] = useState(false);
  const [paymentQrHasError, setPaymentQrHasError] = useState(false);
  const [payphoneQrHasError, setPayphoneQrHasError] = useState(false);
  const [dishImageHasError, setDishImageHasError] = useState(false);

  const logoFileInputRef = React.useRef<HTMLInputElement>(null);
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  const paymentQrFileInputRef = React.useRef<HTMLInputElement>(null);
  const payphoneQrFileInputRef = React.useRef<HTMLInputElement>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [paymentQrFileName, setPaymentQrFileName] = useState<string | null>(null);
  const [payphoneQrFileName, setPayphoneQrFileName] = useState<string | null>(null);

  const [logoBase64, setLogoBase64] = useState<string>("");
  const [dishBase64s, setDishBase64s] = useState<string[]>([]);

  useEffect(() => {
    // Convert logo
    if (restaurant.logoUrl) {
      const img = new Image();
      if (restaurant.logoUrl.startsWith("http")) {
        img.crossOrigin = "anonymous";
      }
      img.src = restaurant.logoUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const dataUrl = canvas.toDataURL("image/png");
            setLogoBase64(dataUrl);
          } catch (e) {
            console.warn("Failed to convert logo to base64, canvas tainted:", e);
          }
        }
      };
    }

    // Convert first 3 dishes with images (dishes live inside categories)
    const allDishes = (restaurant.categories || []).flatMap(c => c.dishes || []);
    const items = allDishes.filter(d => d.imageUrl).slice(0, 3);
    const loadedBase64s: string[] = [];
    let loadedCount = 0;

    if (items.length === 0) {
      setDishBase64s([]);
      return;
    }

    items.forEach((item, index) => {
      const img = new Image();
      const src = (getPrimaryDishImage(item.imageUrl) || item.imageUrl || "") as string;
      if (!src) return;
      if (src.startsWith("http")) {
        img.crossOrigin = "anonymous";
      }
      img.src = src;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            loadedBase64s[index] = canvas.toDataURL("image/png");
          } catch (e) {
            console.warn("Failed to convert dish image to base64:", e);
          }
        }
        loadedCount++;
        if (loadedCount === items.length) {
          setDishBase64s(loadedBase64s.filter(Boolean));
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === items.length) {
          setDishBase64s(loadedBase64s.filter(Boolean));
        }
      };
    });
  }, [restaurant.logoUrl, restaurant.categories]);

  // Ubicación estructurada: Provincia | Cantón | Parroquia | Sector
  let initialProv = "";
  let initialCant = "";
  let initialParroquia = "";
  let initialSector = "";

  if (restaurant.locality) {
    const parts = restaurant.locality.split(" | ");
    if (parts.length >= 2) {
      initialProv = parts[0] || "";
      initialCant = parts[1] || "";
      initialParroquia = parts[2] || "";
      initialSector = parts[3] || "";
    } else {
      const oldParts = restaurant.locality.split(", ");
      if (oldParts.length === 2) {
        initialProv = oldParts[1] || "";
        initialCant = oldParts[0] || "";
        initialParroquia = oldParts[0] || "";
      } else {
        initialParroquia = restaurant.locality;
      }
    }
  }

  const [province, setProvince] = useState(initialProv);
  const [canton, setCanton] = useState(initialCant);
  const [parroquia, setParroquia] = useState(initialParroquia);
  const [sector, setSector] = useState(initialSector);
  
  const downloadQR = () => {
    const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;
    if (!qrCanvas) return;

    // Create a new canvas to draw the print poster
    const posterCanvas = document.createElement("canvas");
    posterCanvas.width = 400;
    posterCanvas.height = 620;
    const ctx = posterCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw solid background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 620);

    const drawContent = () => {
      try {
        // Draw the 3 dish images at the top
        if (dishBase64s.length > 0) {
          const thumbSize = 64;
          const gap = 12;
          const totalWidth = (dishBase64s.length * thumbSize) + ((dishBase64s.length - 1) * gap);
          const startX = (400 - totalWidth) / 2;
          
          dishBase64s.forEach((base64, idx) => {
            const img = new Image();
            img.src = base64;
            ctx.save();
            ctx.beginPath();
            // Rounded corners clip
            ctx.roundRect(startX + idx * (thumbSize + gap), 30, thumbSize, thumbSize, 14);
            ctx.clip();
            ctx.drawImage(img, startX + idx * (thumbSize + gap), 30, thumbSize, thumbSize);
            ctx.restore();

            // Draw a subtle border around the thumbnail
            ctx.strokeStyle = "#e2e8f0"; // border-slate-200
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(startX + idx * (thumbSize + gap), 30, thumbSize, thumbSize, 14);
            ctx.stroke();
          });
        }

        // 3. Draw Title: "Escanea para ver el menú de" + restaurant.name
        ctx.fillStyle = "#0f172a"; // slate-900
        ctx.textAlign = "center";
        
        // Title line 1
        ctx.font = "bold 15px sans-serif";
        ctx.fillText("Escanea para ver el menú de", 200, 135);

        // Title line 2 (Restaurant Name)
        ctx.font = "black 22px sans-serif";
        ctx.fillStyle = restaurant.themeColor;
        ctx.fillText(restaurant.name, 200, 168);

        // 4. Draw the QR code canvas in the center
        ctx.drawImage(qrCanvas, 75, 210, 250, 250);

        // 5. Draw a footer/instruction
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#64748b"; // slate-500
        ctx.fillText("¡Muchas gracias por su preferencia!", 200, 510);

        ctx.font = "normal 10px sans-serif";
        ctx.fillStyle = "#94a3b8"; // slate-400
        ctx.fillText("Creado con MenuQR Pro", 200, 540);

        // Trigger download
        const pngUrl = posterCanvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `QR-${restaurant.slug}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } catch (err) {
        console.error("Canvas tainted, falling back to simple QR download:", err);
        // Fallback: download the plain QR canvas if poster drawing failed due to taint
        try {
          const plainCanvas = document.createElement("canvas");
          plainCanvas.width = qrCanvas.width;
          plainCanvas.height = qrCanvas.height;
          const pCtx = plainCanvas.getContext("2d");
          if (pCtx) {
            pCtx.drawImage(qrCanvas, 0, 0);
            const plainUrl = plainCanvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = plainUrl;
            downloadLink.download = `QR-${restaurant.slug}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
          }
        } catch (fallbackErr) {
          console.error("Plain QR download failed:", fallbackErr);
        }
      }
    };

    if (logoBase64) {
      const logoImg = new Image();
      logoImg.src = logoBase64;
      logoImg.onload = () => {
        try {
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.drawImage(logoImg, -50, -50, 500, 720);
          ctx.restore();
        } catch (e) {
          console.warn("Could not draw watermark background logo:", e);
        }
        drawContent();
      };
      logoImg.onerror = () => {
        drawContent();
      };
    } else {
      drawContent();
    }
  };
  
  // States for Category Dialogs & Ordering
  const [categoriesList, setCategoriesList] = useState<Category[]>(() => 
    [...(restaurant.categories || [])].sort((a, b) => a.order - b.order)
  );
  const [reorderingCatId, setReorderingCatId] = useState<string | null>(null);

  useEffect(() => {
    setCategoriesList([...(restaurant.categories || [])].sort((a, b) => a.order - b.order));
  }, [restaurant.categories]);

  const handleMoveCategory = async (categoryId: string, direction: "up" | "down") => {
    const currentIndex = categoriesList.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoriesList.length) return;

    // Actualización optimista inmediata en la UI
    const updated = [...categoriesList];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    const reorderedWithOrder = updated.map((c, i) => ({ ...c, order: i + 1 }));
    
    setCategoriesList(reorderedWithOrder);
    setReorderingCatId(categoryId);

    try {
      const res = await moveCategoryOrderAction(categoryId, direction);
      if (res && "error" in res && res.error) {
        alert(res.error);
        setCategoriesList([...(restaurant.categories || [])].sort((a, b) => a.order - b.order));
      }
    } catch (err) {
      console.error("Error al mover categoría:", err);
      setCategoriesList([...(restaurant.categories || [])].sort((a, b) => a.order - b.order));
    } finally {
      setReorderingCatId(null);
    }
  };

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOrder, setNewCatOrder] = useState("0");
  const [newCatAspect, setNewCatAspect] = useState<string>("DEFAULT");

  // States for Dish Dialogs
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [isBatchDishModalOpen, setIsBatchDishModalOpen] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("0");
  const [dishCatId, setDishCatId] = useState("");
  const [dishAvailable, setDishAvailable] = useState(true);
  const [dishImageUrl, setDishImageUrl] = useState("");
  const [dishImageUrl1, setDishImageUrl1] = useState("");
  const [dishImageUrl2, setDishImageUrl2] = useState("");
  const [dishImageUrl3, setDishImageUrl3] = useState("");
  const [dishImage1Error, setDishImage1Error] = useState(false);
  const [dishImage2Error, setDishImage2Error] = useState(false);
  const [dishImage3Error, setDishImage3Error] = useState(false);
  const [dishImageSlotTab, setDishImageSlotTab] = useState<0 | 1 | 2>(0);
  const [dishSuggested, setDishSuggested] = useState(false);
  const [dishTrackStock, setDishTrackStock] = useState(false);
  const [dishStock, setDishStock] = useState("10");
  const [dishMinStock, setDishMinStock] = useState("3");
  const [dishCostPrice, setDishCostPrice] = useState("0");
  const [dishSupplierId, setDishSupplierId] = useState("");
  const [dishBarcode, setDishBarcode] = useState("");
  const [dishBeds, setDishBeds] = useState("");
  const [dishMaxGuests, setDishMaxGuests] = useState("");
  const [dishHasVariants, setDishHasVariants] = useState(false);
  const [dishAttr1Name, setDishAttr1Name] = useState("Presentación");
  const [dishAttr1Options, setDishAttr1Options] = useState("");
  const [dishAttr2Name, setDishAttr2Name] = useState("");
  const [dishAttr2Options, setDishAttr2Options] = useState("");
  const [dishStockFilter, setDishStockFilter] = useState<"ALL" | "TRACKED" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");

  const allDishesList = useMemo(() => categoriesList.flatMap((c) => c.dishes), [categoriesList]);
  const trackedDishesCount = useMemo(() => allDishesList.filter((d) => d.trackStock).length, [allDishesList]);
  const lowStockDishesCount = useMemo(
    () => allDishesList.filter((d) => Boolean(d.trackStock) && (d.stock ?? 0) <= (d.minStock ?? 0) && (d.stock ?? 0) > 0).length,
    [allDishesList]
  );
  const outOfStockDishesCount = useMemo(
    () => allDishesList.filter((d) => !d.isAvailable || (Boolean(d.trackStock) && (d.stock ?? 0) <= 0)).length,
    [allDishesList]
  );
  const totalStockUnits = useMemo(
    () => allDishesList.filter((d) => d.trackStock).reduce((acc, d) => acc + (d.stock ?? 0), 0),
    [allDishesList]
  );
  const totalInventoryRetailValue = useMemo(
    () => allDishesList.filter((d) => d.trackStock).reduce((acc, d) => acc + ((d.stock ?? 0) * (d.price || 0)), 0),
    [allDishesList]
  );
  const totalInventoryCostValue = useMemo(
    () => allDishesList.filter((d) => d.trackStock).reduce((acc, d) => acc + ((d.stock ?? 0) * ((d.costPrice as any) || 0)), 0),
    [allDishesList]
  );

  // States for Season Rate Dialogs
  const [editingSeasonRate, setEditingSeasonRate] = useState<SeasonRate | null>(null);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [seasonStartDate, setSeasonStartDate] = useState("");
  const [seasonEndDate, setSeasonEndDate] = useState("");
  const [seasonPercentageBonus, setSeasonPercentageBonus] = useState("0");
  const [seasonFixedBonus, setSeasonFixedBonus] = useState("0");
  const [seasonIsHoliday, setSeasonIsHoliday] = useState(false);

  const publicUrl = isMounted && typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : `/${restaurant.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tablesList = useMemo(() => {
    if (!tablesConfig) return ["1", "2", "3", "4", "5"];
    const list = tablesConfig.split(",").map((t) => t.trim()).filter(Boolean);
    return list.length > 0 ? list : ["1", "2", "3", "4", "5"];
  }, [tablesConfig]);

  const activeTableForQr = selectedQrTable && tablesList.includes(selectedQrTable)
    ? selectedQrTable
    : tablesList[0] || "1";

  const activeTableQrUrl = useMemo(() => {
    const origin = isMounted && typeof window !== "undefined" ? window.location.origin : "";
    return buildTableQrUrl(origin, restaurant.slug, activeTableForQr, restaurant.id);
  }, [isMounted, restaurant.slug, activeTableForQr, restaurant.id]);

  const handleCopyTableLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedTableLink(true);
    setTimeout(() => setCopiedTableLink(false), 2000);
  };

  const downloadTableQR = (tableName: string) => {
    const qrCanvas = document.getElementById(`qr-canvas-table-${tableName}`) as HTMLCanvasElement;
    if (!qrCanvas) return;

    const posterCanvas = document.createElement("canvas");
    posterCanvas.width = 400;
    posterCanvas.height = 620;
    const ctx = posterCanvas.getContext("2d");
    if (!ctx) return;

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 620);

    // Barra superior decorativa
    ctx.fillStyle = restaurant.themeColor || "#0f172a";
    ctx.fillRect(0, 0, 400, 10);

    // Encabezado
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("MENÚ DIGITAL • PEDIDO EN MESA", 200, 45);

    ctx.font = "black 22px sans-serif";
    ctx.fillStyle = restaurant.themeColor || "#0f172a";
    ctx.fillText(restaurant.name, 200, 75);

    // Badge de Mesa
    ctx.fillStyle = "#f1f5f9";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(110, 92, 180, 38, 10);
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillRect(110, 92, 180, 38);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`MESA #${tableName}`, 200, 117);

    // Dibujar Código QR de la mesa
    ctx.drawImage(qrCanvas, 75, 145, 250, 250);

    // Tarjeta informativa inferior
    ctx.fillStyle = "#f8fafc";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(35, 410, 330, 130, 12);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillRect(35, 410, 330, 130);
    }

    ctx.fillStyle = "#059669";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("🛡️ MESA VERIFICADA • QR ANTI-SPOOFING", 200, 435);

    ctx.fillStyle = "#334155";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("1. Escanea este código con tu cámara", 200, 462);
    ctx.fillText("2. Elige tus platos y envía tu comanda", 200, 484);
    ctx.fillText("3. Llama al mesero o pide la cuenta desde tu mesa", 200, 506);

    // Pie
    ctx.font = "normal 10px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Desarrollado con MenuQR Pro", 200, 580);

    // Descarga
    try {
      const pngUrl = posterCanvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR-Mesa-${tableName}-${restaurant.slug}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.error("Error al descargar póster de mesa:", e);
    }
  };

  const handleToggleDish = async (dishId: string, currentStatus: boolean) => {
    const res = await toggleDishAvailabilityAction(dishId, !currentStatus);
    if (res && 'error' in res && res.error) {
      alert(res.error);
    } else {
      window.location.reload();
    }
  };

  const handleQuickUpdateStock = async (dishId: string, newStock: number) => {
    const res = await quickUpdateDishStockAction(dishId, newStock);
    if (res && 'error' in res && res.error) {
      alert(res.error);
    } else {
      window.location.reload();
    }
  };


  const handleToggleDelivery = (enabled: boolean) => {
    setEnableDeliveryState(enabled);
    setDeliveryEnabled(enabled);
  };

  const handleToggleTableOrdering = (nextState: boolean) => {
    setEnableTableOrdering(nextState);
    if (nextState) {
      setDisabledModules(prev => prev.filter(m => m !== "tables" && m !== "gastro"));
      setEnabledModules(prev => [...new Set([...prev, "tables"])]);
    } else {
      setDisabledModules(prev => [...new Set([...prev, "tables", "gastro"])]);
      setEnabledModules(prev => prev.filter(m => m !== "tables" && m !== "gastro"));
    }
  };

  const handleSaveTables = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTables(true);
    setTablesMessage("");
    const res = await updateRestaurantTablesAction(restaurant.id, tablesConfig);
    setSavingTables(false);
    if (res.error) {
      setTablesMessage(`Error: ${res.error}`);
    } else {
      setTablesMessage("Configuración de mesas guardada correctamente.");
      setTimeout(() => setTablesMessage(""), 3000);
    }
  };

  const handleSaveCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCharges(true);
    setChargesMessage("");
    setEnableDeliveryState(deliveryEnabled);
    const res = await updateRestaurantChargesConfigAction(restaurant.id, {
      ivaPercent,
      servicePercent,
      deliveryCost,
      deliveryEnabled,
      deliveryRates: JSON.stringify(kmRates),
      ivaOnTable,
      ivaOnTakeout,
      serviceOnTable,
      serviceOnTakeout,
    });
    setSavingCharges(false);
    if (res.error) {
      setChargesMessage(`Error: ${res.error}`);
    } else {
      setChargesMessage("Configuración de recargos y tarifas por KM guardada correctamente.");
      setTimeout(() => setChargesMessage(""), 3000);
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SmartLogo
                src={restaurant.logoUrl}
                alt={restaurant.name}
                name={restaurant.name}
                className="h-10 w-10 rounded-xl object-cover border border-slate-700"
              />
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white line-clamp-1">{restaurant.name}</h1>
                <p className="text-xs text-slate-400">Panel Admin</p>
              </div>
            </div>

            {/* Mobile compact header actions */}
            <div className="flex items-center gap-2 md:hidden">
              <a
                href={
                  isLodging
                    ? `/reservas/${restaurant.slug}`
                    : isServiciosTecnicos
                    ? `/servicios/${restaurant.slug}`
                    : (restaurant as any).businessType === "SERVICES"
                    ? `/citas/${restaurant.slug}`
                    : (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG"
                    ? `/ctalo/${restaurant.slug}`
                    : `/${restaurant.slug}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-all"
                title={
                  isLodging
                    ? "Ver Motor de Reservas"
                    : isServiciosTecnicos
                    ? "Ver Cotizador Express"
                    : (restaurant as any).businessType === "SERVICES"
                    ? "Ver Agenda Online"
                    : (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG"
                    ? "Ver Catálogo Online"
                    : "Ver Menú Público"
                }
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <form action={logoutUserAction}>
                <button
                  type="submit"
                  className="p-2 bg-red-950/40 text-red-400 hover:bg-red-900/30 border border-red-900/40 rounded-xl transition-all"
                  title="Cerrar Sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:block p-4 space-y-1">
            <button
              onClick={() => setActiveTab("metrics")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "metrics" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <LineChart className="h-4 w-4" />
              Métricas y Pedidos
            </button>
            <button
              onClick={() => setActiveTab("restaurant")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "restaurant" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Store className="h-4 w-4" />
              {bLabels.businessTabTitle}
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "categories" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FolderHeart className="h-4 w-4" />
              {bLabels.categories}
            </button>
            <button
              onClick={() => setActiveTab("dishes")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "dishes" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Soup className="h-4 w-4" />
              <span>{bLabels.isGastro ? bLabels.items : `${bLabels.items} & Stock`}</span>
            </button>
            {bLabels.showInventory && (
              <button
                onClick={() => setActiveTab("inventory")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "inventory" 
                    ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Boxes className="h-4 w-4 text-amber-400" />
                <span>{bLabels.inventoryTabTitle}</span>
              </button>
            )}

            {/* Caja POS Scanner Quick Access */}
            {bLabels.showCajaPos && (
              <Link
                href="/caja"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 bg-gradient-to-r from-emerald-600/15 to-teal-600/15 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-600/25 shadow-sm"
                title="Abrir Caja POS móvil para escaneo de código de barras"
              >
                <div className="flex items-center gap-3">
                  <Barcode className="h-4 w-4 text-emerald-400" />
                  <span>Caja POS (Escanear)</span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  POS
                </span>
              </Link>
            )}
            {bLabels.showSeasons && (
              <button
                onClick={() => setActiveTab("seasons")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "seasons" 
                    ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <CalendarDays className="h-4 w-4 text-amber-400" />
                Tarifas y Temporadas
              </button>
            )}
            {bLabels.showCoupons && (
              <button
                onClick={() => setActiveTab("coupons")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "coupons" 
                    ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Tag className="h-4 w-4 text-amber-400" />
                Cupones de Descuento
              </button>
            )}
            {bLabels.showRuleta && (
              <button
                onClick={() => setActiveTab("ruleta")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "ruleta" 
                    ? "bg-gradient-to-r from-amber-600/20 to-red-500/20 text-amber-400 border-l-4 border-amber-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Gift className="h-4 w-4 text-amber-400" />
                <span>🎡 Ruleta de Premios</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "campaigns" 
                  ? "bg-gradient-to-r from-rose-600/20 to-amber-500/20 text-rose-400 border-l-4 border-rose-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Flame className="h-4 w-4 text-rose-400" />
              <span>Promos & Eventos</span>
            </button>
            <button
              onClick={() => setActiveTab("qr")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "qr" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <QrCode className="h-4 w-4" />
              Código QR
            </button>
 
            {restaurant.whatsappBotEnabled && (
              <button
                onClick={() => setActiveTab("whatsapp")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "whatsapp" 
                    ? "bg-gradient-to-r from-emerald-600/20 to-teal-500/20 text-emerald-400 border-l-4 border-emerald-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Smartphone className="h-4 w-4 text-emerald-400" />
                Conectar WhatsApp
              </button>
            )}
            
            <button
              onClick={() => setActiveTab("orders")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "orders" 
                  ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Historial de Pedidos
            </button>
            {bLabels.showSplitBill && (
              <button
                onClick={() => setActiveTab("split-bill")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "split-bill" 
                    ? "bg-gradient-to-r from-amber-600/20 to-red-500/20 text-amber-400 border-l-4 border-amber-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Utensils className="h-4 w-4 text-amber-400" />
                <span>Dividir Cuenta en Mesa</span>
              </button>
            )}

            {/* Equipo & Accesos (PIN Meseros & Cocina) - Restaurantes / Cafeterías / Gastro */}
            {(bLabels.isGastro || selectedPreset === "RESTAURANT" || enableTableOrdering) && (
              <button
                onClick={() => setActiveTab("staff")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "staff"
                    ? "bg-gradient-to-r from-amber-600/20 to-red-500/20 text-amber-400 border-l-4 border-amber-500 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span>Equipo y Accesos (PIN)</span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PIN
                </span>
              </button>
            )}
            {bLabels.showCrm && (
              <button
                onClick={() => setActiveTab("crm")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "crm" 
                    ? "bg-gradient-to-r from-red-600/10 to-amber-500/10 text-red-400 border-l-4 border-red-500" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>CRM Clientes</span>
                </div>
                {restaurant.customers && restaurant.customers.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    {restaurant.customers.length}
                  </span>
                )}
              </button>
            )}

            {/* Reservas & Hospedaje CRM (para Cabañas / Glamping / Hoteles) */}
            {isLodging && (
              <button
                onClick={() => setActiveTab("reservas")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "reservas" 
                    ? "bg-gradient-to-r from-emerald-600/20 to-teal-500/20 text-emerald-300 border-l-4 border-emerald-500 shadow-md shadow-emerald-600/10" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Trees className="h-4 w-4 text-emerald-400" />
                  <span>Reservas & Hospedaje CRM</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Check-In
                </span>
              </button>
            )}

            {/* Citas & Turnos CRM (para Citas / Consultorios que NO son Hospedaje ni Servicios Técnicos) */}
            {!isLodging && !isServiciosTecnicos && (restaurant as any).businessType === "SERVICES" && (
              <button
                onClick={() => setActiveTab("citas")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "citas" 
                    ? "bg-gradient-to-r from-purple-600/20 to-indigo-500/20 text-purple-300 border-l-4 border-purple-500 shadow-md shadow-purple-600/10" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-purple-400" />
                  <span>Citas & Agenda CRM</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  1-Click WA
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("subscription")}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "subscription" 
                  ? "bg-gradient-to-r from-amber-600/20 to-red-500/20 text-amber-400 border-l-4 border-amber-500" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Crown className="h-4 w-4 text-amber-400" />
                <span>Suscripción</span>
              </div>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                $15/mes
              </span>
            </button>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="hidden md:block p-4 border-t border-slate-800">
          <a
            href={
              isLodging
                ? `/reservas/${restaurant.slug}`
                : isServiciosTecnicos
                ? `/servicios/${restaurant.slug}`
                : (restaurant as any).businessType === "SERVICES"
                ? `/citas/${restaurant.slug}`
                : (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG"
                ? `/ctalo/${restaurant.slug}`
                : `/${restaurant.slug}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl text-xs font-bold border transition-all shadow-md ${
              isLodging
                ? "bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-emerald-500/30 text-emerald-300 hover:text-white hover:bg-emerald-600/30"
                : isServiciosTecnicos
                ? "bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-600/30"
                : (restaurant as any).businessType === "SERVICES"
                ? "bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-600/30"
                : (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG"
                ? "bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border-amber-500/30 text-amber-300 hover:text-white hover:bg-amber-600/30"
                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
          >
            { isLodging
              ? "Ver Motor de Reservas"
              : isServiciosTecnicos
              ? "Ver Cotizador Express"
              : (restaurant as any).businessType === "SERVICES"
              ? "Ver Agenda Online"
              : (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG"
              ? "Ver Catálogo Online"
              : "Ver Menú Público" }
            <ExternalLink className="h-3 w-3" />
          </a>
          <form action={logoutUserAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-red-950/40 text-red-400 hover:bg-red-900/30 border border-red-900/40 transition-all"
            >
              <LogOut className="h-4.5 w-4.5" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Layout Container (Full Width) */}
      <div className="flex-1 min-w-0 overflow-y-auto pb-28 md:pb-0">
        {/* Main Content Area */}
        <main className="w-full max-w-7xl mx-auto p-6 pb-28 md:p-10 space-y-6">
        {/* Comunicado Global In-App emitido por SuperAdmin */}
        {globalAnnouncement?.active && !dismissedAnnouncement && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 text-xs sm:text-sm shadow-xl transition-all animate-fadeIn ${
              globalAnnouncement.type === "success"
                ? "bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border-emerald-500/40 text-emerald-200"
                : globalAnnouncement.type === "warning"
                ? "bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-amber-500/40 text-amber-200"
                : globalAnnouncement.type === "promo"
                ? "bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border-purple-500/40 text-purple-200"
                : "bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border-blue-500/40 text-blue-200"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 rounded-xl bg-white/10 shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </span>
              <div className="min-w-0">
                <div className="font-extrabold flex items-center gap-2">
                  <span className="uppercase text-[9.5px] tracking-wider px-2 py-0.5 rounded-full bg-white/10 font-black">
                    Aviso Oficial de la Plataforma
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-white leading-relaxed">
                  {globalAnnouncement.text}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {globalAnnouncement.link && (
                <a
                  href={globalAnnouncement.link}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition"
                >
                  Conocer más ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setDismissedAnnouncement(true)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
                title="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Subscription / Plan Banner */}
        {(() => {
          const trialEnds = currentTrialEndsAt;
          const now = new Date();
          const isExpired = trialEnds < now;
          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const isPaidPlan = currentPlan === "PRO" || currentPlan === "ELITE";
          const isPlanActive = isPaidPlan && !isExpired;

          return (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm ${
              isPlanActive
                ? currentPlan === "ELITE"
                  ? "bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border-amber-500/40 text-amber-300"
                  : "bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/30 text-emerald-300"
                : isExpired 
                  ? "bg-red-500/10 border-red-500/30 text-red-400" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  isPlanActive 
                    ? currentPlan === "ELITE"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                    : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                }`}>
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {isPlanActive 
                        ? currentPlan === "ELITE"
                          ? "⭐ Plan Elite Activo ($20 USD/mes)"
                          : "Plan Pro Activo ($15 USD/mes)"
                        : isExpired 
                        ? "Suscripción Vencida" 
                        : "Prueba Gratuita (30 Días)"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-950/60 border border-current">
                      {isPlanActive ? currentPlan : isPaidPlan ? "VENCIDO" : `${daysRemaining}d restantes`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isPlanActive
                      ? `Vencimiento: ${trialEnds.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : isExpired 
                        ? "Tu prueba ha finalizado. Activa tu plan desde $15 USD/mes para continuar." 
                        : `Vence el ${trialEnds.toLocaleDateString()}. Suscríbete al Plan Digital Pro ($15/mes) o Plan Puesta en Marcha ($20/mes).`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPlanPrice(15);
                  setShowPaymentModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/10 transition-all shrink-0 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {isPlanActive ? "Renovar Suscripción" : "Activar Plan"}
              </button>
            </div>
          );
        })()}

        {/* Métricas y Pedidos Tab */}
        {activeTab === "metrics" && (() => {
          const allOrders = restaurant.orders || [];
          const filteredOrders = allOrders.filter(o => {
            if (metricViewMode === "REAL") return !(o as any).isTest;
            if (metricViewMode === "TEST") return Boolean((o as any).isTest);
            return true;
          });
          const nonCancelled = filteredOrders.filter(o => o.status !== "CANCELLED");
          
          const today = new Date().toDateString();
          const todayOrders = nonCancelled.filter(o => new Date(o.createdAt).toDateString() === today);
          const todayBilling = todayOrders.reduce((sum, o) => sum + o.total, 0);

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const weekOrders = nonCancelled.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
          const weekBilling = weekOrders.reduce((sum, o) => sum + o.total, 0);

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const monthOrders = nonCancelled.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
          const monthBilling = monthOrders.reduce((sum, o) => sum + o.total, 0);

          // Most sold dish
          const itemsMap: { [key: string]: number } = {};
          nonCancelled.forEach(o => {
            o.items.forEach(it => {
              itemsMap[it.dishName] = (itemsMap[it.dishName] || 0) + it.quantity;
            });
          });
          let topDishName = "Ninguno";
          let topDishQty = 0;
          Object.entries(itemsMap).forEach(([name, qty]) => {
            if (qty > topDishQty) {
              topDishQty = qty;
              topDishName = name;
            }
          });

          // Most selling table
          const tablesMap: { [key: string]: number } = {};
          nonCancelled.forEach(o => {
            tablesMap[o.tableName] = (tablesMap[o.tableName] || 0) + o.total;
          });
          let topTableName = "Ninguna";
          let topTableTotal = 0;
          Object.entries(tablesMap).forEach(([name, tot]) => {
            if (tot > topTableTotal) {
              topTableTotal = tot;
              topTableName = name;
            }
          });

          const pendingOrders = filteredOrders.filter(o => o.status === "PENDING" || o.status === "PREPARING");

          // Active Visit Stats based on metricViewMode
          const activeVisitStats = (() => {
            if (metricViewMode === "REAL") return visitStatsReal || { total: 0, today: 0, week: 0, month: 0 };
            if (metricViewMode === "TEST") return visitStatsTest || { total: 0, today: 0, week: 0, month: 0 };
            return {
              total: (visitStatsReal?.total || 0) + (visitStatsTest?.total || 0),
              today: (visitStatsReal?.today || 0) + (visitStatsTest?.today || 0),
              week: (visitStatsReal?.week || 0) + (visitStatsTest?.week || 0),
              month: (visitStatsReal?.month || 0) + (visitStatsTest?.month || 0),
            };
          })();

          const testOrdersCount = allOrders.filter(o => (o as any).isTest).length;
          const realOrdersCount = allOrders.filter(o => !(o as any).isTest).length;
          const testVisitsCount = visitStatsTest?.total || 0;
          const realVisitsCount = visitStatsReal?.total || 0;

          return (
            <div className="space-y-8 animate-fade-in" style={{ fontFamily: 'var(--font-outfit)' }}>
              {/* Notificaciones de éxito de Purga o Exportación */}
              {purgeSuccessBanner && (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{purgeSuccessBanner}</span>
                  </div>
                  <button onClick={() => setPurgeSuccessBanner("")} className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1">✕</button>
                </div>
              )}

              {exportSuccessMsg && (
                <div className="p-4 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm rounded-2xl flex items-center gap-2.5 shadow-lg">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              {/* Master Banner: Modo Pruebas (Sandbox) vs Modo Real (Producción) */}
              <div className={`rounded-2xl p-6 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
                isTestMode
                  ? "bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-slate-900 border-amber-500/40 shadow-amber-950/20"
                  : "bg-gradient-to-br from-emerald-950/40 via-teal-950/20 to-slate-900 border-emerald-500/30 shadow-emerald-950/20"
              }`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isTestMode
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/20"
                        : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/20"
                    }`}>
                      {isTestMode ? <FlaskConical className="h-6 w-6 animate-pulse" /> : <Sparkles className="h-6 w-6" />}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-black text-white">
                          {isTestMode ? "🧪 Entorno de Pruebas (Modo Sandbox)" : "🚀 Entorno Real (Producción en Vivo)"}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isTestMode
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        }`}>
                          {isTestMode ? "Modo Pruebas Activo" : "Producción Activa"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        {isTestMode
                          ? "Los pedidos y comandas generados en el Menú QR, Mesas y Cocina se marcan como pruebas. Practica y capacita a tu equipo con libertad sin alterar la contabilidad real de tu negocio."
                          : "Tu restaurante está operando en la vida real. Todo pedido generado refleja ventas auténticas y clientes reales en el negocio."}
                      </p>
                      {isTestMode && (
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-amber-300/90 font-medium flex-wrap">
                          <span>📦 <strong>{testOrdersCount}</strong> pedidos de prueba registrados</span>
                          <span>•</span>
                          <span suppressHydrationWarning>👁️ <strong suppressHydrationWarning>{testVisitsCount.toLocaleString()}</strong> visitas en pruebas</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Switch Mode Button */}
                    <button
                      onClick={handleToggleTestMode}
                      disabled={isTogglingMode}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 ${
                        isTestMode
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 font-extrabold"
                          : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {isTogglingMode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isTestMode ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Pasar a Vida Real (Producción)
                        </>
                      ) : (
                        <>
                          <FlaskConical className="w-4 h-4" />
                          Activar Modo Pruebas
                        </>
                      )}
                    </button>

                    {/* Purge Test Data Button (Only when test orders or test visits exist) */}
                    {isTestMode && (testOrdersCount > 0 || testVisitsCount > 0) && (
                      <button
                        onClick={() => setShowPurgeModal(true)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 flex items-center gap-2 shadow-lg shadow-rose-950/20"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        Vaciar Datos de Prueba
                      </button>
                    )}

                    {/* Excel Export Button */}
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 shadow-lg"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Descargar Respaldo Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Metrics Header with Filter Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Dashboard de Métricas</h2>
                  <p className="text-slate-400 text-sm">
                    Resumen de facturación, visitas al negocio, {bLabels.items.toLowerCase()} estrella y {bLabels.isGastro ? "mesas de mayor consumo" : "canales principales de solicitud"}.
                  </p>
                </div>

                {/* Filter Segmented Control */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0">
                  <button
                    onClick={() => setMetricViewMode("REAL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      metricViewMode === "REAL"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Métricas Reales ({realOrdersCount})
                  </button>
                  <button
                    onClick={() => setMetricViewMode("TEST")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      metricViewMode === "TEST"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Pruebas ({testOrdersCount})
                  </button>
                  <button
                    onClick={() => setMetricViewMode("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      metricViewMode === "ALL"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span>Todas ({allOrders.length})</span>
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Facturación Diaria</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      metricViewMode === "REAL" ? "bg-emerald-500/10 text-emerald-400" : metricViewMode === "TEST" ? "bg-amber-500/10 text-amber-400" : "bg-cyan-500/10 text-cyan-400"
                    }`}>
                      {metricViewMode === "REAL" ? "REAL" : metricViewMode === "TEST" ? "PRUEBA" : "TODAS"}
                    </span>
                  </div>
                  <p className="text-2xl font-black text-white mt-1">${todayBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">{todayOrders.length} pedidos hoy</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Facturación Semanal</span>
                  <p className="text-2xl font-black text-white mt-1">${weekBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">Últimos 7 días</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Facturación Mensual</span>
                  <p className="text-2xl font-black text-white mt-1">${monthBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">Últimos 30 días</span>
                </div>
              </div>

              {/* Contador de Visitas al Negocio */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center shrink-0">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-white">Contador de Visitas al Negocio</h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          En Vivo
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          metricViewMode === "REAL" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : metricViewMode === "TEST" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        }`}>
                          {metricViewMode === "REAL" ? "Visitas Reales" : metricViewMode === "TEST" ? "Visitas Pruebas" : "Total Visitas"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tráfico de clientes que consultan la carta digital y escanean el código QR.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 shrink-0">
                    <span className="text-xs text-slate-400 uppercase font-bold">Total Histórico:</span>
                    <span suppressHydrationWarning className="text-lg font-black text-cyan-400">
                      {(activeVisitStats?.total || 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500">visitas</span>
                  </div>
                </div>

                {/* Visit Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Visitas Hoy</span>
                      <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Eye className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p suppressHydrationWarning className="text-2xl font-black text-white mt-1.5">{(activeVisitStats?.today || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Visitantes hoy en el menú</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Visitas Semanales</span>
                      <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <Globe className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p suppressHydrationWarning className="text-2xl font-black text-white mt-1.5">{(activeVisitStats?.week || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Últimos 7 días</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Visitas Mensuales</span>
                      <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p suppressHydrationWarning className="text-2xl font-black text-white mt-1.5">{(activeVisitStats?.month || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Últimos 30 días</span>
                  </div>
                </div>

                {/* Conversion Insight if data available */}
                {(activeVisitStats?.today || 0) > 0 && todayOrders.length > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300">
                    <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Tasa de conversión de hoy:</strong> {(((todayOrders.length) / (activeVisitStats?.today || 1)) * 100).toFixed(1)}% de las visitas de hoy se convirtieron en pedidos ({todayOrders.length} pedidos / {activeVisitStats?.today} visitas).
                    </span>
                  </div>
                )}
              </div>


              {/* Best Performers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                  <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">{bLabels.topItemTitle}</span>
                    <span className="text-sm font-bold text-white">{topDishName}</span>
                    {topDishQty > 0 && <span className="text-[10px] text-slate-500 block mt-0.5">{topDishQty} {bLabels.stockUnitPlural} vendidas</span>}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    bLabels.isGastro 
                      ? "bg-red-500/10 text-red-500" 
                      : lowStockDishesCount > 0 
                        ? "bg-amber-500/10 text-amber-400" 
                        : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {bLabels.isGastro ? (
                      <Users className="h-5 w-5" />
                    ) : lowStockDishesCount > 0 ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">
                      {bLabels.isGastro ? bLabels.topChannelTitle : "Salud de Inventario / Bodega"}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {bLabels.isGastro ? (
                        topTableName !== "Ninguna" && topTableName !== "Llevar" && topTableName !== "Domicilio" 
                          ? `Mesa #${topTableName}` 
                          : topTableName === "Llevar" 
                            ? "Para llevar" 
                            : topTableName === "Domicilio" 
                              ? "Domicilio" 
                              : "Ninguna"
                      ) : (
                        lowStockDishesCount > 0 
                          ? `⚠️ ${lowStockDishesCount} en Stock Crítico`
                          : `✅ ${totalStockUnits} ${bLabels.stockUnitPlural} disponibles`
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {bLabels.isGastro 
                        ? (topTableTotal > 0 ? `$${topTableTotal.toFixed(2)} facturados` : "Sin pedidos registrados")
                        : (topTableName !== "Ninguna" ? `Canal principal: ${topTableName} ($${topTableTotal.toFixed(2)})` : `${outOfStockDishesCount} agotados`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Widget de Métricas de Inventario y Almacén (Opción 2) */}
              {(!bLabels.isGastro || trackedDishesCount > 0) && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{bLabels.stockSectionTitle}</h4>
                        <p className="text-[11px] text-slate-400">Control de existencias, reposición y valorización del catálogo.</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded-full self-start sm:self-auto">
                      {trackedDishesCount} {bLabels.items.toLowerCase()} con stock monitoreado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Existencias Totales</span>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">{totalStockUnits} {bLabels.stockUnitPlural}</p>
                      <span className="text-[10px] text-slate-500 block">disponibles ahora</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Stock Crítico</span>
                      <p className={`text-lg font-black mt-0.5 ${lowStockDishesCount > 0 ? "text-amber-400" : "text-slate-400"}`}>
                        {lowStockDishesCount} {bLabels.items.toLowerCase()}
                      </p>
                      <span className="text-[10px] text-slate-500 block">por debajo del mínimo</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Agotados / Quiebre</span>
                      <p className={`text-lg font-black mt-0.5 ${outOfStockDishesCount > 0 ? "text-rose-400" : "text-slate-400"}`}>
                        {outOfStockDishesCount} {bLabels.items.toLowerCase()}
                      </p>
                      <span className="text-[10px] text-slate-500 block">stock en 0 o inactivos</span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Valor de Bodega</span>
                      <p className="text-lg font-black text-cyan-400 mt-0.5">
                        ${totalInventoryRetailValue.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-slate-500 block">
                        {totalInventoryCostValue > 0 ? `Costo: $${totalInventoryCostValue.toFixed(2)}` : "A precio de venta"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SEO & GEO Health Score Checklist */}
              {(() => {
                const checks = [
                  { label: "Slug amigable configurado", ok: !!restaurant.slug },
                  { label: `Nombre del ${bLabels.businessTabTitle.toLowerCase() || "negocio"}`, ok: !!restaurant.name },
                  { label: "Descripción / Sobre Nosotros", ok: !!restaurant.description },
                  { label: "Logo del negocio", ok: !!restaurant.logoUrl },
                  { label: "Imagen de portada (Cover)", ok: !!restaurant.coverUrl },
                  { label: "Dirección física exacta", ok: !!restaurant.address },
                  { label: "Ciudad / Cantón / Localidad", ok: !!(restaurant.city || restaurant.locality) },
                  { label: "Provincia registrada", ok: !!restaurant.province },
                  { label: `Número de WhatsApp para ${bLabels.kitchen.toLowerCase()}`, ok: !!restaurant.whatsapp },
                  { label: "Horario de atención", ok: !!restaurant.schedule },
                  { label: `${bLabels.categories} registradas`, ok: (restaurant.categories || []).length > 0 },
                  { label: `${bLabels.items} registrados en el catálogo`, ok: (restaurant.categories || []).some((c: any) => (c.dishes || []).length > 0) },
                ];
                const completedCount = checks.filter((c) => c.ok).length;
                const seoScore = Math.round((completedCount / checks.length) * 100);

                return (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-amber-400" />
                          Estado de Salud SEO, GEO & AEO (Indexabilidad Google & IA)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Evaluación automática de preparación para buscadores locales, ChatGPT, Gemini y Perplexity.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 shrink-0">
                        <span className="text-xs text-slate-400 uppercase font-bold">Puntuación:</span>
                        <span className={`text-xl font-black ${seoScore >= 80 ? "text-emerald-400" : seoScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {seoScore}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {checks.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                          {item.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                          <span className={item.ok ? "text-slate-200" : "text-slate-400"}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Negocio Tab */}
        {activeTab === "restaurant" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Configuración del {bLabels.businessTabTitle}</h2>
              <p className="text-slate-400 text-sm">Edita la información de tu marca, colores del tema, recargos y WhatsApp para {bLabels.kitchen.toLowerCase()}.</p>
            </div>

            {/* Charge Surcharge Configuration Form */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4 backdrop-blur-md">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-red-500" />
                  Configuración de IVA y 10% de Servicio (Recargos)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Controla qué cargos extras se aplican y bajo qué modalidad de pedido (Para llevar / Mesa).
                </p>
              </div>
              <form onSubmit={handleSaveCharges} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tasa de IVA (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ivaPercent}
                      onChange={(e) => setIvaPercent(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tasa de Servicio (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={servicePercent}
                      onChange={(e) => setServicePercent(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Envío a Domicilio ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={deliveryCost}
                      onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                    />
                  </div>
                </div>

                {/* Checkbox matrix */}
                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  <span className="text-xs font-bold text-slate-350 block">Reglas de Aplicación:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none col-span-1 sm:col-span-2 border-b border-slate-800/50 pb-2 mb-1">
                      <input
                        type="checkbox"
                        checked={deliveryEnabled}
                        onChange={(e) => handleToggleDelivery(e.target.checked)}
                        className="h-4.5 w-4.5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span className="font-bold text-white">Activar Envío a Domicilio</span>
                    </label>

                    {/* Tarifas de Envío por Distancia (por KM) */}
                    {deliveryEnabled && (
                      <div className="col-span-1 sm:col-span-2 bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 my-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2">
                          <div>
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Truck className="h-4 w-4 text-amber-400" />
                              Tarifas de Envío por Distancia (por KM)
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Personaliza el precio de envío según la distancia en kilómetros desde tu local al cliente.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setKmRates(prev => [
                                ...prev,
                                { id: `km-${Date.now()}`, label: `De ${prev.length * 5} a ${(prev.length + 1) * 5} KM`, price: 3.50, minOrder: 0 }
                              ]);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs font-bold transition border border-white/5 active:scale-95 shrink-0 self-start sm:self-auto"
                          >
                            + Añadir Rango de KM
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {kmRates.map((item, index) => (
                            <div key={item.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setKmRates(prev => prev.map((r, i) => i === index ? { ...r, label: val } : r));
                                  }}
                                  placeholder="ej. Hasta 2 KM"
                                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-red-500 px-3 py-1.5 rounded-lg text-xs font-bold text-white focus:outline-none"
                                />
                                {kmRates.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setKmRates(prev => prev.filter((_, i) => i !== index));
                                    }}
                                    className="p-1 text-slate-500 hover:text-red-400 transition shrink-0"
                                    title="Eliminar rango"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Precio Envío</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-slate-400">$</span>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min="0"
                                      value={item.price}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setKmRates(prev => prev.map((r, i) => i === index ? { ...r, price: val } : r));
                                      }}
                                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-2 py-1 rounded-lg text-xs font-black text-white focus:outline-none text-right"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-amber-400/90 uppercase block mb-0.5">Mín. Compra</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-slate-400">$</span>
                                    <input
                                      type="number"
                                      step="0.50"
                                      min="0"
                                      value={item.minOrder || 0}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setKmRates(prev => prev.map((r, i) => i === index ? { ...r, minOrder: val } : r));
                                      }}
                                      placeholder="0.00"
                                      className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 px-2 py-1 rounded-lg text-xs font-black text-amber-300 focus:outline-none text-right"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="col-span-1 sm:col-span-2 border-t border-slate-800/80 pt-4 space-y-4">
                      <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Modo de Aplicación de IVA:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-950/60 cursor-pointer select-none border-slate-800 hover:border-slate-700">
                          <input
                            type="radio"
                            name="ivaMode"
                            checked={!ivaOnTable}
                            onChange={() => {
                              setIvaOnTable(false);
                              setIvaOnTakeout(false);
                            }}
                            className="h-4 w-4 mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">IVA Adicional</span>
                            <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">Se suma el porcentaje de IVA al subtotal al finalizar la compra.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-950/60 cursor-pointer select-none border-slate-800 hover:border-slate-700">
                          <input
                            type="radio"
                            name="ivaMode"
                            checked={ivaOnTable}
                            onChange={() => {
                              setIvaOnTable(true);
                              setIvaOnTakeout(true);
                            }}
                            className="h-4 w-4 mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">IVA Incluido en el precio</span>
                            <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">Los precios publicados de los productos ya contienen IVA.</span>
                          </div>
                        </label>
                      </div>

                      <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider pt-2">Modo de Aplicación de Servicio (10%):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-950/60 cursor-pointer select-none border-slate-800 hover:border-slate-700">
                          <input
                            type="radio"
                            name="serviceMode"
                            checked={!serviceOnTable}
                            onChange={() => {
                              setServiceOnTable(false);
                              setServiceOnTakeout(false);
                            }}
                            className="h-4 w-4 mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">Servicio Adicional</span>
                            <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">Se suma el porcentaje de servicio al subtotal al finalizar la compra.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-3 rounded-xl border bg-slate-950/60 cursor-pointer select-none border-slate-800 hover:border-slate-700">
                          <input
                            type="radio"
                            name="serviceMode"
                            checked={serviceOnTable}
                            onChange={() => {
                              setServiceOnTable(true);
                              setServiceOnTakeout(true);
                            }}
                            className="h-4 w-4 mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">Servicio Incluido en el precio</span>
                            <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">El servicio ya está incluido en los precios de los productos.</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingCharges}
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg transition-transform active:scale-95 duration-200 bg-red-600 hover:bg-red-500"
                    >
                      {savingCharges ? "Guardando..." : "Guardar Recargos"}
                    </button>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      (También se sincroniza con &quot;Guardar Cambios&quot; al final de la página)
                    </span>
                  </div>
                  {chargesMessage && (
                    <p className={`text-xs ${chargesMessage.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                      {chargesMessage}
                    </p>
                  )}
                </div>
              </form>
            </div>
            
            <form 
              action={async (formData) => {
                const combinedLocality = [province, canton, parroquia, sector].map(s => s.trim()).filter(Boolean).join(" | ");
                formData.set("locality", combinedLocality);
                // Sincronización integral de recargos, tarifas y modalidades
                formData.set("ivaPercent", String(ivaPercent));
                formData.set("servicePercent", String(servicePercent));
                formData.set("deliveryCost", String(deliveryCost));
                formData.set("deliveryEnabled", enableDeliveryState ? "true" : "false");
                formData.set("enableDelivery", enableDeliveryState ? "true" : "false");
                formData.set("deliveryRates", JSON.stringify(kmRates));
                formData.set("ivaOnTable", String(ivaOnTable));
                formData.set("ivaOnTakeout", String(ivaOnTakeout));
                formData.set("serviceOnTable", String(serviceOnTable));
                formData.set("serviceOnTakeout", String(serviceOnTakeout));
                formData.set("enablePickup", enablePickup ? "true" : "false");
                formData.set("enableTableOrdering", enableTableOrdering ? "true" : "false");
                await updateRestaurantAction(restaurant.id, formData);
                alert("Configuración del negocio actualizada correctamente.");
              }}
              className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-md"
            >
              {/* Selector de Giro de Negocio / Presets por Vertical */}
              <div className="bg-slate-950/90 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-amber-400" />
                    <h3 className="text-base font-extrabold text-white">Giro de Negocio y Modalidad del Panel</h3>
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full">
                    ✨ Presets por Vertical
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Selecciona el tipo de tu empresa para adaptar automáticamente los nombres de pestañas, botones y funciones tanto en tu panel como en tu catálogo web.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-2">
                  {/* Option 1: RESTAURANT */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("RESTAURANT");
                      setIsLodgingState(false);
                      setSelectedBusinessType("RESTAURANT");
                      setSelectedCatalogMode("MENU");
                      setEnableTableOrdering(true);
                      setDisabledModules(prev => prev.filter(m => m !== "tables" && m !== "gastro"));
                      setEnabledModules(prev => [...new Set([...prev, "tables"])]);
                      setCustomItemChoice("Platos");
                      setCustomItemsPlural("Platos");
                      setCustomItemSingle("Plato");
                      setCustomCatalogTabChoice("Menú Digital");
                      setCustomCatalogTabInput("Menú Digital");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPreset === "RESTAURANT"
                        ? "bg-red-500/15 border-red-500 text-white shadow-lg shadow-red-500/10 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <span>🍔</span> Restaurante / Bar
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800/50 text-red-400">
                          menuqr
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
                        Platos, comandas de cocina KDS, mesas con código QR y opción para dividir cuenta.
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase text-red-400">
                      {selectedPreset === "RESTAURANT" ? "✓ Seleccionado" : "Seleccionar"}
                    </div>
                  </button>

                  {/* Option 2: RETAIL (Catálogo E-Commerce & Tienda) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("RETAIL");
                      setIsLodgingState(false);
                      setSelectedBusinessType("RETAIL");
                      setSelectedCatalogMode("CATALOG");
                      setEnableTableOrdering(false);
                      setDisabledModules(prev => [...new Set([...prev, "tables", "gastro", "split-bill"])]);
                      setEnabledModules(prev => prev.filter(m => m !== "tables" && m !== "gastro"));
                      setCustomItemChoice("Productos");
                      setCustomItemsPlural("Productos");
                      setCustomItemSingle("Producto");
                      setCustomCatalogTabChoice("Productos");
                      setCustomCatalogTabInput("Productos");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPreset === "RETAIL"
                        ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <span>🛍️</span> Catálogo E-Commerce
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/50 text-amber-400">
                          catalogo
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
                        Tiendas de ropa, calzado, licores y boutiques. Carrito flotante, tallas/colores y WhatsApp.
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase text-amber-400">
                      {selectedPreset === "RETAIL" ? "✓ Seleccionado" : "Seleccionar"}
                    </div>
                  </button>

                  {/* Option 3: SERVICES (Servicios Técnicos & Cotizador) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("SERVICIOS");
                      setIsLodgingState(false);
                      setSelectedBusinessType("SERVICES");
                      setSelectedCatalogMode("CATALOG");
                      setEnableTableOrdering(false);
                      setDisabledModules(prev => [...new Set([...prev, "tables", "gastro", "split-bill", "ruleta"])]);
                      setEnabledModules(prev => prev.filter(m => m !== "tables" && m !== "gastro"));
                      setCustomItemChoice("CUSTOM");
                      setCustomItemsPlural("Servicios Técnicos");
                      setCustomItemSingle("Servicio");
                      setCustomCatalogTabChoice("CUSTOM");
                      setCustomCatalogTabInput("Cotizador Express");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPreset === "SERVICIOS"
                        ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <span>🔧</span> Servicios Técnicos
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-cyan-400">
                          servicios
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
                        Técnicos, plomeros, electricistas y cerrajería. Cotizador express en 60 segundos con fotos y GPS.
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase text-cyan-400">
                      {selectedPreset === "SERVICIOS" ? "✓ Seleccionado" : "Seleccionar"}
                    </div>
                  </button>

                  {/* Option 4: CITAS (Agenda de Citas & Turnos) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("CITAS");
                      setIsLodgingState(false);
                      setSelectedBusinessType("SERVICES");
                      setSelectedCatalogMode("CATALOG");
                      setEnableTableOrdering(false);
                      setDisabledModules(prev => [...new Set([...prev, "tables", "gastro", "split-bill"])]);
                      setEnabledModules(prev => [...new Set([...prev.filter(m => m !== "tables" && m !== "gastro"), "citas"])]);
                      setCustomItemChoice("Servicios");
                      setCustomItemsPlural("Servicios");
                      setCustomItemSingle("Servicio");
                      setCustomCatalogTabChoice("Servicios");
                      setCustomCatalogTabInput("Citas & Turnos");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPreset === "CITAS"
                        ? "bg-purple-500/15 border-purple-500 text-white shadow-lg shadow-purple-500/10 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <span>📅</span> Agenda de Citas & Turnos
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/50 text-purple-400">
                          citas
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
                        Consultorios médicos, dentistas, barberías y spas. Turnos online 24/7 y especialistas.
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase text-purple-400">
                      {selectedPreset === "CITAS" ? "✓ Seleccionado" : "Seleccionar"}
                    </div>
                  </button>

                  {/* Option 5: RESERVAS (Hospedaje & Cabañas) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreset("RESERVAS");
                      setIsLodgingState(true);
                      setSelectedBusinessType("SERVICES");
                      setSelectedCatalogMode("CATALOG");
                      setEnableTableOrdering(false);
                      setDisabledModules(prev => [...new Set([...prev, "tables", "gastro", "split-bill"])]);
                      setEnabledModules(prev => [...new Set([...prev.filter(m => m !== "tables" && m !== "gastro"), "reservas"])]);
                      setCustomItemChoice("CUSTOM");
                      setCustomItemsPlural("Cabañas / Habitaciones");
                      setCustomItemSingle("Cabaña");
                      setCustomCatalogTabChoice("CUSTOM");
                      setCustomCatalogTabInput("Hospedaje");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedPreset === "RESERVAS"
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 font-bold"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <span>🏕️</span> Hospedaje & Cabañas
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/50 text-emerald-400">
                          reservas
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-400 font-normal">
                        Check-in/out, noches, cabañas, domos, extras y reservas directas sin comisiones.
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase text-emerald-400">
                      {selectedPreset === "RESERVAS" ? "✓ Seleccionado" : "Seleccionar"}
                    </div>
                  </button>
                </div>

                <input type="hidden" name="businessType" value={selectedBusinessType} />
                <input type="hidden" name="catalogMode" value={selectedCatalogMode} />
                <input type="hidden" name="enableTableOrdering" value={enableTableOrdering ? "true" : "false"} />
                <input type="hidden" name="enablePickup" value={enablePickup ? "true" : "false"} />
                <input type="hidden" name="enableDelivery" value={enableDeliveryState ? "true" : "false"} />
                <input type="hidden" name="deliveryEnabled" value={enableDeliveryState ? "true" : "false"} />
                <input type="hidden" name="customLabels" value={currentCustomLabelsJSON} />
              </div>

              {/* Personalización de Herramientas y Terminología del Panel */}
              <div className="bg-slate-950/90 border border-slate-800 p-6 rounded-2xl space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-850 pb-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-sky-400" />
                    <div>
                      <h3 className="text-base font-extrabold text-white">Personalización de Herramientas y Modalidades del Pedido</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Activa u oculta las modalidades de entrega de tu carrito (Para Llevar, Domicilio, En Mesa) y personaliza la presentación de tu menú o productos.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-full">
                    ⚙️ Control Total
                  </span>
                </div>

                {/* Section A: Modalidades del Pedido (Para Llevar, Domicilio, En Mesa) */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Modalidades del Pedido en Carrito (ON / OFF)
                  </label>
                  <p className="text-xs text-slate-400">
                    Controla qué opciones de envío/entrega se le muestran al cliente al finalizar su orden.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Modality 1: Para Llevar */}
                    <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      enablePickup 
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white" 
                        : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                    }`}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                            <span>🛍️</span> Para Llevar / Retiro
                          </span>
                          <button
                            type="button"
                            onClick={() => setEnablePickup(!enablePickup)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              enablePickup ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                enablePickup ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {enablePickup ? "✓ Habilitado para retiro en tienda." : "✕ Oculto en el checkout."}
                        </p>
                      </div>
                    </div>

                    {/* Modality 2: Domicilio */}
                    <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      enableDeliveryState 
                        ? "bg-sky-500/10 border-sky-500/40 text-white" 
                        : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                    }`}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                            <span>🛵</span> Envío a Domicilio
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleDelivery(!enableDeliveryState)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              enableDeliveryState ? "bg-sky-500" : "bg-slate-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                enableDeliveryState ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {enableDeliveryState ? "✓ Habilitado con tarifa de envío." : "✕ Oculto en el checkout."}
                        </p>
                      </div>
                    </div>

                    {/* Modality 3: En Mesa */}
                    <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      enableTableOrdering 
                        ? "bg-amber-500/10 border-amber-500/40 text-white" 
                        : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                    }`}>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                            <span>🍽️</span> Atención en Mesa
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleTableOrdering(!enableTableOrdering)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              enableTableOrdering ? "bg-amber-500" : "bg-slate-800"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                enableTableOrdering ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {enableTableOrdering ? "✓ Habilitado con QR de mesa." : "✕ Oculto en el checkout y menú."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personalización de Textos Avanzados (Opcional) */}
                <details className="group border border-slate-800/80 rounded-2xl bg-slate-900/40 p-4 transition-all">
                  <summary className="cursor-pointer text-xs font-bold text-slate-300 flex items-center justify-between select-none">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>✏️</span>
                      <span>Personalizar Títulos y Nombres de Ítems (Opcional)</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        · Actual: &quot;{customCatalogTabChoice === 'CUSTOM' ? customCatalogTabInput : customCatalogTabChoice}&quot; / &quot;{customItemChoice === 'CUSTOM' ? customItemsPlural : customItemChoice}&quot;
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <div className="pt-4 space-y-5 border-t border-slate-850 mt-3">
                    {/* Sub-Section 1: Título de la Pestaña en el Catálogo Web */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        ¿Cómo deseas que aparezca la pestaña de tu catálogo web público?
                      </label>
                      <p className="text-xs text-slate-400">
                        Elige entre mostrar &quot;Menú Digital&quot; (gastronomía), &quot;Productos&quot; (licorería/tienda), &quot;Catálogo de Productos&quot; o un título personalizado.
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { id: "Menú Digital", label: "📖 Menú Digital", desc: "Formato Restaurante / Bar" },
                          { id: "Productos", label: "📦 Productos", desc: "Formato Licorería / Tienda" },
                          { id: "Catálogo de Productos", label: "🛍️ Catálogo de Productos", desc: "Formato Catálogo Extenso" },
                          { id: "CUSTOM", label: "✏️ Personalizado", desc: "Escribe tu propio título" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCustomCatalogTabChoice(opt.id);
                              if (opt.id !== "CUSTOM") {
                                setCustomCatalogTabInput(opt.id);
                              }
                            }}
                            className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                              customCatalogTabChoice === opt.id
                                ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <div className="font-extrabold">{opt.label}</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {customCatalogTabChoice === "CUSTOM" && (
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 mt-3">
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Título Personalizado para la Pestaña (Ej: Nuestros Licores, Catálogo 2026)
                          </label>
                          <input
                            type="text"
                            value={customCatalogTabInput}
                            onChange={(e) => setCustomCatalogTabInput(e.target.value)}
                            placeholder="ej. Nuestros Licores"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Sub-Section 2: Terminología de Ítems */}
                    <div className="space-y-3 pt-4 border-t border-slate-850">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        ¿Cómo deseas llamar a los elementos individuales (ítems)?
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { id: "Platos", label: "🍲 Platos", single: "Plato" },
                          { id: "Productos", label: "🛍️ Productos", single: "Producto" },
                          { id: "Servicios", label: "🛠️ Servicios", single: "Servicio" },
                          { id: "CUSTOM", label: "✏️ Personalizado", single: "Custom" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setCustomItemChoice(opt.id);
                              if (opt.id !== "CUSTOM") {
                                setCustomItemsPlural(opt.id);
                                setCustomItemSingle(opt.single);
                              }
                            }}
                            className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                              customItemChoice === opt.id
                                ? "bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom item inputs */}
                      {customItemChoice === "CUSTOM" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre en Plural (Ej: Licores, Repuestos)</label>
                            <input
                              type="text"
                              value={customItemsPlural}
                              onChange={(e) => setCustomItemsPlural(e.target.value)}
                              placeholder="ej. Licores"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 px-3 py-2 rounded-xl text-xs text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre en Singular (Ej: Licor, Repuesto)</label>
                            <input
                              type="text"
                              value={customItemSingle}
                              onChange={(e) => setCustomItemSingle(e.target.value)}
                              placeholder="ej. Licor"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 px-3 py-2 rounded-xl text-xs text-white focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* Section: Formato y Proporción de Fotos del Catálogo */}
                <div className="space-y-3 pt-4 border-t border-slate-850">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Proporción y Formato de Fotos del Catálogo
                      </label>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Elige cómo se presentarán las imágenes de tus productos en el menú público móvil y web.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full">
                      📸 {imageAspectRatio === "9:16" ? "9:16 Vertical" : "1:1 Estándar"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setImageAspectRatio("1:1")}
                      className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                        imageAspectRatio === "1:1"
                          ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 font-bold"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0 text-xl">
                        ◻️
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-white">Estándar / Cuadrado (1:1)</span>
                          {imageAspectRatio === "1:1" && (
                            <span className="text-[10px] font-bold text-amber-400">✓ Activo</span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-normal mt-1">
                          Ideal para platos servidos, pizzas, hamburguesas, cafeterías y gastronomía clásica.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageAspectRatio("9:16")}
                      className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                        imageAspectRatio === "9:16"
                          ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 font-bold"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0 text-xl">
                        📱
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-white">Vertical (9:16 - Reels / Botellas)</span>
                          {imageAspectRatio === "9:16" && (
                            <span className="text-[10px] font-bold text-amber-400">✓ Activo</span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-normal mt-1">
                          Ideal para licorerías (botellas altas), moda, perfumes y catálogos tipo Stories sin recortar las fotos.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Secciones destacadas: Sugerencias y Populares */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-slate-800/80">
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          ⭐ {bLabels.suggestedSectionTitle} ({bLabels.suggestedCardBadge})
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {suggestedAspectRatio === "9:16" ? "9:16 Vertical" : "1:1 Estándar"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSuggestedAspectRatio("1:1")}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            suggestedAspectRatio === "1:1"
                              ? "bg-amber-500/15 border-amber-500 text-white shadow-sm font-black"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          ◻️ 1:1 Estándar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestedAspectRatio("9:16")}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            suggestedAspectRatio === "9:16"
                              ? "bg-amber-500/15 border-amber-500 text-white shadow-sm font-black"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          📱 9:16 Vertical
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          🔥 Los Más Populares
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {popularAspectRatio === "9:16" ? "9:16 Vertical" : "1:1 Estándar"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPopularAspectRatio("1:1")}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            popularAspectRatio === "1:1"
                              ? "bg-amber-500/15 border-amber-500 text-white shadow-sm font-black"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          ◻️ 1:1 Estándar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPopularAspectRatio("9:16")}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            popularAspectRatio === "9:16"
                              ? "bg-amber-500/15 border-amber-500 text-white shadow-sm font-black"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          📱 9:16 Vertical
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section C: Sistema Modular Híbrido (Capacidades y Módulos Operativos) */}
                <div className="space-y-6 pt-4 border-t border-slate-850">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-amber-400" />
                        <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                          Módulos y Capacidades del Negocio (Sistema Modular Híbrido)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Personaliza y enciende con interruptores ON / OFF las funciones que tu negocio necesita. Si tienes un modelo mixto (por ejemplo, cabañas con restaurante/café, o una clínica que vende productos), puedes activar o silenciar cualquier módulo en tiempo real.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-full">
                      ⚡ Módulos ON / OFF
                    </span>
                  </div>

                  {/* Sub-bloque 1: Canales de Venta Adicionales para Modelos Híbridos */}
                  <details className="group border border-slate-850 rounded-2xl bg-slate-950/40 p-4 transition-all">
                    <summary className="cursor-pointer text-xs font-bold text-slate-300 flex items-center justify-between select-none">
                      <span className="flex items-center gap-2 flex-wrap">
                        <Boxes className="h-4 w-4 text-sky-400" />
                        <span>Canales de Venta Adicionales (Modelo Mixto o Híbrido)</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          · Giro principal: &quot;{selectedPreset === "RESTAURANT" ? "Restaurante / Bar" : selectedPreset === "RETAIL" ? "Catálogo E-Commerce" : selectedPreset === "SERVICIOS" ? "Servicios Técnicos" : selectedPreset === "CITAS" ? "Agenda de Citas" : "Hospedaje & Cabañas"}&quot;
                        </span>
                      </span>
                      <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>

                    <div className="pt-4 space-y-3 border-t border-slate-850 mt-3">
                      <p className="text-[11px] text-slate-400 leading-snug">
                        💡 Tu modelo principal ya está configurado arriba. Abre y activa estos interruptores únicamente si tienes un negocio combinado (por ejemplo: cabañas u hotel que además tienen restaurante o tienda, o una clínica que vende productos de catálogo).
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        {/* Modulo 1: Atención en Mesa y KDS */}
                        {(() => {
                          const isTablesActive = bLabels.showTablesConfig && enableTableOrdering;
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isTablesActive
                                ? "bg-amber-500/10 border-amber-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <span className="text-base">🍽️</span>
                                  <span>Atención en Mesa, QR & Pantalla Cocina KDS</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isTablesActive
                                    ? "✓ Habilitado: Códigos QR por mesa, comandas a cocina y panel de mesero."
                                    : "✕ Apagado: Panel limpio sin términos de restaurante ni comandas de cocina."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleTableOrdering(!isTablesActive)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isTablesActive ? "bg-amber-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isTablesActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Modulo 2: Motor de Reservas y Hospedaje */}
                        {(() => {
                          const isReservasActive = !disabledModules.includes("reservas") && (isLodging || enabledModules.includes("reservas") || selectedPreset === "RESERVAS");
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isReservasActive
                                ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <span className="text-base">🏕️</span>
                                  <span>Motor de Reservas & Hospedaje CRM</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isReservasActive
                                    ? "✓ Habilitado: Reservas por noche, calendario de estadías y check-in/out."
                                    : "✕ Apagado: Módulo de reservas y hospedaje oculto."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isReservasActive) {
                                    setDisabledModules(prev => [...new Set([...prev, "reservas"])]);
                                    setEnabledModules(prev => prev.filter(m => m !== "reservas"));
                                    setIsLodgingState(false);
                                  } else {
                                    setDisabledModules(prev => prev.filter(m => m !== "reservas"));
                                    setEnabledModules(prev => [...new Set([...prev, "reservas"])]);
                                    setIsLodgingState(true);
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isReservasActive ? "bg-emerald-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isReservasActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Modulo 3: Agenda de Citas y Turnos */}
                        {(() => {
                          const isCitasActive = !disabledModules.includes("citas") && (selectedPreset === "CITAS" || enabledModules.includes("citas") || (!isLodging && !isServiciosTecnicos && (restaurant as any).businessType === "SERVICES"));
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isCitasActive
                                ? "bg-purple-500/10 border-purple-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <span className="text-base">📅</span>
                                  <span>Agenda de Citas & Turnos Online</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isCitasActive
                                    ? "✓ Habilitado: Agendamiento de turnos 24/7 y confirmación por WhatsApp."
                                    : "✕ Apagado: Módulo de turnos y agenda online oculto."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCitasActive) {
                                    setDisabledModules(prev => [...new Set([...prev, "citas"])]);
                                    setEnabledModules(prev => prev.filter(m => m !== "citas"));
                                  } else {
                                    setDisabledModules(prev => prev.filter(m => m !== "citas"));
                                    setEnabledModules(prev => [...new Set([...prev, "citas"])]);
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isCitasActive ? "bg-purple-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isCitasActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Modulo 4: Cotizador Express con Fotos y GPS */}
                        {(() => {
                          const isCotizadorActive = !disabledModules.includes("cotizador") && (selectedPreset === "SERVICIOS" || enabledModules.includes("cotizador"));
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isCotizadorActive
                                ? "bg-cyan-500/10 border-cyan-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <span className="text-base">🔧</span>
                                  <span>Cotizador Express con Fotos & GPS</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isCotizadorActive
                                    ? "✓ Habilitado: Solicitudes de presupuesto en 60s con fotos y mapa GPS."
                                    : "✕ Apagado: Módulo de cotizador express oculto."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCotizadorActive) {
                                    setDisabledModules(prev => [...new Set([...prev, "cotizador"])]);
                                    setEnabledModules(prev => prev.filter(m => m !== "cotizador"));
                                  } else {
                                    setDisabledModules(prev => prev.filter(m => m !== "cotizador"));
                                    setEnabledModules(prev => [...new Set([...prev, "cotizador"])]);
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isCotizadorActive ? "bg-cyan-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isCotizadorActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Modulo 5: Catálogo E-Commerce & Carrito */}
                        {(() => {
                          const isEcommerceActive = !disabledModules.includes("ecommerce") && (selectedPreset === "RETAIL" || enabledModules.includes("ecommerce") || (restaurant as any).businessType === "RETAIL" || (restaurant as any).businessType === "GENERAL_CATALOG");
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isEcommerceActive
                                ? "bg-amber-500/10 border-amber-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <span className="text-base">🛍️</span>
                                  <span>Catálogo E-Commerce & Carrito Flotante</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isEcommerceActive
                                    ? "✓ Habilitado: Carrito flotante, selector de variantes (tallas, colores) y checkout directo."
                                    : "✕ Apagado: Modo catálogo simplificado sin carrito flotante."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEcommerceActive) {
                                    setDisabledModules(prev => [...new Set([...prev, "ecommerce"])]);
                                    setEnabledModules(prev => prev.filter(m => m !== "ecommerce"));
                                  } else {
                                    setDisabledModules(prev => prev.filter(m => m !== "ecommerce"));
                                    setEnabledModules(prev => [...new Set([...prev, "ecommerce"])]);
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isEcommerceActive ? "bg-amber-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isEcommerceActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Modulo 6: Dividir Cuenta en Mesa */}
                        {(() => {
                          const isSplitBillActive = !disabledModules.includes("split-bill") && bLabels.isGastro;
                          return (
                            <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                              isSplitBillActive
                                ? "bg-amber-500/10 border-amber-500/40 text-white"
                                : "bg-slate-950/60 border-slate-850 text-slate-400 opacity-60"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 font-extrabold text-xs text-white">
                                  <Sliders className="h-4 w-4 text-amber-400" />
                                  <span>Módulo Dividir Cuenta por Comensal</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {isSplitBillActive
                                    ? "✓ Habilitado: Herramienta interactiva para separar cuenta por comensal."
                                    : "✕ Apagado: Herramienta de dividir cuenta oculta en mesas."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (disabledModules.includes("split-bill")) {
                                    setDisabledModules(prev => prev.filter(m => m !== "split-bill"));
                                  } else {
                                    setDisabledModules(prev => [...new Set([...prev, "split-bill"])]);
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  !disabledModules.includes("split-bill") ? "bg-amber-500" : "bg-slate-800"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    !disabledModules.includes("split-bill") ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </details>

                  {/* Sub-bloque 2: Módulos de Crecimiento & Gestión */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        2. Módulos de Crecimiento, Fidelización & Inventario
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab("ruleta")}
                        className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Gift className="h-3 w-3" />
                        <span>Configurar Ruleta</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {[
                        { id: "inventory", label: bLabels.inventoryTabTitle || "Inventario & Compras", desc: "Control de stock, alertas de agotamiento y gestión de compras", icon: Boxes },
                        { id: "ruleta", label: "Ruleta de Premios (¡Gira y Gana!)", desc: "Botón flotante en el catálogo y premios de fidelización", icon: Gift },
                        { id: "seasons", label: "Tarifas Dinámicas y Temporadas", desc: "Ajuste de precios para feriados, fines de semana o temporada alta", icon: CalendarDays },
                        { id: "coupons", label: "Cupones de Descuento", desc: "Códigos promocionales de descuento para tus clientes", icon: Tag },
                        { id: "crm", label: "CRM & Historial de Clientes", desc: "Base de datos de compradores, preferencias y hábitos", icon: Users },
                      ].map((mod) => {
                        const isHidden = disabledModules.includes(mod.id);
                        const IconComp = mod.icon;
                        return (
                          <label
                            key={mod.id}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                              !isHidden
                                ? "bg-slate-900/90 border-slate-800 text-white"
                                : "bg-slate-950/40 border-slate-900 opacity-50 text-slate-500"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDisabledModules(prev => prev.filter(m => m !== mod.id));
                                } else {
                                  setDisabledModules(prev => [...new Set([...prev, mod.id])]);
                                }
                              }}
                              className="h-4.5 w-4.5 mt-0.5 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500 cursor-pointer shrink-0"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <IconComp className="h-3.5 w-3.5 text-slate-400" />
                                <span>{mod.label}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{mod.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <input type="hidden" name="customLabels" value={currentCustomLabelsJSON} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {selectedBusinessType === "RESTAURANT" ? "Nombre del Restaurante" : "Nombre de tu Negocio / Empresa"}
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={restaurant.name}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Slug único (Ruta web)</label>
                  <input
                    type="text"
                    name="slug"
                    defaultValue={restaurant.slug}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp para pedidos (Código país + número)</label>
                  <input
                    type="text"
                    name="whatsappNumber"
                    defaultValue={restaurant.whatsappNumber}
                    placeholder="ej: 5491123456789"
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Usa código de país sin el signo &quot;+&quot;. Ejemplo: 5491123456789</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Color del tema (Código Hexadecimal)</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      name="themeColor"
                      defaultValue={restaurant.themeColor}
                      className="h-12 w-12 rounded-xl bg-transparent border-0 cursor-pointer overflow-hidden shrink-0"
                    />
                    <input
                      type="text"
                      name="themeColorText"
                      disabled
                      value={restaurant.themeColor}
                      className="w-full bg-slate-950/60 border border-slate-850 block px-4 py-3 rounded-xl text-slate-400 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Slogan / Frase Corta</label>
                  <input
                    type="text"
                    name="slogan"
                    defaultValue={restaurant.slogan || ""}
                    placeholder="ej: ¡La mejor calidad, eso es todo!"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Frase o lema corto visible en la cabecera principal.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Negocio / Historia</label>
                  <textarea
                    name="description"
                    defaultValue={restaurant.description || ""}
                    rows={3}
                    placeholder="ej: Auténtica pizza napolitana al horno de leña, pastas artesanales y el mejor ambiente familiar de Manta."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Texto detallado que se muestra en la sección Sobre Nosotros.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Dirección Física</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={restaurant.address || ""}
                    placeholder="ej: Av. Barbasquillo y Calle 24, Manta, Ecuador"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Provincia (Ecuador)</label>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setCanton("");
                    }}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">Seleccione Provincia...</option>
                    {Object.keys(ecuadorData).map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cantón / Ciudad</label>
                  <select
                    value={canton}
                    onChange={(e) => {
                      setCanton(e.target.value);
                      setParroquia("");
                    }}
                    disabled={!province}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Seleccione Cantón...</option>
                    {(province ? ecuadorData[province] || [] : []).map((cant) => (
                      <option key={cant} value={cant}>{cant}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Parroquia / Localidad</label>
                  {canton && parishData[canton] ? (
                    <select
                      value={parroquia}
                      onChange={(e) => {
                        setParroquia(e.target.value);
                        setSector("");
                      }}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Seleccione Parroquia...</option>
                      {parishData[canton].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={parroquia}
                      onChange={(e) => {
                        setParroquia(e.target.value);
                        setSector("");
                      }}
                      placeholder="ej: Tarqui, Salinas, Olón"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Sector / Barrio / Comuna</label>
                  {parroquia && communeData[parroquia] ? (
                    <select
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Seleccione Comuna / Sector...</option>
                      {communeData[parroquia].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      placeholder="ej: Urdesa, Barbasquillo, Chipipe"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Horario de Atención</label>
                  <input
                    type="text"
                    name="schedule"
                    defaultValue={restaurant.schedule || ""}
                    placeholder="ej: Lunes a Domingo: 12:00 PM - 11:00 PM"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Especialidad de la Casa</label>
                  <input
                    type="text"
                    name="specialty"
                    defaultValue={restaurant.specialty || ""}
                    placeholder="ej: Pizza Napolitana & Pastas Artesanales"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Servicios y Facilidades (Separados por comas)</label>
                  <input
                    type="text"
                    name="services"
                    defaultValue={restaurant.services || ""}
                    placeholder="ej: Wi-Fi, Estacionamiento, Pet Friendly, Delivery"
                    className="w-full bg-slate-950 border border-slate-850 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Números de Contacto Adicionales (Separados por comas)</label>
                  <input
                    type="text"
                    name="contactNumbers"
                    defaultValue={restaurant.contactNumbers || ""}
                    placeholder="ej: +593 99 999 9999, +593 5 262 1234"
                    className="w-full bg-slate-950 border border-slate-850 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Instagram (URL o usuario)</label>
                  <input
                    type="text"
                    name="instagram"
                    defaultValue={restaurant.instagram || ""}
                    placeholder="ej: https://instagram.com/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Facebook (URL)</label>
                  <input
                    type="text"
                    name="facebook"
                    defaultValue={restaurant.facebook || ""}
                    placeholder="ej: https://facebook.com/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">TikTok (URL)</label>
                  <input
                    type="text"
                    name="tiktok"
                    defaultValue={restaurant.tiktok || ""}
                    placeholder="ej: https://tiktok.com/@mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div className="md:col-span-2 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent p-4 rounded-2xl border border-sky-500/30">
                  <label className="block text-sm font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-sky-400" />
                    <span>📍 Enlace de Ubicame.info (Botón "Ubicame.info")</span>
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Configura el link al que serán dirigidos tus clientes al pulsar <strong>"Ubicame.info"</strong> en tu Perfil de Negocio. Por defecto: <code className="text-sky-300">https://ubicame.info</code>
                  </p>
                  <input
                    type="text"
                    name="ubicameUrl"
                    defaultValue={restaurant.ubicameUrl || "https://ubicame.info"}
                    placeholder="https://ubicame.info o tu enlace de perfil en ubicame"
                    className="w-full bg-slate-950 border border-sky-500/40 focus:border-sky-400 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600"
                  />
                </div>
                <div className="md:col-span-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 rounded-2xl border border-amber-500/30">
                  <label className="block text-sm font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                    <span>📅 Enlace de Reservaciones (Botón "Reservar Ahora")</span>
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Configura el link al que serán dirigidos tus clientes al pulsar <strong>"Reservar Ahora"</strong> en el Perfil Comercial de tu menú. Por defecto: <code className="text-amber-300">https://reservaciones.ubicame.cc</code>
                  </p>
                  <input
                    type="text"
                    name="reservationUrl"
                    defaultValue={restaurant.reservationUrl || "https://reservaciones.ubicame.cc"}
                    placeholder="https://reservaciones.ubicame.cc o tu enlace de reservas"
                    className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-400 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Section: Interactive Map Embed */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500" />
                    Mapa Interactivo de Google Maps (Iframe / Embed URL)
                  </h4>
                  <span className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                    Recomendado para mapa interactivo visual
                  </span>
                </div>
                <div>
                  <MapEmbedConfigField 
                    initialValue={restaurant.mapEmbedUrl} 
                    address={restaurant.address} 
                    cityName={restaurant.city} 
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    💡 Sin un iframe de “Insertar un mapa”, el sistema solo puede centrar el mapa usando la dirección física; Google podría ubicar un punto cercano en vez de la ficha del negocio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ficha exacta de Google Business / Google Maps (URL)</label>
                    <input
                      type="text"
                      name="googleBusinessUrl"
                      defaultValue={restaurant.googleBusinessUrl || ""}
                      placeholder="https://g.page/r/xyz... o enlace a ficha de Google Maps"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Este enlace será el destino de “Abrir GPS”. Pega aquí el enlace compartido de la ficha real del negocio, no una dirección escrita.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Rango de Precios (Nivel Comercial)</label>
                    <select
                      name="priceRange"
                      defaultValue={restaurant.priceRange || "$$"}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="$">$ - Económico (Menos de $5 por persona)</option>
                      <option value="$$">$$ - Moderado ($5 a $15 por persona)</option>
                      <option value="$$$">$$$ - Alto ($15 a $30 por persona)</option>
                      <option value="$$$$">$$$$ - Exclusivo (Más de $30 por persona)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Horario Estructurado por Día (JSON para SEO Local / Google Schema)
                  </label>
                  <textarea
                    name="structuredSchedule"
                    defaultValue={restaurant.structuredSchedule || ""}
                    rows={3}
                    placeholder='{"monday":{"open":"09:00","close":"22:00","closed":false},"tuesday":{"open":"09:00","close":"22:00","closed":false}}'
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 Formato JSON opcional para indexación en Google Maps. Si está vacío, se usará automáticamente el texto del horario habitual.
                  </p>
                </div>
              </div>

              {/* Logo Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🖼️ Logo de tu Negocio</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP o PNG, 500–800 px.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-700 hover:border-amber-400 hover:bg-slate-800 text-white transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        📁 Subir archivo desde tu dispositivo
                      </button>
                      {logoFileName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 truncate max-w-[220px]">
                          ✓ {logoFileName}
                        </span>
                      )}
                      {(logoUrlInput || logoFileName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoUrlInput("");
                            setLogoFileName(null);
                            setLogoHasError(false);
                            if (logoFileInputRef.current) logoFileInputRef.current.value = "";
                          }}
                          className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>

                    <input
                      ref={logoFileInputRef}
                      type="file"
                      name="logoFile"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFileName(file.name);
                          const previewUrl = URL.createObjectURL(file);
                          setLogoUrlInput(previewUrl);
                          setLogoHasError(false);
                        }
                      }}
                    />

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">O pega una URL Directa (HTTPS o /uploads/...)</label>
                      <input
                        type="text"
                        name="logoUrl"
                        value={logoUrlInput}
                        onChange={(e) => {
                          setLogoUrlInput(e.target.value);
                          setLogoHasError(false);
                        }}
                        placeholder="https://i.postimg.cc/xxxxx/logo.webp o /uploads/..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      El logo oficial aparecerá en la cabecera, ficha comercial y buscador.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Vista Previa</label>
                    <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
                      {logoUrlInput && logoUrlInput.trim() !== "" ? (
                        !logoHasError ? (
                          <img
                            src={logoUrlInput.trim()}
                            alt="Vista previa Logo"
                            onError={() => setLogoHasError(true)}
                            className="max-h-full max-w-full object-contain rounded-lg shadow"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar.</p>
                            <p className="text-[10px] text-slate-400">Verifica la URL o sube un archivo.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin logo</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cover Banner Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🌄 Portada / Banner Comercial</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP o JPG, 1600–2000 px de ancho.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-700 hover:border-amber-400 hover:bg-slate-800 text-white transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        📁 Subir archivo desde tu dispositivo
                      </button>
                      {coverFileName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 truncate max-w-[220px]">
                          ✓ {coverFileName}
                        </span>
                      )}
                      {(coverUrlInput || coverFileName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoverUrlInput("");
                            setCoverFileName(null);
                            setCoverHasError(false);
                            if (coverFileInputRef.current) coverFileInputRef.current.value = "";
                          }}
                          className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>

                    <input
                      ref={coverFileInputRef}
                      type="file"
                      name="coverFile"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCoverFileName(file.name);
                          const previewUrl = URL.createObjectURL(file);
                          setCoverUrlInput(previewUrl);
                          setCoverHasError(false);
                        }
                      }}
                    />

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">O pega una URL Directa (HTTPS o /uploads/...)</label>
                      <input
                        type="text"
                        name="coverUrl"
                        value={coverUrlInput}
                        onChange={(e) => {
                          setCoverUrlInput(e.target.value);
                          setCoverHasError(false);
                        }}
                        placeholder="https://i.postimg.cc/xxxxx/portada.webp o /uploads/..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      El banner se mostrará como fondo de cabecera y en la presentación destacada del perfil comercial.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Vista Previa</label>
                    <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
                      {coverUrlInput && coverUrlInput.trim() !== "" ? (
                        !coverHasError ? (
                          <img
                            src={coverUrlInput.trim()}
                            alt="Vista previa Portada"
                            onError={() => setCoverHasError(true)}
                            className="w-full h-full object-cover rounded-lg shadow"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar.</p>
                            <p className="text-[10px] text-slate-400">Verifica la URL o sube un archivo.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin portada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Establishment Gallery Section (Max 4 Photos for Business Profile) */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>📸 Galería del Establecimiento / Local (Máx. 4 Fotos)</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Se mostrarán en el carrusel táctil interactivo en la pestaña <strong>Perfil Comercial</strong> de tu página pública (ideal para comedores, salones, vitrinas, góndolas, talleres u oficinas).
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Carrusel Táctil & Lightbox
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {[
                    {
                      slot: 0,
                      label: selectedBusinessType === "RESTAURANT" 
                        ? "Foto 1 (Comedor Principal o Salón)" 
                        : selectedBusinessType === "RETAIL" 
                          ? "Foto 1 (Vitrinas o Fachada)" 
                          : selectedBusinessType === "SERVICES" 
                            ? "Foto 1 (Taller, Oficina o Recepción)" 
                            : "Foto 1 (Principal del Local)",
                      placeholder: "https://... o /uploads/...",
                    },
                    {
                      slot: 1,
                      label: selectedBusinessType === "RESTAURANT" 
                        ? "Foto 2 (Terraza, Barra o Fachada)" 
                        : selectedBusinessType === "RETAIL" 
                          ? "Foto 2 (Góndolas o Pasillos)" 
                          : selectedBusinessType === "SERVICES" 
                            ? "Foto 2 (Herramientas o Equipos)" 
                            : "Foto 2 (Área de Atención)",
                      placeholder: "https://... o /uploads/...",
                    },
                    {
                      slot: 2,
                      label: selectedBusinessType === "RESTAURANT" 
                        ? "Foto 3 (Ambiente, Cocina o Eventos)" 
                        : selectedBusinessType === "RETAIL" 
                          ? "Foto 3 (Sección Destacada o Novedades)" 
                          : selectedBusinessType === "SERVICES" 
                            ? "Foto 3 (Trabajo Realizado)" 
                            : "Foto 3 (Instalaciones)",
                      placeholder: "https://... o /uploads/...",
                    },
                    {
                      slot: 3,
                      label: selectedBusinessType === "RESTAURANT" 
                        ? "Foto 4 (Plato Estrella o Rincón Especial)" 
                        : selectedBusinessType === "RETAIL" 
                          ? "Foto 4 (Caja o Exhibidor)" 
                          : selectedBusinessType === "SERVICES" 
                            ? "Foto 4 (Área de Operaciones)" 
                            : "Foto 4 (Destacado del Negocio)",
                      placeholder: "https://... o /uploads/...",
                    },
                  ].map(({ slot, label, placeholder }) => {
                    const url = galleryImages[slot] || "";
                    return (
                      <div
                        key={slot}
                        className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center border border-amber-500/30">
                                {slot + 1}
                              </span>
                              {label}
                            </span>
                            {url && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...galleryImages];
                                  updated[slot] = "";
                                  setGalleryImages(updated);
                                }}
                                className="text-[11px] text-red-400 hover:text-red-300 font-bold transition cursor-pointer"
                              >
                                ✕ Limpiar
                              </button>
                            )}
                          </div>
                          <input
                            type="url"
                            value={url}
                            onChange={(e) => {
                              const updated = [...galleryImages];
                              updated[slot] = e.target.value;
                              setGalleryImages(updated);
                            }}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>

                        {/* Vista Previa */}
                        <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center group">
                          {url.trim() ? (
                            <>
                              <img
                                src={url.trim()}
                                alt={`Vista previa slot ${slot + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30">
                                ✓ Enlace Activo
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-600 gap-1 p-3 text-center">
                              <ImageIcon className="w-6 h-6 opacity-40 text-slate-500" />
                              <span className="text-[10px] font-bold text-slate-500">Sin foto configurada</span>
                              <span className="text-[9px] text-slate-600">Pega un enlace web HTTPS o /uploads/...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment QR Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📱 QR de Cobro Directo (Deuna / Transferencia)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP o PNG cuadrado.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => paymentQrFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-700 hover:border-amber-400 hover:bg-slate-800 text-white transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        📁 Subir archivo desde tu dispositivo
                      </button>
                      {paymentQrFileName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 truncate max-w-[220px]">
                          ✓ {paymentQrFileName}
                        </span>
                      )}
                      {(paymentQrUrlInput || paymentQrFileName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentQrUrlInput("");
                            setPaymentQrFileName(null);
                            setPaymentQrHasError(false);
                            if (paymentQrFileInputRef.current) paymentQrFileInputRef.current.value = "";
                          }}
                          className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>

                    <input
                      ref={paymentQrFileInputRef}
                      type="file"
                      name="paymentQrFile"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPaymentQrFileName(file.name);
                          const previewUrl = URL.createObjectURL(file);
                          setPaymentQrUrlInput(previewUrl);
                          setPaymentQrHasError(false);
                        }
                      }}
                    />

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400">O pega una URL Directa (HTTPS o /uploads/...)</label>
                      <input
                        type="text"
                        name="paymentQrUrl"
                        value={paymentQrUrlInput}
                        onChange={(e) => {
                          setPaymentQrUrlInput(e.target.value);
                          setPaymentQrHasError(false);
                        }}
                        placeholder="https://i.postimg.cc/xxxxx/qr.webp o /uploads/..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="block text-[11px] font-semibold text-slate-300">Número Celular para Deuna (Cobro Directo)</label>
                      <input
                        type="text"
                        name="deunaPhone"
                        defaultValue={(restaurant as any).deunaPhone || ""}
                        placeholder="Ej. 0991234567"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <p className="text-[10px] text-slate-400">Los clientes podrán copiar este número con un solo clic para transferir desde su app Deuna.</p>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug">
                      El código QR se mostrará en el perfil comercial y checkout para que tus clientes puedan escanearlo y transferirte directamente.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Vista Previa QR Deuna</label>
                    <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
                      {paymentQrUrlInput && paymentQrUrlInput.trim() !== "" ? (
                        !paymentQrHasError ? (
                          <img
                            src={paymentQrUrlInput.trim()}
                            alt="Vista previa QR Deuna"
                            onError={() => setPaymentQrHasError(true)}
                            className="max-h-full max-w-full object-contain rounded-lg shadow"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar.</p>
                            <p className="text-[10px] text-slate-400">Verifica la URL o sube un archivo.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin QR</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payphone Settings Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-orange-500/20 text-orange-400">💳</span>
                    <span>Cobro con Payphone (Tarjetas y App en Ecuador)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-orange-400 bg-orange-950/40 border border-orange-500/30 px-2.5 py-1 rounded-full">
                    ✨ Acepta Visa, Mastercard y saldo Payphone
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">Link Personal de Cobro Payphone</label>
                    <input
                      type="url"
                      name="payphoneUrl"
                      defaultValue={(restaurant as any).payphoneUrl || ""}
                      placeholder="https://payp.page.link/xxxx o https://live.payphone.app/..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <p className="text-[10px] text-slate-400">Tus clientes podrán hacer clic directamente y pagar desde su navegador o app.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-300">Número Celular registrado en Payphone</label>
                    <input
                      type="text"
                      name="payphonePhone"
                      defaultValue={(restaurant as any).payphonePhone || ""}
                      placeholder="Ej. 0991234567"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <p className="text-[10px] text-slate-400">Para clientes que deseen enviar el pago directamente desde su app Payphone.</p>
                  </div>
                </div>

                {/* Payphone QR File / URL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pt-2">
                  <div className="md:col-span-2 space-y-3">
                    <label className="block text-[11px] font-semibold text-slate-300">Código QR de Payphone (Opcional)</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => payphoneQrFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 border border-slate-700 hover:border-orange-400 hover:bg-slate-800 text-white transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        📁 Subir QR de Payphone
                      </button>
                      {payphoneQrFileName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 truncate max-w-[220px]">
                          ✓ {payphoneQrFileName}
                        </span>
                      )}
                      {(payphoneQrUrlInput || payphoneQrFileName) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayphoneQrUrlInput("");
                            setPayphoneQrFileName(null);
                            setPayphoneQrHasError(false);
                            if (payphoneQrFileInputRef.current) payphoneQrFileInputRef.current.value = "";
                          }}
                          className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>

                    <input
                      ref={payphoneQrFileInputRef}
                      type="file"
                      name="payphoneQrFile"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPayphoneQrFileName(file.name);
                          const previewUrl = URL.createObjectURL(file);
                          setPayphoneQrUrlInput(previewUrl);
                          setPayphoneQrHasError(false);
                        }
                      }}
                    />

                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400">O pega una URL directa del QR de Payphone</label>
                      <input
                        type="text"
                        name="payphoneQrUrl"
                        value={payphoneQrUrlInput}
                        onChange={(e) => {
                          setPayphoneQrUrlInput(e.target.value);
                          setPayphoneQrHasError(false);
                        }}
                        placeholder="https://i.postimg.cc/xxxxx/payphone-qr.webp o /uploads/..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Vista Previa QR Payphone</label>
                    <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
                      {payphoneQrUrlInput && payphoneQrUrlInput.trim() !== "" ? (
                        !payphoneQrHasError ? (
                          <img
                            src={payphoneQrUrlInput.trim()}
                            alt="Vista previa QR Payphone"
                            onError={() => setPayphoneQrHasError(true)}
                            className="max-h-full max-w-full object-contain rounded-lg shadow"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar.</p>
                            <p className="text-[10px] text-slate-400">Verifica la URL o sube un archivo.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin QR Payphone</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
 
              {/* Bank Details Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div>
                  <h3 className="text-md font-bold text-white">Datos Bancarios para Recibir Transferencias</h3>
                  <p className="text-xs text-slate-400">Completa esta información para que tus clientes puedan transferir directamente a tu cuenta bancaria al finalizar sus pedidos.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Banco</label>
                    <input
                      type="text"
                      name="bankName"
                      defaultValue={restaurant.bankName || ""}
                      placeholder="Ej. Banco Pichincha, Guayaquil..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Cuenta</label>
                    <select
                      name="bankAccountType"
                      defaultValue={restaurant.bankAccountType || ""}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Selecciona tipo...</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Número de Cuenta</label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      defaultValue={restaurant.bankAccountNumber || ""}
                      placeholder="Ej. 2200123456"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Beneficiario</label>
                    <input
                      type="text"
                      name="bankAccountName"
                      defaultValue={restaurant.bankAccountName || ""}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Cédula / RUC</label>
                    <input
                      type="text"
                      name="bankAccountDocument"
                      defaultValue={restaurant.bankAccountDocument || ""}
                      placeholder="Ej. 1712345678"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Correo Electrónico</label>
                    <input
                      type="email"
                      name="bankAccountEmail"
                      defaultValue={restaurant.bankAccountEmail || ""}
                      placeholder="Ej. mi-correo@banco.com"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Hidden Inputs for Geo Locality */}
              <input type="hidden" name="province" value={province} />
              <input type="hidden" name="city" value={canton} />
              <input type="hidden" name="parish" value={parroquia} />
              <input type="hidden" name="sector" value={sector} />

              {/* SEO & GEO Optimization Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div>
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Optimización SEO, GEO & Búsqueda IA (ChatGPT, Google, Gemini)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configura metadatos personalizados y coordenadas geográficas para mejorar la indexación en Google Maps y motores generativos.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Latitud GPS (Google Maps)</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      defaultValue={restaurant.latitude || ""}
                      placeholder="Ej: -1.831239"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Longitud GPS (Google Maps)</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      defaultValue={restaurant.longitude || ""}
                      placeholder="Ej: -78.183406"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">SEO Title Personalizado</label>
                    <input
                      type="text"
                      name="seoTitle"
                      defaultValue={restaurant.seoTitle || ""}
                      placeholder="Ej: Las Empanadas de Mauro | Menú y Pedidos en Montañita"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">SEO Meta Description</label>
                    <input
                      type="text"
                      name="seoDescription"
                      defaultValue={restaurant.seoDescription || ""}
                      placeholder="Ej: Consulta el menú digital de Las Empanadas de Mauro en Montañita."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Palabras Clave (Keywords)</label>
                    <input
                      type="text"
                      name="seoKeywords"
                      defaultValue={restaurant.seoKeywords || ""}
                      placeholder="Ej: empanadas montanita, comida montanita, menu digital ecuador"
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-950/20 transition-all duration-200"
                >
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>

            {/* Advanced Horarios & Bloqueo de Fechas Card */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-amber-400" />
                    Horarios de Atención y Bloqueo de Fechas/Horas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configura los horarios del local, los horarios a domicilio y congela días o rangos de horas por feriados, eventos o cierres.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSchedules}
                  disabled={savingSchedule}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                  <Save className="h-4 w-4" />
                  {savingSchedule ? "Guardando..." : "Guardar Horarios"}
                </button>
              </div>

              {scheduleMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${scheduleMsg.startsWith("Error") ? "bg-red-950/60 text-red-300 border border-red-800" : "bg-emerald-950/60 text-emerald-300 border border-emerald-800"}`}>
                  {scheduleMsg}
                </div>
              )}

              {/* 1. Local Schedule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    1. Horario de Atención en el Local (Comer en Mesa / Llevar)
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyMondayToAllLocal}
                    className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    Copiar Lunes a todos los días
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as (keyof WeeklySchedule)[]).map((dayKey) => {
                    const conf = localSchedule[dayKey];
                    return (
                      <div key={dayKey} className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-white min-w-[90px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={conf.active}
                            onChange={(e) => {
                              setLocalSchedule(prev => ({
                                ...prev,
                                [dayKey]: { ...prev[dayKey], active: e.target.checked }
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span>{DAY_LABELS[dayKey]}</span>
                        </label>

                        {conf.active ? (
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="time"
                              value={conf.open}
                              onChange={(e) => {
                                setLocalSchedule(prev => ({
                                  ...prev,
                                  [dayKey]: { ...prev[dayKey], open: e.target.value }
                                }));
                              }}
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                            />
                            <span className="text-slate-500 font-bold">-</span>
                            <input
                              type="time"
                              value={conf.close}
                              onChange={(e) => {
                                setLocalSchedule(prev => ({
                                  ...prev,
                                  [dayKey]: { ...prev[dayKey], close: e.target.value }
                                }));
                              }}
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 italic">Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Delivery Schedule */}
              <div className="border-t border-slate-800/80 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-amber-400" />
                    2. Horario de Envíos a Domicilio
                  </h4>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameDeliverySchedule}
                      onChange={(e) => setSameDeliverySchedule(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span>Mismo horario que el local</span>
                  </label>
                </div>

                {!sameDeliverySchedule && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as (keyof WeeklySchedule)[]).map((dayKey) => {
                      const conf = deliverySchedule[dayKey];
                      return (
                        <div key={dayKey} className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-white min-w-[90px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={conf.active}
                              onChange={(e) => {
                                setDeliverySchedule(prev => ({
                                  ...prev,
                                  [dayKey]: { ...prev[dayKey], active: e.target.checked }
                                }));
                              }}
                              className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                            <span>{DAY_LABELS[dayKey]}</span>
                          </label>

                          {conf.active ? (
                            <div className="flex items-center gap-1 text-xs">
                              <input
                                type="time"
                                value={conf.open}
                                onChange={(e) => {
                                  setDeliverySchedule(prev => ({
                                    ...prev,
                                    [dayKey]: { ...prev[dayKey], open: e.target.value }
                                  }));
                                }}
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                              />
                              <span className="text-slate-500 font-bold">-</span>
                              <input
                                type="time"
                                value={conf.close}
                                onChange={(e) => {
                                  setDeliverySchedule(prev => ({
                                    ...prev,
                                    [dayKey]: { ...prev[dayKey], close: e.target.value }
                                  }));
                                }}
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-500 italic">Sin Entregas</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Blocked Dates / Special Closures */}
              <div className="border-t border-slate-800/80 pt-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    3. Bloqueo de Fechas y Horas Especiales (Feriados, Mantenimiento, Eventos)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bloquea días específicos o rangos de horas para que el sistema impida realizar pedidos en esas fechas.
                  </p>
                </div>

                {/* Form to add blocked date */}
                <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Fecha a bloquear *</label>
                      <input
                        type="date"
                        value={newBlockDate}
                        onChange={(e) => setNewBlockDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Motivo / Descripción</label>
                      <input
                        type="text"
                        placeholder="Ej. Feriado de Navidad, Mantenimiento"
                        value={newBlockReason}
                        onChange={(e) => setNewBlockReason(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={newBlockFullDay}
                          onChange={(e) => setNewBlockFullDay(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        <span>Bloquear todo el día</span>
                      </label>
                    </div>
                  </div>

                  {!newBlockFullDay && (
                    <div className="flex items-center gap-3 text-xs border-t border-slate-850 pt-2">
                      <span className="text-slate-400 font-semibold">Bloquear rango de hora:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Desde</span>
                        <input
                          type="time"
                          value={newBlockStartTime}
                          onChange={(e) => setNewBlockStartTime(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-white font-mono focus:outline-none"
                        />
                        <span className="text-slate-500">hasta</span>
                        <input
                          type="time"
                          value={newBlockEndTime}
                          onChange={(e) => setNewBlockEndTime(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddBlockedDate}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 active:scale-95"
                    >
                      <Plus className="h-4 w-4 text-amber-400" />
                      <span>Agregar Fecha Bloqueada</span>
                    </button>
                  </div>
                </div>

                {/* List of blocked dates */}
                {blockedDatesList.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                          <th className="pb-2 pl-2">Fecha</th>
                          <th className="pb-2">Motivo</th>
                          <th className="pb-2">Duración / Hora</th>
                          <th className="pb-2 text-right pr-2">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {blockedDatesList.map((item) => (
                          <tr key={item.id} className="text-slate-300">
                            <td className="py-2.5 pl-2 font-mono font-bold text-amber-400">
                              {item.date}
                            </td>
                            <td className="py-2.5 font-semibold text-white">
                              {item.reason}
                            </td>
                            <td className="py-2.5 text-slate-400">
                              {item.fullDay ? (
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold text-[10px]">
                                  Todo el día
                                </span>
                              ) : (
                                <span className="font-mono text-xs">
                                  {item.startTime} - {item.endTime}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right pr-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveBlockedDate(item.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition"
                                title="Eliminar bloqueo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Categorías Tab */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Categorías</h2>
                <p className="text-slate-400 text-sm">Organiza tu menú por secciones como Entradas, Pizzas, Bebidas.</p>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setNewCatName("");
                  setNewCatOrder((categoriesList.length + 1).toString());
                  setNewCatAspect("DEFAULT");
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </button>
            </div>

            {/* List of categories */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Orden / Posición</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Formato Fotos</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Cantidad Platos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {categoriesList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                        No hay categorías creadas aún.
                      </td>
                    </tr>
                  ) : (
                    categoriesList.map((cat, index) => (
                      <tr key={cat.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{cat.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2.5 rounded-xl bg-slate-950/90 text-xs font-bold text-amber-400 border border-slate-800 shadow-inner">
                              #{cat.order}
                            </span>
                            <div className="inline-flex items-center bg-slate-950/90 rounded-xl p-0.5 border border-slate-800 gap-0.5 shadow-sm">
                              <button
                                type="button"
                                disabled={index === 0 || reorderingCatId !== null}
                                onClick={() => handleMoveCategory(cat.id, "up")}
                                title="Subir posición (mostrar antes)"
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                              >
                                {reorderingCatId === cat.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                                ) : (
                                  <ChevronUp className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={index === categoriesList.length - 1 || reorderingCatId !== null}
                                onClick={() => handleMoveCategory(cat.id, "down")}
                                title="Bajar posición (mostrar después)"
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {cat.imageAspectRatio === "9:16" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              📱 9:16 Vertical
                            </span>
                          ) : cat.imageAspectRatio === "1:1" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                              ◻️ 1:1 Estándar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60" title="Hereda el formato configurado a nivel de negocio">
                              ⚙️ Negocio ({imageAspectRatio === "9:16" ? "9:16" : "1:1"})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{(cat.dishes || []).length} platos</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setNewCatName(cat.name);
                              setNewCatOrder(cat.order.toString());
                              setNewCatAspect(cat.imageAspectRatio || "DEFAULT");
                              setIsCategoryModalOpen(true);
                            }}
                            className="inline-flex p-2 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg transition-all"
                            title="Editar Categoría"
                          >
                            <Edit2 className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"? Se borrarán todos sus platos.`)) {
                                const res = await deleteCategoryAction(cat.id);
                                if (res && 'error' in res && res.error) {
                                  alert(res.error);
                                } else {
                                  alert(`¡Categoría "${cat.name}" eliminada con éxito!`);
                                  window.location.reload();
                                }
                              }
                            }}
                            className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
                            title="Eliminar Categoría"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Add/Edit Modal */}
            {isCategoryModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
                  </h3>
                  <form
                    action={async (formData) => {
                      if (editingCategory) {
                        const res = await updateCategoryAction(editingCategory.id, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        alert("¡Categoría guardada con éxito!");
                      } else {
                        const res = await createCategoryAction(restaurant.id, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        alert("¡Categoría creada con éxito!");
                      }
                      setIsCategoryModalOpen(false);
                      window.location.reload();
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de la Categoría</label>
                      <input
                        type="text"
                        name="name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="ej: Vinos y Licores, Picadas, Pizzas"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Orden de visualización</label>
                      <input
                        type="number"
                        name="order"
                        value={newCatOrder}
                        onChange={(e) => setNewCatOrder(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Formato de Fotos de esta Categoría
                      </label>
                      <input type="hidden" name="imageAspectRatio" value={newCatAspect} />
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewCatAspect("DEFAULT")}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            newCatAspect === "DEFAULT"
                              ? "bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50"
                              : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-base">⚙️</span>
                            {newCatAspect === "DEFAULT" && <Check className="h-4 w-4 text-amber-400" />}
                          </div>
                          <span className="text-xs font-bold leading-tight">Por Negocio</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{imageAspectRatio === "9:16" ? "9:16 Vertical" : "1:1 Estándar"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewCatAspect("1:1")}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            newCatAspect === "1:1"
                              ? "bg-sky-500/10 border-sky-500 text-white shadow-md shadow-sky-500/10 ring-1 ring-sky-500/50"
                              : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-base">◻️</span>
                            {newCatAspect === "1:1" && <Check className="h-4 w-4 text-sky-400" />}
                          </div>
                          <span className="text-xs font-bold leading-tight">1:1 Estándar</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Cuadrado clásico</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewCatAspect("9:16")}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            newCatAspect === "9:16"
                              ? "bg-purple-500/10 border-purple-500 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500/50"
                              : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-base">📱</span>
                            {newCatAspect === "9:16" && <Check className="h-4 w-4 text-purple-400" />}
                          </div>
                          <span className="text-xs font-bold leading-tight">9:16 Vertical</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Reels / Botellas</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Ideal para negocios con catálogo mixto: licores/vinos en 9:16 alargado, y platos/snacks en 1:1.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
                      {editingCategory && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`¿Estás seguro de eliminar la categoría "${editingCategory.name}"? Se borrarán todos sus platos.`)) {
                              const res = await deleteCategoryAction(editingCategory.id);
                              if (res && 'error' in res && res.error) {
                                alert(res.error);
                              } else {
                                setIsCategoryModalOpen(false);
                                alert(`¡Categoría "${editingCategory.name}" eliminada con éxito!`);
                                window.location.reload();
                              }
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 transition flex items-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 transition"
                        >
                          {editingCategory ? "Guardar Cambios" : "Crear"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Platos Tab */}
        {activeTab === "dishes" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{bLabels.itemsPageTitle}</h2>
                  {suggestedDishIds.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {suggestedDishIds.length} Sugerido{suggestedDishIds.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">
                  {isRetail
                    ? "Gestiona el catálogo completo: precios, imágenes, stock y disponibilidad."
                    : "Gestiona la carta completa: precios, imágenes, sugeridos y disponibilidad."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportDishesExcel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-all duration-200 shadow-sm"
                  title="Descargar catálogo completo en formato Excel (.xlsx)"
                >
                  <Download className="h-4 w-4" />
                  {bLabels.exportExcelButton}
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchDishModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all duration-200 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {bLabels.importExcelButton}
                </button>
                <button
                  disabled={categoriesList.length === 0}
                  onClick={() => {
                    setEditingDish(null);
                    setDishName("");
                    setDishDescription("");
                    setDishPrice("0");
                    setDishCostPrice("0");
                    setDishSupplierId("");
                    setDishBarcode("");
                    setDishImageUrl("");
                    setDishImageUrl1("");
                    setDishImageUrl2("");
                    setDishImageUrl3("");
                    setDishImage1Error(false);
                    setDishImage2Error(false);
                    setDishImage3Error(false);
                    setDishImageSlotTab(0);
                    setDishBeds("");
                    setDishMaxGuests("");
                    setDishHasVariants(false);
                    setDishAttr1Name("Presentación");
                    setDishAttr1Options("");
                    setDishAttr2Name("");
                    setDishAttr2Options("");
                    setDishAvailable(true);
                    setDishSuggested(false);
                    setDishTrackStock(!bLabels.isGastro);
                    setDishStock("10");
                    setDishMinStock("3");
                    setDishCatId(categoriesList[0]?.id || "");
                    setIsDishModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  {bLabels.newItemButton}
                </button>
              </div>
            </div>

            {/* Resumen de Inventario y Control de Stock */}
            {categoriesList.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{bLabels.stockSectionTitle}</span>
                        {lowStockDishesCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            ⚠️ {lowStockDishesCount} en Stock Crítico
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {bLabels.isGastro
                          ? "Monitorea porciones preparadas, raciones del día y platos agotados en cocina."
                          : "Control de existencias físicas, valorización de bodega y alertas de reposición a proveedores."}
                      </p>
                    </div>
                  </div>

                  {/* Filtros rápidos por estado de stock */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDishStockFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        dishStockFilter === "ALL"
                          ? "bg-slate-700 text-white shadow-sm"
                          : "bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      Todos ({allDishesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishStockFilter("TRACKED")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        dishStockFilter === "TRACKED"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 border border-emerald-900/40"
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Con Stock ({trackedDishesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishStockFilter("LOW_STOCK")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        dishStockFilter === "LOW_STOCK"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-amber-950/20 text-amber-300 hover:bg-amber-900/30 border border-amber-900/40"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Stock Crítico ({lowStockDishesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishStockFilter("OUT_OF_STOCK")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        dishStockFilter === "OUT_OF_STOCK"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-rose-950/20 text-rose-300 hover:bg-rose-900/30 border border-rose-900/40"
                      }`}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Agotados ({outOfStockDishesCount})
                    </button>
                  </div>
                </div>

                {/* KPI Cards de Inventario Adaptativos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {bLabels.isGastro ? "Porciones Disponibles" : "Unidades en Almacén"}
                      </span>
                      <p className="text-xl font-black text-emerald-400 mt-0.5">{totalStockUnits} {bLabels.stockUnitPlural}</p>
                      <span className="text-[10px] text-slate-500">en {trackedDishesCount} {bLabels.items.toLowerCase()} monitoreados</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Package className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Stock Crítico / Alerta</span>
                      <p className="text-xl font-black text-amber-400 mt-0.5">{lowStockDishesCount} {bLabels.items.toLowerCase()}</p>
                      <span className="text-[10px] text-slate-500">por debajo del stock mínimo</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{bLabels.items} Agotados</span>
                      <p className="text-xl font-black text-rose-400 mt-0.5">{outOfStockDishesCount} {bLabels.items.toLowerCase()}</p>
                      <span className="text-[10px] text-slate-500">stock en 0 o desactivados</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                      <EyeOff className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Banner de Valorización de Inventario (Opción 2) */}
                {(!bLabels.isGastro || totalInventoryRetailValue > 0) && totalInventoryRetailValue > 0 && (
                  <div className="p-3 bg-gradient-to-r from-cyan-950/30 via-slate-950 to-slate-950 border border-cyan-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 text-cyan-300">
                      <span className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 font-bold">$</span>
                      <div>
                        <span className="font-bold">Valorización Total de Bodega:</span>
                        <span className="text-slate-400 ml-1.5">
                          En venta: <strong className="text-emerald-400">${totalInventoryRetailValue.toFixed(2)}</strong>
                          {totalInventoryCostValue > 0 && (
                            <> · Costo de compra: <strong className="text-slate-300">${totalInventoryCostValue.toFixed(2)}</strong> (Margen estimado: <strong className="text-cyan-300">${(totalInventoryRetailValue - totalInventoryCostValue).toFixed(2)}</strong>)</>
                          )}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 self-start sm:self-auto">
                      {bLabels.isGastro ? "Carta Valorizada" : "Bodega Retail"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {categoriesList.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                Debes crear al menos una categoría antes de agregar {bLabels.items.toLowerCase()}.
              </div>
            ) : (
              <div className="space-y-8">
                {categoriesList.map((cat) => (
                  <div key={cat.id} className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="text-red-500">#</span> {cat.name}
                    </h3>
                    
                    {(() => {
                      const displayedDishes = cat.dishes.filter((dish) => {
                        if (dishStockFilter === "TRACKED") return Boolean(dish.trackStock);
                        if (dishStockFilter === "LOW_STOCK") return Boolean(dish.trackStock) && (dish.stock ?? 0) <= (dish.minStock ?? 0) && (dish.stock ?? 0) > 0;
                        if (dishStockFilter === "OUT_OF_STOCK") return !dish.isAvailable || (Boolean(dish.trackStock) && (dish.stock ?? 0) <= 0);
                        return true;
                      });

                      if (displayedDishes.length === 0) {
                        return (
                          <p className="text-slate-500 text-xs italic">
                            {cat.dishes.length === 0 
                              ? `No hay ${bLabels.items.toLowerCase()} en esta categoría.` 
                              : `No hay ${bLabels.items.toLowerCase()} en esta categoría que coincidan con el filtro seleccionado.`}
                          </p>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {displayedDishes.map((dish) => (
                          <div 
                            key={dish.id} 
                            className={`bg-slate-900/40 border rounded-2xl p-4 flex gap-4 transition-all ${
                              dish.isAvailable ? "border-slate-800/80" : "border-slate-900 opacity-60"
                            }`}
                          >
                            {/* Image o Icono Técnico */}
                            <div className="h-20 w-20 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-slate-800 relative">
                              {(() => {
                                const images = parseDishImages(dish.imageUrl);
                                const primary = images[0] || null;
                                const isServicesType = bLabels.itemSingle === "Servicio" || selectedBusinessType === "SERVICES";
                                if (primary) {
                                  return (
                                    <>
                                      <img src={primary} alt={dish.name} className="h-full w-full object-cover" />
                                      {images.length > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur text-[9px] font-bold text-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          📷 {images.length}
                                        </span>
                                      )}
                                    </>
                                  );
                                }
                                if (isServicesType) {
                                  return (
                                    <div className="h-full w-full flex flex-col items-center justify-center bg-cyan-950/30 text-cyan-400 gap-1 border border-cyan-500/20">
                                      <Wrench className="w-6 h-6 text-cyan-400" />
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">Servicio</span>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-600">Sin foto</div>
                                );
                              })()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="font-bold text-white text-sm line-clamp-1">{dish.name}</h4>
                                  <span className="text-red-400 font-bold text-sm shrink-0">${dish.price.toFixed(2)}</span>
                                </div>
                                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{dish.description || "Sin descripción."}</p>
                              </div>

                              <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Availability toggle */}
                                  <button
                                    onClick={() => handleToggleDish(dish.id, dish.isAvailable)}
                                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                      dish.isAvailable 
                                        ? "bg-green-500/10 text-green-400 border-green-500/30" 
                                        : "bg-red-500/10 text-red-400 border-red-500/30"
                                    }`}
                                  >
                                    {dish.isAvailable ? (
                                      <>
                                        <Eye className="h-3 w-3" /> Disponible
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="h-3 w-3" /> Agotado
                                      </>
                                    )}
                                  </button>

                                  {/* Stock Badge & Quick Stepper if trackStock is true */}
                                  {dish.trackStock && (
                                    <div className="inline-flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-full text-xs">
                                      {(dish.stock ?? 0) <= 0 ? (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                          Agotado (0)
                                        </span>
                                      ) : (dish.stock ?? 0) <= (dish.minStock ?? 0) ? (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400" title={`Alerta de stock mínimo: quedan ${dish.stock} porciones`}>
                                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                                          Stock Crítico: {dish.stock}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                                          <Package className="h-3 w-3 text-emerald-400" />
                                          Stock: {dish.stock}
                                        </span>
                                      )}

                                      <div className="flex items-center gap-0.5 border-l border-slate-800 pl-1">
                                        <button
                                          type="button"
                                          title={`Restar 1 ${bLabels.stockUnitSingular}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickUpdateStock(dish.id, Math.max(0, (dish.stock ?? 0) - 1));
                                          }}
                                          className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 rounded font-bold transition"
                                        >
                                          -1
                                        </button>
                                        <button
                                          type="button"
                                          title={`Reponer +5 ${bLabels.stockUnitPlural}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickUpdateStock(dish.id, (dish.stock ?? 0) + 5);
                                          }}
                                          className="px-1 py-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded font-bold transition"
                                        >
                                          +5
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Sugerido / Plato del Día toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSuggestedDish(dish.id)}
                                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                      suggestedDishIds.includes(dish.id)
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/15"
                                        : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-amber-300 hover:border-amber-500/40"
                                    }`}
                                    title={suggestedDishIds.includes(dish.id) ? `${bLabels.itemSingle} ${bLabels.isGastro ? "Sugerido / Especial de Hoy" : "Destacado"} (Activo)` : `Marcar como ${bLabels.itemSingle} ${bLabels.isGastro ? "Sugerido" : "Destacado"}`}
                                  >
                                    <Star className={`h-3 w-3 ${suggestedDishIds.includes(dish.id) ? "fill-amber-400 text-amber-400" : ""}`} />
                                    <span>{suggestedDishIds.includes(dish.id) ? (bLabels.isGastro ? "Sugerido ⭐" : "Destacado ⭐") : (bLabels.isGastro ? "Hacer Sugerido" : "Hacer Destacado")}</span>
                                  </button>
                                </div>

                                {/* Edit / Delete Actions */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingDish(dish);
                                      setDishName(dish.name);
                                      setDishDescription(dish.description || "");
                                      setDishPrice(dish.price.toString());
                                      setDishCostPrice(((dish.costPrice as any) ?? 0).toString());
                                      setDishSupplierId(dish.supplierId || dish.supplier?.id || "");
                                      setDishBarcode(dish.barcode || dish.sku || "");
                                      setDishImageUrl(dish.imageUrl || "");
                                      const parsedImgs = parseDishImages(dish.imageUrl);
                                      setDishImageUrl1(parsedImgs[0] || "");
                                      setDishImageUrl2(parsedImgs[1] || "");
                                      setDishImageUrl3(parsedImgs[2] || "");
                                      setDishImage1Error(false);
                                      setDishImage2Error(false);
                                      setDishImage3Error(false);
                                      setDishImageSlotTab(0);
                                      let initialBeds = "";
                                      let initialGuests = "";
                                      let initialHasVariants = false;
                                      let initialAttr1Name = "Presentación";
                                      let initialAttr1Options = "";
                                      let initialAttr2Name = "";
                                      let initialAttr2Options = "";
                                      if (dish.variants) {
                                        try {
                                          const parsed = typeof dish.variants === "string" ? JSON.parse(dish.variants) : dish.variants;
                                          if (parsed && typeof parsed === "object") {
                                            if (parsed.beds) initialBeds = String(parsed.beds);
                                            if (parsed.maxGuests) initialGuests = String(parsed.maxGuests);
                                            if (parsed.hasVariants || (Array.isArray(parsed.attribute1Options) && parsed.attribute1Options.length > 0)) {
                                              initialHasVariants = Boolean(parsed.hasVariants ?? true);
                                              initialAttr1Name = parsed.attribute1Name || "Presentación";
                                              initialAttr1Options = Array.isArray(parsed.attribute1Options) ? parsed.attribute1Options.join(", ") : "";
                                              initialAttr2Name = parsed.attribute2Name || "";
                                              initialAttr2Options = Array.isArray(parsed.attribute2Options) ? parsed.attribute2Options.join(", ") : "";
                                            } else if (Array.isArray(parsed.tallas) && parsed.tallas.length > 0) {
                                              initialHasVariants = true;
                                              initialAttr1Name = "Talla";
                                              initialAttr1Options = parsed.tallas.join(", ");
                                              if (Array.isArray(parsed.colores) && parsed.colores.length > 0) {
                                                initialAttr2Name = "Color";
                                                initialAttr2Options = parsed.colores.join(", ");
                                              }
                                            }
                                          }
                                        } catch {}
                                      }
                                      setDishBeds(initialBeds);
                                      setDishMaxGuests(initialGuests);
                                      setDishHasVariants(initialHasVariants);
                                      setDishAttr1Name(initialAttr1Name);
                                      setDishAttr1Options(initialAttr1Options);
                                      setDishAttr2Name(initialAttr2Name);
                                      setDishAttr2Options(initialAttr2Options);
                                      setDishAvailable(dish.isAvailable);
                                      setDishSuggested(suggestedDishIds.includes(dish.id));
                                      setDishTrackStock(Boolean(dish.trackStock));
                                      setDishStock((dish.stock ?? 10).toString());
                                      setDishMinStock((dish.minStock ?? 3).toString());
                                      setDishCatId(dish.categoryId);
                                      setIsDishModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 transition"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`¿Estás seguro de eliminar el plato "${dish.name}"?`)) {
                                        const res = await deleteDishAction(dish.id);
                                        if (res && 'error' in res && res.error) {
                                          alert(res.error);
                                        } else {
                                          alert(`¡Plato "${dish.name}" eliminado con éxito!`);
                                          window.location.reload();
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-red-400/80 hover:text-red-400 bg-red-950/20 border border-red-900/20 rounded-lg hover:bg-red-950/40 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* Dish Add/Edit Modal */}
            {isDishModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-y-auto max-h-[90vh]">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingDish ? `Editar ${bLabels.itemSingle}` : `Nuevo ${bLabels.itemSingle}`}
                  </h3>
                  <form
                    action={async (formData) => {
                      // Append explicitly isAvailable since toggle has client state
                      formData.append("isAvailable", dishAvailable.toString());
                      formData.append("trackStock", dishTrackStock.toString());
                      formData.append("stock", dishStock);
                      formData.append("minStock", dishMinStock);
                      formData.append("costPrice", dishCostPrice);
                      formData.append("supplierId", dishSupplierId);
                      formData.append("barcode", dishBarcode);
                      const serializedImages = serializeDishImages([dishImageUrl1, dishImageUrl2, dishImageUrl3]);
                      formData.set("imageUrl", serializedImages || "");
                      
                      // Variantes y metadatos de hospedaje (camas y huéspedes)
                      const variantsObj: any = {};
                      if (editingDish?.variants) {
                        try {
                          const parsed = typeof editingDish.variants === "string" ? JSON.parse(editingDish.variants) : editingDish.variants;
                          if (parsed && typeof parsed === "object") Object.assign(variantsObj, parsed);
                        } catch {}
                      }
                      if (dishBeds.trim()) {
                        variantsObj.beds = dishBeds.trim();
                      } else {
                        delete variantsObj.beds;
                      }
                      if (dishMaxGuests.trim() && parseInt(dishMaxGuests, 10) > 0) {
                        variantsObj.maxGuests = parseInt(dishMaxGuests, 10);
                      } else {
                        delete variantsObj.maxGuests;
                      }

                      // Guardar variantes semánticas (Alternativa 1 y 2)
                      if (dishHasVariants && dishAttr1Name.trim() && dishAttr1Options.trim()) {
                        variantsObj.hasVariants = true;
                        variantsObj.attribute1Name = dishAttr1Name.trim();
                        variantsObj.attribute1Options = dishAttr1Options.split(",").map(s => s.trim()).filter(Boolean);
                        if (dishAttr2Name.trim() && dishAttr2Options.trim()) {
                          variantsObj.attribute2Name = dishAttr2Name.trim();
                          variantsObj.attribute2Options = dishAttr2Options.split(",").map(s => s.trim()).filter(Boolean);
                        } else {
                          delete variantsObj.attribute2Name;
                          delete variantsObj.attribute2Options;
                        }
                        if (dishAttr1Name.trim().toLowerCase() === "talla") {
                          variantsObj.tallas = variantsObj.attribute1Options;
                        }
                        if (dishAttr2Name.trim().toLowerCase() === "color") {
                          variantsObj.colores = variantsObj.attribute2Options;
                        }
                      } else {
                        variantsObj.hasVariants = false;
                        delete variantsObj.attribute1Name;
                        delete variantsObj.attribute1Options;
                        delete variantsObj.attribute2Name;
                        delete variantsObj.attribute2Options;
                        delete variantsObj.tallas;
                        delete variantsObj.colores;
                      }

                      const finalVariants = Object.keys(variantsObj).length > 0 ? JSON.stringify(variantsObj) : "";
                      formData.append("variants", finalVariants);
                      
                      if (editingDish) {
                        const res = await updateDishAction(editingDish.id, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        if (dishSuggested !== suggestedDishIds.includes(editingDish.id)) {
                          await toggleSuggestedDishAction(restaurant.id, editingDish.id);
                        }
                        alert(`¡${bLabels.itemSingle} guardado con éxito!`);
                      } else {
                        const res = await createDishAction(dishCatId, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        if (res && 'dish' in res && res.dish && dishSuggested) {
                          await toggleSuggestedDishAction(restaurant.id, (res.dish as any).id);
                        }
                        alert(`¡${bLabels.itemSingle} creado con éxito!`);
                      }
                      setIsDishModalOpen(false);
                      window.location.reload();
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del {bLabels.itemSingle}</label>
                        <input
                          type="text"
                          name="name"
                          value={dishName}
                          onChange={(e) => setDishName(e.target.value)}
                          required
                          placeholder={`ej: ${bLabels.itemSingle === "Producto" ? "Whisky Johnnie Walker Black Label 750ml" : bLabels.itemSingle === "Servicio" ? "Mantenimiento Preventivo" : "Pizza Margherita Especial"}`}
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
                        <select
                          name="categoryId"
                          value={dishCatId}
                          onChange={(e) => setDishCatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                        >
                          {restaurant.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Precio de Venta ($)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                          <input
                            type="number"
                            name="price"
                            step="0.01"
                            value={dishPrice}
                            onChange={(e) => setDishPrice(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-850 block pl-8 pr-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      {/* Elementos clave de Producto/Stock (Opción 2) */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Costo de Compra ($) <span className="text-[10px] text-slate-500">(opcional)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                          <input
                            type="number"
                            name="costPrice"
                            step="0.01"
                            value={dishCostPrice}
                            onChange={(e) => setDishCostPrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-950 border border-slate-850 block pl-8 pr-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Código de Barras / SKU <span className="text-[10px] text-slate-500">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          name="barcode"
                          value={dishBarcode}
                          onChange={(e) => setDishBarcode(e.target.value)}
                          placeholder="ej: 786123456789 o PROD-001"
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Proveedor Habitual <span className="text-[10px] text-slate-500">(opcional)</span>
                        </label>
                        <select
                          name="supplierId"
                          value={dishSupplierId}
                          onChange={(e) => setDishSupplierId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                        >
                          <option value="">-- Sin proveedor habitual --</option>
                          {((restaurant.suppliers as any[]) || []).map((sup: any) => (
                            <option key={sup.id} value={sup.id}>
                              {sup.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {parseFloat(dishPrice) > 0 && parseFloat(dishCostPrice) > 0 && (
                        <div className="col-span-2 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            <span>Margen Comercial Estimado:</span>
                          </div>
                          <div className="font-bold flex items-center gap-2">
                            <span>+${(parseFloat(dishPrice) - parseFloat(dishCostPrice)).toFixed(2)} / {bLabels.stockUnitSingular}</span>
                            <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-black">
                              {(((parseFloat(dishPrice) - parseFloat(dishCostPrice)) / parseFloat(dishPrice)) * 100).toFixed(1)}% margen
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                      <textarea
                        name="description"
                        rows={2}
                        value={dishDescription}
                        onChange={(e) => setDishDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none text-xs sm:text-sm"
                        placeholder={bLabels.itemSingle === "Producto" ? "ej: Botella de 750 ml de licor importado 40% Alc. Vol..." : "ej: Detalle de ingredientes o especificaciones del servicio..."}
                      />
                    </div>

                    {/* Campos de Hospedaje: Distribución de camas y Capacidad de huéspedes */}
                    {(isLodging || dishBeds || dishMaxGuests) && (
                      <div className="p-3.5 bg-emerald-950/25 border border-emerald-500/30 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BedDouble className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs font-bold text-white">Detalles de Alojamiento (Insignias de Tarjeta)</span>
                          </div>
                          {(dishBeds || dishMaxGuests) && (
                            <button
                              type="button"
                              onClick={() => {
                                setDishBeds("");
                                setDishMaxGuests("");
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 transition underline cursor-pointer"
                            >
                              ✕ Quitar ambas insignias
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              🛏️ Distribución de Camas / Baño
                            </label>
                            <input
                              type="text"
                              value={dishBeds}
                              onChange={(e) => setDishBeds(e.target.value)}
                              placeholder="ej: Camas equipadas y baño privado"
                              className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              💡 Déjalo vacío si no deseas mostrar camas en la tarjeta.
                            </p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              👥 Capacidad Máxima (Huéspedes)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={dishMaxGuests}
                              onChange={(e) => setDishMaxGuests(e.target.value)}
                              placeholder="ej: 4"
                              className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              💡 Déjalo vacío o en 0 para no mostrar capacidad.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Variantes y Presentaciones del Producto (Alternativa 1 y 2) */}
                    <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="dishHasVariants" className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                          <Layers className="h-4 w-4 text-amber-400" />
                          <span>Habilitar Variantes / Presentaciones</span>
                        </label>
                        <input
                          type="checkbox"
                          id="dishHasVariants"
                          checked={dishHasVariants}
                          onChange={(e) => setDishHasVariants(e.target.checked)}
                          className="h-4 w-4 text-amber-500 focus:ring-amber-400 border-slate-800 rounded bg-slate-900 cursor-pointer"
                        />
                      </div>
                      
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {dishHasVariants
                          ? "Define las opciones disponibles (ej: Six-Pack, Unidad, Litro, Temperatura). El cliente elegirá antes de añadir."
                          : "⚡ Modo Compra Directa: Desactivado. El cliente agregará este producto al carrito con 1 solo clic sin preguntas ni ventanas innecesarias."}
                      </p>

                      {dishHasVariants && (
                        <div className="pt-3 border-t border-slate-850 space-y-3.5">
                          {/* Botones de configuración rápida / presets */}
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                              ⚡ Plantillas Rápidas (1 Clic)
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDishAttr1Name("Presentación");
                                  setDishAttr1Options("Unidad, Six-Pack, Pack x12, Caja");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-750 text-[11px] font-medium text-amber-300 transition cursor-pointer"
                              >
                                🍾 Presentación (Cervezas / Licores)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDishAttr1Name("Volumen");
                                  setDishAttr1Options("375 ml, 750 ml, 1 Litro, 1.75 L");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-750 text-[11px] font-medium text-amber-300 transition cursor-pointer"
                              >
                                📏 Volumen (Botellas)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDishAttr2Name("Temperatura");
                                  setDishAttr2Options("Bien Helada ❄️, Al Clima");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-750 text-[11px] font-medium text-sky-300 transition cursor-pointer"
                              >
                                ❄️ + Temperatura
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDishAttr1Name("Talla");
                                  setDishAttr1Options("S, M, L, XL");
                                  setDishAttr2Name("Color");
                                  setDishAttr2Options("Negro, Blanco, Azul");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-750 text-[11px] font-medium text-slate-300 transition cursor-pointer"
                              >
                                👕 Ropa (Talla & Color)
                              </button>
                            </div>
                          </div>

                          {/* Atributo 1 */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Nombre Atributo 1 *
                              </label>
                              <input
                                type="text"
                                value={dishAttr1Name}
                                onChange={(e) => setDishAttr1Name(e.target.value)}
                                placeholder="ej: Presentación o Volumen"
                                className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Opciones (separadas por coma) *
                              </label>
                              <input
                                type="text"
                                value={dishAttr1Options}
                                onChange={(e) => setDishAttr1Options(e.target.value)}
                                placeholder="ej: Unidad, Six-Pack, Pack x12, Caja"
                                className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Atributo 2 (Opcional) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Atributo 2 <span className="text-[10px] text-slate-500">(opcional)</span>
                              </label>
                              <input
                                type="text"
                                value={dishAttr2Name}
                                onChange={(e) => setDishAttr2Name(e.target.value)}
                                placeholder="ej: Temperatura o Color"
                                className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Opciones Atributo 2 (separadas por coma)
                              </label>
                              <input
                                type="text"
                                value={dishAttr2Options}
                                onChange={(e) => setDishAttr2Options(e.target.value)}
                                placeholder="ej: Bien Helada ❄️, Al Clima"
                                className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="block text-xs font-bold text-white tracking-wide">
                            {bLabels.itemSingle === "Servicio"
                              ? "FOTOS REFERENCIALES DEL SERVICIO (OPCIONAL)"
                              : `GALERÍA DE FOTOS DEL ${bLabels.itemSingle.toUpperCase()} (HASTA 3 ÁNGULOS)`}
                          </label>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {bLabels.itemSingle === "Servicio"
                              ? "En servicios no es obligatorio subir fotos. Si lo deseas, puedes añadir una imagen representativa del trabajo."
                              : "Sube hasta 3 fotos (ej: Frente, Espalda / Dorso y Detalle para ropa o productos)."}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          ✨ WebP · máx 1200 px · opcional
                        </span>
                      </div>

                      {/* Selector de pestañas para las 3 fotos */}
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setDishImageSlotTab(0)}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            dishImageSlotTab === 0
                              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-900"
                          }`}
                        >
                          <span>📸 Foto 1: Frente</span>
                          {dishImageUrl1.trim() && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDishImageSlotTab(1)}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            dishImageSlotTab === 1
                              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-900"
                          }`}
                        >
                          <span>🔄 Foto 2: Espalda</span>
                          {dishImageUrl2.trim() && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDishImageSlotTab(2)}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            dishImageSlotTab === 2
                              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-900"
                          }`}
                        >
                          <span>🔍 Foto 3: Detalle</span>
                          {dishImageUrl3.trim() && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          )}
                        </button>
                      </div>

                      {/* Formulario y vista previa de la pestaña activa */}
                      <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            {dishImageSlotTab === 0 && "📸 Foto 1: Frente / Portada (Principal en listados)"}
                            {dishImageSlotTab === 1 && "🔄 Foto 2: Dorso / Espalda (Hover en catálogo web)"}
                            {dishImageSlotTab === 2 && "🔍 Foto 3: Ángulo extra o detalle (Textura / Empaque)"}
                          </span>
                          {((dishImageSlotTab === 0 && dishImageUrl1) ||
                            (dishImageSlotTab === 1 && dishImageUrl2) ||
                            (dishImageSlotTab === 2 && dishImageUrl3)) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (dishImageSlotTab === 0) {
                                  setDishImageUrl1("");
                                  setDishImage1Error(false);
                                } else if (dishImageSlotTab === 1) {
                                  setDishImageUrl2("");
                                  setDishImage2Error(false);
                                } else {
                                  setDishImageUrl3("");
                                  setDishImage3Error(false);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              ✕ Quitar foto
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                          <div className="sm:col-span-2 space-y-2">
                            <input
                              type="text"
                              value={
                                dishImageSlotTab === 0
                                  ? dishImageUrl1
                                  : dishImageSlotTab === 1
                                  ? dishImageUrl2
                                  : dishImageUrl3
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (dishImageSlotTab === 0) {
                                  setDishImageUrl1(val);
                                  setDishImage1Error(false);
                                } else if (dishImageSlotTab === 1) {
                                  setDishImageUrl2(val);
                                  setDishImage2Error(false);
                                } else {
                                  setDishImageUrl3(val);
                                  setDishImage3Error(false);
                                }
                              }}
                              placeholder={
                                dishImageSlotTab === 0
                                  ? "https://i.postimg.cc/xxxxx/frente.webp"
                                  : dishImageSlotTab === 1
                                  ? "https://i.postimg.cc/xxxxx/espalda.webp"
                                  : "https://i.postimg.cc/xxxxx/detalle.webp"
                              }
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400">
                              {dishImageSlotTab === 0 && "Esta foto se mostrará como imagen principal en el menú y catálogo digital."}
                              {dishImageSlotTab === 1 && "En tiendas y ropa, se mostrará al colocar el cursor sobre el producto o en la galería."}
                              {dishImageSlotTab === 2 && "Foto complementaria para mostrar costuras, etiquetas, empaque o detalle."}
                            </p>
                          </div>

                          <div>
                            <div className="h-24 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-1.5 overflow-hidden relative">
                              {(() => {
                                const currentUrl =
                                  dishImageSlotTab === 0
                                    ? dishImageUrl1
                                    : dishImageSlotTab === 1
                                    ? dishImageUrl2
                                    : dishImageUrl3;
                                const currentError =
                                  dishImageSlotTab === 0
                                    ? dishImage1Error
                                    : dishImageSlotTab === 1
                                    ? dishImage2Error
                                    : dishImage3Error;
                                const setError =
                                  dishImageSlotTab === 0
                                    ? setDishImage1Error
                                    : dishImageSlotTab === 1
                                    ? setDishImage2Error
                                    : setDishImage3Error;

                                if (currentUrl && currentUrl.trim() !== "") {
                                  if (!currentError) {
                                    return (
                                      <img
                                        src={currentUrl.trim()}
                                        alt={`Vista previa ranura ${dishImageSlotTab + 1}`}
                                        onError={() => setError(true)}
                                        className="w-full h-full object-cover rounded-lg shadow"
                                      />
                                    );
                                  }
                                  return (
                                    <div className="text-center p-1">
                                      <p className="text-[10px] text-red-400 font-semibold">⚠️ No cargó</p>
                                      <p className="text-[9px] text-slate-400">Verifica la URL</p>
                                    </div>
                                  );
                                }
                                return (
                                  <span className="text-[11px] text-slate-500 italic">
                                    Ranura {dishImageSlotTab + 1} vacía
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tira de miniaturas de las 3 ranuras simultáneas */}
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Ranuras:
                        </span>
                        <div className="flex items-center gap-2">
                          {[
                            { idx: 0, url: dishImageUrl1, label: "Frente" },
                            { idx: 1, url: dishImageUrl2, label: "Espalda" },
                            { idx: 2, url: dishImageUrl3, label: "Detalle" },
                          ].map((slot) => (
                            <button
                              key={slot.idx}
                              type="button"
                              onClick={() => setDishImageSlotTab(slot.idx as 0 | 1 | 2)}
                              className={`relative w-12 h-12 rounded-lg border overflow-hidden transition cursor-pointer ${
                                dishImageSlotTab === slot.idx
                                  ? "border-amber-400 ring-2 ring-amber-400/30"
                                  : "border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100"
                              }`}
                            >
                              {slot.url && slot.url.trim() ? (
                                <img
                                  src={slot.url.trim()}
                                  alt={slot.label}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-600 text-[9px]">
                                  <span>{slot.idx + 1}</span>
                                </div>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-slate-950/85 text-[8px] text-center text-slate-300 font-medium py-0.2">
                                {slot.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Inputs ocultos para persistencia del formulario */}
                      <input
                        type="hidden"
                        name="imageUrl"
                        value={serializeDishImages([dishImageUrl1, dishImageUrl2, dishImageUrl3]) || ""}
                      />
                      <input
                        type="file"
                        name="dishFile"
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="isAvailable"
                          checked={dishAvailable}
                          onChange={(e) => setDishAvailable(e.target.checked)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-800 rounded bg-slate-950"
                        />
                        <label htmlFor="isAvailable" className="ml-2 block text-sm text-slate-300 font-medium">
                          Disponible para ordenar inmediatamente
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="isSuggestedModal"
                          checked={dishSuggested}
                          onChange={(e) => setDishSuggested(e.target.checked)}
                          className="h-4 w-4 text-amber-500 focus:ring-amber-400 border-slate-800 rounded bg-slate-950"
                        />
                        <label htmlFor="isSuggestedModal" className="ml-2 flex items-center gap-1.5 text-sm text-amber-300 font-medium cursor-pointer">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span>
                            {bLabels.itemSingle === "Plato" 
                              ? "Marcar como Plato Sugerido / Recomendación del Día" 
                              : `Marcar como ${bLabels.itemSingle} Destacado / Oferta Recomendada`}
                          </span>
                        </label>
                      </div>

                      {/* Control de Stock Operativo */}
                      <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label htmlFor="dishTrackStock" className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                            <Package className="h-4 w-4 text-amber-400" />
                            <span>
                              {bLabels.isGastro
                                ? "Controlar raciones diarias (porciones)"
                                : `Controlar existencias e inventario físico de bodega`}
                            </span>
                          </label>
                          <input
                            type="checkbox"
                            id="dishTrackStock"
                            checked={dishTrackStock}
                            onChange={(e) => setDishTrackStock(e.target.checked)}
                            className="h-4 w-4 text-amber-500 focus:ring-amber-400 border-slate-800 rounded bg-slate-900 cursor-pointer"
                          />
                        </div>

                        {dishTrackStock && (
                          <div className="pt-2 border-t border-slate-850/80 space-y-2.5">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                                  Stock disponible ({bLabels.stockUnitPlural})
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={dishStock}
                                  onChange={(e) => setDishStock(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                                  Stock mínimo / alerta ({bLabels.stockUnitPlural})
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={dishMinStock}
                                  onChange={(e) => setDishMinStock(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              💡 Si las {bLabels.stockUnitPlural} llegan a <strong>0</strong>, el {bLabels.itemSingle.toLowerCase()} se marcará automáticamente como <strong>Agotado</strong>. Al llegar al mínimo ({dishMinStock || 0}), verás una alerta preventiva de reposición.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-800">
                      {editingDish && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`¿Estás seguro de eliminar "${editingDish.name}"?`)) {
                              const res = await deleteDishAction(editingDish.id);
                              if (res && 'error' in res && res.error) {
                                alert(res.error);
                              } else {
                                setIsDishModalOpen(false);
                                alert(`¡${bLabels.itemSingle} "${editingDish.name}" eliminado con éxito!`);
                                window.location.reload();
                              }
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 transition flex items-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => setIsDishModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 transition"
                        >
                          {editingDish ? `Guardar ${bLabels.itemSingle}` : `Crear ${bLabels.itemSingle}`}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {/* Batch Dish Upload Modal */}
            <BatchDishModal
              isOpen={isBatchDishModalOpen}
              onClose={() => setIsBatchDishModalOpen(false)}
              restaurantId={restaurant.id}
              categories={restaurant.categories || []}
              onSuccess={() => {
                window.location.reload();
              }}
            />
          </div>
        )}

        {/* Tarifas y Temporadas Tab */}
        {activeTab === "seasons" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <CalendarDays className="h-6 w-6 text-amber-400" />
                  Tarifas, Temporadas y Festivos
                </h2>
                <p className="text-slate-400 text-sm mt-1">Configura recargos o descuentos según rangos de fecha (feriados o temporadas altas/bajas) para reservas y pedidos.</p>
              </div>
              <button
                onClick={() => {
                  setEditingSeasonRate(null);
                  setSeasonName("");
                  setSeasonStartDate(new Date().toISOString().split("T")[0]);
                  setSeasonEndDate(new Date(Date.now() + 7*24*60*60*1000).toISOString().split("T")[0]);
                  setSeasonPercentageBonus("15");
                  setSeasonFixedBonus("0");
                  setSeasonIsHoliday(false);
                  setIsSeasonModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 shadow-lg shadow-amber-950/20 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nueva Tarifa / Festivo
              </button>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre de la Tarifa</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rango de Fechas</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ajuste / Recargo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {(restaurant.seasonRates || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                        No hay tarifas de temporadas ni festivos configuradas aún.
                      </td>
                    </tr>
                  ) : (
                    (restaurant.seasonRates || []).map((rate) => (
                      <tr key={rate.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-white">{rate.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                          {rate.startDate} al {rate.endDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-amber-400">
                          {rate.percentageBonus !== 0 && (
                            <span className="mr-2">
                              {rate.percentageBonus > 0 ? `+${rate.percentageBonus}%` : `${rate.percentageBonus}%`}
                            </span>
                          )}
                          {rate.fixedBonus !== 0 && (
                            <span>
                              {rate.fixedBonus > 0 ? `+$${rate.fixedBonus.toFixed(2)}` : `-$${Math.abs(rate.fixedBonus).toFixed(2)}`}
                            </span>
                          )}
                          {rate.percentageBonus === 0 && rate.fixedBonus === 0 && (
                            <span className="text-slate-500 font-normal">Sin recargo</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                            rate.isHoliday 
                              ? "bg-red-500/10 text-red-400 border-red-500/30" 
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>
                            {rate.isHoliday ? "Festivo Especial" : "Temporada"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={async () => {
                              await toggleSeasonRateAction(rate.id, !rate.isActive);
                              alert(`Tarifa "${rate.name}" ${!rate.isActive ? "activada" : "desactivada"} con éxito.`);
                            }}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                              rate.isActive 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                            }`}
                          >
                            {rate.isActive ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                          <button
                            onClick={() => {
                              setEditingSeasonRate(rate);
                              setSeasonName(rate.name);
                              setSeasonStartDate(rate.startDate);
                              setSeasonEndDate(rate.endDate);
                              setSeasonPercentageBonus(rate.percentageBonus.toString());
                              setSeasonFixedBonus(rate.fixedBonus.toString());
                              setSeasonIsHoliday(rate.isHoliday);
                              setIsSeasonModalOpen(true);
                            }}
                            className="inline-flex p-2 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de eliminar la tarifa "${rate.name}"?`)) {
                                await deleteSeasonRateAction(rate.id);
                                alert(`¡Tarifa "${rate.name}" eliminada con éxito!`);
                              }
                            }}
                            className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Season Rate Add/Edit Modal */}
            {isSeasonModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingSeasonRate ? "Editar Tarifa de Temporada" : "Nueva Tarifa / Festivo"}
                  </h3>
                  <form
                    action={async () => {
                      const payload = {
                        name: seasonName,
                        startDate: seasonStartDate,
                        endDate: seasonEndDate,
                        percentageBonus: parseFloat(seasonPercentageBonus) || 0,
                        fixedBonus: parseFloat(seasonFixedBonus) || 0,
                        isHoliday: seasonIsHoliday
                      };

                      if (editingSeasonRate) {
                        await updateSeasonRateAction(editingSeasonRate.id, payload);
                        alert("¡Tarifa guardada con éxito!");
                      } else {
                        await createSeasonRateAction(restaurant.id, payload);
                        alert("¡Tarifa creada con éxito!");
                      }
                      setIsSeasonModalOpen(false);
                    }}
                    className="space-y-4 text-xs"
                  >
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Nombre de la Tarifa / Temporada *</label>
                      <input
                        type="text"
                        required
                        value={seasonName}
                        onChange={(e) => setSeasonName(e.target.value)}
                        placeholder="ej: Temporada Alta Feriado de Carnaval"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Fecha Inicio *</label>
                        <input
                          type="date"
                          required
                          value={seasonStartDate}
                          onChange={(e) => setSeasonStartDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Fecha Fin *</label>
                        <input
                          type="date"
                          required
                          value={seasonEndDate}
                          onChange={(e) => setSeasonEndDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Recargo Porcentual (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={seasonPercentageBonus}
                          onChange={(e) => setSeasonPercentageBonus(e.target.value)}
                          placeholder="ej: 15 para +15%"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-slate-500">Ejemplo: 20 para incremento del +20%</span>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1 font-semibold">Recargo Fijo ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={seasonFixedBonus}
                          onChange={(e) => setSeasonFixedBonus(e.target.value)}
                          placeholder="ej: 5.00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[10px] text-slate-500">Ejemplo: 5.00 para recargo de $5</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={seasonIsHoliday}
                          onChange={(e) => setSeasonIsHoliday(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-semibold text-white">Es Feriado / Día Festivo Especial</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-800">
                      {editingSeasonRate && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`¿Estás seguro de eliminar la tarifa "${editingSeasonRate.name}"?`)) {
                              await deleteSeasonRateAction(editingSeasonRate.id);
                              setIsSeasonModalOpen(false);
                              alert(`¡Tarifa "${editingSeasonRate.name}" eliminada con éxito!`);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 transition flex items-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => setIsSeasonModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-red-600 text-white hover:from-amber-500 hover:to-red-500 transition"
                        >
                          {editingSeasonRate ? "Guardar Cambios" : "Crear Tarifa"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coupons System Tab */}
        {activeTab === "coupons" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Tag className="h-5 w-5 text-amber-400" />
                  Cupones de Descuento
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Crea códigos promocionales por porcentaje o monto fijo para fidelizar a tus clientes.
                </p>
              </div>
              <button
                onClick={() => {
                  setCouponCode("");
                  setCouponType("PERCENTAGE");
                  setCouponValue("");
                  setCouponMinOrder("");
                  setCouponMaxUses("");
                  setCouponExpiresAt("");
                  setIsCouponModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white rounded-xl font-bold text-xs shadow-lg transition flex items-center gap-2 shrink-0 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>+ Crear Nuevo Cupón</span>
              </button>
            </div>

            {/* Coupons Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Código</th>
                      <th className="py-3.5 px-4">Tipo & Valor</th>
                      <th className="py-3.5 px-4">Mín. Compra</th>
                      <th className="py-3.5 px-4">Usos Totales</th>
                      <th className="py-3.5 px-4">Expiración</th>
                      <th className="py-3.5 px-4 text-center">Estado</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Tag className="h-10 w-10 mx-auto text-slate-700 mb-2" />
                          <p className="font-semibold text-sm">No has creado ningún cupón aún.</p>
                          <p className="text-xs text-slate-600 mt-0.5">Haz clic en "+ Crear Nuevo Cupón" para comenzar.</p>
                        </td>
                      </tr>
                    ) : (
                      coupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-slate-850/50 transition">
                          <td className="py-3.5 px-4 font-mono font-black text-amber-400 text-sm">
                            {coupon.code}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {coupon.discountType === "PERCENTAGE" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <Percent className="h-3.5 w-3.5" />
                                {coupon.discountValue}% OFF
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <DollarSign className="h-3.5 w-3.5" />
                                ${coupon.discountValue.toFixed(2)} OFF
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-300">
                            ${coupon.minOrder.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-400">
                            {coupon.usedCount} {coupon.maxUses !== null ? `/ ${coupon.maxUses}` : "usos"}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-400">
                            {coupon.expiresAt ? (
                              new Date(coupon.expiresAt).toLocaleDateString()
                            ) : (
                              <span className="text-slate-500 italic">Sin expiración</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                              coupon.isActive
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-slate-800 text-slate-500 border-slate-700"
                            }`}>
                              {coupon.isActive ? "🟢 Activo" : "⚪ Inactivo"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await toggleCouponStatusAction(coupon.id, restaurant.id);
                                if (res.success) {
                                  setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
                                } else if (res.error) {
                                  alert(res.error);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                                coupon.isActive
                                  ? "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/40"
                              }`}
                            >
                              {coupon.isActive ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`¿Eliminar el cupón "${coupon.code}"?`)) {
                                  const res = await deleteCouponAction(coupon.id, restaurant.id);
                                  if (res.success) {
                                    setCoupons(prev => prev.filter(c => c.id !== coupon.id));
                                  } else if (res.error) {
                                    alert(res.error);
                                  }
                                }
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition"
                              title="Eliminar cupón"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create Coupon Modal */}
            {isCouponModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Tag className="h-4 w-4 text-amber-400" />
                      Crear Nuevo Cupón de Descuento
                    </h3>
                    <button
                      onClick={() => setIsCouponModalOpen(false)}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSavingCoupon(true);
                      const res = await createCouponAction(restaurant.id, {
                        code: couponCode,
                        discountType: couponType,
                        discountValue: parseFloat(couponValue) || 0,
                        minOrder: parseFloat(couponMinOrder) || 0,
                        maxUses: couponMaxUses ? parseInt(couponMaxUses) : null,
                        expiresAt: couponExpiresAt || null,
                      });
                      setSavingCoupon(false);
                      if (res.error) {
                        alert(res.error);
                      } else if (res.coupon) {
                        setCoupons(prev => [res.coupon as any, ...prev]);
                        setIsCouponModalOpen(false);
                        alert(`¡Cupón "${couponCode.toUpperCase()}" creado exitosamente!`);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Código del Cupón *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. BIENVENIDA10, PROMO2026"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-white font-mono font-bold uppercase focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Tipo de Descuento *</label>
                        <select
                          value={couponType}
                          onChange={(e) => setCouponType(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-white font-semibold focus:outline-none"
                        >
                          <option value="PERCENTAGE">Porcentaje (%)</option>
                          <option value="FIXED">Monto Fijo ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">
                          Valor ({couponType === "PERCENTAGE" ? "%" : "$"}) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={couponType === "PERCENTAGE" ? "100" : undefined}
                          required
                          placeholder={couponType === "PERCENTAGE" ? "Ej. 20" : "Ej. 5.00"}
                          value={couponValue}
                          onChange={(e) => setCouponValue(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-white font-black text-right focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Mínimo de Compra ($)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00 (sin mínimo)"
                          value={couponMinOrder}
                          onChange={(e) => setCouponMinOrder(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-white font-black text-right focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Límite de Usos (Opcional)</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="Ilimitado"
                          value={couponMaxUses}
                          onChange={(e) => setCouponMaxUses(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-white font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Fecha de Expiración (Opcional)</label>
                      <input
                        type="date"
                        value={couponExpiresAt}
                        onChange={(e) => setCouponExpiresAt(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsCouponModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-750 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingCoupon}
                        className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white shadow-lg transition active:scale-95 disabled:opacity-50"
                      >
                        {savingCoupon ? "Guardando..." : "Crear Cupón"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ruleta de Premios Tab */}
        {activeTab === "ruleta" && (
          <RuletaAdminTab restaurant={restaurant} />
        )}

        {/* Campañas, Eventos & Promociones Tab */}
        {activeTab === "campaigns" && (
          <CampaignsAdminTab restaurant={restaurant} />
        )}

        {/* Inventario & Compras Tab */}
        {activeTab === "inventory" && (
          <InventoryAdminTab restaurant={restaurant} />
        )}

        {/* Código QR Tab */}
        {activeTab === "qr" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <QrCode className="h-6 w-6 text-emerald-400" />
                  Generador de Códigos QR
                </h2>
                <p className="text-slate-400 text-sm">
                  Descarga e imprime códigos QR para colocar en las mesas o fachada. Incluye firma criptográfica anti-manipulación.
                </p>
              </div>

              {/* Selector de Sub-pestañas */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setQrSubTab("general")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    qrSubTab === "general"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <QrCode className="h-4 w-4 text-emerald-400" />
                  <span>{bLabels.isGastro ? "QR General del Menú" : `QR General del ${bLabels.businessTabTitle}`}</span>
                </button>
                {bLabels.showTablesConfig && enableTableOrdering && (
                  <button
                    type="button"
                    onClick={() => setQrSubTab("tables")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      qrSubTab === "tables"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Utensils className="h-4 w-4" />
                    <span>QRs por Mesa</span>
                    <span className="text-[10px] bg-black/30 text-white px-2 py-0.5 rounded-full font-black">
                      {tablesList.length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* SUB-PESTAÑA 1: QR GENERAL DEL NEGOCIO */}
            {qrSubTab === "general" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start animate-fade-in">
                {/* QR display card */}
                <div className="md:col-span-1 bg-white p-6 rounded-[2rem] flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group border border-slate-100">
                  {restaurant.logoUrl && (
                    <img 
                      src={restaurant.logoUrl} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover filter blur-xl opacity-10 pointer-events-none scale-110"
                    />
                  )}

                  {/* Dish thumbnails row */}
                  {dishBase64s.length > 0 && (
                    <div className="flex gap-2 mb-4 z-10">
                      {dishBase64s.map((src, idx) => (
                        <div
                          key={idx}
                          className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md shrink-0"
                          style={{ boxShadow: `0 4px 12px -2px ${restaurant.themeColor}40` }}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Title */}
                  <div className="text-center mb-4 z-10">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold text-slate-400 block mb-0.5">Menú Digital</span>
                    <h4 className="text-[11px] font-semibold text-slate-500">Escanea para ver el menú de</h4>
                    <p className="text-base font-black mt-0.5" style={{ color: restaurant.themeColor }}>{restaurant.name}</p>
                  </div>

                  <div className="bg-white p-1.5 rounded-2xl border border-slate-200 z-10 shadow-sm">
                    <QRCodeCanvas
                      id="qr-canvas"
                      value={publicUrl}
                      size={180}
                      level={"H"}
                      includeMargin={true}
                      imageSettings={logoBase64 ? {
                        src: logoBase64,
                        x: undefined,
                        y: undefined,
                        height: 36,
                        width: 36,
                        excavate: true,
                      } : undefined}
                    />
                  </div>
                  <button
                    onClick={downloadQR}
                    className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-xs font-black uppercase text-white bg-slate-900 hover:bg-slate-850 transition-all text-center z-10 shadow-md"
                  >
                    Descargar para imprimir
                  </button>
                </div>

                {/* QR instructions and details */}
                <div className="md:col-span-2 space-y-6 bg-slate-900/50 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md">
                  <div>
                    <h3 className="font-bold text-white text-lg">Enlace del Menú</h3>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={publicUrl}
                        className="w-full bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-slate-300 text-sm focus:outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-4 py-3 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 transition flex items-center gap-1.5 shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 text-green-400" />
                            Copiado
                          </>
                        ) : (
                          "Copiar Enlace"
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80 pt-6 space-y-4 text-sm text-slate-300">
                    <h4 className="font-bold text-white">¿Cómo funciona?</h4>
                    <ul className="list-disc pl-5 space-y-2 text-slate-400">
                      <li>Coloca el código QR en un portarretratos, sticker o en las mesas de tu restaurante.</li>
                      <li>Los comensales lo escanean con su teléfono celular sin descargar aplicaciones.</li>
                      <li>Arman su pedido directamente en la web seleccionando los platos de tu carta.</li>
                      <li>El pedido se envía formateado a tu WhatsApp de forma instantánea.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PESTAÑA 2: QRS INDIVIDUALES POR MESA CON TOKEN CRIPTOGRÁFICO Y BATCH PRINT */}
            {qrSubTab === "tables" && (
              <div className="space-y-6 animate-fade-in">
                {/* Configuración rápida de Mesas del Local */}
                <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl backdrop-blur-md space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-400" />
                        Configuración de Mesas del Local
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Define las mesas o áreas de tu local separadas por comas (ej. 1, 2, 3, VIP-1, Terraza-A).
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleSaveTables} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      type="text"
                      value={tablesConfig}
                      onChange={(e) => setTablesConfig(e.target.value)}
                      required
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 px-4 py-2.5 rounded-xl text-white focus:outline-none text-xs font-mono font-bold"
                      placeholder="ej. 1, 2, 3, VIP-1, Terraza-A"
                    />
                    <button
                      type="submit"
                      disabled={savingTables}
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg bg-emerald-600 hover:bg-emerald-500 transition active:scale-95 shrink-0"
                    >
                      {savingTables ? "Guardando..." : "Guardar Mesas"}
                    </button>
                  </form>
                  {tablesMessage && (
                    <p className={`text-xs ${tablesMessage.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                      {tablesMessage}
                    </p>
                  )}
                </div>

                {/* Table selector & Batch Print Toolbar */}
                <div className="bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 rounded-3xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Seguridad Criptográfica Anti-Tamper Activa
                    </span>
                    <h3 className="text-base font-bold text-white">Gestión de Códigos QR por Mesa</h3>
                    <p className="text-xs text-slate-400">
                      Cada código contiene una firma HMAC. Si un cliente altera la URL para pedir a nombre de otra mesa, queda sin verificar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsBatchPrinting(true)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition active:scale-95 flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Imprimir Salón Completo (A4)</span>
                    </button>
                  </div>
                </div>

                {/* Table Pills / Quick Switcher */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {tablesList.map((tbl) => {
                    const isSelected = tbl === activeTableForQr;
                    return (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => setSelectedQrTable(tbl)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                            : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                        }`}
                      >
                        <span>🪑 Mesa #{tbl}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Main Table Preview & Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  {/* Card Display for Table */}
                  <div className="md:col-span-1 bg-white p-6 rounded-[2rem] flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group border border-slate-100">
                    {/* Header */}
                    <div className="text-center mb-3 z-10 w-full">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 block mb-0.5">
                        Menú Digital en Mesa
                      </span>
                      <div 
                        className="inline-block text-white px-4 py-1 rounded-xl text-sm font-black mb-1.5 shadow-sm"
                        style={{ backgroundColor: restaurant.themeColor || "#0f172a" }}
                      >
                        MESA #{activeTableForQr}
                      </div>
                      <p className="text-xs font-bold text-slate-600 truncate">{restaurant.name}</p>
                    </div>

                    {/* QR Canvas */}
                    <div className="bg-white p-2 rounded-2xl border-2 border-slate-200 z-10 shadow-sm relative">
                      <QRCodeCanvas
                        id={`qr-canvas-table-${activeTableForQr}`}
                        value={activeTableQrUrl}
                        size={190}
                        level={"H"}
                        includeMargin={true}
                        imageSettings={logoBase64 ? {
                          src: logoBase64,
                          x: undefined,
                          y: undefined,
                          height: 36,
                          width: 36,
                          excavate: true,
                        } : undefined}
                      />
                    </div>

                    {/* Token chip */}
                    <div className="mt-3 py-1 px-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold flex items-center gap-1 z-10">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      <span>Token: {generateTableToken(restaurant.id, activeTableForQr)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => downloadTableQR(activeTableForQr)}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase text-white bg-slate-900 hover:bg-slate-800 transition-all text-center z-10 shadow-md"
                    >
                      <Download className="h-4 w-4 text-emerald-400" />
                      Descargar Póster Mesa #{activeTableForQr}
                    </button>
                  </div>

                  {/* Details, Links & Table Hub Info */}
                  <div className="md:col-span-2 space-y-5 bg-slate-900/50 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-md">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-white text-base flex items-center gap-2">
                          <span>Enlace Seguro de Mesa #{activeTableForQr}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Verificado
                          </span>
                        </h4>
                        <a
                          href={activeTableQrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold transition"
                        >
                          Probar en Menú
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={activeTableQrUrl}
                          className="w-full bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-xl text-slate-300 font-mono text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyTableLink(activeTableQrUrl)}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 transition flex items-center gap-1.5 shrink-0"
                        >
                          {copiedTableLink ? (
                            <>
                              <Check className="h-4 w-4 text-green-400" />
                              Copiado
                            </>
                          ) : (
                            "Copiar"
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <span className="text-emerald-400 text-xs font-black flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> Anti-Spoofing
                        </span>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          La URL contiene una firma determinística. Si alguien cambia el número de mesa manualmente, queda sin verificar.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <span className="text-amber-400 text-xs font-black flex items-center gap-1">
                          <Utensils className="h-3.5 w-3.5" /> Comanda y Rondas
                        </span>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          El comensal puede agregar rondas adicionales a la misma mesa sin duplicar comensales en cocina.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                        <span className="text-blue-400 text-xs font-black flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Cuenta y Mesero
                        </span>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Botones para alertar al mesero con sonido y solicitar la cuenta dividida en partes iguales o por platos.
                        </p>
                      </div>
                    </div>

                    {/* Todas las mesas en lista rápida */}
                    <div className="border-t border-slate-800/80 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Catálogo de Mesas ({tablesList.length})
                        </h5>
                        <button
                          type="button"
                          onClick={() => setIsBatchPrinting(true)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir todas en A4
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {tablesList.map((tbl) => {
                          const tblUrl = buildTableQrUrl(isMounted && typeof window !== "undefined" ? window.location.origin : "", restaurant.slug, tbl, restaurant.id);
                          const token = generateTableToken(restaurant.id, tbl);
                          const isCurrent = tbl === activeTableForQr;
                          return (
                            <div
                              key={tbl}
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition ${
                                isCurrent
                                  ? "bg-emerald-950/30 border-emerald-500/40 text-white"
                                  : "bg-slate-950/50 border-slate-850 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-xs shrink-0 px-2 py-0.5 rounded-lg bg-slate-800 text-emerald-400">
                                  #{tbl}
                                </span>
                                <span className="text-xs font-mono text-slate-400 truncate text-[11px]">
                                  Token: {token}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedQrTable(tbl)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                                >
                                  Ver
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyTableLink(tblUrl)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                                  title="Copiar enlace directo"
                                >
                                  Copiar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadTableQR(tbl)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1"
                                  title="Descargar póster individual"
                                >
                                  <Download className="h-3 w-3" />
                                  PNG
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hidden canvases for non-selected tables so individual download or batch generation works reliably */}
                <div className="hidden" aria-hidden="true">
                  {tablesList.map((tbl) => {
                    if (tbl === activeTableForQr) return null;
                    const tblUrl = buildTableQrUrl(isMounted && typeof window !== "undefined" ? window.location.origin : "", restaurant.slug, tbl, restaurant.id);
                    return (
                      <QRCodeCanvas
                        key={tbl}
                        id={`qr-canvas-table-${tbl}`}
                        value={tblUrl}
                        size={190}
                        level={"H"}
                        includeMargin={true}
                        imageSettings={logoBase64 ? {
                          src: logoBase64,
                          x: undefined,
                          y: undefined,
                          height: 36,
                          width: 36,
                          excavate: true,
                        } : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODAL DE IMPRESIÓN POR LOTES EN HOJA A4 */}
            {isBatchPrinting && (
              <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
                {/* Print Toolbar (Hidden on actual print) */}
                <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4 mb-6 sticky top-2 z-50 shadow-2xl print:hidden">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Printer className="h-5 w-5 text-emerald-400" />
                      Plantilla de Impresión de Salón A4 ({tablesList.length} Mesas)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Optimizado para portarretratos de acrílico o stickers con marcas de corte punteadas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Imprimir Ahora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBatchPrinting(false)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

                {/* Printable Canvas Sheet */}
                <div id="print-table-batch" className="w-full max-w-4xl bg-white text-slate-950 p-6 sm:p-8 rounded-3xl shadow-2xl print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                    {tablesList.map((tbl) => {
                      const tblUrl = buildTableQrUrl(isMounted && typeof window !== "undefined" ? window.location.origin : "", restaurant.slug, tbl, restaurant.id);
                      const token = generateTableToken(restaurant.id, tbl);
                      return (
                        <div
                          key={tbl}
                          className="border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-between text-center bg-white page-break-inside-avoid relative"
                          style={{ minHeight: "310px" }}
                        >
                          {/* Top Header */}
                          <div>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                              Menú Digital
                            </span>
                            <h4 className="text-sm font-black text-slate-900 truncate" style={{ color: restaurant.themeColor || "#0f172a" }}>
                              {restaurant.name}
                            </h4>
                            <div className="mt-1 inline-block bg-slate-900 text-white text-xs font-black px-3 py-0.5 rounded-lg shadow-sm">
                              MESA #{tbl}
                            </div>
                          </div>

                          {/* QR Code */}
                          <div className="my-2 bg-white p-1 rounded-xl border border-slate-200">
                            <QRCodeCanvas
                              value={tblUrl}
                              size={140}
                              level={"H"}
                              includeMargin={true}
                              imageSettings={logoBase64 ? {
                                src: logoBase64,
                                x: undefined,
                                y: undefined,
                                height: 28,
                                width: 28,
                                excavate: true,
                              } : undefined}
                            />
                          </div>

                          {/* Instructions & Security Token */}
                          <div className="w-full">
                            <p className="text-[10px] font-bold text-slate-700 leading-tight mb-1">
                              Escanea para ordenar y pedir la cuenta
                            </p>
                            <div className="flex items-center justify-between text-[8px] text-slate-400 border-t border-slate-100 pt-1 font-mono">
                              <span>Token: {token}</span>
                              <span>MenuQR Pro</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Print Stylesheet */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    body {
                      background: #ffffff !important;
                      color: #000000 !important;
                    }
                    body * {
                      visibility: hidden;
                    }
                    #print-table-batch, #print-table-batch * {
                      visibility: visible;
                    }
                    #print-table-batch {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100% !important;
                      max-width: 100% !important;
                      padding: 0 !important;
                      margin: 0 !important;
                    }
                    .page-break-inside-avoid {
                      break-inside: avoid;
                      page-break-inside: avoid;
                    }
                  }
                `}} />
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Connect Tab */}
        {activeTab === "whatsapp" && restaurant.whatsappBotEnabled && (
          <div className="space-y-6 animate-fade-in">
            <WhatsAppConnectTab
              restaurantId={restaurant.id}
              restaurantSlug={restaurant.slug}
            />
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="h-6 w-6 text-amber-400" />
                  Monitor & Historial de Pedidos
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">Administra los pedidos de cocina y a domicilio en tiempo real.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`/${restaurant.slug}/repartidor`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Truck className="h-4 w-4" />
                  <span>Panel Repartidor</span>
                </a>
                <a
                  href={`/${restaurant.slug}/rastreo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Search className="h-4 w-4 text-emerald-400" />
                  <span>Portal Rastreo</span>
                </a>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="pb-3 pt-1 pl-2">Pedido / Canal</th>
                      <th className="pb-3 pt-1">Artículos Pedidos (Detalle)</th>
                      <th className="pb-3 pt-1">Cliente & Entrega</th>
                      <th className="pb-3 pt-1">Pago & Fecha</th>
                      <th className="pb-3 pt-1">Estado de Pedido</th>
                      <th className="pb-3 pt-1 text-right pr-2">Total & Comanda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {(() => {
                      const allOrders = restaurant.orders || [];
                      if (allOrders.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                              No hay pedidos registrados en las últimas 24 horas.
                            </td>
                          </tr>
                        );
                      }

                      return allOrders.map((order) => (
                        <React.Fragment key={order.id}>
                          <tr className="text-slate-300 hover:bg-slate-800/20 transition-all">
                            <td className="py-3.5 pl-2 font-semibold align-top">
                              <div className="space-y-1">
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold block w-fit">
                                  #{order.orderNumber || order.id.substring(0, 6)}
                                </span>
                                <span className={`inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-xl border ${
                                  order.tableName === "Llevar"
                                    ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                    : order.tableName === "Domicilio"
                                    ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                    : order.tableName === "Visita Técnica" || order.tableName.includes("Visita") || order.tableName.includes("Cotizac") || isServiciosTecnicos
                                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-sm"
                                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                }`}>
                                  {order.tableName === "Llevar" 
                                    ? "🛍 Para Llevar" 
                                    : order.tableName === "Domicilio" 
                                      ? "🛵 A Domicilio" 
                                      : order.tableName === "Visita Técnica" || order.tableName.includes("Visita") || isServiciosTecnicos
                                        ? "🚗 Visita Técnica"
                                        : `🪑 Mesa #${order.tableName}`}
                                </span>
                                {order.customerName && order.tableName !== "Llevar" && order.tableName !== "Domicilio" && order.tableName !== "Visita Técnica" && !order.tableName.includes("Visita") && (
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                                    👤 {order.customerName}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Columna de Artículos Pedidos con preview y acordeón */}
                            <td className="py-3.5 align-top">
                              <div className="space-y-1.5 max-w-[280px]">
                                <div className="flex flex-wrap gap-1">
                                  {(order.items || []).slice(0, 3).map((it) => (
                                    <span
                                      key={it.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-200"
                                    >
                                      <strong className="text-cyan-400 font-bold">{it.quantity}×</strong>
                                      <span className="truncate max-w-[140px]">{it.dishName}</span>
                                    </span>
                                  ))}
                                  {(order.items || []).length > 3 && (
                                    <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                                      +{(order.items || []).length - 3} más
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline pt-0.5"
                                >
                                  {expandedOrderId === order.id ? (
                                    <>
                                      <ChevronUp className="h-3 w-3" />
                                      <span>Ocultar desglose</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3" />
                                      <span>Ver desglose completo ({(order.items || []).length} detalles)</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 align-top">
                              {order.customerName ? (
                                <div className="space-y-1 max-w-[200px]">
                                  <p className="font-bold text-white text-xs">
                                    {order.customerName}
                                  </p>
                                  {order.customerPhone && (
                                    <a 
                                      href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:underline text-[11px] font-semibold flex items-center gap-1"
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{order.customerPhone}</span>
                                    </a>
                                  )}
                                  {order.customerAddress && (
                                    <div className="space-y-0.5">
                                      <div className="flex items-start gap-1 text-slate-400 text-[10px]">
                                        <MapPin className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2" title={order.customerAddress}>
                                          {order.customerAddress.replace(/\s*\[GPS:[^\]]+\]/, "")}
                                        </span>
                                      </div>
                                      {order.customerAddress.includes("GPS:") && (() => {
                                        const match = order.customerAddress.match(/GPS:\s*([-\d.]+)\s*,\s*([-\d.]+)/);
                                        if (match) {
                                          return (
                                            <a
                                              href={`https://www.google.com/maps/search/?api=1&query=${match[1]},${match[2]}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline pl-4"
                                            >
                                              <span>📍 Abrir ubicación GPS</span>
                                            </a>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Cliente Mostrador</span>
                              )}
                            </td>

                            <td className="py-3.5 align-top">
                              <span className="uppercase font-bold text-[10px] block text-slate-300">
                                {order.paymentMethod === "WHATSAPP_COTIZACION" ? "Cotización Express" : order.paymentMethod === "qr" ? "QR de Cobro" : "Efectivo / Local"}
                              </span>
                              <span suppressHydrationWarning className="text-slate-500 text-[10px] block mt-0.5">
                                {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </td>

                            <td className="py-3.5 align-top">
                              <select
                                value={order.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  await updateOrderStatusAction(order.id, newStatus);
                                  window.location.reload();
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase border focus:outline-none transition ${
                                  order.status === "PENDING"
                                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                                    : order.status === "PREPARING"
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                      : order.status === "IN_TRANSIT"
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : order.status === "DELIVERED" || order.status === "COMPLETED"
                                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                          : "bg-red-500/20 text-red-300 border-red-500/40"
                                }`}
                              >
                                {isServiciosTecnicos || order.tableName.includes("Visita") ? (
                                  <>
                                    <option value="PENDING" className="bg-slate-900 text-yellow-300">⏳ Nueva Cotización</option>
                                    <option value="PREPARING" className="bg-slate-900 text-blue-300">📅 Visita Agendada</option>
                                    <option value="IN_TRANSIT" className="bg-slate-900 text-amber-300">🚗 En Camino / Revisión</option>
                                    <option value="DELIVERED" className="bg-slate-900 text-emerald-300">✅ Trabajo Terminado</option>
                                    <option value="CANCELLED" className="bg-slate-900 text-red-300">❌ Cancelada</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="PENDING" className="bg-slate-900 text-yellow-300">⏳ Pendiente</option>
                                    <option value="PREPARING" className="bg-slate-900 text-blue-300">🍳 En Cocina / Empaque</option>
                                    <option value="IN_TRANSIT" className="bg-slate-900 text-amber-300">🛵 En Transporte</option>
                                    <option value="DELIVERED" className="bg-slate-900 text-emerald-300">✅ Entregado</option>
                                    <option value="CANCELLED" className="bg-slate-900 text-red-300">❌ Cancelado</option>
                                  </>
                                )}
                              </select>
                            </td>

                            <td className="py-3.5 text-right pr-2 align-top">
                              <div className="space-y-1.5 flex flex-col items-end">
                                <span className="font-extrabold text-white text-sm block font-mono">
                                  ${order.total.toFixed(2)}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setTicketModalOrder(order)}
                                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1.5 active:scale-95"
                                  title="Ver comanda de despacho, checklist e imprimir ticket"
                                >
                                  <Receipt className="h-3 w-3" />
                                  <span>Ver Ticket</span>
                                </button>

                                <a
                                  href={`/${restaurant.slug}/rastreo?order=${order.orderNumber || order.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-slate-400 hover:text-amber-400 inline-flex items-center gap-1 font-semibold"
                                >
                                  <span>Rastreo</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            </td>
                          </tr>

                          {/* Sub-fila expandida con el desglose en vivo del pedido (Opción 1) */}
                          {expandedOrderId === order.id && (
                            <tr key={`${order.id}-expanded`} className="bg-slate-950/90 border-b border-slate-800 animate-in fade-in duration-150">
                              <td colSpan={6} className="p-4 sm:p-5">
                                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                                    <div className="flex items-center gap-2">
                                      <Receipt className="h-4 w-4 text-amber-400" />
                                      <h4 className="font-bold text-white text-sm">
                                        Desglose Detallado del Pedido #{order.orderNumber || order.id.substring(0, 6)}
                                      </h4>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ({(order.items || []).length} productos)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handlePrintThermalReceipt(order)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                                      >
                                        <Printer className="h-3.5 w-3.5 text-amber-400" />
                                        <span>Imprimir Ticket</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setTicketModalOrder(order)}
                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                                      >
                                        <CheckSquare className="h-3.5 w-3.5" />
                                        <span>Checklist & Despacho</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="lg:col-span-2 space-y-2">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Lista de Ítems:
                                      </span>
                                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl divide-y divide-slate-855 overflow-hidden">
                                        {(order.items || []).map((it) => (
                                          <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-black text-xs font-mono">
                                                {it.quantity}x
                                              </span>
                                              <span className="font-bold text-white text-xs">{it.dishName}</span>
                                            </div>
                                            <div className="text-right font-mono text-xs">
                                              <span className="text-white font-bold">${(it.price * it.quantity).toFixed(2)}</span>
                                              <span className="text-[10px] text-slate-500 block">(${Number(it.price).toFixed(2)} c/u)</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Totales y Despacho:
                                      </span>
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between text-slate-400">
                                          <span>Subtotal:</span>
                                          <span className="font-mono">${Number(order.subtotal || 0).toFixed(2)}</span>
                                        </div>
                                        {(order.deliveryCost || 0) > 0 && (
                                          <div className="flex justify-between text-sky-400 font-semibold">
                                            <span>Costo Envío:</span>
                                            <span className="font-mono">+${Number(order.deliveryCost).toFixed(2)}</span>
                                          </div>
                                        )}
                                        {(order.discountAmount || 0) > 0 && (
                                          <div className="flex justify-between text-emerald-400 font-semibold">
                                            <span>Descuento:</span>
                                            <span className="font-mono">-${Number(order.discountAmount).toFixed(2)}</span>
                                          </div>
                                        )}
                                        {(order.iva || 0) > 0 && (
                                          <div className="flex justify-between text-slate-400">
                                            <span>IVA:</span>
                                            <span className="font-mono">+${Number(order.iva).toFixed(2)}</span>
                                          </div>
                                        )}
                                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black text-white">
                                          <span>TOTAL:</span>
                                          <span className="font-mono text-emerald-400 text-base">${Number(order.total).toFixed(2)}</span>
                                        </div>
                                      </div>

                                      {order.customerAddress && (
                                        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Dirección:</span>
                                          <span className="block mt-0.5">{order.customerAddress}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-400 text-xs flex items-start gap-2.5 leading-relaxed">
                <span className="text-amber-500 font-extrabold text-sm leading-none">⚠️</span>
                <div>
                  <span className="font-bold text-slate-300">Nota sobre la persistencia:</span>
                  <p className="mt-0.5">
                    Para mantener el rendimiento óptimo de la base de datos y la privacidad del cliente, el historial se limpia de manera automática. Todos los pedidos con más de 24 horas de antigüedad son eliminados permanentemente.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal de Ticket y Checklist de Despacho (Opción 2) */}
            {ticketModalOrder && (
              <OrderTicketModal
                order={ticketModalOrder}
                restaurant={restaurant}
                onClose={() => setTicketModalOrder(null)}
                onStatusChange={async (newStatus: string) => {
                  await updateOrderStatusAction(ticketModalOrder.id, newStatus);
                  setTicketModalOrder({ ...ticketModalOrder, status: newStatus as any });
                  window.location.reload();
                }}
                onPrintThermal={() => handlePrintThermalReceipt(ticketModalOrder)}
              />
            )}
          </div>
        )}

        {/* Dividir Cuenta Tab */}
        {activeTab === "split-bill" && (
          <TableSplitMonitor restaurantId={restaurant.id} tablesConfig={restaurant.tablesConfig} />
        )}

        {/* Equipo y Accesos (PIN Meseros & Cocina) Tab */}
        {activeTab === "staff" && (
          <StaffAdminTab restaurant={restaurant} />
        )}

        {/* CRM Clientes Tab */}
        {activeTab === "crm" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="h-6 w-6 text-amber-400" />
                  CRM & Fidelización de Clientes
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  Gestiona tu base de clientes, historial de consumo, etiquetas de fidelidad y contacto directo por WhatsApp.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setImportTextContent("");
                    setImportFileName("");
                    setImportMessage("");
                    setIsImportModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2 active:scale-95"
                >
                  <Upload className="h-4 w-4 text-amber-400" />
                  Importar Contactos (CSV / VCF)
                </button>
                <button
                  onClick={handleExportCustomersCSV}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-2 active:scale-95"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  Exportar CSV
                </button>
                <button
                  onClick={() => handleOpenCustomerModal()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition shadow-lg flex items-center gap-2 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Registrar Cliente
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            {(() => {
              const allCust = restaurant.customers || [];
              const totalCust = allCust.length;
              const vipCust = allCust.filter(c => c.category === "VIP" || c.category === "FRECUENTE").length;
              const totalSpentSum = allCust.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
              
              let totalPointsSum = 0;
              let birthdayMonthCount = 0;

              allCust.forEach(c => {
                const meta = parseCustomerMetadata(c.notes);
                totalPointsSum += (meta.points || 0);
                if (meta.birthDate) {
                  const parts = meta.birthDate.split("-");
                  if (parts.length === 3) {
                    const bMonth = parseInt(parts[1], 10) - 1;
                    if (new Date().getMonth() === bMonth) {
                      birthdayMonthCount++;
                    }
                  }
                }
              });

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Clientes</span>
                    <p className="text-2xl font-black text-white mt-1">{totalCust}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Base de datos del local</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">⭐ VIP & Frecuentes</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">{vipCust}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Clientes recurrentes</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-pink-400 tracking-wider">🎂 Cumpleañeros del Mes</span>
                      <span className="p-1 rounded-md bg-pink-500/10 text-pink-400">
                        <Cake className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="text-2xl font-black text-pink-400 mt-1">{birthdayMonthCount}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Para felicitaciones y promos</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">🪙 Puntos Fidelidad</span>
                      <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Award className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p suppressHydrationWarning className="text-2xl font-black text-emerald-400 mt-1">{totalPointsSum.toLocaleString()} pts</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Emitidos en el sistema</span>
                  </div>
                </div>
              );
            })()}

            {/* Search & Filter Bar */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono, notas o alérgenos..."
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 pl-10 pr-4 py-2 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                  {[
                    { id: "TODOS", label: "Todos" },
                    { id: "VIP", label: "⭐ VIP" },
                    { id: "FRECUENTE", label: "🔥 Frecuentes" },
                    { id: "NUEVO", label: "🆕 Nuevos" },
                    { id: "CUMPLEANOS", label: "🎂 Cumpleaños" },
                    { id: "INACTIVO", label: "💤 Inactivos" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCrmCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition border ${
                        crmCategoryFilter === cat.id
                          ? "bg-gradient-to-r from-red-600 to-amber-600 text-white border-transparent shadow-md"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary Preferences Filter Row */}
              {!isServiciosTecnicos ? (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                    <Wheat className="h-3.5 w-3.5 text-amber-400" />
                    Dietas & Alergias:
                  </span>
                  <button
                    onClick={() => setCrmDietaryFilter("TODOS")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      crmDietaryFilter === "TODOS"
                        ? "bg-slate-800 text-white border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                    }`}
                  >
                    Todas
                  </button>
                  {DIETARY_PREFERENCES_LIST.map((diet) => (
                    <button
                      key={diet.id}
                      onClick={() => setCrmDietaryFilter(diet.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                        crmDietaryFilter === diet.id
                          ? `${diet.color} shadow-sm`
                          : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span>{diet.emoji}</span>
                      <span>{diet.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setCrmDietaryFilter("ALERGIAS")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                      crmDietaryFilter === "ALERGIAS"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    <span>Con Alergias</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1 mr-1">
                    <Wrench className="h-3.5 w-3.5" />
                    Base de Clientes & Servicios Técnicos:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Captura automática de leads desde el cotizador web con registro de equipos, marcas y visitas domiciliarias.
                  </span>
                </div>
              )}
            </div>

            {/* Customer List Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-950/60">
                      <th className="pb-3 pt-4 pl-4">Cliente & Contacto</th>
                      <th className="pb-3 pt-4">Categoría</th>
                      <th className="pb-3 pt-4">{isServiciosTecnicos ? "Equipo & Marca" : "Preferencias & Alergias"}</th>
                      <th className="pb-3 pt-4">{isServiciosTecnicos ? "Servicio & Visitas" : "Plato Favorito & Visitas"}</th>
                      <th className="pb-3 pt-4 text-right">Puntos & Total</th>
                      <th className="pb-3 pt-4">Última Visita</th>
                      <th className="pb-3 pt-4 pr-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {(() => {
                      const allCust = restaurant.customers || [];
                      const filtered = allCust.filter((c) => {
                        const meta = parseCustomerMetadata(c.notes);
                        const cleanSearch = crmSearch.toLowerCase();
                        
                        const matchesSearch = 
                          (c.name && c.name.toLowerCase().includes(cleanSearch)) ||
                          (c.phone && c.phone.includes(cleanSearch)) ||
                          (c.city && c.city.toLowerCase().includes(cleanSearch)) ||
                          (meta.customNotes && meta.customNotes.toLowerCase().includes(cleanSearch)) ||
                          (meta.allergies && meta.allergies.toLowerCase().includes(cleanSearch)) ||
                          (meta.favoriteDish && meta.favoriteDish.toLowerCase().includes(cleanSearch));

                        let matchesCategory = true;
                        if (crmCategoryFilter === "CUMPLEANOS") {
                          if (!meta.birthDate) {
                            matchesCategory = false;
                          } else {
                            const parts = meta.birthDate.split("-");
                            matchesCategory = parts.length === 3 && parseInt(parts[1], 10) - 1 === new Date().getMonth();
                          }
                        } else if (crmCategoryFilter !== "TODOS") {
                          matchesCategory = c.category === crmCategoryFilter;
                        }

                        let matchesDietary = true;
                        if (crmDietaryFilter === "ALERGIAS") {
                          matchesDietary = !!(meta.allergies && meta.allergies.trim());
                        } else if (crmDietaryFilter !== "TODOS") {
                          matchesDietary = (meta.dietary || []).includes(crmDietaryFilter);
                        }

                        return matchesSearch && matchesCategory && matchesDietary;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500">
                              <Users className="h-10 w-10 mx-auto text-slate-700 mb-2" />
                              <p className="font-bold text-sm">No se encontraron clientes con los filtros aplicados</p>
                              <p className="text-xs text-slate-600 mt-1">Intenta con otros términos o registra un nuevo cliente.</p>
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((cust) => {
                        const meta = parseCustomerMetadata(cust.notes);
                        const insights = getCustomerInsights(cust, restaurant.orders || [], meta);
                        const cleanPhone = (cust.phone || "").replace(/\D/g, "");

                        // WhatsApp links
                        const standardWaText = `¡Hola ${encodeURIComponent(cust.name)}! Te saludamos de *${encodeURIComponent(restaurant.name)}*. ¡Gracias por ser nuestro cliente!`;
                        const birthdayWaText = `¡Feliz Cumpleaños ${encodeURIComponent(cust.name)}! 🎂🎉 De parte de todo el equipo de *${encodeURIComponent(restaurant.name)}*, esperamos que tengas un día increíble. ¡Te regalamos un detalle especial en tu próxima visita presentando este mensaje!`;
                        
                        const defaultWaLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${insights.isBirthdayToday || insights.isBirthdayThisMonth ? birthdayWaText : standardWaText}`;

                        return (
                          <tr key={cust.id} className="hover:bg-slate-850/40 transition group">
                            <td className="py-3.5 pl-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{cust.name}</span>
                                {insights.isBirthdayToday && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/20 border border-pink-500/40 text-pink-300 animate-pulse">
                                    <Cake className="h-3 w-3" />
                                    ¡Cumpleaños Hoy!
                                  </span>
                                )}
                                {!insights.isBirthdayToday && insights.isBirthdayThisMonth && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                    🎂 {insights.formattedBirthday}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-400 text-xs flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>📱 {cust.phone}</span>
                                {cust.city && <span className="text-slate-500">• 📍 {cust.city}</span>}
                              </div>
                            </td>

                            <td className="py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                cust.category === "VIP"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : cust.category === "FRECUENTE"
                                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                    : cust.category === "INACTIVO"
                                      ? "bg-slate-800 text-slate-500 border border-slate-700"
                                      : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              }`}>
                                {cust.category === "VIP" ? "⭐ VIP" : cust.category === "FRECUENTE" ? "🔥 FRECUENTE" : cust.category === "INACTIVO" ? "💤 INACTIVO" : "🆕 NUEVO"}
                              </span>
                            </td>

                            <td className="py-3.5">
                              {isServiciosTecnicos ? (
                                <div className="space-y-1 max-w-[220px]">
                                  {(meta.equipmentBrand || meta.equipmentTech) ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {meta.equipmentBrand && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                          <Tag className="h-3 w-3 text-amber-400" />
                                          <span>{meta.equipmentBrand}</span>
                                        </span>
                                      )}
                                      {meta.equipmentTech && (
                                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                          {meta.equipmentTech}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}

                                  {(meta.symptoms && meta.symptoms.length > 0) ? (
                                    <div className="flex flex-wrap gap-1">
                                      {meta.symptoms.slice(0, 2).map((s: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-0.5"
                                          title={s}
                                        >
                                          <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                                          <span className="truncate max-w-[120px]">{s}</span>
                                        </span>
                                      ))}
                                      {meta.symptoms.length > 2 && (
                                        <span className="text-[9px] text-slate-500">+{meta.symptoms.length - 2} más</span>
                                      )}
                                    </div>
                                  ) : null}

                                  {!meta.equipmentBrand && !meta.equipmentTech && (!meta.symptoms || meta.symptoms.length === 0) && (
                                    <span className="text-slate-600 italic text-[11px]">Sin equipo registrado</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {(meta.dietary && meta.dietary.length > 0) ? (
                                    meta.dietary.map((d) => {
                                      const match = DIETARY_PREFERENCES_LIST.find((dp) => dp.id === d);
                                      return (
                                        <span
                                          key={d}
                                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${match?.color || "bg-slate-800 text-slate-300 border-slate-700"}`}
                                          title={match?.label || d}
                                        >
                                          {match?.emoji || "🥗"} {match?.label || d}
                                        </span>
                                      );
                                    })
                                  ) : null}

                                  {meta.allergies && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1"
                                      title={`Alergia: ${meta.allergies}`}
                                    >
                                      <ShieldAlert className="h-3 w-3 text-rose-400" />
                                      <span>{meta.allergies}</span>
                                    </span>
                                  )}

                                  {(!meta.dietary || meta.dietary.length === 0) && !meta.allergies && (
                                    <span className="text-slate-600 italic text-[11px]">Sin restricciones</span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5">
                              {isServiciosTecnicos ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-white flex items-center gap-1 text-xs">
                                    <Wrench className="h-3 w-3 text-cyan-400 shrink-0" />
                                    <span className="truncate max-w-[150px]" title={meta.lastService || insights.favoriteDish || "Servicio Técnico"}>
                                      {meta.lastService || insights.favoriteDish || "Servicio Técnico"}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 block">
                                    {cust.totalOrders} {cust.totalOrders === 1 ? "visita técnica" : "visitas técnicas"}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-white flex items-center gap-1 text-xs">
                                    <Utensils className="h-3 w-3 text-amber-400 shrink-0" />
                                    <span className="truncate max-w-[150px]" title={insights.favoriteDish}>
                                      {insights.favoriteDish}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 block">
                                    {cust.totalOrders} {cust.totalOrders === 1 ? "pedido / visita" : "pedidos / visitas"}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 text-right">
                              <div className="space-y-0.5">
                                <span className="font-black text-emerald-400 block">
                                  ${cust.totalSpent.toFixed(2)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                  <Award className="h-3 w-3 text-amber-400" />
                                  {(meta.points || 0)} pts
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 text-slate-400">
                              {new Date(cust.lastOrderAt).toLocaleDateString("es-ES")}
                            </td>

                            <td className="py-3.5 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedCustomer360(cust)}
                                  className="p-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 border border-cyan-800/40 transition active:scale-95"
                                  title="Ver Ficha 360° y Puntos"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <a
                                  href={defaultWaLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-xl border transition active:scale-95 ${
                                    insights.isBirthdayToday || insights.isBirthdayThisMonth
                                      ? "bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 border-pink-800/40"
                                      : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/40"
                                  }`}
                                  title={insights.isBirthdayToday || insights.isBirthdayThisMonth ? "Felicitar Cumpleaños por WhatsApp" : "Contactar por WhatsApp"}
                                >
                                  {insights.isBirthdayToday || insights.isBirthdayThisMonth ? (
                                    <Cake className="h-4 w-4 text-pink-400" />
                                  ) : (
                                    <MessageSquare className="h-4 w-4" />
                                  )}
                                </a>
                                <button
                                  onClick={() => handleOpenCustomerModal(cust)}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                                  title="Editar Cliente & Preferencias"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Eliminar al cliente "${cust.name}"?`)) {
                                      await deleteCustomerAction(cust.id);
                                      window.location.reload();
                                    }
                                  }}
                                  className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 transition active:scale-95"
                                  title="Eliminar Cliente"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal for Create/Edit Customer */}
            {isCustomerModalOpen && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl my-8">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {isServiciosTecnicos ? (
                          <>
                            <Wrench className="h-5 w-5 text-cyan-400" />
                            <span>{editingCustomer ? "Ficha Técnica de Cliente" : "Registrar Cliente de Servicios"}</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5 text-amber-400" />
                            <span>{editingCustomer ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}</span>
                          </>
                        )}
                      </h3>
                      {isServiciosTecnicos && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Expediente del cliente, diagnóstico del equipo y condiciones de visita técnica.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setIsCustomerModalOpen(false)}
                      className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                    >
                      Cerrar
                    </button>
                  </div>

                  {/* Modular Tabs for Technical Services (Opción 2) */}
                  {isServiciosTecnicos && (
                    <div className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-2xl gap-1">
                      <button
                        type="button"
                        onClick={() => setCustModalTab("contacto")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition ${
                          custModalTab === "contacto"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>1. Contacto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustModalTab("tecnico")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition ${
                          custModalTab === "tecnico"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>2. Equipo & Fallas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustModalTab("visitas")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition ${
                          custModalTab === "visitas"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>3. Visitas & Notas</span>
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
                    {/* VISTA A: SERVICIOS TÉCNICOS (FICHA MODULAR POR PESTAÑAS) */}
                    {isServiciosTecnicos ? (
                      <>
                        {/* PESTAÑA 1: CONTACTO & DOMICILIO */}
                        {custModalTab === "contacto" && (
                          <div className="space-y-3 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Nombre Completo *</label>
                                <input
                                  type="text"
                                  required
                                  value={custName}
                                  onChange={(e) => setCustName(e.target.value)}
                                  placeholder="Ej. María López"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Teléfono / WhatsApp *</label>
                                <input
                                  type="tel"
                                  required
                                  value={custPhone}
                                  onChange={(e) => setCustPhone(e.target.value)}
                                  placeholder="Ej. 0991234567"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Categoría CRM</label>
                                <select
                                  value={custCategory}
                                  onChange={(e) => setCustCategory(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                >
                                  <option value="NUEVO">🆕 Nuevo</option>
                                  <option value="FRECUENTE">🔥 Frecuente</option>
                                  <option value="VIP">⭐ VIP</option>
                                  <option value="INACTIVO">💤 Inactivo</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Ciudad / Sector</label>
                                <input
                                  type="text"
                                  value={custCity}
                                  onChange={(e) => setCustCity(e.target.value)}
                                  placeholder="Ej. Manta / Barbasquillo"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Correo Electrónico</label>
                                <input
                                  type="email"
                                  value={custEmail}
                                  onChange={(e) => setCustEmail(e.target.value)}
                                  placeholder="cliente@ejemplo.com"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-slate-300 font-semibold flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                                  Dirección de Visita Técnica Habitual
                                </label>
                                <button
                                  type="button"
                                  onClick={handleDetectCustomerGps}
                                  disabled={custGpsLoading}
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold disabled:opacity-50"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {custGpsLoading ? "Detectando GPS..." : "📍 Capturar mi GPS actual"}
                                </button>
                              </div>
                              <input
                                type="text"
                                value={custAddress}
                                onChange={(e) => setCustAddress(e.target.value)}
                                placeholder="Ej. Av. Barbasquillo #404 frente al parque [GPS: -1.0543,-80.7221]"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                              />
                              {custAddress && custAddress.includes("[GPS:") && (
                                <div className="mt-1 flex items-center justify-between text-[11px] bg-cyan-950/30 border border-cyan-800/40 px-2.5 py-1 rounded-lg text-cyan-300">
                                  <span>📍 Coordenadas GPS fijadas para visitas a domicilio</span>
                                  {(() => {
                                    const match = custAddress.match(/\[GPS:\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/);
                                    if (match) {
                                      return (
                                        <a
                                          href={`https://www.google.com/maps/search/?api=1&query=${match[1]},${match[2]}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="underline hover:text-white font-bold ml-2"
                                        >
                                          Abrir en Google Maps ↗
                                        </a>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* PESTAÑA 2: PERFIL TÉCNICO & EQUIPOS */}
                        {custModalTab === "tecnico" && (
                          <div className="space-y-3.5 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5 text-amber-400" />
                                  Marca del Equipo o Artefacto
                                </label>
                                <select
                                  value={custEquipmentBrand}
                                  onChange={(e) => setCustEquipmentBrand(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                >
                                  {SERVICIOS_MARCAS_COMUNES.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                                {custEquipmentBrand === "Otra" && (
                                  <input
                                    type="text"
                                    value={custCustomBrand}
                                    onChange={(e) => setCustCustomBrand(e.target.value)}
                                    placeholder="Escribe la marca del equipo..."
                                    className="mt-2 w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                  />
                                )}
                              </div>

                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Tipo de Tecnología</label>
                                <select
                                  value={custEquipmentTech}
                                  onChange={(e) => setCustEquipmentTech(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                >
                                  {SERVICIOS_TECNOLOGIAS.map((t) => (
                                    <option key={t.id} value={t.label}>{t.label} ({t.desc})</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                                <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                                Servicio Técnico Habitual / Frecuente
                              </label>
                              <input
                                type="text"
                                value={custLastService}
                                onChange={(e) => setCustLastService(e.target.value)}
                                placeholder="Ej. Mantenimiento de Bombas de Agua, Split, Lavadora..."
                                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                              />
                            </div>

                            <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="block text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                                  Fallas y Síntomas Reportados por el Cliente
                                </label>
                                <span className="text-[10px] text-slate-500">Haz clic para activar</span>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {SERVICIOS_SINTOMAS_HABITUALES.map((sym) => {
                                  const isSelected = custSymptoms.includes(sym);
                                  return (
                                    <button
                                      type="button"
                                      key={sym}
                                      onClick={() => handleToggleCustomerSymptom(sym)}
                                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                                        isSelected
                                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                      }`}
                                    >
                                      {sym}
                                    </button>
                                  );
                                })}
                                {custSymptoms.filter((s) => !SERVICIOS_SINTOMAS_HABITUALES.includes(s)).map((customSym) => (
                                  <span
                                    key={customSym}
                                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1"
                                  >
                                    <span>{customSym}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCustomerSymptom(customSym)}
                                      className="text-amber-400 hover:text-white ml-0.5"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 pt-1.5">
                                <input
                                  type="text"
                                  value={custCustomSymptom}
                                  onChange={(e) => setCustCustomSymptom(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddCustomSymptom();
                                    }
                                  }}
                                  placeholder="Escribir otra falla y pulsar '+ Agregar'..."
                                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddCustomSymptom}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                                >
                                  + Agregar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PESTAÑA 3: VISITAS & NOTAS TÉCNICAS */}
                        {custModalTab === "visitas" && (
                          <div className="space-y-3.5 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
                                  Franja Horaria Preferida de Visita
                                </label>
                                <select
                                  value={custPreferredTimeSlot}
                                  onChange={(e) => setCustPreferredTimeSlot(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                                >
                                  {SERVICIOS_FRANJAS_HORARIAS.map((f) => (
                                    <option key={f.id} value={f.label}>{f.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                                  <Award className="h-3.5 w-3.5 text-emerald-400" />
                                  Puntos de Lealtad (Descuento Mano de Obra)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={custPoints}
                                  onChange={(e) => setCustPoints(parseInt(e.target.value, 10) || 0)}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white focus:outline-none font-bold"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                                <Cake className="h-3.5 w-3.5 text-pink-400" />
                                Fecha de Cumpleaños (Opcional)
                              </label>
                              <input
                                type="date"
                                value={custBirthDate}
                                onChange={(e) => setCustBirthDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-300 mb-1 font-semibold">Notas Técnicas & Acceso al Inmueble</label>
                              <textarea
                                rows={3}
                                value={custCustomNotes}
                                onChange={(e) => setCustCustomNotes(e.target.value)}
                                placeholder="Ej. Timbre no funciona, llamar 15 minutos antes de llegar, perro guardián en patio, equipo ubicado en terraza del 2do piso..."
                                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* VISTA B: RESTAURANTES / GASTRONOMÍA */
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold">Nombre Completo *</label>
                            <input
                              type="text"
                              required
                              value={custName}
                              onChange={(e) => setCustName(e.target.value)}
                              placeholder="Ej. María López"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold">Teléfono / WhatsApp *</label>
                            <input
                              type="tel"
                              required
                              value={custPhone}
                              onChange={(e) => setCustPhone(e.target.value)}
                              placeholder="Ej. 0991234567"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold">Categoría CRM</label>
                            <select
                              value={custCategory}
                              onChange={(e) => setCustCategory(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            >
                              <option value="NUEVO">🆕 Nuevo</option>
                              <option value="FRECUENTE">🔥 Frecuente</option>
                              <option value="VIP">⭐ VIP</option>
                              <option value="INACTIVO">💤 Inactivo</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold">Ciudad / Sector</label>
                            <input
                              type="text"
                              value={custCity}
                              onChange={(e) => setCustCity(e.target.value)}
                              placeholder="Ej. Manta / Barbasquillo"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold">Correo Electrónico</label>
                            <input
                              type="email"
                              value={custEmail}
                              onChange={(e) => setCustEmail(e.target.value)}
                              placeholder="cliente@ejemplo.com"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Dirección de Entrega Habitual</label>
                          <input
                            type="text"
                            value={custAddress}
                            onChange={(e) => setCustAddress(e.target.value)}
                            placeholder="Ej. Av. Barbasquillo #404 frente al parque"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                          />
                        </div>

                        {/* Preferencias Dietéticas (Checkboxes) */}
                        <div className="bg-slate-950/60 border border-slate-850 p-3.5 rounded-2xl space-y-2">
                          <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                            <Wheat className="h-4 w-4 text-emerald-400" />
                            Preferencias Dietéticas
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {DIETARY_PREFERENCES_LIST.map((diet) => {
                              const isSelected = custDietary.includes(diet.id);
                              return (
                                <button
                                  type="button"
                                  key={diet.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setCustDietary(custDietary.filter((d) => d !== diet.id));
                                    } else {
                                      setCustDietary([...custDietary, diet.id]);
                                    }
                                  }}
                                  className={`p-2 rounded-xl text-left font-bold transition flex items-center justify-between border ${
                                    isSelected
                                      ? `${diet.color} shadow-sm`
                                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span>{diet.emoji}</span>
                                    <span className="text-[11px]">{diet.label}</span>
                                  </span>
                                  {isSelected ? (
                                    <CheckSquare className="h-3.5 w-3.5 text-current shrink-0" />
                                  ) : (
                                    <Square className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Alergias & Cumpleaños */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                              Alergias o Restricciones Críticas
                            </label>
                            <input
                              type="text"
                              value={custAllergies}
                              onChange={(e) => setCustAllergies(e.target.value)}
                              placeholder="Ej. Mariscos, Maní, Frutos secos"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                              <Cake className="h-3.5 w-3.5 text-pink-400" />
                              Fecha de Cumpleaños
                            </label>
                            <input
                              type="date"
                              value={custBirthDate}
                              onChange={(e) => setCustBirthDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Plato Favorito & Puntos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                              <Utensils className="h-3.5 w-3.5 text-amber-400" />
                              Plato Favorito (Opcional)
                            </label>
                            <input
                              type="text"
                              value={custFavoriteDish}
                              onChange={(e) => setCustFavoriteDish(e.target.value)}
                              placeholder="Ej. Empanada de Carne y Queso"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                              <Award className="h-3.5 w-3.5 text-emerald-400" />
                              Saldo de Puntos de Lealtad
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={custPoints}
                              onChange={(e) => setCustPoints(parseInt(e.target.value, 10) || 0)}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-white focus:outline-none font-bold"
                            />
                          </div>
                        </div>

                        {/* Notas adicionales */}
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">Notas Internas & Preferencias</label>
                          <textarea
                            rows={2}
                            value={custCustomNotes}
                            onChange={(e) => setCustCustomNotes(e.target.value)}
                            placeholder="Ej. Le gusta mesa junto a la ventana, siempre pide salsa extra..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <div className="flex items-center gap-1">
                        {isServiciosTecnicos && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            {custModalTab === "tecnico" && (
                              <button
                                type="button"
                                onClick={() => setCustModalTab("contacto")}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                              >
                                ← Contacto
                              </button>
                            )}
                            {custModalTab === "visitas" && (
                              <button
                                type="button"
                                onClick={() => setCustModalTab("tecnico")}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                              >
                                ← Equipo
                              </button>
                            )}
                            {custModalTab === "contacto" && (
                              <button
                                type="button"
                                onClick={() => setCustModalTab("tecnico")}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                              >
                                Equipo & Fallas →
                              </button>
                            )}
                            {custModalTab === "tecnico" && (
                              <button
                                type="button"
                                onClick={() => setCustModalTab("visitas")}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                              >
                                Visitas & Notas →
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCustomerModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingCustomer}
                          className={`px-5 py-2 rounded-xl text-white font-bold transition shadow-lg disabled:opacity-50 ${
                            isServiciosTecnicos
                              ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                              : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500"
                          }`}
                        >
                          {savingCustomer ? "Guardando..." : editingCustomer ? "Guardar Cambios" : "Crear Cliente"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal for Customer 360 View */}
            {selectedCustomer360 && (() => {
              const cust = selectedCustomer360;
              const meta = parseCustomerMetadata(cust.notes);
              const insights = getCustomerInsights(cust, restaurant.orders || [], meta);
              const cleanPhone = (cust.phone || "").replace(/\D/g, "");

              const standardWaText = `¡Hola ${encodeURIComponent(cust.name)}! Te saludamos de *${encodeURIComponent(restaurant.name)}*. ¡Gracias por ser nuestro cliente!`;
              const birthdayWaText = `¡Feliz Cumpleaños ${encodeURIComponent(cust.name)}! 🎂🎉 De parte de todo el equipo de *${encodeURIComponent(restaurant.name)}*, te deseamos un día extraordinario. ¡Te regalamos un postre o descuento especial en tu próxima visita presentando este mensaje!`;

              return (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl my-8">
                    {/* 360 Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-extrabold text-white">{cust.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              cust.category === "VIP"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : cust.category === "FRECUENTE"
                                  ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                            }`}>
                              {cust.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>📱 {cust.phone}</span>
                            {cust.email && <span>• ✉️ {cust.email}</span>}
                            {cust.city && <span>• 📍 {cust.city}</span>}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedCustomer360(null)}
                        className="text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800/80 text-xs font-bold self-start sm:self-auto"
                      >
                        Cerrar
                      </button>
                    </div>

                    {/* Stat Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {isServiciosTecnicos ? "Visitas Técnicas" : "Visitas / Pedidos"}
                        </span>
                        <p className="text-xl font-black text-white mt-1">{cust.totalOrders}</p>
                        <span className="text-[10px] text-slate-500">
                          {isServiciosTecnicos ? "Cotizaciones y visitas" : "Historial total"}
                        </span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto Acumulado</span>
                        <p className="text-xl font-black text-emerald-400 mt-1">${cust.totalSpent.toFixed(2)}</p>
                        <span className="text-[10px] text-slate-500">Total facturado</span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket Promedio</span>
                        <p className="text-xl font-black text-cyan-400 mt-1">${insights.avgTicket.toFixed(2)}</p>
                        <span className="text-[10px] text-slate-500">
                          {isServiciosTecnicos ? "Por visita técnica" : "Por visita/pedido"}
                        </span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          Puntos Lealtad
                        </span>
                        <p className="text-xl font-black text-amber-300 mt-1">{meta.points || 0} pts</p>
                        <span className="text-[10px] text-slate-500">Saldo actual</span>
                      </div>
                    </div>

                    {/* Preferencias & Alergias & Cumpleaños Box OR Perfil Técnico Box */}
                    {isServiciosTecnicos ? (
                      <div className="bg-slate-950/60 border border-cyan-900/40 p-4 rounded-2xl space-y-3 text-xs">
                        <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-cyan-400" />
                          Perfil Técnico & Diagnóstico del Equipo
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Equipo & Tecnología:</span>
                            {(meta.equipmentBrand || meta.equipmentTech) ? (
                              <div className="space-y-1">
                                {meta.equipmentBrand && (
                                  <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                    <Tag className="h-3 w-3 text-amber-400" />
                                    {meta.equipmentBrand}
                                  </span>
                                )}
                                {meta.equipmentTech && (
                                  <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-800 text-slate-300 border border-slate-700 block w-fit">
                                    {meta.equipmentTech}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Sin equipo registrado</span>
                            )}
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Síntomas / Fallas Reportadas:</span>
                            {(meta.symptoms && meta.symptoms.length > 0) ? (
                              <div className="flex flex-wrap gap-1">
                                {meta.symptoms.map((s: string, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3 text-rose-400" />
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Sin síntomas específicos</span>
                            )}
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Último Servicio Solicitado:</span>
                            {meta.lastService ? (
                              <div className="space-y-0.5">
                                <span className="text-cyan-300 font-bold flex items-center gap-1 text-[11px]">
                                  <Wrench className="h-3 w-3 text-cyan-400" />
                                  {meta.lastService}
                                </span>
                                {meta.preferredTimeSlot && (
                                  <span className="text-[10px] text-slate-400 block">Horario: {meta.preferredTimeSlot}</span>
                                )}
                                {meta.lastQuoteAt && (
                                  <span className="text-[9px] text-slate-500 block">
                                    Cotizado: {new Date(meta.lastQuoteAt).toLocaleDateString("es-ES")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No registrado</span>
                            )}
                          </div>
                        </div>

                        {meta.customNotes && (
                          <div className="pt-2 border-t border-slate-850">
                            <span className="text-[11px] font-bold text-slate-400 block">Notas técnicas de atención:</span>
                            <p className="text-slate-300 text-xs mt-0.5 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                              "{meta.customNotes}"
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3 text-xs">
                        <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                          <Wheat className="h-4 w-4 text-amber-400" />
                          Perfil Alimentario & Fechas
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Dietas:</span>
                            <div className="flex flex-wrap gap-1">
                              {(meta.dietary && meta.dietary.length > 0) ? (
                                meta.dietary.map(d => {
                                  const match = DIETARY_PREFERENCES_LIST.find(dp => dp.id === d);
                                  return (
                                    <span key={d} className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${match?.color || "bg-slate-800 text-white"}`}>
                                      {match?.emoji} {match?.label || d}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Sin dietas especiales</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Alergias / Intolerancias:</span>
                            {meta.allergies ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3 text-rose-400" />
                                {meta.allergies}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Ninguna alergia registrada</span>
                            )}
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-400 block mb-1">Cumpleaños:</span>
                            {meta.birthDate ? (
                              <div className="space-y-0.5">
                                <span className="text-pink-300 font-bold flex items-center gap-1 text-[11px]">
                                  <Cake className="h-3 w-3 text-pink-400" />
                                  {insights.formattedBirthday}
                                </span>
                                {insights.isBirthdayToday ? (
                                  <span className="text-[10px] text-emerald-400 font-extrabold block">🎉 ¡Hoy cumple años!</span>
                                ) : insights.daysUntilBirthday !== null ? (
                                  <span className="text-[10px] text-slate-500 block">Faltan {insights.daysUntilBirthday} días</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No registrado</span>
                            )}
                          </div>
                        </div>

                        {meta.customNotes && (
                          <div className="pt-2 border-t border-slate-850">
                            <span className="text-[11px] font-bold text-slate-400 block">Notas de atención:</span>
                            <p className="text-slate-300 text-xs mt-0.5 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                              "{meta.customNotes}"
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Loyalty Points Adjustment */}
                    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-white flex items-center gap-2">
                          <Award className="h-4 w-4 text-emerald-400" />
                          Gestión Rápida de Puntos de Lealtad
                        </h4>
                        <span className="font-black text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 text-xs">
                          Saldo: {meta.points || 0} pts
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isAdjustingPoints}
                          onClick={() => handleQuickAdjustPoints(cust, 10)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 font-bold transition disabled:opacity-50"
                        >
                          +10 Puntos
                        </button>
                        <button
                          type="button"
                          disabled={isAdjustingPoints}
                          onClick={() => handleQuickAdjustPoints(cust, 50)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 font-bold transition disabled:opacity-50"
                        >
                          +50 Puntos
                        </button>
                        <button
                          type="button"
                          disabled={isAdjustingPoints || (meta.points || 0) < 50}
                          onClick={() => handleQuickAdjustPoints(cust, -50)}
                          className="px-3 py-1.5 rounded-xl bg-amber-950/60 text-amber-300 border border-amber-800/40 hover:bg-amber-900/60 font-bold transition disabled:opacity-50"
                        >
                          -50 Puntos (Canje)
                        </button>
                        <button
                          type="button"
                          disabled={isAdjustingPoints || (meta.points || 0) < 100}
                          onClick={() => handleQuickAdjustPoints(cust, -100)}
                          className="px-3 py-1.5 rounded-xl bg-red-950/60 text-red-300 border border-red-800/40 hover:bg-red-900/60 font-bold transition disabled:opacity-50"
                        >
                          -100 Puntos (Canje)
                        </button>
                      </div>
                    </div>

                    {/* Order History Timeline */}
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                        <History className="h-4 w-4 text-amber-400" />
                        {isServiciosTecnicos
                          ? `Historial de Visitas y Cotizaciones (${insights.matchingOrders.length})`
                          : `Historial de Pedidos (${insights.matchingOrders.length})`}
                      </h4>
                      {insights.matchingOrders.length === 0 ? (
                        <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-center text-slate-500 text-xs">
                          No se encontraron pedidos registrados con el teléfono {cust.phone}.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                          {insights.matchingOrders.map((ord) => (
                            <div key={ord.id} className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>Pedido #{ord.orderNumber || ord.id.substring(0, 6)}</span>
                                  <span className="text-[10px] text-amber-400 font-normal">
                                    {ord.tableName === "Llevar" ? "Para llevar" : ord.tableName === "Domicilio" ? "Domicilio" : `Mesa #${ord.tableName}`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {(ord.items || []).map(it => `${it.quantity}x ${it.dishName}`).join(", ") || "Sin detalle de platos"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-emerald-400 text-sm block">${ord.total.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(ord.createdAt).toLocaleDateString("es-ES")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
                      <a
                        href={`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${standardWaText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Mensaje Habitual
                      </a>
                      <a
                        href={`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${birthdayWaText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg"
                      >
                        <Cake className="h-3.5 w-3.5" />
                        Felicitar Cumpleaños (Regalo)
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* Modal for Import Contacts (CSV / VCF / Text) */}
            {isImportModalOpen && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Upload className="h-5 w-5 text-amber-400" />
                      Importar Contactos CRM
                    </h3>
                    <button
                      onClick={() => setIsImportModalOpen(false)}
                      className="text-slate-400 hover:text-white px-2 py-1 text-xs font-bold"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                      <span className="font-bold text-amber-400 text-xs block">💡 Formatos Compatibles:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                        <li><strong>vCard (.vcf)</strong>: Contactos exportados directamente de tu celular Android, iPhone o Google Contacts.</li>
                        <li><strong>CSV / TXT (.csv, .txt)</strong>: Archivos formateados con columnas <code className="text-white">Nombre,Telefono</code> (ej. Excel / Google Sheets).</li>
                        <li><strong>Texto Directo</strong>: Copia y pega tu lista de contactos directamente en la caja inferior.</li>
                      </ul>
                    </div>

                    {/* File Drop / Select Input */}
                    <div>
                      <label className="block text-slate-300 mb-1.5 font-bold">1. Seleccionar archivo (.csv, .vcf, .txt):</label>
                      <input
                        type="file"
                        accept=".csv,.vcf,.txt"
                        onChange={handleImportFileUpload}
                        className="w-full text-slate-400 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                      />
                      {importFileName && (
                        <p className="text-[11px] text-emerald-400 font-bold mt-1">📄 Archivo cargado: {importFileName}</p>
                      )}
                    </div>

                    {/* Raw Text Input */}
                    <div>
                      <label className="block text-slate-300 mb-1.5 font-bold">2. O pega el contenido directamente aquí:</label>
                      <textarea
                        rows={5}
                        value={importTextContent}
                        onChange={(e) => setImportTextContent(e.target.value)}
                        placeholder={`ejemplo CSV:\nJuan Pérez, 0991234567, juan@correo.com, Olón\nMaría López, 0987654321, maria@correo.com, Montañita`}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-2xl p-3 text-white font-mono text-[11px] focus:outline-none"
                      />
                    </div>

                    {importMessage && (
                      <div className={`p-3 rounded-xl text-xs font-bold ${importMessage.startsWith("Error") ? "bg-red-950/40 text-red-400 border border-red-800/40" : "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"}`}>
                        {importMessage}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={isImporting || !importTextContent.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold hover:from-red-500 hover:to-amber-500 transition shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isImporting ? "Procesando Importación..." : "Procesar & Importar Contactos"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Citas & Agenda CRM Tab */}
        {activeTab === "citas" && (
          <div className="space-y-6 animate-fade-in">
            <CitasAdminTab restaurant={restaurant} />
          </div>
        )}

        {/* Reservas & Hospedaje CRM Tab */}
        {activeTab === "reservas" && (
          <div className="space-y-6 animate-fade-in">
            <ReservasAdminTab 
              restaurant={restaurant} 
              onNavigateToDishes={() => setActiveTab("dishes")}
            />
          </div>
        )}

        {/* Plan & Suscripción Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Crown className="w-64 h-64 text-amber-500" />
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Crown className="w-3.5 h-3.5" /> Planes y Suscripción
                  </div>
                  <h2 className="text-2xl font-extrabold text-white">Elige tu Plan de Suscripción</h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Acceso total a todas las herramientas sin comisiones por pedido.
                  </p>
                </div>

                <div className="text-right bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-2xl font-black text-white">Desde $15.00 <span className="text-xs font-normal text-slate-400">/ mes</span></div>
                  <span className="text-[10px] text-amber-400 font-medium">Facturación mensual en USD</span>
                </div>
              </div>

              {/* Status card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <span className="text-xs text-slate-400 font-medium">Estado del Plan</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${
                      (currentPlan === "PRO" || currentPlan === "ELITE") && currentTrialEndsAt > new Date()
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                    }`} />
                    <span className="font-bold text-white text-base">
                      {currentPlan === "ELITE" && currentTrialEndsAt > new Date()
                        ? "⭐ Plan Elite Activo ($20 USD/mes)"
                        : currentPlan === "PRO" && currentTrialEndsAt > new Date()
                        ? "Plan Pro Activo ($15 USD/mes)"
                        : currentPlan === "PRO" || currentPlan === "ELITE"
                        ? "Suscripción Vencida"
                        : "Prueba Gratuita"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <span className="text-xs text-slate-400 font-medium">Fecha de Vencimiento</span>
                  <div className="font-bold text-slate-200 text-base">
                    {currentTrialEndsAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Two Plan Cards in Admin Tab */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Plan 1: Plan Digital Pro ($15/mes) */}
                <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                          Autogestión
                        </span>
                        <h3 className="text-lg font-black text-white mt-1.5">Plan Digital Pro</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">$15</span>
                        <span className="text-xs text-slate-400">/mes</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-xs">
                      Gestiona y actualiza tu menú, platos, precios y pedidos con total autonomía.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Menú QR interactivo ilimitado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Pedidos automáticos a WhatsApp</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Gestión de platos, combos e inventarios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>0% de comisiones por ventas</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanPrice(15);
                      setShowPaymentModal(true);
                    }}
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar Plan Pro ($15/mes)
                  </button>
                </div>

                {/* Plan 2: Plan Elite ($20/mes) */}
                <div className="bg-gradient-to-b from-amber-500/10 via-purple-500/5 to-slate-950 border-2 border-amber-500/50 p-6 rounded-2xl space-y-5 flex flex-col justify-between relative overflow-hidden">
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-purple-600 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                          ⭐ Plan Elite VIP
                        </span>
                        <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5">
                          Plan Elite ($20/mes)
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">$20</span>
                        <span className="text-xs text-amber-400">/mes</span>
                      </div>
                    </div>
                    <p className="text-amber-200/90 text-xs font-medium">
                      🚀 <strong>Servicio Llave en Mano:</strong> Nosotros nos encargamos de todo para que tú solo te concentres en atender a tus clientes.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-100 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Subida completa de información, platos y fotografías por nuestro equipo</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-100 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Mantenimientos mensuales y revisiones recurrentes</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-100 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Asesoramiento premium 1 a 1 en la utilización de la app y ventas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Todo lo incluido en el Plan Pro (WhatsApp, QR, Inventario)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanPrice(20);
                      setShowPaymentModal(true);
                    }}
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar Plan Elite ($20/mes)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        
      </main>

      {/* Modal de solicitud de pago manual */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6 my-8">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/50 transition"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <div className="h-12 w-12 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Solicitud de pago de suscripción</h3>
              <p className="text-slate-400 text-xs">
                Restaurante: <strong className="text-white">{restaurant.name}</strong>
              </p>
            </div>

            {/* Plan Selector Inside Modal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Selecciona el Plan a Activar / Renovar:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanPrice(15)}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedPlanPrice === 15 
                      ? "border-emerald-400 bg-emerald-500/10 text-white" 
                      : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Autogestión</span>
                  <span className="font-extrabold text-sm block mt-0.5">Plan Pro</span>
                  <span className="text-emerald-400 font-bold text-xs">$15.00 USD/mes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlanPrice(20)}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedPlanPrice === 20 
                      ? "border-amber-400 bg-amber-500/10 text-white" 
                      : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-400">⭐ Gestión & Asesoría</span>
                  <span className="font-extrabold text-sm block mt-0.5">Plan Elite</span>
                  <span className="text-amber-400 font-bold text-xs">$20.00 USD/mes</span>
                </button>
              </div>

              {/* Explicación de la diferencia entre planes */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-300">
                {selectedPlanPrice === 20 ? (
                  <div className="space-y-1">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5">
                      ⭐ Plan Elite ($20.00 USD/mes) - Servicio Llave en Mano:
                    </p>
                    <p className="text-slate-400">
                      La empresa MenuQR Pro se encarga de subir toda tu información, platos y fotografías, además de brindarte mantenimientos mensuales recurrentes y asesoramiento premium para optimizar tus ventas con la app.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                      Plan Pro ($15.00 USD/mes) - Autogestionado:
                    </p>
                    <p className="text-slate-400">
                      Tú administras tus platos y fotos con acceso completo al menú interactivo, pedidos por WhatsApp, códigos QR anti-spoofing por mesa, catálogo y control de inventarios.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Price summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Concepto:</span>
                <span className="font-bold text-white">
                  {selectedPlanPrice === 20 ? "Plan Elite ($20.00 USD/mes)" : "Plan Pro ($15.00 USD/mes)"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Período:</span>
                <span>30 días (activación tras verificación)</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Método:</span>
                <span className="text-amber-300 font-medium">Transferencia o Deuna</span>
              </div>
              <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center">
                <span className="font-bold text-white text-sm">Total a pagar:</span>
                <span className="text-2xl font-black text-amber-400">${selectedPlanPrice}.00 USD</span>
              </div>
            </div>

            <form onSubmit={handleManualSubscriptionPayment} className="space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                Realiza el pago de <strong>${selectedPlanPrice}.00 USD</strong> y envía la referencia. El plan se activará tras la verificación.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setManualPaymentMethod("transferencia")} className={`rounded-xl border px-3 py-3 text-xs font-bold ${manualPaymentMethod === "transferencia" ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-slate-700 text-slate-400"}`}>Transferencia</button>
                <button type="button" onClick={() => setManualPaymentMethod("deuna")} className={`rounded-xl border px-3 py-3 text-xs font-bold ${manualPaymentMethod === "deuna" ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-slate-700 text-slate-400"}`}>Deuna</button>
              </div>
              {manualPaymentMethod === "deuna" && subscriptionPaymentDetails?.qrUrl && <div className="rounded-2xl bg-white p-3 mx-auto max-w-[220px]"><img src={subscriptionPaymentDetails.qrUrl} alt="QR de Deuna para suscripción" className="w-full aspect-square object-contain" /></div>}
              {manualPaymentMethod === "transferencia" && subscriptionPaymentDetails && <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs space-y-1.5"><p><span className="text-slate-400">Banco:</span> {subscriptionPaymentDetails.bankName}</p><p><span className="text-slate-400">Tipo:</span> {subscriptionPaymentDetails.accountType}</p><p><span className="text-slate-400">Cuenta:</span> {subscriptionPaymentDetails.accountNumber}</p><p><span className="text-slate-400">Titular:</span> {subscriptionPaymentDetails.accountName}</p></div>}
              {manualPaymentMethod === "deuna" && subscriptionPaymentDetails?.deunaPhone && <p className="text-center text-xs text-slate-400">Teléfono Deuna: <strong className="text-white">{subscriptionPaymentDetails.deunaPhone}</strong></p>}
              <input required aria-label="Referencia de pago" value={manualPaymentReference} onChange={(e) => setManualPaymentReference(e.target.value)} placeholder="Número de operación o referencia" className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-white text-xs" />
              <input type="url" aria-label="URL del comprobante" value={manualPaymentReceiptUrl} onChange={(e) => setManualPaymentReceiptUrl(e.target.value)} placeholder="URL HTTPS del comprobante (opcional)" className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl text-white text-xs" />
              {paymentSuccessMsg && <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-2xl text-center font-bold"><CheckCircle2 className="w-4 h-4 inline mr-2" />{paymentSuccessMsg}</div>}
              <button type="submit" disabled={isSubmittingPayment} className="w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 disabled:opacity-50">{isSubmittingPayment ? "Enviando solicitud..." : `Enviar solicitud de pago ($${selectedPlanPrice}.00 USD)`}</button>
            </form>

            <p className="text-[10px] text-center text-slate-500 leading-normal">
              La activación se realiza manualmente después de verificar el comprobante de pago.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Purga / Vaciado de Datos de Prueba */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">¿Eliminar Datos de Prueba?</h3>
                <p className="text-xs text-rose-300 font-medium">Acción irreversible para iniciar la operación limpia</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2.5 text-xs text-slate-300">
              <p className="font-semibold text-white">Esta acción eliminará de forma permanente:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Todos los pedidos de prueba registrados en Mesas, Cocina y Menú.</li>
                <li>Todas las visitas y escaneos QR generados durante la etapa de pruebas.</li>
                <li>Las sesiones y cuentas divididas de prueba.</li>
              </ul>
              <div className="pt-2 border-t border-slate-800 text-emerald-400 font-medium">
                ✅ <strong>Tus datos maestros quedarán 100% a salvo:</strong> Tu menú, categorías, platos, precios, fotos, camareros, cupones y configuraciones NO se tocarán.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">
                Para confirmar, escribe la palabra <strong className="text-rose-400">ELIMINAR</strong> a continuación:
              </label>
              <input
                type="text"
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                placeholder="Escribe ELIMINAR"
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/60 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wider uppercase outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmInput("");
                }}
                disabled={isPurgingData}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePurgeTestData}
                disabled={isPurgingData || purgeConfirmInput.trim().toUpperCase() !== "ELIMINAR"}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg shadow-rose-600/20"
              >
                {isPurgingData ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando datos...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirmar y Purgar Pruebas
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Descarga de Respaldo Excel (.xlsx) */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Respaldo de Información (Excel)</h3>
                  <p className="text-xs text-slate-400">Descarga un libro .xlsx con todas las métricas del negocio</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Selector de Origen de Datos */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Origen de Datos a Exportar</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportDataSource("REAL")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      exportDataSource === "REAL"
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Ventas Reales
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportDataSource("TEST")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      exportDataSource === "TEST"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Datos de Prueba
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportDataSource("ALL")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      exportDataSource === "ALL"
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Consolidado
                  </button>
                </div>
              </div>

              {/* Selector de Periodo */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Periodo de Tiempo</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "ALL", label: "Todo el Historial" },
                    { id: "MONTH", label: "Últimos 30 días" },
                    { id: "WEEK", label: "Últimos 7 días" },
                    { id: "TODAY", label: "Hoy" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExportTimeframe(p.id as any)}
                      className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition ${
                        exportTimeframe === p.id
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview de lo que incluye */}
              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-white">El archivo descargado incluirá 5 pestañas organizadas:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>1. Resumen Ejecutivo (KPIs y Totales)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>2. Historial Detallado de Pedidos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>3. Platos Vendidos y Consumo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>4. Rendimiento y Cuadre de Meseros</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>5. Registro de Visitas y Tráfico QR</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleGenerateExcelBackup(exportDataSource)}
                disabled={isExportingExcel}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-40 transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {isExportingExcel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando Excel...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar Archivo (.xlsx)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Floating Bottom Navigation Bar for Admin on Mobile */}
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
      <div className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center justify-around shadow-2xl">
        {/* Metrics Tab */}
        <button
          onClick={() => setActiveTab("metrics")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "metrics" ? restaurant.themeColor : "#94a3b8" }}
        >
          <LineChart className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Métricas</span>
        </button>

        {/* Restaurant Tab */}
        <button
          onClick={() => setActiveTab("restaurant")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "restaurant" ? restaurant.themeColor : "#94a3b8" }}
        >
          <Store className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{bLabels.businessTabTitle}</span>
        </button>

        {/* Categories Tab */}
        <button
          onClick={() => setActiveTab("categories")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "categories" ? restaurant.themeColor : "#94a3b8" }}
        >
          <FolderHeart className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{bLabels.categories}</span>
        </button>

        {/* Dishes Tab */}
        <button
          onClick={() => setActiveTab("dishes")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "dishes" ? restaurant.themeColor : "#94a3b8" }}
        >
          <Soup className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">{bLabels.items}</span>
        </button>

        {/* Inventory Tab */}
        {bLabels.showInventory && (
          <button
            onClick={() => setActiveTab("inventory")}
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-200"
            style={{ color: activeTab === "inventory" ? restaurant.themeColor : "#94a3b8" }}
          >
            <Boxes className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">{bLabels.inventoryTabTitle.split(" ")[0]}</span>
          </button>
        )}

        {/* Caja POS Mobile Quick Link */}
        {bLabels.showCajaPos && (
          <Link
            href="/caja"
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-200 text-emerald-400 hover:text-emerald-300"
            title="Caja POS móvil"
          >
            <Barcode className="h-5 w-5 text-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Caja</span>
          </Link>
        )}

        {/* QR Tab */}
        <button
          onClick={() => setActiveTab("qr")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "qr" ? restaurant.themeColor : "#94a3b8" }}
        >
          <QrCode className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">QR</span>
        </button>

        {/* WhatsApp Tab */}
        {restaurant.whatsappBotEnabled && (
          <button
            onClick={() => setActiveTab("whatsapp")}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
            style={{ color: activeTab === "whatsapp" ? "#10b981" : "#94a3b8" }}
          >
            <Smartphone className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">WhatsApp</span>
          </button>
        )}

        {/* Orders Tab */}
        <button
          onClick={() => setActiveTab("orders")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "orders" ? restaurant.themeColor : "#94a3b8" }}
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Historial</span>
        </button>

        {/* Staff & Kitchen PIN (Mobile) */}
        {(bLabels.isGastro || selectedPreset === "RESTAURANT" || enableTableOrdering) && (
          <button
            onClick={() => setActiveTab("staff")}
            className="flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition duration-200"
            style={{ color: activeTab === "staff" ? "#f59e0b" : "#94a3b8" }}
            title="Equipo y Accesos (PIN)"
          >
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400">PINs</span>
          </button>
        )}

        {/* Reservas Tab */}
        {isLodging && !disabledModules.includes("reservas") && (
          <button
            onClick={() => setActiveTab("reservas")}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
            style={{ color: activeTab === "reservas" ? "#34d399" : "#94a3b8" }}
          >
            <Trees className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Reservas</span>
          </button>
        )}

        {/* Citas Tab */}
        {!isLodging && (selectedPreset === "CITAS" || enabledModules.includes("citas") || (!isServiciosTecnicos && (restaurant as any).businessType === "SERVICES")) && !disabledModules.includes("citas") && (
          <button
            onClick={() => setActiveTab("citas")}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
            style={{ color: activeTab === "citas" ? "#c084fc" : "#94a3b8" }}
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Citas</span>
          </button>
        )}
      </div>
    </div>
  </div>
  );
}
