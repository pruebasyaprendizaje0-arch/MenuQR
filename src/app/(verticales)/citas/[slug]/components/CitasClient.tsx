"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Star,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  Phone,
  Check,
  Send,
  Loader2,
  Lock,
  Store,
  CalendarPlus,
  Download,
  CreditCard,
  Copy,
  QrCode,
  Wallet,
  X,
  ExternalLink,
} from "lucide-react";
import { BusinessProfileView } from "@/components/public/BusinessProfileView";
import { BusinessCompactFooter } from "@/components/footer/BusinessCompactFooter";
import { SmartExitButton } from "@/components/public/SmartExitButton";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";

interface ConfirmedBookingData {
  orderId: string;
  serviceName: string;
  specialistName: string;
  date: string;
  time: string;
  durationMin: number;
  price: number;
  paymentModality: "RECEPCION" | "ABONO_PREVIO";
  abonoAmount: number;
  pendingAmount: number;
  patientName: string;
  patientPhone: string;
  businessName: string;
  businessAddress: string;
  whatsappUrl?: string;
}

interface Specialist {
  id: string;
  name: string;
  title: string;
  rating: string;
  imageUrl: string;
}

interface ServiceItem {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  description: string;
  categoryName?: string;
  imageUrl?: string | null;
  isPopular?: boolean;
}

interface BusinessData {
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
  openingHours: string;
  specialists: Specialist[];
  services: ServiceItem[];
  morningSlots?: string[];
  afternoonSlots?: string[];
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

export function CitasClient({ business }: { business: BusinessData }) {
  const [currentTab, setCurrentTab] = useState<"profile" | "citas">("profile");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash === "#citas" || hash === "#agendar" || params.get("tab") === "citas") {
        setCurrentTab("citas");
      }
    }
  }, []);
  // Estados del flujo de reserva
  const [selectedService, setSelectedService] = useState<ServiceItem>(
    business.services[0] || {
      id: "default",
      name: "Consulta General",
      durationMin: 30,
      price: 20,
      description: "",
    }
  );

  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist>(
    business.specialists[0] || {
      id: "any",
      name: "Cualquier especialista disponible",
      title: "Primer turno disponible",
      rating: "5.0",
      imageUrl: "",
    }
  );

  // Categorías de Servicios para Pestañas Rápidas
  const serviceCategories = useMemo(() => {
    const cats = Array.from(new Set(business.services.map((s) => s.categoryName || "Servicios").filter(Boolean)));
    return cats.length > 1 ? ["Todos", ...cats] : [];
  }, [business.services]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const filteredServices = useMemo(() => {
    if (selectedCategory === "Todos") return business.services;
    return business.services.filter((s) => (s.categoryName || "Servicios") === selectedCategory);
  }, [business.services, selectedCategory]);

  // Filtro de Franjas Horarias (Mañana / Tarde / Todos)
  const [slotTimeFilter, setSlotTimeFilter] = useState<"ALL" | "MORNING" | "AFTERNOON">("ALL");

  // Generar próximos 10 días laborables
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    const daysNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthsNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      // Evitar domingos si se desea o incluir todos
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0) {
        dates.push({
          fullDate: d.toISOString().split("T")[0],
          dayName: daysNames[dayOfWeek],
          dayNumber: d.getDate(),
          monthName: monthsNames[d.getMonth()],
        });
      }
    }
    return dates;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0]?.fullDate || new Date().toISOString().split("T")[0]
  );

  // Franjas horarias disponibles (dinámicas desde configuración de admin o por defecto)
  const morningSlots = business.morningSlots && business.morningSlots.length > 0
    ? business.morningSlots
    : ["09:00", "09:45", "10:30", "11:15", "12:00"];
  const afternoonSlots = business.afternoonSlots && business.afternoonSlots.length > 0
    ? business.afternoonSlots
    : ["14:00", "14:45", "15:30", "16:15", "17:00", "17:45"];

  const [selectedTime, setSelectedTime] = useState<string>(morningSlots[0] || "09:00");
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState<boolean>(false);

  // Próximo turno disponible libre en la fecha seleccionada
  const nextImmediateFreeSlot = useMemo(() => {
    const all = [...morningSlots, ...afternoonSlots];
    return all.find((s) => !occupiedSlots.includes(s)) || null;
  }, [morningSlots, afternoonSlots, occupiedSlots]);

  // Consultar disponibilidad anti-overbooking
  const fetchAvailability = useCallback(async (date: string, specId: string, specName: string) => {
    setLoadingAvailability(true);
    try {
      const params = new URLSearchParams({
        negocio_id: business.id,
        slug: business.slug,
        fecha: date,
      });
      if (specId && specId !== "any" && specId !== "default") {
        params.append("especialista_id", specId);
      } else if (specName && !specName.toLowerCase().includes("cualquier")) {
        params.append("especialista_nombre", specName);
      }

      const res = await fetch(`/api/citas/disponibilidad?${params.toString()}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.horarios_ocupados)) {
        setOccupiedSlots(data.horarios_ocupados);
        // Si el horario seleccionado ya está ocupado, mover al primer horario libre
        const allSlots = [...morningSlots, ...afternoonSlots];
        if (data.horarios_ocupados.includes(selectedTime)) {
          const firstFree = allSlots.find((s) => !data.horarios_ocupados.includes(s));
          if (firstFree) setSelectedTime(firstFree);
        }
      } else {
        setOccupiedSlots([]);
      }
    } catch (err) {
      console.error("Error al consultar disponibilidad:", err);
      setOccupiedSlots([]);
    } finally {
      setLoadingAvailability(false);
    }
  }, [business.id, business.slug, selectedTime]);

  useEffect(() => {
    fetchAvailability(selectedDate, selectedSpecialist.id, selectedSpecialist.name);
  }, [selectedDate, selectedSpecialist.id, selectedSpecialist.name, fetchAvailability]);

  // Datos del cliente
  const [patientName, setPatientName] = useState<string>("");
  const [patientPhone, setPatientPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Estados de las 3 Mejoras Clave
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBookingData | null>(null);
  const [savedUpcomingAppointment, setSavedUpcomingAppointment] = useState<ConfirmedBookingData | null>(null);
  const [isCitaBannerVisible, setIsCitaBannerVisible] = useState(true);
  const [isPatientRecognized, setIsPatientRecognized] = useState(false);
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);

  // Modalidad de Pago (Abono Previo / Recepción)
  const hasPaymentOption = Boolean(
    business.paymentQrUrl ||
    business.qrCobroUrl ||
    (business.bankName && business.bankAccountNumber)
  );
  const [paymentModality, setPaymentModality] = useState<"RECEPCION" | "ABONO_PREVIO">("RECEPCION");
  const [comprobanteRef, setComprobanteRef] = useState("");
  const [copiedBank, setCopiedBank] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Carga inicial desde LocalStorage para reconocimiento inmediato de paciente y citas activas
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedProfile = localStorage.getItem("ubicame_patient_profile");
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.name && !patientName) setPatientName(parsed.name);
        if (parsed.phone && !patientPhone) setPatientPhone(parsed.phone);
        if (parsed.name) setIsPatientRecognized(true);
      }

      const savedCita = localStorage.getItem(`ubicame_active_cita_${business.slug}`);
      if (savedCita) {
        const parsedCita = JSON.parse(savedCita);
        const todayStr = new Date().toISOString().split("T")[0];
        if (parsedCita.date >= todayStr) {
          setSavedUpcomingAppointment(parsedCita);
        }
      }
    } catch {}
  }, [business.slug]);

  // Consulta reactiva de paciente en CRM al escribir el número celular
  useEffect(() => {
    const clean = patientPhone.replace(/\D/g, "");
    if (clean.length < 9) {
      setIsPatientRecognized(false);
      return;
    }

    const timer = setTimeout(async () => {
      setPatientLookupLoading(true);
      try {
        const res = await fetch(`/api/citas?slug=${business.slug}&lookup_phone=${clean}`);
        const data = await res.json();
        if (data.ok && data.found && data.name) {
          setIsPatientRecognized(true);
          if (!patientName.trim()) {
            setPatientName(data.name);
          }
        }
      } catch {} finally {
        setPatientLookupLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [patientPhone, business.slug, patientName]);

  // Generadores de Calendarios
  const getGoogleCalendarUrl = (booking: ConfirmedBookingData) => {
    try {
      const cleanDate = booking.date.replace(/-/g, "");
      const [h, m] = booking.time.split(":").map(Number);
      const startD = new Date(`${booking.date}T${booking.time}:00`);
      const endD = new Date(startD.getTime() + (booking.durationMin || 45) * 60 * 1000);

      const pad = (n: number) => String(n).padStart(2, "0");
      const startStr = `${cleanDate}T${pad(h)}${pad(m)}00`;
      const endStr = `${endD.toISOString().slice(0, 10).replace(/-/g, "")}T${pad(endD.getHours())}${pad(endD.getMinutes())}00`;

      const title = `${booking.serviceName} · ${booking.businessName}`;
      const details = `Cita con ${booking.specialistName}\n` +
        `Establecimiento: ${booking.businessName}\n` +
        `Dirección: ${booking.businessAddress}\n` +
        `Paciente: ${booking.patientName}\n` +
        `Modalidad: ${booking.paymentModality === "ABONO_PREVIO" ? `Anticipo de $${booking.abonoAmount.toFixed(2)} registrado (Saldo en recepción: $${booking.pendingAmount.toFixed(2)})` : `Pago en recepción ($${booking.price.toFixed(2)})`}`;

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(booking.businessAddress)}`;
    } catch {
      return "#";
    }
  };

  const downloadIcsFile = (booking: ConfirmedBookingData) => {
    try {
      const cleanDate = booking.date.replace(/-/g, "");
      const [h, m] = booking.time.split(":").map(Number);
      const startD = new Date(`${booking.date}T${booking.time}:00`);
      const endD = new Date(startD.getTime() + (booking.durationMin || 45) * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const startStr = `${cleanDate}T${pad(h)}${pad(m)}00`;
      const endStr = `${endD.toISOString().slice(0, 10).replace(/-/g, "")}T${pad(endD.getHours())}${pad(endD.getMinutes())}00`;

      const icsData = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ubicame.cc//Citas Pro//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `SUMMARY:${booking.serviceName} · ${booking.businessName}`,
        `DESCRIPTION:Cita con ${booking.specialistName} en ${booking.businessName}. Paciente: ${booking.patientName}`,
        `LOCATION:${booking.businessAddress}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Turno-${booking.businessName.replace(/\s+/g, "_")}-${booking.date}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating ICS file:", err);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName.trim() || !patientPhone.trim()) {
      alert("Por favor completa tu nombre y teléfono celular.");
      return;
    }

    setIsSubmitting(true);

    try {
      const abonoMonto = paymentModality === "ABONO_PREVIO" ? selectedService.price / 2 : 0;
      const payload = {
        vertical: "citas",
        negocio_id: business.id,
        slug: business.slug,
        cliente_nombre: patientName,
        cliente_telefono: patientPhone,
        servicio_nombre: selectedService.name,
        especialista_id: selectedSpecialist.id,
        especialista_nombre: selectedSpecialist.name,
        fecha_cita: selectedDate,
        hora_cita: selectedTime,
        duracion_min: selectedService.durationMin,
        precio_estimado: selectedService.price,
        notas_cita: notes,
        modalidad_pago: paymentModality,
        monto_abono: abonoMonto,
        comprobante_ref: comprobanteRef.trim() || undefined,
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        const bookingRecord: ConfirmedBookingData = {
          orderId: data.id || `CITA-${Date.now().toString().slice(-6)}`,
          serviceName: selectedService.name,
          specialistName: selectedSpecialist.name,
          date: selectedDate,
          time: selectedTime,
          durationMin: selectedService.durationMin,
          price: selectedService.price,
          paymentModality,
          abonoAmount: abonoMonto,
          pendingAmount: Math.max(0, selectedService.price - abonoMonto),
          patientName,
          patientPhone,
          businessName: business.name,
          businessAddress: business.address,
          whatsappUrl: data.whatsapp_url,
        };

        setConfirmedBooking(bookingRecord);
        setConfirmed(true);

        // Guardar perfil para autofill futuro y registrar cita activa en este móvil
        try {
          localStorage.setItem("ubicame_patient_profile", JSON.stringify({ name: patientName, phone: patientPhone }));
          localStorage.setItem(`ubicame_active_cita_${business.slug}`, JSON.stringify(bookingRecord));
        } catch {}

        fetchAvailability(selectedDate, selectedSpecialist.id, selectedSpecialist.name);
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, "_blank");
        }
      } else {
        alert("No se pudo agendar la cita. Por favor intenta de nuevo.");
      }
    } catch (err) {
      console.error("Error booking appointment:", err);
      alert("Error de conexión al agendar el turno.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white pb-28 md:pb-12">
      {/* Top Bar with Dynamic Tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-white/10 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-purple-500/50 bg-gradient-to-br from-purple-900/60 to-slate-900 flex items-center justify-center shrink-0">
              {business.logoUrl?.trim() ? (
                <Image src={business.logoUrl.trim()} alt={business.name} fill className="object-cover" />
              ) : (
                <CalendarIcon className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block">Citas & Turnos Online</span>
              <h2 className="text-xs sm:text-sm font-black text-white leading-tight truncate">{business.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex p-1 bg-slate-900/90 border border-white/10 rounded-2xl gap-1 w-full sm:w-auto shadow-lg">
              <button
                type="button"
                onClick={() => setCurrentTab("profile")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "profile"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>Perfil Comercial</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("citas")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "citas"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Agendar Cita Online</span>
              </button>
            </div>

            <SmartExitButton fallbackUrl="/citas" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {currentTab === "profile" ? (
          <BusinessProfileView
            {...business}
            services={business.services.map((s) => s.name).join(", ")}
            amenities={business.services.map((s) => s.name)}
            galleryTitle="Instalaciones & Consultorios"
            galleryBadge="🏥 Consultorios"
            actionTabTitle="Agendar Cita Online"
            actionTabIcon={<CalendarIcon className="h-4.5 w-4.5 shrink-0" />}
            onSelectActionTab={() => setCurrentTab("citas")}
            verticalBadge="Citas & Turnos Online"
          />
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Banner Superior & Perfil con Estilo Glassmorphism Moderno */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/30 shadow-2xl p-6 sm:p-8">
              {business.coverUrl?.trim() && (
                <Image
                  src={business.coverUrl.trim()}
                  alt={business.name}
                  fill
                  className="object-cover opacity-20 blur-xs"
                  priority
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 border-purple-400 shadow-2xl shadow-purple-500/20 bg-gradient-to-br from-purple-900/80 to-slate-900 flex items-center justify-center shrink-0">
                    {business.logoUrl?.trim() ? (
                      <Image src={business.logoUrl.trim()} alt={business.name} fill className="object-cover" />
                    ) : (
                      <CalendarIcon className="w-10 h-10 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        Agenda Online 24/7
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verificado
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight capitalize">
                      {business.name}
                    </h1>

                    <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{business.address}</span>
                    </p>
                  </div>
                </div>

                {/* Badges de Confianza & Horario */}
                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
                  <span className="text-xs text-slate-200 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-purple-500/20 shadow-md flex items-center gap-2 font-mono">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>{business.openingHours}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-300 font-extrabold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-2xl flex items-center gap-1 shadow-sm">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{business.rating || "4.9"} · Excelente reputación</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Insignias de Garantía y Confianza Médica / Profesional */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-5 mt-5 border-t border-white/10">
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Protocolos de Higiene & Bioseguridad</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Atención Personalizada de Cabecera</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Recordatorio 1-Clic por WhatsApp</span>
                </div>
              </div>

              {/* Mini-Galería de Instalaciones & Consultorios */}
              {Array.isArray(business.galleryImages) && business.galleryImages.length > 0 && (
                <div className="relative z-10 pt-4 mt-4 border-t border-white/10 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                    🏥 Nuestras Instalaciones & Consultorios:
                  </span>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {business.galleryImages.slice(0, 5).map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative w-28 h-20 rounded-2xl overflow-hidden border border-purple-500/30 shrink-0 bg-slate-900 group shadow-md"
                      >
                        <Image
                          src={imgUrl}
                          alt={`Instalación ${idx + 1}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Banner Flotante de Cita Activa Programada en este Móvil */}
            {savedUpcomingAppointment && isCitaBannerVisible && !confirmed && (
              <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border border-purple-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30 shadow-inner">
                    <CalendarIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Tu Próxima Cita Programada
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      {savedUpcomingAppointment.serviceName} con {savedUpcomingAppointment.specialistName}
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
                      📅 {savedUpcomingAppointment.date} a las {savedUpcomingAppointment.time} · {savedUpcomingAppointment.businessName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedBooking(savedUpcomingAppointment);
                      setConfirmed(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Ver Mi Pase Digital</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCitaBannerVisible(false)}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
                    title="Cerrar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

        {confirmed && confirmedBooking ? (
          <div className="max-w-xl mx-auto rounded-3xl bg-slate-900 border border-purple-500/40 overflow-hidden shadow-2xl animate-in zoom-in-95">
            {/* Cabecera Tipo Pase Médico / Estético */}
            <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-6 text-white text-center relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Pase de Turno Confirmado</span>
              </div>
              <h2 className="text-2xl font-black">{business.name}</h2>
              <p className="text-xs text-purple-200 mt-1 font-mono">
                Código de Turno: #{confirmedBooking.orderId.slice(-6).toUpperCase()}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Tarjeta de Detalles del Turno */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Paciente:</span>
                  <span className="font-black text-white text-sm">{confirmedBooking.patientName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Servicio / Tratamiento:</span>
                  <span className="font-bold text-white">{confirmedBooking.serviceName} ({confirmedBooking.durationMin} min)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Profesional a cargo:</span>
                  <span className="font-bold text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {confirmedBooking.specialistName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Fecha y Hora:</span>
                  <span className="font-bold text-white font-mono bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-800/60 text-xs">
                    📅 {confirmedBooking.date} a las {confirmedBooking.time}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ubicación:</span>
                  <span className="font-medium text-slate-300 text-right max-w-[220px] truncate">{confirmedBooking.businessAddress}</span>
                </div>

                {/* Estado de Pago */}
                <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center">
                  <span className="text-slate-400">Modalidad de Pago:</span>
                  {confirmedBooking.paymentModality === "ABONO_PREVIO" ? (
                    <div className="text-right">
                      <span className="text-amber-400 font-bold block">
                        🟡 Anticipo: ${confirmedBooking.abonoAmount.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Saldo en recepción: ${confirmedBooking.pendingAmount.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-emerald-400 font-bold">
                      🟢 Pago en recepción (${confirmedBooking.price.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              {/* Código QR para recepción */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-center space-y-2">
                <div className="p-3 bg-white rounded-2xl shadow-md inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(`TURNO-${confirmedBooking.orderId}-${business.slug}`)}`}
                    alt="QR Turno"
                    width={140}
                    height={140}
                    className="w-32 h-32 block"
                  />
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Muestra este código QR en recepción al llegar a tu cita para una atención inmediata.
                </p>
              </div>

              {/* Botones de Acción (Calendarios y WhatsApp) */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={getGoogleCalendarUrl(confirmedBooking)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <CalendarPlus className="w-4 h-4 text-purple-400" />
                    <span>Añadir a Google Calendar</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => downloadIcsFile(confirmedBooking)}
                    className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Apple / iCal (.ics)</span>
                  </button>
                </div>

                {confirmedBooking.whatsappUrl && (
                  <a
                    href={confirmedBooking.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Reabrir Confirmación en WhatsApp</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmed(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs transition border border-slate-800 cursor-pointer"
                >
                  Agendar Otro Turno
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBookAppointment} className="space-y-8">
            {/* Paso 1: Selector de Servicio con Categorías y Tratamientos Destacados */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-base font-bold text-white">Selecciona el Servicio o Tratamiento</h3>
                </div>

                <span className="text-xs text-purple-300 font-mono">
                  {filteredServices.length} {filteredServices.length === 1 ? "opción disponible" : "opciones disponibles"}
                </span>
              </div>

              {/* Píldoras de Categorías (Si hay más de 1 categoría) */}
              {serviceCategories.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {serviceCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-102"
                          : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredServices.map((srv, idx) => {
                  const isSelected = selectedService.id === srv.id;
                  const isPopular = srv.isPopular || idx === 0;

                  return (
                    <div
                      key={srv.id}
                      onClick={() => setSelectedService(srv)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between relative overflow-hidden group ${
                        isSelected
                          ? "bg-purple-500/10 border-purple-500 text-white shadow-xl shadow-purple-500/15 ring-2 ring-purple-500/30"
                          : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-purple-500/40 hover:bg-slate-900/60"
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            Más Solicitado
                          </span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {/* Foto del Servicio si existe */}
                        {srv.imageUrl?.trim() && (
                          <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 mb-2">
                            <Image
                              src={srv.imageUrl.trim()}
                              alt={srv.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {srv.durationMin} min
                          </span>
                          <span className="text-base font-black text-white font-mono">
                            ${srv.price.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold leading-snug text-white">{srv.name}</h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mt-1">
                            {srv.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className={isSelected ? "text-purple-300 font-bold" : "text-slate-400"}>
                          {isSelected ? "✓ Seleccionado" : "Seleccionar"}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? "text-purple-400 translate-x-0.5" : "text-slate-500"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paso 2: Selector de Especialista */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="text-base font-bold text-white">Elige al Especialista o Profesional</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {business.specialists.map((spec) => (
                  <div
                    key={spec.id}
                    onClick={() => setSelectedSpecialist(spec)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex items-center gap-3.5 ${
                      selectedSpecialist.id === spec.id
                        ? "bg-purple-500/10 border-purple-500 text-white shadow-lg shadow-purple-500/10"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-purple-900/30 border border-purple-500/30 shrink-0">
                      {spec.imageUrl?.trim() ? (
                        <Image src={spec.imageUrl.trim()} alt={spec.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-purple-300">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight">{spec.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{spec.title}</p>
                      <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 mt-1">
                        ★ {spec.rating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paso 3: Fecha y Horario Inteligente con Turno Inmediato y Filtro por Franjas */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="text-base font-bold text-white">Selecciona Fecha y Franja Horaria</h3>
              </div>

              {/* Botón de Acceso Rápido: Turno Inmediato Libre */}
              {nextImmediateFreeSlot && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 flex items-center justify-between gap-3 flex-wrap shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider">
                        ¿Atención para hoy o lo antes posible?
                      </span>
                      <p className="text-xs font-bold text-white">
                        Próximo turno libre: <span className="text-amber-300 font-mono font-black">{nextImmediateFreeSlot}</span> con {selectedSpecialist.name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTime(nextImmediateFreeSlot)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-sm cursor-pointer active:scale-95"
                  >
                    Elegir este turno
                  </button>
                </div>
              )}

              {/* Tira de Fechas con Indicadores de Disponibilidad */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Días Disponibles
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {availableDates.map((item) => (
                    <button
                      key={item.fullDate}
                      type="button"
                      onClick={() => setSelectedDate(item.fullDate)}
                      className={`min-w-[72px] py-3 rounded-2xl border text-center transition flex flex-col items-center gap-0.5 cursor-pointer ${
                        selectedDate === item.fullDate
                          ? "bg-purple-600 text-white border-purple-500 shadow-xl shadow-purple-600/30 scale-105"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider">{item.dayName}</span>
                      <span className="text-lg font-black">{item.dayNumber}</span>
                      <span className="text-[9px] uppercase font-semibold opacity-70">{item.monthName}</span>
                      <span className={`text-[8px] font-bold mt-0.5 ${selectedDate === item.fullDate ? "text-purple-200" : "text-emerald-400"}`}>
                        ● Libres
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Encabezado de Horarios con Filtro de Franjas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Horarios para el {selectedDate}</span>
                  {loadingAvailability && (
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  )}
                  {occupiedSlots.length > 0 && (
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                      <Lock className="w-2.5 h-2.5" />
                      {occupiedSlots.length} no disponible{occupiedSlots.length > 1 ? "s" : ""}
                    </span>
                  )}
                </label>

                {/* Conmutador de Franjas Horarias */}
                <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSlotTimeFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      slotTimeFilter === "ALL"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotTimeFilter("MORNING")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      slotTimeFilter === "MORNING"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🌅 Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotTimeFilter("AFTERNOON")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      slotTimeFilter === "AFTERNOON"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🌇 Tarde
                  </button>
                </div>
              </div>

              {/* Cuadrícula de Horarios según Franja Seleccionada */}
              <div className="space-y-4">
                {(slotTimeFilter === "ALL" || slotTimeFilter === "MORNING") && (
                  <div>
                    <span className="text-[11px] font-bold text-purple-400 block mb-2">Turnos de la Mañana</span>
                    <div className="flex flex-wrap gap-2">
                      {morningSlots.map((slot) => {
                        const isOccupied = occupiedSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => !isOccupied && setSelectedTime(slot)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              isOccupied
                                ? "bg-slate-900/40 border border-red-500/20 text-slate-600 line-through cursor-not-allowed opacity-50"
                                : selectedTime === slot
                                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25 scale-105 font-black ring-2 ring-purple-400"
                                : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                            }`}
                          >
                            <span>{slot}</span>
                            {isOccupied && (
                              <span className="text-[9px] no-underline not-italic font-semibold text-red-400/80">
                                (Ocupado)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(slotTimeFilter === "ALL" || slotTimeFilter === "AFTERNOON") && (
                  <div>
                    <span className="text-[11px] font-bold text-purple-400 block mb-2">Turnos de la Tarde</span>
                    <div className="flex flex-wrap gap-2">
                      {afternoonSlots.map((slot) => {
                        const isOccupied = occupiedSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isOccupied}
                            onClick={() => !isOccupied && setSelectedTime(slot)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              isOccupied
                                ? "bg-slate-900/40 border border-red-500/20 text-slate-600 line-through cursor-not-allowed opacity-50"
                                : selectedTime === slot
                                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25 scale-105 font-black ring-2 ring-purple-400"
                                : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                            }`}
                          >
                            <span>{slot}</span>
                            {isOccupied && (
                              <span className="text-[9px] no-underline not-italic font-semibold text-red-400/80">
                                (Ocupado)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Paso 4: Datos del Paciente / Cliente con Reconocimiento Rápido */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                    4
                  </span>
                  <h3 className="text-base font-bold text-white">Tus Datos de Contacto</h3>
                </div>

                {isPatientRecognized && (
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>¡Hola de nuevo! Expediente reconocido</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Nombre y Apellido *</span>
                    {isPatientRecognized && <span className="text-[10px] text-emerald-400 font-medium">✓ Autocompletado</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Ej: Gabriela Mendoza"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Número de WhatsApp *</span>
                    {patientLookupLoading && (
                      <span className="text-[10px] text-purple-400 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Buscando expediente...
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="Ej: 0991234567"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                    />
                    {isPatientRecognized && (
                      <Check className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Motivo de la cita o notas adicionales
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Dolor en molar superior / Corte degradado medio"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Paso 5: Modalidad de Pago & Garantía de Turno (Si el negocio tiene DeUna o Transferencia) */}
            {hasPaymentOption && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                    5
                  </span>
                  <h3 className="text-base font-bold text-white">Garantía de Turno & Modalidad de Pago</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentModality("RECEPCION")}
                    className={`p-4 rounded-2xl border cursor-pointer transition space-y-1.5 ${
                      paymentModality === "RECEPCION"
                        ? "bg-purple-500/10 border-purple-500 text-white shadow-lg shadow-purple-500/10"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-purple-400" />
                        <span>Pagar en Recepción al Llegar</span>
                      </span>
                      {paymentModality === "RECEPCION" && <Check className="w-4 h-4 text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Pagas el 100% (${selectedService.price.toFixed(2)}) en recepción mediante efectivo, tarjeta o transferencia el día de tu turno.
                    </p>
                  </div>

                  <div
                    onClick={() => setPaymentModality("ABONO_PREVIO")}
                    className={`p-4 rounded-2xl border cursor-pointer transition space-y-1.5 ${
                      paymentModality === "ABONO_PREVIO"
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-amber-300">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Asegurar Turno con Anticipo (50%)</span>
                      </span>
                      {paymentModality === "ABONO_PREVIO" && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Abonas ${(selectedService.price / 2).toFixed(2)} por DeUna o transferencia. Saldo restante: ${(selectedService.price / 2).toFixed(2)}.
                    </p>
                  </div>
                </div>

                {/* Despliegue de datos de transferencia y QR si eligió Abono */}
                {paymentModality === "ABONO_PREVIO" && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-4 animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <Wallet className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <h4 className="font-bold text-amber-300">
                          Transfiere tu anticipo de ${(selectedService.price / 2).toFixed(2)}
                        </h4>
                        <p className="text-slate-400 text-[11px]">
                          Puedes escanear el QR o transferir a la cuenta bancaria oficial del negocio:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      {/* QR DeUna / Cobro */}
                      {(business.paymentQrUrl || business.qrCobroUrl) && (
                        <div className="flex flex-col items-center p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                            QR DeUna / Pago Rápido
                          </span>
                          <div className="relative w-36 h-36 rounded-lg overflow-hidden border border-slate-700 bg-white p-1">
                            <Image
                              src={(business.paymentQrUrl || business.qrCobroUrl)!}
                              alt="QR de Pago"
                              fill
                              className="object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Datos Bancarios */}
                      {business.bankAccountNumber && (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1.5">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                            <span className="text-slate-400 text-[11px]">Banco:</span>
                            <span className="font-bold text-white">{business.bankName || "Banco"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">Tipo de Cuenta:</span>
                            <span className="font-medium text-slate-300">{business.bankAccountType || "Ahorros"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 py-1">
                            <span className="text-slate-400 text-[11px]">N° de Cuenta:</span>
                            <div className="flex items-center gap-1 font-mono font-bold text-amber-300">
                              <span>{business.bankAccountNumber}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (business.bankAccountNumber) {
                                    navigator.clipboard.writeText(business.bankAccountNumber);
                                    setCopiedBank(true);
                                    setTimeout(() => setCopiedBank(false), 2000);
                                  }
                                }}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                title="Copiar número"
                              >
                                {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          {business.bankAccountName && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[11px]">Titular:</span>
                              <span className="font-medium text-slate-300">{business.bankAccountName}</span>
                            </div>
                          )}
                          {business.bankAccountDocument && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[11px]">CI / RUC:</span>
                              <span className="font-mono text-slate-300">{business.bankAccountDocument}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Número de Comprobante / Referencia (Opcional):
                      </label>
                      <input
                        type="text"
                        value={comprobanteRef}
                        onChange={(e) => setComprobanteRef(e.target.value)}
                        placeholder="Ej: 94810238 / Captura enviada por WhatsApp"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resumen & Botón de Confirmación */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-300">
                  Resumen: <strong>{selectedService.name}</strong> con <strong>{selectedSpecialist.name}</strong>
                </div>
                <div className="text-sm font-bold mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-purple-300 font-mono">
                    Fecha: {selectedDate} a las {selectedTime}
                  </span>
                  {paymentModality === "ABONO_PREVIO" ? (
                    <span className="text-amber-300 font-mono text-xs bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Anticipo: ${(selectedService.price / 2).toFixed(2)} (Saldo en recepción: ${(selectedService.price / 2).toFixed(2)})
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-mono">
                      • Total en recepción: ${selectedService.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <span>Agendando...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {paymentModality === "ABONO_PREVIO"
                        ? "Confirmar Turno y Enviar Comprobante"
                        : "Confirmar Turno por WhatsApp"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

            {/* Pie de Página Comercial Ecosistema Ubícame & Ubícame.info */}
            <BusinessCompactFooter
              businessName={business.name}
              slug={business.slug}
              ubicameUrl={business.ubicameUrl}
              vertical="citas"
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
            style={{ color: currentTab === "profile" ? (business.themeColor || "#9333ea") : "#94a3b8" }}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Inicio</span>
          </button>

          {/* Tab 2: Agendar Turno */}
          <button
            onClick={() => {
              setCurrentTab("citas");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "citas" ? (business.themeColor || "#9333ea") : "#94a3b8" }}
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Turnos</span>
          </button>

          {/* Tab 3: Especialistas */}
          <button
            onClick={() => {
              setCurrentTab("citas");
              setTimeout(() => {
                if (typeof window !== "undefined") window.scrollTo({ top: 250, behavior: "smooth" });
              }, 50);
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition duration-200 active:scale-95"
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Equipo</span>
          </button>

          {/* Tab 4: WhatsApp Directo */}
          {(() => {
            const rawPhone = (business.whatsappNumber || business.whatsapp || "").toString();
            let cleanPhone = rawPhone.replace(/\D/g, "");
            if (!cleanPhone.startsWith("593") && cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
            else if (!cleanPhone.startsWith("593") && cleanPhone.length === 9) cleanPhone = "593" + cleanPhone;
            return (
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${business.name}, quisiera consultar sobre disponibilidad de turnos.`)}`}
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
        phone={business.whatsappNumber || business.whatsapp}
        businessName={business.name}
        customMessage={`¡Hola! Quisiera consultar sobre disponibilidad de turnos en *${business.name}*.`}
      />
    </div>
  );
}
