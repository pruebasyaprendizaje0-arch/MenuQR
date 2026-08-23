"use client";

import { useState, useEffect } from "react";
import { 
  logoutUserAction, 
  updateRestaurantAction, 
  createCategoryAction, 
  updateCategoryAction, 
  deleteCategoryAction,
  createDishAction,
  updateDishAction,
  deleteDishAction,
  toggleDishAvailabilityAction,
  updateOrderStatusAction,
  updateRestaurantTablesAction,
  updateRestaurantChargesConfigAction,
  subscribeToPremiumAction
} from "@/lib/actions";
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
  Upload,
  CreditCard,
  Crown,
  Sparkles
} from "lucide-react";
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
  restaurantId: string;
  tableName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  status: "PENDING" | "PREPARING" | "COMPLETED" | "CANCELLED";
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
  description: string | null;
  locality: string | null;
  schedule: string | null;
  specialty: string | null;
  services: string | null;
  contactNumbers: string | null;
  ubicameUrl: string | null;
  tablesConfig: string;
  ivaPercent: number;
  servicePercent: number;
  deliveryCost: number;
  deliveryEnabled: boolean;
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
  categories: Category[];
  orders: Order[];
};

export function AdminDashboard({ restaurant }: { restaurant: Restaurant }) {
  const [activeTab, setActiveTab] = useState<"metrics" | "restaurant" | "categories" | "dishes" | "qr" | "orders" | "subscription">("metrics");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO">(restaurant.plan || "FREE");
  const [currentTrialEndsAt, setCurrentTrialEndsAt] = useState<Date>(
    restaurant.trialEndsAt ? new Date(restaurant.trialEndsAt) : new Date()
  );
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardDocId, setCardDocId] = useState("");

  const handleSubscribePremium = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardHolderName.trim()) {
      alert("Por favor ingrese el Nombre del Titular impreso en la tarjeta.");
      return;
    }
    if (cardNumber.replace(/\s/g, "").length < 15) {
      alert("Por favor ingrese un Número de Tarjeta válido (16 dígitos).");
      return;
    }
    if (!cardExpiry.trim()) {
      alert("Por favor ingrese la Fecha de Expiración (MM/AA).");
      return;
    }
    if (!cardCvc.trim() || cardCvc.length < 3) {
      alert("Por favor ingrese el Código de Seguridad (CVC / CVV).");
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentSuccessMsg("");

    const res = await subscribeToPremiumAction(restaurant.id, {
      cardHolderName,
      cardNumberLast4: cardNumber.replace(/\s/g, "").slice(-4),
      cardDocId,
    });

    setIsSubmittingPayment(false);
    if (res.error) {
      alert(res.error);
    } else {
      setPaymentSuccessMsg(res.message || "¡Pago procesado con éxito! Suscripción al Plan Premium activada.");
      setCurrentPlan("PRO");
      if (res.trialEndsAt) {
        setCurrentTrialEndsAt(new Date(res.trialEndsAt));
      }
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentSuccessMsg("");
        setCardHolderName("");
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setCardDocId("");
      }, 3000);
    }
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
  const [savingCharges, setSavingCharges] = useState(false);
  const [chargesMessage, setChargesMessage] = useState("");

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

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
          let startX = (400 - totalWidth) / 2;
          
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
  
  // States for Category Dialogs
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOrder, setNewCatOrder] = useState("0");

  // States for Dish Dialogs
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("0");
  const [dishCatId, setDishCatId] = useState("");
  const [dishAvailable, setDishAvailable] = useState(true);
  const [dishImageUrl, setDishImageUrl] = useState("");

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : `/${restaurant.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleDish = async (dishId: string, currentStatus: boolean) => {
    await toggleDishAvailabilityAction(dishId, !currentStatus);
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
      ivaOnTable,
      ivaOnTakeout,
      serviceOnTable,
      serviceOnTakeout,
    });
    setSavingCharges(false);
    if (res.error) {
      setChargesMessage(`Error: ${res.error}`);
    } else {
      setChargesMessage("Configuración de recargos guardada correctamente.");
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
                $5/mes
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

          return (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm ${
              isPro
                ? "bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/30 text-emerald-300"
                : isExpired 
                  ? "bg-red-500/10 border-red-500/30 text-red-400" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  isPro ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                }`}>
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {isPro ? "Plan Premium Activo ($5 USD/mes)" : isExpired ? "Suscripción Inactiva" : "Prueba Gratuita (30 Días)"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-950/60 border border-current">
                      {isPro ? "PRO" : `${daysRemaining}d restantes`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isPro 
                      ? `Próxima renovación: ${trialEnds.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : isExpired 
                        ? "Tu prueba ha finalizado. Activa el Plan Premium por solo $5 USD/mes para continuar." 
                        : `Vence el ${trialEnds.toLocaleDateString()}. Suscríbete al Plan Premium por $5 USD/mes.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/10 transition-all shrink-0 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {isPro ? "Renovar ($5/mes)" : "Activar Premium ($5/mes)"}
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
                <p className="text-slate-400 text-sm">Resumen de facturación, platos estrella y mesas de mayor consumo.</p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-455 font-extrabold">Facturación Diaria</span>
                  <p className="text-2xl font-black text-white mt-1">${todayBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">{todayOrders.length} pedidos hoy</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-455 font-extrabold">Facturación Semanal</span>
                  <p className="text-2xl font-black text-white mt-1">${weekBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">Últimos 7 días</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-[10px] uppercase tracking-wider text-slate-455 font-extrabold">Facturación Mensual</span>
                  <p className="text-2xl font-black text-white mt-1">${monthBilling.toFixed(2)}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">Últimos 30 días</span>
                </div>
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

              {/* Charge Surcharge Configuration Form */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
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
                      <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={ivaOnTable}
                          onChange={(e) => setIvaOnTable(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        Aplica IVA en pedidos en Mesa
                      </label>
                      <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={ivaOnTakeout}
                          onChange={(e) => setIvaOnTakeout(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        Aplica IVA en pedidos Para Llevar
                      </label>
                      <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={serviceOnTable}
                          onChange={(e) => setServiceOnTable(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        Aplica Servicio en pedidos en Mesa
                      </label>
                      <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={serviceOnTakeout}
                          onChange={(e) => setServiceOnTakeout(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                        Aplica Servicio en pedidos Para Llevar
                      </label>
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
            </div>
          );
        })()}

        {/* Restaurante Tab */}
        {activeTab === "restaurant" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Configuración del Restaurante</h2>
              <p className="text-slate-400 text-sm">Edita la información de tu marca, colores del tema y WhatsApp para pedidos.</p>
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Porcentaje de IVA (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="ivaPercent"
                    defaultValue={restaurant.ivaPercent}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Configura a 0 si los precios ya incluyen IVA o no aplica.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Porcentaje de Servicio (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="servicePercent"
                    defaultValue={restaurant.servicePercent}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Estándar de restaurante (ej: 10%). Pon 0 para desactivar.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Costo de Envío a Domicilio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="deliveryCost"
                    defaultValue={restaurant.deliveryCost}
                    required
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Costo de envío a domicilio. Pon 0 para desactivar.</p>
                </div>
                <div className="flex flex-col justify-end pb-3">
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="deliveryEnabled"
                      defaultChecked={restaurant.deliveryEnabled}
                      className="h-5 w-5 rounded border-slate-850 bg-slate-950 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-300">Ofrecer Envío a Domicilio</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Negocio / Slogan</label>
                  <textarea
                    name="description"
                    defaultValue={restaurant.description || ""}
                    rows={3}
                    placeholder="ej: Auténtica pizza napolitana al horno de leña, pastas artesanales y el mejor ambiente familiar de Manta."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ubicame.info (URL)</label>
                  <input
                    type="text"
                    name="ubicameUrl"
                    defaultValue={restaurant.ubicameUrl || ""}
                    placeholder="ej: https://ubicame.info/mi-negocio"
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Logo Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-white">Imagen de Logo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-400">Subir Logo (Selecciona una opción)</label>
                    <div className="flex flex-wrap gap-3">
                      {/* Gallery Button */}
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl cursor-pointer font-bold text-xs transition-all border border-white/5 active:scale-95">
                        <Upload className="h-4 w-4 text-amber-500" />
                        Elegir de Galería
                        <input 
                          type="file" 
                          name="logoFile" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setLogoPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                      </label>
                      
                      {/* Camera Button */}
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-xl cursor-pointer font-bold text-xs transition-all shadow-lg active:scale-95">
                        <Camera className="h-4 w-4" />
                        Tomar Foto (Cámara)
                        <input 
                          type="file" 
                          name="logoFileCamera" 
                          accept="image/*" 
                          capture="environment" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setLogoPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                      </label>
                    </div>
                    {(logoPreview || (restaurant.logoUrl && restaurant.logoUrl.trim() !== "")) && (
                      <div className="flex items-center gap-2 mt-2 bg-slate-900/50 p-2.5 rounded-xl border border-white/5 max-w-xs">
                        <img 
                          src={logoPreview || restaurant.logoUrl || ""} 
                          alt="Logo Previsualización" 
                          className="h-10 w-10 rounded-lg object-cover border border-slate-700" 
                        />
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {logoPreview ? "Previsualización local" : "Logo actual cargado"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">O pegar URL de logo existente</label>
                    <input
                      type="text"
                      name="logoUrl"
                      defaultValue={restaurant.logoUrl || ""}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Banner Section */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-white">Fondo de Portada</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-400">Subir Fondo de Portada (Selecciona una opción)</label>
                    <div className="flex flex-wrap gap-3">
                      {/* Gallery Button */}
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-755 text-white rounded-xl cursor-pointer font-bold text-xs transition-all border border-white/5 active:scale-95">
                        <Upload className="h-4 w-4 text-amber-500" />
                        Elegir de Galería
                        <input 
                          type="file" 
                          name="coverFile" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setCoverPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                      </label>
                      
                      {/* Camera Button */}
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-xl cursor-pointer font-bold text-xs transition-all shadow-lg active:scale-95">
                        <Camera className="h-4 w-4" />
                        Tomar Foto (Cámara)
                        <input 
                          type="file" 
                          name="coverFileCamera" 
                          accept="image/*" 
                          capture="environment" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setCoverPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                      </label>
                    </div>
                    {(coverPreview || (restaurant.coverUrl && restaurant.coverUrl.trim() !== "")) && (
                      <div className="flex items-center gap-2 mt-2 bg-slate-900/50 p-2.5 rounded-xl border border-white/5 max-w-xs">
                        <img 
                          src={coverPreview || restaurant.coverUrl || ""} 
                          alt="Portada Previsualización" 
                          className="h-10 w-16 rounded-lg object-cover border border-slate-700" 
                        />
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {coverPreview ? "Previsualización local" : "Portada actual cargada"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">O pegar URL de portada existente</label>
                    <input
                      type="text"
                      name="coverUrl"
                      defaultValue={restaurant.coverUrl || ""}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Payment QR Section */}
              <div className="border-t border-slate-800/80 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">QR de Cobro - Deuna / Transferencia (Subir archivo)</label>
                  <input
                    type="file"
                    name="paymentQrFile"
                    accept="image/*"
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-850 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">O pegar URL de QR de Cobro</label>
                  <input
                    type="text"
                    name="paymentQrUrl"
                    defaultValue={restaurant.paymentQrUrl || ""}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
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
                  setNewCatOrder("0");
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </button>
            </div>

            {/* List of categories */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/60">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Orden</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Cantidad Platos</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {restaurant.categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        No hay categorías creadas aún.
                      </td>
                    </tr>
                  ) : (
                    restaurant.categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{cat.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{cat.order}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{cat.dishes.length} platos</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setNewCatName(cat.name);
                              setNewCatOrder(cat.order.toString());
                              setIsCategoryModalOpen(true);
                            }}
                            className="inline-flex p-2 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <Edit2 className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"? Se borrarán todos sus platos.`)) {
                                await deleteCategoryAction(cat.id);
                                alert(`¡Categoría "${cat.name}" eliminada con éxito!`);
                              }
                            }}
                            className="inline-flex p-2 text-red-500/80 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 rounded-lg border border-red-900/20 transition-all"
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
                        await updateCategoryAction(editingCategory.id, formData);
                        alert("¡Categoría guardada con éxito!");
                      } else {
                        await createCategoryAction(restaurant.id, formData);
                        alert("¡Categoría creada con éxito!");
                      }
                      setIsCategoryModalOpen(false);
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
                              await deleteCategoryAction(editingCategory.id);
                              setIsCategoryModalOpen(false);
                              alert(`¡Categoría "${editingCategory.name}" eliminada con éxito!`);
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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Platos del Menú</h2>
                <p className="text-slate-400 text-sm">Gestiona la carta completa: precios, imágenes y disponibilidad.</p>
              </div>
              <button
                disabled={restaurant.categories.length === 0}
                onClick={() => {
                  setEditingDish(null);
                  setDishName("");
                  setDishDescription("");
                  setDishPrice("0");
                  setDishImageUrl("");
                  setDishAvailable(true);
                  setDishCatId(restaurant.categories[0]?.id || "");
                  setIsDishModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Nuevo Plato
              </button>
            </div>

            {restaurant.categories.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                Debes crear al menos una categoría antes de agregar platos.
              </div>
            ) : (
              <div className="space-y-8">
                {restaurant.categories.map((cat) => (
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
                                        await deleteDishAction(dish.id);
                                        alert(`¡Plato "${dish.name}" eliminado con éxito!`);
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
                        await updateDishAction(editingDish.id, formData);
                        alert("¡Plato guardado con éxito!");
                      } else {
                        await createDishAction(dishCatId, formData);
                        alert("¡Plato creado con éxito!");
                      }
                      setIsDishModalOpen(false);
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

                    <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Imagen de Plato (Subir archivo)</label>
                        <input
                          type="file"
                          name="dishFile"
                          accept="image/*"
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-850 file:text-white hover:file:bg-slate-800 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">O pegar URL de imagen</label>
                        <input
                          type="text"
                          name="imageUrl"
                          value={dishImageUrl}
                          onChange={(e) => setDishImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-slate-950 border border-slate-850 block px-4 py-2 rounded-xl text-white focus:outline-none"
                        />
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
                              await deleteDishAction(editingDish.id);
                              setIsDishModalOpen(false);
                              alert(`¡Plato "${editingDish.name}" eliminado con éxito!`);
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
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Historial de Pedidos</h2>
                <p className="text-slate-400 text-sm">Visualiza el historial completo de pedidos de las últimas 24 horas.</p>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] font-black uppercase text-red-400 tracking-wider">
                Autolimpieza: 24 Horas
              </span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="pb-3 pt-1 pl-2">Pedido / Mesa</th>
                      <th className="pb-3 pt-1">Cliente</th>
                      <th className="pb-3 pt-1">Método de Pago</th>
                      <th className="pb-3 pt-1">Fecha / Hora</th>
                      <th className="pb-3 pt-1">Estado</th>
                      <th className="pb-3 pt-1 text-right pr-2">Total</th>
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
                            {order.tableName === "Llevar" 
                              ? "🛍_ Para Llevar" 
                              : order.tableName === "Domicilio" 
                                ? "🛵 Domicilio" 
                                : `🪑 Mesa #${order.tableName}`}
                          </td>
                          <td className="py-3.5">
                            {order.customerName ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-white">{order.customerName}</p>
                                {order.customerPhone && (
                                  <a 
                                    href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-400 hover:underline text-[10px] block"
                                  >
                                    {order.customerPhone}
                                  </a>
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
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              order.status === "PENDING" 
                                ? "bg-yellow-500/10 text-yellow-500" 
                                : order.status === "PREPARING" 
                                  ? "bg-blue-500/10 text-blue-500" 
                                  : order.status === "COMPLETED" 
                                    ? "bg-green-500/10 text-green-500" 
                                    : "bg-red-500/10 text-red-500"
                            }`}>
                              {order.status === "PENDING" && "Pendiente"}
                              {order.status === "PREPARING" && "En Cocina"}
                              {order.status === "COMPLETED" && "Completado"}
                              {order.status === "CANCELLED" && "Cancelado"}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-extrabold text-white pr-2">
                            ${order.total.toFixed(2)}
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

        {/* Plan & Suscripción Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Crown className="w-64 h-64 text-amber-500" />
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Crown className="w-3.5 h-3.5" /> Suscripción SaaS
                  </div>
                  <h2 className="text-2xl font-extrabold text-white">Único Plan Premium</h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Acceso total a todas las herramientas sin límites ni comisiones por pedido.
                  </p>
                </div>

                <div className="text-right bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="text-3xl font-black text-white">$5.00 <span className="text-xs font-normal text-slate-400">/ mes</span></div>
                  <span className="text-[10px] text-amber-400 font-medium">Facturación mensual en USD</span>
                </div>
              </div>

              {/* Status card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <span className="text-xs text-slate-400 font-medium">Estado del Plan</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${currentPlan === "PRO" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span className="font-bold text-white text-base">
                      {currentPlan === "PRO" ? "Plan Premium Activo" : "Prueba Gratuita"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                  <span className="text-xs text-slate-400 font-medium">Próxima Fecha de Vencimiento / Renovación</span>
                  <div className="font-bold text-slate-200 text-base">
                    {currentTrialEndsAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Benefits list */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Incluido en el Plan Premium ($5/mes):</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Menú Digital QR Ilimitado</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pedidos Automáticos a WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Gestión de Platos y Categorías CRUD</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Configuración de IVA, Servicio y Mesas</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Subdominio / URL Personalizada</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Soporte Técnico Continuo</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  Transacción procesada de forma segura con Pasarela de Pagos API.
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {currentPlan === "PRO" ? "Renovar Suscripción ($5/mes)" : "Activar Plan Premium ($5/mes)"}
                </button>
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
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                              {order.tableName === "Llevar" 
                                ? "🛍️ Llevar" 
                                : order.tableName === "Domicilio" 
                                  ? "🛵 Domicilio" 
                                  : `🪑 Mesa #${order.tableName}`}
                            </span>
                            <p className="text-[9px] text-slate-500 mt-1">{new Date(order.createdAt).toLocaleTimeString()}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                          }`}>
                            {order.status === "PENDING" ? "Pendiente" : "En Cocina"}
                          </span>
                        </div>

                        {/* Customer info if delivery */}
                        {(order.customerName || order.customerPhone) && (
                          <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl space-y-1 border border-slate-800/40">
                            {order.customerName && <p><strong>Cliente:</strong> {order.customerName}</p>}
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

      {/* Modal de Pasarela de Pago Segura - Plan Premium ($5 USD/mes) */}
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
              <h3 className="text-xl font-extrabold text-white">Pasarela de Pago Segura</h3>
              <p className="text-slate-400 text-xs">
                Suscripción Plan Premium ($5.00 USD/mes) para <strong className="text-white">{restaurant.name}</strong>
              </p>
            </div>

            {/* Price summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Concepto:</span>
                <span className="font-bold text-white">Suscripción Mensual Pro</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Período:</span>
                <span>30 Días (Renovación Automática)</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Cifrado:</span>
                <span className="text-emerald-400 font-medium">SSL 256-Bit SmartFields</span>
              </div>
              <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center">
                <span className="font-bold text-white text-sm">Total a pagar:</span>
                <span className="text-2xl font-black text-amber-400">$5.00 USD</span>
              </div>
            </div>

            {/* Credit Card Payment Form */}
            <form onSubmit={handleSubscribePremium} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Nombre en la Tarjeta <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. JUAN CARLOS PEREZ"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                  className="bg-slate-950 border border-slate-800 focus:border-amber-500 block w-full px-3.5 py-2.5 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none tracking-wide"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
                  <span>Número de Tarjeta de Crédito / Débito <span className="text-red-400">*</span></span>
                  <span className="text-[10px] text-slate-500 font-mono">Visa / Mastercard / Amex / Diners</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={19}
                    placeholder="4532 1234 5678 9012"
                    value={cardNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = v.replace(/(.{4})/g, "$1 ").trim();
                      setCardNumber(formatted);
                    }}
                    className="bg-slate-950 border border-slate-800 focus:border-amber-500 block w-full pl-10 pr-3 py-2.5 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none font-mono tracking-widest"
                  />
                  <CreditCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Expiración <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                      setCardExpiry(v);
                    }}
                    className="bg-slate-950 border border-slate-800 focus:border-amber-500 block w-full px-3.5 py-2.5 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    CVC / CVV <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="123"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="bg-slate-950 border border-slate-800 focus:border-amber-500 block w-full px-3.5 py-2.5 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none text-center font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Identificación del Titular (Cédula / RUC)
                </label>
                <input
                  type="text"
                  maxLength={13}
                  placeholder="Ej. 1712345678001"
                  value={cardDocId}
                  onChange={(e) => setCardDocId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                  className="bg-slate-950 border border-slate-800 focus:border-amber-500 block w-full px-3.5 py-2.5 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none font-mono"
                />
              </div>

              {paymentSuccessMsg && (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-2xl text-center font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{paymentSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {isSubmittingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Procesando Pago de $5.00 USD...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pagar $5.00 USD y Activar Plan
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-center text-slate-500 leading-normal">
              🔒 Transacción segura procesada mediante clave SmartFields API con cifrado bancario SSL 256-bit.
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
