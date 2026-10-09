"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  Users,
  Clock,
  Plus,
  Receipt,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ChefHat,
  Bell,
  X,
  Search,
  Check,
  CreditCard,
  UserCheck,
  ArrowLeft,
  Coffee,
  AlertTriangle,
  Store,
  Edit2,
  Trash2,
  Save,
  UserPlus,
  Volume2,
  VolumeX,
  Lock,
  LogOut,
  KeyRound,
} from "lucide-react";
import { kitchenAudio } from "@/lib/kitchen-audio";
import { MesasPinLockScreen } from "./MesasPinLockScreen";

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
  cliente_nombre?: string;
  cliente_telefono?: string;
  solicita_mesero?: boolean;
  total: number;
  created_at: string;
  items: PedidoItem[];
}

interface Negocio {
  id: string;
  nombre: string;
  slug: string;
  numero_mesas: number;
}

interface Camarero {
  id: string;
  nombre: string;
  pin?: string;
}

interface Producto {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  category?: { name: string };
}

interface MetricaCamarero {
  camarero_id: string;
  camarero_nombre: string;
  mesas_atendidas: number;
  total_vendido: number;
  ticket_promedio: number;
}

export function MesasClient({ initialSlug }: { initialSlug: string }) {
  const [negocioInfo, setNegocioInfo] = useState<Negocio | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [camareros, setCamareros] = useState<Camarero[]>([]);
  const [selectedCamareroId, setSelectedCamareroId] = useState<string>("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [metricas, setMetricas] = useState<MetricaCamarero[]>([]);
  const [loading, setLoading] = useState(true);

  // Mesa seleccionada para modal
  const [activeMesaNumber, setActiveMesaNumber] = useState<number | null>(null);

  // Catálogo drawer para añadir productos
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [cartToAdd, setCartToAdd] = useState<{
    [productId: string]: { producto: Producto; cantidad: number; notas: string };
  }>({});

  // Gestión / Edición de meseros
  const [showWaitersModal, setShowWaitersModal] = useState(false);
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterPin, setNewWaiterPin] = useState("1234");

  // Sesión de turno de camarero con PIN
  const [activeCamarero, setActiveCamarero] = useState<{ id: string; nombre: string } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Sonido y conectividad en tiempo real
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const initialLoadedRef = useRef(false);
  const pedidosRef = useRef<Pedido[]>([]);
  pedidosRef.current = pedidos;

  // Estados de Cancelación de Plato Individual (Opción 2)
  const [itemToCancel, setItemToCancel] = useState<{
    pedidoId: string;
    mesa: string;
    item: PedidoItem;
  } | null>(null);
  const [cancelItemReason, setCancelItemReason] = useState("Error de digitación del mesero");
  const [cancelItemCustomReason, setCancelItemCustomReason] = useState("");
  const [isSubmittingItemCancel, setIsSubmittingItemCancel] = useState(false);

  // Estados de Cancelación de Comanda Completa
  const [orderToCancel, setOrderToCancel] = useState<{
    pedidoId: string;
    mesa: string;
  } | null>(null);
  const [cancelOrderReason, setCancelOrderReason] = useState("Cliente se retiró del local");
  const [cancelOrderCustomReason, setCancelOrderCustomReason] = useState("");
  const [isSubmittingOrderCancel, setIsSubmittingOrderCancel] = useState(false);

  // Alerta sonora y visual recibida desde Cocina
  const [cancellationAlert, setCancellationAlert] = useState<{
    id: string;
    mesa: string;
    plato_nombre?: string;
    motivo: string;
    cancelado_por: "cocina" | "mesero";
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Recuperar sesión activa de mesero de sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`menuqr_active_camarero_${initialSlug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.nombre) {
          setActiveCamarero(parsed);
          setSelectedCamareroId(parsed.id);
        }
      }
    } catch {}
    setSessionChecked(true);
  }, [initialSlug]);

  const handleLoginSuccess = (cam: { id: string; nombre: string }) => {
    setActiveCamarero(cam);
    setSelectedCamareroId(cam.id);
    try {
      sessionStorage.setItem(`menuqr_active_camarero_${initialSlug}`, JSON.stringify(cam));
    } catch {}
  };

  const handleLogoutCamarero = () => {
    setActiveCamarero(null);
    try {
      sessionStorage.removeItem(`menuqr_active_camarero_${initialSlug}`);
    } catch {}
  };

  // 1. Cargar detalle de negocio por slug
  useEffect(() => {
    async function loadInitial() {
      try {
        const negRes = await fetch(`/api/negocios?slug=${encodeURIComponent(initialSlug)}`);
        const negData = await negRes.json();
        if (negData.ok && negData.negocios?.length > 0) {
          const neg = negData.negocios[0];
          setNegocioInfo(neg);
          refreshAll(neg.id);
        }
      } catch (err) {
        console.error("Error loading negocio by slug in Mesas:", err);
      }
    }
    loadInitial();
  }, [initialSlug]);

  const refreshAll = async (negocioId: string) => {
    if (!negocioId) return;
    try {
      const [detailRes, pedidosRes, metricasRes] = await Promise.all([
        fetch(`/api/negocios/${negocioId}`),
        fetch(`/api/pedidos?negocio_id=${negocioId}&activos=true`),
        fetch(`/api/pedidos/metricas?negocio_id=${negocioId}`),
      ]);

      const nData = await detailRes.json();
      const pData = await pedidosRes.json();
      const mData = await metricasRes.json();

      if (nData.ok) {
        setNegocioInfo(nData.negocio);
        setCamareros(nData.camareros || []);
        if (nData.camareros?.length > 0 && !selectedCamareroId) {
          setSelectedCamareroId(nData.camareros[0].id);
        }
        setProductos(nData.productos || []);
      }

      if (pData.ok) {
        setPedidos(pData.pedidos || []);
      }

      if (mData.ok) {
        setMetricas(mData.metricas || []);
      }
      setTimeout(() => {
        initialLoadedRef.current = true;
      }, 1200);
    } catch (err) {
      console.error("Error refreshing mesas data:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Conectar a Socket.IO
  useEffect(() => {
    if (!negocioInfo?.id) return;

    const socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      query: { negocio_id: negocioInfo.id },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsLiveConnected(true);
      socket.emit("join_negocio", negocioInfo.id);
    });

    socket.on("disconnect", () => {
      setIsLiveConnected(false);
    });

    socket.on("nuevo_pedido", (nuevoPedido: Pedido) => {
      setPedidos((prev) => {
        if (prev.some((p) => p.id === nuevoPedido.id)) return prev;
        return [...prev, nuevoPedido];
      });
      refreshMetricas();
    });

    socket.on("items_añadidos", ({ mesa, items }: { mesa: string; items: PedidoItem[] }) => {
      setPedidos((prev) =>
        prev.map((p) => {
          if (String(p.mesa) === String(mesa) && p.estado !== "pagado") {
            const addedSum = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
            return {
              ...p,
              total: p.total + addedSum,
              items: [...p.items, ...items],
            };
          }
          return p;
        })
      );
      refreshMetricas();
    });

    socket.on("pedido_actualizado", (pedidoActualizado: any) => {
      if (soundEnabled) {
        if (pedidoActualizado.solicita_mesero || pedidoActualizado.tipo_alerta === "llamar_mesero") {
          kitchenAudio.playLlamarMesero();
        } else if (pedidoActualizado.estado === "listo") {
          kitchenAudio.playListoParaServir();
        } else if (pedidoActualizado.estado === "en_cocina") {
          kitchenAudio.playEnCocina();
        }
      }

      if (pedidoActualizado.estado === "pagado" || pedidoActualizado.estado === "cancelado") {
        setPedidos((prev) => prev.filter((p) => p.id !== pedidoActualizado.id));
      } else {
        setPedidos((prev) => {
          const index = prev.findIndex((p) => p.id === pedidoActualizado.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = { ...copy[index], ...pedidoActualizado };
            return copy;
          }
          return [...prev, pedidoActualizado];
        });
      }
      refreshMetricas();
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
      if (data?.cancelado_por === "cocina") {
        if (soundEnabled) {
          kitchenAudio.playCancelacion();
        }
        setCancellationAlert({
          id: String(Date.now()),
          mesa: data.mesa,
          plato_nombre: data.plato_nombre,
          motivo: data.motivo,
          cancelado_por: "cocina",
        });
      }
    });

    socket.on("pedido_cancelado", (data: any) => {
      setPedidos((prev) => prev.filter((p) => p.id !== data.pedido_id));
      if (data?.cancelado_por === "cocina") {
        if (soundEnabled) {
          kitchenAudio.playCancelacion();
        }
        setCancellationAlert({
          id: String(Date.now()),
          mesa: data.mesa,
          motivo: data.motivo,
          cancelado_por: "cocina",
        });
      }
      refreshMetricas();
    });

    return () => {
      socket.disconnect();
    };
  }, [negocioInfo?.id, soundEnabled]);

  // 3. Canal de respaldo: Polling liviano si Socket.IO no está conectado (sin saturar sockets HTTP)
  useEffect(() => {
    if (!negocioInfo?.id || isLiveConnected) return;

    let isPolling = true;
    const interval = setInterval(async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          fetch(`/api/pedidos?negocio_id=${negocioInfo.id}&activos=true`, { cache: "no-store" }),
          fetch(`/api/pedidos/metricas?negocio_id=${negocioInfo.id}`, { cache: "no-store" }),
        ]);
        const pData = await pRes.json();
        const mData = await mRes.json();
        if (isPolling) {
          if (pData.ok && Array.isArray(pData.pedidos)) {
            setPedidos(pData.pedidos);
            pedidosRef.current = pData.pedidos;
          }
          if (mData.ok && Array.isArray(mData.metricas)) {
            setMetricas(mData.metricas);
          }
        }
      } catch (err) {
        console.warn("[Mesas fallback poll] Error:", err);
      }
    }, 8000);

    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [negocioInfo?.id, isLiveConnected]);

  const refreshMetricas = () => {
    if (!negocioInfo?.id) return;
    fetch(`/api/pedidos/metricas?negocio_id=${negocioInfo.id}`)
      .then((r) => r.json())
      .then((d) => d.ok && setMetricas(d.metricas || []));
  };

  const getPedidoForMesa = (numMesa: number) => {
    return pedidos.find(
      (p) => String(p.mesa) === String(numMesa) && p.estado !== "pagado" && p.estado !== "cancelado"
    );
  };

  const activePedido = activeMesaNumber ? getPedidoForMesa(activeMesaNumber) : null;

  // Manejar confirmación de cancelación de plato individual (Mesero)
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
          cancelado_por: "mesero",
          marcar_agotado: false,
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
        setItemToCancel(null);
        refreshMetricas();
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

  // Manejar confirmación de cancelación de comanda completa (Mesero)
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
          cancelado_por: "mesero",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPedidos((prev) => prev.filter((p) => p.id !== orderToCancel.pedidoId));
        setOrderToCancel(null);
        setActiveMesaNumber(null);
        refreshMetricas();
      } else {
        alert(data.error || "No se pudo anular la comanda");
      }
    } catch (err) {
      console.error("Error al anular pedido:", err);
      alert("Error de conexión al anular comanda");
    } finally {
      setIsSubmittingOrderCancel(false);
    }
  };

  const handleCerrarCuenta = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "por_pagar" }),
      });
      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === pedidoId ? { ...p, estado: "por_pagar" } : p))
        );
        refreshMetricas();
      }
    } catch (e) {
      console.error("Error cerrando cuenta:", e);
    }
  };

  const handlePagarYLiberar = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "pagado" }),
      });
      if (res.ok) {
        setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
        setActiveMesaNumber(null);
        refreshMetricas();
      }
    } catch (e) {
      console.error("Error liberando mesa:", e);
    }
  };

  const updateCartQty = (producto: Producto, delta: number) => {
    setCartToAdd((prev) => {
      const current = prev[producto.id]?.cantidad || 0;
      const nextQty = Math.max(0, current + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[producto.id];
        return copy;
      }
      return {
        ...prev,
        [producto.id]: {
          producto,
          cantidad: nextQty,
          notas: prev[producto.id]?.notas || "",
        },
      };
    });
  };

  const updateCartNotas = (productoId: string, notas: string) => {
    setCartToAdd((prev) => {
      if (!prev[productoId]) return prev;
      return {
        ...prev,
        [productoId]: {
          ...prev[productoId],
          notas,
        },
      };
    });
  };

  const submitAddItemsToMesa = async () => {
    if (!activeMesaNumber || !negocioInfo?.id) return;

    const itemsToSend = Object.values(cartToAdd).map((item) => ({
      nombre: item.producto.name,
      cantidad: item.cantidad,
      precio: item.producto.price,
      notas: item.notas || null,
    }));

    if (itemsToSend.length === 0) {
      alert("Selecciona al menos un producto para enviar a cocina.");
      return;
    }

    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: negocioInfo.id,
          mesa: String(activeMesaNumber),
          camarero_id: activeCamarero?.id || selectedCamareroId || undefined,
          items: itemsToSend,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setCartToAdd({});
        setShowCatalogDrawer(false);
        if (data.pedido) {
          setPedidos((prev) => {
            const index = prev.findIndex((p) => p.id === data.pedido.id);
            if (index !== -1) {
              const copy = [...prev];
              copy[index] = data.pedido;
              return copy;
            }
            return [...prev, data.pedido];
          });
        }
        refreshMetricas();
      } else {
        alert(data.error || "Error al añadir productos a la mesa.");
      }
    } catch (e) {
      console.error("Error enviando productos a mesa:", e);
    }
  };

  // Gestión de meseros con nombre y PIN
  const handleUpdateWaiter = async (waiterId: string, nuevoNombre: string, nuevoPin?: string) => {
    if (!nuevoNombre.trim()) return;
    try {
      const res = await fetch(`/api/camareros/${waiterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoNombre.trim(),
          pin: nuevoPin !== undefined ? nuevoPin.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCamareros((prev) =>
          prev.map((c) =>
            c.id === waiterId
              ? { ...c, nombre: nuevoNombre.trim(), pin: nuevoPin !== undefined ? nuevoPin.trim() : c.pin }
              : c
          )
        );
        if (activeCamarero?.id === waiterId) {
          const updated = { id: waiterId, nombre: nuevoNombre.trim() };
          setActiveCamarero(updated);
          sessionStorage.setItem(`menuqr_active_camarero_${initialSlug}`, JSON.stringify(updated));
        }
        refreshMetricas();
      } else {
        alert(data.error || "Error al actualizar los datos del mesero");
      }
    } catch (e) {
      console.error("Error actualizando mesero:", e);
    }
  };

  const handleAddWaiter = async () => {
    if (!newWaiterName.trim() || !negocioInfo?.id) return;
    try {
      const res = await fetch("/api/camareros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: negocioInfo.id,
          nombre: newWaiterName.trim(),
          pin: newWaiterPin?.trim() || "1234",
        }),
      });
      const data = await res.json();
      if (data.ok && data.camarero) {
        setCamareros((prev) => [...prev, data.camarero]);
        setNewWaiterName("");
        setNewWaiterPin("1234");
        refreshMetricas();
      } else {
        alert(data.error || "Error al crear mesero");
      }
    } catch (e) {
      console.error("Error creando mesero:", e);
    }
  };

  const handleDeleteWaiter = async (waiterId: string) => {
    if (!confirm("¿Deseas eliminar este mesero?")) return;
    try {
      const res = await fetch(`/api/camareros/${waiterId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setCamareros((prev) => prev.filter((c) => c.id !== waiterId));
        if (selectedCamareroId === waiterId) {
          setSelectedCamareroId(camareros.find((c) => c.id !== waiterId)?.id || "");
        }
        refreshMetricas();
      }
    } catch (e) {
      console.error("Error eliminando mesero:", e);
    }
  };

  const handleAtenderLlamada = async (pedido: Pedido) => {
    if (!negocioInfo?.id) return;
    try {
      await fetch("/api/pedidos/llamar-mesero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: negocioInfo.id,
          mesa: pedido.mesa,
          atendido: true,
        }),
      });
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido.id ? { ...p, solicita_mesero: false } : p))
      );
    } catch (e) {
      console.error("Error al atender llamada:", e);
    }
  };

  const calcularMinutosTranscurridos = (fechaStr: string) => {
    try {
      const mins = Math.max(0, Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000));
      return `${mins} min`;
    } catch {
      return "0 min";
    }
  };

  const numeroMesas = negocioInfo?.numero_mesas || 10;
  const listaMesas = Array.from({ length: numeroMesas }, (_, i) => i + 1);

  // Si la sesión no ha iniciado y hay meseros disponibles, mostrar pantalla de bloqueo con PIN
  if (sessionChecked && !activeCamarero) {
    return (
      <MesasPinLockScreen
        negocioNombre={negocioInfo?.nombre || initialSlug}
        negocioSlug={initialSlug}
        negocioId={negocioInfo?.id}
        camareros={camareros}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* HEADER DE CONTROL */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* TÍTULO Y NEGOCIO FIJO */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Módulo Mesero
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Mesa Abierta
                </span>
              </h1>
              <div className="flex items-center space-x-1.5 text-xs text-slate-300 mt-0.5 font-bold">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>{negocioInfo?.nombre || initialSlug}</span>
              </div>
            </div>
          </div>

          {/* CAMARERO Y ACCESOS */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* TURNO DE MESERO ACTIVO CON BOTÓN CAMBIAR / BLOQUEAR */}
            <div className="flex items-center space-x-2 bg-emerald-950/70 border border-emerald-700/60 px-3 py-1.5 rounded-xl shadow-sm">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <span className="text-[10px] text-emerald-400/80 block leading-none font-bold uppercase tracking-wider">
                  Turno:
                </span>
                <span className="text-xs font-black text-white">
                  {activeCamarero?.nombre || "Camarero"}
                </span>
              </div>
              <button
                onClick={handleLogoutCamarero}
                title="Bloquear terminal o cambiar mesero"
                className="ml-1 px-2 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 hover:text-white rounded-lg border border-emerald-700/80 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
              >
                <Lock className="w-3 h-3 text-amber-300" />
                <span className="hidden sm:inline">Cambiar</span>
              </button>
            </div>

            {/* BOTÓN EDITAR MESEROS */}
            <button
              onClick={() => setShowWaitersModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold transition shadow-sm"
              title="Editar nombres de los meseros"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Editar Meseros</span>
            </button>

            {/* ESTADO EN VIVO */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-medium border ${
                isLiveConnected
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-emerald-400 animate-ping" : "bg-slate-500"} inline-block`} />
              <span>{isLiveConnected ? "En Vivo" : "Conectando..."}</span>
            </div>

            {/* TOGGLE SONIDO MESERO */}
            <button
              onClick={() => {
                const nextVal = !soundEnabled;
                setSoundEnabled(nextVal);
                if (nextVal) kitchenAudio.unlock();
              }}
              title={soundEnabled ? "Silenciar alertas" : "Activar sonido"}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border font-bold transition ${
                soundEnabled
                  ? "bg-emerald-950/50 text-emerald-400 border-emerald-700/60"
                  : "bg-slate-800 text-slate-500 border-slate-700"
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Sonido ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Mudo</span>
                </>
              )}
            </button>

            {/* REFRESCAR */}
            <button
              onClick={() => negocioInfo?.id && refreshAll(negocioInfo.id)}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white transition"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* LINK DIRECTO A COCINA CON SLUG */}
            <a
              href={`/${initialSlug}/cocina`}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 font-medium transition"
            >
              <ChefHat className="w-4 h-4" />
              <span className="hidden sm:inline">Ir a Cocina</span>
            </a>
          </div>
        </div>
      </header>

      {/* BANNER DE ALERTA DE COCINA (CANCELACIÓN DE PLATO O PEDIDO) */}
      {cancellationAlert && (
        <div className="bg-gradient-to-r from-rose-950 via-red-900 to-slate-950 border-b-2 border-rose-500 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fadeIn sticky top-[57px] z-30">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <span>⚠️ Atención Mesa {cancellationAlert.mesa} — Cocina</span>
                <span className="bg-rose-500/30 text-rose-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  AVISO IMPORTANTE
                </span>
              </p>
              <p className="text-xs text-slate-200 mt-0.5">
                {cancellationAlert.plato_nombre
                  ? `Cocina canceló "${cancellationAlert.plato_nombre}" (${cancellationAlert.motivo}). Acércate a la mesa para ofrecer una alternativa al cliente.`
                  : `Cocina canceló la comanda completa (${cancellationAlert.motivo}). Mesa disponible.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveMesaNumber(parseInt(cancellationAlert.mesa) || null);
                setCancellationAlert(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow active:scale-95"
            >
              Ver Mesa {cancellationAlert.mesa}
            </button>
            <button
              onClick={() => setCancellationAlert(null)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Cerrar ✕
            </button>
          </div>
        </div>
      )}

      {/* LEYENDA RÁPIDA DE ESTADOS */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700 inline-block" />
              <span className="text-slate-400">Libre (Gris)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-500 inline-block" />
              <span className="text-emerald-300 font-semibold">Ocupada (Verde)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-400 inline-block" />
              <span className="text-amber-300 font-semibold">Por pagar (Amarillo)</span>
            </div>
          </div>
          <div className="text-slate-400 text-[11px]">
            Toca cualquier mesa para ver la cuenta, añadir platos o cobrar.
          </div>
        </div>
      </div>

      {/* GRID DE MESAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {listaMesas.map((num) => {
            const pedido = getPedidoForMesa(num);
            const isOcupada = Boolean(pedido && pedido.estado !== "por_pagar");
            const isPorPagar = Boolean(pedido && pedido.estado === "por_pagar");
            const isLibre = !pedido;
            const isListoEnCocina = pedido?.estado === "listo";
            const isLlamaMesero = Boolean(pedido?.solicita_mesero);

            return (
              <button
                key={num}
                onClick={() => {
                  setActiveMesaNumber(num);
                  setCartToAdd({});
                  setShowCatalogDrawer(false);
                }}
                className={`relative rounded-2xl p-4 text-left border-2 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-xl active:scale-95 flex flex-col justify-between min-h-[140px] ${
                  isLlamaMesero
                    ? "bg-red-950/70 border-red-500 text-red-200 shadow-lg shadow-red-950/60 ring-2 ring-red-500/50 animate-pulse"
                    : isLibre
                    ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    : isPorPagar
                    ? "bg-amber-950/60 border-amber-500 text-amber-200 shadow-amber-950/40"
                    : "bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-emerald-950/40"
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <span className="text-2xl font-black tracking-tight text-white">Mesa {num}</span>
                  <div className="flex flex-col items-end gap-1">
                    {isLlamaMesero && (
                      <span className="bg-red-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-md">
                        <Bell className="w-3 h-3 text-white animate-spin" />
                        ¡LLAMA!
                      </span>
                    )}
                    {isListoEnCocina && (
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-md">
                        <Bell className="w-3 h-3 text-slate-950" />
                        ¡LISTO!
                      </span>
                    )}
                  </div>
                </div>

                <div className="my-2">
                  {isLibre && (
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-400 text-xs font-semibold">
                      Disponible
                    </span>
                  )}
                  {pedido && isOcupada && (
                    <div className="space-y-0.5">
                      {pedido.cliente_nombre && (
                        <span className="text-[11px] font-bold text-slate-200 truncate block">
                          👤 {pedido.cliente_nombre}
                        </span>
                      )}
                      <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 block">
                        {pedido.estado === "nuevo"
                          ? "Nuevo"
                          : pedido.estado === "en_cocina"
                          ? "En Cocina"
                          : "Listo"}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        {pedido.items.length} items • {calcularMinutosTranscurridos(pedido.created_at)}
                      </span>
                    </div>
                  )}
                  {pedido && isPorPagar && (
                    <div className="space-y-0.5">
                      {pedido.cliente_nombre && (
                        <span className="text-[11px] font-bold text-amber-300 truncate block">
                          👤 {pedido.cliente_nombre}
                        </span>
                      )}
                      <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300 block">
                        Por Pagar
                      </span>
                      <span className="text-xs text-amber-200/80 block">
                        {pedido.items.length} items consumidos
                      </span>
                    </div>
                  )}
                </div>

                <div className="w-full pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  {pedido ? (
                    <>
                      <span className="text-[11px] text-slate-400">Total:</span>
                      <span
                        className={`text-lg font-black font-mono ${
                          isPorPagar ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        ${pedido.total.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Toca para abrir</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* MÉTRICAS DIARIAS */}
        <section className="mt-12 bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                Rendimiento Diario de Camareros (Hoy)
              </h2>
            </div>
            <span className="text-xs text-slate-400">SELECT ... WHERE fecha=hoy GROUP BY camarero_id</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Camarero</th>
                  <th className="py-2.5 px-3 text-center">Mesas Atendidas</th>
                  <th className="py-2.5 px-3 text-right">Total Vendido</th>
                  <th className="py-2.5 px-3 text-right">Ticket Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {metricas.map((m) => (
                  <tr key={m.camarero_id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {m.camarero_nombre}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-300">
                      {m.mesas_atendidas} mesas
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400 text-sm">
                      ${m.total_vendido.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                      ${m.ticket_promedio.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {metricas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 italic">
                      No hay ventas registradas el día de hoy todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL MESA SELECCIONADA */}
      {activeMesaNumber !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  Mesa {activeMesaNumber}
                  {activePedido && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        activePedido.estado === "por_pagar"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {activePedido.estado}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activePedido ? (
                    <>
                      {activePedido.cliente_nombre && (
                        <span className="text-emerald-400 font-bold mr-2">
                          👤 {activePedido.cliente_nombre} •
                        </span>
                      )}
                      Camarero: <span className="text-white font-medium">{activePedido.camarero_nombre || "Camarero"}</span> • Abierta hace {calcularMinutosTranscurridos(activePedido.created_at)}
                    </>
                  ) : (
                    "Mesa libre - Inicia una comanda para abrir la mesa"
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveMesaNumber(null);
                  setShowCatalogDrawer(false);
                }}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activePedido && activePedido.solicita_mesero && (
                <div className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-3.5 flex items-center justify-between text-xs animate-pulse shadow-lg shadow-red-950/50">
                  <div className="flex items-center gap-2 text-red-200 font-bold">
                    <Bell className="w-4 h-4 text-red-400 animate-spin shrink-0" />
                    <span>
                      ¡El comensal {activePedido.cliente_nombre ? `(${activePedido.cliente_nombre})` : ""} solicita atención inmediata del mesero!
                    </span>
                  </div>
                  <button
                    onClick={() => handleAtenderLlamada(activePedido)}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition active:scale-95 shrink-0 shadow-md flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Atendido
                  </button>
                </div>
              )}

              {activePedido ? (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                    <span>Items en Comanda ({activePedido.items.length})</span>
                    <span>Subtotal</span>
                  </div>

                  <div className="space-y-2">
                    {activePedido.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                          item.es_añadido ? "bg-amber-950/20 border-amber-600/40 text-amber-200" : "bg-slate-950 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                              {item.cantidad}x
                            </span>
                            <span className="font-semibold text-sm text-white">{item.nombre}</span>
                            {item.es_añadido && (
                              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded uppercase">
                                AÑADIDO
                              </span>
                            )}
                          </div>
                          {item.notas && (
                            <p className="text-[11px] text-amber-300 italic">💬 {item.notas}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="text-right font-mono font-bold text-sm text-slate-100">
                            ${(item.cantidad * item.precio).toFixed(2)}
                          </div>
                          <button
                            onClick={() => {
                              setItemToCancel({ pedidoId: activePedido.id, mesa: String(activePedido.mesa), item });
                              setCancelItemReason("Error de digitación del mesero");
                              setCancelItemCustomReason("");
                            }}
                            title="Eliminar plato de la comanda"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-700/60 hover:bg-rose-950/40 transition active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-lg font-black text-white">
                      <span>Total de la Cuenta:</span>
                      <span className="font-mono text-2xl text-emerald-400">${activePedido.total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Coffee className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm">
                    Esta mesa está libre actualmente. Pulsa el botón de abajo para abrir la mesa y seleccionar platos del catálogo.
                  </p>
                </div>
              )}

              {/* CATÁLOGO DRAWER */}
              {showCatalogDrawer && (
                <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Catálogo de Platos
                    </span>
                    <button
                      onClick={() => setShowCatalogDrawer(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cerrar catálogo
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {productos
                      .filter((p) => p.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                      .map((prod) => {
                        const inCart = cartToAdd[prod.id];
                        const qty = inCart?.cantidad || 0;

                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-xl border text-xs flex flex-col gap-2 transition ${
                              qty > 0 ? "bg-emerald-950/30 border-emerald-500/50" : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-white block">{prod.name}</span>
                                <span className="text-emerald-400 font-mono font-semibold">${prod.price.toFixed(2)}</span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateCartQty(prod, -1)}
                                  disabled={qty === 0}
                                  className="w-7 h-7 rounded-lg bg-slate-800 disabled:opacity-30 text-white font-black flex items-center justify-center hover:bg-slate-700 transition"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center font-mono font-bold text-white">{qty}</span>
                                <button
                                  onClick={() => updateCartQty(prod, 1)}
                                  disabled={!prod.isAvailable}
                                  className="w-7 h-7 rounded-lg bg-emerald-600 disabled:opacity-30 text-white font-black flex items-center justify-center hover:bg-emerald-500 transition"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {qty > 0 && (
                              <input
                                type="text"
                                placeholder="Nota especial (ej. sin cebolla, término medio)..."
                                value={inCart.notas}
                                onChange={(e) => updateCartNotas(prod.id, e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-200 outline-none focus:border-amber-500"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {Object.keys(cartToAdd).length > 0 && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        {Object.values(cartToAdd).reduce((a, b) => a + b.cantidad, 0)} items seleccionados
                      </span>
                      <button
                        onClick={submitAddItemsToMesa}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-400 transition"
                      >
                        Enviar a Cocina
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTONES ACCIÓN FOOTER */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2.5">
              <button
                onClick={() => setShowCatalogDrawer(!showCatalogDrawer)}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Añadir Producto</span>
              </button>

              {activePedido && activePedido.estado !== "por_pagar" && (
                <button
                  onClick={() => handleCerrarCuenta(activePedido.id)}
                  className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition active:scale-95"
                >
                  <Receipt className="w-4 h-4 text-slate-950" />
                  <span>Cerrar Cuenta</span>
                </button>
              )}

              {activePedido && (
                <button
                  onClick={() => {
                    setOrderToCancel({ pedidoId: activePedido.id, mesa: String(activePedido.mesa) });
                    setCancelOrderReason("Cliente se retiró del local");
                    setCancelOrderCustomReason("");
                  }}
                  className="py-3 px-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition active:scale-95"
                  title="Anular toda la comanda y liberar mesa"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>Anular Pedido</span>
                </button>
              )}

              {activePedido && (
                <button
                  onClick={() => handlePagarYLiberar(activePedido.id)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-emerald-950/60 hover:border-emerald-600 border border-slate-700 text-slate-200 hover:text-emerald-300 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition active:scale-95"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Pagar y Liberar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE GESTIÓN Y EDICIÓN DE MESEROS ================= */}
      {showWaitersModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Gestión de Meseros y PINs</h3>
                  <p className="text-xs text-slate-400">
                    Edita los nombres y los PINs de 4 dígitos para el inicio de turno en salón
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWaitersModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Meseros Registrados ({camareros.length})</span>
                  <span>PIN (4 dígitos)</span>
                </div>
                {camareros.map((cam) => (
                  <div
                    key={cam.id}
                    className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl"
                  >
                    <input
                      type="text"
                      defaultValue={cam.nombre}
                      id={`waiter-name-${cam.id}`}
                      placeholder="Nombre del mesero"
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-medium"
                    />
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={4}
                        defaultValue={cam.pin || "1234"}
                        id={`waiter-pin-${cam.id}`}
                        placeholder="PIN"
                        className="w-20 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono font-bold text-center outline-none focus:border-amber-500"
                        title="PIN de 4 dígitos para ingresar a mesas"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const nameInput = document.getElementById(`waiter-name-${cam.id}`) as HTMLInputElement;
                        const pinInput = document.getElementById(`waiter-pin-${cam.id}`) as HTMLInputElement;
                        if (nameInput && nameInput.value.trim()) {
                          handleUpdateWaiter(cam.id, nameInput.value.trim(), pinInput?.value?.trim() || "1234");
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
                      title="Guardar nombre y PIN"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar</span>
                    </button>
                    {camareros.length > 1 && (
                      <button
                        onClick={() => handleDeleteWaiter(cam.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition"
                        title="Eliminar mesero"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Agregar nuevo mesero con PIN */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Agregar Nuevo Mesero
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del nuevo camarero (ej. Juan Pérez)..."
                    value={newWaiterName}
                    onChange={(e) => setNewWaiterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddWaiter();
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="PIN 1234"
                    value={newWaiterPin}
                    onChange={(e) => setNewWaiterPin(e.target.value)}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-amber-300 font-mono font-bold text-center outline-none focus:border-amber-500"
                    title="PIN de 4 dígitos"
                  />
                  <button
                    onClick={handleAddWaiter}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs rounded-xl hover:from-emerald-500 hover:to-teal-400 transition flex items-center gap-1 active:scale-95 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 text-right">
              <button
                onClick={() => setShowWaitersModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR PLATO INDIVIDUAL (MESERO) */}
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
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Eliminar Plato — Mesa {itemToCancel.mesa}</h3>
                <p className="text-xs text-rose-300 font-bold">
                  {itemToCancel.item.cantidad}x {itemToCancel.item.nombre} (${(itemToCancel.item.cantidad * itemToCancel.item.precio).toFixed(2)})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Motivo de la eliminación:
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {[
                  "Error de digitación del mesero",
                  "El cliente cambió de opinión",
                  "Plato duplicado por error",
                  "Demora en preparación",
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

            <p className="text-[11px] text-emerald-300/90 italic bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/40">
              💰 La cuenta total de la mesa se descontará automáticamente y cocina será informada en vivo.
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
                {isSubmittingItemCancel ? "Eliminando..." : "Eliminar Plato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANULAR COMANDA COMPLETA (MESERO) */}
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
                <h3 className="text-lg font-black text-white">Anular Comanda — Mesa {orderToCancel.mesa}</h3>
                <p className="text-xs text-slate-400">
                  Esta acción cancelará toda la comanda y liberará la mesa.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Motivo de anulación:
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs">
                {[
                  "Cliente se retiró del local",
                  "Error al abrir comanda / Mesa equivocada",
                  "Comanda duplicada",
                  "Problema con el pedido",
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
              ⚠️ La mesa quedará libre al instante y cocina recibirá una alerta para detener la preparación.
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
