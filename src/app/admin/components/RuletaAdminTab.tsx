"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Save,
  Check,
  AlertCircle,
  RotateCw,
  Gift,
  Copy,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Smartphone,
  ExternalLink,
  Eye,
  Sliders,
  Tag,
  Palette,
} from "lucide-react";
import { RuletaPremioItem, DEFAULT_RULETA_PREMIOS } from "@/lib/ruleta-types";
import {
  saveRuletaConfigAction,
  getRuletaAdminConfigAction,
  getRuletaGirosAction,
  validarCuponAction,
} from "@/lib/ruleta-actions";
import RuletaNegocio from "@/components/Ruleta/RuletaNegocio";

interface RuletaAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
    logoUrl?: string | null;
    whatsapp?: string;
  };
}

const TIPO_OPCIONES = [
  { value: "descuento", label: "Descuento (%)" },
  { value: "monto", label: "Monto Fijo ($)" },
  { value: "producto", label: "Plato / Producto" },
  { value: "postre", label: "Postre Gratis" },
  { value: "bebida", label: "Bebida Gratis" },
  { value: "2x1", label: "2x1 en Platos" },
  { value: "gratis", label: "100% Gratis" },
  { value: "sorpresa", label: "Premio Sorpresa" },
];

export default function RuletaAdminTab({ restaurant }: RuletaAdminTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Config State
  const [activa, setActiva] = useState(true);
  const [titulo, setTitulo] = useState("¡Gira la Ruleta y Gana!");
  const [descripcion, setDescripcion] = useState(
    "Prueba tu suerte y obtén un beneficio exclusivo para tu consumo hoy."
  );
  const [colorPrimario, setColorPrimario] = useState(restaurant.themeColor || "#EF4444");
  const [colorSecundario, setColorSecundario] = useState("#F59E0B");
  const [colorFondo, setColorFondo] = useState("#0F172A");
  const [limiteDiasReGiro, setLimiteDiasReGiro] = useState(1);
  const [maxGirosIpDia, setMaxGirosIpDia] = useState(5);
  const [expiracionHoras, setExpiracionHoras] = useState(24);
  const [premios, setPremios] = useState<RuletaPremioItem[]>(DEFAULT_RULETA_PREMIOS);

  // Cashier Validator State
  const [cashierCode, setCashierCode] = useState("");
  const [validatingCashier, setValidatingCashier] = useState(false);
  const [cashierResult, setCashierResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    giro?: any;
  } | null>(null);

  // Giros / Leads Table State
  const [giros, setGiros] = useState<any[]>([]);
  const [girosTotal, setGirosTotal] = useState(0);
  const [girosSearch, setGirosSearch] = useState("");
  const [girosEstado, setGirosEstado] = useState("TODOS");
  const [girosPage, setGirosPage] = useState(1);
  const [loadingGiros, setLoadingGiros] = useState(false);

  // Load configuration from Server Action
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const res = await getRuletaAdminConfigAction(restaurant.id);
        if (res.success && res.config) {
          setActiva(Boolean(res.config.activa));
          setTitulo(res.config.titulo || "¡Gira la Ruleta y Gana!");
          setDescripcion(res.config.descripcion || "");
          setColorPrimario(res.config.colorPrimario || restaurant.themeColor || "#EF4444");
          setColorSecundario(res.config.colorSecundario || "#F59E0B");
          setColorFondo(res.config.colorFondo || "#0F172A");
          setLimiteDiasReGiro(res.config.limiteDiasReGiro !== undefined ? res.config.limiteDiasReGiro : 1);
          setMaxGirosIpDia(res.config.maxGirosIpDia || 5);
          setExpiracionHoras(res.config.expiracionHoras || 24);
          if (Array.isArray(res.config.premiosList) && res.config.premiosList.length === 6) {
            setPremios(res.config.premiosList);
          }
        }
      } catch (err) {
        console.error("Error al cargar config de ruleta:", err);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
    fetchGiros();
  }, [restaurant.id, restaurant.slug, restaurant.themeColor]);

  // Load Giros / Leads
  async function fetchGiros(search = girosSearch, estado = girosEstado, page = girosPage) {
    try {
      setLoadingGiros(true);
      const res = await getRuletaGirosAction(restaurant.id, {
        search,
        estado,
        page,
        pageSize: 15,
      });
      if (res.success) {
        setGiros(res.giros || []);
        setGirosTotal(res.total || 0);
      }
    } catch (err) {
      console.error("Error al cargar giros:", err);
    } finally {
      setLoadingGiros(false);
    }
  }

  // Suma total de probabilidades
  const totalProb = useMemo(() => {
    return premios.reduce((acc, p) => acc + (Number(p.probabilidad) || 0), 0);
  }, [premios]);

  const isProbValid = Math.abs(totalProb - 100) < 0.01;

  // Actualizar un premio de la lista
  const updatePremio = (index: number, field: keyof RuletaPremioItem, value: any) => {
    const updated = [...premios];
    updated[index] = {
      ...updated[index],
      [field]: field === "probabilidad" || field === "valor" || field === "stock_diario"
        ? Number(value) || 0
        : value,
    };
    setPremios(updated);
  };

  // Guardar configuración
  const handleSaveConfig = async () => {
    if (!isProbValid) {
      setErrorMsg(`La suma de probabilidades debe ser exactamente 100%. Actual: ${totalProb}%`);
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await saveRuletaConfigAction(restaurant.id, {
        activa,
        titulo,
        descripcion,
        colorPrimario,
        colorSecundario,
        colorFondo,
        premios,
        limiteDiasReGiro: Number(limiteDiasReGiro) || 1,
        maxGirosIpDia: Number(maxGirosIpDia) || 5,
        expiracionHoras: Number(expiracionHoras) || 24,
      });

      if (res.success) {
        if (res.config && typeof res.config.activa === "boolean") {
          setActiva(res.config.activa);
        }
        setSuccessMsg("¡Configuración de Ruleta guardada con éxito! 🎉");
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setErrorMsg(res.error || "Error al guardar configuración");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  // Validar cupón en caja
  const handleValidateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashierCode.trim()) return;

    setValidatingCashier(true);
    setCashierResult(null);

    try {
      const res = await validarCuponAction(restaurant.id, cashierCode.trim());
      if (res.success) {
        setCashierResult({
          success: true,
          message: res.message,
          giro: res.giro,
        });
        setCashierCode("");
        fetchGiros(); // Refrescar lista de giros
      } else {
        setCashierResult({
          success: false,
          error: res.error,
          giro: res.giro,
        });
      }
    } catch (err: any) {
      setCashierResult({
        success: false,
        error: err?.message || "Error de red al validar cupón.",
      });
    } finally {
      setValidatingCashier(false);
    }
  };

  // Exportar giros a Excel / CSV
  const handleExportCSV = () => {
    if (giros.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Fecha Giro",
      "WhatsApp",
      "Nombre Cliente",
      "Cumpleaños",
      "Premio",
      "Tipo",
      "Código Cupón",
      "Estado",
      "Fecha Canjeo",
      "Fecha Expiración",
    ];

    const rows = giros.map((g) => [
      g.id,
      new Date(g.fechaGiro).toLocaleString("es-EC"),
      `"${g.telefono}"`,
      `"${g.nombreCliente || "Anónimo"}"`,
      `"${g.fechaNacimiento || ""}"`,
      `"${g.premioLabel}"`,
      `"${g.premioTipo || ""}"`,
      g.codigoCupon,
      g.estado,
      g.fechaCanjeo ? new Date(g.fechaCanjeo).toLocaleString("es-EC") : "",
      new Date(g.fechaExpiracion).toLocaleString("es-EC"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ruleta_leads_${restaurant.slug}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-sm font-semibold">Cargando módulo de Ruleta...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-wider mb-2">
            <Gift className="w-3.5 h-3.5" />
            <span>Generador de Leads & WhatsApp Marketing</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            🎡 Ruleta de Premios para {restaurant.name}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Atrae clientes, capta números de WhatsApp verificados y recompénsalos con cupones configurados a tu medida.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/ruleta/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700 shadow-sm"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Ver Landing Ruleta</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-70 cursor-pointer"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "Guardando..." : "Guardar Cambios"}</span>
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-sm font-bold flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/70 border border-red-500/30 text-red-300 text-sm font-bold flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Configuración & Vista Previa en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Estado y Textos */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-red-400" />
                  <span>Estado y Textos de la Ruleta</span>
                </h3>
                <p className="text-xs text-slate-400">Controla cuándo se muestra la ruleta a tus comensales.</p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={(e) => setActiva(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span className="ml-2 text-xs font-black uppercase tracking-wider text-slate-300">
                  {activa ? "Activa" : "Inactiva"}
                </span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Título de la Ruleta
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-red-500 transition"
                  placeholder="Ej: ¡Gira la Ruleta de Mauro y Gana!"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Subtítulo / Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white font-medium focus:outline-none focus:border-red-500 transition resize-none"
                  placeholder="Instrucciones para el cliente..."
                />
              </div>
            </div>

            {/* Configuración de Colores y Anti-Fraude */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Color Primario
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-300">{colorPrimario}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Color Acento
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={colorSecundario}
                    onChange={(e) => setColorSecundario(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-300">{colorSecundario}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Color Fondo
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <input
                    type="color"
                    value={colorFondo}
                    onChange={(e) => setColorFondo(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-300">{colorFondo}</span>
                </div>
              </div>
            </div>

            {/* Parámetros Anti-Fraude */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Re-giro por WhatsApp
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={limiteDiasReGiro}
                    onChange={(e) => setLimiteDiasReGiro(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                    días
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Expiración Cupón
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={expiracionHoras}
                    onChange={(e) => setExpiracionHoras(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                    horas
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Límite por IP
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxGirosIpDia}
                    onChange={(e) => setMaxGirosIpDia(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                    giros/día
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Configuración de los 6 Premios */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>Sectores de Premios (Exactamente 6)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Ajusta los labels, probabilidades ponderadas y colores de cada sector.
                </p>
              </div>

              {/* Indicador de Suma de Probabilidades */}
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-sm ${
                  isProbValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                }`}
              >
                {isProbValid ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                <span>Total: {totalProb}% / 100%</span>
              </div>
            </div>

            {/* Lista Editable de Premios */}
            <div className="space-y-3">
              {premios.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-lg grid place-items-center text-xs font-black text-white shrink-0 shadow-sm"
                      style={{ background: p.color_hex }}
                    >
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updatePremio(idx, "label", e.target.value)}
                      placeholder="Texto del premio (ej: 10% OFF)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-red-500"
                    />

                    <input
                      type="color"
                      value={p.color_hex}
                      onChange={(e) => updatePremio(idx, "color_hex", e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
                      title="Color del sector"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Tipo</label>
                      <select
                        value={p.tipo}
                        onChange={(e) => updatePremio(idx, "tipo", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-semibold focus:outline-none text-[11px]"
                      >
                        {TIPO_OPCIONES.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">
                        Probabilidad (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={p.probabilidad}
                        onChange={(e) => updatePremio(idx, "probabilidad", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-amber-400 font-black focus:outline-none text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Prefijo</label>
                      <input
                        type="text"
                        value={p.codigo_prefijo || ""}
                        onChange={(e) => updatePremio(idx, "codigo_prefijo", e.target.value.toUpperCase())}
                        placeholder="DESC10"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">
                        Stock Diario
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={p.stock_diario || 0}
                        onChange={(e) => updatePremio(idx, "stock_diario", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 font-semibold focus:outline-none text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo & Validador de Cajero (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Módulo de Cajero / Validador Rápido de Cupones */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Personal de Caja / Meseros</span>
              </div>
              <h3 className="text-base font-black text-white">Validar y Canjear Cupón</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingresa el código que te muestra el cliente para verificar y marcarlo como canjeado.
              </p>
            </div>

            <form onSubmit={handleValidateCashier} className="flex gap-2">
              <input
                type="text"
                value={cashierCode}
                onChange={(e) => setCashierCode(e.target.value.toUpperCase())}
                placeholder="Ej: DESC10-7X9K"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono tracking-widest text-white uppercase focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={validatingCashier || !cashierCode.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {validatingCashier ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Validar</span>
              </button>
            </form>

            {/* Resultado de Validación */}
            {cashierResult && (
              <div
                className={`p-4 rounded-2xl border text-xs font-semibold space-y-1.5 animate-in fade-in duration-200 ${
                  cashierResult.success
                    ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/80 border-red-500/40 text-red-200"
                }`}
              >
                <div className="flex items-center gap-2 font-black text-sm">
                  {cashierResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span>{cashierResult.success ? "¡Cupón Válido y Canjeado!" : "No Válido"}</span>
                </div>

                <p>{cashierResult.message || cashierResult.error}</p>

                {cashierResult.giro && (
                  <div className="pt-2 border-t border-white/10 text-[11px] space-y-0.5 text-slate-300">
                    <div>
                      <strong>Premio:</strong> {cashierResult.giro.premioLabel}
                    </div>
                    <div>
                      <strong>Cliente:</strong> {cashierResult.giro.nombreCliente || "Anónimo"} (
                      {cashierResult.giro.telefono})
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: Vista Previa en Vivo */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Vista Previa en Vivo</span>
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                Mobile-First
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
              <RuletaNegocio
                slug={restaurant.slug}
                isAdminPreview={true}
                config={{
                  titulo,
                  descripcion,
                  colorPrimario,
                  colorSecundario,
                  colorFondo,
                  sectores: premios.map((p, i) => ({
                    id: p.id,
                    label: p.label,
                    tipo: p.tipo,
                    color_hex: p.color_hex,
                    sectorIndex: i,
                  })),
                }}
                restaurantInfo={{
                  name: restaurant.name,
                  logoUrl: restaurant.logoUrl,
                  whatsapp: restaurant.whatsapp,
                }}
                isEmbedded={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Historial de Giros / Leads Capturados */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-black uppercase tracking-wider mb-1">
              <Smartphone className="w-3 h-3" /> Leads Capturados en CRM
            </div>
            <h3 className="text-lg font-black text-white">Historial de Giros y Cupones ({girosTotal})</h3>
            <p className="text-xs text-slate-400">
              Todos los clientes que giraron la ruleta se guardan automáticamente en tu CRM para remarketing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por teléfono o código..."
                value={girosSearch}
                onChange={(e) => {
                  setGirosSearch(e.target.value);
                  fetchGiros(e.target.value, girosEstado, 1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Filtro por estado */}
            <select
              value={girosEstado}
              onChange={(e) => {
                setGirosEstado(e.target.value);
                fetchGiros(girosSearch, e.target.value, 1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-semibold focus:outline-none"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="CANJEADO">Canjeados</option>
              <option value="EXPIRADO">Expirados</option>
            </select>

            {/* Exportar CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Fecha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Cumpleaños</th>
                <th className="px-4 py-3">Premio Ganado</th>
                <th className="px-4 py-3">Código Cupón</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 rounded-r-xl">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingGiros ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-500" />
                    Cargando leads...
                  </td>
                </tr>
              ) : giros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No hay giros registrados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                giros.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(g.fechaGiro).toLocaleDateString("es-EC", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                      {g.nombreCliente || "Cliente"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{g.telefono}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap text-[11px]">
                      {g.fechaNacimiento ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          🎂 {g.fechaNacimiento}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-amber-400 whitespace-nowrap">
                      {g.premioLabel}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-slate-200 whitespace-nowrap">
                      {g.codigoCupon}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          g.estado === "CANJEADO"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : g.estado === "EXPIRADO"
                            ? "bg-slate-800 text-slate-400 border border-slate-700"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {g.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {g.estado === "PENDIENTE" && (
                        <button
                          onClick={async () => {
                            if (confirm(`¿Marcar el cupón ${g.codigoCupon} como CANJEADO?`)) {
                              await validarCuponAction(restaurant.id, g.codigoCupon);
                              fetchGiros();
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold transition border border-emerald-500/30"
                        >
                          Canjear
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
