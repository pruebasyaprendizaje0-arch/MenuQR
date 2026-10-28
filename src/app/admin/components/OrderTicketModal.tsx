"use client";

import React, { useState } from "react";
import {
  X,
  Printer,
  MessageCircle,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Truck,
  CheckSquare,
  Square,
  ExternalLink,
  Receipt,
  AlertCircle
} from "lucide-react";

interface OrderTicketModalProps {
  order: any;
  restaurant: any;
  onClose: () => void;
  onStatusChange: (newStatus: string) => Promise<void>;
  onPrintThermal: () => void;
}

export default function OrderTicketModal({
  order,
  restaurant,
  onClose,
  onStatusChange,
  onPrintThermal,
}: OrderTicketModalProps) {
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const togglePacked = (itemId: string) => {
    setPackedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const allPacked = (order.items || []).every((it: any) => packedItems[it.id]);

  const channelLabel =
    order.tableName === "Llevar"
      ? "🛍 PARA LLEVAR / RETIRO"
      : order.tableName === "Domicilio"
      ? "🛵 A DOMICILIO / DELIVERY"
      : `🪑 CONSUMO EN MESA #${order.tableName}`;

  const channelColor =
    order.tableName === "Llevar"
      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
      : order.tableName === "Domicilio"
      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  const handleSendWhatsAppUpdate = () => {
    if (!order.customerPhone) {
      alert("Este pedido no tiene número de teléfono registrado.");
      return;
    }
    const cleanPhone = order.customerPhone.replace(/\D/g, "");
    const statusText =
      order.status === "PREPARING"
        ? "está siendo preparado/empacado 🍳"
        : order.status === "IN_TRANSIT"
        ? "va en camino a tu dirección 🛵💨"
        : order.status === "DELIVERED"
        ? "ha sido entregado con éxito ✅"
        : "ha sido recibido y confirmado ⏳";

    const itemsSummary = (order.items || [])
      .map((it: any) => `• ${it.quantity}x ${it.dishName}`)
      .join("\n");

    const message = `Hola *${order.customerName || "estimado/a cliente"}*, te saludamos de *${
      restaurant.name
    }*.\n\nTe informamos que tu pedido *#${
      order.orderNumber || order.id.substring(0, 6)
    }* (${channelLabel}) ${statusText}.\n\n*Detalle de tu orden:*\n${itemsSummary}\n\n*Total:* $${Number(
      order.total
    ).toFixed(2)}\n\n¡Muchas gracias por tu preferencia!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Comanda #{order.orderNumber || order.id.substring(0, 6)}
                </h3>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${channelColor}`}>
                  {channelLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(order.createdAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo del Ticket */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Ficha del Cliente y Entrega */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Información de Entrega y Contacto
              </span>
              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-300 font-semibold block">
                  Pago: {
                    order.paymentMethod === "deuna" ? "Deuna (Pichincha)" :
                    order.paymentMethod === "payphone" ? "Payphone" :
                    order.paymentMethod === "qr" ? "QR de Cobro" :
                    "Efectivo / Local"
                  }
                </span>
                {(order as any).paymentDetails && (
                  <span className="text-[10px] text-amber-300 font-semibold block">
                    {(order as any).paymentDetails}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {order.customerName && (
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <span>👤 {order.customerName}</span>
                </div>
              )}

              {order.customerPhone && (
                <div className="flex items-center gap-3">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="flex items-center gap-1.5 text-slate-300 hover:text-white"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    <span>{order.customerPhone}</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleSendWhatsAppUpdate}
                    className="flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Avisar por WhatsApp</span>
                  </button>
                </div>
              )}

              {order.customerAddress ? (
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-850">
                  <div className="flex items-start gap-1.5 text-slate-300 flex-1">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{order.customerAddress}</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      order.customerAddress
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-bold shrink-0 flex items-center gap-1"
                  >
                    <span>Mapa</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                order.tableName !== "Domicilio" && (
                  <p className="text-slate-500 text-[11px] italic">
                    {order.tableName === "Llevar" ? "Retiro personal en el local." : "Atención en mesa."}
                  </p>
                )
              )}
            </div>
          </div>

          {/* Checklist de Empaque de Productos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-amber-400" />
                <span>Productos Pedidos ({order.items?.length || 0})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Marca los ítems conforme los empaques:
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800 divide-y divide-slate-850 overflow-hidden">
              {(!order.items || order.items.length === 0) ? (
                <p className="p-4 text-slate-500 italic text-center">
                  Sin ítems registrados en este pedido.
                </p>
              ) : (
                order.items.map((it: any) => {
                  const isChecked = Boolean(packedItems[it.id]);
                  return (
                    <div
                      key={it.id}
                      onClick={() => togglePacked(it.id)}
                      className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition ${
                        isChecked
                          ? "bg-emerald-950/20 text-slate-300"
                          : "hover:bg-slate-900/60 text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="shrink-0 text-slate-400 hover:text-white"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-600" />
                          )}
                        </button>
                        <div>
                          <div className={`font-bold text-sm ${isChecked ? "line-through text-slate-500" : "text-white"}`}>
                            <span className="text-amber-400 font-black mr-1.5">{it.quantity}×</span>
                            <span>{it.dishName}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">
                            ${Number(it.price).toFixed(2)} c/u
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono font-bold text-sm text-slate-200">
                        ${(it.price * it.quantity).toFixed(2)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {order.items?.length > 0 && allPacked && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>¡Todos los productos han sido verificados y empacados!</span>
              </div>
            )}
          </div>

          {/* Desglose Financiero */}
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal Productos:</span>
              <span className="font-mono">${Number(order.subtotal || 0).toFixed(2)}</span>
            </div>

            {order.deliveryCost > 0 && (
              <div className="flex justify-between text-sky-400 font-semibold">
                <span>Costo de Envío (Delivery):</span>
                <span className="font-mono">+${Number(order.deliveryCost).toFixed(2)}</span>
              </div>
            )}

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Descuento Aplicado {order.couponCode ? `(${order.couponCode})` : ""}:</span>
                <span className="font-mono">-${Number(order.discountAmount).toFixed(2)}</span>
              </div>
            )}

            {order.iva > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>IVA:</span>
                <span className="font-mono">+${Number(order.iva).toFixed(2)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black text-white">
              <span className="text-base">TOTAL A COBRAR:</span>
              <span className="font-mono text-xl text-emerald-400">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Selector de Estado */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold shrink-0">Estado:</span>
            <select
              value={order.status}
              disabled={updatingStatus}
              onChange={async (e) => {
                setUpdatingStatus(true);
                try {
                  await onStatusChange(e.target.value);
                } finally {
                  setUpdatingStatus(false);
                }
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black uppercase text-white focus:outline-none"
            >
              <option value="PENDING">⏳ Pendiente</option>
              <option value="PREPARING">🍳 En Preparación / Empaque</option>
              <option value="IN_TRANSIT">🛵 En Transporte / Camino</option>
              <option value="DELIVERED">✅ Entregado / Completado</option>
              <option value="CANCELLED">❌ Cancelado</option>
            </select>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onPrintThermal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Ticket Térmico</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
