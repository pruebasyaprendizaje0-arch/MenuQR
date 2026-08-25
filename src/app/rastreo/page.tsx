"use client";

import { useState } from "react";
import Link from "next/link";
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
  QrCode
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

export default function GlobalOrderTrackingPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg("");

    const res = await getOrderTrackingAction(null, query);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
      setOrders([]);
    } else if (res.orders) {
      setOrders(res.orders as OrderTrack[]);
    }
  };

  const getStageNumber = (status: string) => {
    switch (status) {
      case "PENDING":
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
      {/* Background Glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full blur-[160px] opacity-25 bg-red-600"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full blur-[160px] opacity-15 bg-amber-600"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900/80">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition p-2 rounded-xl bg-slate-900 border border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Inicio</span>
          </Link>
          <div className="flex items-center gap-2 font-black text-white text-base">
            <QrCode className="h-5 w-5 text-red-500" />
            MenuQR Pro Tracking
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1 relative z-10 space-y-8">
        <div className="text-center space-y-2">
          <span className="px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider">
            🛵 Portal de Rastreo de Pedidos
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight">Sigue tu comida en tiempo real</h1>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            Ingresa tu número de pedido o tu número de WhatsApp para consultar el estado en la cocina, transporte y entrega.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-3.5 text-slate-500 font-mono text-sm">#</span>
              <input
                type="text"
                placeholder="Número de Pedido (ej. 1001) o Teléfono"
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
              <span>Consultar</span>
            </button>
          </form>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-3xl p-6 text-center space-y-2 text-red-300">
            <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
            <p className="font-bold text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Results */}
        {orders.length > 0 && (
          <div className="space-y-8">
            {orders.map((order) => {
              const currentStage = getStageNumber(order.status);

              return (
                <div 
                  key={order.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                    <div>
                      <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-400 font-mono text-xs font-black border border-amber-500/30">
                        PEDIDO #{order.orderNumber || order.id.substring(0, 6)}
                      </span>
                      <h2 className="text-xl font-black text-white mt-2">
                        {order.restaurant.name}
                      </h2>
                    </div>

                    <a
                      href={`https://wa.me/${order.restaurant.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/80 text-xs font-bold transition flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Contactar Local</span>
                    </a>
                  </div>

                  {/* Stepper */}
                  <div className="space-y-6">
                    <div className="text-center">
                      <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Progreso del Envío</span>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {order.status === "PENDING" && "🍳 Pedido Recibido"}
                        {order.status === "PREPARING" && "🍳 En Cocina - Preparando"}
                        {order.status === "IN_TRANSIT" && "🛵 En Transporte - En Camino"}
                        {(order.status === "DELIVERED" || order.status === "COMPLETED") && "🎉 Entregado"}
                      </h3>
                    </div>

                    <div className="relative pt-4">
                      <div className="absolute top-1/2 left-8 right-8 h-1.5 bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>
                      <div 
                        className="absolute top-1/2 left-8 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 -translate-y-1/2 rounded-full z-0 transition-all duration-700"
                        style={{
                          width: currentStage === 1 ? "25%" : currentStage === 2 ? "65%" : "100%"
                        }}
                      ></div>

                      <div className="relative z-10 flex justify-between items-center px-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border-2 ${
                            currentStage >= 1 ? "bg-amber-500 border-amber-400 text-slate-950 font-bold" : "bg-slate-900 border-slate-800 text-slate-600"
                          }`}>
                            <ChefHat className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-bold text-slate-300">Cocina</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border-2 ${
                            currentStage >= 2 ? "bg-amber-500 border-amber-400 text-slate-950 font-bold" : "bg-slate-900 border-slate-800 text-slate-600"
                          }`}>
                            <Bike className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-bold text-slate-300">Transporte</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border-2 ${
                            currentStage >= 3 ? "bg-emerald-500 border-emerald-400 text-slate-950 font-bold" : "bg-slate-900 border-slate-800 text-slate-600"
                          }`}>
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <span className="text-xs font-bold text-slate-300">Entrega</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Address & Total */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60 text-xs">
                    <div>
                      <p className="text-slate-400">Cliente: <strong className="text-white">{order.customerName || "N/A"}</strong></p>
                      {order.customerAddress && (
                        <p className="text-slate-400 mt-1">Dirección: <strong className="text-amber-300">{order.customerAddress}</strong></p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Total a pagar:</p>
                      <p className="text-xl font-black text-emerald-400">${order.total.toFixed(2)}</p>
                    </div>
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
