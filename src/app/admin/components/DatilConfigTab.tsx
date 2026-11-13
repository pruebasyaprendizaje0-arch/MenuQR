"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  KeyRound,
  ShieldCheck,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Globe2,
  Info,
  Check,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import {
  getDatilConfigAction,
  saveDatilConfigAction,
  testDatilConnectionAction,
  DatilConfigDTO,
} from "@/lib/datil-actions";
import { validateEcuadorianRuc } from "@/lib/datil-utils";

interface DatilConfigTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function DatilConfigTab({ restaurant }: DatilConfigTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [isEnabled, setIsEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"TEST" | "PROD">("TEST");
  const [apiKey, setApiKey] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [hasStoredPassword, setHasStoredPassword] = useState(false);

  // Datos Tributarios
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [direccionMatriz, setDireccionMatriz] = useState("");
  const [direccionEstablecimiento, setDireccionEstablecimiento] = useState("");
  const [regimen, setRegimen] = useState<
    "GENERAL" | "RIMPE_EMPRENDEDOR" | "RIMPE_POPULAR"
  >("GENERAL");
  const [obligadoContabilidad, setObligadoContabilidad] = useState(false);
  const [contribuyenteEspecial, setContribuyenteEspecial] = useState("");
  const [establecimiento, setEstablecimiento] = useState("001");
  const [puntoEmision, setPuntoEmision] = useState("001");

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const res = await getDatilConfigAction(restaurant.id);
        if (res.success && res.config) {
          const cfg = res.config;
          setIsEnabled(cfg.isEnabled);
          setEnvironment(cfg.environment);
          setApiKey(cfg.apiKey);
          setHasStoredPassword(cfg.hasPassword);
          setRuc(cfg.ruc);
          setRazonSocial(cfg.razonSocial);
          setNombreComercial(cfg.nombreComercial);
          setDireccionMatriz(cfg.direccionMatriz);
          setDireccionEstablecimiento(cfg.direccionEstablecimiento);
          setRegimen(cfg.regimen);
          setObligadoContabilidad(cfg.obligadoContabilidad);
          setContribuyenteEspecial(cfg.contribuyenteEspecial);
          setEstablecimiento(cfg.establecimiento || "001");
          setPuntoEmision(cfg.puntoEmision || "001");
        }
      } catch (err: any) {
        console.error("Error cargando configuración de Dátil:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [restaurant.id]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setSaveErrorMsg("");
    setSaveSuccessMsg("");

    try {
      const res = await testDatilConnectionAction({
        restaurantId: restaurant.id,
        apiKey: apiKey.trim(),
        apiPassword: apiPassword.trim() || undefined,
        environment,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "¡Conexión verificada exitosamente!",
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || "Fallo en la prueba de conexión.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Error al conectar con la API de Dátil.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");

    try {
      const res = await saveDatilConfigAction(restaurant.id, {
        isEnabled,
        environment,
        apiKey: apiKey.trim(),
        apiPassword: apiPassword.trim() || undefined,
        ruc: ruc.trim(),
        razonSocial: razonSocial.trim(),
        nombreComercial: nombreComercial.trim() || undefined,
        direccionMatriz: direccionMatriz.trim(),
        direccionEstablecimiento: direccionEstablecimiento.trim() || undefined,
        regimen,
        obligadoContabilidad,
        contribuyenteEspecial: contribuyenteEspecial.trim() || undefined,
        establecimiento: establecimiento.trim() || "001",
        puntoEmision: puntoEmision.trim() || "001",
      });

      if (res.success) {
        setSaveSuccessMsg(res.message || "Configuración guardada exitosamente.");
        if (apiPassword.trim()) {
          setHasStoredPassword(true);
          setApiPassword("");
        }
        setTimeout(() => setSaveSuccessMsg(""), 5000);
      } else {
        setSaveErrorMsg(res.error || "Error al guardar la configuración.");
      }
    } catch (err: any) {
      setSaveErrorMsg(err.message || "Error inesperado al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-bold uppercase tracking-wider">
          Cargando configuración tributaria...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner Superior */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Facturación Electrónica SRI</span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dátil API · Ecuador
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Emisión automática de comprobantes electrónicos válidos ante el SRI desde Caja POS con impresión de ticket térmico y código QR.
              </p>
            </div>
          </div>

          {/* Master Switch */}
          <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300">
              {isEnabled ? "Módulo Activo" : "Módulo Apagado"}
            </span>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEnabled ? "bg-emerald-500" : "bg-slate-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BLOQUE 1: Credenciales API de Dátil */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                1. Credenciales de Acceso a Dátil
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Cifrado en servidor con AES-256-GCM
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ambiente */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Ambiente SRI / Dátil
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnvironment("TEST")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                    environment === "TEST"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🧪 Pruebas (Sandbox)
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment("PROD")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                    environment === "PROD"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🚀 Producción Oficial
                </button>
              </div>
            </div>

            {/* X-Key */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>X-Key (API Key)</span>
                <span className="text-[10px] text-slate-500 font-normal">Header obligatorio</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ej. dtl_live_key_9f81a7b..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white font-mono focus:outline-none"
              />
            </div>

            {/* X-Password */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>X-Password (Contraseña de API)</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {hasStoredPassword ? "✓ Contraseña guardada y cifrada" : "Requerida"}
                </span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={apiPassword}
                    onChange={(e) => setApiPassword(e.target.value)}
                    placeholder={
                      hasStoredPassword
                        ? "•••••••••••••••• (Deja vacío para mantener la actual)"
                        : "Ingresa tu X-Password de Dátil"
                    }
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white font-mono focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || (!apiKey && !hasStoredPassword)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Probar Conexión</span>
                </button>
              </div>
            </div>
          </div>

          {/* Resultado de la prueba de conexión */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 transition animate-in fade-in duration-200 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="font-semibold">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* BLOQUE 2: Datos Tributarios del Emisor */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                2. Datos Tributarios del Emisor (SRI)
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">
              Datos registrados en tu RUC oficial
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* RUC */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                RUC del Negocio (13 dígitos) *
              </label>
              <input
                type="text"
                value={ruc}
                onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 13))}
                placeholder="1790012345001"
                maxLength={13}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white font-mono focus:outline-none"
              />
              {ruc && !validateEcuadorianRuc(ruc) && (
                <p className="text-[10px] text-rose-400 mt-1">
                  Debe tener 13 dígitos y terminar en 001.
                </p>
              )}
            </div>

            {/* Razón Social */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Razón Social (según RUC) *
              </label>
              <input
                type="text"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej. CORPORACIÓN COMERCIAL ANDINA CIA. LTDA."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {/* Nombre Comercial */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nombre Comercial (Fantasía)
              </label>
              <input
                type="text"
                value={nombreComercial}
                onChange={(e) => setNombreComercial(e.target.value)}
                placeholder="Ej. Sumeria Liquors"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {/* Régimen */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Régimen Tributario SRI
              </label>
              <select
                value={regimen}
                onChange={(e) => setRegimen(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="GENERAL">Régimen General</option>
                <option value="RIMPE_EMPRENDEDOR">Régimen RIMPE - Emprendedor</option>
                <option value="RIMPE_POPULAR">Régimen RIMPE - Negocio Popular</option>
              </select>
            </div>

            {/* Dirección Matriz */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Dirección Matriz (según RUC) *
              </label>
              <input
                type="text"
                value={direccionMatriz}
                onChange={(e) => setDireccionMatriz(e.target.value)}
                placeholder="Ej. Av. Amazonas N34-120 y Naciones Unidas"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {/* Dirección Sucursal */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Dirección Sucursal (Opcional)
              </label>
              <input
                type="text"
                value={direccionEstablecimiento}
                onChange={(e) => setDireccionEstablecimiento(e.target.value)}
                placeholder="Ej. Local #4, Plaza Central"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            {/* Obligado a llevar contabilidad */}
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={obligadoContabilidad}
                  onChange={(e) => setObligadoContabilidad(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-300">
                  Obligado a Llevar Contabilidad
                </span>
              </label>
            </div>

            {/* Contribuyente Especial */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Resolución Contribuyente Especial
              </label>
              <input
                type="text"
                value={contribuyenteEspecial}
                onChange={(e) => setContribuyenteEspecial(e.target.value)}
                placeholder="Ej. Resolución NAC-00123 (opcional)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 3: Punto de Emisión y Secuenciales */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>3. Punto de Emisión SRI</span>
              <span className="text-[10px] text-amber-400 font-mono">
                {establecimiento}-{puntoEmision}-XXXXXXXXX
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Establecimiento
              </label>
              <input
                type="text"
                value={establecimiento}
                maxLength={3}
                onChange={(e) => setEstablecimiento(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="001"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-xs text-white text-center font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Punto de Emisión
              </label>
              <input
                type="text"
                value={puntoEmision}
                maxLength={3}
                onChange={(e) => setPuntoEmision(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="001"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 px-3 py-2 rounded-xl text-xs text-white text-center font-mono font-bold focus:outline-none"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2 text-xs text-slate-400 pt-3">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Los secuenciales se sincronizan automáticamente con Dátil y el SRI para evitar saltos numéricos.
              </span>
            </div>
          </div>
        </div>

        {/* Notificaciones de Guardado */}
        {saveSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveErrorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{saveErrorMsg}</span>
          </div>
        )}

        {/* Botón de Guardado */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-amber-600/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando Configuración...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Configuración Tributaria</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
