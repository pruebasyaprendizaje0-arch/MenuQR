"use client";

import React, { useRef } from "react";
import { Printer, X, CheckCircle2, AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface ReporteZData {
  shiftId: string;
  businessName: string;
  openedByName: string;
  closedByName: string;
  openedAt: string;
  closedAt: string;
  initialCash: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalDeunaSales: number;
  totalSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
}

interface ReporteZTicketModalProps {
  report: ReporteZData;
  onClose: () => void;
}

export function ReporteZTicketModal({ report, onClose }: ReporteZTicketModalProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const fmtCurrency = (val: number) => `$${Number(val || 0).toFixed(2)}`;
  const fmtDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("es-EC", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return isoStr;
    }
  };

  const isSquare = Math.abs(report.difference) < 0.01;
  const isSurplus = report.difference > 0.01;
  const isShortage = report.difference < -0.01;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white">
        
        {/* Header no imprimible */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 print:hidden bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-white text-base">Reporte Z de Cierre</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formato Ticket Térmico 80mm */}
        <div
          ref={ticketRef}
          id="printable-ticket"
          className="p-6 text-slate-900 bg-white font-mono text-xs max-w-[340px] mx-auto print:max-w-none print:p-2"
        >
          {/* Encabezado */}
          <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
            <p className="font-black text-base uppercase tracking-wider">{report.businessName}</p>
            <p className="text-[11px] font-semibold text-slate-700 mt-0.5">CIERRE DE CAJA - REPORTE Z</p>
            <p className="text-[10px] text-slate-500 mt-1">ID Turno: {report.shiftId.slice(-8).toUpperCase()}</p>
          </div>

          {/* Datos del Turno */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Apertura:</span>
              <span className="font-semibold">{fmtDate(report.openedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Apertura por:</span>
              <span className="font-semibold">{report.openedByName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Cierre:</span>
              <span className="font-semibold">{fmtDate(report.closedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Cerrado por:</span>
              <span className="font-semibold">{report.closedByName}</span>
            </div>
          </div>

          {/* Desglose de Ventas por Método */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1">
            <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wide mb-1.5">
              VENTAS DEL TURNO
            </p>
            <div className="flex justify-between">
              <span className="text-slate-600">Efectivo:</span>
              <span className="font-semibold">{fmtCurrency(report.totalCashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tarjetas / POS:</span>
              <span className="font-semibold">{fmtCurrency(report.totalCardSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Transferencias:</span>
              <span className="font-semibold">{fmtCurrency(report.totalTransferSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Deuna QR:</span>
              <span className="font-semibold">{fmtCurrency(report.totalDeunaSales)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
              <span>TOTAL VENTAS:</span>
              <span>{fmtCurrency(report.totalSales)}</span>
            </div>
          </div>

          {/* Arqueo de Efectivo */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1">
            <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wide mb-1.5">
              ARQUEO EN CAJÓN DE DINERO
            </p>
            <div className="flex justify-between">
              <span className="text-slate-600">(+) Fondo Inicial:</span>
              <span>{fmtCurrency(report.initialCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">(+) Ventas Efectivo:</span>
              <span>{fmtCurrency(report.totalCashSales)}</span>
            </div>
            {report.cashInTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>(+) Entradas Caja:</span>
                <span>+{fmtCurrency(report.cashInTotal)}</span>
              </div>
            )}
            {report.cashOutTotal > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>(-) Salidas Caja:</span>
                <span>-{fmtCurrency(report.cashOutTotal)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
              <span>(=) EFECTIVO ESPERADO:</span>
              <span>{fmtCurrency(report.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm bg-slate-100 p-1 rounded">
              <span>EFECTIVO CONTADO:</span>
              <span>{fmtCurrency(report.actualCash)}</span>
            </div>
            <div
              className={`flex justify-between font-black text-xs pt-1 ${
                isSquare
                  ? "text-emerald-700"
                  : isSurplus
                  ? "text-blue-700"
                  : "text-rose-700"
              }`}
            >
              <span>DIFERENCIA:</span>
              <span>
                {isSquare
                  ? "$0.00 (EXACTO)"
                  : isSurplus
                  ? `+${fmtCurrency(report.difference)} (SOBRANTE)`
                  : `${fmtCurrency(report.difference)} (FALTANTE)`}
              </span>
            </div>
          </div>

          {/* Observaciones */}
          {report.notes && (
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <p className="font-bold text-slate-800 uppercase text-[10px] mb-0.5">NOTAS / OBSERVACIONES:</p>
              <p className="text-[11px] text-slate-600 italic break-words">{report.notes}</p>
            </div>
          )}

          {/* Firma */}
          <div className="pt-8 pb-3 text-center space-y-4">
            <div className="border-t border-slate-400 max-w-[180px] mx-auto pt-1">
              <p className="text-[10px] font-semibold text-slate-700">Firma Cajero Responsable</p>
              <p className="text-[9px] text-slate-500">{report.closedByName}</p>
            </div>
            <p className="text-[9px] text-slate-400">Sistema Ubícame POS & MenuQR Pro</p>
          </div>
        </div>

        {/* Footer con Botones (Oculto al imprimir) */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Printer className="w-4 h-4" />
            Imprimir Reporte Z (80mm)
          </button>
          <button
            onClick={onClose}
            className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition border border-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Estilos de Impresión Térmica */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-ticket,
          #printable-ticket * {
            visibility: visible;
          }
          #printable-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 8px;
            font-size: 11px;
            color: black;
            background: white;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}

