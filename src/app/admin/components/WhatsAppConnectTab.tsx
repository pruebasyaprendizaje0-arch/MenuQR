"use client";

import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

export function WhatsAppConnectTab({ restaurantId, restaurantSlug }: { restaurantId: string; restaurantSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<"open" | "connecting" | "close" | "unknown">("unknown");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/whatsapp/instance?restaurantId=${restaurantId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success && data.status) {
        setConnectionState(data.status);
        if (data.status === "open") {
          setQrBase64(null);
          setPairingCode(null);
        }
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      console.error("Error al obtener estado de WhatsApp:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const loadQRCode = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/whatsapp/qr?restaurantId=${restaurantId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `HTTP ${res.status}`);
      } else if (data.success) {
        if (data.state === "open") {
          setConnectionState("open");
          setQrBase64(null);
        } else {
          setQrBase64(data.base64 || null);
          setPairingCode(data.pairingCode || null);
          setConnectionState("connecting");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor de WhatsApp.");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de desconectar esta cuenta de WhatsApp? El bot dejará de responder automáticamente hasta que vuelvas a vincular el QR.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/instance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action: "disconnect" }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setConnectionState("close");
        setQrBase64(null);
      }
    } catch (err: any) {
      alert("Error al desconectar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formattedQrSrc = qrBase64
    ? qrBase64.startsWith("data:")
      ? qrBase64
      : `data:image/png;base64,${qrBase64}`
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/20 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Integración Oficial de WhatsApp
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Evolution API v2
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escanea el código QR desde tu aplicación de WhatsApp para vincular el bot automatizado de tu negocio (Instancia: <code className="text-amber-300 font-mono">{restaurantSlug}</code>).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={checkStatus}
          disabled={loading || isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700 transition shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar Estado
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Verificando estado de conexión con WhatsApp...</p>
        </div>
      ) : connectionState === "open" ? (
        /* ESTADO: CONECTADO */
        <div className="bg-slate-900/60 border border-emerald-500/30 p-8 rounded-3xl space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                ¡WhatsApp Vinculado y Operativo!
              </h3>
              <p className="text-xs text-emerald-400/90 mt-0.5">
                Tu bot automático responderá inmediatamente las solicitudes de menú, estados de pedidos y atención en tu WhatsApp.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Estado de Instancia</span>
              <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                CONECTADO (OPEN)
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">ID de Instancia</span>
              <p className="text-sm font-mono font-bold text-white">{restaurantSlug}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Seguridad Anti-Spam</span>
              <p className="text-sm font-bold text-amber-400 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                Activa (Delays FSM)
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Si deseas cambiar de número telefónico o desvincular el bot, haz clic en desconectar.
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600/90 hover:bg-red-600 transition shadow-lg shadow-red-600/20 shrink-0"
            >
              <LogOut className="h-4 w-4" />
              Desconectar WhatsApp
            </button>
          </div>
        </div>
      ) : (
        /* ESTADO: DESCONECTADO - MOSTRAR CÓDIGO QR */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Columna Izquierda: Tarjeta QR */}
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl text-center space-y-6 shadow-2xl backdrop-blur-md">
            <div>
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                Código QR de Vinculación
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Haz clic en generar QR para escanearlo con la cámara de WhatsApp de tu teléfono.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-xs text-red-400 flex items-start gap-2 text-left">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Error de Conexión:</strong>
                  <p className="mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {formattedQrSrc ? (
              <div className="space-y-4">
                <div className="inline-block p-4 bg-white rounded-3xl shadow-2xl border-4 border-emerald-500/40">
                  <img
                    src={formattedQrSrc}
                    alt="Código QR de WhatsApp Evolution API"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                {pairingCode && (
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl inline-block">
                    <span className="text-[11px] text-slate-400 block">Código de Emparejamiento por Número:</span>
                    <span className="font-mono text-base font-black text-amber-400 tracking-widest">{pairingCode}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  ⏳ El código QR se actualiza periódicamente. Si expira, presiona regenerar.
                </p>
              </div>
            ) : (
              <div className="py-8 space-y-4">
                <div className="h-48 w-48 mx-auto bg-slate-950 border border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-600">
                  <QrCode className="h-16 w-16 opacity-40" />
                  <span className="text-xs">QR no generado aún</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={loadQRCode}
              disabled={isRefreshing}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20 transition duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {formattedQrSrc ? "Regenerar Código QR" : "Generar Código QR de WhatsApp"}
            </button>
          </div>

          {/* Columna Derecha: Instrucciones paso a paso */}
          <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              ¿Cómo conectar tu número en 3 pasos?
            </h3>

            <ol className="space-y-4 text-xs">
              <li className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <div>
                  <strong className="text-white block text-sm">Abre WhatsApp en tu Teléfono</strong>
                  <p className="text-slate-400 mt-0.5">Utiliza la aplicación normal o WhatsApp Business en el teléfono del restaurante.</p>
                </div>
              </li>

              <li className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <div>
                  <strong className="text-white block text-sm">Accede a Dispositivos Vinculados</strong>
                  <p className="text-slate-400 mt-0.5">Ve al menú de Ajustes (o los 3 puntos superiores) &gt; <strong>Dispositivos vinculados</strong> &gt; <strong>Vincular un dispositivo</strong>.</p>
                </div>
              </li>

              <li className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <div>
                  <strong className="text-white block text-sm">Escanea el Código QR</strong>
                  <p className="text-slate-400 mt-0.5">Apunta la cámara de tu teléfono al código QR generado a la izquierda. ¡Y listo! La conexión se activará automáticamente.</p>
                </div>
              </li>
            </ol>

            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-xs text-amber-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Garantía Anti-Baneo Meta
              </span>
              <p className="text-[11px] text-amber-300/80">
                La automatización de MenuQR Pro utiliza delays aleatorios de tipeo y pausas de atención humana de 45 minutos para mantener tu número seguro.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
