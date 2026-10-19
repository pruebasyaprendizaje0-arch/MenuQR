"use client";

import { useActionState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { loginUserAction } from "@/lib/actions";
import { KeyRound, UtensilsCrossed, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 cursor-pointer"
    >
      {pending ? "Iniciando sesión..." : "Ingresar con Correo"}
    </button>
  );
}

function LoginForm() {
  const [state, formAction] = useActionState(loginUserAction, null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const getErrorMessage = () => {
    if ((state as any)?.error) return (state as any).error;
    if (urlError === "google_config_missing") {
      return "Para activar Google Sign-In, agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno (.env).";
    }
    if (urlError === "google_token_error" || urlError === "google_auth_failed") {
      return "No se pudo autenticar con Google. Por favor intenta de nuevo.";
    }
    if (urlError === "server_auth_error") {
      return "Error de comunicación con el servidor de autenticación.";
    }
    return null;
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800/80 shadow-2xl rounded-3xl sm:px-10">
      {/* Botón de Google OAuth */}
      <div className="space-y-4">
        <GoogleSignInButton text="Continuar con Google" mode="login" />

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            o con tu correo
          </span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>
      </div>

      <form action={formAction} className="space-y-5 mt-2">
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
            Correo Electrónico
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-slate-500" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="ej: contacto@tu-restaurante.com"
              className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-xs transition-all duration-200"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Contraseña
            </label>
            <Link
              href="/recuperar-password"
              className="text-xs text-red-400 hover:text-red-300 font-medium transition"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <KeyRound className="h-4 w-4 text-slate-500" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="bg-slate-950/80 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 block w-full pl-10 pr-3 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none sm:text-xs transition-all duration-200"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <SubmitButton />
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-slate-400">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="text-amber-400 hover:text-amber-300 underline font-bold transition">
          Regístrate y empieza gratis
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-red-600 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          MenuQR Pro
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Inicia sesión para gestionar tu menú digital y catálogo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense fallback={<div className="text-center text-slate-400 py-8">Cargando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
