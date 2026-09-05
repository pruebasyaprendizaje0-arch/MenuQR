"use client";

import { useState, useEffect } from "react";
import {
  getTableSessionAction,
  createTableSessionAction,
  calculateEqualSplitAction,
  calculateProductSplitAction,
  requestEqualSplitPaymentAction,
  requestProductSplitPaymentAction,
} from "@/lib/split-bill-actions";
import {
  Users,
  Utensils,
  CreditCard,
  QrCode,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Plus,
  Minus,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface SplitBillModalProps {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    themeColor: string;
    paymentQrUrl?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SplitBillModal({ restaurant, tableName, isOpen, onClose }: SplitBillModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [step, setStep] = useState<"SELECT_MODE" | "EQUAL_SPLIT" | "PRODUCT_SPLIT" | "SUCCESS">("SELECT_MODE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table session data
  const [sessionData, setSessionData] = useState<any>(null);

  // Equal Split state
  const [peopleCount, setPeopleCount] = useState<number>(2);
  const [equalCalculation, setEqualCalculation] = useState<any>(null);

  // Product Split state
  const [selectedProductQtys, setSelectedProductQtys] = useState<{ [orderItemId: string]: number }>({});
  const [productCalculation, setProductCalculation] = useState<any>(null);

  // Common payment state
  const [payerName, setPayerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"deuna" | "efectivo" | "transferencia">("deuna");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<any>(null);

  // Fetch session data on open
  useEffect(() => {
    if (isOpen && tableName) {
      loadSession();
    }
  }, [isOpen, tableName]);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTableSessionAction(restaurant.id, tableName);
      if (res.error) {
        const created = await createTableSessionAction(restaurant.id, tableName);
        if (created.error) setError(created.error);
        else {
          const opened = await getTableSessionAction(restaurant.id, tableName);
          if (opened.error) setError(opened.error); else setSessionData(opened);
        }
      } else {
        setSessionData(res);
      }
    } catch (e: any) {
      setError("No se pudo cargar la cuenta de la mesa.");
    } finally {
      setLoading(false);
    }
  };

  // Recalculate equal split when people count changes
  useEffect(() => {
    if (step === "EQUAL_SPLIT" && sessionData?.session?.id) {
      runEqualCalculation();
    }
  }, [peopleCount, step, sessionData]);

  const runEqualCalculation = async () => {
    if (!sessionData?.session?.id) return;
    setLoading(true);
    try {
      const res = await calculateEqualSplitAction(restaurant.id, sessionData.session.id, peopleCount);
      if (res.error) {
        setError(res.error);
      } else {
        setEqualCalculation(res);
      }
    } catch (e) {
      setError("Error calculando partes iguales.");
    } finally {
      setLoading(false);
    }
  };

  // Recalculate product split when selected products change
  const handleQtyChange = (orderItemId: string, maxQty: number, delta: number) => {
    const current = selectedProductQtys[orderItemId] || 0;
    const next = Math.max(0, Math.min(maxQty, current + delta));
    const updated = { ...selectedProductQtys, [orderItemId]: next };
    if (next === 0) {
      delete updated[orderItemId];
    }
    setSelectedProductQtys(updated);
    runProductCalculation(updated);
  };

  const runProductCalculation = async (qtys: { [id: string]: number }) => {
    if (!sessionData?.session?.id) return;
    const selectedItems = Object.entries(qtys).map(([id, quantity]) => ({
      orderItemId: id,
      quantity,
    })).filter((i) => i.quantity > 0);

    if (selectedItems.length === 0) {
      setProductCalculation(null);
      return;
    }

    try {
      const res = await calculateProductSplitAction(restaurant.id, sessionData.session.id, selectedItems);
      if (res.error) {
        setError(res.error);
      } else {
        setProductCalculation(res);
      }
    } catch (e) {
      setError("Error calculando productos.");
    }
  };

  const handleConfirmEqualPayment = async () => {
    if (!sessionData?.session?.id || !equalCalculation?.amountPerPerson) return;

    setSubmittingPayment(true);
    setError(null);
    try {
      const idempotencyKey = `equal-${sessionData.session.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await requestEqualSplitPaymentAction(restaurant.id, sessionData.session.id, peopleCount, { paymentMethod, payerName: payerName.trim() || "Comensal", idempotencyKey });

      if (res.error) {
        setError(res.error);
      } else {
        setCompletedPayment(res.payment);
        setStep("SUCCESS");
        loadSession();
      }
    } catch (e: any) {
      setError("Ocurrió un error al procesar tu pago.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleConfirmProductPayment = async () => {
    if (!sessionData?.session?.id || !productCalculation?.total) return;

    setSubmittingPayment(true);
    setError(null);
    try {
      const idempotencyKey = `prod-${sessionData.session.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const selectedItems = Object.entries(selectedProductQtys).map(([orderItemId, quantity]) => ({ orderItemId, quantity })).filter((item) => item.quantity > 0);
      const res = await requestProductSplitPaymentAction(restaurant.id, sessionData.session.id, selectedItems, { paymentMethod, payerName: payerName.trim() || "Comensal", idempotencyKey });

      if (res.error) {
        setError(res.error);
      } else {
        setCompletedPayment(res.payment);
        setStep("SUCCESS");
        loadSession();
      }
    } catch (e: any) {
      setError("Ocurrió un error al procesar tu pago por productos.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (!isMounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" style={{ fontFamily: "var(--font-outfit)" }}>
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Background glow */}
        <div
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ backgroundColor: restaurant.themeColor }}
        ></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5 shrink-0">
          <div>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
              Mesa #{tableName}
            </span>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Utensils className="h-5 w-5 text-amber-400" />
              Dividir Cuenta en Mesa
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !sessionData && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <span className="text-xs font-bold">Cargando detalles de la mesa...</span>
          </div>
        )}

        {/* Modal Body */}
        {sessionData && !loading && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-6">
            {/* Account Summary Banner */}
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Total Cuenta Mesa</span>
                <span className="text-lg font-black text-white">${sessionData.totalAmount.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-medium block">Pendiente por Pagar</span>
                <span className="text-lg font-black text-amber-400">${sessionData.pendingAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* STEP 1: SELECT MODE */}
            {step === "SELECT_MODE" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 font-medium">
                  ¿Cómo deseas dividir el pago con tus acompañantes?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: Equal Split */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setStep("EQUAL_SPLIT")}
                    onKeyDown={(e) => e.key === "Enter" && setStep("EQUAL_SPLIT")}
                    className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800/40 text-left transition duration-200 group flex flex-col justify-between space-y-4 cursor-pointer"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center border border-amber-400/20 group-hover:scale-105 transition">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition">
                        Partes Iguales
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                        Divide el monto exacto en partes iguales entre 2 y 10 personas.
                      </p>
                    </div>
                    <div className="flex items-center text-xs font-extrabold text-amber-400 gap-1 pt-1">
                      <span>Seleccionar</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Option 2: Product Split */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setStep("PRODUCT_SPLIT")}
                    onKeyDown={(e) => e.key === "Enter" && setStep("PRODUCT_SPLIT")}
                    className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-800/40 text-left transition duration-200 group flex flex-col justify-between space-y-4 cursor-pointer"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center border border-emerald-400/20 group-hover:scale-105 transition">
                      <Utensils className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm group-hover:text-emerald-400 transition">
                        Elegir Productos
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                        Selecciona los platos o bebidas específicos que consumiste.
                      </p>
                    </div>
                    <div className="flex items-center text-xs font-extrabold text-emerald-400 gap-1 pt-1">
                      <span>Seleccionar</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: EQUAL SPLIT */}
            {step === "EQUAL_SPLIT" && (
              <div className="space-y-6">
                <button
                  onClick={() => setStep("SELECT_MODE")}
                  className="text-xs font-extrabold text-slate-400 hover:text-white flex items-center gap-1"
                >
                  ← Volver a opciones
                </button>

                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                    ¿Entre cuántas personas dividen?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPeopleCount(n)}
                        className={`py-3 rounded-2xl text-xs font-black border transition duration-200 ${
                          peopleCount === n
                            ? "text-white border-transparent shadow-lg scale-105"
                            : "text-slate-400 bg-slate-950/60 border-slate-800 hover:text-white"
                        }`}
                        style={{ backgroundColor: peopleCount === n ? restaurant.themeColor : undefined }}
                      >
                        {n} pers.
                      </button>
                    ))}
                  </div>
                </div>

                {equalCalculation && (
                  <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-3xl space-y-3">
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>Monto por persona:</span>
                      <span className="text-2xl font-black text-white" style={{ color: restaurant.themeColor }}>
                        ${equalCalculation.amountPerPerson.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Suma exacta verificada en servidor. Distribución libre de diferencias por redondeo.
                    </p>
                  </div>
                )}

                {/* Payer Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Tu Nombre / Apodo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Frank, Carlos..."
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-amber-400 px-4 py-3 rounded-2xl text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("deuna")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "deuna"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "deuna" ? restaurant.themeColor : undefined }}
                    >
                      <QrCode className="h-4 w-4 mx-auto mb-1" />
                      <span>Deuna / QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("efectivo")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "efectivo"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "efectivo" ? restaurant.themeColor : undefined }}
                    >
                      <DollarSign className="h-4 w-4 mx-auto mb-1" />
                      <span>Efectivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transferencia")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "transferencia"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "transferencia" ? restaurant.themeColor : undefined }}
                    >
                      <CreditCard className="h-4 w-4 mx-auto mb-1" />
                      <span>Transferencia</span>
                    </button>
                  </div>
                </div>

                <button
                  disabled={submittingPayment || !equalCalculation}
                  onClick={handleConfirmEqualPayment}
                  className="w-full py-4 rounded-2xl text-xs font-black uppercase text-white shadow-xl flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: restaurant.themeColor }}
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Procesando Pago...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Confirmar Pago de ${equalCalculation?.amountPerPerson.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 3: PRODUCT SPLIT */}
            {step === "PRODUCT_SPLIT" && (
              <div className="space-y-6">
                <button
                  onClick={() => setStep("SELECT_MODE")}
                  className="text-xs font-extrabold text-slate-400 hover:text-white flex items-center gap-1"
                >
                  ← Volver a opciones
                </button>

                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                    Selecciona los productos a pagar:
                  </label>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {sessionData.orders?.flatMap((o: any) => o.items)?.map((item: any) => {
                      const selectedQty = selectedProductQtys[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950/60 border border-slate-800 p-3 rounded-2xl flex items-center justify-between"
                        >
                          <div>
                            <h4 className="font-bold text-white text-xs">{item.dishName}</h4>
                            <span className="text-[11px] text-slate-400">${item.price.toFixed(2)} c/u (Disp: {item.quantity})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs font-bold text-white w-5 text-center">{selectedQty}</span>
                            <button
                              onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {productCalculation && (
                  <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal Productos:</span>
                      <span className="font-bold text-white">${productCalculation.subtotal.toFixed(2)}</span>
                    </div>
                    {productCalculation.iva > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>IVA:</span>
                        <span className="font-bold text-white">${productCalculation.iva.toFixed(2)}</span>
                      </div>
                    )}
                    {productCalculation.serviceCharge > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Servicio:</span>
                        <span className="font-bold text-white">${productCalculation.serviceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-black text-white">
                      <span>Total tu parte:</span>
                      <span style={{ color: restaurant.themeColor }}>${productCalculation.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Payer Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Tu Nombre / Apodo (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Carlos, Ana..."
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-amber-400 px-4 py-3 rounded-2xl text-white text-xs focus:outline-none"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("deuna")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "deuna"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "deuna" ? restaurant.themeColor : undefined }}
                    >
                      <QrCode className="h-4 w-4 mx-auto mb-1" />
                      <span>Deuna / QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("efectivo")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "efectivo"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "efectivo" ? restaurant.themeColor : undefined }}
                    >
                      <DollarSign className="h-4 w-4 mx-auto mb-1" />
                      <span>Efectivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transferencia")}
                      className={`p-3 rounded-2xl border text-center text-xs font-bold transition ${
                        paymentMethod === "transferencia"
                          ? "text-white border-transparent shadow-lg"
                          : "text-slate-400 bg-slate-950/60 border-slate-800"
                      }`}
                      style={{ backgroundColor: paymentMethod === "transferencia" ? restaurant.themeColor : undefined }}
                    >
                      <CreditCard className="h-4 w-4 mx-auto mb-1" />
                      <span>Transferencia</span>
                    </button>
                  </div>
                </div>

                <button
                  disabled={submittingPayment || !productCalculation}
                  onClick={handleConfirmProductPayment}
                  className="w-full py-4 rounded-2xl text-xs font-black uppercase text-white shadow-xl flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: restaurant.themeColor }}
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Procesando Pago...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Confirmar Pago de ${productCalculation?.total.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 4: SUCCESS */}
            {step === "SUCCESS" && completedPayment && (
              <div className="text-center py-6 space-y-5">
                <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-white">¡Solicitud de pago registrada!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Pago de <strong className="text-white">${completedPayment.amount.toFixed(2)}</strong> por {completedPayment.payerName}. El restaurante debe confirmarlo.
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-xs text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estado de Mesa:</span>
                    <span className="font-bold text-amber-400">
                      {sessionData.pendingAmount === 0 ? "TOTALMENTE PAGADO" : "PARCIALMENTE PAGADO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Saldo Restante Mesa:</span>
                    <span className="font-bold text-white">${sessionData.pendingAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl text-xs font-black uppercase text-white shadow-xl"
                  style={{ backgroundColor: restaurant.themeColor }}
                >
                  Entendido / Volver al Menú
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
