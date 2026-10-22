"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Clock, 
  Phone, 
  Globe, 
  MapPin, 
  MessageSquare, 
  Share2, 
  Check, 
  CalendarCheck,
  ChevronDown,
  CreditCard,
  QrCode,
  Copy,
  X,
  Maximize2
} from "lucide-react";
import { SmartLogo, SmartCover } from "@/components/SmartImage";
import { getMapIframeSrc } from "@/lib/map-utils";
import { isRestaurantOpen, parseWeeklySchedule, WeeklySchedule } from "@/lib/schedule";
import { GalleryCarousel } from "@/components/public/GalleryCarousel";
import { BusinessCompactFooter } from "@/components/footer/BusinessCompactFooter";

export interface BusinessProfileProps {
  id: string;
  name: string;
  slug: string;
  themeColor?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  specialty?: string | null;
  slogan?: string | null;
  description?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
  whatsappNumber?: string | null;
  ubicameUrl?: string | null;
  reservationUrl?: string | null;
  googleBusinessUrl?: string | null;
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  province?: string | null;
  priceRange?: string | null;
  services?: string | null;
  amenities?: string[] | null;
  contactNumbers?: string | null;
  schedule?: string | null;
  localSchedule?: string | null;
  structuredSchedule?: string | null;
  blockedDates?: string | null;
  mapEmbedUrl?: string | null;
  // Dynamic CTA button to switch to the vertical action engine
  actionTabTitle?: string;
  actionTabIcon?: React.ReactNode;
  onSelectActionTab?: () => void;
  verticalBadge?: string;
  // Métodos de Pago y Cobro Directo
  paymentQrUrl?: string | null;
  qrCobroUrl?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountDocument?: string | null;
  bankAccountEmail?: string | null;
  // Galería de fotos (máx 4)
  galleryImages?: string[] | null;
  galleryTitle?: string;
  galleryBadge?: string;
  vertical?: "menuqr" | "ctalo" | "servicios" | "citas" | "reservas";
}

export function BusinessProfileView({
  name,
  slug,
  themeColor = "#ef4444",
  logoUrl,
  coverUrl,
  specialty,
  slogan,
  description,
  instagram,
  facebook,
  tiktok,
  whatsapp,
  whatsappNumber,
  ubicameUrl = "https://ubicame.info",
  reservationUrl,
  googleBusinessUrl,
  address,
  locality,
  city,
  province,
  priceRange = "$$",
  services,
  amenities,
  contactNumbers,
  schedule,
  localSchedule,
  structuredSchedule,
  blockedDates,
  mapEmbedUrl,
  actionTabTitle = "Ver Opciones",
  actionTabIcon,
  onSelectActionTab,
  verticalBadge = "Comercio Verificado",
  paymentQrUrl,
  qrCobroUrl,
  bankName,
  bankAccountType,
  bankAccountNumber,
  bankAccountName,
  bankAccountDocument,
  bankAccountEmail,
  galleryImages,
  vertical = "menuqr",
  galleryTitle,
  galleryBadge,
}: BusinessProfileProps) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);

  const effectivePaymentQr = paymentQrUrl || qrCobroUrl || null;
  const hasBankData = Boolean(bankAccountNumber || bankName || effectivePaymentQr);

  const copyToClipboard = async (text: string, fieldId: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedBankField(fieldId);
        setTimeout(() => setCopiedBankField(null), 2500);
      } catch {}
    }
  };

  const effectiveThemeColor = themeColor || "#ef4444";
  const effectiveWhatsapp = (whatsappNumber || whatsapp || "").replace(/\D/g, "");

  // Status check for open / closed
  const scheduleStatus = isRestaurantOpen({
    schedule,
    localSchedule,
    structuredSchedule,
    blockedDates,
  } as any);

  // Compartir URL
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : `https://menuqr.ubicame.cc/${slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: `Conoce ${name}: ${specialty || slogan || "Calidad y excelencia."}`,
          url,
        });
        return;
      } catch {}
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {}
    }
  };

  // Weekly Schedule Parsing
  let daysList: { name: string; time: string; active: boolean; isToday: boolean }[] = [];
  const rawScheduleStr = localSchedule || structuredSchedule;
  if (rawScheduleStr) {
    try {
      const weeklySchedule = parseWeeklySchedule(rawScheduleStr);
      const dayKeysOrder: { key: keyof WeeklySchedule; label: string; index: number }[] = [
        { key: "monday", label: "Lunes", index: 1 },
        { key: "tuesday", label: "Martes", index: 2 },
        { key: "wednesday", label: "Miércoles", index: 3 },
        { key: "thursday", label: "Jueves", index: 4 },
        { key: "friday", label: "Viernes", index: 5 },
        { key: "saturday", label: "Sábado", index: 6 },
        { key: "sunday", label: "Domingo", index: 0 },
      ];
      const todayIndex = new Date().getDay();

      daysList = dayKeysOrder.map(({ key, label, index }) => {
        const dayData = weeklySchedule[key];
        const isClosed = !dayData || !dayData.active;
        const openTime = dayData?.open || "08:00";
        const closeTime = dayData?.close || "22:00";

        return {
          name: label,
          time: isClosed ? "Cerrado" : `${openTime} - ${closeTime}`,
          active: !isClosed,
          isToday: index === todayIndex,
        };
      });
    } catch {
      daysList = [];
    }
  }

  // Map Iframe calculation
  const effectiveAddress = address && address.trim() && address.trim().toLowerCase() !== "sector turístico"
    ? address
    : locality || address || null;

  const mapIframeSrc = getMapIframeSrc(
    mapEmbedUrl,
    effectiveAddress,
    ubicameUrl,
    googleBusinessUrl,
    name,
    city,
    province
  );
  const hasLocation = Boolean(effectiveAddress || mapIframeSrc);

  const gpsUrl = googleBusinessUrl
    ? (googleBusinessUrl.startsWith("http") ? googleBusinessUrl : `https://${googleBusinessUrl}`)
    : effectiveAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(effectiveAddress + ", Ecuador")}`
    : ubicameUrl
    ? (ubicameUrl.startsWith("http") ? ubicameUrl : `https://${ubicameUrl}`)
    : null;

  // Combine services and amenities
  const combinedBadges: string[] = [];
  if (services && services.trim()) {
    services.split(",").forEach((s) => {
      const trimmed = s.trim();
      if (trimmed && !combinedBadges.includes(trimmed)) combinedBadges.push(trimmed);
    });
  }
  if (Array.isArray(amenities)) {
    amenities.forEach((a) => {
      const trimmed = a.trim();
      if (trimmed && !combinedBadges.includes(trimmed)) combinedBadges.push(trimmed);
    });
  }

  return (
    <div className="space-y-10 animate-fade-in font-sans">
      {/* ============================================================ */}
      {/* 1. HERO COMERCIAL / STAGE                                    */}
      {/* ============================================================ */}
      <div className="relative rounded-[2.5rem] bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border border-white/10 p-6 sm:p-10 shadow-2xl overflow-hidden group/hero">
        {/* Atmospheric Cover Banner Backdrop */}
        {coverUrl && coverUrl.trim() !== "" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <img
              src={coverUrl.trim()}
              alt={`Portada de ${name}`}
              className="w-full h-full object-cover opacity-20 filter blur-xs scale-105 transition-transform duration-1000 group-hover/hero:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/65"></div>
          </div>
        )}

        {/* Subtle Ambient Theme Background Glow */}
        <div 
          className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full blur-[140px] opacity-25 pointer-events-none transition-all duration-700"
          style={{ backgroundColor: effectiveThemeColor }}
        ></div>
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none"></div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
          {/* Left Column: Specialty + Name + Slogan + Social Bar + CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Category / Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                {specialty || verticalBadge}
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                scheduleStatus.isOpen 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                  : "bg-red-500/20 text-red-300 border-red-500/30"
              }`}>
                {scheduleStatus.isOpen ? "🟢 Abierto Ahora" : "🔴 Cerrado Por Ahora"}
              </span>
            </div>

            {/* Main Display Headline (Big Bold Typography) */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.08] tracking-tight uppercase">
                {name}
              </h1>
              <p className="text-sm sm:text-base text-amber-400/90 font-bold uppercase tracking-wider">
                {slogan || "¡LA MEJOR CALIDAD, ESO ES TODO!"}
              </p>
            </div>

            {/* Description Excerpt */}
            {description && (
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl font-normal line-clamp-3">
                {description}
              </p>
            )}

            {/* Social Media Pill Bar */}
            {(instagram || facebook || tiktok || effectiveWhatsapp || ubicameUrl) && (
              <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-white/10 shrink-0 w-fit">
                {instagram && (
                  <a
                    href={instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-pink-500/50 hover:bg-pink-500/10 transition duration-200"
                    title="Instagram"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook.startsWith("http") ? facebook : `https://facebook.com/${facebook}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition duration-200"
                    title="Facebook"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  </a>
                )}
                {tiktok && (
                  <a
                    href={tiktok.startsWith("http") ? tiktok : `https://tiktok.com/${tiktok}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-100/50 hover:bg-white/10 transition duration-200"
                    title="TikTok"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                  </a>
                )}
                {effectiveWhatsapp && (
                  <a
                    href={`https://wa.me/${effectiveWhatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition duration-200"
                    title="WhatsApp"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </a>
                )}
                {ubicameUrl && (
                  <a
                    href={ubicameUrl.startsWith("http") ? ubicameUrl : `https://${ubicameUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition duration-200"
                    title="Ubicame.info"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            {/* Primary CTA Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2 w-full">
              {/* Dynamic Action Motor Button */}
              {onSelectActionTab && (
                <button
                  onClick={onSelectActionTab}
                  className="w-full h-12 px-4 rounded-2xl text-xs sm:text-sm font-black text-white uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 duration-200 shadow-xl relative overflow-hidden group flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  style={{ 
                    backgroundColor: effectiveThemeColor,
                    boxShadow: `0 12px 30px -5px ${effectiveThemeColor}55`
                  }}
                >
                  <div className="absolute inset-0 w-1/2 h-full bg-white/15 skew-x-[-25deg] -translate-x-full group-hover:animate-shimmer"></div>
                  {actionTabIcon || <CalendarCheck className="h-4.5 w-4.5 shrink-0" />}
                  <span>{actionTabTitle}</span>
                </button>
              )}

              {/* Reservar CTA */}
              {(() => {
                const resUrl = reservationUrl?.trim() || "https://reservaciones.ubicame.cc";
                const finalResUrl = resUrl.startsWith("http") ? resUrl : `https://${resUrl}`;
                return (
                  <a
                    href={finalResUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 px-4 rounded-2xl text-xs sm:text-sm font-black text-amber-300 hover:text-amber-100 uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 duration-200 border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-600/20 backdrop-blur-md shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 group hover:border-amber-400 hover:shadow-amber-500/20 shrink-0"
                    title="Reservar Ahora"
                  >
                    <CalendarCheck className="h-4.5 w-4.5 shrink-0 text-amber-400 group-hover:scale-110 transition-transform duration-200" />
                    <span>Reservar</span>
                  </a>
                );
              })()}

              {/* Ubicame.info CTA */}
              {(() => {
                const ubiUrl = ubicameUrl?.trim() || "https://ubicame.info";
                const finalUbiUrl = ubiUrl.startsWith("http") ? ubiUrl : `https://${ubiUrl}`;
                return (
                  <a
                    href={finalUbiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 px-4 rounded-2xl text-xs sm:text-sm font-black text-sky-300 hover:text-sky-100 uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 duration-200 border border-sky-500/40 bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-blue-600/20 backdrop-blur-md shadow-lg shadow-sky-500/10 flex items-center justify-center gap-2 group hover:border-sky-400 hover:shadow-sky-500/20 shrink-0"
                    title="Ubicame.info"
                  >
                    <Globe className="h-4.5 w-4.5 shrink-0 text-sky-400 group-hover:scale-110 transition-transform duration-200" />
                    <span>Ubicame.info</span>
                  </a>
                );
              })()}

              {/* Compartir Button */}
              <button
                onClick={handleShare}
                className="w-full h-12 px-4 rounded-2xl text-xs sm:text-sm font-black text-slate-200 hover:text-white uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 duration-200 border border-white/15 bg-slate-900/60 backdrop-blur-md shadow-lg flex items-center justify-center gap-2 group hover:border-white/30 cursor-pointer shrink-0"
              >
                {shareCopied ? (
                  <>
                    <Check className="h-4.5 w-4.5 shrink-0 text-green-400" />
                    <span className="text-green-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4.5 w-4.5 shrink-0 text-amber-400" />
                    <span>Compartir</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Showcase Card with SmartCover & SmartLogo */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-md aspect-square rounded-[3rem] p-3 bg-gradient-to-tr from-slate-900/80 via-slate-800/40 to-white/10 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group/plate overflow-hidden">
              <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative bg-slate-950 flex items-center justify-center">
                <SmartCover
                  src={coverUrl}
                  alt={name}
                  name={name}
                  themeColor={effectiveThemeColor}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/plate:scale-110 filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none"></div>

                {/* Logo Avatar Overlay (Bottom Left) */}
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md p-2 pr-4 rounded-2xl border border-white/15 shadow-xl max-w-[90%]">
                  <div className="relative shrink-0">
                    <SmartLogo
                      src={logoUrl}
                      alt={name}
                      name={name}
                      themeColor={effectiveThemeColor}
                      className="h-12 w-12 rounded-xl object-cover border border-white/20"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-white block truncate">{name}</span>
                    <span className="text-[10px] text-amber-400 font-bold block truncate">{verticalBadge}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SOBRE NOSOTROS & HISTORIA                                 */}
      {/* ============================================================ */}
      {description && (
        <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber-400">Sobre Nosotros & Nuestra Experiencia</h3>
          </div>
          <p className="text-slate-200 text-lg sm:text-xl leading-relaxed italic font-serif">
            "{description}"
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2.5 GALERÍA DE INSTALACIONES & ÁREAS (MÁX. 4 FOTOS)          */}
      {/* ============================================================ */}
      {galleryImages && galleryImages.length > 0 && (
        <GalleryCarousel
          images={galleryImages}
          title={galleryTitle || "Instalaciones & Áreas"}
          badge={galleryBadge || "📸 Galería"}
          themeColor={effectiveThemeColor}
        />
      )}

      {/* ============================================================ */}
      {/* 3. QUICK SPECS (ESPECIALIDAD & HORARIOS ACORDEÓN)            */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Especialidad */}
        <div className="bg-slate-900/50 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl flex items-start gap-4 transition-all duration-300 hover:border-amber-500/30">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] block">Especialidad</span>
            <p className="text-base text-white font-black mt-1 leading-snug">
              {specialty || "Servicio Premium de Alta Calidad"}
            </p>
          </div>
        </div>

        {/* Acordeón de Horarios */}
        <div className={`bg-slate-900/50 border rounded-[2.5rem] backdrop-blur-xl transition-all duration-300 overflow-hidden ${
          isScheduleOpen ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-white/10 hover:border-amber-500/30"
        }`}>
          <button
            type="button"
            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
            className="w-full p-6 flex items-start justify-between gap-3 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] block">Horario de Atención</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                    scheduleStatus.isOpen ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"
                  }`}>
                    {scheduleStatus.isOpen ? "🟢 Abierto hoy" : "🔴 Cerrado"}
                  </span>
                </div>
                <p className="text-sm text-white font-black mt-1 leading-snug line-clamp-2">
                  {schedule || (daysList.length > 0 ? "Ver horario completo de la semana" : "Atención permanente previa cita")}
                </p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 shrink-0 mt-1 transition-transform duration-200">
              <ChevronDown className={`w-4 h-4 transform transition-transform duration-300 ${isScheduleOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </button>

          {/* Desglose Día por Día */}
          {isScheduleOpen && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-850/80 space-y-2 animate-slide-in">
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block mb-3">
                📅 Desglose Semanal de Atención
              </span>

              {daysList.length > 0 ? (
                <div className="space-y-1.5">
                  {daysList.map((d) => (
                    <div
                      key={d.name}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs transition duration-200 ${
                        d.isToday
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-200 font-extrabold"
                          : "bg-slate-950/60 border border-slate-900 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${d.active ? "bg-emerald-400" : "bg-slate-600"}`}></span>
                        <span>{d.name}</span>
                        {d.isToday && <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase">Hoy</span>}
                      </div>
                      <span className={`font-mono font-bold ${d.active ? (d.isToday ? "text-amber-300" : "text-white") : "text-slate-500"}`}>
                        {d.time}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-xl text-xs text-slate-300 leading-relaxed font-medium">
                  {schedule || "Consulte nuestros horarios y disponibilidad por WhatsApp."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. TARJETAS DE CONTACTO & ACCIONES (4 COLUMNAS)             */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 1: Reserva / Turnos */}
        {(() => {
          const resUrl = reservationUrl?.trim() || "https://reservaciones.ubicame.cc";
          const finalResUrl = resUrl.startsWith("http") ? resUrl : `https://${resUrl}`;
          let displayDomain = "reservaciones.ubicame.cc";
          try {
            const urlObj = new URL(finalResUrl);
            displayDomain = urlObj.hostname + (urlObj.pathname !== "/" ? urlObj.pathname : "");
          } catch {
            displayDomain = resUrl.replace(/^https?:\/\//, "");
          }

          return (
            <a
              href={finalResUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-900/50 border border-amber-500/30 p-5 sm:p-6 rounded-[2.5rem] flex items-center gap-4 sm:gap-5 hover:bg-slate-900/90 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group"
            >
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-110 group-hover:bg-amber-500/20 transition duration-300">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-[0.2em] block">Reserva Online</span>
                <p className="text-sm text-white font-black mt-0.5 flex items-center gap-1.5">
                  <span>Reservar Ahora</span>
                  <span className="text-xs text-amber-400 font-normal">↗</span>
                </p>
                <span className="text-xs text-slate-400 mt-0.5 block truncate">{displayDomain}</span>
              </div>
            </a>
          );
        })()}

        {/* Card 2: Ubicame.info */}
        {(() => {
          const ubiUrl = ubicameUrl?.trim() || "https://ubicame.info";
          const finalUbiUrl = ubiUrl.startsWith("http") ? ubiUrl : `https://${ubiUrl}`;
          let displayDomain = "ubicame.info";
          try {
            const urlObj = new URL(finalUbiUrl);
            displayDomain = urlObj.hostname + (urlObj.pathname !== "/" ? urlObj.pathname : "");
          } catch {
            displayDomain = ubiUrl.replace(/^https?:\/\//, "");
          }

          return (
            <a
              href={finalUbiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-900/50 border border-sky-500/30 p-5 sm:p-6 rounded-[2.5rem] flex items-center gap-4 sm:gap-5 hover:bg-slate-900/90 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-300 group"
            >
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-500/10 text-sky-400 rounded-2xl flex items-center justify-center shrink-0 border border-sky-500/20 group-hover:scale-110 group-hover:bg-sky-500/20 transition duration-300">
                <Globe className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-[0.2em] block">Perfil Comercial</span>
                <p className="text-sm text-white font-black mt-0.5 flex items-center gap-1.5">
                  <span>Ubicame.info</span>
                  <span className="text-xs text-sky-400 font-normal">↗</span>
                </p>
                <span className="text-xs text-slate-400 mt-0.5 block truncate">{displayDomain}</span>
              </div>
            </a>
          );
        })()}

        {/* Card 3: WhatsApp Directo */}
        {effectiveWhatsapp && (
          <a
            href={`https://wa.me/${effectiveWhatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-900/50 border border-white/10 p-5 sm:p-6 rounded-[2.5rem] flex items-center gap-4 sm:gap-5 hover:bg-slate-900/80 hover:border-emerald-500/40 transition-all duration-300 group"
          >
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-110 transition duration-300">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] block">Atención WhatsApp</span>
              <p className="text-sm text-white font-black mt-0.5 truncate">Chatear Ahora</p>
              <span className="text-xs text-slate-400 mt-0.5 block truncate">Consultas y confirmaciones</span>
            </div>
          </a>
        )}

        {/* Card 4: Dirección Principal */}
        {address && (
          <div className={`bg-slate-900/50 border border-white/10 p-5 sm:p-6 rounded-[2.5rem] flex items-center gap-4 sm:gap-5 transition-all duration-300 ${!effectiveWhatsapp ? 'sm:col-span-2' : ''}`}>
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center shrink-0 border border-red-500/20">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] block">Dirección Principal</span>
              <p className="text-sm text-white font-black mt-0.5 leading-snug line-clamp-2">{address}</p>
              {locality && <span className="block text-xs text-slate-400 mt-0.5 truncate">{locality}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. SERVICIOS, FACILIDADES & CONTACTOS EXTRA                  */}
      {/* ============================================================ */}
      {(combinedBadges.length > 0 || contactNumbers) && (
        <div className={`grid grid-cols-1 ${combinedBadges.length > 0 && contactNumbers ? 'lg:grid-cols-2' : ''} gap-6`}>
          {/* Servicios y Facilidades */}
          {combinedBadges.length > 0 && (
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-xl space-y-4">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-[0.2em] block">Servicios y Facilidades</span>
              <div className="flex flex-wrap gap-2.5">
                {combinedBadges.map((badge, idx) => (
                  <span 
                    key={idx} 
                    className="px-4 py-2 rounded-2xl text-xs font-bold bg-slate-950 border border-white/10 text-slate-200 flex items-center gap-2 shadow-inner"
                  >
                    <span className="text-emerald-400 font-black">✓</span> {badge}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Otros Números de Contacto */}
          {contactNumbers && (
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-xl space-y-4">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-[0.2em] block">Otros Teléfonos de Contacto</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {contactNumbers.split(",").map((phone, idx) => (
                  <a
                    key={idx}
                    href={`tel:${phone.replace(/\s+/g, "")}`}
                    className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-slate-950 border border-white/10 hover:border-amber-400/40 hover:bg-slate-900 text-sm font-bold text-slate-200 hover:text-white transition-all duration-300"
                  >
                    <Phone className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="truncate">{phone.trim()}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MÉTODOS DE PAGO DIRECTO & TRANSFERENCIAS BANCARIAS        */}
      {/* ============================================================ */}
      {hasBankData && (
        <div className="bg-slate-900/80 border border-white/15 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 text-white animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-[0.25em] block mb-1">
                PAGOS DIRECTOS SIN COMISIÓN
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <CreditCard className="h-6 w-6 text-emerald-400" /> Métodos de Pago & Cobro
              </h3>
            </div>
            <span className="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 w-fit">
              🔒 Verificado por el Comercio
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: QR Code (Deuna / Banco) if present */}
            {effectivePaymentQr && (
              <div className="lg:col-span-4 bg-slate-950 p-5 rounded-3xl border border-white/10 flex flex-col items-center text-center space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 tracking-wider">
                  <QrCode className="h-4 w-4" /> QR de Cobro Directo
                </div>
                <div 
                  onClick={() => setIsQrModalOpen(true)}
                  className="relative group cursor-pointer w-48 h-48 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center transition-transform hover:scale-105"
                  title="Clic para ampliar código QR"
                >
                  <img
                    src={effectivePaymentQr}
                    alt={`Código QR de cobro de ${name}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                    <Maximize2 className="h-4 w-4" /> Ampliar
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Escanea desde tu app bancaria o Deuna para pagar o transferir sin recargos.
                </p>
              </div>
            )}

            {/* Right: Bank Details */}
            {(bankName || bankAccountNumber) && (
              <div className={`${effectivePaymentQr ? "lg:col-span-8" : "lg:col-span-12"} bg-slate-950 p-6 rounded-3xl border border-white/10 space-y-4 shadow-inner`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Datos para Transferencia Bancaria
                  </span>
                  {bankName && (
                    <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black">
                      🏦 {bankName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {bankAccountType && (
                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Cuenta</span>
                      <span className="text-sm font-bold text-white block capitalize">{bankAccountType}</span>
                    </div>
                  )}

                  {bankAccountNumber && (
                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Número de Cuenta</span>
                        <span className="text-sm font-mono font-bold text-emerald-400 block truncate">{bankAccountNumber}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankAccountNumber, "account")}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                        title="Copiar número de cuenta"
                      >
                        {copiedBankField === "account" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {bankAccountName && (
                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Titular de la Cuenta</span>
                      <span className="text-sm font-bold text-white block">{bankAccountName}</span>
                    </div>
                  )}

                  {bankAccountDocument && (
                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cédula / RUC</span>
                        <span className="text-sm font-mono font-bold text-white block truncate">{bankAccountDocument}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankAccountDocument, "doc")}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        {copiedBankField === "doc" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}

                  {bankAccountEmail && (
                    <div className="sm:col-span-2 bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo para comprobantes</span>
                        <span className="text-xs font-medium text-slate-200 block truncate">{bankAccountEmail}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankAccountEmail, "email")}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        {copiedBankField === "email" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Fullscreen Modal */}
      {isQrModalOpen && effectivePaymentQr && (
        <div 
          onClick={() => setIsQrModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/20 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 relative shadow-2xl"
          >
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h4 className="text-base font-black text-white">{name}</h4>
            <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">Código QR de Cobro Directo</p>
            <div className="bg-white p-4 rounded-2xl shadow-inner mx-auto w-64 h-64 flex items-center justify-center">
              <img
                src={effectivePaymentQr}
                alt={`QR de ${name}`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Abre tu aplicación bancaria o Deuna y escanea este código directamente desde tu pantalla.
            </p>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MAPA E INSTALACIONES: UBICACIÓN Y CÓMO LLEGAR            */}
      {/* ============================================================ */}
      {hasLocation && (
        <div className="bg-slate-900/80 border border-white/15 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] sm:text-xs font-black text-amber-400 uppercase tracking-[0.25em] block mb-1">
                MAPA E INSTALACIONES
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <span className="text-red-500">📍</span> Ubicación y Cómo Llegar
              </h3>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {priceRange && (
                <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-black text-amber-400 flex items-center gap-1 shadow-inner">
                  <span>Precios:</span>
                  <span className="tracking-widest">{priceRange}</span>
                </div>
              )}
              {address && (
                <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-white/10 text-xs font-bold text-slate-300 flex items-center gap-2 shadow-inner max-w-xs truncate">
                  <span className="text-amber-400">🌐</span>
                  <span className="truncate">{address}</span>
                </div>
              )}
              {googleBusinessUrl && (
                <a
                  href={googleBusinessUrl.startsWith("http") ? googleBusinessUrl : `https://${googleBusinessUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-2xl bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 text-blue-300 text-xs font-bold flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95 shrink-0"
                >
                  <span className="text-blue-400">🔍</span> Google Business ↗
                </a>
              )}
              {gpsUrl && (
                <a
                  href={gpsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
                >
                  <span>📍</span> Abrir GPS ↗
                </a>
              )}
            </div>
          </div>

          {/* Map iframe container */}
          {mapIframeSrc && (
            <div className="w-full h-80 sm:h-96 lg:h-[460px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950 relative group">
              <iframe
                src={mapIframeSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full rounded-3xl filter brightness-95 contrast-105"
              ></iframe>
            </div>
          )}
        </div>
      )}

      {/* Pie de Página Comercial Ecosistema Ubícame & Ubícame.info */}
      <BusinessCompactFooter
        businessName={name}
        slug={slug}
        ubicameUrl={ubicameUrl}
        vertical={vertical}
        showAffiliateCta={true}
      />
    </div>
  );
}
