"use client";

import { Suspense, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions";
import { UtensilsCrossed, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50"
    >
      {pending ? "Guardando contraseña..." : "Guardar Nueva Contraseña"}
    </button>
  );
}

function RestablecerPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, formAction] = useFormState(resetPasswordAction, null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (password.length < 6) {
      e.preventDefault();
      setValidationError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      e.preventDefault();
      setValidationError("Las contraseñas no coinciden.");
      return;
    }
    setValidationError("");
  };

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Enlace inválido</h3>
          <p className="mt-2 text-sm text-slate-300">
            No se ha proporcionado un token de recuperación válido. Por favor solicita un nuevo enlace.
          </p>
        </div>
        <div>
          <Link
            href="/recuperar-password"
            className="w-full inline-flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  if ((state as any)?.success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">¡Contraseña Actualizada!</h3>
          <p className="mt-2 text-sm text-slate-300">
            {(state as any).message}
          </p>
        </div>
        <div className="pt-4">
          <Link
            href="/login"
            className="w-full inline-flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition shadow-lg"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
          Nueva Contraseña
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <KeyRound className="h-4 w-4 text-slate-500" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
          Confirmar Nueva Contraseña
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <KeyRound className="h-4 w-4 text-slate-500" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la contraseña"
            className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-sm transition-all duration-200"
          />
        </div>
      </div>

      {(validationError || (state as any)?.error) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError || (state as any)?.error}</span>
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
  );
}

export default function RestablecerPasswordPage() {
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
          Restablecer Contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Crea tu nueva contraseña para acceder a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-2xl sm:px-10">
          <Suspense fallback={
            <div className="text-center py-8 text-slate-400">
              Cargando formulario...
            </div>
          }>
            <RestablecerPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
