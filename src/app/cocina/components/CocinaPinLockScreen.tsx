"use client";

import React, { useState } from "react";
import {
  ChefHat,
  ArrowLeft,
  Delete,
  Store,
  AlertCircle,
} from "lucide-react";
import { kitchenAudio } from "@/lib/kitchen-audio";
import Link from "next/link";

interface CocinaPinLockScreenProps {
  slug: string;
  negocioNombre: string;
  onUnlock: () => void;
}

export function CocinaPinLockScreen({
  slug,
  negocioNombre,
  onUnlock,
}: CocinaPinLockScreenProps) {
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigitPress = async (digit: string) => {
    if (loading || enteredPin.length >= 6) return;
    setErrorMsg(null);

    // Desbloquear contexto de audio del navegador con la primera interacción
    kitchenAudio.unlock();

    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    // Si alcanza 4 dígitos o más, intentar validación automática si tiene longitud 4 o al tocar entrar
    if (nextPin.length === 4) {
      await validatePin(nextPin);
    }
  };

  const handleBackspace = () => {
    if (loading || enteredPin.length === 0) return;
    setErrorMsg(null);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setErrorMsg(null);
    setEnteredPin("");
  };

  const validatePin = async (pinToValidate: string) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/cocina/validar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          pin: pinToValidate,
        }),
      });

      const data = await res.json();

      if (data.ok && data.valido) {
        kitchenAudio.playEnCocina();
        try {
          sessionStorage.setItem(`menuqr_cocina_unlocked_${slug}`, "true");
        } catch {}
        onUnlock();
      } else {
        setShake(true);
        setErrorMsg(data.error || "PIN de cocina incorrecto. Consulta la clave al administrador.");
        setTimeout(() => {
          setEnteredPin("");
          setShake(false);
        }, 800);
      }
    } catch (err) {
      console.error("Error validando PIN de cocina:", err);
      setErrorMsg("Error de conexión al verificar el PIN.");
      setEnteredPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-black">
      {/* TARJETA PRINCIPAL DE ACCESO */}
      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* DECORACIÓN SUPERIOR AMBAR / NARANJA */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-red-500" />

        {/* LOGO Y NEGOCIO */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/25 mb-3">
            <ChefHat className="w-8 h-8" />
          </div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-orange-400 flex items-center justify-center gap-1.5">
            <Store className="w-3.5 h-3.5" />
            {negocioNombre || slug}
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Pantalla de Cocina KDS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ingresa el PIN de seguridad de cocina para ver las comandas en tiempo real
          </p>
        </div>

        {/* DISPLAY DEL PIN */}
        <div className="space-y-5">
          <div className="text-center">
            <div
              className={`flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-slate-950 border ${
                errorMsg
                  ? "border-red-500/80 bg-red-950/20"
                  : "border-slate-800"
              } transition-all duration-300 ${shake ? "animate-shake" : ""}`}
            >
              {[0, 1, 2, 3].map((idx) => {
                const filled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      filled
                        ? "bg-orange-400 scale-125 shadow-md shadow-orange-400/50"
                        : "bg-slate-800 border border-slate-700"
                    }`}
                  />
                );
              })}
            </div>

            {errorMsg ? (
              <p className="text-xs font-semibold text-red-400 mt-2.5 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-2">
                Clave de 4 dígitos configurada en el Panel Admin
              </p>
            )}
          </div>

          {/* TECLADO NUMÉRICO TÁCTIL 3x4 */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[300px] mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={loading}
                onClick={() => handleDigitPress(digit)}
                className="h-14 sm:h-16 rounded-2xl bg-slate-950 border border-slate-800 hover:border-orange-500/60 hover:bg-slate-850 active:scale-95 text-xl sm:text-2xl font-black text-white transition flex items-center justify-center shadow-md disabled:opacity-50"
              >
                {digit}
              </button>
            ))}

            {/* BOTÓN BORRAR TODO */}
            <button
              type="button"
              disabled={loading || enteredPin.length === 0}
              onClick={handleClear}
              className="h-14 sm:h-16 rounded-2xl bg-slate-950/70 border border-slate-800 hover:bg-slate-900 active:scale-95 text-xs font-bold text-slate-400 hover:text-slate-200 transition flex items-center justify-center disabled:opacity-30"
              title="Borrar todo"
            >
              Borrar
            </button>

            {/* DÍGITO 0 */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDigitPress("0")}
              className="h-14 sm:h-16 rounded-2xl bg-slate-950 border border-slate-800 hover:border-orange-500/60 hover:bg-slate-850 active:scale-95 text-xl sm:text-2xl font-black text-white transition flex items-center justify-center shadow-md disabled:opacity-50"
            >
              0
            </button>

            {/* RETROCESO (BACKSPACE) */}
            <button
              type="button"
              disabled={loading || enteredPin.length === 0}
              onClick={handleBackspace}
              className="h-14 sm:h-16 rounded-2xl bg-slate-950/70 border border-slate-800 hover:bg-slate-900 active:scale-95 text-slate-400 hover:text-orange-400 transition flex items-center justify-center disabled:opacity-30"
              title="Borrar último dígito"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* BOTÓN VALIDAR MANUAL SI TIENE PIN > 4 */}
          {enteredPin.length > 4 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => validatePin(enteredPin)}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-sm transition shadow-lg flex items-center justify-center gap-2"
            >
              <span>Verificar PIN &rarr;</span>
            </button>
          )}

          {/* ENLACE PARA VOLVER */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <Link
              href={`/${slug}`}
              className="hover:text-orange-400 transition flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Menú Digital</span>
            </Link>
            <Link
              href="/admin"
              className="hover:text-white transition font-medium"
            >
              Ir al Panel Admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
