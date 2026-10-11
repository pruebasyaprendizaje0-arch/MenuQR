"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  RotateCcw, 
  Check, 
  Loader2, 
  Eye, 
  Sparkles, 
  HelpCircle,
  Tag,
  AlertCircle
} from "lucide-react";

interface WhatsAppTemplate {
  id: string;
  restaurantId: string;
  key: string;
  title: string;
  trigger: string | null;
  content: string;
  order: number;
  isActive: boolean;
}

interface Props {
  restaurantId: string;
  restaurantSlug: string;
}

const DYNAMIC_VARIABLES = [
  { tag: "{nombre}", label: "Nombre Local", desc: "Nombre de tu restaurante" },
  { tag: "{link_menu}", label: "Enlace Carta", desc: "URL interactiva del menú digital" },
  { tag: "{horario}", label: "Horarios", desc: "Horarios de atención configurados" },
  { tag: "{direccion}", label: "Dirección", desc: "Dirección física del restaurante" },
  { tag: "{maps}", label: "Google Maps", desc: "Enlace a Google Maps" },
  { tag: "{datos_banco}", label: "Cuentas Banco", desc: "Datos para transferencias" },
];

export function WhatsAppTemplatesManager({ restaurantId }: Props) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal de edición / creación
  const [editingTemplate, setEditingTemplate] = useState<Partial<WhatsAppTemplate> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/whatsapp-templates?restaurantId=${restaurantId}`);
      const data = await res.json();
      if (data.success && data.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("Error cargando plantillas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [restaurantId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate({ ...template });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingTemplate({
      title: "",
      trigger: "",
      content: "",
      isActive: true,
      order: templates.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.title?.trim() || !editingTemplate.content?.trim()) {
      alert("Por favor completa el título y el contenido de la plantilla.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/whatsapp-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          ...editingTemplate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingTemplate.id ? "Plantilla actualizada con éxito." : "Nueva plantilla creada.");
        setIsModalOpen(false);
        setEditingTemplate(null);
        await fetchTemplates();
      } else {
        alert(data.error || "Error al guardar plantilla.");
      }
    } catch (err) {
      console.error("Error guardando plantilla:", err);
      alert("Error de conexión al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar la plantilla "${title}"?`)) return;

    try {
      setSaving(true);
      const res = await fetch("/api/admin/whatsapp-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, templateId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Plantilla eliminada.");
        await fetchTemplates();
      } else {
        alert(data.error || "Error al eliminar plantilla.");
      }
    } catch (err) {
      console.error("Error eliminando plantilla:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("¿Deseas restaurar todas las plantillas predeterminadas del sistema? Los textos personalizados se reemplazarán por los valores iniciales.")) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/whatsapp-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Plantillas restauradas a los valores por defecto.");
        await fetchTemplates();
      }
    } catch (err) {
      console.error("Error al restaurar plantillas:", err);
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (tag: string) => {
    if (!editingTemplate) return;
    setEditingTemplate((prev) => ({
      ...prev,
      content: (prev?.content || "") + ` ${tag} `,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header con acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Plantillas Automáticas de WhatsApp (Baileys)
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Edita las respuestas automáticas de tu bot. Cuando un cliente escribe a tu WhatsApp, Baileys responde con tus alternativas de forma inmediata.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 transition flex items-center gap-1.5 border border-slate-700"
            title="Restaurar textos predeterminados del sistema"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Predeterminadas</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Plantilla</span>
          </button>
        </div>
      </div>

      {/* Lista de Plantillas */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs">Cargando plantillas de WhatsApp...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <p className="text-sm text-slate-400">No tienes plantillas configuradas.</p>
          <button
            onClick={handleResetDefaults}
            className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Generar Plantillas Predeterminadas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => {
            const isWelcome = tmpl.key === "welcome";
            const isFallback = tmpl.key === "fallback";

            return (
              <div
                key={tmpl.id}
                className={`bg-slate-900/70 border rounded-2xl p-4 flex flex-col justify-between transition hover:border-slate-700 ${
                  isWelcome
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : isFallback
                    ? "border-amber-500/20 bg-amber-950/5"
                    : "border-slate-800"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{tmpl.title}</span>
                      {isWelcome && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Bienvenida
                        </span>
                      )}
                      {isFallback && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Fallback
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tmpl)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition"
                        title="Editar plantilla"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                      {!isWelcome && !isFallback && (
                        <button
                          type="button"
                          onClick={() => handleDelete(tmpl.id, tmpl.title)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Disparadores / Triggers */}
                  {tmpl.trigger ? (
                    <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        Disparadores:
                      </span>
                      {tmpl.trigger.split(",").slice(0, 4).map((trig, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700/60"
                        >
                          {trig.trim()}
                        </span>
                      ))}
                      {tmpl.trigger.split(",").length > 4 && (
                        <span className="text-[10px] text-slate-500 font-semibold">
                          +{tmpl.trigger.split(",").length - 4} más
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mb-2.5 text-[10px] text-slate-500 italic">
                      {isFallback
                        ? "Se activa cuando el cliente escribe algo fuera de las opciones (y no hay IA activa)"
                        : "Mensaje inicial de saludo general"}
                    </div>
                  )}

                  {/* Previsualización del Contenido */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-850 text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {tmpl.content}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Clave: {tmpl.key}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Activa en Baileys
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE EDICIÓN / CREACIÓN */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                {editingTemplate.id ? "Editar Plantilla de WhatsApp" : "Nueva Alternativa de WhatsApp"}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Título de la Plantilla */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título de la Alternativa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Opción 1: Carta Digital o Promociones"
                  value={editingTemplate.title || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Palabras clave / Disparadores */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Palabras Clave / Disparadores (separadas por coma)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Ej: 1, carta, pedir, menú</span>
                </label>
                <input
                  type="text"
                  placeholder="1, carta, pedir, ver menu"
                  value={editingTemplate.trigger || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, trigger: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Si el cliente escribe cualquiera de estas palabras o el número, Baileys responderá esta plantilla.
                </p>
              </div>

              {/* Variables dinámicas para insertar */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Insertar Variables Dinámicas (Haz clic para agregar al texto):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DYNAMIC_VARIABLES.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariable(v.tag)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950/40 text-emerald-300 hover:text-emerald-200 border border-slate-700 text-[10px] font-mono transition"
                      title={v.desc}
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenido / Texto de la plantilla */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Mensaje que recibirá el cliente en WhatsApp
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Escribe el texto de respuesta..."
                  value={editingTemplate.content || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-sans leading-relaxed focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Puedes usar formato de WhatsApp: *negrita*, _cursiva_, ~tachado~ y emojis.
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Guardar Plantilla
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
