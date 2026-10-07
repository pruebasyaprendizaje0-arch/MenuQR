"use client";

import React, { useEffect, useState, useRef, useTransition } from "react";
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
  AlertCircle,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  Store,
  Wifi,
  WifiOff,
} from "lucide-react";

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
  estado: "nuevo" | "en_cocina" | "listo" | "por_pagar" | "pagado";
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

export default function CocinaPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [selectedNegocioId, setSelectedNegocioId] = useState<string>("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showProductBar, setShowProductBar] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [, startTransition] = useTransition();

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reproducir sonido y vibración
  const triggerNotification = () => {
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate(200);
      }
    } catch (e) {
      console.warn("Vibration error:", e);
    }

    if (soundEnabled) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/sounds/new-order.mp3");
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          console.warn("Autoplay audio blocked or error:", err);
        });
      } catch (err) {
        console.warn("Audio trigger error:", err);
      }
    }
  };

  // Desbloquear audio con interacción del usuario
  const unlockAudio = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/new-order.mp3");
      }
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
        setAudioUnlocked(true);
      }).catch(() => {
        setAudioUnlocked(true);
      });
    } catch {
      setAudioUnlocked(true);
    }
  };

  // Cargar lista de negocios
  useEffect(() => {
    async function loadNegocios() {
      try {
        const res = await fetch("/api/negocios");
        const data = await res.json();
        if (data.ok && Array.isArray(data.negocios)) {
          setNegocios(data.negocios);
          if (data.negocios.length > 0) {
            setSelectedNegocioId(data.active_id || data.negocios[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading negocios:", err);
      }
    }
    loadNegocios();
  }, []);

  // Cargar pedidos y productos al cambiar negocio
  useEffect(() => {
    if (!selectedNegocioId) return;

    let isMounted = true;
    setLoading(true);

    async function fetchData() {
      try {
        // Cargar pedidos activos
        const [pedidosRes, negocioDetailRes] = await Promise.all([
          fetch(`/api/pedidos?negocio_id=${selectedNegocioId}&activos=true`),
          fetch(`/api/negocios/${selectedNegocioId}`),
        ]);

        const pedidosData = await pedidosRes.json();
        const negocioData = await negocioDetailRes.json();

        if (isMounted) {
          if (pedidosData.ok) {
            setPedidos(pedidosData.pedidos || []);
          }
          if (negocioData.ok && negocioData.productos) {
            setProductos(negocioData.productos);
          }
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
  }, [selectedNegocioId]);

  // Conexión Socket.IO en /api/socket
  useEffect(() => {
    if (!selectedNegocioId) return;

    // Inicializar conexión
    const socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      query: { negocio_id: selectedNegocioId },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Cocina] Socket conectado:", socket.id);
      setSocketConnected(true);
      socket.emit("join_negocio", selectedNegocioId);
    });

    socket.on("disconnect", () => {
      console.log("[Cocina] Socket desconectado");
      setSocketConnected(false);
    });

    // Escucha 'nuevo_pedido' -> suena + vibra + agrega
    socket.on("nuevo_pedido", (nuevoPedido: Pedido) => {
      console.log("[Cocina] Recibido 'nuevo_pedido':", nuevoPedido);
      triggerNotification();

      setPedidos((prev) => {
        // Evitar duplicados
        if (prev.some((p) => p.id === nuevoPedido.id)) {
          return prev.map((p) => (p.id === nuevoPedido.id ? nuevoPedido : p));
        }
        return [nuevoPedido, ...prev];
      });
    });

    // Escucha 'items_añadidos' -> agrega solo los nuevos items a la mesa
    socket.on(
      "items_añadidos",
      ({ mesa, items }: { mesa: string; items: PedidoItem[] }) => {
        console.log(`[Cocina] Recibido 'items_añadidos' en Mesa ${mesa}:`, items);
        triggerNotification();

        setPedidos((prev) => {
          return prev.map((pedido) => {
            if (String(pedido.mesa) === String(mesa) && pedido.estado !== "pagado") {
              const existingItemIds = new Set(pedido.items.map((i) => i.id));
              const itemsToAppend = items.filter((i) => !existingItemIds.has(i.id));

              // Recalcular total
              const addedSum = itemsToAppend.reduce(
                (sum, i) => sum + i.cantidad * i.precio,
                0
              );

              return {
                ...pedido,
                total: pedido.total + addedSum,
                items: [...pedido.items, ...itemsToAppend],
              };
            }
            return pedido;
          });
        });
      }
    );

    // Escucha 'pedido_actualizado'
    socket.on("pedido_actualizado", (pedidoActualizado: any) => {
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

    // Escucha 'producto_actualizado'
    socket.on("producto_actualizado", (prodActualizado: any) => {
      setProductos((prev) =>
        prev.map((p) =>
          p.id === prodActualizado.id
            ? { ...p, isAvailable: prodActualizado.isAvailable }
            : p
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedNegocioId, soundEnabled]);

  // Actualizar estado de pedido (ACEPTAR -> en_cocina, LISTO -> listo)
  const cambiarEstado = async (
    pedidoId: string,
    nuevoEstado: "en_cocina" | "listo"
  ) => {
    try {
      // Optimistic update
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
      );

      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!res.ok) {
        throw new Error("No se pudo actualizar el estado del pedido");
      }
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      // Revertir recargando pedidos
      fetch(`/api/pedidos?negocio_id=${selectedNegocioId}&activos=true`)
        .then((r) => r.json())
        .then((d) => d.ok && setPedidos(d.pedidos));
    }
  };

  // Toggle disponibilidad de producto
  const toggleProducto = async (productoId: string, currentVal: boolean) => {
    const newVal = !currentVal;

    // Actualización optimista local
    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? { ...p, isAvailable: newVal } : p))
    );

    try {
      const res = await fetch(`/api/productos/${productoId}/disponible`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isAvailable: newVal,
          negocio_id: selectedNegocioId,
        }),
      });

      if (!res.ok) {
        throw new Error("Error guardando disponibilidad");
      }

      // Notificar a otros clientes por socket
      if (socketRef.current) {
        socketRef.current.emit("producto_actualizado", {
          id: productoId,
          isAvailable: newVal,
          negocio_id: selectedNegocioId,
        });
      }
    } catch (err) {
      console.error("Error actualizando producto:", err);
      // Revertir
      setProductos((prev) =>
        prev.map((p) =>
          p.id === productoId ? { ...p, isAvailable: currentVal } : p
        )
      );
    }
  };

  // Helper tiempo relativo "hace X min"
  const calcularHaceMinutos = (fechaStr: string) => {
    try {
      const diffMs = Date.now() - new Date(fechaStr).getTime();
      const mins = Math.max(0, Math.floor(diffMs / 60000));
      if (mins < 1) return "Hace unos segundos";
      if (mins === 1) return "Hace 1 min";
      if (mins < 60) return `Hace ${mins} min`;
      const hrs = Math.floor(mins / 60);
      return `Hace ${hrs} h ${mins % 60} m`;
    } catch {
      return "Hace poco";
    }
  };

  // Columnas Kanban
  const pedidosNuevos = pedidos.filter((p) => p.estado === "nuevo");
  const pedidosEnCocina = pedidos.filter((p) => p.estado === "en_cocina");
  const pedidosListos = pedidos.filter(
    (p) => p.estado === "listo" || p.estado === "por_pagar"
  );

  const filteredProducts = productos.filter((p) =>
    p.name.toLowerCase().includes(productFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* HEADER SUPERIOR */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* TÍTULO Y NEGOCIO */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <ChefHat className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Módulo Cocina
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    KDS Live
                  </span>
                </h1>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Store className="w-3.5 h-3.5 text-slate-500" />
                {negocios.length > 1 ? (
                  <select
                    value={selectedNegocioId}
                    onChange={(e) => setSelectedNegocioId(e.target.value)}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                  >
                    {negocios.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{negocios[0]?.nombre || "Cargando negocio..."}</span>
                )}
              </div>
            </div>
          </div>

          {/* ESTADO CONEXIÓN Y CONTROLES */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
            {/* BADGE SOCKET */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-medium border ${
                socketConnected
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                  : "bg-rose-950/60 text-rose-400 border-rose-800 animate-pulse"
              }`}
            >
              {socketConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>En Vivo</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Reconectando...</span>
                </>
              )}
            </div>

            {/* BOTÓN SONIDO */}
            <button
              onClick={() => {
                unlockAudio();
                setSoundEnabled(!soundEnabled);
              }}
              title={soundEnabled ? "Silenciar alarmas" : "Activar sonido"}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg border font-medium transition ${
                soundEnabled
                  ? "bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700"
                  : "bg-slate-800/60 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Sonido ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Mudo</span>
                </>
              )}
            </button>

            {/* TOGGLE PANEL PRODUCTOS */}
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

            {/* REFRESCAR MANUAL */}
            <button
              onClick={() => {
                setLoading(true);
                fetch(`/api/pedidos?negocio_id=${selectedNegocioId}&activos=true`)
                  .then((r) => r.json())
                  .then((d) => d.ok && setPedidos(d.pedidos))
                  .finally(() => setLoading(false));
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700 transition"
              title="Recargar pedidos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* LINK MÓDULO MESEROS */}
            <a
              href="/mesas"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 font-medium transition"
            >
              <span>Ver Mesas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* BARRA HORIZONTAL DE GESTIÓN RÁPIDA DE DISPONIBILIDAD (STOCK ON/OFF) */}
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
                    <span className="font-medium max-w-[140px] truncate">
                      {p.name}
                    </span>
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
                  <span className="text-xs text-slate-500 py-1">
                    No se encontraron productos.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* BANNER DESBLOQUEO DE AUDIO (SI NAVEGADOR BLOQUEA AUTOPLAY) */}
      {!audioUnlocked && soundEnabled && (
        <div
          onClick={unlockAudio}
          className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition"
        >
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 animate-bounce text-amber-400" />
            <span>
              Haz click aquí para activar las alertas sonoras de nuevos pedidos en este navegador.
            </span>
          </div>
          <span className="font-bold underline text-[11px]">ACTIVAR SONIDO</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL: KANBAN 3 COLUMNAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* ================= COLUMNA 1: NUEVO ================= */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-rose-400">
                  NUEVO
                </h2>
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
                  {/* Encabezado Card */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                    <div>
                      <span className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                        Mesa {pedido.mesa}
                      </span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                        <Clock className="w-3 h-3" />
                        <span>{calcularHaceMinutos(pedido.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Items del pedido */}
                  <div className="space-y-2 mb-3">
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg text-xs ${
                          item.es_añadido
                            ? "bg-amber-950/30 border border-amber-600/40"
                            : "bg-slate-900 border border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center space-x-2 font-bold text-slate-100">
                            <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-mono">
                              {item.cantidad}x
                            </span>
                            <span className="text-sm">{item.nombre}</span>
                          </div>
                          {item.es_añadido && (
                            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                              AÑADIDO
                            </span>
                          )}
                        </div>
                        {item.notas && (
                          <p className="mt-1 text-[11px] text-amber-300/90 italic bg-amber-950/20 px-1.5 py-0.5 rounded">
                            💬 Nota: {item.notas}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botón Acción: ACEPTAR */}
                  <button
                    onClick={() => cambiarEstado(pedido.id, "en_cocina")}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 flex items-center justify-center space-x-1.5 transition active:scale-95"
                  >
                    <Flame className="w-4 h-4 text-slate-950" />
                    <span>ACEPTAR (A Cocina)</span>
                  </button>
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

          {/* ================= COLUMNA 2: EN COCINA ================= */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400">
                  EN COCINA
                </h2>
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
                  {/* Encabezado Card */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                    <div>
                      <span className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                        Mesa {pedido.mesa}
                      </span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>{calcularHaceMinutos(pedido.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Items del pedido */}
                  <div className="space-y-2 mb-3">
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg text-xs ${
                          item.es_añadido
                            ? "bg-amber-950/40 border border-amber-500/50"
                            : "bg-slate-900 border border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center space-x-2 font-bold text-slate-100">
                            <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-mono">
                              {item.cantidad}x
                            </span>
                            <span className="text-sm">{item.nombre}</span>
                          </div>
                          {item.es_añadido && (
                            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                              AÑADIDO
                            </span>
                          )}
                        </div>
                        {item.notas && (
                          <p className="mt-1 text-[11px] text-amber-300/90 italic bg-amber-950/20 px-1.5 py-0.5 rounded">
                            💬 Nota: {item.notas}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botón Acción: LISTO */}
                  <button
                    onClick={() => cambiarEstado(pedido.id, "listo")}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1.5 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>LISTO (Avisar a Mesero)</span>
                  </button>
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

          {/* ================= COLUMNA 3: LISTO ================= */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 shadow-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-400">
                  LISTO PARA SERVIR
                </h2>
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
                      <span className="text-xl font-black text-white tracking-tight">
                        Mesa {pedido.mesa}
                      </span>
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{pedido.camarero_nombre || "Camarero"}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold text-[11px] px-2 py-0.5 rounded-full">
                      Listo en mesa
                    </span>
                  </div>

                  <div className="space-y-1 mb-2">
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs text-slate-300 py-0.5"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-mono font-bold">
                            {item.cantidad}x
                          </span>
                          <span>{item.nombre}</span>
                        </span>
                        {item.es_añadido && (
                          <span className="text-[10px] text-amber-400 font-semibold">
                            (Añadido)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Total mesa:</span>
                    <span className="text-emerald-400 font-bold text-sm font-mono">
                      ${pedido.total.toFixed(2)}
                    </span>
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
    </div>
  );
}
