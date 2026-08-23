"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestPasswordResetAction } from "@/lib/actions";
import { UtensilsCrossed, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50"
    >
      {pending ? "Enviando instrucciones..." : "Enviar instrucciones"}
    </button>
  );
}

export default function RecuperarPasswordPage() {
  const [state, formAction] = useFormState(requestPasswordResetAction, null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-red-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Recuperar Contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Ingresa tu correo para recibir las instrucciones de recuperación
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-2xl sm:px-10">
          {state?.success ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">¡Solicitud enviada!</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {state.message}
                </p>
                <p className="mt-3 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  💡 Revisa también tu carpeta de correo no deseado o spam.
                </p>
              </div>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="w-full inline-flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          ) : (
            <form action={formAction} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                  Correo Electrónico
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="tu-correo@restaurante.com"
                    className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
                  />
                </div>
              </div>

              {state?.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}

              <div>
                <SubmitButton />
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
