"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  ChefHat,
  Lock,
  Unlock,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Search,
  Check,
  X,
  CreditCard,
  Bike,
  Phone,
  Store,
} from "lucide-react";
import {
  getStaffDataAction,
  createWaiterAction,
  updateWaiterAction,
  deleteWaiterAction,
  saveKitchenSecurityAction,
  StaffRole,
} from "@/lib/staff-actions";

interface Camarero {
  id: string;
  negocio_id: string;
  nombre: string;
  pin: string;
  rol: StaffRole;
  telefono?: string | null;
  activo: boolean;
  created_at?: string;
}

interface StaffAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    customLabels?: string | null;
    themeColor?: string;
  };
}

export function StaffAdminTab({ restaurant }: StaffAdminTabProps) {
  const [camareros, setCamareros] = useState<Camarero[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MESERO" | "CAJERO" | "REPARTIDOR">("ALL");

  // Estados de seguridad de Cocina
  const [kitchenPin, setKitchenPin] = useState("");
  const [kitchenPinRequired, setKitchenPinRequired] = useState(false);
  const [showKitchenPin, setShowKitchenPin] = useState(false);
  const [waiterPinRequired, setWaiterPinRequired] = useState(true);
  const [savingKitchen, setSavingKitchen] = useState(false);
  const [kitchenMessage, setKitchenMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal para Crear / Editar Integrante de Equipo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Camarero | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRol, setFormRol] = useState<StaffRole>("MESERO");
  const [formTelefono, setFormTelefono] = useState("");
  const [formActivo, setFormActivo] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingWaiter, setSubmittingWaiter] = useState(false);

  // Cargar datos del personal y seguridad
  const loadStaffData = useCallback(async () => {
    try {
      const res = await getStaffDataAction(restaurant.id);
      if (res.success && res.camareros) {
        setCamareros(res.camareros);
        if (res.kitchenSecurity) {
          setKitchenPin(res.kitchenSecurity.kitchenPin || "");
          setKitchenPinRequired(Boolean(res.kitchenSecurity.kitchenPinRequired));
          setWaiterPinRequired(res.kitchenSecurity.waiterPinRequired !== false);
        }
      } else if (res.error) {
        console.error("Error loading staff data:", res.error);
      }
    } catch (err) {
      console.error("Error in loadStaffData:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStaffData();
  }, [loadStaffData]);

  // Guardar configuración de seguridad de cocina
  const handleSaveKitchenSecurity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingKitchen(true);
    setKitchenMessage(null);

    try {
      const res = await saveKitchenSecurityAction(restaurant.id, {
        kitchenPin,
        kitchenPinRequired,
        waiterPinRequired,
      });

      if (res.success) {
        setKitchenMessage({ type: "success", text: "Clave y configuración de seguridad guardadas correctamente." });
        setTimeout(() => setKitchenMessage(null), 4000);
      } else {
        setKitchenMessage({ type: "error", text: res.error || "Error al guardar." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar seguridad de cocina.";
      setKitchenMessage({ type: "error", text: msg });
    } finally {
      setSavingKitchen(false);
    }
  };

  // Quitar clave de cocina (acceso libre)
  const handleRemoveKitchenPin = async () => {
    if (!confirm("¿Deseas quitar la clave de cocina y permitir acceso libre?")) return;
    setSavingKitchen(true);
    setKitchenMessage(null);

    try {
      const res = await saveKitchenSecurityAction(restaurant.id, {
        kitchenPin: "",
        kitchenPinRequired: false,
        waiterPinRequired,
      });

      if (res.success) {
        setKitchenPin("");
        setKitchenPinRequired(false);
        setKitchenMessage({ type: "success", text: "Acceso libre a cocina activado (sin clave)." });
        setTimeout(() => setKitchenMessage(null), 4000);
      } else {
        setKitchenMessage({ type: "error", text: res.error || "Error al quitar clave." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar.";
      setKitchenMessage({ type: "error", text: msg });
    } finally {
      setSavingKitchen(false);
    }
  };

  // Abrir modal para nuevo integrante
  const handleOpenCreateModal = (presetRole?: StaffRole) => {
    setEditingWaiter(null);
    setFormNombre("");
    const targetRole = presetRole || (roleFilter !== "ALL" ? roleFilter : "MESERO");
    setFormRol(targetRole);
    setFormTelefono("");
    // Sugerir PIN automático fácil de 4 dígitos basado en el número de miembros
    const nextPinNum = (camareros.length + 1) * 1111;
    setFormPin(nextPinNum <= 9999 ? String(nextPinNum) : "1234");
    setFormActivo(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Abrir modal para editar integrante
  const handleOpenEditModal = (waiter: Camarero) => {
    setEditingWaiter(waiter);
    setFormNombre(waiter.nombre);
    setFormPin(waiter.pin || "1234");
    setFormRol(waiter.rol || "MESERO");
    setFormTelefono(waiter.telefono || "");
    setFormActivo(waiter.activo);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Guardar integrante (crear o editar)
  const handleSaveWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      setFormError("Ingresa el nombre del integrante del equipo.");
      return;
    }
    const cleanPin = formPin.trim();
    if (cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
      setFormError("El PIN debe tener entre 4 y 8 dígitos numéricos (ej. 1234).");
      return;
    }

    setSubmittingWaiter(true);
    setFormError(null);

    try {
      if (editingWaiter) {
        // Actualizar existente
        const res = await updateWaiterAction(restaurant.id, editingWaiter.id, {
          nombre: formNombre.trim(),
          pin: cleanPin,
          rol: formRol,
          telefono: formTelefono.trim() || null,
          activo: formActivo,
        });

        if (res.success && res.camarero) {
          setCamareros((prev) =>
            prev.map((c) => (c.id === editingWaiter.id ? res.camarero : c))
          );
          setIsModalOpen(false);
        } else {
          setFormError(res.error || "Error al actualizar integrante.");
        }
      } else {
        // Crear nuevo
        const res = await createWaiterAction(
          restaurant.id,
          formNombre.trim(),
          cleanPin,
          formRol,
          formTelefono.trim() || null
        );
        if (res.success && res.camarero) {
          setCamareros((prev) => [...prev, res.camarero]);
          setIsModalOpen(false);
        } else {
          setFormError(res.error || "Error al registrar integrante.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar integrante.";
      setFormError(msg);
    } finally {
      setSubmittingWaiter(false);
    }
  };

  // Toggle rápido de activo/inactivo para un mesero
  const handleToggleActive = async (waiter: Camarero) => {
    try {
      const nextState = !waiter.activo;
      // Actualización optimista en UI
      setCamareros((prev) =>
        prev.map((c) => (c.id === waiter.id ? { ...c, activo: nextState } : c))
      );

      const res = await updateWaiterAction(restaurant.id, waiter.id, {
        nombre: waiter.nombre,
        activo: nextState,
      });

      if (!res.success) {
        // Revertir si falló
        setCamareros((prev) =>
          prev.map((c) => (c.id === waiter.id ? { ...c, activo: waiter.activo } : c))
        );
        alert(res.error || "No se pudo cambiar el estado del mesero.");
      }
    } catch (err) {
      console.error("Error toggling waiter active status:", err);
    }
  };

  // Eliminar mesero
  const handleDeleteWaiter = async (waiter: Camarero) => {
    if (!confirm(`¿Estás seguro de eliminar al mesero "${waiter.nombre}"?`)) return;

    try {
      // Optimista
      setCamareros((prev) => prev.filter((c) => c.id !== waiter.id));

      const res = await deleteWaiterAction(restaurant.id, waiter.id);
      if (!res.success) {
        // Revertir
        setCamareros((prev) => [...prev, waiter]);
        alert(res.error || "Error al eliminar mesero.");
      }
    } catch (err) {
      console.error("Error deleting waiter:", err);
      alert("Error de conexión al eliminar mesero.");
      loadStaffData();
    }
  };

  const activeCount = camareros.filter((c) => c.activo).length;
  const meserosCount = camareros.filter((c) => (c.rol || "MESERO") === "MESERO").length;
  const cajerosCount = camareros.filter((c) => c.rol === "CAJERO").length;
  const repartidoresCount = camareros.filter((c) => c.rol === "REPARTIDOR").length;

  const filteredCamareros = camareros.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.telefono && c.telefono.includes(searchQuery));
    const roleOfCam = c.rol || "MESERO";
    const matchesRole = roleFilter === "ALL" || roleOfCam === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Equipo y Accesos (Meseros, Cajeros & Repartidores)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Administra los meseros del salón, cajeros de mostrador, repartidores y la seguridad de Pantalla de Cocina KDS.
              </p>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCESO RÁPIDO OPERATIVO */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/${restaurant.slug}/cocina`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 transition shadow-sm"
          >
            <ChefHat className="h-4 w-4" />
            <span>Módulo Cocina</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href={`/${restaurant.slug}/mesas`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition shadow-sm"
          >
            <Users className="h-4 w-4" />
            <span>Módulo Mesero</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href="/caja"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition shadow-sm"
          >
            <CreditCard className="h-4 w-4" />
            <span>Terminal Caja POS</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href={`/${restaurant.slug}/repartidor`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition shadow-sm"
          >
            <Bike className="h-4 w-4" />
            <span>Panel Repartidor</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* SECCIÓN 1: SEGURIDAD Y CLAVE DE COCINA KDS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-800/80">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Seguridad de Pantalla Cocina KDS</h3>
                {kitchenPinRequired ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Lock className="w-3 h-3" /> Con Clave PIN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-slate-800 text-slate-400 border border-slate-700">
                    <Unlock className="w-3 h-3" /> Acceso Libre
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Protege la pantalla de cocina con una clave de acceso numérica (PIN). Al activar esta opción, cualquier dispositivo o tablet en cocina solicitará el PIN antes de ver las comandas y pedidos en vivo.
              </p>
            </div>
          </div>
        </div>

        {/* FORMULARIO DE CLAVE DE COCINA */}
        <form onSubmit={handleSaveKitchenSecurity} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* TOGGLE: REQUERIR PIN */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-white block">
                  ¿Requerir PIN para abrir Pantalla de Cocina?
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Si se apaga, la pantalla cargará directo sin solicitar clave (ideal para pantallas fijas).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKitchenPinRequired(!kitchenPinRequired)}
                className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                  kitchenPinRequired ? "bg-orange-500" : "bg-slate-800"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    kitchenPinRequired ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* INPUT: PIN DE COCINA */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  <span>Clave / PIN de Cocina (4 a 8 dígitos)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowKitchenPin(!showKitchenPin)}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition"
                >
                  {showKitchenPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showKitchenPin ? "Ocultar" : "Mostrar"}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showKitchenPin ? "text" : "password"}
                  maxLength={8}
                  placeholder="Ej: 1234"
                  value={kitchenPin}
                  onChange={(e) => setKitchenPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 px-3.5 py-2.5 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* MENSAJES DE FEEDBACK */}
          {kitchenMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                kitchenMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              }`}
            >
              {kitchenMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{kitchenMessage.text}</span>
            </div>
          )}

          {/* BOTONES DE ACCIÓN PARA COCINA */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <div className="text-[11px] text-slate-500">
              💡 Recomendación: Asigna un PIN numérico de 4 dígitos fácil de recordar para el personal de cocina (ej. <strong>2026</strong> o <strong>1234</strong>).
            </div>

            <div className="flex items-center gap-2.5">
              {kitchenPin && (
                <button
                  type="button"
                  disabled={savingKitchen}
                  onClick={handleRemoveKitchenPin}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20"
                >
                  Quitar Clave (Libre)
                </button>
              )}
              <button
                type="submit"
                disabled={savingKitchen}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {savingKitchen ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Clave de Cocina</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SECCIÓN 2: GESTIÓN DE PERSONAL (MESEROS, CAJEROS, REPARTIDORES) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden backdrop-blur-md space-y-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500" />

        {/* CABECERA DE PERSONAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Personal del Negocio</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeCount} activo{activeCount !== 1 ? "s" : ""} de {camareros.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Registra a meseros, cajeros y repartidores con su propio PIN para identificar turnos, cobros y entregas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPins(!showPins)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              title="Mostrar u ocultar los PINs en la lista"
            >
              {showPins ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
              <span>{showPins ? "Ocultar PINs" : "Mostrar PINs"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Integrante</span>
            </button>
          </div>
        </div>

        {/* FILTROS POR ROL (TODOS / MESEROS / CAJEROS / REPARTIDORES) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setRoleFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              roleFilter === "ALL"
                ? "bg-white text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {camareros.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("MESERO")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              roleFilter === "MESERO"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-emerald-400/80 hover:text-emerald-300 border border-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Meseros de Salón</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40">
              {meserosCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("CAJERO")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              roleFilter === "CAJERO"
                ? "bg-cyan-500 text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-cyan-400/80 hover:text-cyan-300 border border-slate-800"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cajeros (POS)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40">
              {cajerosCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter("REPARTIDOR")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              roleFilter === "REPARTIDOR"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-950 text-amber-400/80 hover:text-amber-300 border border-slate-800"
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Repartidores (Delivery)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800/40">
              {repartidoresCount}
            </span>
          </button>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTRO */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadStaffData();
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-700 transition"
            title="Recargar equipo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* LISTADO DE INTEGRANTES */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Cargando equipo del negocio...</span>
          </div>
        ) : filteredCamareros.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/50 p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {searchQuery
                ? "No se encontraron integrantes con esa búsqueda"
                : roleFilter !== "ALL"
                ? `No hay ${roleFilter === "CAJERO" ? "cajeros" : roleFilter === "REPARTIDOR" ? "repartidores" : "meseros"} registrados aún`
                : "No hay personal registrado aún"}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? "Prueba buscando con otro término o limpia el buscador."
                : "Registra cajeros, meseros o repartidores con su PIN numérico para delegar funciones con total seguridad."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Primer Integrante</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCamareros.map((cam) => {
              const camRole: StaffRole = cam.rol || "MESERO";
              const isCajero = camRole === "CAJERO";
              const isRepartidor = camRole === "REPARTIDOR";

              const badgeColor = isCajero
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                : isRepartidor
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

              const iconContainerColor = isCajero
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                : isRepartidor
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

              return (
                <div
                  key={cam.id}
                  className={`p-4 rounded-2xl bg-slate-950 border transition-all ${
                    cam.activo
                      ? isCajero
                        ? "border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/60"
                        : isRepartidor
                        ? "border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/60"
                        : "border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/60"
                      : "border-slate-850 opacity-60 bg-slate-950/40"
                  } flex flex-col justify-between gap-3 shadow-md group`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition border ${
                          cam.activo ? iconContainerColor : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}
                      >
                        {isCajero ? (
                          <CreditCard className="w-5 h-5" />
                        ) : isRepartidor ? (
                          <Bike className="w-5 h-5" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-white truncate leading-tight">
                            {cam.nombre}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeColor}`}>
                            {isCajero ? "Cajero POS" : isRepartidor ? "Repartidor" : "Mesero"}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <strong className="text-amber-300 font-bold">
                              {showPins ? cam.pin : "••••"}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BADGE ACTIVO / INACTIVO */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cam)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                        cam.activo
                          ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-500 hover:bg-slate-700 border border-slate-700"
                      }`}
                      title={cam.activo ? "Clic para desactivar integrante de turno" : "Clic para activar integrante de turno"}
                    >
                      {cam.activo ? "Activo" : "Inactivo"}
                    </button>
                  </div>

                  {/* TELÉFONO / WHATSAPP DEL REPARTIDOR O MESERO */}
                  {cam.telefono && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{cam.telefono}</span>
                      </span>
                      <a
                        href={`https://wa.me/${cam.telefono.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}

                  {/* ACCIONES DEL INTEGRANTE */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500">
                      {isCajero
                        ? "Terminal /caja"
                        : isRepartidor
                        ? "Panel /repartidor"
                        : "Atención /mesas"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cam)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Editar datos y PIN"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWaiter(cam)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Eliminar del equipo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR INTEGRANTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-5">
            {/* CABECERA DEL MODAL */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  formRol === "CAJERO"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : formRol === "REPARTIDOR"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {formRol === "CAJERO" ? (
                    <CreditCard className="w-5 h-5" />
                  ) : formRol === "REPARTIDOR" ? (
                    <Bike className="w-5 h-5" />
                  ) : (
                    <Users className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {editingWaiter ? "Editar Integrante" : "Nuevo Integrante"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingWaiter ? "Modifica el rol, nombre, teléfono y clave PIN" : "Asigna rol, nombre y clave PIN de 4 dígitos"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORMULARIO */}
            <form onSubmit={handleSaveWaiter} className="space-y-4">
              {/* SELECTOR DE ROL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Rol en el Negocio *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRol("MESERO")}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      formRol === "MESERO"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-black shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-[11px]">Mesero</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRol("CAJERO")}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      formRol === "CAJERO"
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-black shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[11px]">Cajero</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRol("REPARTIDOR")}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      formRol === "REPARTIDOR"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span className="text-[11px]">Repartidor</span>
                  </button>
                </div>
              </div>

              {/* NOMBRE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formRol === "CAJERO"
                      ? "Ej: Sofía Cajera"
                      : formRol === "REPARTIDOR"
                      ? "Ej: Juan Repartidor"
                      : "Ej: Carlos Mesero"
                  }
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 px-3.5 py-2.5 rounded-xl text-white text-xs focus:outline-none placeholder:text-slate-600"
                />
              </div>

              {/* TELÉFONO / WHATSAPP */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Teléfono / WhatsApp</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formRol === "REPARTIDOR" ? "Recomendado para avisar entregas" : "Opcional"}
                  </span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="Ej: 0991234567"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-white text-xs focus:outline-none placeholder:text-slate-600 font-mono"
                  />
                </div>
              </div>

              {/* PIN NUMÉRICO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Clave / PIN de Acceso (4 a 8 dígitos) *</span>
                  <span className="text-[10px] text-amber-400 font-mono">Solo números</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="Ej: 1234"
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 px-3.5 py-2.5 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-500">
                  {formRol === "CAJERO" ? (
                    <>
                      Este es el PIN que tecleará en <span className="font-mono text-cyan-400">/caja</span> para abrir turno de cobro y firmar el arqueo Z.
                    </>
                  ) : formRol === "REPARTIDOR" ? (
                    <>
                      Este es el PIN que tecleará en <span className="font-mono text-amber-400">/{restaurant.slug}/repartidor</span> para identificarse en sus despachos.
                    </>
                  ) : (
                    <>
                      Este es el PIN que tecleará en <span className="font-mono text-emerald-400">/{restaurant.slug}/mesas</span> para abrir su turno en el salón.
                    </>
                  )}
                </p>
              </div>

              {/* SWITCH ACTIVO */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Integrante en servicio activo</span>
                  <span className="text-[10px] text-slate-400">Disponible para turnos y operaciones en el sistema</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormActivo(!formActivo)}
                  className={`w-10 h-5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                    formActivo ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      formActivo ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* ERROR */}
              {formError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* BOTONES */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWaiter}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingWaiter ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingWaiter ? "Guardar Cambios" : "Crear Integrante"}</span>
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

export default StaffAdminTab;
