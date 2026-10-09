"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  ChefHat,
  Volume2,
  VolumeX,
  RefreshCw,
  Clock,
  User,
  CheckCircle2,
  Flame,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  Store,
  Wifi,
  WifiOff,
  Bell,
  Check,
  Play,
  Volume1,
  QrCode,
  Maximize,
  Minimize,
  X,
  Copy,
  AlertTriangle,
  Trash2,
  Ban,
} from "lucide-react";
import { kitchenAudio } from "@/lib/kitchen-audio";
import { QRCodeSVG } from "qrcode.react";

interface PedidoItem {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  notas?: string | null;
  es_añadido?: boolean;
  estado_item?: string;
}

interface Pedido {
  id: string;
  negocio_id: string;
  mesa: string;
  estado: "nuevo" | "en_cocina" | "listo" | "por_pagar" | "pagado" | "cancelado";
  camarero_id?: string;
  camarero_nombre?: string;
  total: number;
  created_at: string;
  items: PedidoItem[];
}

interface Producto {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  category?: { name: string };
}

interface Negocio {
  id: string;
  nombre: string;
  slug: string;
  numero_mesas: number;
}

export function CocinaClient({ initialSlug }: { initialSlug: string }) {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de conexión en tiempo real (Dual: SSE + Socket.IO)
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Estados de Audio y Alertas
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showSoundTester, setShowSoundTester] = useState(false);
  const [activeTestingSound, setActiveTestingSound] = useState<string | null>(null);

  // Controles de Productos
  const [showProductBar, setShowProductBar] = useState(false);
  const [productFilter, setProductFilter] = useState("");

  // Acceso de Meseros (QR) y Modo KDS (Pantalla Completa)
  const [showQrWaitersModal, setShowQrWaitersModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados de Cancelación de Plato Individual (Opción 2)
  const [itemToCancel, setItemToCancel] = useState<{
    pedidoId: string;
    mesa: string;
    item: PedidoItem;
  } | null>(null);
  const [cancelItemReason, setCancelItemReason] = useState("Sin ingredientes / Stock agotado");
  const [cancelItemCustomReason, setCancelItemCustomReason] = useState("");
  const [cancelMarcarAgotado, setCancelMarcarAgotado] = useState(true);
  const [isSubmittingItemCancel, setIsSubmittingItemCancel] = useState(false);

  // Estados de Cancelación de Comanda Completa
  const [orderToCancel, setOrderToCancel] = useState<{
    pedidoId: string;
    mesa: string;
  } | null>(null);
  const [cancelOrderReason, setCancelOrderReason] = useState("Sin ingredientes suficientes");
  const [cancelOrderCustomReason, setCancelOrderCustomReason] = useState("");
  const [isSubmittingOrderCancel, setIsSubmittingOrderCancel] = useState(false);

  // Banner de alerta en vivo (cuando el mesero cancela algo desde salón)
  const [alertBanner, setAlertBanner] = useState<{
    id: string;
    tipo: "item" | "pedido";
    titulo: string;
    mensaje: string;
  } | null>(null);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const socketRef = useRef<Socket | null>(null);
  const pedidosRef = useRef<Pedido[]>([]);
  pedidosRef.current = pedidos;
  const initialLoadedRef = useRef(false);

  // 1. Inicializar preferencias de sonido desde localStorage
  useEffect(() => {
    try {
      const savedSound = localStorage.getItem("cocina_sound_enabled");
      if (savedSound !== null) {
        setSoundEnabled(savedSound === "true");
      }
    } catch {}

    // Escuchar cualquier interacción en la ventana para desbloquear Web Audio automáticamente
    const handleFirstGesture = async () => {
      await kitchenAudio.unlock();
      setAudioUnlocked(true);
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };

    window.addEventListener("click", handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
  }, []);

  // Función unificada para reproducir alertas según el tipo
  const triggerAudioAlert = useCallback((type: "nuevo" | "cocina" | "listo" | "cancelacion") => {
    if (!soundEnabled) return;
    try {
      if (type === "nuevo") {
        kitchenAudio.playNuevoPedido();
      } else if (type === "cocina") {
        kitchenAudio.playEnCocina();
      } else if (type === "listo") {
        kitchenAudio.playListoParaServir();
      } else if (type === "cancelacion") {
        kitchenAudio.playCancelacion();
      }
    } catch (e) {
      console.warn("[Cocina] Error reproduciendo alerta:", e);
    }
  }, [soundEnabled]);

  // Probar sonido manualmente desde la UI (Desbloquea instantáneamente)
  const handleTestSound = async (type: "nuevo" | "cocina" | "listo" | "cancelacion") => {
    await kitchenAudio.unlock();
    setAudioUnlocked(true);
    setActiveTestingSound(type);

    if (type === "nuevo") {
      kitchenAudio.playNuevoPedido();
    } else if (type === "cocina") {
      kitchenAudio.playEnCocina();
    } else if (type === "listo") {
      kitchenAudio.playListoParaServir();
    } else if (type === "cancelacion") {
      kitchenAudio.playCancelacion();
    }

    setTimeout(() => {
      setActiveTestingSound((curr) => (curr === type ? null : curr));
    }, 1600);
  };

  // Alternar sonido ON / OFF
  const toggleSound = async () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    try {
      localStorage.setItem("cocina_sound_enabled", String(nextVal));
    } catch {}

    if (nextVal) {
      await kitchenAudio.unlock();
      setAudioUnlocked(true);
      kitchenAudio.playEnCocina(); // Pequeño tono de confirmación
    }
  };

  // 2. Cargar negocio específico por slug
  useEffect(() => {
    async function loadNegocio() {
      try {
        const res = await fetch(`/api/negocios?slug=${encodeURIComponent(initialSlug)}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.negocios) && data.negocios.length > 0) {
          setNegocio(data.negocios[0]);
        }
      } catch (err) {
        console.error("Error loading negocio by slug:", err);
      }
    }
    loadNegocio();
  }, [initialSlug]);

  // 3. Cargar datos iniciales
  useEffect(() => {
    if (!negocio?.id) return;

    let isMounted = true;
    setLoading(true);

    async function fetchData() {
      try {
        const [pedidosRes, negocioDetailRes] = await Promise.all([
          fetch(`/api/pedidos?negocio_id=${negocio.id}&activos=true`),
          fetch(`/api/negocios/${negocio.id}`),
        ]);

        const pedidosData = await pedidosRes.json();
        const negocioData = await negocioDetailRes.json();

        if (isMounted) {
          if (pedidosData.ok) {
            setPedidos(pedidosData.pedidos || []);
            pedidosRef.current = pedidosData.pedidos || [];
          }
          if (negocioData.ok && negocioData.productos) {
            setProductos(negocioData.productos);
          }
          // Marcar como cargado inicialmente para no disparar alertas al cargar la pantalla
          setTimeout(() => {
            initialLoadedRef.current = true;
          }, 1200);
        }
      } catch (err) {
        console.error("Error fetching cocina data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [negocio?.id]);

  // 4. Canal de respaldo: Polling liviano si Socket.IO se desconecta (sin saturar sockets HTTP)
  useEffect(() => {
    if (!negocio?.id || socketConnected) return;

    let isPolling = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pedidos?negocio_id=${negocio.id}&activos=true`, { cache: "no-store" });
        const data = await res.json();
        if (isPolling && data.ok && Array.isArray(data.pedidos)) {
          setPedidos(data.pedidos);
          pedidosRef.current = data.pedidos;
        }
      } catch (err) {
        console.warn("[Cocina fallback poll] Error:", err);
      }
    }, 8000);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [negocio?.id, socketConnected]);

  // 5. Canal en Tiempo Real Primario: Socket.IO (WebSocket de alto rendimiento)
  useEffect(() => {
    if (!negocio?.id) return;

    const socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      query: { negocio_id: negocio.id },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setIsLiveConnected(true);
      socket.emit("join_negocio", negocio.id);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setIsLiveConnected(false);
    });

    socket.on("nuevo_pedido", (nuevoPedido: Pedido) => {
      triggerAudioAlert("nuevo");
      setPedidos((prev) => {
        if (prev.some((p) => p.id === nuevoPedido.id)) {
          return prev.map((p) => (p.id === nuevoPedido.id ? nuevoPedido : p));
        }
        return [nuevoPedido, ...prev];
      });
    });

    socket.on("items_añadidos", ({ mesa, items }: { mesa: string; items: PedidoItem[] }) => {
      triggerAudioAlert("nuevo");
      setPedidos((prev) =>
        prev.map((pedido) => {
          if (String(pedido.mesa) === String(mesa) && pedido.estado !== "pagado") {
            const existingItemIds = new Set(pedido.items.map((i) => i.id));
            const itemsToAppend = items.filter((i) => !existingItemIds.has(i.id));
            const addedSum = itemsToAppend.reduce((sum, i) => sum + i.cantidad * i.precio, 0);
            return {
              ...pedido,
              total: pedido.total + addedSum,
              items: [...pedido.items, ...itemsToAppend],
            };
          }
          return pedido;
        })
      );
    });

    socket.on("pedido_actualizado", (pedidoActualizado: any) => {
      if (pedidoActualizado.estado === "en_cocina") {
        triggerAudioAlert("cocina");
      } else if (pedidoActualizado.estado === "listo") {
        triggerAudioAlert("listo");
      }

      if (pedidoActualizado.estado === "pagado" || pedidoActualizado.estado === "cancelado") {
        setPedidos((prev) => prev.filter((p) => p.id !== pedidoActualizado.id));
      } else {
        setPedidos((prev) => {
          const index = prev.findIndex((p) => p.id === pedidoActualizado.id);
          if (index !== -1) {
            const next = [...prev];
            next[index] = { ...next[index], ...pedidoActualizado };
            return next;
          }
          return [pedidoActualizado, ...prev];
        });
      }
    });

    socket.on("producto_actualizado", (prodActualizado: any) => {
      setProductos((prev) =>
        prev.map((p) =>
          p.id === prodActualizado.id
            ? { ...p, isAvailable: prodActualizado.isAvailable }
            : p
        )
      );
    });

    socket.on("item_cancelado", (data: any) => {
      if (data?.cancelado_por === "mesero") {
        triggerAudioAlert("cancelacion");
        setAlertBanner({
          id: String(Date.now()),
          tipo: "item",
          titulo: `Mesa ${data.mesa}: El mesero canceló un plato`,
          mensaje: `${data.plato_nombre} fue cancelado (${data.motivo}). No preparar este ítem.`,
        });
      }
    });

    socket.on("pedido_cancelado", (data: any) => {
      setPedidos((prev) => prev.filter((p) => p.id !== data.pedido_id));
      if (data?.cancelado_por === "mesero") {
        triggerAudioAlert("cancelacion");
        setAlertBanner({
          id: String(Date.now()),
          tipo: "pedido",
          titulo: `Mesa ${data.mesa}: Comanda anulada por el mesero`,
          mensaje: `El pedido completo fue cancelado (${data.motivo}). Retirar de cocina.`,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [negocio?.id, triggerAudioAlert]);

  // Manejar confirmación de cancelación de plato individual (Opción 2)
  const handleConfirmCancelItem = async () => {
    if (!itemToCancel) return;
    setIsSubmittingItemCancel(true);

    const motivo =
      cancelItemReason === "Otro" && cancelItemCustomReason.trim()
        ? cancelItemCustomReason.trim()
        : cancelItemReason;

    try {
      const res = await fetch(`/api/pedidos/${itemToCancel.pedidoId}/cancelar-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: itemToCancel.item.id,
          motivo,
          cancelado_por: "cocina",
          marcar_agotado: cancelMarcarAgotado,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPedidos((prev) => {
          if (data.pedido_cancelado) {
            return prev.filter((p) => p.id !== itemToCancel.pedidoId);
          }
          return prev.map((p) =>
            p.id === itemToCancel.pedidoId
              ? {
                  ...p,
                  total: data.pedido.total,
                  items: p.items.filter((i) => i.id !== itemToCancel.item.id),
                }
              : p
          );
        });

        if (cancelMarcarAgotado) {
          setProductos((prev) =>
            prev.map((pr) =>
              pr.name.toLowerCase() === itemToCancel.item.nombre.toLowerCase()
                ? { ...pr, isAvailable: false }
                : pr
            )
          );
        }

        setItemToCancel(null);
      } else {
        alert(data.error || "No se pudo cancelar el plato");
      }
    } catch (err) {
      console.error("Error al cancelar plato:", err);
      alert("Error de conexión al cancelar plato");
    } finally {
      setIsSubmittingItemCancel(false);
    }
  };

  // Manejar confirmación de cancelación de comanda completa (Opción 2)
  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel) return;
    setIsSubmittingOrderCancel(true);

    const motivo =
      cancelOrderReason === "Otro" && cancelOrderCustomReason.trim()
        ? cancelOrderCustomReason.trim()
        : cancelOrderReason;

    try {
      const res = await fetch(`/api/pedidos/${orderToCancel.pedidoId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo,
          cancelado_por: "cocina",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPedidos((prev) => prev.filter((p) => p.id !== orderToCancel.pedidoId));
        setOrderToCancel(null);
      } else {
        alert(data.error || "No se pudo cancelar el pedido");
      }
    } catch (err) {
      console.error("Error al cancelar pedido:", err);
      alert("Error de conexión al cancelar pedido");
    } finally {
      setIsSubmittingOrderCancel(false);
    }
  };

  // 6. Cambiar estado de pedido (ACEPTAR -> en_cocina, LISTO -> listo)
  const cambiarEstado = async (pedidoId: string, nuevoEstado: "en_cocina" | "listo") => {
    // 1. Reproducir sonido instantáneamente para feedback háptico/acústico
    if (nuevoEstado === "en_cocina") {
      triggerAudioAlert("cocina");
    } else if (nuevoEstado === "listo") {
      triggerAudioAlert("listo");
    }

    // 2. Actualización optimista de interfaz
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
    );

    // 3. Persistir en base de datos PostgreSQL
    try {
      await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (socketRef.current?.connected) {
        socketRef.current.emit("pedido_actualizado", {
          id: pedidoId,
          estado: nuevoEstado,
          negocio_id: negocio?.id,
        });
      }
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      if (negocio?.id) {
        fetch(`/api/pedidos?negocio_id=${negocio.id}&activos=true`)
          .then((r) => r.json())
          .then((d) => d.ok && setPedidos(d.pedidos));
      }
    }
  };

  // Toggle disponibilidad de producto
  const toggleProducto = async (productoId: string, currentVal: boolean) => {
    if (!negocio?.id) return;
    const newVal = !currentVal;

    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? { ...p, isAvailable: newVal } : p))
    );

    try {
      await fetch(`/api/productos/${productoId}/disponible`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isAvailable: newVal,
          negocio_id: negocio.id,
        }),
      });

      if (socketRef.current) {
        socketRef.current.emit("producto_actualizado", {
          id: productoId,
          isAvailable: newVal,
          negocio_id: negocio.id,
        });
      }
    } catch (err) {
      console.error("Error actualizando producto:", err);
      setProductos((prev) =>
        prev.map((p) => (p.id === productoId ? { ...p, isAvailable: currentVal } : p))
      );
    }
  };

  const calcularHaceMinutos = (fechaStr: string) => {
    try {
      const mins = Math.max(0, Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000));
      if (mins < 1) return "Hace unos segundos";
      if (mins === 1) return "Hace 1 min";
      if (mins < 60) return `Hace ${mins} min`;
      const hrs = Math.floor(mins / 60);
      return `Hace ${hrs} h ${mins % 60} m`;
    } catch {
      return "Hace poco";
    }
  };

  const pedidosNuevos = pedidos.filter((p) => p.estado === "nuevo");
  const pedidosEnCocina = pedidos.filter((p) => p.estado === "en_cocina");
  const pedidosListos = pedidos.filter((p) => p.estado === "listo" || p.estado === "por_pagar");

  const filteredProducts = productos.filter((p) =>
    p.name.toLowerCase().includes(productFilter.toLowerCase())
  );

  const isConnected = isLiveConnected || socketConnected;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* HEADER SUPERIOR */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* TÍTULO Y NOMBRE FIJO DEL NEGOCIO */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <ChefHat className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Módulo Cocina
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  KDS Live
                </span>
              </h1>
              <div className="flex items-center space-x-1.5 text-xs text-slate-300 mt-0.5 font-bold">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                <span>{negocio?.nombre || initialSlug}</span>
              </div>
            </div>
          </div>

          {/* CONTROLES */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
            {/* ESTADO DE CONEXIÓN EN TIEMPO REAL */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-medium border ${
                isConnected
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                  : "bg-rose-950/60 text-rose-400 border-rose-800 animate-pulse"
              }`}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span className="font-bold">En Vivo</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Conectando...</span>
                </>
              )}
            </div>

            {/* BOTÓN TOGGLE SONIDO */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Silenciar alarmas" : "Activar sonido"}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-bold transition shadow-sm ${
                soundEnabled
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-700/70 hover:bg-emerald-900/50"
                  : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300"
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Sonido ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span>Mudo</span>
                </>
              )}
            </button>

            {/* BOTÓN PROBAR ALERTAS SONORAS (3 SONIDOS) */}
            <button
              onClick={() => setShowSoundTester(!showSoundTester)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border font-bold transition ${
                showSoundTester
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                  : "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Probar Alertas (3)</span>
            </button>

            {/* BOTÓN STOCK PLATOS */}
            <button
              onClick={() => setShowProductBar(!showProductBar)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border font-medium transition ${
                showProductBar
                  ? "bg-amber-500 text-slate-950 border-amber-400 font-semibold"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stock Platos ({productos.length})</span>
            </button>

            {/* BOTÓN RECARGAR */}
            <button
              onClick={() => {
                if (!negocio?.id) return;
                setLoading(true);
                fetch(`/api/pedidos?negocio_id=${negocio.id}&activos=true`)
                  .then((r) => r.json())
                  .then((d) => d.ok && setPedidos(d.pedidos))
                  .finally(() => setLoading(false));
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700 transition"
              title="Recargar pedidos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* BOTÓN CÓDIGO QR DE MESEROS */}
            <button
              onClick={() => setShowQrWaitersModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/40 font-bold transition shadow-sm"
              title="Mostrar código QR de acceso para meseros"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">QR Meseros</span>
            </button>

            {/* BOTÓN PANTALLA COMPLETA MODO KDS */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700 transition"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa (Modo KDS)"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* ENLACE DIRECTO A MESAS CON SLUG */}
            <a
              href={`/${initialSlug}/mesas`}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 font-medium transition"
            >
              <span>Ver Mesas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* PANEL INTERACTIVO DE PRUEBA DE LOS 3 SONIDOS */}
        {showSoundTester && (
          <div className="bg-slate-950/95 border-t border-b border-amber-500/30 px-4 py-3 animate-fadeIn">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-amber-300">
                <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
                <span className="font-semibold">
                  Prueba y verifica las 3 alertas sonoras en vivo para este navegador:
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-2 text-xs">
                {/* 1. TEST NUEVO PEDIDO */}
                <button
                  onClick={() => handleTestSound("nuevo")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-bold transition shadow-sm ${
                    activeTestingSound === "nuevo"
                      ? "bg-rose-500 text-white border-rose-400 scale-105"
                      : "bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border-rose-800/80"
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>1. Nuevo Pedido</span>
                  {activeTestingSound === "nuevo" && <Check className="w-3.5 h-3.5 animate-pulse" />}
                </button>

                {/* 2. TEST EN COCINA */}
                <button
                  onClick={() => handleTestSound("cocina")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-bold transition shadow-sm ${
                    activeTestingSound === "cocina"
                      ? "bg-amber-500 text-slate-950 border-amber-400 scale-105"
                      : "bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-amber-800/80"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>2. En Cocina</span>
                  {activeTestingSound === "cocina" && <Check className="w-3.5 h-3.5 animate-pulse" />}
                </button>

                {/* 3. TEST LISTO PARA SERVIR */}
                <button
                  onClick={() => handleTestSound("listo")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-bold transition shadow-sm ${
                    activeTestingSound === "listo"
                      ? "bg-emerald-500 text-white border-emerald-400 scale-105"
                      : "bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>3. Listo para Servir</span>
                  {activeTestingSound === "listo" && <Check className="w-3.5 h-3.5 animate-pulse" />}
                </button>

                {/* 4. TEST CANCELACIÓN / ADVERTENCIA */}
                <button
                  onClick={() => handleTestSound("cancelacion")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-bold transition shadow-sm ${
                    activeTestingSound === "cancelacion"
                      ? "bg-purple-500 text-white border-purple-400 scale-105"
                      : "bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border-purple-800/80"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>4. Alerta Cancelación</span>
                  {activeTestingSound === "cancelacion" && <Check className="w-3.5 h-3.5 animate-pulse" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SWITCH ON/OFF STOCK */}
        {showProductBar && (
          <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-3 transition-all animate-fadeIn">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Disponibilidad de Productos en Tiempo Real (Switch ON/OFF)
                </span>
                <input
                  type="text"
                  placeholder="Buscar plato..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-md outline-none focus:border-amber-500 w-44"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition ${
                      p.isAvailable
                        ? "bg-slate-800 border-slate-700 text-slate-200"
                        : "bg-rose-950/40 border-rose-900/60 text-rose-300"
                    }`}
                  >
                    <span className="font-medium max-w-[140px] truncate">{p.name}</span>
                    <button
                      onClick={() => toggleProducto(p.id, p.isAvailable)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                        p.isAvailable
                          ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "bg-rose-500/30 text-rose-300 hover:bg-rose-500/40"
                      }`}
                    >
                      {p.isAvailable ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ON</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-rose-400" />
                          <span>AGOTADO</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <span className="text-xs text-slate-500 py-1">No se encontraron productos.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* BANNER DE ALERTA EN VIVO DE CANCELACIÓN PROVENIENTE DE SALÓN / MESERO */}
      {alertBanner && (
        <div className="bg-gradient-to-r from-rose-950 via-red-950 to-slate-950 border-b-2 border-rose-500 text-rose-100 px-4 py-3 flex items-center justify-between shadow-2xl animate-fadeIn sticky top-[57px] z-30">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <span>{alertBanner.titulo}</span>
                <span className="bg-rose-500/30 text-rose-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  AVISO DE SALÓN
                </span>
              </p>
              <p className="text-xs text-rose-200 mt-0.5">{alertBanner.mensaje}</p>
            </div>
          </div>
          <button
            onClick={() => setAlertBanner(null)}
            className="px-3 py-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-bold transition shadow border border-rose-700/80"
          >
            Entendido ✕
          </button>
        </div>
      )}

      {/* BANNER DE ACTIVACIÓN RÁPIDA DE SONIDO */}
      {!audioUnlocked && soundEnabled && (
        <div className="bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-slate-950 border-b border-amber-500/40 text-amber-200 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center space-x-2.5">
            <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
            <span className="font-medium">
              🔔 Alertas sonoras listas: Haz clic para activar o probar los tonos de alerta en este dispositivo:
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleTestSound("nuevo")}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1"
            >
              <Bell className="w-3 h-3" />
              <span>Probar Nuevo</span>
            </button>
            <button
              onClick={() => handleTestSound("cocina")}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shadow transition active:scale-95 flex items-center gap-1"
            >
              <Flame className="w-3 h-3" />
              <span>Probar Cocina</span>
            </button>
            <button
              onClick={() => handleTestSound("listo")}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Probar Listo</span>
            </button>
          </div>
        </div>
      )}

      {/* TABLERO KANBAN */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* 1. COLUMNA NUEVO */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-rose-400">NUEVO</h2>
              </div>
              <span className="bg-rose-500/20 text-rose-300 font-bold text-xs px-2.5 py-0.5 rounded-full border border-rose-500/30">
                {pedidosNuevos.length}
              </span>
            </div>

            <div className="space-y-3.5 flex-1 overflow-y-auto">
              {pedidosNuevos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="bg-slate-950 rounded-xl p-4 border-2 border-rose-500/60 shadow-lg shadow-rose-950/20 hover:border-rose-400 transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                    <div>
                      <span className="text-xl font-black text-white tracking-tight">Mesa {pedido.mesa}</span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                      <Clock className="w-3 h-3" />
                      <span>{calcularHaceMinutos(pedido.created_at)}</span>
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg text-xs ${
                          item.es_añadido ? "bg-amber-950/30 border border-amber-600/40" : "bg-slate-900 border border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center space-x-2 font-bold text-slate-100 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-mono shrink-0">
                              {item.cantidad}x
                            </span>
                            <span className="text-sm truncate">{item.nombre}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.es_añadido && (
                              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                AÑADIDO
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setItemToCancel({ pedidoId: pedido.id, mesa: pedido.mesa, item });
                                setCancelItemReason("Sin ingredientes / Stock agotado");
                                setCancelItemCustomReason("");
                                setCancelMarcarAgotado(true);
                              }}
                              title="Cancelar plato (Falta de ingredientes)"
                              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-700/60 hover:bg-rose-950/40 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {item.notas && (
                          <p className="mt-1 text-[11px] text-amber-300/90 italic bg-amber-950/20 px-1.5 py-0.5 rounded">
                            💬 Nota: {item.notas}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => cambiarEstado(pedido.id, "en_cocina")}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 flex items-center justify-center space-x-1.5 transition active:scale-95"
                  >
                    <Flame className="w-4 h-4 text-slate-950" />
                    <span>ACEPTAR (A Cocina)</span>
                  </button>

                  <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setOrderToCancel({ pedidoId: pedido.id, mesa: pedido.mesa });
                        setCancelOrderReason("Sin ingredientes suficientes");
                        setCancelOrderCustomReason("");
                      }}
                      className="text-[11px] text-rose-400/80 hover:text-rose-300 hover:underline flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Rechazar / Cancelar Comanda</span>
                    </button>
                  </div>
                </div>
              ))}

              {pedidosNuevos.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 mb-2 opacity-60" />
                  <span>Sin pedidos nuevos pendientes</span>
                </div>
              )}
            </div>
          </section>

          {/* 2. COLUMNA EN COCINA */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400">EN COCINA</h2>
              </div>
              <span className="bg-amber-500/20 text-amber-300 font-bold text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {pedidosEnCocina.length}
              </span>
            </div>

            <div className="space-y-3.5 flex-1 overflow-y-auto">
              {pedidosEnCocina.map((pedido) => (
                <div
                  key={pedido.id}
                  className="bg-slate-950 rounded-xl p-4 border-2 border-amber-500/50 shadow-lg shadow-amber-950/20 hover:border-amber-400 transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                    <div>
                      <span className="text-xl font-black text-white tracking-tight">Mesa {pedido.mesa}</span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                      <Clock className="w-3 h-3" />
                      <span>{calcularHaceMinutos(pedido.created_at)}</span>
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg text-xs ${
                          item.es_añadido ? "bg-amber-950/40 border border-amber-500/50" : "bg-slate-900 border border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center space-x-2 font-bold text-slate-100 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-mono shrink-0">
                              {item.cantidad}x
                            </span>
                            <span className="text-sm truncate">{item.nombre}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.es_añadido && (
                              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                                AÑADIDO
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setItemToCancel({ pedidoId: pedido.id, mesa: pedido.mesa, item });
                                setCancelItemReason("Sin ingredientes / Stock agotado");
                                setCancelItemCustomReason("");
                                setCancelMarcarAgotado(true);
                              }}
                              title="Cancelar plato (Falta de ingredientes)"
                              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-700/60 hover:bg-rose-950/40 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {item.notas && (
                          <p className="mt-1 text-[11px] text-amber-300/90 italic bg-amber-950/20 px-1.5 py-0.5 rounded">
                            💬 Nota: {item.notas}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => cambiarEstado(pedido.id, "listo")}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1.5 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>LISTO (Avisar a Mesero)</span>
                  </button>

                  <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setOrderToCancel({ pedidoId: pedido.id, mesa: pedido.mesa });
                        setCancelOrderReason("Sin ingredientes suficientes");
                        setCancelOrderCustomReason("");
                      }}
                      className="text-[11px] text-rose-400/80 hover:text-rose-300 hover:underline flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Anular Comanda</span>
                    </button>
                  </div>
                </div>
              ))}

              {pedidosEnCocina.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Flame className="w-8 h-8 text-slate-600 mb-2 opacity-60" />
                  <span>Sin órdenes en preparación</span>
                </div>
              )}
            </div>
          </section>

          {/* 3. COLUMNA LISTO PARA SERVIR */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-400">LISTO PARA SERVIR</h2>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 font-bold text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {pedidosListos.length}
              </span>
            </div>

            <div className="space-y-3.5 flex-1 overflow-y-auto">
              {pedidosListos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="bg-slate-950 rounded-xl p-4 border border-emerald-600/50 opacity-90 hover:opacity-100 transition shadow-lg shadow-emerald-950/10"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                    <div>
                      <span className="text-xl font-black text-white tracking-tight">Mesa {pedido.mesa}</span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Listo en mesa</span>
                    </span>
                  </div>

                  <div className="space-y-1 mb-2">
                    {pedido.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs text-slate-300 py-0.5">
                        <span className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-emerald-400 font-mono font-bold shrink-0">{item.cantidad}x</span>
                          <span className="truncate">{item.nombre}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.es_añadido && (
                            <span className="text-[10px] text-amber-400 font-semibold">(Añadido)</span>
                          )}
                          <button
                            onClick={() => {
                              setItemToCancel({ pedidoId: pedido.id, mesa: pedido.mesa, item });
                              setCancelItemReason("Sin ingredientes / Stock agotado");
                              setCancelItemCustomReason("");
                              setCancelMarcarAgotado(true);
                            }}
                            title="Cancelar plato (Falta de ingredientes)"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Total mesa:</span>
                    <span className="text-emerald-400 font-bold text-sm font-mono">${pedido.total.toFixed(2)}</span>
                  </div>

                  <div className="mt-2 pt-1 border-t border-slate-900/80 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setOrderToCancel({ pedidoId: pedido.id, mesa: pedido.mesa });
                        setCancelOrderReason("Sin ingredientes suficientes");
                        setCancelOrderCustomReason("");
                      }}
                      className="text-[11px] text-rose-400/80 hover:text-rose-300 hover:underline flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Anular Comanda</span>
                    </button>
                  </div>
                </div>
              ))}

              {pedidosListos.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 mb-2 opacity-60" />
                  <span>Sin platos pendientes de entrega</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* MODAL CÓDIGO QR PARA MESEROS */}
      {showQrWaitersModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowQrWaitersModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">QR Acceso Meseros</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Escanea con la cámara del celular para abrir el Módulo Mesero en el salón
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto">
              <QRCodeSVG
                value={typeof window !== "undefined" ? `${window.location.origin}/${initialSlug}/mesas` : `https://menuqr.ubicame.cc/${initialSlug}/mesas`}
                size={200}
                level="M"
              />
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 truncate select-all">
              {typeof window !== "undefined" ? `${window.location.origin}/${initialSlug}/mesas` : `/${initialSlug}/mesas`}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined") {
                    navigator.clipboard.writeText(`${window.location.origin}/${initialSlug}/mesas`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedLink ? "¡Copiado!" : "Copiar Enlace"}</span>
              </button>
              <a
                href={`/${initialSlug}/mesas`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Abrir Mesas &rarr;</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR PLATO INDIVIDUAL (COCINA) */}
      {itemToCancel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setItemToCancel(null)}
              disabled={isSubmittingItemCancel}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Cancelar Plato en Mesa {itemToCancel.mesa}</h3>
                <p className="text-xs text-rose-300 font-bold">
                  {itemToCancel.item.cantidad}x {itemToCancel.item.nombre}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Motivo de la cancelación:
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {[
                  "Sin ingredientes / Stock agotado",
                  "Demora en preparación",
                  "Problema en cocina",
                  "Otro",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelItemReason(reason)}
                    className={`p-2.5 rounded-xl border text-left font-medium transition flex items-center justify-between ${
                      cancelItemReason === reason
                        ? "bg-rose-950/60 border-rose-500 text-rose-200"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{reason}</span>
                    {cancelItemReason === reason && <Check className="w-4 h-4 text-rose-400" />}
                  </button>
                ))}
              </div>

              {cancelItemReason === "Otro" && (
                <input
                  type="text"
                  placeholder="Especifica el motivo..."
                  value={cancelItemCustomReason}
                  onChange={(e) => setCancelItemCustomReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500 mt-2"
                />
              )}
            </div>

            {/* SWITCH OPCIÓN DE STOCK */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelMarcarAgotado}
                  onChange={(e) => setCancelMarcarAgotado(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-700 bg-slate-900"
                />
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Marcar este plato como AGOTADO en el Menú
                </span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6.5">
                Se desactivará en la carta digital y en el sistema de meseros para evitar que lo vuelvan a ordenar hoy.
              </p>
            </div>

            <p className="text-[11px] text-amber-300/90 italic bg-amber-950/20 p-2.5 rounded-xl border border-amber-900/40">
              💡 El monto del plato se descontará de la cuenta y el mesero recibirá una notificación sonora en su pantalla.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToCancel(null)}
                disabled={isSubmittingItemCancel}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelItem}
                disabled={isSubmittingItemCancel}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {isSubmittingItemCancel ? "Cancelando..." : "Confirmar Cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR COMANDA COMPLETA (COCINA) */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setOrderToCancel(null)}
              disabled={isSubmittingOrderCancel}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Anular Comanda en Mesa {orderToCancel.mesa}</h3>
                <p className="text-xs text-slate-400">
                  Esta acción rechazará y cancelará el pedido completo.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Motivo de cancelación:
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {[
                  "Sin ingredientes suficientes",
                  "Cocina colapsada / Saturación",
                  "Mesa desocupada / Error",
                  "Otro",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelOrderReason(reason)}
                    className={`p-2.5 rounded-xl border text-left font-medium transition flex items-center justify-between ${
                      cancelOrderReason === reason
                        ? "bg-rose-950/60 border-rose-500 text-rose-200"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{reason}</span>
                    {cancelOrderReason === reason && <Check className="w-4 h-4 text-rose-400" />}
                  </button>
                ))}
              </div>

              {cancelOrderReason === "Otro" && (
                <input
                  type="text"
                  placeholder="Especifica el motivo..."
                  value={cancelOrderCustomReason}
                  onChange={(e) => setCancelOrderCustomReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500 mt-2"
                />
              )}
            </div>

            <p className="text-[11px] text-rose-300/90 italic bg-rose-950/30 p-2.5 rounded-xl border border-rose-900/40">
              ⚠️ La mesa quedará libre y el mesero será notificado en tiempo real con una alerta en su terminal.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={isSubmittingOrderCancel}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                disabled={isSubmittingOrderCancel}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition active:scale-95 disabled:opacity-50"
              >
                {isSubmittingOrderCancel ? "Anulando..." : "Anular Toda la Comanda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
