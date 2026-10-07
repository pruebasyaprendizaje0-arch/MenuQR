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

export default function MesasPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [selectedNegocioId, setSelectedNegocioId] = useState<string>("");
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

  const socketRef = useRef<Socket | null>(null);

  // 1. Cargar negocios iniciales
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
        console.error("Error loading negocios in Mesas:", err);
      }
    }
    loadNegocios();
  }, []);

  // 2. Cargar detalle de negocio, pedidos y métricas
  const refreshAll = async (negocioId: string) => {
    if (!negocioId) return;
    try {
      const [negocioRes, pedidosRes, metricasRes] = await Promise.all([
        fetch(`/api/negocios/${negocioId}`),
        fetch(`/api/pedidos?negocio_id=${negocioId}&activos=true`),
        fetch(`/api/pedidos/metricas?negocio_id=${negocioId}`),
      ]);

      const nData = await negocioRes.json();
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
    } catch (err) {
      console.error("Error refreshing mesas data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedNegocioId) return;
    setLoading(true);
    refreshAll(selectedNegocioId);
  }, [selectedNegocioId]);

  // 3. Conectar a Socket.IO en /api/socket
  useEffect(() => {
    if (!selectedNegocioId) return;

    const socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
      query: { negocio_id: selectedNegocioId },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_negocio", selectedNegocioId);
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

    return () => {
      socket.disconnect();
    };
  }, [selectedNegocioId]);

  const refreshMetricas = () => {
    if (!selectedNegocioId) return;
    fetch(`/api/pedidos/metricas?negocio_id=${selectedNegocioId}`)
      .then((r) => r.json())
      .then((d) => d.ok && setMetricas(d.metricas || []));
  };

  // Encontrar pedido activo por mesa
  const getPedidoForMesa = (numMesa: number) => {
    return pedidos.find(
      (p) => String(p.mesa) === String(numMesa) && p.estado !== "pagado"
    );
  };

  const activePedido = activeMesaNumber ? getPedidoForMesa(activeMesaNumber) : null;

  // Acciones sobre pedido
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

  // Añadir items al carrito temporal para la mesa abierta
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

  // Enviar pedido con LÓGICA DE MESA ABIERTA
  const submitAddItemsToMesa = async () => {
    if (!activeMesaNumber || !selectedNegocioId) return;

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
          negocio_id: selectedNegocioId,
          mesa: String(activeMesaNumber),
          camarero_id: selectedCamareroId || undefined,
          items: itemsToSend,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setCartToAdd({});
        setShowCatalogDrawer(false);
        // Actualizar lista de pedidos
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

  // Cálculo de tiempo transcurrido
  const calcularMinutosTranscurridos = (fechaStr: string) => {
    try {
      const mins = Math.max(
        0,
        Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000)
      );
      return `${mins} min`;
    } catch {
      return "0 min";
    }
  };

  const numeroMesas = negocioInfo?.numero_mesas || 10;
  const listaMesas = Array.from({ length: numeroMesas }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* HEADER DE CONTROL */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* TÍTULO Y NEGOCIO */}
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
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Store className="w-3.5 h-3.5 text-slate-500" />
                {negocios.length > 1 ? (
                  <select
                    value={selectedNegocioId}
                    onChange={(e) => setSelectedNegocioId(e.target.value)}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {negocios.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{negocios[0]?.nombre || "Cargando..."}</span>
                )}
              </div>
            </div>
          </div>

          {/* CAMARERO ACTIVO Y ACCESOS */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* SELECTOR DE CAMARERO EN TURNO */}
            <div className="flex items-center space-x-1.5 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 hidden sm:inline">Camarero:</span>
              <select
                value={selectedCamareroId}
                onChange={(e) => setSelectedCamareroId(e.target.value)}
                className="bg-transparent text-slate-100 font-bold outline-none cursor-pointer text-xs"
              >
                {camareros.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* REFRESCAR */}
            <button
              onClick={() => refreshAll(selectedNegocioId)}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white transition"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* LINK DIRECTO A COCINA */}
            <a
              href="/cocina"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 font-medium transition"
            >
              <ChefHat className="w-4 h-4" />
              <span className="hidden sm:inline">Ir a Cocina</span>
            </a>
          </div>
        </div>
      </header>

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

            return (
              <button
                key={num}
                onClick={() => {
                  setActiveMesaNumber(num);
                  setCartToAdd({});
                  setShowCatalogDrawer(false);
                }}
                className={`relative rounded-2xl p-4 text-left border-2 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-xl active:scale-95 flex flex-col justify-between min-h-[140px] ${
                  isLibre
                    ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    : isPorPagar
                    ? "bg-amber-950/60 border-amber-500 text-amber-200 shadow-amber-950/40"
                    : "bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-emerald-950/40"
                }`}
              >
                {/* Header de la Mesa */}
                <div className="flex items-start justify-between w-full">
                  <span className="text-2xl font-black tracking-tight text-white">
                    Mesa {num}
                  </span>
                  {isListoEnCocina && (
                    <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce flex items-center gap-1 shadow-md">
                      <Bell className="w-3 h-3 text-slate-950" />
                      ¡LISTO!
                    </span>
                  )}
                </div>

                {/* Info Central */}
                <div className="my-2">
                  {isLibre && (
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-400 text-xs font-semibold">
                      Disponible
                    </span>
                  )}
                  {pedido && isOcupada && (
                    <div className="space-y-0.5">
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
                      <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300 block">
                        Por Pagar
                      </span>
                      <span className="text-xs text-amber-200/80 block">
                        {pedido.items.length} items consumidos
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer de la Mesa: Total */}
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

        {/* MÉTRICAS ABAJO: Camarero | Mesas | Vendido | Ticket Promedio */}
        <section className="mt-12 bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                Rendimiento Diario de Camareros (Hoy)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              SELECT ... WHERE fecha=hoy GROUP BY camarero_id
            </span>
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

      {/* ================= MODAL DE MESA SELECCIONADA ================= */}
      {activeMesaNumber !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
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
                      Camarero:{" "}
                      <span className="text-white font-medium">
                        {activePedido.camarero_nombre || "Camarero"}
                      </span>{" "}
                      • Abierta hace {calcularMinutosTranscurridos(activePedido.created_at)}
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

            {/* Modal Content: ITEMS ACTUALES */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                          item.es_añadido
                            ? "bg-amber-950/20 border-amber-600/40 text-amber-200"
                            : "bg-slate-950 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                              {item.cantidad}x
                            </span>
                            <span className="font-semibold text-sm text-white">
                              {item.nombre}
                            </span>
                            {item.es_añadido && (
                              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded uppercase">
                                AÑADIDO
                              </span>
                            )}
                          </div>
                          {item.notas && (
                            <p className="text-[11px] text-amber-300 italic">
                              💬 {item.notas}
                            </p>
                          )}
                        </div>
                        <div className="text-right font-mono font-bold text-sm text-slate-100">
                          ${(item.cantidad * item.precio).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumen de Cuenta */}
                  <div className="pt-4 border-t border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-lg font-black text-white">
                      <span>Total de la Cuenta:</span>
                      <span className="font-mono text-2xl text-emerald-400">
                        ${activePedido.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Coffee className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm">
                    Esta mesa está libre actualmente. Pulsa el botón de abajo para
                    abrir la mesa y seleccionar platos del catálogo.
                  </p>
                </div>
              )}

              {/* DRAWER / SELECCIONADOR DE PRODUCTOS (SI ESTÁ ABIERTO) */}
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

                  {/* Lista de platos para añadir */}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {productos
                      .filter((p) =>
                        p.name.toLowerCase().includes(catalogSearch.toLowerCase())
                      )
                      .map((prod) => {
                        const inCart = cartToAdd[prod.id];
                        const qty = inCart?.cantidad || 0;

                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-xl border text-xs flex flex-col gap-2 transition ${
                              qty > 0
                                ? "bg-emerald-950/30 border-emerald-500/50"
                                : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-white block">
                                  {prod.name}
                                </span>
                                <span className="text-emerald-400 font-mono font-semibold">
                                  ${prod.price.toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateCartQty(prod, -1)}
                                  disabled={qty === 0}
                                  className="w-7 h-7 rounded-lg bg-slate-800 disabled:opacity-30 text-white font-black flex items-center justify-center hover:bg-slate-700 transition"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center font-mono font-bold text-white">
                                  {qty}
                                </span>
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

                  {/* Resumen del añadido */}
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

            {/* BOTONES DE ACCIÓN EN EL FOOTER DEL MODAL */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2.5">
              {/* Botón: AÑADIR PRODUCTO */}
              <button
                onClick={() => setShowCatalogDrawer(!showCatalogDrawer)}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Añadir Producto</span>
              </button>

              {/* Botón: CERRAR CUENTA */}
              {activePedido && activePedido.estado !== "por_pagar" && (
                <button
                  onClick={() => handleCerrarCuenta(activePedido.id)}
                  className="py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition active:scale-95"
                >
                  <Receipt className="w-4 h-4 text-slate-950" />
                  <span>Cerrar Cuenta</span>
                </button>
              )}

              {/* Botón: COBRAR Y LIBERAR MESA */}
              {activePedido && (
                <button
                  onClick={() => handlePagarYLiberar(activePedido.id)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:border-rose-600 border border-slate-700 text-slate-200 hover:text-rose-300 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition active:scale-95"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Pagar y Liberar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
