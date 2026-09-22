"use client";

import { useState, useEffect } from "react";
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
  toggleCouponStatusAction
} from "@/lib/actions";
import { 
  WeeklySchedule, 
  BlockedDateItem, 
  parseWeeklySchedule, 
  parseBlockedDates, 
  DAY_LABELS, 
  DEFAULT_WEEKLY_SCHEDULE 
} from "@/lib/schedule";
import { sanitizeMapEmbedUrl } from "@/lib/map-utils";
import { 
  Store, 
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
  Square
} from "lucide-react";
import * as XLSX from "xlsx";

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
};

type Category = {
  id: string;
  name: string;
  order: number;
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
  total: number;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  plan?: "FREE" | "PRO";
  logoUrl: string | null;
  coverUrl: string | null;
  paymentQrUrl: string | null;
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
};

export const DIETARY_PREFERENCES_LIST = [
  { id: "VEGAN", label: "Vegano", emoji: "🌱", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  { id: "VEGETARIAN", label: "Vegetariano", emoji: "🥗", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  { id: "GLUTEN_FREE", label: "Sin Gluten / Celíaco", emoji: "🌾", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  { id: "LACTOSE_FREE", label: "Sin Lactosa", emoji: "🥛", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { id: "KETO", label: "Keto / Low Carb", emoji: "🥑", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  { id: "HALAL", label: "Halal", emoji: "🍖", color: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
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
  visitStats
}: { 
  restaurant: Restaurant; 
  subscriptionPaymentDetails?: SubscriptionPaymentDetails;
  visitStats?: VisitStats;
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"metrics" | "restaurant" | "categories" | "dishes" | "seasons" | "coupons" | "qr" | "orders" | "split-bill" | "crm" | "subscription">("metrics");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<15 | 20>(15);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO">(restaurant.plan || "FREE");
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
      notes: selectedPlanPrice === 20 
        ? "Plan Puesta en Marcha Inmediata ($20.00 USD) - Carga y digitalización asistida" 
        : "Plan Digital Pro ($15.00 USD) - Autogestión",
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
  const [tablesConfig, setTablesConfig] = useState(restaurant.tablesConfig || "1,2,3,4,5,6,7,8,9,10");
  const [savingTables, setSavingTables] = useState(false);
  const [tablesMessage, setTablesMessage] = useState("");

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

    const serializedNotes = formatCustomerMetadata({
      dietary: custDietary,
      allergies: custAllergies.trim(),
      birthDate: custBirthDate,
      points: Number(custPoints) || 0,
      favoriteDish: custFavoriteDish.trim(),
      customNotes: custCustomNotes.trim(),
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
      Disponible: string;
      URL_Imagen: string;
    }> = [];

    const cats = categoriesList && categoriesList.length > 0 ? categoriesList : (restaurant.categories || []);

    cats.forEach((cat) => {
      (cat.dishes || []).forEach((dish) => {
        allDishes.push({
          Categoria: cat.name,
          Nombre: dish.name,
          Descripcion: dish.description || "",
          Precio: typeof dish.price === "number" ? dish.price : parseFloat((dish.price as any) || "0"),
          Disponible: dish.isAvailable ? "SI" : "NO",
          URL_Imagen: dish.imageUrl || "",
        });
      });
    });

    if (allDishes.length === 0) {
      alert("No hay platos registrados en el menú para exportar.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(allDishes);

    worksheet["!cols"] = [
      { wch: 22 }, // Categoria
      { wch: 32 }, // Nombre
      { wch: 48 }, // Descripcion
      { wch: 12 }, // Precio
      { wch: 14 }, // Disponible
      { wch: 38 }, // URL_Imagen
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Platos");

    const fileName = `platos_${restaurant.slug}_${new Date().toISOString().split("T")[0]}.xlsx`;
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
  const [logoHasError, setLogoHasError] = useState(false);
  const [coverHasError, setCoverHasError] = useState(false);
  const [paymentQrHasError, setPaymentQrHasError] = useState(false);
  const [dishImageHasError, setDishImageHasError] = useState(false);

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
      const src = item.imageUrl as string;
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

  const handleToggleDish = async (dishId: string, currentStatus: boolean) => {
    const res = await toggleDishAvailabilityAction(dishId, !currentStatus);
    if (res && 'error' in res && res.error) {
      alert(res.error);
    } else {
      window.location.reload();
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const res = await updateOrderStatusAction(orderId, newStatus);
    if (res.error) {
      alert(res.error);
    } else {
      window.location.reload();
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
              {restaurant.logoUrl ? (
                <img src={restaurant.logoUrl} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover border border-slate-700" />
              ) : (
                <div className="h-10 w-10 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center font-bold text-white">
                  {restaurant.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white line-clamp-1">{restaurant.name}</h1>
                <p className="text-xs text-slate-400">Panel Admin</p>
              </div>
            </div>

            {/* Mobile compact header actions */}
            <div className="flex items-center gap-2 md:hidden">
              <a
                href={`/${restaurant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-all"
                title="Ver Menú Público"
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
              Restaurante
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
              Categorías
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
              Platos
            </button>
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
            href={`/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-all"
          >
            Ver Menú Público
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

      {/* Main Layout Container (Content + Persistent Sidebar) */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 overflow-y-auto lg:overflow-visible pb-28 md:pb-0">
        {/* Main Content Area */}
        <main className="flex-1 p-6 pb-28 md:p-10 max-w-4xl overflow-y-auto space-y-6">
        {/* Subscription / Plan Banner */}
        {(() => {
          const trialEnds = currentTrialEndsAt;
          const now = new Date();
          const isExpired = trialEnds < now;
          const daysRemaining = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const isPro = currentPlan === "PRO";
          const isProActive = isPro && !isExpired;

          return (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm ${
              isProActive
                ? "bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/30 text-emerald-300"
                : isExpired 
                  ? "bg-red-500/10 border-red-500/30 text-red-400" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  isProActive ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                }`}>
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {isProActive ? "Plan Premium Activo ($15 USD/mes)" : isExpired ? "Suscripción Vencida" : "Prueba Gratuita (30 Días)"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-950/60 border border-current">
                      {isProActive ? "PRO" : isPro ? "VENCIDO" : `${daysRemaining}d restantes`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isProActive
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
                {isProActive ? "Renovar ($15/mes)" : "Activar Plan ($15/mes)"}
              </button>
            </div>
          );
        })()}

        {/* Métricas y Pedidos Tab */}
        {activeTab === "metrics" && (() => {
          const orders = restaurant.orders || [];
          const nonCancelled = orders.filter(o => o.status !== "CANCELLED");
          
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

          const pendingOrders = orders.filter(o => o.status === "PENDING" || o.status === "PREPARING");

          return (
            <div className="space-y-8 animate-fade-in" style={{ fontFamily: 'var(--font-outfit)' }}>
              {/* Metrics Header */}
              <div>
                <h2 className="text-2xl font-bold text-white">Dashboard de Métricas</h2>
                <p className="text-slate-400 text-sm">Resumen de facturación, visitas al negocio, platos estrella y mesas de mayor consumo.</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Facturación Diaria</span>
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
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tráfico de clientes que consultan la carta digital y escanean el código QR.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 shrink-0">
                    <span className="text-xs text-slate-400 uppercase font-bold">Total Histórico:</span>
                    <span className="text-lg font-black text-cyan-400">
                      {(visitStats?.total || 0).toLocaleString()}
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
                    <p className="text-2xl font-black text-white mt-1.5">{(visitStats?.today || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Visitantes hoy en el menú</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Visitas Semanales</span>
                      <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <Globe className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white mt-1.5">{(visitStats?.week || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Últimos 7 días</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Visitas Mensuales</span>
                      <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white mt-1.5">{(visitStats?.month || 0).toLocaleString()}</p>
                    <span className="text-[10px] text-slate-500 block mt-1">Últimos 30 días</span>
                  </div>
                </div>

                {/* Conversion Insight if data available */}
                {(visitStats?.today || 0) > 0 && todayOrders.length > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300">
                    <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Tasa de conversión de hoy:</strong> {(((todayOrders.length) / (visitStats?.today || 1)) * 100).toFixed(1)}% de las visitas de hoy se convirtieron en pedidos ({todayOrders.length} pedidos / {visitStats?.today} visitas).
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
                    <span className="text-[10px] uppercase tracking-wider text-slate-455 font-extrabold block">Plato Más Vendido</span>
                    <span className="text-sm font-bold text-white">{topDishName}</span>
                    {topDishQty > 0 && <span className="text-[10px] text-slate-500 block mt-0.5">{topDishQty} unidades vendidas</span>}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
                  <div className="h-10 w-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-455 font-extrabold block">Mesa que Más Vende</span>
                    <span className="text-sm font-bold text-white">
                      {topTableName !== "Ninguna" && topTableName !== "Llevar" && topTableName !== "Domicilio" 
                        ? `Mesa #${topTableName}` 
                        : topTableName === "Llevar" 
                          ? "Para llevar" 
                          : topTableName === "Domicilio" 
                            ? "Domicilio" 
                            : "Ninguna"}
                    </span>
                    {topTableTotal > 0 && <span className="text-[10px] text-slate-500 block mt-0.5">${topTableTotal.toFixed(2)} facturados</span>}
                  </div>
                </div>
              </div>

              {/* SEO & GEO Health Score Checklist */}
              {(() => {
                const checks = [
                  { label: "Slug amigable configurado", ok: !!restaurant.slug },
                  { label: "Nombre de restaurante", ok: !!restaurant.name },
                  { label: "Descripción / Sobre Nosotros", ok: !!restaurant.description },
                  { label: "Logo del negocio", ok: !!restaurant.logoUrl },
                  { label: "Imagen de portada (Cover)", ok: !!restaurant.coverUrl },
                  { label: "Dirección física exacta", ok: !!restaurant.address },
                  { label: "Ciudad / Cantón / Localidad", ok: !!(restaurant.city || restaurant.locality) },
                  { label: "Provincia registrada", ok: !!restaurant.province },
                  { label: "Número de WhatsApp para pedidos", ok: !!restaurant.whatsapp },
                  { label: "Horario de atención", ok: !!restaurant.schedule },
                  { label: "Categorías en carta", ok: (restaurant.categories || []).length > 0 },
                  { label: "Platos agregados al menú", ok: (restaurant.categories || []).some((c: any) => (c.dishes || []).length > 0) },
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

              {/* Table Management Form */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-red-500" />
                    Configuración de Mesas del Local
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Define las mesas disponibles de tu local separadas por comas (ej. 1, 2, VIP-1, Terraza-A).</p>
                </div>
                <form onSubmit={handleSaveTables} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={tablesConfig}
                      onChange={(e) => setTablesConfig(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-sm"
                      placeholder="ej. 1, 2, 3, VIP-1, Terraza-A"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingTables}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg transition-transform active:scale-95 duration-200 shrink-0 bg-red-600 hover:bg-red-500"
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
            </div>
          );
        })()}

        {/* Restaurante Tab */}
        {activeTab === "restaurant" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Configuración del Restaurante</h2>
              <p className="text-slate-400 text-sm">Edita la información de tu marca, colores del tema, recargos y WhatsApp para pedidos.</p>
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
                        onChange={(e) => setDeliveryEnabled(e.target.checked)}
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
                  <button
                    type="submit"
                    disabled={savingCharges}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-lg transition-transform active:scale-95 duration-200 bg-red-600 hover:bg-red-500"
                  >
                    {savingCharges ? "Guardando..." : "Guardar Recargos"}
                  </button>
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
                await updateRestaurantAction(restaurant.id, formData);
                alert("Restaurante actualizado correctamente.");
              }}
              encType="multipart/form-data"
              className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-6 backdrop-blur-md"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Restaurante</label>
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
                    <span>🖼️ URL del Logo</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP, 500–800 px de ancho.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">URL Directa del Logo (HTTPS)</label>
                    <input
                      type="text"
                      name="logoUrl"
                      value={logoUrlInput}
                      onChange={(e) => {
                        setLogoUrlInput(e.target.value);
                        setLogoHasError(false);
                      }}
                      placeholder="https://i.postimg.cc/xxxxx/logo.webp"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Pega la URL pública HTTPS de tu logo optimizado (ej. Postimages, Cloudinary, S3).
                    </p>
                    <input
                      type="file"
                      name="logoFile"
                      accept="image/*"
                      className="hidden"
                    />
                    <input
                      type="file"
                      name="logoFileCamera"
                      accept="image/*"
                      className="hidden"
                    />
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
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar la imagen.</p>
                            <p className="text-[10px] text-slate-400">Verifica que la URL sea directa y pública.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin URL de logo</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cover Banner Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🌄 URL de Portada (Banner)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP, 1600–2000 px de ancho.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">URL Directa de Portada (HTTPS)</label>
                    <input
                      type="text"
                      name="coverUrl"
                      value={coverUrlInput}
                      onChange={(e) => {
                        setCoverUrlInput(e.target.value);
                        setCoverHasError(false);
                      }}
                      placeholder="https://i.postimg.cc/xxxxx/portada.webp"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Pega la URL pública HTTPS del banner de tu restaurante.
                    </p>
                    <input
                      type="file"
                      name="coverFile"
                      accept="image/*"
                      className="hidden"
                    />
                    <input
                      type="file"
                      name="coverFileCamera"
                      accept="image/*"
                      className="hidden"
                    />
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
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar la portada.</p>
                            <p className="text-[10px] text-slate-400">Verifica que la URL sea directa y pública.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin URL de portada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment QR Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📱 URL de QR de Cobro (Deuna / Transferencia)</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    ✨ Recomendado: WebP, formato cuadrado.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">URL Directa del Código QR (HTTPS)</label>
                    <input
                      type="text"
                      name="paymentQrUrl"
                      value={paymentQrUrlInput}
                      onChange={(e) => {
                        setPaymentQrUrlInput(e.target.value);
                        setPaymentQrHasError(false);
                      }}
                      placeholder="https://i.postimg.cc/xxxxx/qr.webp"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 block px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Pega la URL de tu código QR de cobranza digital o cuenta de transferencias.
                    </p>
                    <input
                      type="file"
                      name="paymentQrFile"
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Vista Previa</label>
                    <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
                      {paymentQrUrlInput && paymentQrUrlInput.trim() !== "" ? (
                        !paymentQrHasError ? (
                          <img
                            src={paymentQrUrlInput.trim()}
                            alt="Vista previa QR"
                            onError={() => setPaymentQrHasError(true)}
                            className="max-h-full max-w-full object-contain rounded-lg shadow"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-[11px] text-red-400 font-semibold">⚠️ No se pudo cargar el QR.</p>
                            <p className="text-[10px] text-slate-400">Verifica que la URL sea directa y pública.</p>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin URL de QR</span>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Cantidad Platos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {categoriesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{(cat.dishes || []).length} platos</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setNewCatName(cat.name);
                              setNewCatOrder(cat.order.toString());
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
                        placeholder="ej: Pizzas, Pastas, Postres"
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
                <h2 className="text-2xl font-bold text-white">Platos del Menú</h2>
                <p className="text-slate-400 text-sm">Gestiona la carta completa: precios, imágenes y disponibilidad.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportDishesExcel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-all duration-200 shadow-sm"
                  title="Descargar todos los platos con sus categorías, precios y fotos en formato Excel (.xlsx)"
                >
                  <Download className="h-4 w-4" />
                  Descargar Platos (Excel)
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchDishModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all duration-200 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Subida por Lotes (Excel / CSV)
                </button>
                <button
                  disabled={categoriesList.length === 0}
                  onClick={() => {
                    setEditingDish(null);
                    setDishName("");
                    setDishDescription("");
                    setDishPrice("0");
                    setDishImageUrl("");
                    setDishAvailable(true);
                    setDishCatId(categoriesList[0]?.id || "");
                    setIsDishModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Plato
                </button>
              </div>
            </div>

            {categoriesList.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                Debes crear al menos una categoría antes de agregar platos.
              </div>
            ) : (
              <div className="space-y-8">
                {categoriesList.map((cat) => (
                  <div key={cat.id} className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="text-red-500">#</span> {cat.name}
                    </h3>
                    
                    {cat.dishes.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">No hay platos en esta categoría.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.dishes.map((dish) => (
                          <div 
                            key={dish.id} 
                            className={`bg-slate-900/40 border rounded-2xl p-4 flex gap-4 transition-all ${
                              dish.isAvailable ? "border-slate-800/80" : "border-slate-900 opacity-60"
                            }`}
                          >
                            {/* Image */}
                            <div className="h-20 w-20 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-slate-800 relative">
                              {dish.imageUrl ? (
                                <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-xs text-slate-600">Sin foto</div>
                              )}
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

                              <div className="flex justify-between items-center pt-2">
                                {/* Availability toggle */}
                                <button
                                  onClick={() => handleToggleDish(dish.id, dish.isAvailable)}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
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

                                {/* Edit / Delete Actions */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingDish(dish);
                                      setDishName(dish.name);
                                      setDishDescription(dish.description || "");
                                      setDishPrice(dish.price.toString());
                                      setDishImageUrl(dish.imageUrl || "");
                                      setDishAvailable(dish.isAvailable);
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
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dish Add/Edit Modal */}
            {isDishModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-y-auto max-h-[90vh]">
                  <h3 className="text-lg font-bold text-white mb-4">
                    {editingDish ? "Editar Plato" : "Nuevo Plato"}
                  </h3>
                  <form
                    action={async (formData) => {
                      // Append explicitly isAvailable since toggle has client state
                      formData.append("isAvailable", dishAvailable.toString());
                      
                      if (editingDish) {
                        const res = await updateDishAction(editingDish.id, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        alert("¡Plato guardado con éxito!");
                      } else {
                        const res = await createDishAction(dishCatId, formData);
                        if (res && 'error' in res && res.error) {
                          alert(res.error);
                          return;
                        }
                        alert("¡Plato creado con éxito!");
                      }
                      setIsDishModalOpen(false);
                      window.location.reload();
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Plato</label>
                        <input
                          type="text"
                          name="name"
                          value={dishName}
                          onChange={(e) => setDishName(e.target.value)}
                          required
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
                        <select
                          name="categoryId"
                          value={dishCatId}
                          onChange={(e) => setDishCatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        >
                          {restaurant.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Precio ($)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">$</span>
                          <input
                            type="number"
                            name="price"
                            step="0.01"
                            value={dishPrice}
                            onChange={(e) => setDishPrice(e.target.value)}
                            required
                            className="w-full bg-slate-950 border border-slate-850 block pl-8 pr-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                      <textarea
                        name="description"
                        rows={2}
                        value={dishDescription}
                        onChange={(e) => setDishDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 block px-4 py-2.5 rounded-xl text-white focus:border-red-500 focus:outline-none"
                        placeholder="ej: Mozzarella, albahaca y orégano..."
                      />
                    </div>

                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-semibold text-slate-300">URL DE IMAGEN DEL PLATO (HTTPS)</label>
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          ✨ WebP · máx 1200 px · 100–300 KB
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <div className="sm:col-span-2 space-y-1.5">
                          <input
                            type="text"
                            name="imageUrl"
                            value={dishImageUrl}
                            onChange={(e) => {
                              setDishImageUrl(e.target.value);
                              setDishImageHasError(false);
                            }}
                            placeholder="https://i.postimg.cc/xxxxx/plato.webp"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-400">
                            Pega la URL pública de la imagen del plato.
                          </p>
                          <input
                            type="file"
                            name="dishFile"
                            accept="image/*"
                            className="hidden"
                          />
                        </div>
                        <div>
                          <div className="h-20 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center p-1.5 overflow-hidden">
                            {dishImageUrl && dishImageUrl.trim() !== "" ? (
                              !dishImageHasError ? (
                                <img
                                  src={dishImageUrl.trim()}
                                  alt="Vista previa plato"
                                  onError={() => setDishImageHasError(true)}
                                  className="w-full h-full object-cover rounded-lg shadow"
                                />
                              ) : (
                                <div className="text-center p-1">
                                  <p className="text-[10px] text-red-400 font-semibold">⚠️ No se pudo cargar</p>
                                  <p className="text-[9px] text-slate-400">Verifica la URL</p>
                                </div>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Sin imagen</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center">
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

                    <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-800">
                      {editingDish && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`¿Estás seguro de eliminar el plato "${editingDish.name}"?`)) {
                              const res = await deleteDishAction(editingDish.id);
                              if (res && 'error' in res && res.error) {
                                alert(res.error);
                              } else {
                                setIsDishModalOpen(false);
                                alert(`¡Plato "${editingDish.name}" eliminado con éxito!`);
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
                          {editingDish ? "Guardar Cambios" : "Crear Plato"}
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

        {/* Código QR Tab */}
        {activeTab === "qr" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Generador de Código QR</h2>
              <p className="text-slate-400 text-sm">Descarga e imprime este código QR para colocar en las mesas. Al escanearlo, tus clientes verán el menú digital.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
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
                      <th className="pb-3 pt-1 pl-2">Pedido / Mesa</th>
                      <th className="pb-3 pt-1">Cliente & Dirección</th>
                      <th className="pb-3 pt-1">Pago</th>
                      <th className="pb-3 pt-1">Fecha / Hora</th>
                      <th className="pb-3 pt-1">Estado de Pedido</th>
                      <th className="pb-3 pt-1 text-right pr-2">Acciones / Total</th>
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
                        <tr key={order.id} className="text-slate-300 hover:bg-slate-800/20 transition-all">
                          <td className="py-3.5 pl-2 font-semibold">
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold block w-fit">
                                #{order.orderNumber || order.id.substring(0, 6)}
                              </span>
                              <span className="font-extrabold text-white block">
                                {order.tableName === "Llevar" 
                                  ? "🛍 Para Llevar" 
                                  : order.tableName === "Domicilio" 
                                    ? "🛵 Domicilio" 
                                    : `🪑 Mesa #${order.tableName}`}
                              </span>
                              {order.customerName && order.tableName !== "Llevar" && order.tableName !== "Domicilio" && (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                                  👤 Comensal: {order.customerName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5">
                            {order.customerName ? (
                              <div className="space-y-0.5 max-w-[220px]">
                                <p className="font-bold text-white">
                                  {order.customerName}
                                  {order.tableName !== "Llevar" && order.tableName !== "Domicilio" && (
                                    <span className="text-[10px] text-amber-400 font-normal ml-1.5">(Comensal)</span>
                                  )}
                                </p>
                                {order.customerPhone && (
                                  <a 
                                    href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-red-400 hover:underline text-[10px] block"
                                  >
                                    📱 {order.customerPhone}
                                  </a>
                                )}
                                {order.customerAddress && (
                                  <p className="text-slate-400 text-[10px] truncate" title={order.customerAddress}>
                                    📍 {order.customerAddress}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 uppercase font-medium text-[10px]">
                            {order.paymentMethod === "qr" ? "QR de Cobro" : "Efectivo / Local"}
                          </td>
                          <td className="py-3.5 text-slate-400">
                            {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5">
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
                              <option value="PENDING" className="bg-slate-900 text-yellow-300">⏳ Pendiente</option>
                              <option value="PREPARING" className="bg-slate-900 text-blue-300">🍳 En Cocina</option>
                              <option value="IN_TRANSIT" className="bg-slate-900 text-amber-300">🛵 En Transporte</option>
                              <option value="DELIVERED" className="bg-slate-900 text-emerald-300">✅ Entregado</option>
                              <option value="CANCELLED" className="bg-slate-900 text-red-300">❌ Cancelado</option>
                            </select>
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <div className="space-y-1">
                              <span className="font-extrabold text-white text-sm block">
                                ${order.total.toFixed(2)}
                              </span>
                              <a
                                href={`/${restaurant.slug}/rastreo?order=${order.orderNumber || order.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold"
                              >
                                <span>Ver Rastreo</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>
                        </tr>
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
          </div>
        )}

        {/* Dividir Cuenta Tab */}
        {activeTab === "split-bill" && (
          <TableSplitMonitor restaurantId={restaurant.id} tablesConfig={restaurant.tablesConfig} />
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
                    <p className="text-2xl font-black text-emerald-400 mt-1">{totalPointsSum.toLocaleString()} pts</p>
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
            </div>

            {/* Customer List Table */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-950/60">
                      <th className="pb-3 pt-4 pl-4">Cliente & Contacto</th>
                      <th className="pb-3 pt-4">Categoría</th>
                      <th className="pb-3 pt-4">Preferencias & Alergias</th>
                      <th className="pb-3 pt-4">Plato Favorito & Visitas</th>
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
                            </td>

                            <td className="py-3.5">
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
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-400" />
                      {editingCustomer ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
                    </h3>
                    <button
                      onClick={() => setIsCustomerModalOpen(false)}
                      className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                    >
                      Cerrar
                    </button>
                  </div>

                  <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
                    {/* Basic Info */}
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

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
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
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold hover:from-red-500 hover:to-amber-500 transition shadow-lg disabled:opacity-50"
                      >
                        {savingCustomer ? "Guardando..." : editingCustomer ? "Guardar Cambios" : "Crear Cliente"}
                      </button>
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
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Visitas / Pedidos</span>
                        <p className="text-xl font-black text-white mt-1">{cust.totalOrders}</p>
                        <span className="text-[10px] text-slate-500">Historial total</span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Gasto Acumulado</span>
                        <p className="text-xl font-black text-emerald-400 mt-1">${cust.totalSpent.toFixed(2)}</p>
                        <span className="text-[10px] text-slate-500">Total facturado</span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket Promedio</span>
                        <p className="text-xl font-black text-cyan-400 mt-1">${insights.avgTicket.toFixed(2)}</p>
                        <span className="text-[10px] text-slate-500">Por visita/pedido</span>
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

                    {/* Preferencias & Alergias & Cumpleaños Box */}
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
                        Historial de Pedidos ({insights.matchingOrders.length})
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
                    <span className={`h-3 w-3 rounded-full ${currentPlan === "PRO" && currentTrialEndsAt > new Date() ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span className="font-bold text-white text-base">
                      {currentPlan === "PRO" && currentTrialEndsAt > new Date() ? "Plan Premium Activo" : currentPlan === "PRO" ? "Suscripción Vencida" : "Prueba Gratuita"}
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
                        <span>Gestión de platos, combos e impuestos</span>
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

                {/* Plan 2: Plan Puesta en Marcha Inmediata ($20/mes) */}
                <div className="bg-gradient-to-b from-amber-500/10 to-slate-950 border-2 border-amber-500/50 p-6 rounded-2xl space-y-5 flex flex-col justify-between relative overflow-hidden">
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                          ⭐ Puesta en Marcha
                        </span>
                        <h3 className="text-lg font-black text-white mt-1.5 flex items-center gap-1.5">
                          Puesta en Marcha Inmediata
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-white">$20</span>
                        <span className="text-xs text-amber-400">/mes</span>
                      </div>
                    </div>
                    <p className="text-amber-200/90 text-xs font-medium">
                      🚀 <strong>Nosotros subimos y cargamos todo tu menú por ti.</strong> Listo en menos de 24 horas.
                    </p>
                    <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-100 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Carga completa de platos, fotos y categorías</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Optimización visual de fotos y descripciones</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Diseño de códigos QR listos para imprimir</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Asesoría personalizada por WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanPrice(20);
                      setShowPaymentModal(true);
                    }}
                    className="w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 relative z-10"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pagar Puesta en Marcha ($20/mes)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Column: Persistent Pedidos en Curso */}
      <aside className="w-full lg:w-96 bg-slate-900/30 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 pb-28 lg:pb-6 space-y-6 shrink-0 lg:max-h-screen lg:overflow-y-auto lg:sticky lg:top-0" style={{ fontFamily: 'var(--font-outfit)' }}>
        {(() => {
          const orders = restaurant.orders || [];
          const pendingOrders = orders.filter(o => o.status === "PENDING" || o.status === "PREPARING");

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-red-500" />
                  Pedidos en Curso ({pendingOrders.length})
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full">
                  Cocina
                </span>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm italic border border-slate-800/60 rounded-2xl bg-slate-950/30">
                  No hay pedidos activos.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.map((order) => (
                    <div 
                      key={order.id} 
                      className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-slate-300 uppercase bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                                {order.tableName === "Llevar" 
                                  ? "🛍️ Llevar" 
                                  : order.tableName === "Domicilio" 
                                    ? "🛵 Domicilio" 
                                    : `🪑 Mesa #${order.tableName}`}
                              </span>
                              {order.customerName && order.tableName !== "Llevar" && order.tableName !== "Domicilio" && (
                                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  👤 {order.customerName}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-500">{isMounted ? new Date(order.createdAt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                          }`}>
                            {order.status === "PENDING" ? "Pendiente" : "En Cocina"}
                          </span>
                        </div>

                        {/* Customer info */}
                        {(order.customerName || order.customerPhone) && (
                          <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl space-y-1 border border-slate-800/40">
                            {order.customerName && (
                              <p>
                                <strong className="text-slate-300">
                                  {order.tableName !== "Llevar" && order.tableName !== "Domicilio" ? "Comensal:" : "Cliente:"}
                                </strong>{" "}
                                <span className="text-white font-bold">{order.customerName}</span>
                              </p>
                            )}
                            {order.customerPhone && (
                              <p>
                                <strong>WhatsApp:</strong>{" "}
                                <a 
                                  href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-red-400 hover:underline"
                                >
                                  {order.customerPhone}
                                </a>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Items List */}
                        <div className="border-t border-b border-slate-900 py-2 space-y-1 max-h-36 overflow-y-auto">
                          {order.items.map((it) => (
                            <div key={it.id} className="flex justify-between text-xs text-slate-350">
                              <span>{it.quantity}x {it.dishName}</span>
                              <span className="text-slate-450">${(it.price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Totals */}
                        <div className="flex justify-between text-xs font-bold text-slate-350">
                          <span>Total:</span>
                          <span className="text-white font-extrabold">${order.total.toFixed(2)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {order.status === "PENDING" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase text-slate-950 bg-yellow-500 hover:bg-yellow-400 transition"
                            >
                              Preparar
                            </button>
                          )}
                          {order.status === "PREPARING" && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase text-white bg-green-600 hover:bg-green-500 transition"
                            >
                              Entregar
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                            className="px-2.5 py-2 rounded-xl text-[10px] font-black uppercase text-red-400 bg-red-950/20 border border-red-900/30 hover:bg-red-900/25 transition shrink-0"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </aside>

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
                      ? "border-amber-400 bg-amber-500/10 text-white" 
                      : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Autogestión</span>
                  <span className="font-extrabold text-sm block mt-0.5">Plan Pro</span>
                  <span className="text-amber-400 font-bold text-xs">$15.00 USD/mes</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-400">⭐ Con Asistencia</span>
                  <span className="font-extrabold text-sm block mt-0.5">Puesta en Marcha</span>
                  <span className="text-amber-400 font-bold text-xs">$20.00 USD/mes</span>
                </button>
              </div>
            </div>

            {/* Price summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Concepto:</span>
                <span className="font-bold text-white">
                  {selectedPlanPrice === 20 ? "Plan Puesta en Marcha Inmediata" : "Plan Digital Pro"}
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
          <span className="text-[9px] font-bold uppercase tracking-wider">Negocio</span>
        </button>

        {/* Categories Tab */}
        <button
          onClick={() => setActiveTab("categories")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "categories" ? restaurant.themeColor : "#94a3b8" }}
        >
          <FolderHeart className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Categorías</span>
        </button>

        {/* Dishes Tab */}
        <button
          onClick={() => setActiveTab("dishes")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "dishes" ? restaurant.themeColor : "#94a3b8" }}
        >
          <Soup className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Platos</span>
        </button>

        {/* QR Tab */}
        <button
          onClick={() => setActiveTab("qr")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "qr" ? restaurant.themeColor : "#94a3b8" }}
        >
          <QrCode className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">QR</span>
        </button>

        {/* Orders Tab */}
        <button
          onClick={() => setActiveTab("orders")}
          className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition duration-200"
          style={{ color: activeTab === "orders" ? restaurant.themeColor : "#94a3b8" }}
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Historial</span>
        </button>
      </div>
    </div>
  </div>
  );
}
