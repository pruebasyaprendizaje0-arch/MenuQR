"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
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
  Volume2,
  VolumeX,
  Keyboard,
  X,
  RefreshCw,
} from "lucide-react";
import {
  searchDishByBarcodeAction,
  createQuickDishFromBarcodeAction,
  processCajaEntryAction,
  processCajaSaleAction,
  ScannedDishResult,
} from "@/lib/caja-actions";

interface DishItem {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  trackStock: boolean;
  isAvailable?: boolean;
  barcode: string | null;
  imageUrl: string | null;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface CartSessionItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number | null;
  trackStock: boolean;
  isAvailable?: boolean;
  barcode?: string | null;
  isBox?: boolean;
}

interface CajaClientProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
  };
  categories: CategoryItem[];
}

export function CajaClient({ restaurant, categories }: CajaClientProps) {
  // Mode: "ENTRADA" (Recibir, azul) vs "VENTA" (Cobrar, verde)
  const [mode, setMode] = useState<"ENTRADA" | "VENTA">("VENTA");

  // Scanned items in current session
  const [sessionItems, setSessionItems] = useState<CartSessionItem[]>([]);

  // Camera & Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanCooldownRef = useRef(false);

  // Manual code input modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState("");

  // Box detection modal
  const [boxModalData, setBoxModalData] = useState<{
    dish: DishItem;
    defaultUnits: number;
    barcode: string;
  } | null>(null);
  const [boxUnitsInput, setBoxUnitsInput] = useState("12");

  // New product registration modal
  const [newProductModalCode, setNewProductModalCode] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("1.00");
  const [newProductCategory, setNewProductCategory] = useState(categories[0]?.id || "");
  const [newProductIsBox, setNewProductIsBox] = useState(false);
  const [newProductUnitsPerBox, setNewProductUnitsPerBox] = useState("12");

  // Payment method for sale
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "DEUNA" | "TARJETA">("EFECTIVO");

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
  const themeAccentBorder = isEntrada ? "border-blue-500/40" : "border-emerald-500/40";
  const themeTextAccent = isEntrada ? "text-blue-400" : "text-emerald-400";
  const themePrimaryButton = isEntrada
    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 border-blue-400/40"
    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 border-emerald-400/40";

  // Audio synthesizer using Web Audio API (zero latency, no external mp3 files required)
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz clean crisp pip
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
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, ctx.currentTime); // 240Hz warning buzzer
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {}
  };

  const handleBarcodeScannedRef = useRef<(code: string) => void>(() => {});

  // Function to initialize or restart camera scanner
  const startCamera = async () => {
    setScannerError(null);
    try {
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        location.protocol !== "https:" &&
        location.hostname !== "localhost"
      ) {
        setScannerError(
          "La cámara requiere conexión HTTPS segura (https://...) para operar en dispositivos móviles."
        );
        setIsScanning(false);
        return;
      }

      const scannerId = "caja-lector";
      const container = document.getElementById(scannerId);
      if (!container) {
        console.warn("Contenedor #caja-lector no encontrado en el DOM");
        return;
      }

      // Stop existing instance if running
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop().catch(() => {});
        }
        try {
          scannerRef.current.clear();
        } catch {}
      }

      const qr = new Html5Qrcode(scannerId);
      scannerRef.current = qr;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      };

      try {
        await qr.start(
          { facingMode: "environment" },
          config,
          (decodedText) => handleBarcodeScannedRef.current(decodedText),
          () => {}
        );
      } catch (camErr) {
        console.warn("Intento con facingMode environment falló, buscando cámaras disponibles:", camErr);
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cameras && cameras.length > 0) {
          const selectedCam =
            cameras.find((c) => /back|rear|trasera|environment/i.test(c.label)) ||
            cameras[cameras.length - 1];
          await qr.start(
            selectedCam.id,
            config,
            (decodedText) => handleBarcodeScannedRef.current(decodedText),
            () => {}
          );
        } else {
          throw camErr;
        }
      }

      setIsScanning(true);
      setScannerError(null);
    } catch (err: any) {
      console.warn("Error starting html5-qrcode camera:", err);
      setIsScanning(false);
      const msg = err?.message || String(err);
      if (
        msg.includes("Permissions policy") ||
        msg.includes("Permission denied") ||
        msg.includes("NotAllowedError")
      ) {
        setScannerError(
          "Permiso de cámara bloqueado en el navegador móvil. Revisa los permisos de tu navegador o usa el botón ⌨️."
        );
      } else {
        setScannerError(
          "Cámara no disponible o permiso denegado. Puedes escribir los códigos manualmente con el botón ⌨️."
        );
      }
    }
  };

  // Start Camera Scanner on mount
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
          });
        }
      }
    };
  }, []);

  // Handle scanned barcode
  const handleBarcodeScanned = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    // Prevent double scan trigger within 1.2s for identical code
    if (scanCooldownRef.current && lastScannedCode === clean) {
      return;
    }

    scanCooldownRef.current = true;
    setLastScannedCode(clean);
    setTimeout(() => {
      scanCooldownRef.current = false;
    }, 1200);

    // Call server action to search product
    startTransition(async () => {
      const res: ScannedDishResult = await searchDishByBarcodeAction(restaurant.id, clean);

      if (res.found && res.dish) {
        if (res.isBox) {
          // Detected box barcode! Open box confirmation modal
          playBeep();
          setBoxUnitsInput(String(res.unitsPerBox || 12));
          setBoxModalData({
            dish: res.dish,
            defaultUnits: res.unitsPerBox || 12,
            barcode: clean,
          });
        } else {
          // Direct unit product match!
          addOrIncrementDish(res.dish, 1);
          playBeep();
        }
      } else {
        // Product not registered yet! Open quick registration modal
        playErrorSound();
        setNewProductModalCode(clean);
        setNewProductName("");
        setNewProductPrice("1.00");
        setNewProductIsBox(false);
        setNewProductUnitsPerBox("12");
      }
    });
  };
  handleBarcodeScannedRef.current = handleBarcodeScanned;

  // Add or increment item in cart
  const addOrIncrementDish = (dish: DishItem, qtyToAdd: number, isBox = false) => {
    setSessionItems((prev) => {
      const idx = prev.findIndex((item) => item.dishId === dish.id);
      const curStock = typeof dish.stock === "number" ? dish.stock : 0;
      const isAvailable = dish.isAvailable !== false;

      // In VENTA mode: Enforce strict stock check (bloqueo al agotarse)
      if (mode === "VENTA") {
        if (!isAvailable || curStock <= 0) {
          playErrorSound();
          alert(`¡PRODUCTO AGOTADO! "${dish.name}" no cuenta con existencias en bodega.`);
          return prev;
        }
      }

      if (idx !== -1) {
        const updated = [...prev];
        const newQty = updated[idx].quantity + qtyToAdd;

        // In VENTA mode, check if stock would be exceeded
        if (mode === "VENTA" && newQty > curStock) {
          playErrorSound();
          alert(`Stock insuficiente para "${dish.name}". Disponible en bodega: ${curStock}, solicitados: ${newQty}.`);
          return prev;
        }

        updated[idx] = {
          ...updated[idx],
          quantity: newQty,
        };
        return updated;
      }

      // In VENTA mode, check initial quantity
      if (mode === "VENTA" && qtyToAdd > curStock) {
        playErrorSound();
        alert(`Stock insuficiente para "${dish.name}". Disponible en bodega: ${curStock}, solicitados: ${qtyToAdd}.`);
        return prev;
      }

      return [
        {
          dishId: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: qtyToAdd,
          stock: dish.stock,
          trackStock: dish.trackStock,
          isAvailable: dish.isAvailable,
          barcode: dish.barcode,
          isBox,
        },
        ...prev,
      ];
    });
  };

  // Quantity controllers (+ and - buttons)
  const changeItemQty = (dishId: string, delta: number) => {
    setSessionItems((prev) => {
      return prev
        .map((item) => {
          if (item.dishId !== dishId) return item;
          const nextQty = item.quantity + delta;

          if (delta > 0 && mode === "VENTA") {
            const curStock = typeof item.stock === "number" ? item.stock : 0;
            if (nextQty > curStock) {
              playErrorSound();
              alert(`Stock insuficiente para "${item.name}". Solo quedan ${curStock} unidades en bodega.`);
              return item;
            }
          }

          if (nextQty <= 0) return null;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean) as CartSessionItem[];
    });
  };

  const removeItem = (dishId: string) => {
    setSessionItems((prev) => prev.filter((i) => i.dishId !== dishId));
  };

  // Calculate totals
  const totalQuantity = sessionItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalAmount = sessionItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

  // Submit Entrada
  const handleConfirmEntrada = async () => {
    if (sessionItems.length === 0) {
      alert("No hay productos escaneados.");
      return;
    }

    startTransition(async () => {
      const itemsPayload = sessionItems.map((it) => ({
        dishId: it.dishId,
        quantity: it.quantity,
      }));

      const res = await processCajaEntryAction(restaurant.id, itemsPayload);

      if (res.error) {
        playErrorSound();
        alert(res.error);
      } else {
        playBeep();
        setSuccessInfo({
          title: "¡Entrada Confirmada!",
          message: `Se ingresaron ${totalQuantity} unidades de ${sessionItems.length} producto(s) al inventario del negocio.`,
          badge: "📥 Entrada Registrada",
        });
        setSessionItems([]);
      }
    });
  };

  // Submit Venta
  const handleConfirmVenta = async () => {
    if (sessionItems.length === 0) {
      alert("No hay productos escaneados.");
      return;
    }

    startTransition(async () => {
      const itemsPayload = sessionItems.map((it) => ({
        dishId: it.dishId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      }));

      const res = await processCajaSaleAction(restaurant.id, {
        items: itemsPayload,
        paymentMethod,
        customerName: `Caja POS (${paymentMethod})`,
      });

      if (res.error) {
        playErrorSound();
        alert(res.error);
      } else {
        playBeep();
        setSuccessInfo({
          title: "¡Cobro Exitoso!",
          message: `Ticket #${res.orderNumber} por $${res.total?.toFixed(2)} pagado con ${paymentMethod}. Stock actualizado en tiempo real.`,
          badge: `⚡ Cobrado: ${paymentMethod}`,
        });
        setSessionItems([]);
      }
    });
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${themeBgGradient} text-white flex flex-col justify-between selection:bg-amber-500 selection:text-black font-sans`}
      style={{ minHeight: "100dvh" }}
    >
      {/* 1. Header con Switch y Controles */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-md mx-auto flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Admin</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate max-w-[150px]">
                {restaurant.name}
              </span>
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                title={soundEnabled ? "Silenciar pip" : "Activar pip"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(true)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                title="Escribir código manual"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Switch Grande: [ 📥 RECIBIR | 📤 VENDER ] */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-inner">
            <button
              type="button"
              onClick={() => setMode("ENTRADA")}
              className={`py-3 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isEntrada
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📥 RECIBIR</span>
              <span className="text-[10px] font-medium opacity-80">(Entrada)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("VENTA")}
              className={`py-3 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isEntrada
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>📤 VENDER</span>
              <span className="text-[10px] font-medium opacity-80">(Salida)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Lector de Cámara Escáner (Visor 50-60%) */}
      <div className="max-w-md w-full mx-auto px-4 pt-3 flex flex-col items-center">
        <div
          className={`relative w-full aspect-square max-h-[38vh] rounded-3xl overflow-hidden bg-black border-2 ${themeAccentBorder} shadow-2xl flex flex-col items-center justify-center`}
        >
          {/* Div que html5-qrcode utiliza para inyectar el vídeo */}
          <div id="caja-lector" className="w-full h-full object-cover" />

          {/* Guía visual de enfoque de código de barras */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div
              className={`w-48 h-28 border-2 border-dashed ${
                isEntrada ? "border-blue-400/80 shadow-blue-500/20" : "border-emerald-400/80 shadow-emerald-500/20"
              } rounded-2xl flex items-center justify-center shadow-lg relative animate-pulse`}
            >
              <div className="w-full h-0.5 bg-red-500/80 absolute shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>
            <p className="text-[11px] font-bold text-white/90 drop-shadow mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md">
              Apunta al código de barras o QR
            </p>
          </div>

          {scannerError && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10 space-y-3">
              <Camera className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-slate-300 leading-relaxed">{scannerError}</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-1">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reintentar cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
                >
                  <Keyboard className="w-4 h-4" />
                  <span>Código manual</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Lista de Productos Escaneados en la Sesión */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-3 overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Barcode className={`w-4 h-4 ${themeTextAccent}`} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Escaneados ({sessionItems.length})
            </h2>
          </div>
          {sessionItems.length > 0 && (
            <button
              type="button"
              onClick={() => setSessionItems([])}
              className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
            >
              Vaciar lista
            </button>
          )}
        </div>

        {sessionItems.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-500 gap-2">
            <Package className="w-10 h-10 opacity-30" />
            <p className="text-xs font-medium">No hay productos escaneados aún.</p>
            <p className="text-[11px] text-slate-600">
              {isEntrada
                ? "Escanea un código para sumar al stock."
                : "Escanea un código para cobrar y restar stock."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 py-3">
            {sessionItems.map((item) => (
              <div
                key={item.dishId}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md gap-2"
              >
                {/* Nombre e info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>${item.price.toFixed(2)} c/u</span>
                    {item.trackStock && (
                      <span className="text-slate-500">· Stock: {item.stock ?? 0}</span>
                    )}
                    {item.isBox && (
                      <span className="text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.2 rounded text-[10px]">
                        📦 Caja
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-black mt-1 ${themeTextAccent}`}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>

                {/* Controles + y - Grandes (mínimo 56px de touch target para una sola mano) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => changeItemQty(item.dishId, -1)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-lg active:scale-90 transition cursor-pointer shadow border border-slate-700"
                    title="Restar 1"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <span className="w-8 text-center text-sm font-black text-white">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => changeItemQty(item.dishId, 1)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${
                      isEntrada ? "bg-blue-600 hover:bg-blue-500" : "bg-emerald-600 hover:bg-emerald-500"
                    } text-white flex items-center justify-center font-bold text-lg active:scale-90 transition cursor-pointer shadow border border-white/20`}
                    title="Sumar 1"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(item.dishId)}
                    className="p-2.5 text-slate-500 hover:text-red-400 transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 4. Footer Fijo con Total y Botón Gigante (56px) */}
      <footer className="sticky bottom-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-4">
        <div className="max-w-md mx-auto space-y-3">
          {/* Si está en VENTA: selector de método de pago */}
          {!isEntrada && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "EFECTIVO", label: "Efectivo", icon: Banknote },
                { id: "DEUNA", label: "DeUna", icon: Zap },
                { id: "TARJETA", label: "Tarjeta", icon: CreditCard },
              ].map((m) => {
                const IconComp = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Resumen Total y Botón Principal de 56px */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {isEntrada ? "Total Unidades" : "Total a Cobrar"}
              </span>
              <span className="text-xl font-black text-white">
                {isEntrada ? `${totalQuantity} unids.` : `$${totalAmount.toFixed(2)}`}
              </span>
            </div>

            {isEntrada ? (
              <button
                type="button"
                disabled={sessionItems.length === 0 || isPending}
                onClick={handleConfirmEntrada}
                className={`min-h-[56px] px-6 rounded-2xl font-black text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                  sessionItems.length === 0
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : themePrimaryButton
                }`}
              >
                {isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Confirmar Entrada ({totalQuantity})</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={sessionItems.length === 0 || isPending}
                onClick={handleConfirmVenta}
                className={`min-h-[56px] px-6 rounded-2xl font-black text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                  sessionItems.length === 0
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : themePrimaryButton
                }`}
              >
                {isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Cobrar ${totalAmount.toFixed(2)}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* MODAL 1: Caja Detectada (¿Cuántas unidades trae?) */}
      {boxModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                📦 Caja / Bulto Detectado
              </span>
              <button
                type="button"
                onClick={() => setBoxModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">{boxModalData.dish.name}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Detectaste el código de caja. ¿Cuántas unidades contiene este empaque para{" "}
                {isEntrada ? "sumar al inventario" : "cobrar"}?
              </p>
            </div>

            {/* Chips rápidos */}
            <div className="flex gap-2">
              {["6", "12", "24", "30"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBoxUnitsInput(n)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                    boxUnitsInput === n
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {n} unids
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase">
                Unidades personalizadas:
              </label>
              <input
                type="number"
                min="1"
                value={boxUnitsInput}
                onChange={(e) => setBoxUnitsInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-4 py-3 rounded-xl text-white font-bold text-center text-lg focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const qty = parseInt(boxUnitsInput, 10) || boxModalData.defaultUnits || 12;
                addOrIncrementDish(boxModalData.dish, qty, true);
                setBoxModalData(null);
                playBeep();
              }}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/20"
            >
              Agregar {boxUnitsInput} unidades a la lista
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Producto Nuevo (Código no registrado) */}
      {newProductModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                ✨ Producto Nuevo
              </span>
              <button
                type="button"
                onClick={() => setNewProductModalCode(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono break-all">
              Código: <span className="text-amber-300 font-bold">{newProductModalCode}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: Coca Cola 500ml"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                    Precio Venta ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-4 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                    Categoría
                  </label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2.5 rounded-xl text-white text-xs focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newProductIsBox}
                  onChange={(e) => setNewProductIsBox(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                <span className="text-xs text-slate-300 font-medium">¿Es un código de caja / bulto?</span>
              </label>

              {newProductIsBox && (
                <div>
                  <label className="text-[11px] font-bold text-amber-300 uppercase block mb-1">
                    Unidades por caja:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newProductUnitsPerBox}
                    onChange={(e) => setNewProductUnitsPerBox(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-4 py-2 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!newProductName.trim() || isPending}
              onClick={() => {
                startTransition(async () => {
                  const res = await createQuickDishFromBarcodeAction(restaurant.id, {
                    name: newProductName,
                    price: parseFloat(newProductPrice) || 0,
                    categoryId: newProductCategory,
                    barcode: newProductModalCode,
                    isBox: newProductIsBox,
                    unitsPerBox: parseInt(newProductUnitsPerBox, 10) || 12,
                    initialStock: isEntrada ? 0 : 10,
                  });

                  if (res.error) {
                    alert(res.error);
                  } else if (res.dish) {
                    const qty = res.isBox ? res.unitsPerBox || 12 : 1;
                    addOrIncrementDish(res.dish, qty, res.isBox);
                    setNewProductModalCode(null);
                    playBeep();
                  }
                });
              }}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              Guardar y Agregar a la lista
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Ingreso Manual de Código de Barras */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                ⌨️ Ingreso Manual de Código
              </span>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">
                Ingresa el código numérico impreso debajo del código de barras:
              </p>
              <input
                type="text"
                autoFocus
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="Ej: 7861000123456"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-4 py-3 rounded-xl text-white font-mono text-center text-lg focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualCodeInput.trim()) {
                    handleBarcodeScanned(manualCodeInput);
                    setIsManualModalOpen(false);
                    setManualCodeInput("");
                  }
                }}
              />
            </div>

            <button
              type="button"
              disabled={!manualCodeInput.trim()}
              onClick={() => {
                if (manualCodeInput.trim()) {
                  handleBarcodeScanned(manualCodeInput);
                  setIsManualModalOpen(false);
                  setManualCodeInput("");
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              Buscar / Procesar Código
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Confirmación de Éxito */}
      {successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 inline-block mb-1.5">
                {successInfo.badge}
              </span>
              <h3 className="text-lg font-black text-white">{successInfo.title}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{successInfo.message}</p>
            </div>

            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              Continuar Escaneando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
