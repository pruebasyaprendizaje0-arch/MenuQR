"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createOrderAction, updateLogoDirectAction, updateCoverDirectAction } from "@/lib/actions";
import { 
  Utensils, 
  ShoppingCart, 
  Send, 
  Plus, 
  Minus, 
  Trash2, 
  QrCode, 
  DollarSign,
  MapPin,
  MessageSquare,
  LogOut,
  Sparkles,
  Clock,
  Phone,
  Globe,
  Store,
  BookOpen,
  Share2,
  Check,
  Camera,
  Upload,
  Loader2
} from "lucide-react";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
};

type Category = {
  id: string;
  name: string;
  order: number;
  dishes: Dish[];
};

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  isOwner?: boolean;
  paymentQrUrl: string | null;
  whatsappNumber: string;
  themeColor: string;
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
  seasonRates?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    percentageBonus: number;
    fixedBonus: number;
    isHoliday: boolean;
    isActive: boolean;
  }[];
};

interface CartItem {
  dish: Dish;
  quantity: number;
}

export function MenuClient({ restaurant }: { restaurant: Restaurant }) {
  const [currentTab, setCurrentTab] = useState<"profile" | "menu">("profile");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr">("cash");
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [reservationDate, setReservationDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [selectedTable, setSelectedTable] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // States for Logo and Cover upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [coverModalOpen, setCoverModalOpen] = useState(false);

  // Find the first dish that has an imageUrl to use as a beautiful cover background!
  const firstDishWithImage = restaurant.categories
    .flatMap((c) => c.dishes)
    .find((d) => d.imageUrl);

  const logoClean = restaurant.logoUrl && restaurant.logoUrl.trim() !== "" ? restaurant.logoUrl : null;
  const coverClean = restaurant.coverUrl && restaurant.coverUrl.trim() !== "" ? restaurant.coverUrl : null;

  const coverBg = coverClean || firstDishWithImage?.imageUrl || logoClean;

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("logoFile", file);
    try {
      const res = await updateLogoDirectAction(restaurant.id, formData);
      if (res.error) {
        alert(res.error);
      } else {
        window.location.reload();
      }
    } catch (e) {
      alert("Error al subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    const formData = new FormData();
    formData.append("coverFile", file);
    try {
      const res = await updateCoverDirectAction(restaurant.id, formData);
      if (res.error) {
        alert(res.error);
      } else {
        window.location.reload();
      }
    } catch (e) {
      alert("Error al subir la portada.");
    } finally {
      setUploadingCover(false);
    }
  };

  const profileUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${restaurant.slug}` : `/${restaurant.slug}`;

  const handleShare = async () => {
    const shareData = {
      title: restaurant.name,
      text: `Mira el menú digital de ${restaurant.name}`,
      url: profileUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or sharing unavailable — fall back to copy link
      }
    }

    try {
      await navigator.clipboard.writeText(profileUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      alert("No se pudo copiar el enlace.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mesa = params.get("mesa") || params.get("table");
      if (mesa) {
        setSelectedTable(mesa);
      }
    }
  }, []);

  useEffect(() => {
    if (restaurant.categories.length > 0) {
      setActiveCategory(restaurant.categories[0].id);
    }
  }, [restaurant]);

  // Handle active category tracking on scroll
  useEffect(() => {
    const handleScroll = () => {
      let currentActive = activeCategory;
      let minDistance = Infinity;

      Object.entries(categoryRefs.current).forEach(([id, ref]) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const distance = Math.abs(rect.top - 120); // offset of category bar
        if (distance < minDistance && rect.top < window.innerHeight / 2) {
          minDistance = distance;
          currentActive = id;
        }
      });

      if (currentActive && currentActive !== activeCategory) {
        setActiveCategory(currentActive);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeCategory]);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = categoryRefs.current[categoryId];
    if (element) {
      const offset = 120; // sticky header + category bar height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const addToCart = (dish: Dish) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.dish.id === dish.id);
      if (existing) {
        return prevCart.map((item) =>
          item.dish.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { dish, quantity: 1 }];
    });
  };

  const removeFromCart = (dishId: string) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.dish.id === dishId);
      if (existing && existing.quantity > 1) {
        return prevCart.map((item) =>
          item.dish.id === dishId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prevCart.filter((item) => item.dish.id !== dishId);
    });
  };

  const deleteFromCart = (dishId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.dish.id !== dishId));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);

  const handleSendOrder = async (selectedMethod: "cash" | "qr") => {
    if (cart.length === 0) return;

    const isTableOrder = selectedTable !== "" && selectedTable !== "Domicilio";
    const isDeliveryOrder = selectedTable === "Domicilio";
    const applyIva = isTableOrder ? restaurant.ivaOnTable : restaurant.ivaOnTakeout;
    const applyService = isTableOrder ? restaurant.serviceOnTable : restaurant.serviceOnTakeout;

    const subtotal = cartTotal;
    const targetDate = reservationDate || new Date().toISOString().split("T")[0];
    const activeRate = (restaurant.seasonRates || []).find(
      (r) => r.isActive && targetDate >= r.startDate && targetDate <= r.endDate
    );

    const seasonBonusAmount = activeRate 
      ? (subtotal * (activeRate.percentageBonus / 100)) + activeRate.fixedBonus 
      : 0;

    const iva = applyIva ? (subtotal + seasonBonusAmount) * (restaurant.ivaPercent / 100) : 0;
    const serviceCharge = applyService ? (subtotal + seasonBonusAmount) * (restaurant.servicePercent / 100) : 0;
    const tip = subtotal * (tipPercentage / 100);
    const deliveryCost = isDeliveryOrder ? restaurant.deliveryCost : 0;
    const total = subtotal + seasonBonusAmount + iva + serviceCharge + tip + deliveryCost;

    // Save order in database first
    const itemsData = cart.map((item) => ({
      dishName: item.dish.name,
      price: item.dish.price,
      quantity: item.quantity,
    }));

    const result = await createOrderAction({
      restaurantId: restaurant.id,
      tableName: selectedTable || "Llevar",
      customerName: isDeliveryOrder ? customerName : undefined,
      customerPhone: isDeliveryOrder ? customerPhone : undefined,
      subtotal,
      iva,
      serviceCharge,
      tip,
      deliveryCost,
      seasonRateName: activeRate ? activeRate.name : undefined,
      seasonRateAmount: seasonBonusAmount,
      total,
      paymentMethod: selectedMethod,
      items: itemsData,
    });

    if (result.error) {
      alert(result.error);
      return;
    }

    let message = `¡Hola! Me gustaría hacer una reserva/pedido en *${restaurant.name}*:\n\n`;
    message += `*Fecha de Reserva/Pedido:* ${targetDate}\n`;
    message += `*Detalle del Pedido:*\n`;
    message += `-----------------------------------\n`;
    
    cart.forEach((item) => {
      message += `• *${item.quantity}x* ${item.dish.name} ($${item.dish.price.toFixed(2)} c/u)\n`;
    });

    message += `-----------------------------------\n`;
    if (selectedTable === "Domicilio") {
      message += `*Método de Entrega:* Envío a Domicilio 🛵\n`;
      if (customerName.trim()) {
        message += `*Cliente:* ${customerName.trim()}\n`;
      }
      if (customerPhone.trim()) {
        message += `*WhatsApp Cliente:* ${customerPhone.trim()}\n`;
      }
      message += `*Dirección de Envío:* ${deliveryAddress}\n`;
    } else if (selectedTable) {
      message += `*Mesa:* #${selectedTable}\n`;
    } else {
      message += `*Mesa:* Para llevar / Llevar a casa\n`;
    }
    message += `*Subtotal Base:* $${subtotal.toFixed(2)}\n`;

    if (activeRate && seasonBonusAmount !== 0) {
      message += `*Ajuste ${activeRate.isHoliday ? "Festivo" : "Temporada"} (${activeRate.name}):* ${seasonBonusAmount > 0 ? "+" : ""}$${seasonBonusAmount.toFixed(2)}\n`;
    }

    message += `*IVA (${restaurant.ivaPercent}%):* $${iva.toFixed(2)}\n`;
    message += `*Servicio (${restaurant.servicePercent}%):* $${serviceCharge.toFixed(2)}\n`;
    if (selectedTable === "Domicilio" && deliveryCost > 0) {
      message += `*Costo de Envío:* $${deliveryCost.toFixed(2)}\n`;
    }
    message += `*Propina:* $${tip.toFixed(2)}\n`;
    message += `*Total a Pagar:* $${total.toFixed(2)}\n`;
    message += `*Método de Pago:* ${selectedMethod === "qr" ? "QR de Cobro (Deuna / Transferencia)" : "Efectivo / Contra entrega en local"}\n`;

    if (selectedMethod === "qr" && restaurant.paymentQrUrl) {
      const qrFullUrl = restaurant.paymentQrUrl.startsWith("http") 
        ? restaurant.paymentQrUrl 
        : `${window.location.origin}${restaurant.paymentQrUrl}`;
      message += `*QR de Cobro:* ${qrFullUrl}\n`;
    }

    message += `\n_Pedido registrado con ID: ${result.orderId}_\n`;
    message += `_Enviado desde MenuQR Pro_`;

    let formattedPhone = restaurant.whatsappNumber.replace(/\D/g, "");
    if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
      formattedPhone = "593" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
      formattedPhone = "593" + formattedPhone;
    } else if (formattedPhone.length === 10 && formattedPhone.startsWith("09")) {
      formattedPhone = "593" + formattedPhone.substring(1);
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
    
    // Clear cart and close checkout
    setCart([]);
    setIsCheckoutOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500/30">
      {/* Dynamic theme style overrides */}
      <style jsx global>{`
        :root {
          --theme-accent: ${restaurant.themeColor};
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-25deg); }
          100% { transform: translateX(250%) skewX(-25deg); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s infinite;
        }
      `}</style>

      {/* Decorative background gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div 
          className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full blur-[150px] opacity-20 transition-all duration-1000"
          style={{ backgroundColor: restaurant.themeColor }}
        ></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full blur-[150px] opacity-10 bg-slate-800"></div>
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-slate-950/70 backdrop-blur-xl border-b border-slate-900/80 transition-all duration-300">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoClean ? (
              <img 
                src={logoClean} 
                alt={restaurant.name} 
                className="h-12 w-12 rounded-2xl object-cover border border-slate-800"
              />
            ) : (
              <div 
                className="h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg text-lg"
                style={{ backgroundColor: restaurant.themeColor }}
              >
                {restaurant.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-white text-base tracking-tight">{restaurant.name}</h1>
              <p className="text-xs text-slate-400">Menú Digital Auténtico</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href="/"
              className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all duration-200"
              title="Volver a MenuQR Pro"
            >
              <LogOut className="h-5 w-5" />
            </Link>

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition-all duration-200"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse"
                  style={{ backgroundColor: restaurant.themeColor }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-4 pt-1 hidden sm:flex justify-center" style={{ fontFamily: 'var(--font-outfit)' }}>
          <div className="flex p-1 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-full sm:w-[380px] gap-1 relative z-10">
            <button
              onClick={() => setCurrentTab("profile")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black tracking-wide uppercase transition-all duration-300 ${
                currentTab === "profile" 
                  ? "text-white shadow-lg" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={{ 
                backgroundColor: currentTab === "profile" ? restaurant.themeColor : "transparent",
                boxShadow: currentTab === "profile" ? `0 4px 15px -3px ${restaurant.themeColor}55` : undefined
              }}
            >
              <Store className="h-4 w-4" />
              <span>Perfil Comercial</span>
            </button>
            <button
              onClick={() => setCurrentTab("menu")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black tracking-wide uppercase transition-all duration-300 ${
                currentTab === "menu" 
                  ? "text-white shadow-lg" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              style={{ 
                backgroundColor: currentTab === "menu" ? restaurant.themeColor : "transparent",
                boxShadow: currentTab === "menu" ? `0 4px 15px -3px ${restaurant.themeColor}55` : undefined
              }}
            >
              <BookOpen className="h-4 w-4" />
              <span>Menú Digital</span>
            </button>
          </div>
        </div>

        {/* Scrollable Categories Navigation */}
        {currentTab === "menu" && (
          <div className="bg-slate-950/40 border-t border-slate-900/60 scrollbar-none overflow-x-auto">
            <div className="max-w-3xl mx-auto px-4 flex gap-2 py-3">
            {restaurant.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap tracking-wide border transition-all duration-200 ${
                  activeCategory === cat.id
                    ? "text-white border-transparent"
                    : "text-slate-400 bg-slate-900/40 border-slate-900 hover:text-slate-200"
                }`}
                style={{
                  backgroundColor: activeCategory === cat.id ? restaurant.themeColor : undefined,
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        )}
      </header>

      {/* Main Menu Feed */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-32 relative z-10 space-y-12">
        {currentTab === "profile" ? (
          <div className="space-y-8 animate-fade-in" style={{ fontFamily: 'var(--font-outfit)' }}>
            {/* Cover Banner Card */}
            <div className="relative h-56 rounded-[2rem] overflow-hidden bg-slate-900/60 border border-white/5 shadow-2xl backdrop-blur-md group/cover">
              {coverBg ? (
                <img 
                  src={coverBg} 
                  alt="" 
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                    coverBg === logoClean ? "filter blur-2xl opacity-25 scale-110" : "opacity-45"
                  }`} 
                />
              ) : (
                <div 
                  className="absolute inset-0 bg-gradient-to-tr opacity-30"
                  style={{ backgroundColor: restaurant.themeColor }}
                ></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"></div>
              
              {/* Owner Controls for Cover */}
              {restaurant.isOwner && (
                <button 
                  onClick={() => setCoverModalOpen(true)}
                  className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 border border-white/10 rounded-xl text-[10px] sm:text-xs font-bold text-white transition-all backdrop-blur-sm cursor-pointer shadow-lg"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>Cambiar Fondo</span>
                </button>
              )}

              <div className="absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-8 sm:right-8 flex items-center gap-5">
                <div className="relative group/logo shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-tr rounded-3xl opacity-75 blur-md group-hover/logo:opacity-100 transition duration-300"
                       style={{ backgroundImage: `linear-gradient(to top right, ${restaurant.themeColor}, #ffffff)` }}></div>
                  {logoClean ? (
                    <img 
                      src={logoClean} 
                      alt={restaurant.name} 
                      className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-3xl object-cover border-2 border-slate-950 shadow-2xl transition-transform duration-300 group-hover/logo:scale-105"
                    />
                  ) : (
                    <div 
                      className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-3xl flex items-center justify-center font-black text-white text-2xl border-2 border-slate-950 shadow-2xl transition-transform duration-300 group-hover/logo:scale-105"
                      style={{ backgroundColor: restaurant.themeColor }}
                    >
                      {restaurant.name.charAt(0)}
                    </div>
                  )}

                  {/* Owner Controls for Logo (Touch-friendly floating button) */}
                  {restaurant.isOwner && (
                    <button 
                      onClick={() => setLogoModalOpen(true)}
                      className="absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center bg-black/80 hover:bg-black border border-white/10 rounded-full z-20 cursor-pointer text-white shadow-lg transition-transform active:scale-90"
                      title="Cambiar Logo"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </button>
                  )}
                </div>
                <div className="mb-1">
                  <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">{restaurant.name}</h2>
                  <p className="text-sm sm:text-base text-slate-400/90 font-medium tracking-wide mt-1">Categorías premium y pedidos automáticos</p>
                </div>
              </div>
            </div>

            {/* Description & About Us */}
            {restaurant.description && (
              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-8 backdrop-blur-md space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>
                <h3 className="text-xs font-extrabold uppercase tracking-[0.25em] text-slate-500">Sobre Nosotros</h3>
                <p className="text-slate-350 text-lg leading-relaxed font-serif italic" style={{ fontFamily: 'var(--font-playfair)' }}>
                  "{restaurant.description}"
                </p>
              </div>
            )}

            {/* Quick Specs (Especialidad y Horario) */}
            {(restaurant.specialty || restaurant.schedule) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {restaurant.specialty && (
                  <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md flex items-start gap-4 transition-all duration-300 hover:border-white/10 hover:bg-slate-900/50">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                         style={{ backgroundColor: `${restaurant.themeColor}15`, color: restaurant.themeColor }}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-extrabold uppercase tracking-[0.2em]">Especialidad de la Casa</span>
                      <p className="text-base text-slate-200 font-bold mt-1.5 leading-snug">{restaurant.specialty}</p>
                    </div>
                  </div>
                )}
                {restaurant.schedule && (
                  <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md flex items-start gap-4 transition-all duration-300 hover:border-white/10 hover:bg-slate-900/50">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                         style={{ backgroundColor: `${restaurant.themeColor}15`, color: restaurant.themeColor }}>
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-extrabold uppercase tracking-[0.2em]">Horario de Atención</span>
                      <p className="text-base text-slate-200 font-bold mt-1.5 leading-snug">{restaurant.schedule}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA Button "Ver Menú" */}
            <button
              onClick={() => setCurrentTab("menu")}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-base font-black text-white transition-all transform hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] duration-300 shadow-xl relative overflow-hidden group"
              style={{ 
                backgroundColor: restaurant.themeColor,
                boxShadow: `0 15px 30px -5px ${restaurant.themeColor}44`
              }}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-[-25deg] -translate-x-full group-hover:animate-shimmer"></div>
              <Utensils className="h-5.5 w-5.5 transition-transform group-hover:rotate-12 duration-300" />
              <span className="tracking-wide">Ver Menú Digital</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black text-white transition-all transform hover:scale-[1.01] hover:bg-slate-800 active:scale-[0.99] duration-300 border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-lg relative overflow-hidden group"
              title="Compartir este perfil"
            >
              {shareCopied ? (
                <>
                  <Check className="h-5 w-5 text-green-400" />
                  <span className="tracking-wide text-green-400">¡Enlace copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-5 w-5 transition-transform group-hover:rotate-12 duration-300" style={{ color: restaurant.themeColor }} />
                  <span className="tracking-wide">Compartir Perfil</span>
                </>
              )}
            </button>

            {/* Contact Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {restaurant.whatsappNumber && (
                <a
                  href={`https://wa.me/${restaurant.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900/30 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 hover:bg-slate-900/50 hover:border-white/10 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="h-12 w-12 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">WhatsApp</span>
                    <p className="text-xs text-slate-200 font-bold mt-1">Enviar mensaje directo</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Hacer consultas en línea</span>
                  </div>
                </a>
              )}

              {restaurant.address && (
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 transition-all duration-300 hover:scale-[1.02]">
                  <div className="h-12 w-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                    <MapPin className="h-5.5 w-5.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">Dirección</span>
                    <p className="text-xs text-slate-200 font-bold mt-1 leading-relaxed truncate">{restaurant.address}</p>
                    {restaurant.locality && <span className="block text-[10px] text-slate-400 mt-0.5">{restaurant.locality}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Services & Facilities */}
            {restaurant.services && (
              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-8 backdrop-blur-md space-y-4">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.2em] block">Servicios y Facilidades</span>
                <div className="flex flex-wrap gap-2.5">
                  {restaurant.services.split(",").map((service, idx) => (
                    <span 
                      key={idx} 
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-slate-950/80 border border-white/5 text-slate-350 hover:border-white/10 hover:text-white transition duration-200 flex items-center gap-1.5"
                    >
                      <span style={{ color: restaurant.themeColor }}>✓</span> {service.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Numbers */}
            {restaurant.contactNumbers && (
              <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-8 backdrop-blur-md space-y-4">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.2em] block">Otros Números de Contacto</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {restaurant.contactNumbers.split(",").map((phone, idx) => (
                    <a
                      key={idx}
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-3.5 px-5 py-4 rounded-2xl bg-slate-950/80 border border-white/5 hover:border-white/10 hover:bg-slate-900 text-sm font-bold text-slate-300 hover:text-white transition-all duration-300 hover:scale-[1.01]"
                    >
                      <Phone className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                      <span>{phone.trim()}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Social Networks Section */}
            {(restaurant.instagram || restaurant.facebook || restaurant.tiktok || restaurant.ubicameUrl) && (
              <div className="bg-slate-900/20 border border-white/5 rounded-[2rem] p-8 flex flex-col items-center gap-5 backdrop-blur-md">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.2em]">Enlaces y Redes Sociales</span>
                <div className="flex gap-4 flex-wrap justify-center">
                  {restaurant.instagram && (
                    <a
                      href={restaurant.instagram.startsWith("http") ? restaurant.instagram : `https://instagram.com/${restaurant.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-13 w-13 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-pink-500/50 hover:bg-gradient-to-tr hover:from-yellow-600/10 hover:via-pink-600/10 hover:to-purple-600/10 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all duration-300"
                    >
                      <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                    </a>
                  )}
                  {restaurant.facebook && (
                    <a
                      href={restaurant.facebook.startsWith("http") ? restaurant.facebook : `https://facebook.com/${restaurant.facebook}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-13 w-13 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-300"
                    >
                      <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </a>
                  )}
                  {restaurant.tiktok && (
                    <a
                      href={restaurant.tiktok.startsWith("http") ? restaurant.tiktok : `https://tiktok.com/${restaurant.tiktok}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-13 w-13 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-100/50 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-300"
                    >
                      <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                    </a>
                  )}
                  {restaurant.ubicameUrl && (
                    <a
                      href={restaurant.ubicameUrl.startsWith("http") ? restaurant.ubicameUrl : `https://${restaurant.ubicameUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 h-13 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center gap-2.5 text-slate-400 hover:text-white hover:border-red-500/55 hover:bg-red-500/5 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300 text-xs font-black"
                    >
                      <Globe className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                      <span>Ubicame.info</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : restaurant.categories.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <Utensils className="h-12 w-12 mx-auto text-slate-700 mb-3" />
            <p className="text-sm">Este restaurante aún no tiene categorías ni platos disponibles.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Table Selector Banner */}
            <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6 backdrop-blur-md flex items-center justify-between gap-4" style={{ fontFamily: 'var(--font-outfit)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0" style={{ backgroundColor: `${restaurant.themeColor}15`, color: restaurant.themeColor }}>
                  <Utensils className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">Tu Ubicación / Mesa</span>
                  <p className="text-sm text-slate-200 font-bold mt-0.5">
                    {selectedTable === "Domicilio" 
                      ? "Envío a Domicilio 🛵" 
                      : selectedTable 
                        ? `Mesa #${selectedTable}` 
                        : "Para llevar / Llevar a casa"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsTableModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-black text-white hover:brightness-110 transition active:scale-95 duration-200"
                style={{ backgroundColor: restaurant.themeColor }}
              >
                Cambiar
              </button>
            </div>

            {/* Popular Dishes Slider */}
            {(() => {
              const allDishes = restaurant.categories.flatMap(cat => cat.dishes);
              const popularDishes = allDishes.filter(dish => 
                ["Pizza Margherita", "Pizza Pepperoni", "Lasagna de Carne", "Fettuccine Alfredo"].includes(dish.name)
              ).slice(0, 4);
              const fallbackPopularDishes = popularDishes.length > 0 ? popularDishes : allDishes.slice(0, 3);
              
              if (fallbackPopularDishes.length === 0) return null;
              
              return (
                <div className="space-y-4" style={{ fontFamily: 'var(--font-outfit)' }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-1.5">
                      <span>Más Populares</span>
                      <span className="text-amber-500 animate-pulse">🔥</span>
                    </h2>
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.15em]">Los favoritos</span>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto scrollbar-none pb-4">
                    {fallbackPopularDishes.map((dish) => (
                      <div 
                        key={dish.id}
                        className="w-48 shrink-0 bg-slate-900/40 border border-white/5 rounded-3xl p-3 flex flex-col gap-2 relative group overflow-hidden transition duration-300 hover:border-white/10"
                      >
                        <div className="h-32 w-full rounded-2xl bg-slate-950 overflow-hidden shrink-0 border border-slate-900 relative">
                          {dish.imageUrl ? (
                            <img 
                              src={dish.imageUrl} 
                              alt={dish.name} 
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-650">
                              <Utensils className="h-8 w-8" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-950/80 text-amber-400 border border-amber-500/30 flex items-center gap-0.5 backdrop-blur-sm">
                            <Sparkles className="h-2.5 w-2.5" /> Popular
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <h3 className="font-extrabold text-white text-xs truncate group-hover:text-red-400 transition-colors">{dish.name}</h3>
                            <p className="text-[10px] text-slate-450 mt-1 line-clamp-1 leading-normal">{dish.description || "Receta clásica."}</p>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs font-black text-white" style={{ color: restaurant.themeColor }}>
                              ${dish.price.toFixed(2)}
                            </span>
                            {dish.isAvailable ? (
                              <button
                                onClick={() => addToCart(dish)}
                                className="p-1.5 rounded-xl text-white shadow-lg transition transform active:scale-90 duration-200"
                                style={{ backgroundColor: restaurant.themeColor }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-950 border border-slate-900 px-2 py-1 rounded-full">Agotado</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Categorías y Platos */}
            {restaurant.categories.map((cat) => {
              const isComboCategory = cat.name.toLowerCase().includes("combo");
              
              return (
                <div 
                  key={cat.id}
                  ref={(el) => { categoryRefs.current[cat.id] = el; }}
                  className="scroll-mt-32 space-y-4"
                >
                  <h2 className="text-lg font-bold text-white tracking-wide border-l-4 pl-3 flex items-center justify-between"
                      style={{ borderColor: restaurant.themeColor }}>
                    {cat.name}
                    <span className="text-[10px] text-slate-500 font-normal uppercase tracking-widest">{cat.dishes.length} Opciones</span>
                  </h2>

                  <div className="grid grid-cols-1 gap-4">
                    {cat.dishes.map((dish) => {
                      if (isComboCategory) {
                        return (
                          <div 
                            key={dish.id}
                            className={`relative group overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-950/85 backdrop-blur-md rounded-[2rem] p-5 flex gap-5 transition-all duration-300 border ${
                              dish.isAvailable 
                                ? "border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]" 
                                : "opacity-50 border-slate-900"
                            }`}
                          >
                            <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                            
                            <div className="h-28 w-28 rounded-2xl bg-slate-950 overflow-hidden shrink-0 border border-slate-900 relative">
                              {dish.imageUrl ? (
                                <img 
                                  src={dish.imageUrl} 
                                  alt={dish.name} 
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-650">
                                  <Utensils className="h-10 w-10" />
                                </div>
                              )}
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500 text-slate-950 flex items-center gap-0.5">
                                ★ Combo Ahorro
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                              <div>
                                <h3 className="font-extrabold text-white text-base group-hover:text-amber-400 transition-colors truncate">{dish.name}</h3>
                                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-3">{dish.description || "Pack especial seleccionado."}</p>
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-base font-black text-amber-400">${dish.price.toFixed(2)}</span>
                                <div>
                                  {dish.isAvailable ? (
                                    <button
                                      onClick={() => addToCart(dish)}
                                      className="inline-flex items-center gap-1 text-[11px] font-black px-4 py-2 rounded-xl text-white shadow-lg transition transform active:scale-95 duration-200"
                                      style={{ backgroundColor: restaurant.themeColor }}
                                    >
                                      <Plus className="h-3.5 w-3.5" /> Agregar Combo
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-full">Agotado</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={dish.id}
                          className={`bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-3xl p-4 flex gap-4 transition-all duration-300 relative group overflow-hidden ${
                            dish.isAvailable ? "hover:border-slate-800" : "opacity-50"
                          }`}
                        >
                          <div className="h-24 w-24 rounded-2xl bg-slate-950 overflow-hidden shrink-0 border border-slate-900 relative">
                            {dish.imageUrl ? (
                              <img 
                                src={dish.imageUrl} 
                                alt={dish.name} 
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-650">
                                <Utensils className="h-8 w-8" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                            <div>
                              <h3 className="font-extrabold text-white text-sm group-hover:text-red-400 transition-colors truncate">{dish.name}</h3>
                              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2">{dish.description || "Nuestra receta clásica seleccionada."}</p>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-sm font-black text-white" style={{ color: restaurant.themeColor }}>${dish.price.toFixed(2)}</span>
                              <div className="flex justify-end pt-2">
                                {dish.isAvailable ? (
                                  <button
                                    onClick={() => addToCart(dish)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full text-white shadow-lg transition-transform active:scale-95 duration-200"
                                    style={{ backgroundColor: restaurant.themeColor }}
                                  >
                                    <Plus className="h-3 w-3" /> Agregar
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-full">Agotado</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Cart Button (Visible if cart has items) */}
      {cartCount > 0 && (
        <div className="fixed bottom-24 sm:bottom-6 left-0 right-0 z-40 px-4 max-w-md mx-auto animate-bounce-subtle">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl shadow-2xl text-white font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] duration-200"
            style={{ backgroundColor: restaurant.themeColor }}
          >
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="h-5 w-5" />
              <span>Ver Pedido ({cartCount})</span>
            </div>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-lg">${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Side Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div 
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          ></div>

          {/* Drawer container */}
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl z-10 animate-slide-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-extrabold text-white text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-slate-400" />
                Tu Pedido
              </h2>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-xs transition"
              >
                Cerrar
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <Utensils className="h-10 w-10 text-slate-700 mb-2" />
                  <p className="text-sm">Tu carrito está vacío.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.dish.id} className="flex gap-4 items-center bg-slate-950/40 border border-slate-850 p-3 rounded-2xl">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-900">
                      {item.dish.imageUrl && (
                        <img src={item.dish.imageUrl} alt={item.dish.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{item.dish.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">${item.dish.price.toFixed(2)} c/u</p>
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(item.dish.id)}
                        className="p-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-bold text-white w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => addToCart(item.dish)}
                        className="p-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteFromCart(item.dish.id)}
                        className="p-1 ml-2 text-red-500 hover:bg-red-950/30 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary & Submit */}
            <div className="p-6 border-t border-slate-800 space-y-4">
              <div className="flex justify-between items-center text-slate-350">
                <span className="text-sm font-medium">Subtotal</span>
                <span className="text-base font-extrabold text-white">${cartTotal.toFixed(2)}</span>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm text-white shadow-lg hover:shadow-red-950/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed duration-200"
                style={{ backgroundColor: restaurant.themeColor }}
              >
                <Send className="h-4.5 w-4.5" />
                Continuar Pedido (${cartTotal.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div 
            onClick={() => setIsCheckoutOpen(false)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          ></div>

          {/* Checkout dialog container */}
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl z-10 space-y-6 overflow-y-auto max-h-[90vh] animate-slide-in">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">Método de Pago</h2>
                <p className="text-xs text-slate-400 mt-1">Selecciona cómo deseas pagar tu orden.</p>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-750 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>

            {/* Payment Method Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all duration-200 ${
                  paymentMethod === "cash"
                    ? "border-transparent text-white"
                    : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
                }`}
                style={{
                  backgroundColor: paymentMethod === "cash" ? restaurant.themeColor : undefined
                }}
              >
                <DollarSign className="h-5 w-5" />
                <span className="text-xs font-bold mt-2">Efectivo / Local</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("qr")}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all duration-200 ${
                  paymentMethod === "qr"
                    ? "border-transparent text-white"
                    : "border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200"
                }`}
                style={{
                  backgroundColor: paymentMethod === "qr" ? restaurant.themeColor : undefined
                }}
              >
                <QrCode className="h-5 w-5" />
                <span className="text-xs font-bold mt-2">QR Cobro (Deuna)</span>
              </button>
            </div>

            {/* Payment Details / QR display */}
            {paymentMethod === "qr" && (
              <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-2xl text-center space-y-3">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                  Pago Móvil o Transferencia Bancaria
                </span>
                
                {restaurant.paymentQrUrl && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Escanea este código con tu app de <strong>Deuna</strong> o banca móvil preferida para pagar:
                    </p>
                    <div className="bg-white p-3 rounded-2xl max-w-[200px] mx-auto border border-slate-800">
                      <img 
                        src={restaurant.paymentQrUrl} 
                        alt="Deuna QR de Cobro" 
                        className="w-full h-auto aspect-square object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Bank account details if configured */}
                {(restaurant.bankName || restaurant.bankAccountNumber) && (
                  <div className="border-t border-slate-850/80 pt-3 mt-3 text-left space-y-2 text-xs">
                    <p className="font-extrabold text-slate-300 border-b border-slate-900 pb-1 mb-2 text-center uppercase tracking-wider text-[10px]">
                      Datos para Transferencia Bancaria
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-slate-350">
                      {restaurant.bankName && (
                        <>
                          <span className="font-bold text-slate-400">Banco:</span>
                          <span className="text-right font-medium text-white">{restaurant.bankName}</span>
                        </>
                      )}
                      {restaurant.bankAccountType && (
                        <>
                          <span className="font-bold text-slate-400">Tipo:</span>
                          <span className="text-right font-medium text-white">{restaurant.bankAccountType}</span>
                        </>
                      )}
                      {restaurant.bankAccountNumber && (
                        <>
                          <span className="font-bold text-slate-400">Nro. Cuenta:</span>
                          <span className="text-right font-bold text-amber-400 select-all">{restaurant.bankAccountNumber}</span>
                        </>
                      )}
                      {restaurant.bankAccountName && (
                        <>
                          <span className="font-bold text-slate-400">Beneficiario:</span>
                          <span className="text-right font-medium text-white line-clamp-1">{restaurant.bankAccountName}</span>
                        </>
                      )}
                      {restaurant.bankAccountDocument && (
                        <>
                          <span className="font-bold text-slate-400">CI / RUC:</span>
                          <span className="text-right font-medium text-white select-all">{restaurant.bankAccountDocument}</span>
                        </>
                      )}
                      {restaurant.bankAccountEmail && (
                        <>
                          <span className="font-bold text-slate-400">Correo:</span>
                          <span className="text-right font-medium text-white select-all line-clamp-1">{restaurant.bankAccountEmail}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!restaurant.paymentQrUrl && !restaurant.bankName && !restaurant.bankAccountNumber && (
                  <div className="py-6 text-slate-500 text-xs italic leading-relaxed">
                    El restaurante no ha configurado datos de transferencia ni QR de cobro. Puedes coordinar los detalles al enviar el pedido por WhatsApp.
                  </div>
                )}

                <p className="text-[10px] text-slate-500 italic mt-2 leading-relaxed">
                  Recuerda tomar una captura de pantalla del comprobante de transferencia o pago y adjuntarla en el chat de WhatsApp al enviar tu orden.
                </p>
              </div>
            )}

            {/* Cash details */}
            {paymentMethod === "cash" && (
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs text-slate-400">
                <p className="font-bold text-slate-350">Pago en efectivo o entrega local</p>
                <p className="leading-relaxed">Pagarás tu orden en el local al retirar o cuando recibas la entrega. El comercio coordinará los detalles contigo por WhatsApp.</p>
              </div>
            )}

            {selectedTable === "Domicilio" && (
              <div className="space-y-3" style={{ fontFamily: 'var(--font-outfit)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Tu Nombre</span>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Pérez"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Tu WhatsApp</span>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 0991234567"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-850 focus:border-red-500 block px-4 py-2.5 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Dirección de Envío</span>
                  <textarea
                    required
                    placeholder="Escribe tu dirección exacta, ciudad y referencias para la entrega..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-850 focus:border-red-500 block px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Fecha de Reserva / Consumo */}
            <div className="space-y-1.5" style={{ fontFamily: 'var(--font-outfit)' }}>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Fecha de Reserva / Consumo</label>
              <input
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-medium focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Propina Selector */}
            <div className="space-y-2" style={{ fontFamily: 'var(--font-outfit)' }}>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Añadir Propina para el Personal</span>
              <div className="grid grid-cols-4 gap-2">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setTipPercentage(pct)}
                    className={`py-2 rounded-xl text-xs font-black border transition duration-200 ${
                      tipPercentage === pct
                        ? "text-white border-transparent"
                        : "text-slate-400 bg-slate-950/40 border-slate-800 hover:text-white"
                    }`}
                    style={{ backgroundColor: tipPercentage === pct ? restaurant.themeColor : undefined }}
                  >
                    {pct === 0 ? "Ninguna" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice Breakdown */}
            {(() => {
              const isTableOrder = selectedTable !== "" && selectedTable !== "Domicilio";
              const isDelivery = selectedTable === "Domicilio";
              const applyIva = isTableOrder ? restaurant.ivaOnTable : restaurant.ivaOnTakeout;
              const applyService = isTableOrder ? restaurant.serviceOnTable : restaurant.serviceOnTakeout;

              const subtotal = cartTotal;
              const targetDate = reservationDate || new Date().toISOString().split("T")[0];
              const activeRate = (restaurant.seasonRates || []).find(
                (r) => r.isActive && targetDate >= r.startDate && targetDate <= r.endDate
              );

              const seasonBonusAmount = activeRate 
                ? (subtotal * (activeRate.percentageBonus / 100)) + activeRate.fixedBonus 
                : 0;

              const iva = applyIva ? (subtotal + seasonBonusAmount) * (restaurant.ivaPercent / 100) : 0;
              const serviceCharge = applyService ? (subtotal + seasonBonusAmount) * (restaurant.servicePercent / 100) : 0;
              const tip = subtotal * (tipPercentage / 100);
              const deliveryCost = isDelivery ? restaurant.deliveryCost : 0;
              const total = subtotal + seasonBonusAmount + iva + serviceCharge + tip + deliveryCost;

              return (
                <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2.5 text-xs" style={{ fontFamily: 'var(--font-outfit)' }}>
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Base:</span>
                    <span className="font-bold text-slate-350">${subtotal.toFixed(2)}</span>
                  </div>

                  {activeRate && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between text-amber-400 font-bold text-[11px]">
                      <span>⚡ {activeRate.isHoliday ? "Festivo Especial" : "Temporada Alta"}: {activeRate.name}</span>
                      <span>{seasonBonusAmount > 0 ? `+$${seasonBonusAmount.toFixed(2)}` : `-$${Math.abs(seasonBonusAmount).toFixed(2)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>IVA ({restaurant.ivaPercent}%):</span>
                    <span className="font-bold text-slate-350">${iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Servicio ({restaurant.servicePercent}%):</span>
                    <span className="font-bold text-slate-350">${serviceCharge.toFixed(2)}</span>
                  </div>
                  {isDelivery && restaurant.deliveryCost > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Costo de Envío:</span>
                      <span className="font-bold text-slate-350">${restaurant.deliveryCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Propina ({tipPercentage}%):</span>
                    <span className="font-bold text-slate-350">${tip.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-2.5 flex justify-between text-sm font-black text-white">
                    <span>Total a Pagar:</span>
                    <span style={{ color: restaurant.themeColor }}>
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Confirm button */}
            <button
              onClick={() => handleSendOrder(paymentMethod)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-black uppercase text-white shadow-lg transition-transform active:scale-95 duration-200"
              style={{ backgroundColor: restaurant.themeColor }}
            >
              <Send className="h-4 w-4" />
              Confirmar y Enviar Pedido
            </button>
          </div>
        </div>
      )}

      {/* Table Selection Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" style={{ fontFamily: 'var(--font-outfit)' }}>
          <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-6 max-w-sm w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Selecciona tu Mesa</h3>
              <button 
                onClick={() => setIsTableModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Elige tu número de mesa para llevar tu pedido directamente a tu lugar. Si vas a pedir para llevar, selecciona "Llevar".
            </p>
            
            <div className="grid grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
              <button
                onClick={() => {
                  setSelectedTable("");
                  setIsTableModalOpen(false);
                }}
                className={`col-span-4 py-3 rounded-xl text-xs font-black tracking-wide uppercase border transition duration-200 ${
                  selectedTable === "" 
                    ? "text-white border-transparent" 
                    : "text-slate-400 bg-slate-950/60 border-white/5 hover:text-white"
                }`}
                style={{ backgroundColor: selectedTable === "" ? restaurant.themeColor : undefined }}
              >
                🛍️ Para Llevar
              </button>
              {restaurant.deliveryEnabled && (
                <button
                  onClick={() => {
                    setSelectedTable("Domicilio");
                    setIsTableModalOpen(false);
                  }}
                  className={`col-span-4 py-3 rounded-xl text-xs font-black tracking-wide uppercase border transition duration-200 ${
                    selectedTable === "Domicilio" 
                      ? "text-white border-transparent" 
                      : "text-slate-400 bg-slate-950/60 border-white/5 hover:text-white"
                  }`}
                  style={{ backgroundColor: selectedTable === "Domicilio" ? restaurant.themeColor : undefined }}
                >
                  🛵 Envío a Domicilio (${restaurant.deliveryCost.toFixed(2)})
                </button>
              )}
              {(() => {
                const tablesList = restaurant.tablesConfig 
                  ? restaurant.tablesConfig.split(",").map(t => t.trim()).filter(Boolean)
                  : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
                
                return tablesList.map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setSelectedTable(num);
                      setIsTableModalOpen(false);
                    }}
                    className={`py-3 rounded-xl text-sm font-black border transition duration-200 ${
                      selectedTable === num 
                        ? "text-white border-transparent" 
                        : "text-slate-350 bg-slate-950/60 border-white/5 hover:text-white"
                    }`}
                    style={{ backgroundColor: selectedTable === num ? restaurant.themeColor : undefined }}
                  >
                    {num}
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Direct Logo Upload Modal */}
      {logoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Actualizar Logo</h3>
              <p className="text-xs text-slate-400">Selecciona cómo deseas subir el logo de tu restaurante.</p>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Gallery Button */}
              <label className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl cursor-pointer font-bold text-sm transition-all border border-white/5 active:scale-95">
                <Upload className="h-4.5 w-4.5 text-amber-500" />
                Elegir de Galería
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleLogoUpload(e.target.files[0]);
                      setLogoModalOpen(false);
                    }
                  }}
                />
              </label>
              
              {/* Camera Button */}
              <label className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-2xl cursor-pointer font-bold text-sm transition-all shadow-lg active:scale-95">
                <Camera className="h-4.5 w-4.5" />
                Tomar Foto con Celular
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleLogoUpload(e.target.files[0]);
                      setLogoModalOpen(false);
                    }
                  }}
                />
              </label>
            </div>
            
            <button 
              onClick={() => setLogoModalOpen(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-400 font-bold py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Direct Cover Upload Modal */}
      {coverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Actualizar Fondo de Portada</h3>
              <p className="text-xs text-slate-400">Selecciona cómo deseas subir el fondo de portada.</p>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Gallery Button */}
              <label className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl cursor-pointer font-bold text-sm transition-all border border-white/5 active:scale-95">
                <Upload className="h-4.5 w-4.5 text-amber-500" />
                Elegir de Galería
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleCoverUpload(e.target.files[0]);
                      setCoverModalOpen(false);
                    }
                  }}
                />
              </label>
              
              {/* Camera Button */}
              <label className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded-2xl cursor-pointer font-bold text-sm transition-all shadow-lg active:scale-95">
                <Camera className="h-4.5 w-4.5" />
                Tomar Foto con Celular
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleCoverUpload(e.target.files[0]);
                      setCoverModalOpen(false);
                    }
                  }}
                />
              </label>
            </div>
            
            <button 
              onClick={() => setCoverModalOpen(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-400 font-bold py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center justify-around shadow-2xl">
          {/* Profile Tab */}
          <button
            onClick={() => setCurrentTab("profile")}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-200"
            style={{ color: currentTab === "profile" ? restaurant.themeColor : "#94a3b8" }}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Inicio</span>
          </button>

          {/* Menu Tab */}
          <button
            onClick={() => setCurrentTab("menu")}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-200"
            style={{ color: currentTab === "menu" ? restaurant.themeColor : "#94a3b8" }}
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Menú</span>
          </button>

          {/* Table Selector */}
          <button
            onClick={() => setIsTableModalOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition duration-200"
            style={{ color: selectedTable ? "#fbbf24" : "#94a3b8" }}
          >
            <Utensils className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[65px]">
              {selectedTable === "Domicilio" ? "Domicilio" : selectedTable ? `#${selectedTable}` : "Mesa"}
            </span>
          </button>

          {/* Cart / Order Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200 relative transition duration-200"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: restaurant.themeColor }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Pedido</span>
          </button>
        </div>
      </div>
    </div>
  );
}
