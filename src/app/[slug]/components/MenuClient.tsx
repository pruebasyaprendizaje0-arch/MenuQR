"use client";

import { useState, useRef, useEffect } from "react";
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
  MessageSquare
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
  categories: Category[];
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
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  const handleSendOrder = (selectedMethod: "cash" | "qr") => {
    if (cart.length === 0) return;

    let message = `¡Hola! Me gustaría hacer un pedido en *${restaurant.name}*:\n\n`;
    message += `*Detalle del Pedido:*\n`;
    message += `-----------------------------------\n`;
    
    cart.forEach((item) => {
      message += `• *${item.quantity}x* ${item.dish.name} ($${item.dish.price.toFixed(2)} c/u)\n`;
    });

    message += `-----------------------------------\n`;
    message += `*Método de Pago:* ${selectedMethod === "qr" ? "QR de Cobro (Deuna / Transferencia)" : "Efectivo / Contra entrega en local"}\n`;

    if (selectedMethod === "qr" && restaurant.paymentQrUrl) {
      const qrFullUrl = restaurant.paymentQrUrl.startsWith("http") 
        ? restaurant.paymentQrUrl 
        : `${window.location.origin}${restaurant.paymentQrUrl}`;
      message += `*QR de Cobro:* ${qrFullUrl}\n`;
    }

    message += `*Total a Pagar:* $${cartTotal.toFixed(2)}\n\n`;
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
    
    setIsCheckoutOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500/30">
      {/* Dynamic theme style overrides */}
      <style jsx global>{`
        :root {
          --theme-accent: ${restaurant.themeColor};
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
            {restaurant.logoUrl ? (
              <img 
                src={restaurant.logoUrl} 
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

        {/* Navigation Tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex border-b border-slate-900/40 gap-4 text-xs font-bold">
          <button
            onClick={() => setCurrentTab("profile")}
            className={`pb-1 transition ${
              currentTab === "profile" 
                ? "text-white border-b-2" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ borderBottomColor: currentTab === "profile" ? restaurant.themeColor : "transparent" }}
          >
            Perfil Comercial
          </button>
          <button
            onClick={() => setCurrentTab("menu")}
            className={`pb-1 transition ${
              currentTab === "menu" 
                ? "text-white border-b-2" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            style={{ borderBottomColor: currentTab === "menu" ? restaurant.themeColor : "transparent" }}
          >
            Menú Digital
          </button>
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
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 relative z-10 space-y-12">
        {currentTab === "profile" ? (
          <div className="space-y-8 animate-fade-in">
            {/* Cover Banner Card */}
            <div className="relative h-48 rounded-3xl overflow-hidden bg-slate-900 border border-slate-900/60 shadow-xl">
              <div 
                className="absolute inset-0 bg-gradient-to-tr opacity-40"
                style={{ backgroundColor: restaurant.themeColor }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
              
              <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4">
                {restaurant.logoUrl ? (
                  <img 
                    src={restaurant.logoUrl} 
                    alt={restaurant.name} 
                    className="h-20 w-20 rounded-2xl object-cover border-2 border-slate-950 shadow-2xl"
                  />
                ) : (
                  <div 
                    className="h-20 w-20 rounded-2xl flex items-center justify-center font-black text-white text-2xl border-2 border-slate-950 shadow-2xl"
                    style={{ backgroundColor: restaurant.themeColor }}
                  >
                    {restaurant.name.charAt(0)}
                  </div>
                )}
                <div className="mb-1">
                  <h2 className="text-2xl font-black text-white leading-tight">{restaurant.name}</h2>
                  <p className="text-xs text-slate-400 font-medium">Categorías premium y pedidos automáticos</p>
                </div>
              </div>
            </div>

            {/* Description & About Us */}
            {restaurant.description && (
              <div className="bg-slate-900/40 border border-slate-900/60 rounded-3xl p-6 backdrop-blur-md space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sobre Nosotros</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{restaurant.description}</p>
              </div>
            )}

            {/* Quick Specs (Especialidad y Horario) */}
            {(restaurant.specialty || restaurant.schedule) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {restaurant.specialty && (
                  <div className="bg-slate-900/40 border border-slate-900/60 p-5 rounded-2xl backdrop-blur-md">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Especialidad de la Casa</span>
                    <p className="text-sm text-slate-200 font-bold mt-1">{restaurant.specialty}</p>
                  </div>
                )}
                {restaurant.schedule && (
                  <div className="bg-slate-900/40 border border-slate-900/60 p-5 rounded-2xl backdrop-blur-md">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Horario de Atención</span>
                    <p className="text-sm text-slate-200 font-bold mt-1">{restaurant.schedule}</p>
                  </div>
                )}
              </div>
            )}

            {/* CTA Button "Ver Menú" */}
            <button
              onClick={() => setCurrentTab("menu")}
              className="w-full flex items-center justify-center gap-3 py-4.5 rounded-2xl text-sm font-black text-white transition-all transform hover:scale-[1.01] active:scale-[0.99] duration-200 shadow-xl"
              style={{ 
                backgroundColor: restaurant.themeColor,
                boxShadow: `0 10px 25px -5px ${restaurant.themeColor}33`
              }}
            >
              <Utensils className="h-5 w-5" />
              Ver Menú Digital QR
            </button>

            {/* Contact Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurant.whatsappNumber && (
                <a
                  href={`https://wa.me/${restaurant.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center gap-4 hover:bg-slate-900/50 transition duration-200"
                >
                  <div className="h-10 w-10 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">WhatsApp</span>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5">Enviar mensaje directo</p>
                  </div>
                </a>
              )}

              {restaurant.address && (
                <div className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center gap-4">
                  <div className="h-10 w-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Dirección</span>
                    <p className="text-xs text-slate-200 font-semibold mt-0.5 leading-relaxed">
                      {restaurant.address}
                      {restaurant.locality && <span className="block text-[10px] text-slate-400 mt-1">{restaurant.locality}</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Services & Facilities */}
            {restaurant.services && (
              <div className="bg-slate-900/40 border border-slate-900/60 rounded-3xl p-6 backdrop-blur-md space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Servicios y Facilidades</span>
                <div className="flex flex-wrap gap-2">
                  {restaurant.services.split(",").map((service, idx) => (
                    <span 
                      key={idx} 
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-350"
                    >
                      ✓ {service.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Numbers */}
            {restaurant.contactNumbers && (
              <div className="bg-slate-900/40 border border-slate-900/60 rounded-3xl p-6 backdrop-blur-md space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Otros Números de Contacto</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {restaurant.contactNumbers.split(",").map((phone, idx) => (
                    <a
                      key={idx}
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-900 text-xs font-bold text-slate-300 hover:text-white transition duration-200"
                    >
                      <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      {phone.trim()}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Social Networks Section */}
            {(restaurant.instagram || restaurant.facebook || restaurant.tiktok || restaurant.ubicameUrl) && (
              <div className="bg-slate-900/20 border border-slate-900/50 rounded-3xl p-6 flex flex-col items-center gap-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enlaces y Redes Sociales</span>
                <div className="flex gap-4 flex-wrap justify-center">
                  {restaurant.instagram && (
                    <a
                      href={restaurant.instagram.startsWith("http") ? restaurant.instagram : `https://instagram.com/${restaurant.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all duration-300"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                    </a>
                  )}
                  {restaurant.facebook && (
                    <a
                      href={restaurant.facebook.startsWith("http") ? restaurant.facebook : `https://facebook.com/${restaurant.facebook}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    </a>
                  )}
                  {restaurant.tiktok && (
                    <a
                      href={restaurant.tiktok.startsWith("http") ? restaurant.tiktok : `https://tiktok.com/${restaurant.tiktok}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-100/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                    </a>
                  )}
                  {restaurant.ubicameUrl && (
                    <a
                      href={restaurant.ubicameUrl.startsWith("http") ? restaurant.ubicameUrl : `https://${restaurant.ubicameUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:border-red-500/55 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-300 text-xs font-black"
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      Ubicame.info
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
          restaurant.categories.map((cat) => (
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
                {cat.dishes.map((dish) => (
                  <div 
                    key={dish.id}
                    className={`bg-slate-900/40 backdrop-blur-md border border-slate-900 rounded-3xl p-4 flex gap-4 transition-all duration-300 relative group overflow-hidden ${
                      dish.isAvailable ? "hover:border-slate-800" : "opacity-50"
                    }`}
                  >
                    {/* Item Image */}
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

                    {/* Item Details */}
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
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Cart Button (Visible if cart has items) */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-4 max-w-md mx-auto animate-bounce-subtle">
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
                  Pago Móvil Seguro (Ecuador)
                </span>
                
                {restaurant.paymentQrUrl ? (
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
                    <p className="text-[10px] text-slate-500 italic mt-2 leading-relaxed">
                      Recuerda tomar una captura de pantalla del comprobante de transferencia o pago y adjuntarla en el chat de WhatsApp.
                    </p>
                  </div>
                ) : (
                  <div className="py-6 text-slate-500 text-xs italic leading-relaxed">
                    El restaurante no ha subido una imagen de su QR de cobro Deuna. Puedes coordinar los datos de transferencia al enviar el pedido por WhatsApp.
                  </div>
                )}
              </div>
            )}

            {/* Cash details */}
            {paymentMethod === "cash" && (
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs text-slate-400">
                <p className="font-bold text-slate-350">Pago en efectivo o entrega local</p>
                <p className="leading-relaxed">Pagarás tu orden en el local al retirar o cuando recibas la entrega. El comercio coordinará los detalles contigo por WhatsApp.</p>
              </div>
            )}

            {/* Order Confirmation */}
            <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl flex justify-between items-center gap-4">
              <div>
                <span className="text-xs text-slate-400">Total Pedido</span>
                <p className="text-base font-extrabold text-white">${cartTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={() => handleSendOrder(paymentMethod)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-white shadow-lg transition-transform active:scale-95 duration-200"
                style={{ backgroundColor: restaurant.themeColor }}
              >
                <Send className="h-4 w-4" />
                Confirmar y WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
