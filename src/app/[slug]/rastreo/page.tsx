"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getOrderTrackingAction } from "@/lib/actions";
import { 
  Search, 
  ChefHat, 
  Bike, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  MessageSquare, 
  ArrowLeft, 
  ShoppingBag, 
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  UserCheck
} from "lucide-react";

type OrderItem = {
  id: string;
  dishName: string;
  price: number;
  quantity: number;
};

type OrderTrack = {
  id: string;
  orderNumber?: number;
  tableName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  status: string;
  subtotal: number;
  iva: number;
  serviceCharge: number;
  tip: number;
  deliveryCost: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  restaurant: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    whatsapp: string;
    themeColor: string;
    address?: string | null;
  };
};

export default function CustomerOrderTrackingPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
          <span>Cargando rastreo de pedido...</span>
        </div>
      </div>
    }>
      <TrackingContent slug={slug} />
    </Suspense>
  );
}

function TrackingContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const initialOrderQuery = searchParams.get("order") || searchParams.get("ped") || "";

  const [query, setQuery] = useState(initialOrderQuery);
  const [orders, setOrders] = useState<OrderTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTracking = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setErrorMsg("");

    const res = await getOrderTrackingAction(slug, searchQuery);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
      setOrders([]);
    } else if (res.orders) {
      setOrders(res.orders as unknown as OrderTrack[]);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    if (initialOrderQuery) {
      fetchTracking(initialOrderQuery);
    }
  }, [initialOrderQuery]);

  // Polling every 10 seconds for real-time live order status updates
  useEffect(() => {
    if (!query.trim() || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchTracking(query);
    }, 10000);
    return () => clearInterval(interval);
  }, [query, autoRefresh]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(query);
  };

  const getStageNumber = (status: string) => {
    switch (status) {
      case "PENDING":
        return 1;
      case "PREPARING":
        return 1;
      case "IN_TRANSIT":
        return 2;
      case "DELIVERED":
      case "COMPLETED":
        return 3;
      case "CANCELLED":
        return -1;
      default:
        return 1;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500/30">
      {/* Decorative gradient blur background */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full blur-[160px] opacity-25 bg-red-600"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full blur-[160px] opacity-15 bg-amber-600"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900/80">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href={`/${slug}`}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition p-2 rounded-xl bg-slate-900 border border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Menú</span>
          </Link>
          <div className="text-right">
            <h1 className="font-extrabold text-white text-base tracking-tight flex items-center justify-end gap-2">
              <Bike className="h-5 w-5 text-red-500" />
              Rastreo de Pedido
            </h1>
            <p className="text-[11px] text-slate-400">Seguimiento en tiempo real</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1 relative z-10 space-y-8">
        {/* Search Bar Box */}
        <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 shadow-2xl space-y-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-400" />
              ¿Cuál es tu número de pedido?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ingresa el número de tu pedido (ejemplo: <span className="text-amber-400 font-mono font-bold">1001</span> o <span className="text-amber-400 font-mono font-bold">#1001</span>) o tu número de WhatsApp para ver la ubicación de tu comida.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-3.5 text-slate-500 font-mono text-sm">#</span>
              <input
                type="text"
                placeholder="1001 ó 0991234567"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-2xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none transition shadow-inner font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs rounded-2xl transition shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Rastrear</span>
            </button>
          </form>

          {lastUpdated && (
            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
              <span>Actualización automática activa (10s)</span>
              <span>Último chequeo: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-3xl p-6 text-center space-y-2 text-red-300">
            <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
            <p className="font-bold text-sm">{errorMsg}</p>
            <p className="text-xs text-red-400/80">Revisa que el número esté bien escrito o consulta directamente con el restaurante.</p>
          </div>
        )}

        {/* Orders Found List */}
        {orders.length > 0 && (
          <div className="space-y-8">
            {orders.map((order) => {
              const currentStage = getStageNumber(order.status);

              return (
                <div 
                  key={order.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-8 relative overflow-hidden"
                >
                  {/* Top Bar Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-400 font-mono text-xs font-black border border-amber-500/30">
                          PEDIDO #{order.orderNumber || order.id.substring(0, 6)}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-white mt-2 flex items-center gap-2">
                        {order.restaurant.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${order.restaurant.whatsapp.replace(/\D/g, "")}?text=Hola,%20quisiera%20consultar%20sobre%20mi%20pedido%20%23${order.orderNumber || order.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/80 text-xs font-bold transition flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>WhatsApp Local</span>
                      </a>
                    </div>
                  </div>

                  {/* Stage Status Stepper Tracker */}
                  {order.status === "CANCELLED" ? (
                    <div className="bg-red-950/60 border border-red-800 p-6 rounded-2xl text-center space-y-2">
                      <span className="text-3xl">❌</span>
                      <h3 className="text-lg font-bold text-red-400">Pedido Cancelado</h3>
                      <p className="text-xs text-slate-400">Este pedido ha sido cancelado. Contacta al restaurante para obtener soporte.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-center">
                        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Estado del Pedido</span>
                        <h3 className="text-2xl font-black text-white mt-1">
                          {order.status === "PENDING" && "🍳 Pedido Recibido - Entrando a Cocina"}
                          {order.status === "PREPARING" && "🍳 En Cocina - Preparando tus alimentos"}
                          {order.status === "IN_TRANSIT" && "🛵 En Transporte - ¡Repartidor en camino!"}
                          {(order.status === "DELIVERED" || order.status === "COMPLETED") && "🎉 ¡Entregado con éxito!"}
                        </h3>
                      </div>

                      {/* Visual Stepper */}
                      <div className="relative pt-4">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-8 right-8 h-1.5 bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>
                        <div 
                          className="absolute top-1/2 left-8 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 -translate-y-1/2 rounded-full z-0 transition-all duration-700"
                          style={{
                            width: currentStage === 1 ? "25%" : currentStage === 2 ? "65%" : "100%"
                          }}
                        ></div>

                        {/* Steps */}
                        <div className="relative z-10 flex justify-between items-center px-4">
                          {/* Step 1: Cocina */}
                          <div className="flex flex-col items-center gap-2">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all ${
                              currentStage >= 1
                                ? "bg-amber-500 border-amber-400 text-slate-950 scale-110 shadow-amber-500/20"
                                : "bg-slate-900 border-slate-800 text-slate-600"
                            }`}>
                              <ChefHat className="h-7 w-7" />
                            </div>
                            <span className={`text-xs font-bold ${currentStage >= 1 ? "text-amber-400" : "text-slate-500"}`}>
                              1. Cocina
                            </span>
                            <span className="text-[10px] text-slate-400">Preparación</span>
                          </div>

                          {/* Step 2: Transporte */}
                          <div className="flex flex-col items-center gap-2">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all ${
                              currentStage >= 2
                                ? "bg-amber-500 border-amber-400 text-slate-950 scale-110 shadow-amber-500/20"
                                : "bg-slate-900 border-slate-800 text-slate-600"
                            }`}>
                              <Bike className="h-7 w-7" />
                            </div>
                            <span className={`text-xs font-bold ${currentStage >= 2 ? "text-amber-400" : "text-slate-500"}`}>
                              2. Transporte
                            </span>
                            <span className="text-[10px] text-slate-400">En camino</span>
                          </div>

                          {/* Step 3: Entrega */}
                          <div className="flex flex-col items-center gap-2">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-all ${
                              currentStage >= 3
                                ? "bg-emerald-500 border-emerald-400 text-slate-950 scale-110 shadow-emerald-500/20"
                                : "bg-slate-900 border-slate-800 text-slate-600"
                            }`}>
                              <CheckCircle2 className="h-7 w-7" />
                            </div>
                            <span className={`text-xs font-bold ${currentStage >= 3 ? "text-emerald-400" : "text-slate-500"}`}>
                              3. Entrega
                            </span>
                            <span className="text-[10px] text-slate-400">Entregado</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Driver Information Card (If assigned & in transit/delivered) */}
                  {order.driverName && (
                    <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg">
                          🛵
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">Repartidor Asignado</span>
                          <h4 className="font-extrabold text-white text-sm">{order.driverName}</h4>
                          {order.driverPhone && (
                            <p className="text-xs text-slate-400">Tel: {order.driverPhone}</p>
                          )}
                        </div>
                      </div>

                      {order.driverPhone && (
                        <div className="flex gap-2">
                          <a
                            href={`tel:${order.driverPhone}`}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition flex items-center gap-1.5"
                          >
                            <Phone className="h-3.5 w-3.5 text-blue-400" />
                            <span>Llamar</span>
                          </a>
                          <a
                            href={`https://wa.me/${order.driverPhone.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(order.driverName)},%20te%20escribo%20por%20mi%20pedido%20%23${order.orderNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-xs font-bold text-emerald-400 border border-emerald-800/60 transition flex items-center gap-1.5"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery & Order Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/60 text-xs">
                    {/* Delivery Info */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-red-400" />
                        Detalles de Envío
                      </h4>
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 space-y-1.5">
                        <p><span className="text-slate-400">Cliente:</span> <strong className="text-white">{order.customerName || "N/A"}</strong></p>
                        <p><span className="text-slate-400">Teléfono:</span> <strong className="text-white">{order.customerPhone || "N/A"}</strong></p>
                        {order.customerAddress && (
                          <p className="text-slate-300 leading-relaxed mt-1">
                            <span className="text-slate-400">Dirección:</span> <strong className="text-amber-300">{order.customerAddress}</strong>
                          </p>
                        )}
                        <p><span className="text-slate-400">Método de Pago:</span> <strong className="text-white uppercase">{order.paymentMethod === "qr" ? "QR / Transferencia" : "Efectivo contra entrega"}</strong></p>
                      </div>
                    </div>

                    {/* Order Summary & Items */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4 text-amber-400" />
                        Resumen del Pedido
                      </h4>
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 space-y-2">
                        <div className="space-y-1 divide-y divide-slate-800/40">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between pt-1 font-medium">
                              <span><strong className="text-amber-400">{item.quantity}x</strong> {item.dishName}</span>
                              <span className="text-slate-300">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-extrabold text-white">
                          <span>Total del Pedido:</span>
                          <span className="text-base text-emerald-400 font-black">${order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>MenuQR Pro &copy; {new Date().getFullYear()} - Sistema Inteligente de Pedidos y Seguimiento a Domicilio</p>
      </footer>
    </div>
  );
}
