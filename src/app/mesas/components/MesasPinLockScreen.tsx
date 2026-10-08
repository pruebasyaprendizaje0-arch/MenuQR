"use client";

import React, { useState } from "react";
import {
  Users,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Delete,
  Store,
  Sparkles,
} from "lucide-react";
import { kitchenAudio } from "@/lib/kitchen-audio";

interface Camarero {
  id: string;
  nombre: string;
  pin?: string;
}

interface MesasPinLockScreenProps {
  negocioNombre: string;
  negocioSlug: string;
  negocioId?: string;
  camareros: Camarero[];
  onLoginSuccess: (camarero: { id: string; nombre: string }) => void;
}

export function MesasPinLockScreen({
  negocioNombre,
  negocioSlug,
  negocioId,
  camareros,
  onLoginSuccess,
}: MesasPinLockScreenProps) {
  const [selectedCamarero, setSelectedCamarero] = useState<Camarero | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Manejador del teclado táctil numérico
  const handleDigitPress = async (digit: string) => {
    if (loading || enteredPin.length >= 4) return;
    setErrorMsg(null);

    // Desbloquear audio con la primera tecla pulsada
    kitchenAudio.unlock();

    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);

    // Al completar los 4 dígitos, validar automáticamente
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
    if (!selectedCamarero) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/camareros/validar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: negocioId || (selectedCamarero as any).negocio_id || undefined,
          camarero_id: selectedCamarero.id,
          pin: pinToValidate,
        }),
      });

      const data = await res.json();

      if (data.ok && data.valido) {
        // Tono de éxito
        kitchenAudio.playEnCocina();
        onLoginSuccess({
          id: selectedCamarero.id,
          nombre: selectedCamarero.nombre,
        });
      } else {
        // Error de PIN
        setShake(true);
        setErrorMsg(data.error || "PIN incorrecto. Intenta con '1234' o pide tu PIN al administrador.");
        setTimeout(() => {
          setEnteredPin("");
          setShake(false);
        }, 800);
      }
    } catch (err) {
      console.error("Error validando PIN:", err);
      setErrorMsg("Error de conexión al validar PIN.");
      setEnteredPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
      {/* TARJETA PRINCIPAL DE ACCESO */}
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* DECORACIÓN SUPERIOR */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />

        {/* LOGO Y NEGOCIO */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
            <Store className="w-3.5 h-3.5" />
            {negocioNombre || negocioSlug}
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Módulo Meseros
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {selectedCamarero
              ? `Ingresa tu PIN de 4 dígitos para: ${selectedCamarero.nombre}`
              : "Selecciona tu nombre para abrir tu turno en mesas"}
          </p>
        </div>

        {/* PASO 1: SELECCIÓN DE CAMARERO */}
        {!selectedCamarero ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {camareros.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => {
                    setSelectedCamarero(cam);
                    setEnteredPin("");
                    setErrorMsg(null);
                  }}
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/80 hover:bg-slate-900 transition flex items-center justify-between group active:scale-[0.98] shadow-md"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-slate-300 group-hover:text-emerald-400 flex items-center justify-center font-black text-sm transition">
                      {cam.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-white text-base block group-hover:text-emerald-300 transition">
                        {cam.nombre}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Camarero registrado
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 group-hover:bg-emerald-600 transition">
                    Entrar &rarr;
                  </span>
                </button>
              ))}

              {camareros.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Cargando camareros del restaurante...
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-500">
                🔒 Cada mesero tiene asignado su propio PIN de 4 dígitos.
              </span>
            </div>
          </div>
        ) : (
          /* PASO 2: TECLADO NUMÉRICO TÁCTIL DE PIN */
          <div className="space-y-5 animate-fadeIn">
            {/* BOTÓN CAMBIAR MESERO */}
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {selectedCamarero.nombre.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-white">
                  {selectedCamarero.nombre}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedCamarero(null);
                  setEnteredPin("");
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Cambiar</span>
              </button>
            </div>

            {/* VISOR DE DÍGITOS DEL PIN (4 CÍRCULOS) */}
            <div className={`flex justify-center items-center space-x-4 my-2 transition-transform ${shake ? "animate-bounce" : ""}`}>
              {[0, 1, 2, 3].map((index) => {
                const filled = index < enteredPin.length;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      filled
                        ? "bg-emerald-400 border-emerald-400 scale-125 shadow-lg shadow-emerald-500/50"
                        : "border-slate-700 bg-slate-950"
                    }`}
                  />
                );
              })}
            </div>

            {/* MENSAJE DE ERROR */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            {/* TECLADO TÁCTIL 3x4 */}
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDigitPress(num)}
                  className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800 text-2xl font-black text-white transition active:scale-95 shadow flex items-center justify-center"
                >
                  {num}
                </button>
              ))}

              {/* TECLA LIMPIAR (C) */}
              <button
                type="button"
                disabled={loading}
                onClick={handleClear}
                className="h-14 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:bg-slate-800 text-xs uppercase font-extrabold text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center"
              >
                C
              </button>

              {/* TECLA 0 */}
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDigitPress("0")}
                className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800 text-2xl font-black text-white transition active:scale-95 shadow flex items-center justify-center"
              >
                0
              </button>

              {/* TECLA BORRAR (⌫) */}
              <button
                type="button"
                disabled={loading}
                onClick={handleBackspace}
                className="h-14 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* NOTA O PIN POR DEFECTO */}
            <div className="text-center pt-2">
              <span className="text-[11px] text-slate-500">
                💡 PIN predeterminado: <strong className="text-slate-400 font-mono">1234</strong> (configurable por el administrador).
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
