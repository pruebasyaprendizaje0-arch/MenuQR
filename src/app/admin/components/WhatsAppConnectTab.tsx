"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2,
  Trash2,
} from "lucide-react";

export function WhatsAppConnectTab({ restaurantId, restaurantSlug }: { restaurantId: string; restaurantSlug: string }) {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<"open" | "connecting" | "close" | "unknown">("unknown");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Garantizar el montaje limpio del componente para evitar React Hydration Error (#418)
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
          setErrorMsg(null);
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
        if (data.state === "open" || data.alreadyConnected) {
          setConnectionState("open");
          setQrBase64(null);
          setPairingCode(null);
          setErrorMsg(null);
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

  // Carga inicial al montar el componente
  useEffect(() => {
    if (isMounted) {
      checkStatus();
    }
  }, [isMounted, checkStatus]);

  // Polling automático mientras está en estado "connecting" o con QR activo
  useEffect(() => {
    if (isMounted && connectionState === "connecting") {
      pollingTimerRef.current = setInterval(() => {
        checkStatus();
      }, 5000);
    } else {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [isMounted, connectionState, checkStatus]);

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de cerrar la sesión de esta cuenta de WhatsApp?")) {
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
        setPairingCode(null);
      }
    } catch (err: any) {
      alert("Error al desconectar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetInstance = async () => {
    if (!confirm("¿Deseas reiniciar por completo la instancia de WhatsApp? Esto eliminará la conexión en Evolution API para forzar un nuevo código QR limpio.")) {
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/whatsapp/instance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action: "delete" }),
      });
      const data = await res.json();
      if (data.error) {
        alert("Aviso: " + data.error);
      }
      setConnectionState("close");
      setQrBase64(null);
      setPairingCode(null);
      alert("Instancia reiniciada. Puedes hacer clic en 'Generar Código QR' para emparejar un nuevo número.");
    } catch (err: any) {
      alert("Error al reiniciar instancia: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render inicial para garantizar Hydration sin discrepancias servidor/cliente
  if (!isMounted) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-3 max-w-4xl mx-auto">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Cargando panel de vinculación de WhatsApp...</p>
      </div>
    );
  }

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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700 transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
              Si deseas cambiar de número telefónico o desvincular el bot, puedes cerrar sesión o reiniciar la instancia.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-750 transition border border-slate-700 shrink-0"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </button>
              <button
                type="button"
                onClick={handleResetInstance}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600/90 hover:bg-red-600 transition shadow-lg shadow-red-600/20 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                Reiniciar Instancia
              </button>
            </div>
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
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-xs text-red-400 space-y-2 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Estado de Conexión:</strong>
                    <p className="mt-0.5">{errorMsg}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetInstance}
                  className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/30 transition"
                >
                  <Trash2 className="h-3 w-3" />
                  Reiniciar Instancia para Generar QR Nuevo
                </button>
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

                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin" />
                  Verificando estado automáticamente cada 5 segundos...
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

            <div className="space-y-2">
              <button
                type="button"
                onClick={loadQRCode}
                disabled={isRefreshing || loading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing
                  ? "Cargando QR..."
                  : formattedQrSrc
                  ? "Regenerar Código QR"
                  : "Generar Código QR de WhatsApp"}
              </button>

              <button
                type="button"
                onClick={handleResetInstance}
                disabled={isRefreshing || loading}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition border border-transparent hover:border-slate-750"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reiniciar Instancia / Forzar Nuevo QR
              </button>
            </div>
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
