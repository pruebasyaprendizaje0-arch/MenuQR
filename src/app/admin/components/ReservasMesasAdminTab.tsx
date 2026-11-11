"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  Users,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  MessageCircle,
  Banknote,
  Sparkles,
  AlertCircle,
  X,
  Filter,
} from "lucide-react";
import {
  getTableReservationsAction,
  createTableReservationAction,
  updateTableReservationStatusAction,
  deleteTableReservationAction,
  SerializedTableReservation,
} from "@/lib/reservation-actions";

interface ReservasMesasAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
  };
}

export function ReservasMesasAdminTab({ restaurant }: ReservasMesasAdminTabProps) {
  const [reservations, setReservations] = useState<SerializedTableReservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeFilter, setTimeFilter] = useState<"TODAY" | "TOMORROW" | "WEEK" | "ALL">("TODAY");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal de Nueva Reserva
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formPeople, setFormPeople] = useState<number>(2);
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [formTime, setFormTime] = useState<string>("20:00");
  const [formTable, setFormTable] = useState<string>("1");
  const [formDeposit, setFormDeposit] = useState<string>("0.00");
  const [formDepositMethod, setFormDepositMethod] = useState<"EFECTIVO" | "TRANSFERENCIA" | "DEUNA" | "TARJETA">("EFECTIVO");
  const [formNotes, setFormNotes] = useState<string>("");

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      let dateFilter: string | undefined = undefined;

      if (timeFilter === "TODAY") {
        dateFilter = today.toISOString().split("T")[0];
      } else if (timeFilter === "TOMORROW") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateFilter = tomorrow.toISOString().split("T")[0];
      }

      const res = await getTableReservationsAction(restaurant.id, {
        date: dateFilter,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      if (res.success && res.reservations) {
        setReservations(res.reservations);
      }
    } catch (err) {
      console.error("Error al cargar reservas:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurant.id, timeFilter, statusFilter]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Por favor ingresa el nombre del cliente.");
      return;
    }
    setSaving(true);
    try {
      const depVal = parseFloat(formDeposit) || 0;
      const res = await createTableReservationAction({
        restaurantId: restaurant.id,
        customerName: formName.trim(),
        customerPhone: formPhone.trim() || undefined,
        peopleCount: Number(formPeople) || 2,
        reservationDate: formDate,
        reservationTime: formTime,
        tableName: formTable.trim() || "1",
        depositAmount: depVal,
        depositPaid: depVal > 0,
        depositMethod: formDepositMethod,
        notes: formNotes.trim() || undefined,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setIsModalOpen(false);
        // Reset form
        setFormName("");
        setFormPhone("");
        setFormPeople(2);
        setFormDeposit("0.00");
        setFormNotes("");
        loadReservations();
      }
    } catch (err: any) {
      alert("Error al registrar la reserva: " + (err?.message || "Desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  ) => {
    try {
      await updateTableReservationStatusAction(id, newStatus);
      loadReservations();
    } catch (err) {
      alert("Error al actualizar estado");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente la reserva de ${name}?`)) return;
    try {
      await deleteTableReservationAction(id);
      loadReservations();
    } catch (err) {
      alert("Error al eliminar reserva");
    }
  };

  // Filtrado de reservas
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.customerName.toLowerCase().includes(q);
        const matchPhone = (r.customerPhone || "").includes(q);
        const matchTable = (r.tableName || "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchTable) return false;
      }
      return true;
    });
  }, [reservations, searchQuery]);

  // Métricas
  const metrics = useMemo(() => {
    const totalCount = filteredReservations.length;
    const totalGuests = filteredReservations.reduce((acc, r) => acc + (r.peopleCount || 0), 0);
    const totalDeposits = filteredReservations.reduce((acc, r) => acc + (r.depositAmount || 0), 0);
    const confirmedCount = filteredReservations.filter((r) => r.status === "CONFIRMED" || r.status === "SEATED").length;
    return { totalCount, totalGuests, totalDeposits, confirmedCount };
  }, [filteredReservations]);

  const getWhatsAppConfirmUrl = (r: SerializedTableReservation) => {
    if (!r.customerPhone) return null;
    let cleanPhone = r.customerPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
    const depositText = r.depositAmount > 0 ? ` Tu abono de $${r.depositAmount.toFixed(2)} (${r.depositMethod || "registrado"}) será descontado automáticamente de tu cuenta.` : "";
    const msg = `¡Hola ${r.customerName}! Te confirmamos tu reserva en *${restaurant.name}* para *${r.peopleCount} personas* el día *${r.reservationDate}* a las *${r.reservationTime}* (Mesa #${r.tableName}).${depositText} ¡Te esperamos con gusto! 🎉`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" /> Agenda & Reservas de Mesas
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Gestión de Reservas y Abonos
          </h2>
          <p className="text-xs text-slate-400">
            Agenda comensales, registra abonos anticipados y descuéntalos directamente al cobrar en Caja POS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nueva Reserva</span>
        </button>
      </div>

      {/* MÉTRICAS RÁPIDAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-purple-400" /> Total Reservas
          </span>
          <p className="text-2xl font-mono font-black text-white">{metrics.totalCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" /> Comensales Esperados
          </span>
          <p className="text-2xl font-mono font-black text-blue-400">{metrics.totalGuests} pers.</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Abonos Recaudados
          </span>
          <p className="text-2xl font-mono font-black text-emerald-400">${metrics.totalDeposits.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Confirmadas / En Sala
          </span>
          <p className="text-2xl font-mono font-black text-purple-300">{metrics.confirmedCount}</p>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
        {/* Filtros temporales */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTimeFilter("TODAY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              timeFilter === "TODAY"
                ? "bg-purple-600 text-white font-black shadow-md shadow-purple-600/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter("TOMORROW")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              timeFilter === "TOMORROW"
                ? "bg-purple-600 text-white font-black shadow-md shadow-purple-600/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Mañana
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              timeFilter === "ALL"
                ? "bg-purple-600 text-white font-black shadow-md shadow-purple-600/30"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            Todas las Fechas
          </button>
        </div>

        {/* Buscador y estado */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono, mesa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="PENDING">Pendiente</option>
            <option value="SEATED">En Sala (Sentada)</option>
            <option value="COMPLETED">Completada (Cobrada)</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
      </div>

      {/* LISTADO DE RESERVAS */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold">Cargando agenda de reservas...</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="p-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
            <CalendarDays className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-white">No hay reservas registradas en este período</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Haz clic en &quot;Nueva Reserva&quot; para agendar comensales o registrar depósitos anticipados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReservations.map((r) => {
            const waUrl = getWhatsAppConfirmUrl(r);
            return (
              <div
                key={r.id}
                className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 space-y-3 shadow-lg transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Hora / Fecha y Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-black text-white px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        {r.reservationTime}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {r.reservationDate}
                      </span>
                    </div>

                    <select
                      value={r.status}
                      onChange={(e) => handleUpdateStatus(r.id, e.target.value as any)}
                      className={`text-[11px] font-black px-2.5 py-1 rounded-full border cursor-pointer ${
                        r.status === "CONFIRMED"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : r.status === "SEATED"
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : r.status === "COMPLETED"
                          ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                          : r.status === "CANCELLED"
                          ? "bg-red-500/15 text-red-300 border-red-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      <option value="CONFIRMED" className="bg-slate-900 text-white">Confirmada</option>
                      <option value="PENDING" className="bg-slate-900 text-white">Pendiente</option>
                      <option value="SEATED" className="bg-slate-900 text-white">En Sala (Sentada)</option>
                      <option value="COMPLETED" className="bg-slate-900 text-white">Completada / Pagada</option>
                      <option value="CANCELLED" className="bg-slate-900 text-white">Cancelada</option>
                    </select>
                  </div>

                  {/* Cliente y Detalles */}
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-white tracking-tight">
                      {r.customerName}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-bold text-purple-300">
                        Mesa #{r.tableName}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {r.peopleCount} comensales
                      </span>
                    </div>
                  </div>

                  {/* Abono / Depósito */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Abono Anticipado:</span>
                    {r.depositAmount > 0 ? (
                      <span className="font-mono font-black text-emerald-400 flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        ${r.depositAmount.toFixed(2)} ({r.depositMethod || "Efectivo"})
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Sin abono previo</span>
                    )}
                  </div>

                  {/* Notas internas */}
                  {r.notes && (
                    <p className="text-xs text-amber-300/90 bg-amber-950/20 p-2 rounded-xl border border-amber-800/30 italic">
                      &quot;{r.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Acciones de la Reserva */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Confirmar WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">Sin teléfono registrado</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.customerName)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    title="Eliminar reserva"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR RESERVA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="max-w-lg w-full max-h-[92vh] overflow-y-auto my-auto bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-base">Registrar Nueva Reserva</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Nombre del Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos Andrade"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Teléfono WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="Ej: 0991234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Comensales</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formPeople}
                    onChange={(e) => setFormPeople(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Hora</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Mesa Asignada</label>
                  <input
                    type="text"
                    placeholder="Ej: 1, 4, VIP"
                    value={formTable}
                    onChange={(e) => setFormTable(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Abono Anticipado ($)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    placeholder="0.00"
                    value={formDeposit}
                    onChange={(e) => setFormDeposit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Método de Abono</label>
                  <select
                    value={formDepositMethod}
                    onChange={(e) => setFormDepositMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="DEUNA">QR DeUna</option>
                    <option value="TARJETA">Tarjeta / POS</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Notas / Petición Especial</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Decoración de cumpleaños, mesa junto a la ventana..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
                >
                  {saving ? "Guardando..." : "Guardar Reserva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
