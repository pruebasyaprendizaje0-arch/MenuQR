"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
  Loader2,
  Save,
  MessageSquare,
  Cpu,
} from "lucide-react";

export function AISettingsTab({ restaurantId, restaurantSlug }: { restaurantId: string; restaurantSlug: string }) {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Estados del Formulario
  const [aiProvider, setAiProvider] = useState<"NONE" | "OPENAI" | "GEMINI" | "DEEPSEEK">("NONE");
  const [aiApiKey, setAiApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiPromptContext, setAiPromptContext] = useState("");
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(false);

  // Sincronización dinámica de modelos
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // Feedback Visual
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ai-settings?restaurantId=${restaurantId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setAiProvider(data.aiProvider || "NONE");
        let loadedModel = data.aiModel || "gpt-4o-mini";
        if (loadedModel === "gemini-2.0-flash") loadedModel = "gemini-1.5-flash";
        if (loadedModel === "gemini-1.5-pro") loadedModel = "gemini-1.5-pro-latest";
        setAiModel(loadedModel);
        setAiPromptContext(data.aiPromptContext || "");
        setAiFallbackEnabled(Boolean(data.aiFallbackEnabled));
        setHasApiKey(Boolean(data.hasApiKey));
        setMaskedApiKey(data.maskedApiKey || "");
        setAiApiKey(data.maskedApiKey || "");
      } else if (data.error) {
        setStatusMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      console.error("Error al cargar configuración de IA:", err);
      setStatusMessage({ type: "error", text: "No se pudo conectar con el servidor." });
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (isMounted) {
      loadSettings();
    }
  }, [isMounted, loadSettings]);

  const handleFetchModels = async () => {
    if (aiProvider === "NONE") return;
    setFetchingModels(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/ai-settings/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          aiProvider,
          aiApiKey,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        // Si el modelo actual no está en la lista retornada, seleccionar el primero
        const exists = data.models.some((m: any) => m.id === aiModel);
        if (!exists && data.models[0]) {
          setAiModel(data.models[0].id);
        }
        setStatusMessage({
          type: "success",
          text: `¡${data.models.length} modelos actualizados desde la API de ${aiProvider}!`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "No se pudieron obtener los modelos. Verifica tu clave API.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: "Error al sincronizar modelos: " + err.message,
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          aiProvider,
          aiApiKey,
          aiModel,
          aiPromptContext,
          aiFallbackEnabled,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: "¡Configuración del Asistente IA guardada correctamente!" });
        setHasApiKey(data.hasApiKey);
        setMaskedApiKey(data.maskedApiKey);
        setAiApiKey(data.maskedApiKey);
      } else {
        setStatusMessage({ type: "error", text: data.error || "Error al guardar cambios" });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Error de red: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/ai-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          aiProvider,
          aiApiKey,
          aiModel,
          aiPromptContext,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
          response: data.response,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "No se pudo validar la clave API. Verifica que la clave ingresada sea correcta y tenga crédito activo.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Error probando la conexión: " + err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isMounted || loading) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-3 max-w-4xl mx-auto">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Cargando módulo de Asistente IA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/50 via-slate-900 to-slate-950 border border-teal-500/20 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/10">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Asistente de Inteligencia Artificial (BYOK)
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Opcional / Híbrido
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Conecta tu propia cuenta de <strong>OpenAI</strong>, <strong>Google Gemini</strong> o <strong>DeepSeek</strong> para responder consultas complejas en WhatsApp manteniendo el motor determinista de 1 al 5 como base gratuita.
            </p>
          </div>
        </div>
      </div>

      {/* Explicación de BYOK */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-3 backdrop-blur-md">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="h-4 w-4" />
          ¿Cómo funciona "Bring Your Own Key" (BYOK)?
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Por defecto, <strong>MenuQR Pro</strong> funciona 100% gratis con un menú determinista (opciones 1 al 5). Si deseas que el bot responda preguntas abiertas sobre platos, recomendaciones o historia de tu negocio, ingresa tu clave API personal de OpenAI, Google Gemini o DeepSeek. <strong>Pagarás directamente a tu proveedor de IA a costo de consumo centavicular sin sobreprecio.</strong>
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Formulario Principal */}
      <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-2xl backdrop-blur-md">
        {/* Switch Principal */}
        <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
          <div>
            <strong className="text-sm text-white block">Activar Asistente Inteligente en WhatsApp</strong>
            <p className="text-xs text-slate-400 mt-0.5">
              Si está activo, los mensajes que no correspondan a las opciones 1-5 se responderán con tu modelo de IA.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiFallbackEnabled(!aiFallbackEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              aiFallbackEnabled ? "bg-emerald-500" : "bg-slate-800"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                aiFallbackEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Selección de Proveedor */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            1. Selecciona tu Proveedor de Inteligencia Artificial
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Desactivado */}
            <button
              type="button"
              onClick={() => {
                setAiProvider("NONE");
                setAiFallbackEnabled(false);
                setAvailableModels([]);
              }}
              className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                aiProvider === "NONE"
                  ? "bg-slate-800/90 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Desactivado</span>
                {aiProvider === "NONE" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400">100% Determinista (FSM Opciones 1-5). Sin costo API.</p>
            </button>

            {/* OpenAI */}
            <button
              type="button"
              onClick={() => {
                setAiProvider("OPENAI");
                setAiModel("gpt-4o-mini");
                setAvailableModels([]);
              }}
              className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                aiProvider === "OPENAI"
                  ? "bg-teal-950/60 border-teal-500/60 text-white ring-1 ring-teal-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-teal-400" />
                  OpenAI
                </span>
                {aiProvider === "OPENAI" && <CheckCircle2 className="h-4 w-4 text-teal-400" />}
              </div>
              <p className="text-[11px] text-slate-400">GPT-4o-mini, GPT-4o (Respuestas precisas).</p>
            </button>

            {/* Google Gemini */}
            <button
              type="button"
              onClick={() => {
                setAiProvider("GEMINI");
                setAiModel("gemini-1.5-flash");
                setAvailableModels([]);
              }}
              className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                aiProvider === "GEMINI"
                  ? "bg-blue-950/60 border-blue-500/60 text-white ring-1 ring-blue-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Google Gemini
                </span>
                {aiProvider === "GEMINI" && <CheckCircle2 className="h-4 w-4 text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-400">Gemini 1.5 / 2.0 Flash (Opción económica de Google).</p>
            </button>

            {/* DeepSeek */}
            <button
              type="button"
              onClick={() => {
                setAiProvider("DEEPSEEK");
                setAiModel("deepseek-chat");
                setAvailableModels([]);
              }}
              className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                aiProvider === "DEEPSEEK"
                  ? "bg-indigo-950/60 border-indigo-500/60 text-white ring-1 ring-indigo-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-indigo-400" />
                  DeepSeek
                </span>
                {aiProvider === "DEEPSEEK" && <CheckCircle2 className="h-4 w-4 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400">DeepSeek-V3 & R1 (Alta potencia al menor costo).</p>
            </button>
          </div>
        </div>

        {aiProvider !== "NONE" && (
          <>
            {/* Clave API e Selección de Modelo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center justify-between">
                  <span>2. Tu Clave API ({aiProvider})</span>
                  {hasApiKey && <span className="text-[10px] text-emerald-400 font-mono">Clave Guardada</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={
                      aiProvider === "OPENAI"
                        ? "sk-proj-..."
                        : aiProvider === "DEEPSEEK"
                        ? "sk-..."
                        : "AIzaSy..."
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {aiProvider === "OPENAI" && (
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:underline"
                    >
                      Obtén tu clave en platform.openai.com/api-keys
                    </a>
                  )}
                  {aiProvider === "GEMINI" && (
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Obtén tu clave gratuita en aistudio.google.com
                    </a>
                  )}
                  {aiProvider === "DEEPSEEK" && (
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Obtén tu clave en platform.deepseek.com/api_keys
                    </a>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    3. Modelo de Lenguaje
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels}
                    title="Consultar modelos disponibles en tiempo real con tu API Key"
                    className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 transition font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${fetchingModels ? "animate-spin" : ""}`} />
                    {fetchingModels ? "Sincronizando..." : "Ver Modelos Actualizados"}
                  </button>
                </div>

                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  ) : aiProvider === "OPENAI" ? (
                    <>
                      <option value="gpt-4o-mini">gpt-4o-mini (Recomendado - Rápido y Económico)</option>
                      <option value="gpt-4o">gpt-4o (Máxima Capacidad)</option>
                      <option value="o3-mini">o3-mini (Razonamiento Rápido)</option>
                      <option value="gpt-4-turbo">gpt-4-turbo (Avanzado)</option>
                    </>
                  ) : aiProvider === "DEEPSEEK" ? (
                    <>
                      <option value="deepseek-chat">deepseek-chat (DeepSeek-V3 - Rápido y Muy Económico)</option>
                      <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1 - Razonamiento Avanzado)</option>
                    </>
                  ) : (
                    <>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Ultrarrápido, Estable y Recomendado)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Modelo 2.5 Flash)</option>
                      <option value="gemini-1.5-pro-latest">gemini-1.5-pro-latest (Pro - Razonamiento Profundo)</option>
                      <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (Ultraliviano)</option>
                    </>
                  )}
                </select>
                <p className="text-[10px] text-slate-500">
                  {availableModels.length > 0
                    ? `Mostrando lista de ${availableModels.length} modelos oficiales actualizados desde la API.`
                    : "Haz clic en 'Ver Modelos Actualizados' para listar todos los modelos activos de tu cuenta."}
                </p>
              </div>
            </div>

            {/* Contexto del Restaurante */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                4. Contexto Personalizado de tu Restaurante (System Prompt)
              </label>
              <textarea
                value={aiPromptContext}
                onChange={(e) => setAiPromptContext(e.target.value)}
                rows={4}
                placeholder="Ejemplo: Somos un restaurante especializado en mariscos frescos en Guayaquil. Nuestros platos estrella son el Encebollado Mixto y el Cazuela de Cangrejo. Contamos con opciones vegetarianas y ambiente climatizado."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 leading-relaxed"
              />
              <p className="text-[11px] text-slate-500">
                La IA utilizará esta información junto con tu menú cargado para responder a los comensales en WhatsApp.
              </p>
            </div>

            {/* Test Connection Button & Result */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-300 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Prueba de Conexión en Tiempo Real
                </span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-teal-300 border border-teal-500/30 transition disabled:opacity-50 shrink-0"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {testing ? "Probando API Key..." : "Probar Conexión con mi API Key"}
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-xl text-xs space-y-2 border ${
                    testResult.success
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                      : "bg-red-950/40 border-red-500/30 text-red-300"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                    {testResult.message}
                  </p>
                  {testResult.response && (
                    <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-lg text-[11px] font-mono text-slate-200">
                      <strong>Respuesta Generada por IA:</strong>
                      <p className="mt-1 italic text-slate-300">"{testResult.response}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Botón de Guardar */}
        <div className="border-t border-slate-800/80 pt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-lg shadow-teal-600/20 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando..." : "Guardar Configuración de IA"}
          </button>
        </div>
      </div>
    </div>
  );
}
