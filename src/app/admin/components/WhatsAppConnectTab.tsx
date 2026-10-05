"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, RefreshCw, AlertCircle, Phone, Power, Smartphone } from "lucide-react";

interface WhatsAppConnectTabProps {
  restaurantId: string;
  restaurantSlug: string;
}

export function WhatsAppConnectTab({ restaurantId, restaurantSlug }: WhatsAppConnectTabProps) {
  const [status, setStatus] = useState<"DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED">("DISCONNECTED");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchStatus = useCallback(async (autoInit = true) => {
    try {
      const res = await fetch(`/api/whatsapp/qr?restaurantId=${restaurantId}&init=${autoInit}`);
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        setQrCode(data.qr);
        setPhoneNumber(data.phoneNumber);
      }
    } catch (err) {
      console.error("Error fetching WhatsApp status:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchStatus(true);
    // Poll every 3 seconds while not connected
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: "connect" | "disconnect" | "restart") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus(true);
      }
    } catch (err) {
      console.error(`Error performing action ${action}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-400" />
            WhatsApp Nativo (Bot & Pedidos)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Conexión directa en puerto 3000 sin intermediarios ni Evolution API.
          </p>
        </div>

        {/* Estado badge */}
        <div>
          {status === "CONNECTED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          )}
          {status === "QR_READY" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Esperando Escaneo
            </span>
          )}
          {status === "CONNECTING" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Conectando...
            </span>
          )}
          {status === "DISCONNECTED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Desconectado
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-3" />
          <p>Consultando estado de WhatsApp en la base de datos...</p>
        </div>
      ) : status === "CONNECTED" ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">¡WhatsApp Vinculado con Éxito!</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
            Tu bot de menú digital está activo y escuchando mensajes entrantes. Cuando un cliente escriba "hola" o "menu", responderá automáticamente con los 5 platos principales de tu carta.
          </p>
          {phoneNumber && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-sm border border-slate-700 mb-6">
              <Phone className="w-4 h-4" /> +{phoneNumber}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleAction("disconnect")}
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              <Power className="w-4 h-4" /> Desvincular Sesión
            </button>
          </div>
        </div>
      ) : status === "QR_READY" && qrCode ? (
        <div className="text-center py-4">
          <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl mb-4 border-4 border-emerald-500/20">
            <QRCodeSVG value={qrCode} size={240} level="M" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Escanea el código QR desde WhatsApp</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Abre WhatsApp en tu teléfono &gt; Ajustes / Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => handleAction("restart")}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} /> Regenerar QR
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="w-14 h-14 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Power className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Sesión no inicializada</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            Inicia el socket nativo para generar el código QR y comenzar a recibir pedidos automáticos.
          </p>
          <button
            onClick={() => handleAction("connect")}
            disabled={actionLoading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-900/20 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? "animate-spin" : ""}`} /> Iniciar Conexión y Generar QR
          </button>
        </div>
      )}
    </div>
  );
}
