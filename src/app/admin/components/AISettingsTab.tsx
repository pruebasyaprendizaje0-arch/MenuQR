"use client";

import { useState, useEffect } from "react";
import { 
  Bot, 
  Key, 
  Sparkles, 
  Check, 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Send, 
  HelpCircle,
  Cpu,
  Layers,
  ShieldCheck
} from "lucide-react";

interface Props {
  restaurantId: string;
  restaurantSlug: string;
}

const PROVIDERS = [
  { 
    id: "NONE", 
    name: "Desactivado (Solo Plantillas Baileys)", 
    desc: "Costo $0. El bot responde únicamente con tus plantillas y alternativas predefinidas.",
    defaultModel: "",
  },
  { 
    id: "GEMINI", 
    name: "Google Gemini (Recomendado Económico/Gratis)", 
    desc: "Ultra rápido con cuota gratuita generosa. Requiere API Key de Google AI Studio.",
    defaultModel: "gemini-1.5-flash",
  },
  { 
    id: "OPENAI", 
    name: "OpenAI (ChatGPT)", 
    desc: "Modelo oficial de OpenAI (GPT-4o-mini). Requiere API Key de platform.openai.com.",
    defaultModel: "gpt-4o-mini",
  },
  { 
    id: "GROQ", 
    name: "Groq (Llama 3 - Ultra Rápido)", 
    desc: "Latencia menor a 400ms con modelos Llama 3 de código abierto. Requiere clave de Groq.",
    defaultModel: "llama-3.3-70b-versatile",
  },
  { 
    id: "DEEPSEEK", 
    name: "DeepSeek AI", 
    desc: "Modelo inteligente y económico. Requiere API Key de platform.deepseek.com.",
    defaultModel: "deepseek-chat",
  },
];

export function AISettingsTab({ restaurantId, restaurantSlug }: Props) {
  const [provider, setProvider] = useState<string>("NONE");
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-4o-mini");
  const [promptContext, setPromptContext] = useState<string>("");
  const [fallbackEnabled, setFallbackEnabled] = useState<boolean>(true);

  const [hasStoredKey, setHasStoredKey] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; reply?: string; error?: string } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/ai-settings?restaurantId=${restaurantId}`);
        const data = await res.json();
        if (data.success) {
          setProvider(data.aiProvider || "NONE");
          setModel(data.aiModel || "gpt-4o-mini");
          setPromptContext(data.aiPromptContext || "");
          setFallbackEnabled(data.aiFallbackEnabled ?? true);
          setHasStoredKey(Boolean(data.hasApiKey));
          setMaskedKey(data.maskedApiKey || "");
        }
      } catch (err) {
        console.error("Error cargando configuración de IA:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [restaurantId]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const found = PROVIDERS.find((p) => p.id === newProvider);
    if (found && found.defaultModel) {
      setModel(found.defaultModel);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          aiProvider: provider,
          aiApiKey: apiKey.trim() || undefined, // Si está vacía, no sobreescribe la guardada
          aiModel: model.trim(),
          aiPromptContext: promptContext.trim(),
          aiFallbackEnabled: fallbackEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveToast("Configuración de IA guardada exitosamente.");
        setTimeout(() => setSaveToast(null), 3500);
        if (data.hasApiKey) {
          setHasStoredKey(true);
          setApiKey("");
        }
      } else {
        alert(data.error || "Error al guardar configuración de IA.");
      }
    } catch (err) {
      console.error("Error al guardar IA:", err);
      alert("Error de conexión al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (provider === "NONE") {
      alert("Selecciona un proveedor de IA (Gemini, OpenAI, etc.) antes de probar.");
      return;
    }
    if (!apiKey && !hasStoredKey) {
      alert("Ingresa una API Key para probar la conexión.");
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch("/api/admin/ai-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          aiProvider: provider,
          aiApiKey: apiKey.trim() || undefined,
          aiModel: model.trim(),
          aiPromptContext: promptContext.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          reply: data.response || data.message || "Conexión exitosa.",
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || "La IA rechazó la solicitud.",
        });
      }
    } catch (err) {
      console.error("Error probando IA:", err);
      setTestResult({ success: false, error: "Error de red al conectar con el proveedor de IA." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-xs">Cargando configuración de IA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            Asistente de IA Propio (BYOK - Bring Your Own Key)
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Conecta tu propia cuenta de IA. Si un cliente escribe a WhatsApp una duda libre que no esté en tus plantillas (ej. <em>"¿tienen platos vegetarianos?"</em>), tu IA le responderá usando tu carta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cuenta del Restaurante</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
        {/* Selector de Proveedor */}
        <div>
          <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
            1. Selecciona tu Proveedor de IA
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => {
              const isSelected = provider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between ${
                    isSelected
                      ? "bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/30"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-white"}`}>
                      {p.name}
                    </span>
                    <input
                      type="radio"
                      name="aiProvider"
                      checked={isSelected}
                      onChange={() => handleProviderChange(p.id)}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Campos de Configuración si no es NONE */}
        {provider !== "NONE" && (
          <div className="space-y-4 pt-4 border-t border-slate-800/80 animate-in fade-in">
            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tu Clave Secreta (API Key)</span>
                </label>
                {hasStoredKey && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ✓ Clave guardada: {maskedKey}
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={hasStoredKey ? "Dejar en blanco para mantener la clave actual" : "Pega aquí tu API Key (sk-... o AIza...)"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Tu clave se almacena de forma segura en PostgreSQL y solo se utiliza para atender los chats de este local.
              </p>
            </div>

            {/* Modelo de IA */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modelo a Utilizar</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ej: gemini-1.5-flash, gpt-4o-mini, llama-3.3-70b-versatile"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Instrucciones especiales / Personalidad */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instrucciones Especiales del Restaurante (System Prompt Adicional)</span>
              </label>
              <textarea
                rows={3}
                value={promptContext}
                onChange={(e) => setPromptContext(e.target.value)}
                placeholder="Ej: Somos un restaurante familiar. Tenemos opciones vegetarianas y parqueadero gratuito. Recomienda el postre de la casa si preguntan por dulces."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                El bot ya conoce tus platos, precios y horarios automáticamente. Usa este campo solo para detalles adicionales de tu servicio.
              </p>
            </div>

            {/* Botón de Prueba */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || saving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    Probando conexión con IA...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    Probar Conexión con IA
                  </>
                )}
              </button>
            </div>

            {/* Resultado de la prueba */}
            {testResult && (
              <div
                className={`p-4 rounded-xl border text-xs leading-relaxed animate-in fade-in ${
                  testResult.success
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/20 border-red-500/40 text-red-200"
                }`}
              >
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  {testResult.success ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      ¡Respuesta Exitosa de la IA!
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Fallo en la prueba de IA:
                    </>
                  )}
                </div>
                <p className="whitespace-pre-wrap font-sans">
                  {testResult.success ? testResult.reply : testResult.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botón Guardar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando configuración...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar Configuración de IA
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
