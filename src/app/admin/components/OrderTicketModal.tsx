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
  isServiciosTecnicos?: boolean;
  onClose: () => void;
  onStatusChange: (newStatus: string) => Promise<void>;
  onPrintThermal: () => void;
}

export function formatOrderPaymentMethod(method?: string | null): string {
  if (method === null || method === undefined) {
    return "Sin registrar";
  }
  const raw = String(method).trim();
  if (!raw) {
    return "Sin registrar";
  }

  // Normalización estricta (minúsculas, sin espacios ni guiones para alias exactos)
  const norm = raw.toLowerCase().replace(/[\s_-]+/g, "");

  // Alias exactos normalizados
  switch (norm) {
    case "deuna":
      return "Deuna (Pichincha)";
    case "payphone":
      return "Payphone";
    case "transferencia":
    case "transfer":
      return "Transferencia Bancaria";
    case "tarjeta":
    case "card":
    case "pos":
    case "datafast":
      return "Tarjeta Débito/Crédito";
    case "qr":
      return "QR de Cobro";
    case "whatsappcotizacion":
    case "cotizacion":
    case "cotizacionexpress":
      return "Cotización Express";
    case "efectivo":
    case "cash":
      return "Efectivo / Local";
    case "dividido":
    case "split":
    case "pagodividido":
    case "cuentadividida":
    case "splitbill":
      return "Cuenta Dividida (Split)";
    default:
      // Conservar valores desconocidos tal cual fueron guardados, sin reclasificarlos ni forzarlos a efectivo
      return raw;
  }
}

export interface ResolvedChannel {
  type: "takeout" | "delivery" | "service" | "table";
  label: string;
  badgeText: string;
  badgeColorModal: string;
  badgeColorTable: string;
  description: string;
}

export function resolveOrderChannel(tableName?: string | null, isServicios?: boolean): ResolvedChannel {
  const raw = String(tableName || "").trim();
  const lower = raw.toLowerCase().replace(/\s+/g, " ");

  // 1. Vertical de Servicios Técnicos / Cotización (prioridad de vertical unificada)
  const isExactService =
    Boolean(isServicios) ||
    /^(visita(\s+t[eé]cnica)?|cotizaci[oó]n(\s+express)?)$/i.test(lower);

  if (isExactService) {
    return {
      type: "service",
      label: "🚗 VISITA TÉCNICA",
      badgeText: "🚗 Visita Técnica",
      badgeColorModal: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      badgeColorTable: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-sm",
      description: "Atención o visita técnica.",
    };
  }

  // 2. Canal de Retiro / Para Llevar inequívoco y completo
  // Coincide con representaciones exactas como "llevar", "para llevar", "mesa llevar", "mesa #llevar", "retiro", "para retiro", "mostrador", "takeout", "pickup"
  // Rechaza nombres libres que solo contengan la subcadena "retiro" (ej: "Terraza Retiro del Sol", "Mesa Retiro 5")
  const isExactTakeout =
    /^(mesa\s*#?\s*)?(para\s+)?(llevar|retiro|takeout|pickup)$/i.test(lower) ||
    lower === "mostrador" ||
    lower === "mesa mostrador";

  if (isExactTakeout) {
    return {
      type: "takeout",
      label: "🛍 PARA LLEVAR / RETIRO",
      badgeText: "🛍 Para Llevar",
      badgeColorModal: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      badgeColorTable: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      description: "Retiro personal en el local.",
    };
  }

  // 3. Canal de Domicilio / Delivery inequívoco y completo
  // Coincide con "domicilio", "a domicilio", "envio a domicilio", "delivery", "a delivery"
  // Rechaza nombres libres que solo contengan la subcadena (ej: "Avenida Domicilio 123")
  const isExactDelivery =
    /^(mesa\s*#?\s*)?(a\s+|env[ií]o(\s+a)?\s+)?(domicilio|delivery)$/i.test(lower);

  if (isExactDelivery) {
    return {
      type: "delivery",
      label: "🛵 A DOMICILIO / DELIVERY",
      badgeText: "🛵 A Domicilio",
      badgeColorModal: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      badgeColorTable: "bg-sky-500/15 text-sky-300 border-sky-500/30",
      description: "Envío a domicilio.",
    };
  }

  // 4. Mesa de salón (incluye mesas con nombres personalizados o no coincidentes con palabras reservadas)
  const cleanTable = raw.replace(/^(Mesa\s*#?\s*)+/gi, "").trim();
  const tableDisplay = cleanTable || raw || "Salón";

  return {
    type: "table",
    label: `🪑 CONSUMO EN MESA #${tableDisplay}`,
    badgeText: `🪑 Mesa #${tableDisplay}`,
    badgeColorModal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    badgeColorTable: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    description: "Atención en mesa.",
  };
}

export interface ParsedPaymentDetails {
  reference?: string;
  note?: string;
  bank?: string;
  statusBadge?: string;
  statusColor?: "emerald" | "amber" | "slate";
}

export function parsePaymentDetails(raw?: any): ParsedPaymentDetails | null {
  if (raw === null || raw === undefined) return null;

  let dataObj: any = null;

  if (typeof raw === "object") {
    if (Array.isArray(raw)) {
      return null;
    }
    dataObj = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          dataObj = parsed;
        } else {
          return null;
        }
      } catch {
        return null;
      }
    } else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return null;
    } else {
      return { note: trimmed };
    }
  } else {
    return null;
  }

  const extractString = (val: any): string | undefined => {
    if (typeof val === "string") {
      const s = val.trim();
      if (s && !s.startsWith("{") && !s.startsWith("[") && s !== "[object Object]") {
        return s;
      }
    } else if (typeof val === "number" && !isNaN(val)) {
      return String(val);
    }
    return undefined;
  };

  const reference =
    extractString(dataObj.referencia) ||
    extractString(dataObj.comprobante) ||
    extractString(dataObj.transactionId) ||
    extractString(dataObj.deunaTransactionId) ||
    extractString(dataObj.authCode) ||
    extractString(dataObj.ref);

  const bank =
    extractString(dataObj.banco) ||
    extractString(dataObj.bank) ||
    extractString(dataObj.bankName);

  const rawNote =
    extractString(dataObj.text) ||
    extractString(dataObj.details) ||
    extractString(dataObj.nota) ||
    extractString(dataObj.comentario) ||
    extractString(dataObj.notes);

  let statusBadge: string | undefined = undefined;
  let statusColor: "emerald" | "amber" | "slate" = "slate";

  const hasConfirmedProp = typeof dataObj.pago_confirmado === "boolean";
  const rawEstado = typeof dataObj.pago_estado === "string" ? dataObj.pago_estado.trim().toLowerCase() : undefined;

  if (hasConfirmedProp) {
    if (dataObj.pago_confirmado === true) {
      if (!rawEstado || rawEstado === "confirmado" || rawEstado === "pagado") {
        const byWho = extractString(dataObj.pago_confirmado_por);
        statusBadge = byWho
          ? `Confirmación manual registrada (${byWho})`
          : "Confirmación manual registrada";
        statusColor = "emerald";
      } else if (rawEstado === "pendiente" || rawEstado === "pendiente_prepago" || rawEstado === "fallido" || rawEstado === "rechazado" || rawEstado === "anulado") {
        statusBadge = "Estado no conciliado";
        statusColor = "slate";
      } else {
        statusBadge = `Estado: ${dataObj.pago_estado}`;
        statusColor = "slate";
      }
    } else {
      if (rawEstado === "confirmado" || rawEstado === "pagado") {
        statusBadge = "Estado no conciliado";
        statusColor = "slate";
      } else if (!rawEstado || rawEstado === "pendiente" || rawEstado === "pendiente_prepago") {
        const isPrepay = Boolean(dataObj.exige_prepago === true || rawEstado === "pendiente_prepago");
        statusBadge = isPrepay
          ? "Prepago pendiente de registro"
          : "Pago pendiente de registro";
        statusColor = "amber";
      } else {
        statusBadge = `Estado: ${dataObj.pago_estado}`;
        statusColor = "slate";
      }
    }
  } else if (rawEstado) {
    if (rawEstado === "confirmado" || rawEstado === "pagado") {
      const byWho = extractString(dataObj.pago_confirmado_por);
      statusBadge = byWho
        ? `Confirmación manual registrada (${byWho})`
        : "Confirmación manual registrada";
      statusColor = "emerald";
    } else if (rawEstado === "pendiente" || rawEstado === "pendiente_prepago") {
      const isPrepay = Boolean(dataObj.exige_prepago === true || rawEstado === "pendiente_prepago");
      statusBadge = isPrepay
        ? "Prepago pendiente de registro"
        : "Pago pendiente de registro";
      statusColor = "amber";
    } else {
      statusBadge = `Estado: ${dataObj.pago_estado}`;
      statusColor = "slate";
    }
  }

  if (!reference && !bank && !rawNote && !statusBadge) {
    return null;
  }

  return {
    reference,
    bank,
    note: rawNote,
    statusBadge,
    statusColor,
  };
}

export default function OrderTicketModal({
  order,
  restaurant,
  isServiciosTecnicos,
  onClose,
  onStatusChange,
  onPrintThermal,
}: OrderTicketModalProps) {
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const togglePacked = (itemId: string, lineStatus?: string) => {
    if (lineStatus === "CANCELLED" || lineStatus === "UNRESOLVED") return;
    setPackedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const packableItems = (order.items || []).filter((it: any) => !it.lineStatus || it.lineStatus === "ACTIVE");
  const allPacked = packableItems.length > 0 && packableItems.every((it: any) => packedItems[it.id]);

  const channel = resolveOrderChannel(order.tableName, isServiciosTecnicos);
  const paymentMethodLabel = formatOrderPaymentMethod(order.paymentMethod);
  const parsedDetails = parsePaymentDetails((order as any).paymentDetails);

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
      .filter((it: any) => !it.lineStatus || it.lineStatus === "ACTIVE")
      .map((it: any) => `• ${it.quantity}x ${it.dishName}`)
      .join("\n");

    const message = `Hola *${order.customerName || "estimado/a cliente"}*, te saludamos de *${
      restaurant.name
    }*.\n\nTe informamos que tu pedido *#${
      order.orderNumber || order.id.substring(0, 6)
    }* (${channel.label}) ${statusText}.\n\n*Detalle de tu orden:*\n${itemsSummary}\n\n*Total:* $${Number(
      order.total
    ).toFixed(2)}\n\n¡Muchas gracias por tu preferencia!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Comanda #{order.orderNumber || order.id.substring(0, 6)}
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${channel.badgeColorModal} shrink-0`}>
                  {channel.label}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
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
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo del Ticket */}
        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Ficha del Cliente y Entrega */}
          <div className="bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Información de Entrega y Contacto
              </span>
              <div className="text-left sm:text-right w-full sm:w-auto max-w-full sm:max-w-[260px] break-words [overflow-wrap:anywhere]">
                <span className="text-[11px] font-mono text-slate-300 font-semibold block">
                  Pago: {paymentMethodLabel}
                </span>
                {parsedDetails && (
                  <div className="mt-1 text-left sm:text-right text-[10px] space-y-0.5 break-words [overflow-wrap:anywhere] whitespace-normal">
                    {parsedDetails.statusBadge && (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        parsedDetails.statusColor === "emerald"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : parsedDetails.statusColor === "amber"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}>
                        {parsedDetails.statusBadge}
                      </span>
                    )}
                    {parsedDetails.reference && (
                      <p className="text-slate-400 font-mono">
                        Ref: <span className="text-amber-300 font-bold">{parsedDetails.reference}</span>
                      </p>
                    )}
                    {parsedDetails.bank && (
                      <p className="text-slate-400">
                        Banco: <span className="text-slate-200">{parsedDetails.bank}</span>
                      </p>
                    )}
                    {parsedDetails.note && (
                      <p className="text-slate-300 italic whitespace-normal">
                        {parsedDetails.note}
                      </p>
                    )}
                  </div>
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
                channel.type !== "delivery" && (
                  <p className="text-slate-500 text-[11px] italic">
                    {channel.description}
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
                  const isCancelled = it.lineStatus === "CANCELLED";
                  const isUnresolved = it.lineStatus === "UNRESOLVED";
                  const isNonPackable = isCancelled || isUnresolved;
                  const isChecked = !isNonPackable && Boolean(packedItems[it.id]);

                  return (
                    <div
                      key={it.id}
                      onClick={() => !isNonPackable && togglePacked(it.id, it.lineStatus)}
                      className={`p-3.5 flex items-center justify-between gap-3 select-none transition ${
                        isNonPackable
                          ? "bg-slate-900/40 text-slate-400 cursor-not-allowed opacity-80"
                          : isChecked
                          ? "bg-emerald-950/20 text-slate-300 cursor-pointer"
                          : "hover:bg-slate-900/60 text-white cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          disabled={isNonPackable}
                          className={`shrink-0 ${isNonPackable ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white cursor-pointer"}`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-5 w-5 text-emerald-400" />
                          ) : isCancelled ? (
                            <div className="h-5 w-5 rounded border border-rose-500/40 bg-rose-500/10 flex items-center justify-center text-[10px] font-bold text-rose-400">✕</div>
                          ) : isUnresolved ? (
                            <div className="h-5 w-5 rounded border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-[10px] font-bold text-amber-400">?</div>
                          ) : (
                            <Square className="h-5 w-5 text-slate-600" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className={`font-bold text-xs sm:text-sm break-words [overflow-wrap:anywhere] flex items-center flex-wrap gap-1.5 ${
                            isCancelled
                              ? "line-through text-slate-500"
                              : isChecked
                              ? "line-through text-slate-500"
                              : "text-white"
                          }`}>
                            <span className={isCancelled ? "text-slate-500 font-black" : "text-amber-400 font-black"}>
                              {it.quantity}×
                            </span>
                            <span>{it.dishName}</span>
                            {isCancelled && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                Cancelado
                              </span>
                            )}
                            {isUnresolved && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                No conciliado
                              </span>
                            )}
                          </div>
                          {it.notes && (
                            <p className="text-[11px] text-amber-300/90 italic mt-0.5 break-words [overflow-wrap:anywhere]">
                              📝 {it.notes}
                            </p>
                          )}
                          <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono block mt-0.5">
                            ${Number(it.price).toFixed(2)} c/u
                            {isCancelled && " (excluido de cobro/empaque)"}
                            {isUnresolved && " (no conciliado)"}
                          </span>
                        </div>
                      </div>

                      <div className={`text-right font-mono font-bold text-xs sm:text-sm shrink-0 ${
                        isCancelled ? "text-slate-500 line-through" : "text-slate-200"
                      }`}>
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

            {(order.serviceCharge || 0) > 0 && (
              <div className="flex justify-between text-amber-400 font-semibold">
                <span>Servicio:</span>
                <span className="font-mono">+${Number(order.serviceCharge).toFixed(2)}</span>
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
        <div className="p-3.5 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Selector de Estado */}
          <div className="flex items-center gap-2 min-w-0">
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
              className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-black uppercase text-white focus:outline-none min-w-0 flex-1 sm:flex-initial"
            >
              <option value="PENDING">⏳ Pendiente</option>
              <option value="PREPARING">🍳 En Preparación / Empaque</option>
              <option value="READY">🔔 Listo para Servir</option>
              <option value="IN_TRANSIT">🛵 En Transporte / Camino</option>
              <option value="DELIVERED">✅ Entregado</option>
              <option value="COMPLETED">🎉 Cobrado / Completado</option>
              <option value="CANCELLED">❌ Cancelado</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onPrintThermal}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>Imprimir Ticket Térmico</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
