"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { BusinessCompactFooter } from "@/components/footer/BusinessCompactFooter";
import {
  ShoppingBag,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Truck,
  Store,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Filter,
  Layers,
  MapPin,
  Phone,
  Sparkles,
  Copy,
  Check,
  CreditCard,
  Tag,
  AlertCircle,
  QrCode,
  Navigation,
} from "lucide-react";

import { BusinessProfileView } from "@/components/public/BusinessProfileView";
import { SmartExitButton } from "@/components/public/SmartExitButton";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";
import { validateCouponAction } from "@/lib/actions";
import { parseDishImages, getPrimaryDishImage } from "@/lib/dish-images";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  hasVariants?: boolean;
  attribute1Name?: string | null;
  attribute1Options?: string[];
  attribute2Name?: string | null;
  attribute2Options?: string[];
  tallas?: string[];
  colores?: string[];
  stock: number;
  isNew?: boolean;
  categoryId?: string;
  categoryName?: string;
  categoryAspect?: string | null;
}

interface Category {
  id: string;
  name: string;
  imageAspectRatio?: "DEFAULT" | "1:1" | "9:16" | string | null;
  products: Product[];
}

interface StoreData {
  id: string;
  name: string;
  slug: string;
  imageAspectRatio?: "1:1" | "9:16";
  suggestedAspectRatio?: "1:1" | "9:16";
  popularAspectRatio?: "1:1" | "9:16";
  whatsapp: string;
  whatsappNumber?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  address: string;
  description: string;
  specialty?: string | null;
  slogan?: string | null;
  deliveryCost: number;
  deliveryRates?: string | null;
  enableDelivery?: boolean;
  enableTakeout?: boolean;
  taxRate?: number;
  serviceRate?: number;
  categories: Category[];
  themeColor?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  ubicameUrl?: string | null;
  reservationUrl?: string | null;
  googleBusinessUrl?: string | null;
  locality?: string | null;
  city?: string | null;
  province?: string | null;
  priceRange?: string | null;
  services?: string | null;
  contactNumbers?: string | null;
  schedule?: string | null;
  localSchedule?: string | null;
  structuredSchedule?: string | null;
  blockedDates?: string | null;
  mapEmbedUrl?: string | null;
  qrCobroUrl?: string | null;
  paymentQrUrl?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountDocument?: string | null;
  bankAccountEmail?: string | null;
  galleryImages?: string[] | null;
}

interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  selectedOption1?: string | null;
  selectedOption2?: string | null;
  variantLabel?: string | null;
  talla?: string | null;
  color?: string | null;
  cantidad: number;
}

export function CtaloClient({ store }: { store: StoreData }) {
  const [currentTab, setCurrentTab] = useState<"profile" | "catalogo">("profile");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash === "#catalogo" || hash === "#productos" || params.get("tab") === "catalogo") {
        setCurrentTab("catalogo");
      }
    }
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Modal para seleccionar variante de un producto
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeModalImgIdx, setActiveModalImgIdx] = useState<number>(0);

  useEffect(() => {
    setActiveModalImgIdx(0);
  }, [activeProduct]);

  const [selectedOption1, setSelectedOption1] = useState<string>("");
  const [selectedOption2, setSelectedOption2] = useState<string>("");
  const [selectedTalla, setSelectedTalla] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  // Formulario de checkout
  const [deliveryMethod, setDeliveryMethod] = useState<"domicilio" | "retiro">("domicilio");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerReference, setCustomerReference] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [copiedBank, setCopiedBank] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Cupones de descuento
  const [inputCouponCode, setInputCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    label?: string;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string>("");

  // Zonas y Tarifas de Envío por KM / Sectores configuradas en el Admin Panel
  const kmRatesList: { id: string; label: string; price: number; minOrder?: number }[] = useMemo(() => {
    if (store.deliveryRates) {
      try {
        const parsed = JSON.parse(store.deliveryRates);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, idx: number) => ({
            id: item.id || `km-${idx}`,
            label: item.label || `Rango ${idx + 1}`,
            price: typeof item.price === "number" ? item.price : 0,
            minOrder: typeof item.minOrder === "number" ? item.minOrder : (typeof item.minPurchase === "number" ? item.minPurchase : 0),
          }));
        }
      } catch (e) {
        console.error("Error parsing deliveryRates:", e);
      }
    }
    const baseCost = store.deliveryCost > 0 ? store.deliveryCost : 1.50;
    return [
      { id: "km-1", label: "Hasta 2 KM", price: baseCost, minOrder: 0 },
      { id: "km-2", label: "De 2 a 5 KM", price: 2.50, minOrder: 0 },
      { id: "km-3", label: "De 5 a 10 KM", price: 4.00, minOrder: 0 },
      { id: "km-4", label: "Más de 10 KM", price: 6.00, minOrder: 0 },
    ];
  }, [store.deliveryRates, store.deliveryCost]);

  const [selectedKmRate, setSelectedKmRate] = useState<{ id: string; label: string; price: number; minOrder?: number } | null>(null);

  useEffect(() => {
    if (kmRatesList.length > 0 && !selectedKmRate) {
      setSelectedKmRate(kmRatesList[0]);
    }
  }, [kmRatesList, selectedKmRate]);

  // Handler para copiar número de cuenta bancaria
  const handleCopyBankAccount = () => {
    if (store.bankAccountNumber) {
      navigator.clipboard.writeText(store.bankAccountNumber);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  // Handler para capturar ubicación GPS en 1 clic
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setCustomerAddress((prev) =>
          prev ? `${prev}\n📍 GPS: ${mapsUrl}` : `📍 GPS: ${mapsUrl}`
        );
        setIsLocating(false);
      },
      (err) => {
        console.warn("GPS error:", err);
        alert("No se pudo obtener el GPS automáticamente. Ingresa tu dirección manualmente.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handler para validar cupón de descuento
  const handleApplyCoupon = async () => {
    const clean = inputCouponCode.trim().toUpperCase();
    if (!clean) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const res = await validateCouponAction(store.id, clean, subtotal);
      if (res.error) {
        setCouponError(res.error);
      } else if (res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponError("");
      }
    } catch (e: any) {
      setCouponError("Error al validar el cupón.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Todos los productos planos para búsqueda
  const allProducts = useMemo(() => {
    return store.categories.flatMap((cat) =>
      cat.products.map((p) => ({
        ...p,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryAspect: cat.imageAspectRatio || "DEFAULT",
      }))
    );
  }, [store]);

  // Determina el formato de imagen (1:1 o 9:16) según la categoría o el negocio
  const getProductAspect = (product: Product): "1:1" | "9:16" => {
    const catAspect = product.categoryAspect;
    if (catAspect === "9:16") return "9:16";
    if (catAspect === "1:1") return "1:1";
    return store.imageAspectRatio === "9:16" ? "9:16" : "1:1";
  };

  // Determina si la vista o categoría activa debe estructurarse en formato 9:16 vertical
  const isView916 = useMemo(() => {
    if (selectedCategory !== "all") {
      const activeCat = store.categories.find((c) => c.id === selectedCategory);
      if (activeCat?.imageAspectRatio === "9:16") return true;
      if (activeCat?.imageAspectRatio === "1:1") return false;
    }
    return store.imageAspectRatio === "9:16";
  }, [selectedCategory, store]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchCat = selectedCategory === "all" || p.categoryId === selectedCategory;
      const matchSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allProducts, selectedCategory, searchQuery]);

  // Cálculos de carrito
  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.cantidad, 0);
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.price * it.cantidad, 0);
  }, [cart]);

  const effectiveDeliveryCost = deliveryMethod === "domicilio" ? (selectedKmRate ? selectedKmRate.price : store.deliveryCost) : 0;
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const isMinOrderUnmet = Boolean(deliveryMethod === "domicilio" && selectedKmRate?.minOrder && subtotal < selectedKmRate.minOrder);
  const tipAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount) * (tipPercentage / 100);
  }, [subtotal, discountAmount, tipPercentage]);
  const grandTotal = Math.max(0, subtotal - discountAmount) + effectiveDeliveryCost + tipAmount;

  // Obtener cantidad de un producto directo sin variantes en el carrito
  const getProductCartQty = (productId: string) => {
    return cart
      .filter((it) => it.productId === productId && !it.variantLabel)
      .reduce((sum, it) => sum + it.cantidad, 0);
  };

  // Añadir directamente con 1 clic (para productos sin variantes - Alternativa 1)
  const handleDirectAddToCart = (product: Product, delta: number = 1) => {
    const cartId = `${product.id}-direct`;
    setCart((prev) => {
      const existing = prev.find((it) => it.cartId === cartId);
      if (existing) {
        const newQty = existing.cantidad + delta;
        if (newQty <= 0) {
          return prev.filter((it) => it.cartId !== cartId);
        }
        return prev.map((it) =>
          it.cartId === cartId ? { ...it, cantidad: newQty } : it
        );
      }
      if (delta <= 0) return prev;
      return [
        ...prev,
        {
          cartId,
          productId: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          variantLabel: null,
          cantidad: delta,
        },
      ];
    });
  };

  // Abrir modal de variantes flexibles (Alternativa 2)
  const handleOpenProduct = (product: Product) => {
    setActiveProduct(product);
    const opt1 = product.attribute1Options?.[0] || product.tallas?.[0] || "Estándar";
    const opt2 = product.attribute2Options?.[0] || product.colores?.[0] || "";
    setSelectedOption1(opt1);
    setSelectedOption2(opt2);
    setSelectedTalla(opt1);
    setSelectedColor(opt2);
    setQuantity(1);
  };

  // Añadir al carrito con variantes seleccionadas
  const handleAddToCart = () => {
    if (!activeProduct) return;

    let variantLabel: string | null = null;
    if (activeProduct.hasVariants) {
      const parts: string[] = [];
      if (selectedOption1) parts.push(selectedOption1);
      if (selectedOption2) parts.push(selectedOption2);
      variantLabel = parts.join(" · ");
    }

    const cartId = `${activeProduct.id}-${selectedOption1 || "def"}-${selectedOption2 || "def"}`;
    setCart((prev) => {
      const existing = prev.find((it) => it.cartId === cartId);
      if (existing) {
        return prev.map((it) =>
          it.cartId === cartId ? { ...it, cantidad: it.cantidad + quantity } : it
        );
      }
      return [
        ...prev,
        {
          cartId,
          productId: activeProduct.id,
          name: activeProduct.name,
          price: activeProduct.price,
          imageUrl: activeProduct.imageUrl,
          selectedOption1,
          selectedOption2,
          variantLabel,
          talla: selectedOption1,
          color: selectedOption2,
          cantidad: quantity,
        },
      ];
    });

    setActiveProduct(null);
    setIsCartOpen(true);
  };

  // Actualizar cantidad en carrito
  const updateCartQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.cartId === cartId) {
            const newQty = it.cantidad + delta;
            return newQty > 0 ? { ...it, cantidad: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Procesar pedido a la API unificada y WhatsApp
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (isMinOrderUnmet) {
      alert(`El pedido no alcanza el consumo mínimo de $${selectedKmRate?.minOrder?.toFixed(2)} para la zona ${selectedKmRate?.label}.`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Por favor completa tu nombre y número de WhatsApp");
      return;
    }
    if (deliveryMethod === "domicilio" && !customerAddress.trim()) {
      alert("Por favor ingresa tu dirección de entrega para el envío a domicilio");
      return;
    }

    setIsSubmitting(true);

    try {
      const fullAddress = customerReference.trim()
        ? `${customerAddress.trim()} (Ref: ${customerReference.trim()})`
        : customerAddress.trim();

      const payload = {
        vertical: "catalogo",
        negocio_id: store.id,
        slug: store.slug,
        cliente_nombre: customerName,
        cliente_telefono: customerPhone,
        cliente_direccion: fullAddress,
        metodo_entrega: deliveryMethod,
        costo_envio: effectiveDeliveryCost,
        zona_envio: deliveryMethod === "domicilio" ? selectedKmRate?.label : undefined,
        metodo_pago: paymentMethod === "transferencia" ? "QR Deuna / Transferencia Bancaria" : "Efectivo / Local",
        codigo_cupon: appliedCoupon?.code || undefined,
        descuento: discountAmount > 0 ? discountAmount : undefined,
        propina: tipAmount > 0 ? tipAmount : undefined,
        total: grandTotal,
        notas_entrega: customerNotes,
        items: cart.map((it) => ({
          nombre: it.name,
          cantidad: it.cantidad,
          precio: it.price,
          talla: it.talla || undefined,
          color: it.color || undefined,
          notas: it.variantLabel || undefined,
        })),
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok && data.whatsapp_url) {
        setOrderSuccess(true);
        setCart([]);
        window.open(data.whatsapp_url, "_blank");
      } else {
        // Fallback WhatsApp message generator
        const phone = store.whatsappNumber || store.whatsapp;
        let cleanPhone = (phone || "").replace(/\D/g, "");
        if (cleanPhone.startsWith("09")) cleanPhone = "593" + cleanPhone.substring(1);
        else if (cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
        else if (!cleanPhone.startsWith("593") && cleanPhone.length === 9) cleanPhone = "593" + cleanPhone;

        let msg = `🛍️ *NUEVO PEDIDO - ${store.name.toUpperCase()}*\n`;
        msg += `--------------------------------------\n`;
        msg += `👤 *Cliente:* ${customerName}\n`;
        msg += `📱 *WhatsApp:* ${customerPhone}\n`;
        msg += `📦 *Modalidad:* ${deliveryMethod === "domicilio" ? `Envío a Domicilio (${selectedKmRate?.label || "Zona"})` : "Retiro en Tienda"}\n`;
        if (deliveryMethod === "domicilio") {
          msg += `📍 *Dirección:* ${fullAddress}\n`;
        }
        msg += `💳 *Método de Pago:* ${paymentMethod === "transferencia" ? "QR Deuna / Transferencia Bancaria" : "Efectivo / Local"}\n\n`;

        msg += `🛒 *DETALLE DEL PEDIDO:*\n`;
        cart.forEach((it) => {
          msg += `• ${it.cantidad}x ${it.name} ${it.variantLabel ? `(${it.variantLabel})` : ""} - $${(it.price * it.cantidad).toFixed(2)}\n`;
        });
        msg += `\n`;
        msg += `• *Subtotal:* $${subtotal.toFixed(2)}\n`;
        if (discountAmount > 0) {
          msg += `• *Cupón (${appliedCoupon?.code}):* -$${discountAmount.toFixed(2)}\n`;
        }
        if (deliveryMethod === "domicilio" && effectiveDeliveryCost > 0) {
          msg += `• *Envío (${selectedKmRate?.label || "Zona"}):* $${effectiveDeliveryCost.toFixed(2)}\n`;
        }
        if (tipAmount > 0) {
          msg += `• *Propina (${tipPercentage}%):* $${tipAmount.toFixed(2)}\n`;
        }
        msg += `💰 *TOTAL A PAGAR: $${grandTotal.toFixed(2)}*\n`;
        if (customerNotes.trim()) {
          msg += `\n📝 *Notas:* ${customerNotes.trim()}\n`;
        }
        if (paymentMethod === "transferencia") {
          msg += `\n📸 *Adjunto comprobante de pago/transferencia a este chat.*`;
        }

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        setOrderSuccess(true);
        setCart([]);
        window.open(waUrl, "_blank");
      }
    } catch (err) {
      console.error("Error submitting catalog order:", err);
      alert("Error al conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 pb-28 md:pb-12">
      {/* Top Bar with Dynamic Tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-white/10 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-amber-500/50 bg-slate-900 shrink-0">
              <Image src={store.logoUrl} alt={store.name} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">Tienda Oficial & Catálogo</span>
              <h2 className="text-xs sm:text-sm font-black text-white leading-tight truncate">{store.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex p-1 bg-slate-900/90 border border-white/10 rounded-2xl gap-1 shadow-lg">
              <button
                type="button"
                onClick={() => setCurrentTab("profile")}
                className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "profile"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>Perfil Comercial</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("catalogo")}
                className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "catalogo"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Catálogo Productos</span>
              </button>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
              <span>Carrito</span>
              {totalCartCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>

            <SmartExitButton fallbackUrl="/ctalo" />
          </div>
        </div>
      </div>

      {currentTab === "profile" ? (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <BusinessProfileView
            {...store}
            galleryTitle="Instalaciones & Vitrinas de la Tienda"
            galleryBadge="🛍️ Visita Nuestra Tienda"
            actionTabTitle="Ver Catálogo de Productos"
            actionTabIcon={<ShoppingBag className="h-4.5 w-4.5 shrink-0" />}
            onSelectActionTab={() => setCurrentTab("catalogo")}
            verticalBadge="Tienda Oficial & E-Commerce"
          />
        </div>
      ) : (
        <>
          {/* Header / Banner de la Tienda */}
          <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-slate-900 border-b border-slate-800">
            <Image
              src={store.coverUrl}
              alt={store.name}
              fill
              className="object-cover opacity-40 blur-xs"
              priority
            />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>

        <div className="absolute bottom-4 left-4 right-4 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-xl bg-slate-900 shrink-0">
              <Image src={store.logoUrl} alt={store.name} fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  🛍️ Tienda Oficial
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  {store.address}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                {store.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2.5 transition-all"
            >
              <ShoppingBag className="w-4 h-4 text-slate-950" />
              <span>Mi Carrito</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 text-xs font-black flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-slate-800 py-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Categorías Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Todos los Productos ({allProducts.length})
            </button>
            {store.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {cat.name} ({cat.products.length})
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="mobile-ctalo-search"
              type="text"
              placeholder="Buscar por nombre o prenda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Productos */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
            <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No se encontraron productos</h3>
            <p className="text-slate-400 text-xs">
              Intenta con otro término de búsqueda o selecciona otra categoría.
            </p>
          </div>
        ) : (
          <div
            className={
              isView916
                ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            }
          >
            {filteredProducts.map((product) => {
              const prodAspect = getProductAspect(product);
              const isProd916 = prodAspect === "9:16";

              return (
                <div
                  key={product.id}
                  className="group rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div
                      className={`relative w-full overflow-hidden bg-slate-950 ${
                        isProd916 ? "aspect-[9/16]" : "aspect-square"
                      }`}
                    >
                      {(() => {
                        const imgs = parseDishImages(product.imageUrl);
                        const primary = imgs[0] || null;
                        const secondary = imgs[1] || null;

                        if (!primary) {
                          return (
                            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900/60 text-slate-600 gap-2">
                              <ShoppingBag className="w-10 h-10 opacity-40" />
                              <span className="text-xs font-semibold text-slate-500">Sin imagen</span>
                            </div>
                          );
                        }

                        return (
                          <>
                            <Image
                              src={primary}
                              alt={product.name}
                              fill
                              className={`object-cover transition-opacity duration-300 ${
                                secondary ? "group-hover:opacity-0" : "group-hover:scale-105 transition-transform"
                              }`}
                            />
                            {secondary && (
                              <Image
                                src={secondary}
                                alt={`${product.name} - reverso`}
                                fill
                                className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              />
                            )}
                            {imgs.length > 1 && (
                              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur border border-slate-700/80 text-amber-300 text-[10px] font-bold flex items-center gap-1 z-10 shadow-md">
                                <span>📷 {imgs.length} fotos</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {product.isNew && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                          Destacado
                        </span>
                      )}
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur border border-slate-700 text-amber-400 font-black text-xs sm:text-sm">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3.5 sm:p-5">
                      <h3 className="text-sm sm:text-base font-bold text-white mb-1 group-hover:text-amber-400 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-slate-400 text-[11px] sm:text-xs line-clamp-2 mb-3 leading-relaxed">
                          {product.description}
                        </p>
                      )}

                      {/* Previsualización de Variantes (Solo si tiene variantes habilitadas) */}
                      {product.hasVariants ? (
                        <div className="space-y-1.5 text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
                          {product.attribute1Options && product.attribute1Options.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-300">
                                {product.attribute1Name || "Presentación"}:
                              </span>
                              <span className="text-amber-400/90 truncate">
                                {product.attribute1Options.join(", ")}
                              </span>
                            </div>
                          )}
                          {product.attribute2Name && product.attribute2Options && product.attribute2Options.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-300">
                                {product.attribute2Name}:
                              </span>
                              <span className="text-slate-400 truncate">
                                {product.attribute2Options.join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400 font-medium border-t border-slate-800/80 pt-2.5 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Disponible para compra inmediata</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-5 pt-0">
                    {product.hasVariants ? (
                      <button
                        onClick={() => handleOpenProduct(product)}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2 group-hover:shadow-md cursor-pointer"
                      >
                        <span>Elegir {product.attribute1Name || "Opción"}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      (() => {
                        const currentQty = getProductCartQty(product.id);
                        return currentQty > 0 ? (
                          <div className="flex items-center justify-between bg-slate-950 border border-amber-500/50 rounded-xl p-1 px-2 shadow-inner">
                            <span className="text-[11px] font-bold text-amber-400 pl-1">
                              En carrito: <strong>{currentQty}</strong>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDirectAddToCart(product, -1)}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition active:scale-90"
                                title="Restar 1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center text-xs font-black text-white">{currentQty}</span>
                              <button
                                type="button"
                                onClick={() => handleDirectAddToCart(product, 1)}
                                className="p-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-90 font-bold"
                                title="Sumar 1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDirectAddToCart(product, 1)}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Agregar al Carrito</span>
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  )}

      {/* Modal para Selección de Variante Dinámica */}
      {activeProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6">
            <button
              onClick={() => setActiveProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabecera del modal: Galería de imágenes (1 a 3 fotos) + Info del producto */}
            {(() => {
              const modalAspect = getProductAspect(activeProduct);
              const isModal916 = modalAspect === "9:16";
              const modalImages = parseDishImages(activeProduct.imageUrl);
              const hasMultiple = modalImages.length > 1;
              const currentImg = modalImages[activeModalImgIdx] || modalImages[0] || null;

              return (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  {/* Contenedor de la Imagen / Carrusel */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`relative overflow-hidden bg-slate-950 border border-slate-800 shadow-md ${
                        isModal916 ? "w-28 sm:w-32 aspect-[9/16] rounded-2xl" : "w-28 sm:w-32 aspect-square rounded-2xl"
                      }`}
                    >
                      {currentImg ? (
                        <Image
                          src={currentImg}
                          alt={`${activeProduct.name} - ángulo ${activeModalImgIdx + 1}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-600">
                          <ShoppingBag className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Botones de navegación si hay más de 1 imagen */}
                      {hasMultiple && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalImgIdx((prev) => (prev > 0 ? prev - 1 : modalImages.length - 1));
                            }}
                            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/60 hover:bg-black/90 text-white transition cursor-pointer"
                            title="Foto anterior"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalImgIdx((prev) => (prev < modalImages.length - 1 ? prev + 1 : 0));
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/60 hover:bg-black/90 text-white transition cursor-pointer"
                            title="Siguiente foto"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Miniaturas de los ángulos si tiene 2 o 3 fotos */}
                    {hasMultiple && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {modalImages.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveModalImgIdx(i)}
                            className={`w-7 h-7 rounded-md overflow-hidden border transition cursor-pointer relative ${
                              activeModalImgIdx === i
                                ? "border-amber-400 ring-2 ring-amber-400/40"
                                : "border-slate-800 opacity-60 hover:opacity-100"
                            }`}
                            title={`Ver ${i === 0 ? "Frente" : i === 1 ? "Espalda" : "Detalle"}`}
                          >
                            <Image src={img} alt={`Ángulo ${i + 1}`} fill className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Nombre, precio, descripción e indicador de ángulo */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-1">{activeProduct.name}</h3>
                    <div className="text-xl font-black text-amber-400 mb-1">
                      ${activeProduct.price.toFixed(2)}
                    </div>
                    {hasMultiple && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full mb-2">
                        📷 {activeModalImgIdx === 0 ? "Frente / Principal" : activeModalImgIdx === 1 ? "Dorso / Espalda" : "Detalle extra"} ({activeModalImgIdx + 1}/{modalImages.length})
                      </div>
                    )}
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{activeProduct.description}</p>
                  </div>
                </div>
              );
            })()}

            {/* Selector de Atributo 1 (ej: Presentación, Volumen o Talla) */}
            {((activeProduct.attribute1Options && activeProduct.attribute1Options.length > 0) || (activeProduct.tallas && activeProduct.tallas.length > 0)) && (
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  1. Selecciona tu {activeProduct.attribute1Name || "Presentación"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(activeProduct.attribute1Options && activeProduct.attribute1Options.length > 0 ? activeProduct.attribute1Options : activeProduct.tallas || []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedOption1(opt);
                        setSelectedTalla(opt);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedOption1 === opt
                          ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Atributo 2 (ej: Temperatura o Color) */}
            {((activeProduct.attribute2Name && activeProduct.attribute2Options && activeProduct.attribute2Options.length > 0) || (activeProduct.colores && activeProduct.colores.length > 0)) && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  2. Selecciona {activeProduct.attribute2Name || "Color"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(activeProduct.attribute2Options && activeProduct.attribute2Options.length > 0 ? activeProduct.attribute2Options : activeProduct.colores || []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSelectedOption2(opt);
                        setSelectedColor(opt);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        selectedOption2 === opt
                          ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700"
                      }`}
                    >
                      <span className="w-2 rounded-full bg-current opacity-70"></span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Cantidad */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-5 mb-6">
              <span className="text-xs font-bold text-slate-400">Cantidad:</span>
              <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-white w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-slate-950" />
              <span>Añadir al Carrito (${(activeProduct.price * quantity).toFixed(2)})</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawer Deslizante del Carrito */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex w-full justify-end sm:pl-10">
            <div className="w-full sm:w-[460px] max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl p-5 sm:p-6 pb-32 sm:pb-12 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-white">Carrito de Compras</h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                      {totalCartCount} items
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Items del Carrito */}
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">Tu carrito está vacío</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Elige productos y variantes para comenzar tu pedido.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.cartId}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 gap-3"
                      >
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                          {(() => {
                            const cartThumb = getPrimaryDishImage(item.imageUrl) || item.imageUrl;
                            return cartThumb ? (
                              <Image src={cartThumb} alt={item.name} fill className="object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-slate-800 text-slate-500">
                                <ShoppingBag className="w-6 h-6 opacity-40" />
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                          {item.variantLabel ? (
                            <div className="text-[11px] text-amber-400 font-semibold mt-0.5 truncate">
                              {item.variantLabel}
                            </div>
                          ) : null}
                          <div className="text-xs font-black text-amber-400 mt-1">
                            ${(item.price * item.cantidad).toFixed(2)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <button
                            onClick={() => updateCartQty(item.cartId, -1)}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-white w-4 text-center">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.cartId, 1)}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario de Checkout Enriquecido */}
                {cart.length > 0 && (
                  <form onSubmit={handleCheckout} className="space-y-4 border-t border-slate-800 pt-4">
                    {/* Método de Pago */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-white uppercase tracking-wider block">
                          Método de Pago
                        </label>
                        <span className="text-[10px] text-slate-400">Selecciona cómo deseas pagar</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("efectivo")}
                          className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === "efectivo"
                              ? "border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-500/10"
                              : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <span className="text-lg">💵</span>
                          <span className="text-xs font-bold mt-1 text-white">Efectivo / Local</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("transferencia")}
                          className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            paymentMethod === "transferencia"
                              ? "border-amber-500 bg-amber-500/10 text-white shadow-md shadow-amber-500/10"
                              : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <QrCode className="h-5 w-5 text-amber-400" />
                          <span className="text-xs font-bold mt-1 text-white">QR Cobro (Deuna)</span>
                        </button>
                      </div>

                      {/* Explicación de Efectivo */}
                      {paymentMethod === "efectivo" && (
                        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl space-y-1 text-xs text-slate-400">
                          <p className="font-bold text-slate-300">Pago en efectivo o entrega local</p>
                          <p className="text-[11px] leading-relaxed text-slate-400">
                            Pagarás tu orden en el local al retirar o cuando recibas la entrega. El comercio coordinará los detalles contigo por WhatsApp.
                          </p>
                        </div>
                      )}

                      {/* Datos de Transferencia y QR Deuna */}
                      {paymentMethod === "transferencia" && (
                        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-center space-y-3">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 inline-block">
                            Pago Móvil o Transferencia Bancaria
                          </span>

                          {/* QR Deuna si está cargado en el panel admin */}
                          {(store.qrCobroUrl || store.paymentQrUrl) && (
                            <div className="space-y-2 pt-1">
                              <p className="text-[11px] text-slate-300">
                                Escanea este código con tu app de <strong>Deuna</strong> o banca móvil:
                              </p>
                              <div className="bg-white p-2.5 rounded-2xl max-w-[170px] mx-auto border border-slate-800 shadow-lg">
                                <img
                                  src={store.qrCobroUrl || store.paymentQrUrl || ""}
                                  alt="QR de Cobro Deuna"
                                  className="w-full h-auto aspect-square object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {/* Datos Bancarios si están configurados en el panel admin */}
                          {(store.bankName || store.bankAccountNumber) ? (
                            <div className="border-t border-slate-800/80 pt-3 text-left space-y-2 text-xs">
                              <p className="font-extrabold text-slate-300 border-b border-slate-850 pb-1 text-center uppercase tracking-wider text-[10px]">
                                Datos para Transferencia Bancaria
                              </p>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                                {store.bankName && (
                                  <>
                                    <span className="font-bold text-slate-400">Banco:</span>
                                    <span className="text-right font-medium text-white">{store.bankName}</span>
                                  </>
                                )}
                                {store.bankAccountType && (
                                  <>
                                    <span className="font-bold text-slate-400">Tipo:</span>
                                    <span className="text-right font-medium text-white">{store.bankAccountType}</span>
                                  </>
                                )}
                                {store.bankAccountNumber && (
                                  <>
                                    <span className="font-bold text-slate-400">Nro. Cuenta:</span>
                                    <div className="text-right flex items-center justify-end gap-1.5">
                                      <span className="font-bold text-amber-400 select-all">{store.bankAccountNumber}</span>
                                      <button
                                        type="button"
                                        onClick={handleCopyBankAccount}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                        title="Copiar número de cuenta"
                                      >
                                        {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                                {store.bankAccountName && (
                                  <>
                                    <span className="font-bold text-slate-400">Beneficiario:</span>
                                    <span className="text-right font-medium text-white truncate">{store.bankAccountName}</span>
                                  </>
                                )}
                                {store.bankAccountDocument && (
                                  <>
                                    <span className="font-bold text-slate-400">CI / RUC:</span>
                                    <span className="text-right font-medium text-white select-all">{store.bankAccountDocument}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : !(store.qrCobroUrl || store.paymentQrUrl) && (
                            <div className="py-2 text-slate-400 text-xs italic">
                              Coordinarás los datos de transferencia directamente al enviar el pedido por WhatsApp.
                            </div>
                          )}

                          <p className="text-[10px] text-slate-400 italic leading-relaxed pt-1 border-t border-slate-850">
                            📸 Recuerda tomar una captura de pantalla del comprobante de transferencia o pago y adjuntarla en el chat de WhatsApp al enviar tu orden.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Modalidad del Pedido */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
                        Modalidad del Pedido
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryMethod("domicilio")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                            deliveryMethod === "domicilio"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span>🛵 Domicilio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryMethod("retiro")}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                            deliveryMethod === "retiro"
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span>🏬 Retiro / Llevar</span>
                        </button>
                      </div>
                    </div>

                    {/* Selector de Zonas / Tarifas por KM */}
                    {deliveryMethod === "domicilio" && (
                      <div className="space-y-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                          <Truck className="w-4 h-4 text-amber-400" />
                          <span>Selecciona la Distancia de Envío (por KM):</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {kmRatesList.map((rate) => {
                            const isSelected = selectedKmRate?.id === rate.id;
                            const minRequired = rate.minOrder || 0;
                            return (
                              <button
                                key={rate.id}
                                type="button"
                                onClick={() => setSelectedKmRate(rate)}
                                className={`p-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-0.5 text-center transition cursor-pointer ${
                                  isSelected
                                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30"
                                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                                }`}
                              >
                                <span>{rate.label}</span>
                                <span className={`text-[11px] font-bold ${isSelected ? "text-slate-950 font-black" : "text-amber-400"}`}>
                                  ${rate.price.toFixed(2)}
                                </span>
                                {minRequired > 0 && (
                                  <span className={`text-[9.5px] font-medium ${isSelected ? "text-slate-900" : "text-amber-400/80"}`}>
                                    Mín: ${minRequired.toFixed(2)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {isMinOrderUnmet && (
                          <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-xs text-red-300 font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>
                              Consumo mínimo para <strong>{selectedKmRate?.label}</strong>: <strong>${selectedKmRate?.minOrder?.toFixed(2)}</strong>. Te faltan <strong>${((selectedKmRate?.minOrder || 0) - subtotal).toFixed(2)}</strong> en productos.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Datos del Cliente */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
                            Tu Nombre o Alias *
                          </label>
                          <span className="text-[9.5px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            requerido
                          </span>
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Juan Pérez"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
                            Tu Teléfono o WhatsApp *
                          </label>
                          <span className="text-[9.5px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            requerido
                          </span>
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="Ej. 0991234567"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Banner de Fidelización */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-emerald-300">
                      <span className="text-sm shrink-0">🛵</span>
                      <p className="text-[11px] text-emerald-200/90 leading-tight">
                        El repartidor te contactará a este WhatsApp y acumularás <strong>puntos de cliente</strong> en cada pedido.
                      </p>
                    </div>

                    {/* Dirección de Envío y Referencia + Botón GPS */}
                    {deliveryMethod === "domicilio" && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                              Dirección de Envío *
                            </label>
                            <button
                              type="button"
                              onClick={handleGetGpsLocation}
                              disabled={isLocating}
                              className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <Navigation className={`w-3 h-3 text-amber-400 ${isLocating ? "animate-spin" : ""}`} />
                              <span>{isLocating ? "Obteniendo GPS..." : "📍 Enviar mi ubicación actual (GPS)"}</span>
                            </button>
                          </div>
                          <textarea
                            required
                            rows={2}
                            placeholder="Escribe tu dirección exacta o presiona 'Enviar mi ubicación actual'..."
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                            Referencia / Lugar (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Hostal, tienda, casa color verde, lugar cercano..."
                            value={customerReference}
                            onChange={(e) => setCustomerReference(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Cupón de Descuento */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        ¿Tienes un cupón de descuento?
                      </label>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-xs text-emerald-300">
                          <div className="flex items-center gap-2 font-bold">
                            <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              Cupón <strong>{appliedCoupon.code}</strong> (-${discountAmount.toFixed(2)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedCoupon(null);
                              setInputCouponCode("");
                              setCouponError("");
                            }}
                            className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded-lg bg-slate-950 border border-red-500/20 text-[11px] active:scale-95 transition cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="EJ. BIENVENIDA10 O CUPÓN RULETA"
                              value={inputCouponCode}
                              onChange={(e) => {
                                setInputCouponCode(e.target.value.toUpperCase());
                                setCouponError("");
                              }}
                              className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-white font-mono font-bold uppercase focus:outline-none text-xs"
                            />
                            <button
                              type="button"
                              disabled={validatingCoupon || !inputCouponCode.trim()}
                              onClick={handleApplyCoupon}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-amber-400 font-extrabold text-xs rounded-xl border border-white/5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {validatingCoupon ? "Validando..." : "Aplicar"}
                            </button>
                          </div>
                          {couponError && (
                            <p className="text-[11px] text-red-400 font-semibold mt-1">⚠️ {couponError}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Propina para el personal */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Añadir propina para el personal
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setTipPercentage(pct)}
                            className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                              tipPercentage === pct
                                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {pct === 0 ? "Ninguna" : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notas opcionales */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Notas opcionales para la tienda
                      </label>
                      <input
                        type="text"
                        placeholder="Instrucciones para envolver regalo o entrega"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Resumen de Valores */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal Base ({totalCartCount} productos):</span>
                        <span className="font-bold text-slate-300">${subtotal.toFixed(2)}</span>
                      </div>

                      {appliedCoupon && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Descuento ({appliedCoupon.code}):</span>
                          <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                      )}

                      {store.taxRate && store.taxRate > 0 ? (
                        <div className="flex justify-between text-slate-400">
                          <span>IVA ({store.taxRate}%):</span>
                          <span className="text-slate-400">Incluido en el precio</span>
                        </div>
                      ) : null}

                      {store.serviceRate && store.serviceRate > 0 ? (
                        <div className="flex justify-between text-slate-400">
                          <span>Servicio ({store.serviceRate}%):</span>
                          <span className="text-slate-400">Incluido en el precio</span>
                        </div>
                      ) : null}

                      <div className="flex justify-between text-slate-400">
                        <span>Costo de Envío {deliveryMethod === "domicilio" && selectedKmRate ? `(${selectedKmRate.label})` : ""}:</span>
                        <span className="font-bold text-slate-300">{effectiveDeliveryCost > 0 ? `$${effectiveDeliveryCost.toFixed(2)}` : "Gratis"}</span>
                      </div>

                      {tipAmount > 0 && (
                        <div className="flex justify-between text-amber-300 font-bold">
                          <span>Propina ({tipPercentage}%):</span>
                          <span>${tipAmount.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-white font-black text-sm border-t border-slate-800 pt-2">
                        <span>TOTAL A PAGAR:</span>
                        <span className="text-amber-400 text-base">${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || isMinOrderUnmet}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Procesando...</span>
                      ) : (
                        <>
                          <span>Confirmar y Enviar Pedido</span>
                          <ArrowRight className="w-4 h-4 text-slate-950" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Bar for Mobile (One-Handed Experience) */}
      <div className={`fixed bottom-0 left-0 right-0 z-[100] md:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none transition-all duration-300 ${isCartOpen || activeProduct ? "opacity-0 translate-y-full pointer-events-none" : "opacity-100"}`}>
        <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto">
          {/* Tab 1: Inicio / Perfil */}
          <button
            onClick={() => {
              setCurrentTab("profile");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "profile" ? (store.themeColor || "#f59e0b") : "#94a3b8" }}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Inicio</span>
          </button>

          {/* Tab 2: Catálogo Productos */}
          <button
            onClick={() => {
              setCurrentTab("catalogo");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "catalogo" ? (store.themeColor || "#f59e0b") : "#94a3b8" }}
          >
            <Tag className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Catálogo</span>
          </button>

          {/* Tab 3: Buscar / Categorías */}
          <button
            onClick={() => {
              setCurrentTab("catalogo");
              setTimeout(() => {
                const searchEl = document.getElementById("mobile-ctalo-search");
                if (searchEl) {
                  searchEl.focus();
                  searchEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (typeof window !== "undefined") {
                  window.scrollTo({ top: 300, behavior: "smooth" });
                }
              }, 60);
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition duration-200 active:scale-95"
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Buscar</span>
          </button>

          {/* Tab 4: Carrito de Compras */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 relative transition duration-200 active:scale-95"
            style={{ color: isCartOpen ? (store.themeColor || "#f59e0b") : undefined }}
          >
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              {totalCartCount > 0 && (
                <span 
                  className="absolute -top-1.5 -right-2 h-4.5 min-w-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center text-slate-950 bg-amber-400 animate-pulse"
                >
                  {totalCartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              {totalCartCount > 0 ? `$${grandTotal.toFixed(2)}` : "Carrito"}
            </span>
          </button>
        </div>
      </div>

      {/* Pie de Página Comercial Ecosistema Ubícame & Ubícame.info */}
      <BusinessCompactFooter
        businessName={store.name}
        slug={store.slug}
        ubicameUrl={store.ubicameUrl}
        vertical="ctalo"
        showAffiliateCta={true}
      />

      {/* Floating Cart Button for Desktop (on Mobile, the Bottom Bar has it integrated) */}
      {cart.length > 0 && !isCartOpen && (
        <div className="hidden md:block fixed bottom-24 right-8 z-40 animate-bounce">
          <button
            onClick={() => setIsCartOpen(true)}
            className="px-6 py-3.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm shadow-2xl shadow-amber-500/40 flex items-center gap-3 hover:scale-105 transition-transform cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Ver Carrito ({totalCartCount})</span>
            <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-lg text-xs font-bold">
              ${grandTotal.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Floating WhatsApp Action Button */}
      <FloatingWhatsAppButton
        phone={store.whatsappNumber || store.whatsapp}
        businessName={store.name}
        customMessage={`¡Hola! Me gustaría información sobre los productos del catálogo de *${store.name}*.`}
        className={isCartOpen ? "hidden" : ""}
      />
    </div>
  );
}
