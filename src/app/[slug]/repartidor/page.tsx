"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { getDeliveryOrdersAction, updateOrderStatusAction } from "@/lib/actions";
import { 
  Bike, 
  MapPin, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Navigation, 
  RefreshCw, 
  ShoppingBag, 
  DollarSign, 
  UserCheck, 
  ArrowLeft,
  Search,
  Check
} from "lucide-react";

type OrderItem = {
  id: string;
  dishName: string;
  price: number;
  quantity: number;
};

type Order = {
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
};

type RestaurantInfo = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  logoUrl?: string | null;
  themeColor: string;
};

export default function DeliveryDriverPanelPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "IN_TRANSIT" | "DELIVERED">("ACTIVE");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadDeliveryOrders = async () => {
    setLoading(true);
    setErrorMsg("");

    const res = await getDeliveryOrdersAction(slug);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.orders && res.restaurant) {
      setRestaurant(res.restaurant as RestaurantInfo);
      setOrders(res.orders as Order[]);
    }
  };

  useEffect(() => {
    loadDeliveryOrders();
    const interval = setInterval(() => {
      loadDeliveryOrders();
    }, 12000);
    return () => clearInterval(interval);
  }, [slug]);

  // Load saved driver info from localStorage if available
  useEffect(() => {
    const savedName = localStorage.getItem("menuqr_driver_name");
    const savedPhone = localStorage.getItem("menuqr_driver_phone");
    if (savedName) setDriverName(savedName);
    if (savedPhone) setDriverPhone(savedPhone);
  }, []);

  const handleSaveDriverInfo = (name: string, phone: string) => {
    setDriverName(name);
    setDriverPhone(phone);
    localStorage.setItem("menuqr_driver_name", name);
    localStorage.setItem("menuqr_driver_phone", phone);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const res = await updateOrderStatusAction(orderId, newStatus, {
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
    });
    setUpdatingId(null);

    if (res.error) {
      alert(res.error);
    } else {
      loadDeliveryOrders();
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "ACTIVE") {
      return o.status === "PENDING" || o.status === "PREPARING";
    }
    if (activeTab === "IN_TRANSIT") {
      return o.status === "IN_TRANSIT";
    }
    if (activeTab === "DELIVERED") {
      return o.status === "DELIVERED" || o.status === "COMPLETED";
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500/30">
      {/* Background accents */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full blur-[150px] opacity-20 bg-amber-500"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full blur-[150px] opacity-10 bg-red-600"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href={`/${slug}`}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-black text-white text-base tracking-tight flex items-center gap-2">
                <Bike className="h-5 w-5 text-amber-400" />
                Panel de Repartidor
              </h1>
              <p className="text-xs text-slate-400">{restaurant?.name || "Cargando local..."}</p>
            </div>
          </div>

          <button
            onClick={() => loadDeliveryOrders()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-bold"
          >
            <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 w-full flex-1 relative z-10 space-y-6">
        {/* Driver Identity Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 backdrop-blur-md shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" />
              Tus datos de Repartidor
            </h3>
            <span className="text-[10px] text-slate-400">Se adjuntarán al cliente al despachar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Tu Nombre (ej. Carlos Repartidor)"
              value={driverName}
              onChange={(e) => handleSaveDriverInfo(e.target.value, driverPhone)}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Tu Teléfono / WhatsApp (ej. 0998765432)"
              value={driverPhone}
              onChange={(e) => handleSaveDriverInfo(driverName, e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1.5 bg-slate-900/80 border border-slate-800/80 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
              activeTab === "ACTIVE"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            <span>En Cocina ({orders.filter(o => o.status === "PENDING" || o.status === "PREPARING").length})</span>
          </button>
          <button
            onClick={() => setActiveTab("IN_TRANSIT")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
              activeTab === "IN_TRANSIT"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Bike className="h-4 w-4" />
            <span>En Camino ({orders.filter(o => o.status === "IN_TRANSIT").length})</span>
          </button>
          <button
            onClick={() => setActiveTab("DELIVERED")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
              activeTab === "DELIVERED"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Entregados ({orders.filter(o => o.status === "DELIVERED" || o.status === "COMPLETED").length})</span>
          </button>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <Bike className="h-12 w-12 mx-auto text-slate-700" />
            <h3 className="text-base font-bold text-white">Sin pedidos en esta pestaña</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No hay pedidos activos en este estado en este momento. La lista se actualiza automáticamente cada 12 segundos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const mapsUrl = order.customerAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`
                : null;

              const isUpdating = updatingId === order.id;

              return (
                <div 
                  key={order.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 relative overflow-hidden"
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono text-xs font-black border border-amber-500/30">
                        PEDIDO #{order.orderNumber || order.id.substring(0, 6)}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      order.status === "PENDING"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : order.status === "PREPARING"
                          ? "bg-blue-500/20 text-blue-300"
                          : order.status === "IN_TRANSIT"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                    }`}>
                      {order.status === "PENDING" && "Cocina - Pendiente"}
                      {order.status === "PREPARING" && "Cocina - Preparando"}
                      {order.status === "IN_TRANSIT" && "En Transporte"}
                      {(order.status === "DELIVERED" || order.status === "COMPLETED") && "Entregado"}
                    </span>
                  </div>

                  {/* Customer & Delivery Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-black">Cliente</span>
                        <h4 className="font-extrabold text-white text-base">{order.customerName || "Cliente Domicilio"}</h4>
                      </div>

                      {order.customerPhone && (
                        <div className="flex gap-2">
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
                            title="Llamar Cliente"
                          >
                            <Phone className="h-4 w-4 text-blue-400" />
                          </a>
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(order.customerName || "Cliente")},%20te%20saluda%20el%20repartidor%20de%20*${encodeURIComponent(restaurant?.name || "")}*%20con%20tu%20pedido%20%23${order.orderNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/60 transition"
                            title="WhatsApp Cliente"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Delivery Address Box */}
                    {order.customerAddress && (
                      <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-black text-amber-400 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-red-400" />
                            Dirección de Entrega
                          </span>
                          <p className="text-white font-medium leading-relaxed">{order.customerAddress}</p>
                        </div>

                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center gap-1 whitespace-nowrap active:scale-95 transition"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Mapa</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Items List */}
                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-850 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block mb-1">Platos a Entregar</span>
                      {(order.items || []).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs text-slate-300 font-medium">
                          <span><strong className="text-amber-400">{item.quantity}x</strong> {item.dishName}</span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payment info bar */}
                    <div className="flex items-center justify-between bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-black text-slate-400 block">Forma de Pago</span>
                        <span className="font-extrabold text-white text-xs uppercase">
                          {order.paymentMethod === "qr" ? "💳 QR / Ya Pagado" : "💵 Efectivo (Cobrar en entrega)"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-black text-slate-400 block">Monto a Cobrar</span>
                        <span className="font-black text-emerald-400 text-lg">${order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Driver Actions Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                    {(order.status === "PENDING" || order.status === "PREPARING") && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "IN_TRANSIT")}
                        disabled={isUpdating}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-2xl transition shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
                        <span>Tomar Pedido y Salir en Camino 🛵</span>
                      </button>
                    )}

                    {order.status === "IN_TRANSIT" && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                        disabled={isUpdating}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs rounded-2xl transition shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>Marcar Pedido como Entregado ✅</span>
                      </button>
                    )}

                    {(order.status === "DELIVERED" || order.status === "COMPLETED") && (
                      <div className="w-full py-2 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                        <Check className="h-4 w-4" />
                        <span>Pedido Completado con Éxito</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
