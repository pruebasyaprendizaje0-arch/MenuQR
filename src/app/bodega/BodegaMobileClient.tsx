"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Barcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Keyboard,
  X,
  RefreshCw,
  Flashlight,
  FlashlightOff,
  Package,
  Layers,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Zap,
  Check,
} from "lucide-react";
import {
  searchDishByBarcodeAction,
  createQuickDishFromBarcodeAction,
} from "@/lib/caja-actions";
import { adjustInventoryStockAction } from "@/lib/inventory-actions";
import { getBusinessLabels } from "@/lib/business-labels";

export interface BodegaDishItem {
  id: string;
  name: string;
  price: number;
  costPrice?: number | null;
  imageUrl: string | null;
  barcode: string | null;
  sku: string | null;
  variants: any | null;
  stock: number | null;
  trackStock: boolean;
  isAvailable: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
}

interface BodegaMobileClientProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor: string;
    customLabels?: string | null;
    businessType?: any;
  };
  categories: Array<{ id: string; name: string }>;
  dishes: BodegaDishItem[];
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

interface RecentEntryLog {
  id: string;
  dishId: string;
  dishName: string;
  delta: number;
  newStock: number;
  timestamp: string;
}

export function BodegaMobileClient({
  restaurant,
  categories,
  dishes: initialDishes,
  currentUser,
}: BodegaMobileClientProps) {
  const bLabels = useMemo(
    () => getBusinessLabels(restaurant.customLabels, restaurant.businessType),
    [restaurant.customLabels, restaurant.businessType]
  );

  const [dishes, setDishes] = useState<BodegaDishItem[]>(initialDishes);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Modos de escaneo: CONTINUOUS (+1 automático por cada beep) vs MANUAL (abre tarjeta para elegir cantidad)
  const [scanMode, setScanMode] = useState<"CONTINUOUS" | "MANUAL">("CONTINUOUS");

  // Estado del producto escaneado para ingreso manual/lote
  const [activeScannedDish, setActiveScannedDish] = useState<{
    dish: BodegaDishItem;
    isBox: boolean;
    unitsPerBox: number;
    barcode: string;
  } | null>(null);

  const [customDeltaInput, setCustomDeltaInput] = useState<string>("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Producto no reconocido (para creación rápida)
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("1.50");
  const [newDishCategory, setNewDishCategory] = useState(categories[0]?.id || "");
  const [newDishInitialStock, setNewDishInitialStock] = useState("12");

  // Historial de ingresos de la sesión
  const [recentEntries, setRecentEntries] = useState<RecentEntryLog[]>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

  // Alerta flotante de éxito
  const [toastNotice, setToastNotice] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  // Refs para escáner
  const scannerRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  // Web Audio Synth
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
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60]);
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
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
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

  const showToast = (message: string, type: "success" | "warning" = "success") => {
    setToastNotice({ message, type });
    setTimeout(() => {
      setToastNotice((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Procesar código de barras
  const handleProcessBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    playBeep();
    setUnrecognizedBarcode(null);

    // 1. Buscar en estado local de platos
    let matchedDish = dishes.find((d) => d.barcode === code);
    let isBox = false;
    let unitsPerBox = 1;

    if (!matchedDish) {
      for (const d of dishes) {
        if (d.variants) {
          try {
            const p = typeof d.variants === "string" ? JSON.parse(d.variants) : d.variants;
            if (p && (p.boxBarcode === code || p.codigo_caja === code)) {
              matchedDish = d;
              isBox = true;
              unitsPerBox = Number(p.unitsPerBox) || 12;
              break;
            }
          } catch {}
        }
      }
    }

    // 2. Si no está en local, buscar en el servidor
    if (!matchedDish) {
      const res = await searchDishByBarcodeAction(restaurant.id, code);
      if (res.found && res.dish) {
        matchedDish = dishes.find((d) => d.id === res.dish.id) || (res.dish as any);
        isBox = Boolean(res.isBox);
        unitsPerBox = res.unitsPerBox || 1;
      }
    }

    if (!matchedDish) {
      playErrorSound();
      setUnrecognizedBarcode(code);
      setActiveScannedDish(null);
      return;
    }

    // Si el modo es continuo: sumar +1 (o +caja) de inmediato
    if (scanMode === "CONTINUOUS") {
      const delta = isBox ? unitsPerBox : 1;
      await executeStockAdd(matchedDish.id, delta, matchedDish.name);
    } else {
      // Modo manual: abrir tarjeta inferior para elegir cantidad
      setActiveScannedDish({
        dish: matchedDish,
        isBox,
        unitsPerBox,
        barcode: code,
      });
      setCustomDeltaInput(isBox ? unitsPerBox.toString() : "1");
    }
  };

  // Ejecutar incremento de existencias
  const executeStockAdd = async (dishId: string, delta: number, dishName?: string) => {
    setIsSubmitting(true);
    try {
      const res = await adjustInventoryStockAction({
        itemType: "DISH",
        itemId: dishId,
        delta,
        reason: "Ingreso móvil con escáner de bodega",
      });

      if (res.success) {
        let updatedStock = 0;
        setDishes((prev) =>
          prev.map((d) => {
            if (d.id !== dishId) return d;
            const newStock = Math.max(0, (typeof d.stock === "number" ? d.stock : 0) + delta);
            updatedStock = newStock;
            return {
              ...d,
              stock: newStock,
              trackStock: true,
              isAvailable: true,
            };
          })
        );

        const name = dishName || activeScannedDish?.dish?.name || "Producto";
        showToast(`✓ +${delta} unidades ingresadas a "${name}" (Stock: ${updatedStock})`);

        setRecentEntries((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            dishId,
            dishName: name,
            delta,
            newStock: updatedStock,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev,
        ]);

        setActiveScannedDish(null);
      } else {
        alert(res.error || "No se pudo actualizar el stock.");
      }
    } catch {
      alert("Error al conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deshacer ingreso reciente si se cometió un error
  const handleUndoRecentEntry = async (entry: RecentEntryLog) => {
    if (!confirm(`¿Deseas revertir el ingreso de +${entry.delta} a "${entry.dishName}"?`)) return;

    try {
      const res = await adjustInventoryStockAction({
        itemType: "DISH",
        itemId: entry.dishId,
        delta: -entry.delta,
        reason: "Anulación de ingreso móvil erróneo",
      });

      if (res.success) {
        setDishes((prev) =>
          prev.map((d) => {
            if (d.id !== entry.dishId) return d;
            const newStock = Math.max(0, (typeof d.stock === "number" ? d.stock : 0) - entry.delta);
            return { ...d, stock: newStock };
          })
        );
        setRecentEntries((prev) => prev.filter((e) => e.id !== entry.id));
        showToast(`↩️ Ingreso revertido para "${entry.dishName}"`, "warning");
      }
    } catch {
      alert("No se pudo revertir el ingreso.");
    }
  };

  // Crear producto nuevo al vuelo si el código no existía
  const handleCreateQuickDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unrecognizedBarcode) return;

    const name = newDishName.trim();
    if (!name) {
      alert("Ingresa el nombre del producto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createQuickDishFromBarcodeAction(restaurant.id, {
        name,
        price: parseFloat(newDishPrice) || 1.5,
        categoryId: newDishCategory || undefined,
        barcode: unrecognizedBarcode,
        initialStock: parseInt(newDishInitialStock) || 12,
      });

      if (res.error) {
        alert(res.error);
      } else if (res.dish) {
        const created = res.dish as any;
        setDishes((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            price: created.price,
            stock: created.stock,
            trackStock: true,
            isAvailable: true,
            barcode: created.barcode,
            imageUrl: created.imageUrl,
            sku: null,
            variants: null,
            categoryId: newDishCategory || null,
          },
        ]);

        showToast(`🎉 ¡"${name}" creado e ingresado con ${newDishInitialStock} unidades!`);
        setUnrecognizedBarcode(null);
        setNewDishName("");
      }
    } catch {
      alert("Error al registrar el nuevo producto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar linterna (Flash) si el dispositivo y navegador lo soportan
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const track = (scannerRef.current as any)?.html5QrcodeScanner?.videoTrack;
      if (track && typeof track.applyConstraints === "function") {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } else {
        setTorchOn((prev) => !prev);
      }
    } catch (e) {
      console.warn("Torch no soportado o denegado:", e);
      setTorchOn((prev) => !prev);
    }
  };

  // Inicializar lector de cámara HTML5
  useEffect(() => {
    if (!isCameraActive) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      return;
    }

    let isMounted = true;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!isMounted) return;
      const el = document.getElementById("bodega-mobile-reader");
      if (!el) return;

      const scanner = new Html5Qrcode("bodega-mobile-reader");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 250, height: 160 } },
          (decoded) => {
            if (cooldownRef.current) return;
            cooldownRef.current = true;
            handleProcessBarcode(decoded);
            setTimeout(() => {
              cooldownRef.current = false;
            }, 1800);
          },
          () => {}
        )
        .catch((err) => {
          console.warn("[Bodega Camera] Error:", err);
        });
    });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        const inst = scannerRef.current;
        scannerRef.current = null;
        try {
          const state = typeof inst.getState === "function" ? inst.getState() : null;
          if (state === 2 || state === 3 || (inst as any).isScanning) {
            const p = inst.stop();
            if (p && typeof p.then === "function") p.catch(() => {});
          }
        } catch {}
        try {
          inst.clear();
        } catch {}
      }
    };
  }, [isCameraActive, scanMode]);

  // Listener para pistola lectora Bluetooth conectada al teléfono
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
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
  }, [scanMode, dishes]);

  const totalSessionEntries = recentEntries.reduce((acc, it) => acc + it.delta, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-lg mx-auto w-full relative overflow-x-hidden pb-20 select-none">
      {/* 1. CABECERA MOBILE DE BODEGA */}
      <header className="p-4 bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
            title="Volver al panel"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-amber-400" />
              <h1 className="font-black text-sm text-white truncate max-w-[170px]">
                {restaurant.name}
              </h1>
            </div>
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">
              Escáner de Bodega Móvil
            </span>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTorch}
            className={`p-2 rounded-xl transition ${
              torchOn
                ? "bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Linterna / Flash"
          >
            {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            title="Sonido Beep"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. NOTIFICACIÓN TOAST FLOTANTE */}
      {toastNotice && (
        <div className="fixed top-18 inset-x-4 z-50 animate-fadeIn">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 backdrop-blur-md ${
              toastNotice.type === "warning"
                ? "bg-amber-500/90 text-slate-950 border-amber-400"
                : "bg-emerald-600/95 text-white border-emerald-400 shadow-emerald-500/20"
            }`}
          >
            <Check className="w-5 h-5 stroke-[3] shrink-0" />
            <span className="flex-1">{toastNotice.message}</span>
          </div>
        </div>
      )}

      {/* 3. VISOR DE CÁMARA A PANTALLA COMPLETA */}
      <div className="relative w-full aspect-[4/3] bg-black border-b-2 border-amber-500/40 shadow-2xl overflow-hidden flex flex-col items-center justify-center">
        <div id="bodega-mobile-reader" className="w-full h-full object-cover" />

        {/* Mira Láser y Guía de Enfoque */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-64 h-36 border-2 border-dashed border-amber-400 rounded-3xl relative animate-pulse flex items-center justify-center shadow-lg">
            <div className="w-full h-0.5 bg-amber-400 absolute shadow-[0_0_12px_rgba(251,191,36,1)]" />
          </div>
          <p className="text-[11px] font-black text-white mt-3 bg-black/75 px-3 py-1 rounded-full backdrop-blur-md">
            Apunta la cámara al código de barras
          </p>
        </div>
      </div>

      {/* 4. BARRA DE MODO DE ESCANEO */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setScanMode("CONTINUOUS")}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              scanMode === "CONTINUOUS"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Continuo (+1 por Beep)</span>
          </button>
          <button
            type="button"
            onClick={() => setScanMode("MANUAL")}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              scanMode === "MANUAL"
                ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Elegir Cantidad / Lote</span>
          </button>
        </div>

        {/* Resumen de ingresos en la sesión */}
        <div className="flex items-center justify-between p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Ingresos de esta sesión:
            </span>
            <strong className="text-emerald-400 font-mono text-base font-black">
              +{totalSessionEntries} {bLabels.stockUnitPlural}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setShowHistorySheet((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-750 transition"
          >
            <span>Ver Registro ({recentEntries.length})</span>
            {showHistorySheet ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 5. TARJETA MODAL INFERIOR (BOTTOM SHEET) PARA INGRESO MANUAL */}
      {activeScannedDish && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-t-2 border-amber-500 rounded-t-3xl p-5 space-y-4 shadow-2xl max-w-lg mx-auto w-full animate-slideUp">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block">
                  PRODUCTO DETECTADO
                </span>
                <h3 className="font-black text-lg text-white leading-tight">
                  {activeScannedDish.dish.name}
                </h3>
                <span className="text-xs font-mono text-slate-400 block mt-0.5">
                  Código: {activeScannedDish.barcode}
                </span>
                {activeScannedDish.isBox && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                    📦 Código de Caja ({activeScannedDish.unitsPerBox} unidades)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveScannedDish(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Stock Actual en Bodega:</span>
              <strong className="text-emerald-400 font-mono text-base">
                {activeScannedDish.dish.stock ?? 0} {bLabels.stockUnitPlural}
              </strong>
            </div>

            {/* Botones de incremento rápido */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Selecciona la cantidad recibida:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 6, 12, 24].map((amt) => (
                  <button
                    key={`mobile-delta-${amt}`}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      executeStockAdd(activeScannedDish.dish.id, amt, activeScannedDish.dish.name)
                    }
                    className="py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-sm border border-amber-500/40 transition active:scale-95 disabled:opacity-50"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Input libre */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Otra cant."
                  value={customDeltaInput}
                  onChange={(e) => setCustomDeltaInput(e.target.value)}
                  className="w-28 px-3 py-3 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-sm font-bold text-white text-center focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  disabled={isSubmitting || !customDeltaInput || parseInt(customDeltaInput) <= 0}
                  onClick={() => {
                    const delta = parseInt(customDeltaInput);
                    if (delta > 0) {
                      executeStockAdd(activeScannedDish.dish.id, delta, activeScannedDish.dish.name);
                    }
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Ingresar a Bodega</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE CREACIÓN RÁPIDA DE PRODUCTO NO RECONOCIDO */}
      {unrecognizedBarcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleCreateQuickDish}
            className="max-w-sm w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-black text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Producto No Registrado</span>
              </span>
              <button
                type="button"
                onClick={() => setUnrecognizedBarcode(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Código Escaneado:</span>
              <strong className="font-mono text-xs text-amber-300 break-all">{unrecognizedBarcode}</strong>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Nombre del Producto:</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej. Sixpack Cerveza Modelo..."
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Precio Venta ($):</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Cantidad Recibida:</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newDishInitialStock}
                  onChange={(e) => setNewDishInitialStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 block">Categoría:</label>
              <select
                value={newDishCategory}
                onChange={(e) => setNewDishCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnrecognizedBarcode(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Ignorar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? "Guardando..." : "Crear e Ingresar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. HISTORIAL DESPLEGABLE DE INGRESOS */}
      {showHistorySheet && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2 animate-fadeIn">
          <span className="text-xs font-black text-white uppercase tracking-wider block">
            Historial de Ingresos ({recentEntries.length}):
          </span>

          {recentEntries.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              Aún no has escaneado productos en esta sesión.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{entry.dishName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      +{entry.delta} {bLabels.stockUnitPlural} · Stock total: {entry.newStock} ({entry.timestamp})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUndoRecentEntry(entry)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                    title="Deshacer este ingreso"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

