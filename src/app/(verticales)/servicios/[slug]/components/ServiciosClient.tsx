"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Wrench,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  Send,
  X,
  Upload,
  Sparkles,
  Navigation,
  Star,
  Check,
  Store,
} from "lucide-react";
import { BusinessProfileView } from "@/components/public/BusinessProfileView";
import { BusinessCompactFooter } from "@/components/footer/BusinessCompactFooter";
import { SmartExitButton } from "@/components/public/SmartExitButton";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";

interface CommonService {
  id: string;
  name: string;
  basePrice: number;
  icon?: string;
}

interface TechnicianData {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  whatsappNumber?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  address: string;
  specialty: string;
  slogan?: string | null;
  description: string;
  rating: string;
  jobsCount: number;
  responseTime: string;
  commonServices: CommonService[];
  themeColor?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  ubicameUrl?: string | null;
  reservationUrl?: string | null;
  googleBusinessUrl?: string | null;
  locality?: string | null;
  city?: string | null;
  province?: string | null;
  priceRange?: string | null;
  services?: string | null;
  contactNumbers?: string | null;
  schedule?: string | null;
  localSchedule?: string | null;
  structuredSchedule?: string | null;
  blockedDates?: string | null;
  mapEmbedUrl?: string | null;
  qrCobroUrl?: string | null;
  paymentQrUrl?: string | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountDocument?: string | null;
  bankAccountEmail?: string | null;
  galleryImages?: string[] | null;
}

export function ServiciosClient({ technician }: { technician: TechnicianData }) {
  const [currentTab, setCurrentTab] = useState<"profile" | "cotizar">("profile");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash === "#cotizar" || hash === "#presupuesto" || params.get("tab") === "cotizar") {
        setCurrentTab("cotizar");
      }
    }
  }, []);
  // Estado del Cotizador Express
  const [selectedService, setSelectedService] = useState<string>(
    technician.commonServices[0]?.name || "Servicio General"
  );
  const [urgency, setUrgency] = useState<"normal" | "urgente_24_7">("normal");
  const [description, setDescription] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState<string>("Lo antes posible");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [addressReference, setAddressReference] = useState<string>("");

  // Geolocalización
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Subida de Fotos
  const [photos, setPhotos] = useState<Array<{ name: string; url: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Manejar detección de GPS
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización automática.");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setGpsError("No se pudo obtener la ubicación. Por favor escribe tu dirección.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Manejar fotos seleccionadas (simulación con preview local en base64)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [
            ...prev,
            { name: file.name, url: event.target!.result as string },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Envío del Cotizador Express
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Por favor completa tu nombre y teléfono para recibir el presupuesto.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        vertical: "servicios",
        negocio_id: technician.id,
        slug: technician.slug,
        cliente_nombre: customerName,
        cliente_telefono: customerPhone,
        servicio_solicitado: selectedService,
        descripcion_problema: description,
        urgencia: urgency,
        latitud: gpsCoords?.lat || null,
        longitud: gpsCoords?.lng || null,
        direccion_referencia: addressReference,
        fecha_preferida: preferredDate,
        fotos_urls: photos.map((p) => p.name),
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok && data.whatsapp_url) {
        setSubmitted(true);
        window.open(data.whatsapp_url, "_blank");
      } else {
        alert("Error al enviar la solicitud. Por favor intenta de nuevo.");
      }
    } catch (err) {
      console.error("Error submitting quote:", err);
      alert("Error de conexión al enviar el cotizador.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 pb-28 md:pb-12">
      {/* Top Bar with Dynamic Tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-white/10 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-cyan-500/50 bg-slate-900 shrink-0">
              <Image src={technician.logoUrl} alt={technician.name} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block">Servicios Técnicos Express</span>
              <h2 className="text-xs sm:text-sm font-black text-white leading-tight truncate">{technician.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex p-1 bg-slate-900/90 border border-white/10 rounded-2xl gap-1 w-full sm:w-auto shadow-lg">
              <button
                type="button"
                onClick={() => setCurrentTab("profile")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "profile"
                    ? "bg-cyan-600 text-slate-950 font-black shadow-md shadow-cyan-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>Perfil Comercial</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("cotizar")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "cotizar"
                    ? "bg-cyan-600 text-slate-950 font-black shadow-md shadow-cyan-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Cotizador Express</span>
              </button>
            </div>

            <SmartExitButton fallbackUrl="/servicios" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {currentTab === "profile" ? (
          <BusinessProfileView
            {...technician}
            galleryTitle="Instalaciones & Trabajos Realizados"
            galleryBadge="🛠️ Equipamiento & Trabajos"
            actionTabTitle="Cotizador Express"
            actionTabIcon={<Wrench className="h-4.5 w-4.5 shrink-0" />}
            onSelectActionTab={() => setCurrentTab("cotizar")}
            verticalBadge="Servicios Técnicos Especializados"
          />
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Banner Superior & Perfil del Técnico */}
            <div className="relative h-48 sm:h-64 w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
              <Image
                src={technician.coverUrl}
                alt={technician.name}
                fill
                className="object-cover opacity-30 blur-xs"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"></div>

              <div className="absolute bottom-4 left-4 right-4 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-cyan-500 shadow-xl bg-slate-900 shrink-0">
                    <Image src={technician.logoUrl} alt={technician.name} fill className="object-cover" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Profesional Verificado
                      </span>
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {technician.rating} ({technician.jobsCount} servicios)
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {technician.name}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">{technician.specialty}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Respuesta: <strong>{technician.responseTime}</strong></span>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Información de Servicios y Tarifas Base */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span>Servicios y Tarifas Referenciales</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {technician.description}
            </p>

            <div className="space-y-2.5">
              {technician.commonServices.map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => setSelectedService(srv.name)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    selectedService === srv.name
                      ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{srv.icon || "🔧"}</span>
                    <span className="text-xs font-semibold">{srv.name}</span>
                  </div>
                  <span className="text-xs font-black text-cyan-400">
                    Desde ${srv.basePrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Garantía de Servicio */}
          <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 space-y-2">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Garantía de Satisfacción & Transparencia</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Al enviar tu cotización express con foto y GPS, el técnico evalúa la magnitud del trabajo y te envía el presupuesto exacto antes de acudir a tu domicilio. Sin costos ocultos.
            </p>
          </div>
        </div>

        {/* Columna Derecha: El Cotizador Express Inteligente */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cotizador Express en 60 Segundos</span>
            </div>

            <h2 className="text-2xl font-black text-white mb-2">Solicitar Presupuesto Rápido</h2>
            <p className="text-xs text-slate-400 mb-6">
              Sube una foto de la avería y comparte tu ubicación para recibir el costo estimado al instante en WhatsApp.
            </p>

            {submitted ? (
              <div className="p-8 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">¡Cotización Enviada con Éxito!</h3>
                <p className="text-slate-300 text-xs max-w-md mx-auto">
                  Se ha generado el resumen con las fotos y tus coordenadas. Si no se abrió WhatsApp automáticamente, haz clic abajo:
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Enviar Otra Solicitud
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote} className="space-y-5">
                {/* 1. Selector de Urgencia */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Nivel de Urgencia
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUrgency("normal")}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        urgency === "normal"
                          ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Estándar (Programada)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgency("urgente_24_7")}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        urgency === "urgente_24_7"
                          ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <span>🚨 Emergencia 24/7</span>
                    </button>
                  </div>
                </div>

                {/* 2. Servicio Solicitado */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Tipo de Trabajo o Reparación
                  </label>
                  <input
                    type="text"
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    placeholder="Ej: Fuga de agua debajo del fregadero / Cambio de tomacorriente"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* 3. Descripción de la avería */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Descripción del Problema
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe los detalles: ¿Gotea constantemente? ¿Saltan los breakers al prender la ducha? ¿Qué marca o modelo es el equipo?"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  />
                </div>

                {/* 4. Subida de Fotos del Desperfecto */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Fotos del Desperfecto (Recomendado)</span>
                    <span className="text-[11px] text-cyan-400 font-normal">Máx. 3 fotos</span>
                  </label>

                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="cursor-pointer px-4 py-3 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-2 transition">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Tomar o Subir Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {photos.map((photo, i) => (
                      <div
                        key={i}
                        className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-700 group bg-slate-950"
                      >
                        <Image src={photo.url} alt={photo.name} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Geolocalización Automática GPS */}
                <div className="border-t border-slate-800 pt-4">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Ubicación del Servicio
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={gpsLoading}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <Navigation className={`w-4 h-4 ${gpsLoading ? "animate-spin" : ""}`} />
                      <span>{gpsLoading ? "Obteniendo GPS..." : "📍 Usar mi Ubicación Actual"}</span>
                    </button>

                    {gpsCoords && (
                      <div className="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>GPS detectado: {gpsCoords.lat}, {gpsCoords.lng}</span>
                      </div>
                    )}
                  </div>

                  {gpsError && (
                    <p className="text-[11px] text-amber-400 mb-2">{gpsError}</p>
                  )}

                  <input
                    type="text"
                    value={addressReference}
                    onChange={(e) => setAddressReference(e.target.value)}
                    placeholder="Dirección manual: Calle, número de casa, barrio y referencia (ej: frente al parque)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                  />
                </div>

                {/* 6. Fecha Preferida y Datos de Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Tu Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej: Roberto Alarcón"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Teléfono WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej: 0987654321"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  {isSubmitting ? (
                    <span>Enviando cotización...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Enviar Cotización Express a WhatsApp</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Pie de Página Comercial Ecosistema Ubícame & Ubícame.info */}
      <BusinessCompactFooter
        businessName={technician.name}
        slug={technician.slug}
        ubicameUrl={technician.ubicameUrl}
        vertical="servicios"
        showAffiliateCta={true}
      />
    </div>
  )}
      </div>

      {/* Floating Bottom Navigation Bar for Mobile (One-Handed Experience) */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto">
          {/* Tab 1: Inicio / Perfil */}
          <button
            onClick={() => {
              setCurrentTab("profile");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "profile" ? (technician.themeColor || "#06b6d4") : "#94a3b8" }}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Inicio</span>
          </button>

          {/* Tab 2: Cotizar Express */}
          <button
            onClick={() => {
              setCurrentTab("cotizar");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "cotizar" ? (technician.themeColor || "#06b6d4") : "#94a3b8" }}
          >
            <Wrench className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Cotizar</span>
          </button>

          {/* Tab 3: GPS / Cobertura */}
          <button
            onClick={() => {
              setCurrentTab("cotizar");
              setTimeout(() => {
                handleDetectLocation();
              }, 100);
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition duration-200 active:scale-95"
          >
            <Navigation className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Mi GPS</span>
          </button>

          {/* Tab 4: WhatsApp Directo */}
          {(() => {
            const rawPhone = (technician.whatsappNumber || technician.whatsapp || "").toString();
            let cleanPhone = rawPhone.replace(/\D/g, "");
            if (!cleanPhone.startsWith("593") && cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
            else if (!cleanPhone.startsWith("593") && cleanPhone.length === 9) cleanPhone = "593" + cleanPhone;
            return (
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${technician.name}, vi su perfil de servicios y quisiera una cotización técnica.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-emerald-400 hover:text-emerald-300 transition duration-200 active:scale-95"
              >
                <Phone className="h-5 w-5" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">WhatsApp</span>
              </a>
            );
          })()}
        </div>
      </div>

      {/* Floating WhatsApp Action Button */}
      <FloatingWhatsAppButton
        phone={technician.whatsappNumber || technician.whatsapp}
        businessName={technician.name}
        customMessage={`¡Hola! Vi su perfil de servicios y quisiera una cotización técnica para *${technician.name}*.`}
      />
    </div>
  );
}
