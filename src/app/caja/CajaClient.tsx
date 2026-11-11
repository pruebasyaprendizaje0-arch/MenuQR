"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  ArrowLeft,
  Barcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  Zap,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  Volume2,
  VolumeX,
  Keyboard,
  X,
  RefreshCw,
  Lock,
  Unlock,
  Receipt,
  Wallet,
  Coins,
  Store,
  Users,
  Bike,
  ShoppingBag,
  Landmark,
  Copy,
  Check,
  Search,
  Bell,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Scissors,
  PieChart,
  ShoppingCart,
  RotateCcw,
  SlidersHorizontal,
  UtensilsCrossed,
} from "lucide-react";
import {
  searchDishByBarcodeAction,
  createQuickDishFromBarcodeAction,
  processCajaEntryAction,
  processCajaSaleAction,
  settleOrderInCashShiftAction,
  getActiveCashShift,
  openCashShift,
  addCashMovement,
  closeCashShift,
  ScannedDishResult,
  SerializedCashShift,
  SerializedCashMovement,
} from "@/lib/caja-actions";
import { ReporteZTicketModal, ReporteZData } from "./components/ReporteZTicketModal";

export interface TouchDishModifierOption {
  id: string;
  name: string;
  extraPrice: number;
  isDefault: boolean;
}

export interface TouchDishModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: TouchDishModifierOption[];
}

export interface TouchDishItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  barcode: string | null;
  sku: string | null;
  stock: number | null;
  trackStock: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  modifierGroups?: TouchDishModifierGroup[];
}

export interface ActiveOrder {
  id: string;
  mesa?: string | null;
  estado: string;
  total: number;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  tipo_entrega?: string | null;
  solicita_mesero?: boolean;
  created_at: string;
  items: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    precio: number;
    notas?: string | null;
  }>;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface CartSessionItem {
  dishId: string;
  itemKey?: string;
  name: string;
  price: number;
  quantity: number;
  stock: number | null;
  trackStock: boolean;
  isAvailable?: boolean;
  barcode?: string | null;
  isBox?: boolean;
  modifiersNotes?: string;
}

interface DishItem {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  trackStock: boolean;
  isAvailable?: boolean;
  barcode?: string | null;
  isBox?: boolean;
}

interface CajaRestaurantProps {
  id: string;
  name: string;
  slug: string;
  themeColor?: string;
  qrCobroUrl?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  tablesConfig?: string | null;
  businessType?: string | null;
}

interface CajaClientProps {
  restaurant: CajaRestaurantProps;
  categories: CategoryItem[];
  initialShift?: SerializedCashShift | null;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
  dishes?: TouchDishItem[];
}

export function CajaClient({
  restaurant,
  categories,
  initialShift = null,
  currentUser,
  dishes = [],
}: CajaClientProps) {
  // Cash shift / Turno de caja state
  const [activeShift, setActiveShift] = useState<SerializedCashShift | null>(initialShift);
  const [isShiftOpenModalOpen, setIsShiftOpenModalOpen] = useState(!initialShift);
  const [initialCashInput, setInitialCashInput] = useState("0.00");
  const [shiftCashierName, setShiftCashierName] = useState(currentUser?.name || "Cajero Principal");

  // Movement modal state
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  // Close shift & Arqueo modal state
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState("");
  const [closeShiftNotes, setCloseShiftNotes] = useState("");
  const [reportModalData, setReportModalData] = useState<ReporteZData | null>(null);
  const [isDeunaVerified, setIsDeunaVerified] = useState(false);
  const [isTransferVerified, setIsTransferVerified] = useState(false);
  const [isCardVerified, setIsCardVerified] = useState(false);

  // Canales Operativos de POS (Opción 2 Split Screen)
  const [activeChannel, setActiveChannel] = useState<"MESAS" | "LLEVAR" | "DOMICILIO" | "TACTIL" | "SCANNER">("MESAS");

  // Mode: "VENTA" (Cobro) vs "ENTRADA" (Recepción de inventario)
  const [mode, setMode] = useState<"ENTRADA" | "VENTA">("VENTA");

  // Selected existing order to settle (Mesa, Llevar o Domicilio)
  const [selectedActiveOrder, setSelectedActiveOrder] = useState<ActiveOrder | null>(null);

  // Live active orders list
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Items en el ticket actual
  const [sessionItems, setSessionItems] = useState<CartSessionItem[]>([]);

  // Filtros del grid táctil
  const [touchCategory, setTouchCategory] = useState<string>("TODAS");
  const [touchSearch, setTouchSearch] = useState<string>("");

  // Modificadores de plato en Caja táctil
  const [customizingDish, setCustomizingDish] = useState<TouchDishItem | null>(null);
  const [customizingMods, setCustomizingMods] = useState<{ [groupId: string]: string[] }>({});
  const [customizingQty, setCustomizingQty] = useState(1);

  // Modalidad de destino del pedido en caja (Para Llevar / Mesa)
  const [saleModality, setSaleModality] = useState<"LLEVAR" | "MESA">("LLEVAR");
  const [saleTableNumber, setSaleTableNumber] = useState<string>("1");
  const [saleCustomerName, setSaleCustomerName] = useState<string>("");
  const [sendToKitchen, setSendToKitchen] = useState<boolean>(true);

  const configuredTables = useMemo(() => {
    if (!restaurant.tablesConfig) return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const splitted = restaurant.tablesConfig
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return splitted.length > 0 ? splitted : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  }, [restaurant.tablesConfig]);

  // Camera & Scanner State
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanCooldownRef = useRef(false);

  // Manual code input modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState("");

  // Payment method for sale
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "DEUNA" | "TRANSFERENCIA" | "TARJETA">("EFECTIVO");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");

  // Modales de Cobro con QR y Datos Bancarios
  const [showDeunaModal, setShowDeunaModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  // Split Pay Modal State (Dividir Cuenta / Pagos Mixtos)
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<"EQUAL" | "CUSTOM">("EQUAL");
  const [splitPeopleCount, setSplitPeopleCount] = useState<number>(2);
  const [splitPayments, setSplitPayments] = useState<
    Array<{
      id: string;
      payerName: string;
      amount: number;
      paymentMethod: "EFECTIVO" | "DEUNA" | "TRANSFERENCIA" | "TARJETA";
    }>
  >([]);
  const [customSplitAmount, setCustomSplitAmount] = useState<string>("");
  const [customSplitMethod, setCustomSplitMethod] = useState<"EFECTIVO" | "DEUNA" | "TRANSFERENCIA" | "TARJETA">("EFECTIVO");
  const [customSplitPayer, setCustomSplitPayer] = useState<string>("");

  // Success Confirmation modal
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    message: string;
    badge: string;
  } | null>(null);

  // Pending transition
  const [isPending, startTransition] = useTransition();

  // Color scheme helpers
  const isEntrada = mode === "ENTRADA";
  const themeBgGradient = isEntrada
    ? "from-slate-950 via-blue-950/20 to-slate-950"
    : "from-slate-950 via-emerald-950/20 to-slate-950";

  // Audio synthesizer Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50]);
      }
    } catch {}
  };

  const playErrorSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {}
  };

  // Cargar pedidos activos (Mesas, Llevar, Domicilio) en vivo
  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedidos?negocio_id=${restaurant.id}&activos=true`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.pedidos)) {
        setActiveOrders(data.pedidos);
      }
    } catch (e) {
      console.warn("[Caja POS] Error al consultar pedidos activos:", e);
    }
  }, [restaurant.id]);

  useEffect(() => {
    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 6000);
    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

  // Clasificación de pedidos por canal
  const { mesasOrders, llevarOrders, domicilioOrders } = useMemo(() => {
    const mesas: ActiveOrder[] = [];
    const llevar: ActiveOrder[] = [];
    const domicilio: ActiveOrder[] = [];

    activeOrders.forEach((o) => {
      const mesaStr = (o.mesa || "").trim().toUpperCase();
      let meta: any = {};
      try {
        meta = typeof (o as any).metadata === "string" ? JSON.parse((o as any).metadata) : ((o as any).metadata || {});
      } catch {}

      const isLlevar =
        mesaStr === "LLEVAR" ||
        mesaStr === "TAKEAWAY" ||
        mesaStr === "RETIRO" ||
        (o as any).tipo_entrega === "RETIRO" ||
        meta?.tipo_entrega === "RETIRO" ||
        meta?.tipo_pedido === "llevar";

      const isDelivery =
        !isLlevar && (
          mesaStr === "DELIVERY" ||
          mesaStr === "DOMICILIO" ||
          (o as any).tipo_entrega === "DOMICILIO" ||
          meta?.tipo_entrega === "DOMICILIO" ||
          meta?.tipo_pedido === "delivery" ||
          (o as any).vertical === "ctalo"
        );

      if (isDelivery) {
        domicilio.push(o);
      } else if (isLlevar) {
        llevar.push(o);
      } else if (mesaStr !== "" && mesaStr !== "CATALOGO") {
        mesas.push(o);
      }
    });

    return { mesasOrders: mesas, llevarOrders: llevar, domicilioOrders: domicilio };
  }, [activeOrders]);

  // Helper para seleccionar una mesa o pedido para cobro
  const handleSelectActiveOrder = (order: ActiveOrder) => {
    setSelectedActiveOrder(order);
    const convertedItems: CartSessionItem[] = order.items.map((it) => ({
      dishId: it.id,
      name: it.nombre,
      price: it.precio,
      quantity: it.cantidad,
      stock: 999,
      trackStock: false,
    }));
    setSessionItems(convertedItems);
    setCashReceivedInput("");
    playBeep();
  };

  // Deseleccionar orden y volver a venta libre
  const handleClearSelectedOrder = () => {
    setSelectedActiveOrder(null);
    setSessionItems([]);
    setCashReceivedInput("");
  };

  const openModifierModalForDish = (dish: TouchDishItem) => {
    setCustomizingDish(dish);
    setCustomizingQty(1);
    const initialMods: { [groupId: string]: string[] } = {};
    (dish.modifierGroups || []).forEach((grp) => {
      const defaults = grp.options.filter((o) => o.isDefault).map((o) => o.id);
      initialMods[grp.id] = defaults;
    });
    setCustomizingMods(initialMods);
  };

  const handleToggleCajaMod = (groupId: string, optionId: string, maxSelect: number) => {
    setCustomizingMods((prev) => {
      const currentList = prev[groupId] || [];
      const isSelected = currentList.includes(optionId);
      if (maxSelect === 1) {
        return {
          ...prev,
          [groupId]: isSelected ? [] : [optionId],
        };
      }
      if (isSelected) {
        return {
          ...prev,
          [groupId]: currentList.filter((id) => id !== optionId),
        };
      }
      if (maxSelect > 0 && currentList.length >= maxSelect) {
        return prev;
      }
      return {
        ...prev,
        [groupId]: [...currentList, optionId],
      };
    });
  };

  const isCajaCustomizationValid = useMemo(() => {
    if (!customizingDish || !customizingDish.modifierGroups) return true;
    for (const grp of customizingDish.modifierGroups) {
      if (grp.minSelect > 0) {
        const count = customizingMods[grp.id]?.length || 0;
        if (count < grp.minSelect) {
          return false;
        }
      }
    }
    return true;
  }, [customizingDish, customizingMods]);

  const cajaCustomizingUnitPrice = useMemo(() => {
    if (!customizingDish) return 0;
    let total = Number(customizingDish.price) || 0;
    for (const grp of customizingDish.modifierGroups || []) {
      const chosen = customizingMods[grp.id] || [];
      for (const opt of grp.options) {
        if (chosen.includes(opt.id)) {
          total += Number(opt.extraPrice) || 0;
        }
      }
    }
    return total;
  }, [customizingDish, customizingMods]);

  const handleConfirmCajaMods = () => {
    if (!customizingDish || !isCajaCustomizationValid) return;

    const allChosenIds: string[] = [];
    const notesParts: string[] = [];
    for (const grp of customizingDish.modifierGroups || []) {
      const chosenIds = customizingMods[grp.id] || [];
      const picked = grp.options.filter((o) => chosenIds.includes(o.id));
      if (picked.length > 0) {
        picked.forEach((p) => allChosenIds.push(p.id));
        const txt = picked
          .map((p) => `${p.name}${p.extraPrice > 0 ? ` (+$${p.extraPrice.toFixed(2)})` : ""}`)
          .join(", ");
        notesParts.push(`${grp.name}: ${txt}`);
      }
    }

    const modifierNote = notesParts.join(" · ");
    const sortedKey = allChosenIds.sort().join("_");
    const itemKey = `${customizingDish.id}_${sortedKey}`;
    const unitPrice = cajaCustomizingUnitPrice;
    const finalName = modifierNote ? `${customizingDish.name} [${modifierNote}]` : customizingDish.name;

    setSessionItems((prev) => {
      const existing = prev.find((i) => (i.itemKey || i.dishId) === itemKey);
      if (existing) {
        return prev.map((i) =>
          (i.itemKey || i.dishId) === itemKey ? { ...i, quantity: i.quantity + customizingQty } : i
        );
      }
      return [
        ...prev,
        {
          dishId: customizingDish.id,
          itemKey,
          name: finalName,
          price: unitPrice,
          quantity: customizingQty,
          stock: customizingDish.stock,
          trackStock: customizingDish.trackStock,
          modifiersNotes: modifierNote || undefined,
        },
      ];
    });

    setCustomizingDish(null);
    playBeep();
  };

  // Añadir un plato táctil al ticket de cobro
  const handleAddTouchDish = (dish: TouchDishItem) => {
    if (selectedActiveOrder) {
      if (!confirm("Tienes una mesa seleccionada en el ticket. ¿Deseas iniciar una Venta Rápida nueva?")) {
        return;
      }
      setSelectedActiveOrder(null);
      setSessionItems([]);
    }

    if (dish.modifierGroups && dish.modifierGroups.length > 0) {
      openModifierModalForDish(dish);
      return;
    }

    setSessionItems((prev) => {
      const existing = prev.find((i) => (i.itemKey || i.dishId) === dish.id);
      if (existing) {
        return prev.map((i) =>
          (i.itemKey || i.dishId) === dish.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: 1,
          stock: dish.stock,
          trackStock: dish.trackStock,
        },
      ];
    });
    playBeep();
  };

  // Cantidad controllers
  const changeItemQty = (keyOrDishId: string, delta: number) => {
    setSessionItems((prev) => {
      return prev
        .map((item) => {
          if ((item.itemKey || item.dishId) !== keyOrDishId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean) as CartSessionItem[];
    });
  };

  const removeItem = (keyOrDishId: string) => {
    setSessionItems((prev) => prev.filter((i) => (i.itemKey || i.dishId) !== keyOrDishId));
  };

  // Procesar lectura de código de barras (Cámara o Pistola Láser USB)
  const handleProcessBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    playBeep();
    setLastScannedCode(code);

    const res = await searchDishByBarcodeAction(restaurant.id, code);
    if (!res.found || !res.dish) {
      playErrorSound();
      alert(`Código de barras "${code}" no registrado en este negocio.`);
      return;
    }

    const dish = res.dish;

    // Si estamos en Modo Venta: advertir si stock es 0
    if (mode === "VENTA") {
      if (dish.trackStock && (dish.stock === null || dish.stock <= 0)) {
        playErrorSound();
        alert(`El producto "${dish.name}" se encuentra AGOTADO en bodega (Stock: 0).`);
        return;
      }
    }

    const qtyToAdd = res.isBox ? (res.unitsPerBox || 12) : 1;

    setSessionItems((prev) => {
      const existing = prev.find((i) => i.dishId === dish.id);
      if (existing) {
        return prev.map((i) =>
          i.dishId === dish.id ? { ...i, quantity: i.quantity + qtyToAdd } : i
        );
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          name: dish.name + (res.isBox ? ` (Caja x${res.unitsPerBox})` : ""),
          price: dish.price,
          quantity: qtyToAdd,
          stock: dish.stock,
          trackStock: dish.trackStock,
        },
      ];
    });
  };

  // Listener global de teclado para Pistola Láser USB / Bluetooth
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target.id !== "caja-laser-listener"
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleProcessBarcode(buffer.trim());
          buffer = "";
        }
        return;
      }

      if (e.key.length === 1) {
        if (diff > 120 && buffer.length > 0) {
          buffer = "";
        }
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, restaurant.id]);

  // Lector de Cámara con html5-qrcode para el canal SCANNER
  useEffect(() => {
    if (activeChannel !== "SCANNER") {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      return;
    }

    let active = true;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!active) return;
      const el = document.getElementById("caja-lector");
      if (!el) return;

      const scanner = new Html5Qrcode("caja-lector");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 160 } },
          (decoded) => {
            if (scanCooldownRef.current) return;
            scanCooldownRef.current = true;
            handleProcessBarcode(decoded);
            setTimeout(() => {
              scanCooldownRef.current = false;
            }, 1800);
          },
          () => {}
        )
        .catch((err) => {
          console.warn("[Caja Camera] Error:", err);
        });
    });

    return () => {
      active = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [activeChannel, mode, restaurant.id]);

  // Totales y Desglose de Envío
  const totalQuantity = sessionItems.reduce((acc, it) => acc + it.quantity, 0);
  const itemsSubtotal = sessionItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

  const selectedOrderDeliveryCost = useMemo(() => {
    if (!selectedActiveOrder) return 0;
    let meta: any = {};
    try {
      meta = typeof (selectedActiveOrder as any).metadata === "string"
        ? JSON.parse((selectedActiveOrder as any).metadata)
        : ((selectedActiveOrder as any).metadata || {});
    } catch {}
    if (typeof meta?.costo_envio === "number") return meta.costo_envio;
    const itemsSum = (selectedActiveOrder.items || []).reduce((acc, it) => acc + it.precio * it.cantidad, 0);
    const diff = selectedActiveOrder.total - itemsSum;
    return diff > 0.05 ? diff : 0;
  }, [selectedActiveOrder]);

  const totalAmount = selectedActiveOrder && selectedActiveOrder.total > 0
    ? selectedActiveOrder.total
    : itemsSubtotal + selectedOrderDeliveryCost;

  // Vuelto / Cambio en Efectivo
  const cashGivenNumber = parseFloat(cashReceivedInput) || 0;
  const cashChange = Math.max(0, cashGivenNumber - totalAmount);

  // Totales de Cuenta Dividida (Split Pay)
  const totalPaidInSplit = useMemo(() => {
    return splitPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [splitPayments]);

  const remainingBalanceInSplit = useMemo(() => {
    const rem = totalAmount - totalPaidInSplit;
    return rem > 0.009 ? Math.round(rem * 100) / 100 : 0;
  }, [totalAmount, totalPaidInSplit]);

  const equalQuota = useMemo(() => {
    if (splitPeopleCount <= 0) return 0;
    return Math.round((totalAmount / splitPeopleCount) * 100) / 100;
  }, [totalAmount, splitPeopleCount]);

  const handleOpenSplitModal = () => {
    if (sessionItems.length === 0 || totalAmount <= 0) {
      alert("El ticket no tiene valor para dividir.");
      return;
    }
    setCustomSplitAmount(remainingBalanceInSplit.toFixed(2));
    setCustomSplitPayer(`Persona ${splitPayments.length + 1}`);
    setIsSplitModalOpen(true);
  };

  const handleAddEqualPayment = (personIndex: number, method: "EFECTIVO" | "DEUNA" | "TRANSFERENCIA" | "TARJETA") => {
    const isLastPerson = splitPayments.length + 1 >= splitPeopleCount;
    const amountToCharge = isLastPerson ? remainingBalanceInSplit : Math.min(equalQuota, remainingBalanceInSplit);

    if (amountToCharge <= 0) return;

    setSplitPayments((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        payerName: `Persona ${personIndex}`,
        amount: Math.round(amountToCharge * 100) / 100,
        paymentMethod: method,
      },
    ]);
  };

  const handleAddCustomPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(customSplitAmount);
    if (isNaN(val) || val <= 0) {
      alert("Ingresa un monto válido mayor a $0.00");
      return;
    }
    if (val > remainingBalanceInSplit + 0.05) {
      alert(`El monto ingresado ($${val.toFixed(2)}) supera el saldo restante ($${remainingBalanceInSplit.toFixed(2)}).`);
      return;
    }

    const actualAmount = Math.min(val, remainingBalanceInSplit);
    const newPayments = [
      ...splitPayments,
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        payerName: customSplitPayer.trim() || `Abono #${splitPayments.length + 1}`,
        amount: Math.round(actualAmount * 100) / 100,
        paymentMethod: customSplitMethod,
      },
    ];

    setSplitPayments(newPayments);
    const newRem = Math.max(0, Math.round((totalAmount - newPayments.reduce((a, b) => a + b.amount, 0)) * 100) / 100);
    setCustomSplitAmount(newRem > 0 ? newRem.toFixed(2) : "");
    setCustomSplitPayer(`Persona ${newPayments.length + 1}`);
  };

  const handleRemoveSplitPayment = (id: string) => {
    setSplitPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const sendOrderToKitchenKDS = async (options: {
    mesaNumber?: string | null;
    tipoEntrega: "MOSTRADOR" | "RETIRO" | "SALON";
    clienteNombre: string;
    skipStockDeduction?: boolean;
  }) => {
    try {
      const itemsPayload = sessionItems.map((it) => ({
        dishId: it.dishId,
        id: it.dishId,
        nombre: it.name,
        cantidad: it.quantity,
        precio: it.price,
        notas: it.modifiersNotes || null,
      }));

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: restaurant.id,
          slug: restaurant.slug,
          mesa: options.mesaNumber || null,
          tipo_entrega: options.tipoEntrega,
          cliente_nombre: options.clienteNombre,
          skip_stock_deduction: options.skipStockDeduction ?? true,
          items: itemsPayload,
          total: totalAmount,
        }),
      });
      const data = await res.json();
      return data;
    } catch (kdsErr) {
      console.warn("[Caja POS] Error al enviar a cocina:", kdsErr);
      return null;
    }
  };

  const handleSendToKitchenOpenTable = async () => {
    if (sessionItems.length === 0) {
      alert("Agrega al menos un producto al ticket antes de enviar a cocina.");
      return;
    }
    if (saleModality === "MESA" && !saleTableNumber) {
      alert("Selecciona el número de mesa.");
      return;
    }

    startTransition(async () => {
      const targetMesa = saleModality === "MESA" ? saleTableNumber : null;
      const tipoEntrega = saleModality === "MESA" ? "SALON" : "RETIRO";
      const clienteNombre = saleModality === "MESA"
        ? `Mesa #${saleTableNumber}`
        : (saleCustomerName.trim() ? `${saleCustomerName.trim()} (Para Llevar)` : "Cliente (Para Llevar)");

      const kdsRes = await sendOrderToKitchenKDS({
        mesaNumber: targetMesa,
        tipoEntrega,
        clienteNombre,
        skipStockDeduction: false,
      });

      if (kdsRes && kdsRes.ok) {
        playBeep();
        setSuccessInfo({
          title: "¡Comanda enviada a Cocina!",
          message: `Comanda de ${clienteNombre} enviada exitosamente a la pantalla de Cocina (KDS). La mesa queda abierta para consumo.`,
          badge: `👨‍🍳 Cocina: ${clienteNombre}`,
        });
        setSessionItems([]);
        setSaleCustomerName("");
        fetchActiveOrders();
      } else {
        playErrorSound();
        alert(kdsRes?.error || "Error al enviar comanda a cocina.");
      }
    });
  };

  const handleCheckoutSplitTicket = async () => {
    if (splitPayments.length === 0) {
      alert("No se ha registrado ningún abono.");
      return;
    }

    if (remainingBalanceInSplit > 0.05) {
      alert(`Aún queda un saldo pendiente de $${remainingBalanceInSplit.toFixed(2)} por cobrar.`);
      return;
    }

    const dominantMethod = splitPayments[0]?.paymentMethod || "EFECTIVO";
    const splitDetailsPayload = splitPayments.map((p) => ({
      payerName: p.payerName,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
    }));

    const methodSummaries: Record<string, number> = {};
    splitPayments.forEach((p) => {
      methodSummaries[p.paymentMethod] = (methodSummaries[p.paymentMethod] || 0) + p.amount;
    });
    const summaryText = Object.entries(methodSummaries)
      .map(([m, val]) => `${m}: $${val.toFixed(2)}`)
      .join(" · ");

    if (selectedActiveOrder) {
      startTransition(async () => {
        const res = await settleOrderInCashShiftAction(restaurant.id, {
          orderId: selectedActiveOrder.id,
          mesa: selectedActiveOrder.mesa,
          total: totalAmount,
          paymentMethod: dominantMethod,
          customerName: selectedActiveOrder.cliente_nombre,
          splitDetails: splitDetailsPayload,
        });

        if (res.error) {
          playErrorSound();
          alert(res.error);
        } else {
          playBeep();
          setIsSplitModalOpen(false);
          setSplitPayments([]);
          const targetTitle = selectedActiveOrder.mesa
            ? `¡Mesa #${selectedActiveOrder.mesa} Cobrada y Dividida!`
            : "¡Pedido Cobrado y Dividido!";
          setSuccessInfo({
            title: targetTitle,
            message: `Cuenta de $${totalAmount.toFixed(2)} liquidada con ${splitPayments.length} abonos (${summaryText}). La mesa ha quedado liberada.`,
            badge: `✂️ Cuenta Dividida · $${totalAmount.toFixed(2)}`,
          });
          setSelectedActiveOrder(null);
          setSessionItems([]);
          fetchActiveOrders();
        }
      });
      return;
    }

    startTransition(async () => {
      const itemsPayload = sessionItems.map((it) => ({
        dishId: it.dishId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      }));

      const effectiveTableName = saleModality === "MESA"
        ? `Mesa #${saleTableNumber}`
        : "Para Llevar";

      const effectiveCustomerName = saleModality === "MESA"
        ? `Mesa #${saleTableNumber} (Split)`
        : (saleCustomerName.trim() ? `${saleCustomerName.trim()} (Para Llevar)` : `Para Llevar (Split)`);

      const res = await processCajaSaleAction(restaurant.id, {
        items: itemsPayload,
        paymentMethod: dominantMethod,
        customerName: effectiveCustomerName,
        tableName: effectiveTableName,
        splitDetails: splitDetailsPayload,
      });

      if (res.error) {
        playErrorSound();
        alert(res.error);
      } else {
        playBeep();

        if (sendToKitchen) {
          await sendOrderToKitchenKDS({
            mesaNumber: saleModality === "MESA" ? saleTableNumber : null,
            tipoEntrega: saleModality === "MESA" ? "SALON" : "RETIRO",
            clienteNombre: effectiveCustomerName,
            skipStockDeduction: true,
          });
        }

        setIsSplitModalOpen(false);
        setSplitPayments([]);
        setSuccessInfo({
          title: "¡Venta Dividida Completada!",
          message: `Ticket #${res.orderNumber} por $${res.total?.toFixed(2)} (${effectiveTableName}) pagado con ${splitPayments.length} abonos (${summaryText}).`,
          badge: `✂️ Split Pay: ${effectiveTableName} · $${res.total?.toFixed(2)}`,
        });
        setSessionItems([]);
        setSaleCustomerName("");
        fetchActiveOrders();
      }
    });
  };

  // Turnos de Caja (Apertura, Movimientos, Cierre)
  const handleOpenShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cash = Math.max(0, parseFloat(initialCashInput) || 0);
    startTransition(async () => {
      const res = await openCashShift({
        restaurantId: restaurant.id,
        openedById: currentUser?.id || "admin",
        openedByName: shiftCashierName.trim() || currentUser?.name || "Cajero Principal",
        initialCash: cash,
      });

      if (!res.success || !res.shift) {
        playErrorSound();
        alert(res.error || "Error al abrir turno de caja.");
      } else {
        playBeep();
        setActiveShift(res.shift);
        setIsShiftOpenModalOpen(false);
      }
    });
  };

  const handleAddMovement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeShift) {
      alert("No hay un turno de caja abierto.");
      return;
    }
    const amount = parseFloat(movementAmount) || 0;
    if (amount <= 0) {
      alert("El monto del movimiento debe ser mayor a 0.");
      return;
    }
    if (!movementReason.trim()) {
      alert("Debe indicar el motivo del movimiento de efectivo.");
      return;
    }

    startTransition(async () => {
      const res = await addCashMovement({
        shiftId: activeShift.id,
        type: movementType,
        amount,
        reason: movementReason.trim(),
        performedBy: currentUser?.name || "Cajero",
      });

      if (!res.success || !res.movement) {
        playErrorSound();
        alert(res.error || "Error al registrar movimiento.");
      } else {
        playBeep();
        const delta = movementType === "CASH_IN" ? amount : -amount;
        setActiveShift((prev) =>
          prev
            ? {
                ...prev,
                expectedCash: Math.round((prev.expectedCash + delta) * 100) / 100,
                movements: [...prev.movements, res.movement!],
              }
            : null
        );
        setIsMovementModalOpen(false);
        setMovementAmount("");
        setMovementReason("");
      }
    });
  };

  const handleOpenCloseShiftModal = async () => {
    if (!activeShift) return;
    try {
      const res = await getActiveCashShift(restaurant.id);
      if (res.success && res.shift) {
        setActiveShift(res.shift);
      }
    } catch (e) {
      console.error("Error refreshing active cash shift:", e);
    }
    setActualCashInput("");
    setIsDeunaVerified(false);
    setIsTransferVerified(false);
    setIsCardVerified(false);
    setIsCloseShiftModalOpen(true);
  };

  const handleCloseShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeShift) return;
    const actualCash = parseFloat(actualCashInput);
    if (isNaN(actualCash) || actualCash < 0) {
      alert("Debe ingresar el efectivo físico contado en cajón.");
      return;
    }

    // Generar tags de auditoría para los canales digitales verificados
    const verificationTags: string[] = [];
    if (activeShift.totalDeuna > 0) {
      verificationTags.push(isDeunaVerified ? "[DeUna: ✓ Verificado en App]" : "[DeUna: Pendiente]");
    }
    if (activeShift.totalTransfer > 0) {
      verificationTags.push(isTransferVerified ? "[Bancos: ✓ Verificado en Cuenta]" : "[Bancos: Pendiente]");
    }
    if (activeShift.totalCard > 0) {
      verificationTags.push(isCardVerified ? "[POS Tarjeta: ✓ Lote Verificado]" : "[POS Tarjeta: Pendiente]");
    }

    const baseNotes = closeShiftNotes.trim();
    const tagsString = verificationTags.join(" ");
    const combinedNotes = [baseNotes, tagsString].filter(Boolean).join(" | ");

    startTransition(async () => {
      const res = await closeCashShift({
        shiftId: activeShift.id,
        closedById: currentUser?.id || "admin",
        closedByName: currentUser?.name || "Cajero",
        actualCash,
        notes: combinedNotes || undefined,
      });

      if (!res.success || !res.report) {
        playErrorSound();
        alert(res.error || "Error al cerrar turno de caja.");
      } else {
        playBeep();
        setActiveShift(null);
        setIsCloseShiftModalOpen(false);
        setActualCashInput("");
        setCloseShiftNotes("");
        setIsDeunaVerified(false);
        setIsTransferVerified(false);
        setIsCardVerified(false);
        setReportModalData({
          ...res.report,
          businessName: restaurant.name,
        });
      }
    });
  };

  // Procesar Cobro Principal (Liquidación de Mesa o Venta Directa)
  const handleCheckoutTicket = async () => {
    if (sessionItems.length === 0) {
      alert("El ticket de cobro está vacío.");
      return;
    }

    // 0. Si estamos en Modo Devolución (Reingreso de existencias + salida de efectivo)
    if (mode === "ENTRADA") {
      startTransition(async () => {
        const entryItems = sessionItems.map((it) => ({
          dishId: it.dishId,
          quantity: it.quantity,
        }));

        const res = await processCajaEntryAction(restaurant.id, entryItems);
        if (res.error) {
          playErrorSound();
          alert(res.error);
          return;
        }

        // Si hay turno de caja abierto, registrar movimiento de salida de dinero
        if (activeShift) {
          await addCashMovement({
            shiftId: activeShift.id,
            type: "CASH_OUT",
            amount: totalAmount,
            reason: `Devolución de cliente (${sessionItems.map((i) => `${i.name} x${i.quantity}`).join(", ")})`,
            performedBy: currentUser?.name || "Cajero",
          });
        }

        playBeep();
        setSuccessInfo({
          title: "¡Devolución Procesada!",
          message: `Reingresadas ${totalQuantity} unidades al inventario. Reembolso de $${totalAmount.toFixed(2)} registrado en caja chica.`,
          badge: `↩️ Devolución de Stock · $${totalAmount.toFixed(2)}`,
        });
        setSessionItems([]);
      });
      return;
    }

    // 1. Si es liquidación de una mesa o pedido existente
    if (selectedActiveOrder) {
      startTransition(async () => {
        const res = await settleOrderInCashShiftAction(restaurant.id, {
          orderId: selectedActiveOrder.id,
          mesa: selectedActiveOrder.mesa,
          total: totalAmount,
          paymentMethod: paymentMethod === "TRANSFERENCIA" ? "TRANSFERENCIA" : paymentMethod,
          customerName: selectedActiveOrder.cliente_nombre,
        });

        if (res.error) {
          playErrorSound();
          alert(res.error);
        } else {
          playBeep();
          const targetTitle = selectedActiveOrder.mesa
            ? `¡Mesa #${selectedActiveOrder.mesa} Cobrada!`
            : "¡Pedido Cobrado!";
          setSuccessInfo({
            title: targetTitle,
            message: `Cobro de $${totalAmount.toFixed(2)} registrado con ${paymentMethod}. La mesa ha quedado liberada.`,
            badge: `✅ ${paymentMethod} · $${totalAmount.toFixed(2)}`,
          });
          setSelectedActiveOrder(null);
          setSessionItems([]);
          fetchActiveOrders();
        }
      });
      return;
    }

    // 2. Si es una Venta Directa / Rápida
    startTransition(async () => {
      const itemsPayload = sessionItems.map((it) => ({
        dishId: it.dishId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      }));

      const effectiveTableName = saleModality === "MESA"
        ? `Mesa #${saleTableNumber}`
        : "Para Llevar";

      const effectiveCustomerName = saleModality === "MESA"
        ? `Mesa #${saleTableNumber} (${paymentMethod})`
        : (saleCustomerName.trim() ? `${saleCustomerName.trim()} (Para Llevar)` : `Para Llevar (${paymentMethod})`);

      const res = await processCajaSaleAction(restaurant.id, {
        items: itemsPayload,
        paymentMethod: paymentMethod === "TRANSFERENCIA" ? "PAYPHONE" : paymentMethod,
        customerName: effectiveCustomerName,
        tableName: effectiveTableName,
      });

      if (res.error) {
        playErrorSound();
        alert(res.error);
      } else {
        playBeep();

        if (sendToKitchen) {
          await sendOrderToKitchenKDS({
            mesaNumber: saleModality === "MESA" ? saleTableNumber : null,
            tipoEntrega: saleModality === "MESA" ? "SALON" : "RETIRO",
            clienteNombre: effectiveCustomerName,
            skipStockDeduction: true,
          });
        }

        const kitchenNotice = sendToKitchen ? " Comanda enviada a Cocina (KDS)." : "";
        setSuccessInfo({
          title: "¡Venta Completada!",
          message: `Ticket #${res.orderNumber} por $${res.total?.toFixed(2)} (${effectiveTableName}) pagado con ${paymentMethod}.${kitchenNotice}`,
          badge: `⚡ Cobrado: ${effectiveTableName} · ${paymentMethod}`,
        });
        setSessionItems([]);
        setSaleCustomerName("");
        fetchActiveOrders();
      }
    });
  };

  // Filtrado de platos táctiles
  const filteredTouchDishes = useMemo(() => {
    return dishes.filter((d) => {
      const matchCat = touchCategory === "TODAS" || d.category?.name === touchCategory;
      const matchSearch =
        !touchSearch.trim() ||
        d.name.toLowerCase().includes(touchSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [dishes, touchCategory, touchSearch]);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeBgGradient} text-white flex flex-col font-sans selection:bg-amber-500 selection:text-black`}>
      {/* 1. HEADER POS SUPERIOR */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Admin</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>{restaurant.name}</span>
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                POS
              </span>
            </div>
          </div>

          {/* SESIÓN DE CAJA Y ARQUEO ACTIVO */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {activeShift ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl px-3 py-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-slate-300 font-bold">{activeShift.openedByName}</span>
                <span className="text-slate-500 hidden md:inline">|</span>
                <span className="text-slate-400 hidden md:inline text-[11px]">
                  Fondo: <strong className="text-emerald-400">${activeShift.initialCash.toFixed(2)}</strong> | Esp: <strong className="text-white">${activeShift.expectedCash.toFixed(2)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] transition"
                >
                  + / - Caja
                </button>
                <button
                  type="button"
                  onClick={handleOpenCloseShiftModal}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-[10px] border border-amber-500/40 transition flex items-center gap-1"
                >
                  <Receipt className="w-3 h-3" />
                  <span>Arqueo Z</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsShiftOpenModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Abrir Turno de Caja</span>
              </button>
            )}

            {/* SWITCH MODO DUAL (OPCIÓN 2): VENDER (SALIDA) VS DEVOLUCIÓN (REINGRESO) */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setMode("VENTA")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  mode === "VENTA"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Vender (Salida)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("ENTRADA")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  mode === "ENTRADA"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Devolución</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              title={soundEnabled ? "Silenciar pip" : "Activar sonido"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. CONTENEDOR PRINCIPAL: SPLIT SCREEN POS (Toast / Square) */}
      <div className="max-w-7xl w-full mx-auto p-3 sm:p-5 flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
        {/* COLUMNA IZQUIERDA (65%): CANALES, MESAS Y CATÁLOGO TÁCTIL */}
        <div className="flex-1 lg:w-7/12 xl:w-2/3 flex flex-col gap-4 min-w-0">
          {/* BARRA DE CANALES (Mesas, Llevar, Domicilio, Venta Táctil, Escáner) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setActiveChannel("MESAS")}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeChannel === "MESAS"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-black scale-102"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Mesas en Salón</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                mesasOrders.length > 0 ? "bg-amber-400 text-slate-950 font-black animate-pulse" : "bg-slate-800 text-slate-400"
              }`}>
                {mesasOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel("LLEVAR")}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeChannel === "LLEVAR"
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 font-black scale-102"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Para Llevar</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-black">
                {llevarOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel("DOMICILIO")}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeChannel === "DOMICILIO"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30 font-black scale-102"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>Domicilios</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-black">
                {domicilioOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel("TACTIL")}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeChannel === "TACTIL"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black scale-102"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Venta Táctil</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel("SCANNER")}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeChannel === "SCANNER"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 font-black scale-102"
                  : "bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800"
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Escáner Barcode</span>
            </button>
          </div>

          {/* ÁREA DE CONTENIDO SEGÚN CANAL */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-md flex flex-col min-h-[460px]">
            {/* CANAL: MESAS EN SALÓN */}
            {activeChannel === "MESAS" && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-base">Cuentas Abiertas en Salón</h3>
                    <span className="text-xs text-slate-400">Toca una mesa para cargar su cuenta al ticket</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchActiveOrders}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Actualizar mesas"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {mesasOrders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <Users className="w-12 h-12 text-slate-600" />
                    <p className="font-bold text-sm text-slate-300">No hay mesas con consumo activo en este momento</p>
                    <p className="text-xs text-slate-500">
                      Cuando un comensal o mesero tome una orden en el salón, figurará aquí con su total por cobrar.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 overflow-y-auto max-h-[560px] pr-1">
                    {mesasOrders.map((order) => {
                      const isSelected = selectedActiveOrder?.id === order.id;
                      const pideCuenta = order.solicita_mesero || order.estado === "por_pagar";

                      return (
                        <div
                          key={order.id}
                          onClick={() => handleSelectActiveOrder(order)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-md ${
                            isSelected
                              ? "bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40"
                              : pideCuenta
                              ? "bg-amber-950/30 border-amber-500/80 hover:bg-amber-950/50 animate-pulse"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-lg text-white">
                                  🪑 Mesa #{order.mesa}
                                </span>
                                {pideCuenta && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-slate-950 tracking-wider">
                                    ¡Pide Cuenta!
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {order.cliente_nombre ? `Comensal: ${order.cliente_nombre}` : "Consumo en mesa"}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xl font-mono font-black text-emerald-400">
                                ${order.total.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {order.items.length} plato(s)
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{order.estado === "por_pagar" ? "Listo para cobrar" : "Abierta"}</span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                              <span>Cobrar</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CANAL: PARA LLEVAR */}
            {activeChannel === "LLEVAR" && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-base">Pedidos para Llevar (Mostrador)</h3>
                  <button type="button" onClick={fetchActiveOrders} className="p-1.5 rounded-xl bg-slate-800">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {llevarOrders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <ShoppingBag className="w-12 h-12 text-slate-600" />
                    <p className="font-bold text-sm text-slate-300">No hay pedidos para llevar pendientes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto max-h-[560px]">
                    {llevarOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => handleSelectActiveOrder(order)}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-black text-base text-white">🥡 {order.cliente_nombre || "Cliente"}</span>
                            <span className="text-xs text-slate-400 block">{order.cliente_telefono || "Sin teléfono"}</span>
                          </div>
                          <span className="text-xl font-mono font-black text-cyan-400">${order.total.toFixed(2)}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-cyan-400 font-bold">
                          <span>{order.items.length} producto(s)</span>
                          <span>Cobrar al entregar →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CANAL: DOMICILIOS */}
            {activeChannel === "DOMICILIO" && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-base">Pedidos a Domicilio (Delivery)</h3>
                  <button type="button" onClick={fetchActiveOrders} className="p-1.5 rounded-xl bg-slate-800">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {domicilioOrders.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <Bike className="w-12 h-12 text-slate-600" />
                    <p className="font-bold text-sm text-slate-300">No hay pedidos a domicilio activos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto max-h-[560px]">
                    {domicilioOrders.map((order) => {
                      let meta: any = {};
                      try {
                        meta = typeof (order as any).metadata === "string" ? JSON.parse((order as any).metadata) : ((order as any).metadata || {});
                      } catch {}
                      const direccion = meta?.cliente_direccion || "";
                      const costoEnvio = typeof meta?.costo_envio === "number" ? meta.costo_envio : 0;

                      return (
                        <div
                          key={order.id}
                          onClick={() => handleSelectActiveOrder(order)}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 cursor-pointer transition flex flex-col justify-between gap-3 shadow-lg shadow-black/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-black text-base text-white flex items-center gap-1.5 truncate">
                                🛵 {order.cliente_nombre || "Cliente Domicilio"}
                              </span>
                              <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                                📞 {order.cliente_telefono || "Sin teléfono"}
                              </span>
                              {costoEnvio > 0 && (
                                <div className="mt-1">
                                  <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80 inline-flex items-center gap-1">
                                    🛵 Envío: +${costoEnvio.toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {direccion && (
                                <p className="text-[11px] text-amber-300/80 line-clamp-2 mt-1 bg-amber-950/20 p-1.5 rounded-lg border border-amber-900/30">
                                  📍 {direccion}
                                </p>
                              )}
                            </div>
                            <span className="text-xl font-mono font-black text-amber-400 shrink-0">
                              ${order.total.toFixed(2)}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-bold">
                            <span>{order.items.length} plato(s) / item(s)</span>
                            <span className="hover:underline">Cobrar / Despachar →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CANAL: VENTA TÁCTIL (GRID DE PLATOS) */}
            {activeChannel === "TACTIL" && (
              <div className="space-y-3.5 flex-1 flex flex-col">
                {/* Categorías y Buscador */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar plato o combo..."
                      value={touchSearch}
                      onChange={(e) => setTouchSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setTouchCategory("TODAS")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        touchCategory === "TODAS"
                          ? "bg-indigo-600 text-white font-black"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      Todas ({dishes.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setTouchCategory(cat.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                          touchCategory === cat.name
                            ? "bg-indigo-600 text-white font-black"
                            : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuadrícula Táctil */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-[520px] pr-1">
                  {filteredTouchDishes.map((dish) => (
                    <button
                      key={dish.id}
                      type="button"
                      onClick={() => handleAddTouchDish(dish)}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 text-left transition flex flex-col justify-between gap-2 group active:scale-95 shadow-sm"
                    >
                      <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 relative">
                        {dish.imageUrl ? (
                          <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-xs">
                            {dish.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-lg bg-black/80 text-[10px] font-bold text-white backdrop-blur-sm">
                          {dish.category?.name || "Plato"}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white line-clamp-2 leading-tight group-hover:text-indigo-300 transition">
                          {dish.name}
                        </h4>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-850">
                          <span className="text-sm font-mono font-black text-emerald-400">
                            ${dish.price.toFixed(2)}
                          </span>
                          <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-xs group-hover:bg-indigo-500 group-hover:text-white transition">
                            +
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CANAL: ESCÁNER DE CÓDIGO DE BARRAS */}
            {activeChannel === "SCANNER" && (
              <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
                <div className="w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-black border-2 border-rose-500/50 relative shadow-2xl flex flex-col items-center justify-center">
                  <div id="caja-lector" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-28 border-2 border-dashed border-rose-400 rounded-2xl flex items-center justify-center shadow-lg relative animate-pulse">
                      <div className="w-full h-0.5 bg-red-500 absolute shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    </div>
                    <p className="text-[11px] font-bold text-white mt-3 bg-black/70 px-3 py-1 rounded-full backdrop-blur-md">
                      Apunta al código de barras
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Keyboard className="w-4 h-4" />
                    <span>Digitar Código Manual</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (35%): TICKET DE COBRO & MÉTODOS DE PAGO */}
        <div className="w-full lg:w-5/12 xl:w-1/3 flex flex-col gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-md shrink-0 lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {/* CABECERA DEL TICKET */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className={`w-4 h-4 ${mode === "ENTRADA" ? "text-amber-400" : "text-emerald-400"}`} />
                <h3 className="font-black text-white text-base">
                  {mode === "ENTRADA"
                    ? "Ticket de Devolución"
                    : selectedActiveOrder?.mesa
                    ? `Mesa #${selectedActiveOrder.mesa}`
                    : selectedActiveOrder?.cliente_nombre
                    ? `Pedido: ${selectedActiveOrder.cliente_nombre}`
                    : "Ticket de Venta Directa"}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {mode === "ENTRADA"
                  ? "Reingreso de existencias a bodega"
                  : selectedActiveOrder
                  ? "Cobro de comanda en salón"
                  : saleModality === "MESA"
                  ? `Consumo en Mesa #${saleTableNumber}`
                  : "Pedido para llevar (empaque)"}
              </span>
            </div>

            {selectedActiveOrder && (
              <button
                type="button"
                onClick={handleClearSelectedOrder}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                title="Deseleccionar mesa"
              >
                <X className="w-3 h-3" />
                <span>Despejar</span>
              </button>
            )}
          </div>

          {/* SELECTOR DE MODALIDAD: PARA LLEVAR / MESA */}
          {!selectedActiveOrder && mode === "VENTA" && (
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span className="uppercase tracking-wider">Destino del Pedido:</span>
                <span className="text-emerald-400 font-mono text-[10px]">
                  {saleModality === "LLEVAR"
                    ? "🛍️ Para Llevar"
                    : `🪑 Mesa #${saleTableNumber}`}
                </span>
              </div>

              {/* 2 Botones de Selección */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSaleModality("LLEVAR")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 border ${
                    saleModality === "LLEVAR"
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 font-black"
                      : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Para Llevar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleModality("MESA")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 border ${
                    saleModality === "MESA"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-black"
                      : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Mesa en Salón</span>
                </button>
              </div>

              {/* Opciones según modalidad */}
              {saleModality === "MESA" && (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>Selecciona la Mesa:</span>
                    <span className="text-indigo-400 font-mono">Mesa #{saleTableNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {configuredTables.map((tbl) => (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => setSaleTableNumber(tbl)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 border ${
                          saleTableNumber === tbl
                            ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                            : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
                        }`}
                      >
                        #{tbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {saleModality === "LLEVAR" && (
                <div className="pt-1.5 border-t border-slate-800/80">
                  <input
                    type="text"
                    placeholder="Nombre del cliente para entrega (opcional)..."
                    value={saleCustomerName}
                    onChange={(e) => setSaleCustomerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Switch Enviar a Cocina (KDS) */}
              <label className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 cursor-pointer select-none">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
                  <span>Enviar comanda a Cocina (KDS)</span>
                </span>
                <input
                  type="checkbox"
                  checked={sendToKitchen}
                  onChange={(e) => setSendToKitchen(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* LISTA DE ITEMS DEL TICKET */}
          <div className="flex-1 space-y-2 min-h-[140px] max-h-[260px] overflow-y-auto pr-1">
            {sessionItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs space-y-1">
                <Receipt className="w-8 h-8 mx-auto text-slate-700" />
                <p>El ticket está vacío</p>
                <p className="text-[10px]">Selecciona una mesa o toca platos del catálogo</p>
              </div>
            ) : (
              sessionItems.map((item) => {
                const itemKey = item.itemKey || item.dishId;
                return (
                  <div
                    key={itemKey}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-white truncate leading-tight">{item.name}</h5>
                      {item.modifiersNotes && (
                        <p className="text-[10px] text-amber-400 font-medium line-clamp-1 mt-0.5">
                          {item.modifiersNotes}
                        </p>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        ${item.price.toFixed(2)} c/u
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!selectedActiveOrder && (
                        <button
                          type="button"
                          onClick={() => changeItemQty(itemKey, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                      <span className="w-6 text-center font-mono font-bold text-emerald-400">
                        {item.quantity}
                      </span>
                      {!selectedActiveOrder && (
                        <button
                          type="button"
                          onClick={() => changeItemQty(itemKey, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      <span className="w-14 text-right font-mono font-black text-white">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      {!selectedActiveOrder && (
                        <button
                          type="button"
                          onClick={() => removeItem(itemKey)}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESGLOSE TOTAL */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Productos ({totalQuantity}):</span>
              <span className="font-mono text-white">${itemsSubtotal.toFixed(2)}</span>
            </div>
            {selectedOrderDeliveryCost > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-300 bg-amber-950/20 px-2 py-1 rounded-lg border border-amber-800/40">
                <span className="flex items-center gap-1 font-semibold">🛵 Recargo de Envío (Delivery):</span>
                <span className="font-mono font-bold">+${selectedOrderDeliveryCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-850">
              <span className="font-bold text-sm text-white">TOTAL A COBRAR:</span>
              <span className="text-2xl font-mono font-black text-emerald-400">
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* SELECTOR DE FORMA DE PAGO */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Forma de Pago:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("EFECTIVO")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 justify-center ${
                  paymentMethod === "EFECTIVO"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-black shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("DEUNA");
                  setShowDeunaModal(true);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 justify-center ${
                  paymentMethod === "DEUNA"
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-black shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>QR DeUna</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("TRANSFERENCIA");
                  setShowTransferModal(true);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 justify-center ${
                  paymentMethod === "TRANSFERENCIA"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 font-black shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Landmark className="w-4 h-4 text-indigo-400" />
                <span>Transferencia</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("TARJETA")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 justify-center ${
                  paymentMethod === "TARJETA"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Tarjeta / POS</span>
              </button>
            </div>
          </div>

          {/* CALCULADORA DE CAMBIO EN EFECTIVO */}
          {paymentMethod === "EFECTIVO" && totalAmount > 0 && (
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Paga con (Efectivo):</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cashReceivedInput}
                  onChange={(e) => setCashReceivedInput(e.target.value)}
                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Botones de billetes rápidos */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCashReceivedInput(totalAmount.toFixed(2))}
                  className="py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-[10px] font-black transition truncate"
                  title={`Pagar monto exacto de $${totalAmount.toFixed(2)}`}
                >
                  Exacto (${totalAmount.toFixed(2)})
                </button>
                {[5, 10, 20].map((den) => (
                  <button
                    key={`bill-${den}`}
                    type="button"
                    onClick={() => setCashReceivedInput(den.toFixed(2))}
                    className="py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition"
                  >
                    ${den}.00
                  </button>
                ))}
              </div>

              {cashGivenNumber >= totalAmount && (
                <div className="pt-1 border-t border-slate-850 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">VUELTO / CAMBIO:</span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    ${cashChange.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BOTÓN DIVIDIR CUENTA / PAGO MIXTO (SPLIT PAY) */}
          {sessionItems.length > 0 && totalAmount > 0 && (
            <button
              type="button"
              onClick={handleOpenSplitModal}
              className="w-full py-2.5 px-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>Dividir Cuenta / Pagos Mixtos (Split Pay)</span>
              {splitPayments.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {splitPayments.length} {splitPayments.length === 1 ? "abono" : "abonos"}
                </span>
              )}
            </button>
          )}

          {/* BOTÓN SECUNDARIO: ENVIAR A COCINA Y DEJAR MESA ABIERTA */}
          {!selectedActiveOrder && mode === "VENTA" && saleModality === "MESA" && sessionItems.length > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleSendToKitchenOpenTable}
              className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/50 flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4 text-indigo-400" />
              <span>Enviar a Cocina (Dejar Mesa #{saleTableNumber} Abierta)</span>
            </button>
          )}

          {/* BOTÓN PRINCIPAL DE COBRO / DEVOLUCIÓN */}
          <button
            type="button"
            disabled={sessionItems.length === 0 || isPending}
            onClick={handleCheckoutTicket}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer ${
              mode === "ENTRADA"
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                : selectedActiveOrder
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
            }`}
          >
            {isPending ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : mode === "ENTRADA" ? (
              <>
                <RotateCcw className="w-5 h-5 stroke-[3]" />
                <span>Reingresar a Bodega & Devolver (${totalAmount.toFixed(2)})</span>
              </>
            ) : selectedActiveOrder ? (
              <>
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Cobrar y Liberar Mesa (${totalAmount.toFixed(2)})</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[3]" />
                <span>
                  {sendToKitchen ? "Cobrar y Enviar a Cocina" : "Cobrar Ticket"} (${totalAmount.toFixed(2)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL 0: DIGITAR CÓDIGO MANUAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCodeInput.trim()) {
                handleProcessBarcode(manualCodeInput.trim());
                setManualCodeInput("");
                setIsManualModalOpen(false);
              }
            }}
            className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-black text-white text-base flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-rose-400" />
                <span>Digitar Código Manual</span>
              </span>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Código de Barras o SKU:</label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ej. 7861012345678"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-md shadow-rose-600/30"
              >
                Buscar y Agregar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: QR DEUNA DE COBRO */}
      {showDeunaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-black text-white text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <span>Cobro con QR DeUna</span>
              </span>
              <button
                type="button"
                onClick={() => setShowDeunaModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-inner flex flex-col items-center justify-center">
              {restaurant.qrCobroUrl ? (
                <img
                  src={restaurant.qrCobroUrl}
                  alt="QR DeUna"
                  className="w-56 h-56 object-contain rounded-xl"
                />
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-800 p-4 border border-dashed border-slate-300 rounded-xl">
                  <QrCode className="w-16 h-16 text-cyan-600 mb-2" />
                  <span className="font-bold text-xs">QR no configurado</span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Sube tu código QR de DeUna en Admin → Restaurante
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400">Total exacto a escanear:</span>
              <div className="text-3xl font-mono font-black text-cyan-400">
                ${totalAmount.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-500">
                Pide al cliente que apunte su cámara desde la app DeUna o Banco Pichincha.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowDeunaModal(false);
                setPaymentMethod("DEUNA");
              }}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition"
            >
              Listo, Pago Verificado
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFERENCIA BANCARIA */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-black text-white text-base flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" />
                <span>Datos de Transferencia</span>
              </span>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Banco:</span>
                <strong className="text-white">{restaurant.bankName || "Banco Pichincha"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo de Cuenta:</span>
                <strong className="text-white">{restaurant.bankAccountType || "Ahorros"}</strong>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">Número de Cuenta:</span>
                  <strong className="text-white font-mono text-sm">
                    {restaurant.bankAccountNumber || "2205849301"}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (restaurant.bankAccountNumber) {
                      navigator.clipboard.writeText(restaurant.bankAccountNumber);
                      setCopiedBank(true);
                      setTimeout(() => setCopiedBank(false), 2500);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-[10px] flex items-center gap-1 hover:bg-indigo-600/50 transition"
                >
                  {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedBank ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Beneficiario:</span>
                <strong className="text-white truncate max-w-[170px]">
                  {restaurant.bankAccountName || restaurant.name}
                </strong>
              </div>
            </div>

            <div className="text-center">
              <span className="text-xs text-slate-400">Monto de la transferencia:</span>
              <div className="text-2xl font-mono font-black text-indigo-400">
                ${totalAmount.toFixed(2)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowTransferModal(false);
                setPaymentMethod("TRANSFERENCIA");
              }}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition"
            >
              Transferencia Comprobada
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: ÉXITO DE COBRO */}
      {successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-black text-white">{successInfo.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{successInfo.message}</p>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              {successInfo.badge}
            </span>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: APERTURA DE TURNO */}
      {isShiftOpenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleOpenShift}
            className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-black text-white text-lg">Apertura de Turno de Caja</h3>
              <p className="text-xs text-slate-400">Ingresa el fondo inicial de sencillo en cajón</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Cajero en Turno:</label>
              <input
                type="text"
                required
                value={shiftCashierName}
                onChange={(e) => setShiftCashierName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Fondo Inicial ($ Efectivo):</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={initialCashInput}
                onChange={(e) => setInitialCashInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/30"
            >
              {isPending ? "Abriendo..." : "Abrir Turno y Comenzar"}
            </button>
          </form>
        </div>
      )}

      {/* MODAL 5: CIERRE DE TURNO / ARQUEO Z (OPCIÓN 1 GUIADO TRANSPARENTE MULTICANAL) */}
      {isCloseShiftModalOpen && activeShift && (() => {
        const shiftCashIn = (activeShift.movements || [])
          .filter((m) => m.type === "CASH_IN")
          .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        const shiftCashOut = (activeShift.movements || [])
          .filter((m) => m.type === "CASH_OUT")
          .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
        const parsedCash = parseFloat(actualCashInput);
        const hasEnteredCash = !isNaN(parsedCash) && actualCashInput.trim() !== "";
        const cashDiff = hasEnteredCash ? Math.round((parsedCash - activeShift.expectedCash) * 100) / 100 : 0;
        const totalDigital = Math.round((activeShift.totalDeuna + activeShift.totalTransfer + activeShift.totalCard) * 100) / 100;
        const totalGlobalExpected = Math.round((activeShift.expectedCash + totalDigital) * 100) / 100;
        const totalGlobalDeclared = Math.round(((hasEnteredCash ? parsedCash : 0) + totalDigital) * 100) / 100;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
            <form
              onSubmit={handleCloseShift}
              className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl my-auto"
            >
              {/* Encabezado */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <h3 className="font-black text-white text-base sm:text-lg">
                      Arqueo de Caja y Cierre de Turno Z
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 pl-10">
                    Conciliación transparente: cuánto debe haber en <strong>Físico</strong>, <strong>DeUna QR</strong> y <strong>Transferencias</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid 3 Canales de Cobro */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* CANAL 1: EFECTIVO FÍSICO EN CAJÓN */}
                <div className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-wider">
                      <Banknote className="w-4 h-4" />
                      <span>1. Físico en Cajón</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      ${activeShift.expectedCash.toFixed(2)}
                    </span>
                  </div>

                  {/* Desglose rápido */}
                  <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fondo Inicial:</span>
                      <span className="text-slate-300">${activeShift.initialCash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">(+) Ventas Efec.:</span>
                      <span className="text-emerald-400 font-semibold">+${activeShift.totalCash.toFixed(2)}</span>
                    </div>
                    {shiftCashIn > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>(+) Entradas Caja:</span>
                        <span>+${shiftCashIn.toFixed(2)}</span>
                      </div>
                    )}
                    {shiftCashOut > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>(-) Salidas Caja:</span>
                        <span>-${shiftCashOut.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-white">
                      <span>Debe haber:</span>
                      <span className="text-emerald-400 text-sm">${activeShift.expectedCash.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Botón Cuadre Rápido */}
                  <button
                    type="button"
                    onClick={() => setActualCashInput(activeShift.expectedCash.toFixed(2))}
                    className="w-full py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] rounded-lg transition flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>Cuadrar Exacto (${activeShift.expectedCash.toFixed(2)})</span>
                  </button>

                  {/* Input Efectivo Contado */}
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                      <span>Efectivo Contado ($):</span>
                      <span className="text-amber-400 font-mono">billetes + monedas</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl font-mono text-base text-emerald-300 font-black focus:outline-none"
                    />
                  </div>

                  {/* Live Diferencia */}
                  {!hasEnteredCash ? (
                    <div className="text-[10px] text-slate-500 text-center py-1">
                      Cuenta el cajón e ingresa el total
                    </div>
                  ) : Math.abs(cashDiff) < 0.01 ? (
                    <div className="flex items-center justify-center gap-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold py-1.5 px-2 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Cuadre Perfecto ($0.00)</span>
                    </div>
                  ) : cashDiff < 0 ? (
                    <div className="flex items-center justify-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold py-1.5 px-2 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Faltante: -${Math.abs(cashDiff).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold py-1.5 px-2 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span>Sobrante: +${cashDiff.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* CANAL 2: DEUNA QR */}
                <div
                  className={`bg-slate-950/90 border ${
                    isDeunaVerified
                      ? "border-purple-500 shadow-lg shadow-purple-500/10 bg-purple-950/20"
                      : "border-slate-800"
                  } rounded-2xl p-4 flex flex-col justify-between space-y-3 transition`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 text-purple-400 font-black text-xs uppercase tracking-wider">
                      <QrCode className="w-4 h-4" />
                      <span>2. DeUna QR</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                      ${activeShift.totalDeuna.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Dinero cobrado por QR y acreditado directamente en tu cuenta y app <strong>DeUna Banco Pichincha</strong>.
                  </p>

                  <div className="py-2.5 px-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center space-y-0.5">
                    <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Debe reflejar en App DeUna</p>
                    <p className="text-2xl font-black font-mono text-purple-200">
                      ${activeShift.totalDeuna.toFixed(2)}
                    </p>
                  </div>

                  {/* Toggle Verificación */}
                  <button
                    type="button"
                    onClick={() => setIsDeunaVerified(!isDeunaVerified)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                      isDeunaVerified
                        ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {isDeunaVerified ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-purple-200" />
                        <span>✓ Verificado en App DeUna</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4 text-purple-400" />
                        <span>Verificar en App DeUna</span>
                      </>
                    )}
                  </button>

                  <div className="text-[10px] text-center text-slate-500">
                    {isDeunaVerified ? (
                      <span className="text-purple-300 font-semibold">Saldo comprobado en smartphone</span>
                    ) : (
                      <span>Abre tu app DeUna y confirma los cobros</span>
                    )}
                  </div>
                </div>

                {/* CANAL 3: TRANSFERENCIAS BANCARIAS */}
                <div
                  className={`bg-slate-950/90 border ${
                    isTransferVerified
                      ? "border-cyan-500 shadow-lg shadow-cyan-500/10 bg-cyan-950/20"
                      : "border-slate-800"
                  } rounded-2xl p-4 flex flex-col justify-between space-y-3 transition`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-black text-xs uppercase tracking-wider">
                      <Landmark className="w-4 h-4" />
                      <span>3. Transferencias</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      ${activeShift.totalTransfer.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pagos directos a tus cuentas de banco (Pichincha, Guayaquil, Pacífico, Produbanco, etc.).
                  </p>

                  <div className="py-2.5 px-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-center space-y-0.5">
                    <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Debe haber en Bancos</p>
                    <p className="text-2xl font-black font-mono text-cyan-200">
                      ${activeShift.totalTransfer.toFixed(2)}
                    </p>
                  </div>

                  {/* Toggle Verificación */}
                  <button
                    type="button"
                    onClick={() => setIsTransferVerified(!isTransferVerified)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                      isTransferVerified
                        ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {isTransferVerified ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                        <span>✓ Verificado en Cuentas</span>
                      </>
                    ) : (
                      <>
                        <Landmark className="w-4 h-4 text-cyan-400" />
                        <span>Verificar en Cuentas Bancarias</span>
                      </>
                    )}
                  </button>

                  <div className="text-[10px] text-center text-slate-500">
                    {isTransferVerified ? (
                      <span className="text-cyan-300 font-semibold">Transferencias bancarias confirmadas</span>
                    ) : (
                      <span>Revisa los comprobantes y extracto bancario</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CANAL 4: TARJETA / POS (SI APLICA) */}
              {activeShift.totalCard > 0 && (
                <div className="flex flex-wrap items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        4. Tarjetas / Terminal POS: <span className="font-mono text-amber-300">${activeShift.totalCard.toFixed(2)}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">Verifica el total de vouchers y cierre de lote en la máquina POS Datafast</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCardVerified(!isCardVerified)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      isCardVerified
                        ? "bg-amber-500 text-slate-950 border-amber-300"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {isCardVerified && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isCardVerified ? "✓ Lote POS Verificado" : "Verificar Lote POS"}</span>
                  </button>
                </div>
              )}

              {/* Barra de Resumen Global */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Ventas Totales</span>
                    <span className="text-sm font-black font-mono text-white">${activeShift.totalSales.toFixed(2)}</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Esperado (Físico + Digital)</span>
                    <span className="text-sm font-black font-mono text-amber-400">${totalGlobalExpected.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Declarado / Contado</span>
                  <span className="text-sm font-black font-mono text-emerald-400">${totalGlobalDeclared.toFixed(2)}</span>
                </div>
              </div>

              {/* Notas u observaciones */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Notas / Observaciones del Cierre (opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. Billetes de $20 entregados a gerencia, depósito nocturno..."
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !hasEnteredCash}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cerrando Turno...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Confirmar Cierre Z y Generar Reporte</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL MODIFICADORES & EXTRAS PARA CAJA POS */}
      {customizingDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-tight">Personalizar Plato</h3>
                  <p className="text-xs text-slate-400">{customizingDish.name} · Base ${customizingDish.price.toFixed(2)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingDish(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Groups list */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {(customizingDish.modifierGroups || []).map((grp) => {
                const chosen = customizingMods[grp.id] || [];
                return (
                  <div key={grp.id} className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        {grp.name}
                        {grp.required && <span className="text-rose-400 font-black text-xs">*</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                        {grp.maxSelect === 1 ? "Elige 1 opción" : `Hasta ${grp.maxSelect} opciones`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {grp.options.map((opt) => {
                        const isSelected = chosen.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleCajaMod(grp.id, opt.id, grp.maxSelect)}
                            className={`p-2.5 rounded-xl text-left transition flex items-center justify-between border ${
                              isSelected
                                ? "bg-amber-500/20 border-amber-500 text-white font-bold shadow-sm"
                                : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs">{opt.name}</span>
                            {opt.extraPrice > 0 ? (
                              <span className="text-[11px] font-mono text-amber-400 font-bold ml-1.5">
                                +${opt.extraPrice.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 ml-1.5">Gratis</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with Qty & Confirm */}
            <div className="pt-3 border-t border-slate-800 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Cantidad:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomizingQty((q) => Math.max(1, q - 1))}
                    disabled={customizingQty <= 1}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center font-black"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-white text-sm">
                    {customizingQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomizingQty((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={!isCajaCustomizationValid}
                onClick={handleConfirmCajaMods}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  Añadir al Ticket (${(cajaCustomizingUnitPrice * customizingQty).toFixed(2)})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: MOVIMIENTO DE EFECTIVO (+ / - CAJA) */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleAddMovement}
            className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-white text-base">Movimiento de Efectivo</h3>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMovementType("CASH_OUT")}
                className={`py-2 rounded-xl text-xs font-bold transition ${
                  movementType === "CASH_OUT"
                    ? "bg-rose-500/20 border border-rose-500 text-rose-300 font-black"
                    : "bg-slate-950 border border-slate-800 text-slate-400"
                }`}
              >
                Retiro / Salida (-)
              </button>
              <button
                type="button"
                onClick={() => setMovementType("CASH_IN")}
                className={`py-2 rounded-xl text-xs font-bold transition ${
                  movementType === "CASH_IN"
                    ? "bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-black"
                    : "bg-slate-950 border border-slate-800 text-slate-400"
                }`}
              >
                Ingreso / Entrada (+)
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Monto ($):</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Motivo del Movimiento:</label>
              <input
                type="text"
                required
                placeholder="Ej. Pago a proveedor de gas, cambio..."
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition"
              >
                Guardar Movimiento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 7: TICKET TÉRMICO REPORTE Z */}
      {reportModalData && (
        <ReporteZTicketModal
          report={reportModalData}
          onClose={() => setReportModalData(null)}
        />
      )}

      {/* MODAL 8: DIVIDIR CUENTA & PAGOS MIXTOS (SPLIT PAY) */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>Dividir Cuenta & Pagos Mixtos</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {selectedActiveOrder?.mesa
                      ? `Mesa #${selectedActiveOrder.mesa} · ${selectedActiveOrder.cliente_nombre || "Clientes en Salón"}`
                      : "Ticket de Venta Directa en Caja"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total, Pagado y Restante con Barra de Progreso */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Ticket</span>
                  <span className="text-base sm:text-lg font-mono font-black text-white">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Abonado</span>
                  <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                    ${totalPaidInSplit.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Por Cobrar</span>
                  <span
                    className={`text-base sm:text-lg font-mono font-black ${
                      remainingBalanceInSplit <= 0.01 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    ${remainingBalanceInSplit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Progreso de recaudación</span>
                  <span>
                    {totalAmount > 0
                      ? Math.min(100, Math.round((totalPaidInSplit / totalAmount) * 100))
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      remainingBalanceInSplit <= 0.01 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    style={{
                      width: `${totalAmount > 0 ? Math.min(100, (totalPaidInSplit / totalAmount) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Pestañas: Partes Iguales vs Pago Mixto / Libre */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSplitMode("EQUAL")}
                className={`py-2 rounded-xl transition flex items-center justify-center gap-2 ${
                  splitMode === "EQUAL"
                    ? "bg-amber-500 text-slate-950 font-black shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Partes Iguales ({splitPeopleCount} pers.)</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("CUSTOM")}
                className={`py-2 rounded-xl transition flex items-center justify-center gap-2 ${
                  splitMode === "CUSTOM"
                    ? "bg-amber-500 text-slate-950 font-black shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span>Montos Libres / Mixto</span>
              </button>
            </div>

            {/* CONTENIDO MODO 1: PARTES IGUALES */}
            {splitMode === "EQUAL" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-300 font-bold">Dividir entre cuántas personas:</span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={`split-people-${num}`}
                        type="button"
                        onClick={() => setSplitPeopleCount(num)}
                        className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition ${
                          splitPeopleCount === num
                            ? "bg-amber-400 text-slate-950 shadow-md scale-105"
                            : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-amber-200">
                    Cuota por persona ({splitPeopleCount} partes):
                  </span>
                  <span className="font-mono font-black text-amber-300 text-base">
                    ${equalQuota.toFixed(2)} c/u
                  </span>
                </div>

                {/* Lista interactiva de personas para cobrar cuota */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {Array.from({ length: splitPeopleCount }).map((_, idx) => {
                    const personNum = idx + 1;
                    const paidItem = splitPayments.find((p) => p.payerName === `Persona ${personNum}`);
                    const isFullyPaid = !!paidItem;

                    return (
                      <div
                        key={`person-row-${personNum}`}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                          isFullyPaid
                            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                            : "bg-slate-950 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-black text-[11px] text-white">
                            {personNum}
                          </span>
                          <div>
                            <span className="font-bold text-white block">Persona {personNum}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {isFullyPaid
                                ? `Cobrado: $${paidItem.amount.toFixed(2)} (${paidItem.paymentMethod})`
                                : `Cuota: $${equalQuota.toFixed(2)}`}
                            </span>
                          </div>
                        </div>

                        {isFullyPaid ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>Pagado</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitPayment(paidItem.id)}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                              title="Anular abono"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAddEqualPayment(personNum, "EFECTIVO")}
                              className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="Cobrar en Efectivo"
                            >
                              <Banknote className="w-3 h-3" />
                              <span>Efectivo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddEqualPayment(personNum, "DEUNA")}
                              className="px-2 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="Cobrar con DeUna"
                            >
                              <Smartphone className="w-3 h-3" />
                              <span>DeUna</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddEqualPayment(personNum, "TRANSFERENCIA")}
                              className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="Cobrar por Transferencia"
                            >
                              <Landmark className="w-3 h-3" />
                              <span>Transf</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddEqualPayment(personNum, "TARJETA")}
                              className="px-2 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center gap-1"
                              title="Cobrar con Tarjeta"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Tarjeta</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CONTENIDO MODO 2: MONTOS LIBRES / PAGO MIXTO */}
            {splitMode === "CUSTOM" && (
              <form onSubmit={handleAddCustomPayment} className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Monto a abonar ($):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={customSplitAmount}
                        onChange={(e) => setCustomSplitAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Nombre / Identificador (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Juan, Amigo 1..."
                      value={customSplitPayer}
                      onChange={(e) => setCustomSplitPayer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Atajos de montos rápidos */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-slate-500">Sugerencias:</span>
                  <button
                    type="button"
                    onClick={() => setCustomSplitAmount(remainingBalanceInSplit.toFixed(2))}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] border border-amber-500/30"
                  >
                    Restante (${remainingBalanceInSplit.toFixed(2)})
                  </button>
                  {remainingBalanceInSplit > 1 && (
                    <button
                      type="button"
                      onClick={() => setCustomSplitAmount((remainingBalanceInSplit / 2).toFixed(2))}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-[10px] border border-slate-800"
                    >
                      50% (${(remainingBalanceInSplit / 2).toFixed(2)})
                    </button>
                  )}
                  {[5, 10, 20].map((v) => (
                    <button
                      key={`custom-preset-${v}`}
                      type="button"
                      onClick={() => setCustomSplitAmount(v.toFixed(2))}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-[10px] border border-slate-800"
                    >
                      ${v}
                    </button>
                  ))}
                </div>

                {/* Selector de Método para este Abono */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Método de pago del abono:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                    {[
                      { id: "EFECTIVO", label: "Efectivo", icon: Banknote },
                      { id: "DEUNA", label: "DeUna", icon: Smartphone },
                      { id: "TRANSFERENCIA", label: "Transf", icon: Landmark },
                      { id: "TARJETA", label: "Tarjeta", icon: CreditCard },
                    ].map((m) => {
                      const Icon = m.icon;
                      const isSelected = customSplitMethod === m.id;
                      return (
                        <button
                          key={`custom-pm-${m.id}`}
                          type="button"
                          onClick={() => setCustomSplitMethod(m.id as any)}
                          className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                            isSelected
                              ? "bg-slate-850 border-amber-400 text-white shadow"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[10px]">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!customSplitAmount || parseFloat(customSplitAmount) <= 0}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Registrar Abono de Pago</span>
                </button>
              </form>
            )}

            {/* TABLA DE ABONOS REGISTRADOS */}
            {splitPayments.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Abonos Registrados ({splitPayments.length}):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {splitPayments.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300">
                          {p.paymentMethod}
                        </span>
                        <span className="font-bold text-white">{p.payerName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          ${p.amount.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitPayment(p.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition"
                          title="Eliminar este abono"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FOOTER: BOTÓN DE FINALIZAR */}
            <div className="pt-2 border-t border-slate-800">
              {remainingBalanceInSplit > 0.05 ? (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-xs text-amber-400 font-bold block">
                    Faltan ${remainingBalanceInSplit.toFixed(2)} por registrar
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Registra los abonos restantes para habilitar la liquidación final de la cuenta.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleCheckoutSplitTicket}
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider transition shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Procesando Cobro Dividido...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>
                        {selectedActiveOrder
                          ? `Finalizar y Liberar Mesa ($${totalAmount.toFixed(2)})`
                          : `Finalizar Venta Dividida ($${totalAmount.toFixed(2)})`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CajaClient;
