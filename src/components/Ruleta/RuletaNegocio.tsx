"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Gift,
  Copy,
  Check,
  X,
  MessageCircle,
  Smartphone,
  User,
  Cake,
  Calendar,
  ShieldCheck,
  Clock,
  AlertCircle,
  RotateCw,
  RefreshCw,
  Tag,
} from "lucide-react";
import { SectorItem, RuletaConfigData } from "@/lib/ruleta-types";

export interface RuletaNegocioProps {
  slug: string;
  config?: RuletaConfigData;
  restaurantInfo?: {
    name: string;
    logoUrl?: string | null;
    whatsapp?: string;
  };
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  orderContext?: {
    orderNumber?: string | number;
    total?: number;
    isPostCheckout?: boolean;
  };
  onPrizeWon?: (prize: {
    codigoCupon: string;
    premioLabel: string;
    premioTipo?: string;
    premioValor?: number;
    nombreCliente?: string;
    telefonoCliente?: string;
  }) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
  isAdminPreview?: boolean;
}

const TIPO_EMOJIS: Record<string, string> = {
  descuento: "🏷️",
  postre: "🍰",
  "2x1": "🥟",
  bebida: "🍹",
  gratis: "🎉",
  producto: "🍔",
  monto: "💵",
  sorpresa: "🎁",
};

export default function RuletaNegocio({
  slug,
  config: initialConfig,
  restaurantInfo: initialRestaurantInfo,
  initialCustomerName = "",
  initialCustomerPhone = "",
  orderContext,
  onPrizeWon,
  onClose,
  isEmbedded = false,
  isAdminPreview = false,
}: RuletaNegocioProps) {
  const [loadingConfig, setLoadingConfig] = useState(!initialConfig);
  const [config, setConfig] = useState<RuletaConfigData | null>(initialConfig || null);
  const [restaurant, setRestaurant] = useState(initialRestaurantInfo || null);
  const [isActive, setIsActive] = useState(true);

  // Form State con Pre-llenado inteligente
  const [nombre, setNombre] = useState(initialCustomerName || "");
  const [whatsapp, setWhatsapp] = useState(initialCustomerPhone || "");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialCustomerName && !nombre) setNombre(initialCustomerName);
    if (initialCustomerPhone && !whatsapp) setWhatsapp(initialCustomerPhone);
  }, [initialCustomerName, initialCustomerPhone]);

  // Spin State
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);

  // Prize & Modal State
  const [prizeResult, setPrizeResult] = useState<{
    codigoCupon?: string;
    premioLabel: string;
    premioTipo?: string;
    fechaExpiracion?: string;
    restaurantWhatsapp?: string;
    restaurantName?: string;
  } | null>(null);

  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showClaimFormModal, setShowClaimFormModal] = useState(false);
  const [claimingPrize, setClaimingPrize] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const localKey = `menuqr_ruleta_${slug}`;

  // Fetch configuration if not provided
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setLoadingConfig(false);
      return;
    }

    let isMounted = true;
    async function loadConfig() {
      try {
        setLoadingConfig(true);
        const res = await fetch(`/api/ruleta/config/${slug}`);
        const data = await res.json();
        if (isMounted) {
          if (data.success) {
            setIsActive(data.activa);
            setConfig(data.config);
            if (data.restaurant) {
              setRestaurant(data.restaurant);
            }
          } else {
            setErrorMsg(data.error || "No se pudo cargar la ruleta.");
          }
        }
      } catch (err) {
        console.error("Error al cargar config de ruleta:", err);
      } finally {
        if (isMounted) setLoadingConfig(false);
      }
    }

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, [slug, initialConfig]);

  // Check localStorage for UX persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp) {
          const hoursAgo = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
          if (hoursAgo < 24 * 30) {
            setHasSpun(true);
            if (parsed.result) {
              setPrizeResult(parsed.result);
            }
          }
        }
      }
    } catch {
      // Ignorar errores de storage
    }
  }, [localKey]);

  // 6 sectores
  const sectores: SectorItem[] = useMemo(() => {
    if (config?.sectores && config.sectores.length === 6) {
      return config.sectores;
    }
    return [
      { id: "p1", label: "10% OFF", tipo: "descuento", color_hex: "#EF4444" },
      { id: "p2", label: "Postre Gratis", tipo: "postre", color_hex: "#F59E0B" },
      { id: "p3", label: "2x1 Platos", tipo: "2x1", color_hex: "#10B981" },
      { id: "p4", label: "Bebida Gratis", tipo: "bebida", color_hex: "#3B82F6" },
      { id: "p5", label: "15% OFF", tipo: "descuento", color_hex: "#8B5CF6" },
      { id: "p6", label: "¡Sorpresa!", tipo: "gratis", color_hex: "#EC4899" },
    ];
  }, [config?.sectores]);

  // Conic gradient para dibujar la ruleta con 6 sectores exactos
  const conicStyle = useMemo(() => {
    const sectorAngle = 360 / sectores.length; // 60 deg
    const parts = sectores.map((sec, idx) => {
      const start = idx * sectorAngle;
      const end = (idx + 1) * sectorAngle;
      return `${sec.color_hex} ${start}deg ${end}deg`;
    });
    // Offset inicial de -30deg para que el sector 0 quede centrado arriba bajo el puntero
    return `conic-gradient(from -30deg, ${parts.join(", ")})`;
  }, [sectores]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Audio sintetizado con Web Audio API (Cero dependencias externas)
  const playTickSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  };

  const playWinFanfare = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.3);
      });
    } catch {}
  };

  /**
   * Ejecuta el giro físico de la ruleta hacia un sector específico
   */
  const animateWheelToSector = (targetIndex: number, onComplete: () => void) => {
    const sectorAngle = 360 / 6; // 60°
    const targetSectorCenter = targetIndex * sectorAngle;

    // Giros completos (entre 5 y 7 vueltas completas)
    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360;
    // Variación ligera dentro del sector (-12° a +12°) para realismo
    const jitter = (Math.random() - 0.5) * (sectorAngle * 0.4);

    // Efecto de sonido de ticks mientras gira
    const ticksInterval = setInterval(() => {
      playTickSound();
    }, 120);

    setTimeout(() => {
      clearInterval(ticksInterval);
    }, 3800);

    const nextRotation = rotationDeg + fullSpins + (360 - targetSectorCenter) + jitter;
    setRotationDeg(nextRotation);

    setTimeout(() => {
      setIsSpinning(false);
      playWinFanfare();
      onComplete();
    }, 4200);
  };

  /**
   * Manejador Principal al presionar GIRAR
   */
  const handleSpin = async () => {
    if (isSpinning) return;

    // Si ya ganó previamente y tiene cupón guardado (y no es vista previa de admin), mostrar modal
    if (!isAdminPreview && hasSpun && prizeResult?.codigoCupon) {
      setShowPrizeModal(true);
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, "");

    // En modo Admin Preview (isAdminPreview) permitir giro de prueba
    if (isAdminPreview) {
      setErrorMsg("");
      setIsSpinning(true);
      const randomSectorIndex = Math.floor(Math.random() * sectores.length);
      const wonSector = sectores[randomSectorIndex];
      setSelectedSector(wonSector);

      animateWheelToSector(randomSectorIndex, () => {
        const demoPrize = {
          codigoCupon: "DEMO-PROMO",
          premioLabel: wonSector.label,
          premioTipo: wonSector.tipo,
          fechaExpiracion: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          restaurantName: restaurant?.name || "Restaurante",
        };
        setPrizeResult(demoPrize);
        setShowPrizeModal(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      });
      return;
    }

    // Validación estricta para clientes reales: NO se permite girar si faltan datos
    if (!nombre.trim()) {
      setErrorMsg("⚠️ Por favor ingresa tu Nombre para poder girar la ruleta.");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg("⚠️ Por favor ingresa tu número de WhatsApp para recibir tu cupón.");
      return;
    }

    if (!fechaNacimiento) {
      setErrorMsg("⚠️ Por favor selecciona tu Fecha de Cumpleaños para poder girar.");
      return;
    }

    setErrorMsg("");
    setIsSpinning(true);

    // Cliente Real: Enviar datos validados al servidor y obtener premio oficial
    try {
      const res = await fetch("/api/ruleta/girar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          telefono: whatsapp,
          nombre,
          fechaNacimiento,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsSpinning(false);
        if (data.yaGiro && data.ultimoGiro) {
          setHasSpun(true);
          const lastPrize = {
            codigoCupon: data.ultimoGiro.codigoCupon,
            premioLabel: data.ultimoGiro.premioLabel,
            fechaExpiracion: data.ultimoGiro.fechaExpiracion,
            restaurantName: restaurant?.name,
          };
          setPrizeResult(lastPrize);
          setShowPrizeModal(true);
          if (onPrizeWon && data.ultimoGiro.codigoCupon) {
            onPrizeWon({
              codigoCupon: data.ultimoGiro.codigoCupon,
              premioLabel: data.ultimoGiro.premioLabel,
              nombreCliente: nombre,
              telefonoCliente: cleanPhone,
            });
          }
        }
        setErrorMsg(data.error || "No se pudo procesar el giro.");
        return;
      }

      const targetIndex = Number(data.sectorIndex) || 0;
      const wonSector = sectores[targetIndex] || sectores[0];
      setSelectedSector(wonSector);

      const prizeData = {
        codigoCupon: data.codigoCupon,
        premioLabel: data.premioLabel || wonSector.label,
        premioTipo: data.premioTipo || wonSector.tipo,
        fechaExpiracion: data.fechaExpiracion,
        restaurantWhatsapp: data.restaurantWhatsapp,
        restaurantName: data.restaurantName,
      };

      animateWheelToSector(targetIndex, () => {
        setHasSpun(true);
        setPrizeResult(prizeData);
        setShowPrizeModal(true);
        setShowConfetti(true);

        if (onPrizeWon && data.codigoCupon) {
          onPrizeWon({
            codigoCupon: data.codigoCupon,
            premioLabel: data.premioLabel || wonSector.label,
            premioTipo: data.premioTipo || wonSector.tipo,
            nombreCliente: nombre,
            telefonoCliente: cleanPhone,
          });
        }

        try {
          localStorage.setItem(
            localKey,
            JSON.stringify({
              timestamp: Date.now(),
              phone: cleanPhone,
              result: prizeData,
            })
          );
        } catch {}
        setTimeout(() => setShowConfetti(false), 5000);
      });
    } catch (err) {
      console.error("Error al girar ruleta con formulario:", err);
      setIsSpinning(false);
      setErrorMsg("Error de conexión al girar. Intenta nuevamente.");
    }
  };

  /**
   * Confirmar y canjear premio desde el modal de reclamo
   */
  const handleClaimPrizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = whatsapp.replace(/\D/g, "");

    if (!nombre.trim()) {
      setErrorMsg("Por favor, ingresa tu nombre.");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg("Por favor, ingresa un número de WhatsApp válido.");
      return;
    }

    if (!fechaNacimiento) {
      setErrorMsg("Por favor, ingresa tu fecha de cumpleaños.");
      return;
    }

    setClaimingPrize(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/ruleta/girar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          telefono: whatsapp,
          nombre,
          fechaNacimiento,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.yaGiro && data.ultimoGiro) {
          setHasSpun(true);
          setPrizeResult({
            codigoCupon: data.ultimoGiro.codigoCupon,
            premioLabel: data.ultimoGiro.premioLabel,
            fechaExpiracion: data.ultimoGiro.fechaExpiracion,
          });
          setShowClaimFormModal(false);
          setShowPrizeModal(true);
        }
        setErrorMsg(data.error || "No se pudo reclamar el premio.");
        setClaimingPrize(false);
        return;
      }

      const prizeData = {
        codigoCupon: data.codigoCupon,
        premioLabel: data.premioLabel || selectedSector?.label || "Premio Especial",
        premioTipo: data.premioTipo,
        fechaExpiracion: data.fechaExpiracion,
        restaurantWhatsapp: data.restaurantWhatsapp,
        restaurantName: data.restaurantName,
      };

      setHasSpun(true);
      setPrizeResult(prizeData);
      setShowClaimFormModal(false);
      setShowPrizeModal(true);
      setShowConfetti(true);

      try {
        localStorage.setItem(
          localKey,
          JSON.stringify({
            timestamp: Date.now(),
            phone: cleanPhone,
            result: prizeData,
          })
        );
      } catch {}

      setTimeout(() => setShowConfetti(false), 5000);
    } catch (err: any) {
      console.error("Error al registrar premio:", err);
      setErrorMsg("Error de conexión al registrar cupón. Intenta nuevamente.");
    } finally {
      setClaimingPrize(false);
    }
  };

  const copyCouponToClipboard = () => {
    if (!prizeResult?.codigoCupon) return;
    navigator.clipboard.writeText(prizeResult.codigoCupon);
    setCopiedCode(true);
    showToast("¡Código copiado al portapapeles! 📋");
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleOpenWhatsAppClaim = () => {
    if (!prizeResult) return;
    const restName = restaurant?.name || prizeResult.restaurantName || "el restaurante";
    const rawTargetPhone = (restaurant?.whatsapp || prizeResult.restaurantWhatsapp || "").replace(/\D/g, "");

    const msg = `¡Hola *${restName}*! 🎉 Acabo de ganar *${prizeResult.premioLabel}* en la Ruleta de Premios.\n\n🎟️ Mi código de cupón es: *${prizeResult.codigoCupon}*\n👤 Nombre: ${nombre || "Cliente"}\n📱 WhatsApp: ${whatsapp}\n🎂 Cumpleaños: ${fechaNacimiento || "No especificado"}\n\n¡Quiero hacer mi pedido y canjearlo hoy! ✨`;

    let waLink = "";
    if (rawTargetPhone) {
      let fPhone = rawTargetPhone;
      if (!fPhone.startsWith("593") && fPhone.startsWith("0")) fPhone = "593" + fPhone.substring(1);
      else if (fPhone.length === 9) fPhone = "593" + fPhone;
      waLink = `https://wa.me/${fPhone}?text=${encodeURIComponent(msg)}`;
    } else {
      waLink = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    }

    window.open(waLink, "_blank");
  };

  if (loadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-sm font-semibold">Cargando Ruleta de Premios...</p>
      </div>
    );
  }

  if (!isActive) {
    return null;
  }

  const primaryColor = config?.colorPrimario || "#ef4444";
  const secondaryColor = config?.colorSecundario || "#f59e0b";
  const bgColor = config?.colorFondo || "#0f172a";

  return (
    <div
      className={`relative w-full overflow-hidden text-slate-100 font-sans select-none ${
        isEmbedded ? "rounded-3xl p-4 sm:p-8" : "min-h-screen py-8 px-4 sm:px-6 flex flex-col justify-center items-center"
      }`}
      style={{ background: bgColor }}
    >
      {/* Botón cerrar si es modal */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur border border-white/10 transition active:scale-95 cursor-pointer"
          aria-label="Cerrar ruleta"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Confetti Animation */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => {
            const left = Math.random() * 100;
            const duration = 1.5 + Math.random() * 2;
            const delay = Math.random() * 0.4;
            const bgColors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#FBBF24"];
            const color = bgColors[i % bgColors.length];
            const size = 6 + Math.random() * 8;
            return (
              <div
                key={i}
                className="absolute top-0 rounded-sm"
                style={{
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size * 1.5}px`,
                  backgroundColor: color,
                  animation: `ruletaConfetti ${duration}s ease-out ${delay}s forwards`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Contenedor Principal */}
      <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">
        {/* Header con Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-black uppercase tracking-wider backdrop-blur mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Beneficio Exclusivo del Día</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 leading-tight">
          {config?.titulo || "¡Gira la Ruleta y Gana!"}
        </h2>

        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
          {config?.descripcion || "Gira la ruleta, ingresa tus datos y reclama tu beneficio exclusivo en caja o por WhatsApp."}
        </p>

        {/* WIDGET DE RULETA */}
        <div className="relative my-4 flex flex-col items-center">
          {/* Puntero Indicador Superior */}
          <div className="relative z-30 -mb-4 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
            <div className="w-10 h-10 rounded-full bg-slate-900 border-4 border-amber-400 grid place-items-center shadow-lg">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-amber-400 translate-y-[20px]" />
            </div>
          </div>

          {/* Sombra de Resplandor */}
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-110 pointer-events-none"
            style={{ background: secondaryColor }}
          />

          {/* Rueda Giratoria */}
          <div className="relative w-[300px] h-[300px] sm:w-[390px] sm:h-[390px] rounded-full p-2.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.2)] border-4 border-slate-700">
            {/* Disco de Sectores */}
            <div
              className="w-full h-full rounded-full relative overflow-hidden shadow-inner border-4 border-white/20 will-change-transform"
              style={{
                background: conicStyle,
                transform: `rotate(${rotationDeg}deg)`,
                transition: "transform 4.2s cubic-bezier(0.12, 0.82, 0.2, 1)",
              }}
            >
              {sectores.map((sec, idx) => {
                const angle = idx * 60; // 60 deg por sector
                return (
                  <div
                    key={sec.id || idx}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-60%)`,
                      transformOrigin: "center",
                    }}
                  >
                    <div
                      className="flex flex-col items-center"
                      style={{ transform: `rotate(${-angle}deg)` }}
                    >
                      <span className="text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] leading-none mb-0.5">
                        {TIPO_EMOJIS[sec.tipo] || "🎁"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur text-[10px] sm:text-xs font-black text-white tracking-tight border border-white/20 shadow-md whitespace-nowrap max-w-[90px] sm:max-w-[115px] truncate text-center">
                        {sec.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Divisores de sectores */}
              {sectores.map((_, idx) => (
                <div
                  key={`div-${idx}`}
                  className="absolute top-1/2 left-1/2 w-[1.5px] h-[50%] bg-white/40 origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${idx * 60 - 30}deg)`,
                  }}
                />
              ))}
            </div>

            {/* Botón Central GIRAR */}
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full text-white grid place-items-center shadow-[0_10px_25px_rgba(0,0,0,0.5)] border-4 border-white active:scale-95 transition-all duration-200 disabled:opacity-80 z-20 cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, #b91c1c)`,
              }}
              title="Girar ruleta"
            >
              <div className="text-center leading-none">
                <span className="text-sm sm:text-base font-black tracking-wider block">
                  {isSpinning ? "..." : "GIRAR"}
                </span>
                <span className="text-[9px] uppercase font-bold text-white/80 block mt-0.5 tracking-widest">
                  {isSpinning ? "Suerte!" : "Toca aquí"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Formulario Opcional Previo (Lead Capture) */}
        {!hasSpun && (
          <div className="w-full max-w-sm mt-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur text-left space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tu Nombre
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Ej: Carlos Mendoza"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={isSpinning}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium placeholder:text-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                WhatsApp (donde recibirás el cupón)
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="Ej: 0991234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={isSpinning}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium placeholder:text-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                <span>Fecha de Cumpleaños</span>
                <span className="text-[10px] text-amber-400 font-bold normal-case flex items-center gap-1">
                  🎂 Regalo en tu mes
                </span>
              </label>
              <div className="relative">
                <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  disabled={isSpinning}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition [color-scheme:dark]"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full py-3 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, #dc2626)`,
              }}
            >
              {isSpinning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Girando Ruleta...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>¡Girar Ruleta Ahora!</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 font-semibold pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> 1 giro por WhatsApp
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Válido 24h
              </span>
            </div>
          </div>
        )}

        {/* Si ya giró previamente, botón para ver cupón */}
        {hasSpun && prizeResult && !showPrizeModal && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2.5 max-w-sm w-full">
            <div className="text-xs text-amber-400 font-bold">¡Tienes un cupón activo!</div>
            <p className="text-sm font-extrabold text-white">Premio: {prizeResult.premioLabel}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowPrizeModal(true)}
                className="w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg cursor-pointer"
              >
                Ver Mi Cupón de Descuento
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(localKey);
                  } catch {}
                  setHasSpun(false);
                  setPrizeResult(null);
                  setErrorMsg("");
                }}
                className="inline-flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition underline cursor-pointer py-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reiniciar y probar otro giro</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: RECLAMO DE PREMIO TRAS GIRAR (Gamificación / Conversión) */}
      {showClaimFormModal && selectedSector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 text-center shadow-2xl space-y-4">
            <button
              onClick={() => setShowClaimFormModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 mx-auto grid place-items-center shadow-lg text-2xl animate-bounce">
              {TIPO_EMOJIS[selectedSector.tipo] || "🎉"}
            </div>

            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" /> ¡Felicidades!
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                ¡Ganaste: {selectedSector.label}!
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ingresa tus datos para generar tu código único y recibirlo por WhatsApp.
              </p>
            </div>

            <form onSubmit={handleClaimPrizeSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Tu Nombre
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos Mendoza"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={claimingPrize}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  WhatsApp (para reclamar)
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="Ej: 0991234567"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={claimingPrize}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  <span>Fecha de Cumpleaños</span>
                  <span className="text-[10px] text-amber-400 font-bold normal-case flex items-center gap-1">
                    🎂 Regalo en tu mes
                  </span>
                </label>
                <div className="relative">
                  <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                  <input
                    type="date"
                    required
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    disabled={claimingPrize}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-red-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={claimingPrize}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer mt-2"
              >
                {claimingPrize ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Generando Cupón...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>¡Obtener Mi Código de Cupón!</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CUPÓN GENERADO Y BOTÓN WHATSAPP */}
      {showPrizeModal && prizeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 text-center shadow-2xl space-y-4">
            <button
              onClick={() => setShowPrizeModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 mx-auto grid place-items-center shadow-lg text-2xl">
              🎉
            </div>

            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" /> ¡Felicidades Ganador!
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                {prizeResult.premioLabel}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tu beneficio ha sido activado y guardado en tu cuenta.
              </p>
            </div>

            {/* Código de Cupón Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Tu Código de Cupón
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-amber-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 select-all">
                  {prizeResult.codigoCupon}
                </span>
                <button
                  onClick={copyCouponToClipboard}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95 cursor-pointer"
                  title="Copiar código"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Válido por 24 horas. Muéstralo al personal de caja.
              </div>
            </div>

            {/* Botón Aplicar al Pedido Actual si viene de Checkout */}
            {onPrizeWon && prizeResult.codigoCupon && (
              <button
                onClick={() => {
                  if (prizeResult.codigoCupon) {
                    onPrizeWon({
                      codigoCupon: prizeResult.codigoCupon,
                      premioLabel: prizeResult.premioLabel,
                      premioTipo: prizeResult.premioTipo,
                    });
                  }
                  setShowPrizeModal(false);
                  if (onClose) onClose();
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition duration-200 active:scale-95 cursor-pointer"
              >
                <Tag className="w-5 h-5" />
                <span>Aplicar a mi Pedido Actual</span>
              </button>
            )}

            {/* Botón WhatsApp CTA */}
            <button
              onClick={handleOpenWhatsAppClaim}
              className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition duration-200 active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{orderContext?.isPostCheckout ? "Enviar Cupón Ganado por WhatsApp" : "Reclamar / Usar por WhatsApp"}</span>
            </button>

            <button
              onClick={() => {
                setShowPrizeModal(false);
                if (onClose) onClose();
              }}
              className="text-xs text-slate-400 hover:text-white underline font-semibold transition"
            >
              {orderContext?.isPostCheckout ? "Cerrar y volver al inicio" : "Continuar viendo el menú"}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-white text-xs font-bold shadow-2xl backdrop-blur animate-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Global CSS for custom animations */}
      <style jsx global>{`
        @keyframes ruletaConfetti {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
