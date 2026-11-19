"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft, Store } from "lucide-react";

export default function CajaErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Caja POS Error Boundary caught]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold mb-2">Recuperación de Caja POS</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        Se detectó una interrupción momentánea en la interfaz de usuario. Todos tus cobros, pagos registrados y arqueo de caja en la base de datos están intactos y respaldados.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Reintentar Vista
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/caja";
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition border border-slate-700 cursor-pointer"
        >
          <Store className="w-4 h-4 text-emerald-400" /> Recargar Caja Limpia
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-xs transition border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Ir al Panel Admin
        </Link>
      </div>
    </div>
  );
}
