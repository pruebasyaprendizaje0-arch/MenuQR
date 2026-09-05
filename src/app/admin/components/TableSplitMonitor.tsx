"use client";

import { useState, useEffect } from "react";
import {
  getTableSessionAction,
  registerManualSplitPaymentAction,
  closeTableSessionAction,
  confirmSplitPaymentAction,
  rejectSplitPaymentAction,
} from "@/lib/split-bill-actions";
import {
  Utensils,
  DollarSign,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  QrCode,
  Lock,
  RefreshCw,
  UserCheck,
} from "lucide-react";

interface TableSplitMonitorProps {
  restaurantId: string;
  tablesConfig?: string;
}

export function TableSplitMonitor({ restaurantId, tablesConfig }: TableSplitMonitorProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedSessionData, setSelectedSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual payment modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualPayerName, setManualPayerName] = useState<string>("Pago Manual Caja");
  const [manualMethod, setManualMethod] = useState<string>("efectivo");
  const [submittingManual, setSubmittingManual] = useState(false);

  const tablesList = tablesConfig
    ? tablesConfig.split(",").map((t) => t.trim()).filter(Boolean)
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  useEffect(() => {
    if (restaurantId) {
      fetchAllSessions();
    }
  }, [restaurantId]);

  const fetchAllSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeSessions: any[] = [];
      for (const table of tablesList) {
        const res = await getTableSessionAction(restaurantId, table);
        if (res.success && res.session) {
          activeSessions.push({
            table,
            ...res,
          });
        }
      }
      setSessions(activeSessions);
      if (activeSessions.length > 0 && !selectedTable) {
        setSelectedTable(activeSessions[0].table);
        setSelectedSessionData(activeSessions[0]);
      }
    } catch (e: any) {
      setError("No se pudieron cargar las sesiones de mesas.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = async (table: string) => {
    setSelectedTable(table);
    setLoading(true);
    try {
      const res = await getTableSessionAction(restaurantId, table);
      if (res.success) {
        setSelectedSessionData({ table, ...res });
      } else {
        setSelectedSessionData(null);
      }
    } catch (e) {
      setError("Error al obtener detalles de la mesa.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionData?.session?.id) return;

    const numAmount = parseFloat(manualAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Ingrese un monto válido mayor a $0.00");
      return;
    }

    setSubmittingManual(true);
    setError(null);
    try {
      const res = await registerManualSplitPaymentAction(restaurantId, selectedSessionData.session.id, {
        amount: numAmount,
        paymentMethod: manualMethod,
        payerName: manualPayerName.trim() || "Pago Manual Caja",
      });

      if (res.error) {
        alert(res.error);
      } else {
        setIsManualModalOpen(false);
        setManualAmount("");
        fetchAllSessions();
        if (selectedTable) {
          handleSelectTable(selectedTable);
        }
      }
    } catch (e) {
      alert("Error al registrar el pago manual.");
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleCloseSession = async () => {
    if (!selectedSessionData?.session?.id) return;

    if (selectedSessionData.pendingAmount > 0) {
      if (!confirm(`La mesa aún tiene un saldo pendiente de $${selectedSessionData.pendingAmount.toFixed(2)}. ¿Seguro que deseas cerrar la sesión?`)) {
        return;
      }
    } else {
      if (!confirm(`¿Confirmas cerrar la sesión de la Mesa ${selectedSessionData.table}?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const res = await closeTableSessionAction(restaurantId, selectedSessionData.session.id);
      if (res.error) {
        alert(res.error);
      } else {
        alert("Sesión de mesa cerrada exitosamente.");
        fetchAllSessions();
        setSelectedSessionData(null);
      }
    } catch (e) {
      alert("Error al cerrar la sesión de la mesa.");
    } finally {
      setLoading(false);
    }
  };

  const handlePendingPayment = async (paymentId: string, approve: boolean) => {
    setLoading(true);
    const res = approve
      ? await confirmSplitPaymentAction(restaurantId, paymentId)
      : await rejectSplitPaymentAction(restaurantId, paymentId);
    if (res.error) alert(res.error);
    await fetchAllSessions();
    if (selectedTable) await handleSelectTable(selectedTable);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
            MODULO DE DIVISIÓN DE CUENTA
          </span>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Utensils className="h-6 w-6 text-amber-400" />
            Monitor de Mesas & Pagos Parciales
          </h2>
        </div>

        <button
          onClick={fetchAllSessions}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl text-xs font-extrabold border border-white/5 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? "animate-spin" : ""}`} />
          <span>Actualizar Estado</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Selection Grid */}
      <div className="space-y-2">
        <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
          Selecciona una Mesa para Inspeccionar Pagos:
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {tablesList.map((t) => {
            const hasSession = sessions.find((s) => s.table === t);
            const isSelected = selectedTable === t;
            const status = hasSession?.status || "EMPTY";

            return (
              <button
                key={t}
                onClick={() => handleSelectTable(t)}
                className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-between gap-1 relative ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/10 text-white shadow-lg"
                    : hasSession
                    ? "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-600"
                    : "border-slate-850 bg-slate-950/30 text-slate-500 hover:text-slate-400"
                }`}
              >
                <span className="text-xs font-black">Mesa {t}</span>
                {hasSession ? (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      status === "PAID"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : status === "PARTIALLY_PAID"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {status === "PAID" ? "Pagado" : status === "PARTIALLY_PAID" ? "Parcial" : "Abierta"}
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-slate-600">Libre</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Table Detail Container */}
      {selectedSessionData ? (
        <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-3xl space-y-6 animate-fade-in">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Total Oficial Mesa
              </span>
              <span className="text-2xl font-black text-white">${selectedSessionData.totalAmount.toFixed(2)}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Monto Recaudado
              </span>
              <span className="text-2xl font-black text-emerald-400">${selectedSessionData.paidAmount.toFixed(2)}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Saldo Pendiente
              </span>
              <span className="text-2xl font-black text-amber-400">${selectedSessionData.pendingAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-400">
              <span>Progreso de Pago Mesa #{selectedSessionData.table}</span>
              <span>
                {Math.round(
                  (selectedSessionData.paidAmount / (selectedSessionData.totalAmount || 1)) * 100
                )}
                %
              </span>
            </div>
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (selectedSessionData.paidAmount / (selectedSessionData.totalAmount || 1)) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Payments History Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-400" />
              Historial de Pagos Parciales Recibidos ({selectedSessionData.payments?.length || 0})
            </h3>

            {selectedSessionData.payments && selectedSessionData.payments.length > 0 ? (
              <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Comensal</th>
                      <th className="p-3">Importe</th>
                      <th className="p-3">Método</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Acciones</th>
                      <th className="p-3">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-200">
                    {selectedSessionData.payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-extrabold text-white">{p.payerName}</td>
                        <td className="p-3 font-black text-emerald-400">${p.amount.toFixed(2)}</td>
                        <td className="p-3 uppercase text-[11px] font-bold text-slate-300">{p.paymentMethod}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300">
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {p.status === "PENDING" && (
                            <div className="flex gap-1">
                              <button onClick={() => handlePendingPayment(p.id, true)} className="px-2 py-1 rounded bg-emerald-600 text-white text-[9px] font-bold">Confirmar</button>
                              <button onClick={() => handlePendingPayment(p.id, false)} className="px-2 py-1 rounded bg-red-700 text-white text-[9px] font-bold">Rechazar</button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">
                          {isMounted && p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-3 text-center border border-dashed border-slate-800 rounded-2xl">
                No hay pagos registrados aún para esta mesa.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setManualAmount(selectedSessionData.pendingAmount.toFixed(2));
                setIsManualModalOpen(true);
              }}
              disabled={selectedSessionData.pendingAmount <= 0}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-950/40"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Pago Manual en Caja</span>
            </button>

            <button
              onClick={handleCloseSession}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 border border-white/5 transition active:scale-95"
            >
              <Lock className="h-4 w-4 text-amber-400" />
              <span>Cerrar Mesa #{selectedSessionData.table}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-850 rounded-3xl">
          <Utensils className="h-10 w-10 mx-auto text-slate-700 mb-2" />
          <p className="text-xs font-semibold">Selecciona una mesa arriba para auditar y gestionar pagos.</p>
        </div>
      )}

      {/* Manual Payment Modal */}
      {isManualModalOpen && selectedSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleRegisterManualPayment}
            className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full space-y-5 shadow-2xl relative"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Pago Manual Caja
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Mesa #{selectedSessionData.table} — Saldo Pendiente: ${selectedSessionData.pendingAmount.toFixed(2)}
                </label>
              </div>

              <div>
                <label className="font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Monto a Pagar ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedSessionData.pendingAmount}
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Nombre de Comensal / Referencia
                </label>
                <input
                  type="text"
                  required
                  value={manualPayerName}
                  onChange={(e) => setManualPayerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Método de Pago
                </label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl text-white font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="deuna">Deuna / QR</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingManual}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {submittingManual ? "Registrando..." : "Confirmar Registro de Pago"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
