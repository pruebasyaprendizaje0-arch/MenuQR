"use client";

import React, { useState } from "react";
import {
  Megaphone,
  Bell,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  MessageSquare,
  Users,
  Eye,
  Info,
} from "lucide-react";
import {
  saveGlobalAnnouncementAction,
  GlobalAnnouncementData,
} from "@/lib/superadmin-extra-actions";

export interface AnnouncementsTabProps {
  initialAnnouncement: GlobalAnnouncementData;
  restaurants: any[];
}

export function SuperAdminAnnouncementsTab({
  initialAnnouncement,
  restaurants,
}: AnnouncementsTabProps) {
  const [announcement, setAnnouncement] = useState<GlobalAnnouncementData>(initialAnnouncement);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Estados de Difusión WhatsApp
  const [broadcastAudience, setBroadcastAudience] = useState<"ALL" | "EXPIRING" | "SUSPENDED">("EXPIRING");
  const [broadcastTemplate, setBroadcastTemplate] = useState<"NEW_FEATURE" | "TRIAL_EXPIRING" | "SUPPORT">("TRIAL_EXPIRING");
  const [customBroadcastText, setCustomBroadcastText] = useState("");

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const res = await saveGlobalAnnouncementAction(announcement);
    setIsSaving(false);

    if (res?.success) {
      setSaveStatus({
        type: "success",
        msg: announcement.active
          ? "¡Comunicado publicado con éxito! Ya es visible en el panel de todos los clientes."
          : "Comunicado desactivado. Ya no se muestra en el panel de clientes.",
      });
      setTimeout(() => setSaveStatus(null), 5000);
    } else {
      setSaveStatus({ type: "error", msg: res?.error || "Error al guardar el comunicado." });
    }
  };

  // Filtrado de audiencia para WhatsApp
  const today = new Date();
  const getAudienceList = () => {
    if (broadcastAudience === "EXPIRING") {
      return restaurants.filter((r) => {
        if (!r.trialEndsAt || r.isSuspended) return false;
        const diffDays = Math.ceil((new Date(r.trialEndsAt).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 5;
      });
    }
    if (broadcastAudience === "SUSPENDED") {
      return restaurants.filter((r) => r.isSuspended);
    }
    return restaurants;
  };

  const targetRecipients = getAudienceList();

  const getPresetMessage = (r: any) => {
    if (customBroadcastText) return customBroadcastText;
    if (broadcastTemplate === "TRIAL_EXPIRING") {
      return `Hola ${r.userName || ""}, te saludamos de MenuQR Pro. Te recordamos que el período de prueba de "${r.name}" está por finalizar. Para continuar recibiendo pedidos sin interrupción y conservar tu menú digital activo, puedes renovar hoy mismo tu plan PRO. ¿Te gustaría coordinar la activación?`;
    }
    if (broadcastTemplate === "NEW_FEATURE") {
      return `¡Hola ${r.userName || ""}! Hemos lanzado una nueva actualización en MenuQR Pro para "${r.name}": ahora puedes activar la Ruleta de Premios Interactiva y el Control de Caja POS desde tu panel de administración. Ingresa a tu panel para probarlo gratis: https://ubicame.cc/admin`;
    }
    return `Hola ${r.userName || ""}, te escribe el equipo de soporte de MenuQR Pro. Queríamos consultar cómo te está yendo con tu carta digital para "${r.name}" y si necesitas ayuda con fotos, precios o códigos QR para tus mesas o local. ¡Estamos a tu servicio!`;
  };

  const handleSendSingleWhatsApp = (r: any) => {
    const phone = (r.whatsappNumber || r.whatsapp || "").replace(/\D/g, "");
    if (!phone) {
      alert("Este negocio no tiene número de WhatsApp.");
      return;
    }
    const message = getPresetMessage(r);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 mb-2">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Comunicación Directa & Avisos Globales</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Anuncios In-App & Centro de Difusión
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Publica banners visibles en el panel de todos los clientes y envía comunicados segmentados por WhatsApp.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* COLUMNA 1: Creador de Banner Global In-App */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Banner Global para Paneles (/admin)</h3>
                  <p className="text-xs text-slate-400">Mensaje superior visible para los dueños de negocios.</p>
                </div>
              </div>

              {/* Interruptor Activo / Inactivo */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-400">
                  {announcement.active ? "PUBLICADO" : "PAUSADO"}
                </span>
                <input
                  type="checkbox"
                  checked={announcement.active}
                  onChange={(e) => setAnnouncement((prev) => ({ ...prev, active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              {/* Estilo Visual */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Tipo de Comunicado
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "info", label: "Informativo", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
                      { id: "success", label: "Novedad", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
                      { id: "warning", label: "Mantenimiento", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
                      { id: "promo", label: "Promoción", color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAnnouncement((prev) => ({ ...prev, type: t.id }))}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        announcement.type === t.id
                          ? `${t.color} ring-2 ring-white/20 shadow-md`
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Contenido del Anuncio
                </label>
                <textarea
                  rows={3}
                  required
                  value={announcement.text}
                  onChange={(e) => setAnnouncement((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder="Ej: 🎉 ¡Nuevo módulo de Ruleta disponible! Fideliza a tus clientes con descuentos y premios desde hoy."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Enlace opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Enlace de Acción (Opcional)
                </label>
                <input
                  type="text"
                  value={announcement.link || ""}
                  onChange={(e) => setAnnouncement((prev) => ({ ...prev, link: e.target.value }))}
                  placeholder="Ej: /admin?tab=ruleta o https://soporte.ubicame.cc"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Vista Previa en Vivo */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Vista Previa en el Panel del Cliente:</span>
                </span>
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    announcement.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : announcement.type === "warning"
                      ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                      : announcement.type === "promo"
                      ? "bg-purple-950/40 border-purple-500/40 text-purple-300"
                      : "bg-blue-950/40 border-blue-500/40 text-blue-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs font-semibold">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{announcement.text || "Escribe el texto de tu comunicado arriba..."}</span>
                  </div>
                  {announcement.link && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 shrink-0">
                      Ver detalle ↗
                    </span>
                  )}
                </div>
              </div>

              {saveStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    saveStatus.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/30"
                  }`}
                >
                  {saveStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{saveStatus.msg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Guardando Comunicado..." : "Guardar & Aplicar Comunicado"}
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA 2: Difusión Segmentada por WhatsApp */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Difusión Segmentada por WhatsApp</h3>
                <p className="text-xs text-slate-400">Envía avisos de cobro, novedades o soporte con 1 clic.</p>
              </div>
            </div>

            {/* Selector de Audiencia */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Audiencia Objetivo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastAudience("EXPIRING")}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                      broadcastAudience === "EXPIRING"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Por Vencer (≤ 5d)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastAudience("SUSPENDED")}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                      broadcastAudience === "SUSPENDED"
                        ? "bg-red-500/20 text-red-400 border-red-500/40 shadow"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Suspendidos
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastAudience("ALL")}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                      broadcastAudience === "ALL"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos ({restaurants.length})
                  </button>
                </div>
              </div>

              {/* Plantilla de Mensaje */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Plantilla de Mensaje
                </label>
                <select
                  value={broadcastTemplate}
                  onChange={(e) => setBroadcastTemplate(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="TRIAL_EXPIRING">⏰ Recordatorio de Renovación PRO</option>
                  <option value="NEW_FEATURE">🚀 Anuncio de Nuevas Funciones</option>
                  <option value="SUPPORT">🤝 Asistencia y Soporte Personalizado</option>
                </select>
              </div>

              {/* Mensaje Personalizado Opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Texto Personalizado (Reemplaza la plantilla si se escribe algo):
                </label>
                <textarea
                  rows={2}
                  value={customBroadcastText}
                  onChange={(e) => setCustomBroadcastText(e.target.value)}
                  placeholder="Escribe un mensaje libre aquí si no deseas usar la plantilla..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Lista de Destinatarios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Destinatarios Filtrados ({targetRecipients.length})
                  </span>
                  <span className="text-[11px] text-slate-500">Haz clic en enviar para abrir WhatsApp</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {targetRecipients.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-500">
                      No hay comercios que coincidan con este filtro.
                    </div>
                  ) : (
                    targetRecipients.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{r.name}</h5>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {r.userName || "Dueño"} • {r.whatsappNumber || "Sin teléfono"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendSingleWhatsApp(r)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Enviar</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
