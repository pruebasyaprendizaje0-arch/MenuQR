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
} from "lucide-react";
import { BusinessProfileView } from "@/components/public/BusinessProfileView";
import { SmartExitButton } from "@/components/public/SmartExitButton";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";

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

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName.trim() || !patientPhone.trim()) {
      alert("Por favor completa tu nombre y teléfono celular.");
      return;
    }

    setIsSubmitting(true);

    try {
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
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok && data.whatsapp_url) {
        setConfirmed(true);
        fetchAvailability(selectedDate, selectedSpecialist.id, selectedSpecialist.name);
        window.open(data.whatsapp_url, "_blank");
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
            <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-purple-500/50 bg-slate-900 shrink-0">
              <Image src={business.logoUrl} alt={business.name} fill className="object-cover" />
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
            {/* Banner Superior & Perfil */}
            <div className="relative h-48 sm:h-64 w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
              <Image
                src={business.coverUrl}
                alt={business.name}
                fill
                className="object-cover opacity-35 blur-xs"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"></div>

              <div className="absolute bottom-4 left-4 right-4 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-purple-500 shadow-xl bg-slate-900 shrink-0">
                    <Image src={business.logoUrl} alt={business.name} fill className="object-cover" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Agenda Online 24/7
                      </span>
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {business.rating}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {business.name}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-400" />
                      {business.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>{business.openingHours}</span>
                  </span>
                </div>
              </div>
            </div>

        {confirmed ? (
          <div className="max-w-xl mx-auto p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">¡Turno Solicitado con Éxito!</h2>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Servicio:</span>
                <span className="font-bold text-white">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Especialista:</span>
                <span className="font-bold text-purple-400">{selectedSpecialist.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fecha y Hora:</span>
                <span className="font-bold text-white">{selectedDate} a las {selectedTime}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-300">Valor referencial:</span>
                <span className="text-purple-400">${selectedService.price.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Se ha abierto WhatsApp para que confirmes la cita con el consultorio o barbería.
            </p>
            <button
              onClick={() => setConfirmed(false)}
              className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition"
            >
              Agendar Otra Cita
            </button>
          </div>
        ) : (
          <form onSubmit={handleBookAppointment} className="space-y-8">
            {/* Paso 1: Selector de Servicio */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h3 className="text-base font-bold text-white">Selecciona el Servicio o Tratamiento</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {business.services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      selectedService.id === srv.id
                        ? "bg-purple-500/10 border-purple-500 text-white shadow-lg shadow-purple-500/10"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-purple-400">
                          {srv.durationMin} min
                        </span>
                        <span className="text-sm font-black text-white">
                          ${srv.price.toFixed(2)}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold mb-1 leading-snug">{srv.name}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {srv.description}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Seleccionar</span>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                  </div>
                ))}
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
                      {spec.imageUrl ? (
                        <Image src={spec.imageUrl} alt={spec.name} fill className="object-cover" />
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

            {/* Paso 3: Fecha y Horario */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="text-base font-bold text-white">Selecciona Fecha y Franja Horaria</h3>
              </div>

              {/* Tira de Fechas */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Días Disponibles
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {availableDates.map((item) => (
                    <button
                      key={item.fullDate}
                      type="button"
                      onClick={() => setSelectedDate(item.fullDate)}
                      className={`min-w-[70px] py-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                        selectedDate === item.fullDate
                          ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30 scale-105"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider">{item.dayName}</span>
                      <span className="text-lg font-black">{item.dayNumber}</span>
                      <span className="text-[9px] uppercase font-semibold opacity-70">{item.monthName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Franjas Horarias */}
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    Horarios para el {selectedDate}
                    {loadingAvailability && (
                      <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    )}
                  </label>
                  {occupiedSlots.length > 0 && (
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      {occupiedSlots.length} turno{occupiedSlots.length > 1 ? "s" : ""} no disponible{occupiedSlots.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
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
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              isOccupied
                                ? "bg-slate-900/40 border border-red-500/20 text-slate-600 line-through cursor-not-allowed opacity-50"
                                : selectedTime === slot
                                ? "bg-purple-500 text-white shadow-md shadow-purple-500/20 scale-105"
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
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              isOccupied
                                ? "bg-slate-900/40 border border-red-500/20 text-slate-600 line-through cursor-not-allowed opacity-50"
                                : selectedTime === slot
                                ? "bg-purple-500 text-white shadow-md shadow-purple-500/20 scale-105"
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
                </div>
            </div>

            {/* Paso 4: Datos del Paciente / Cliente */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">
                  4
                </span>
                <h3 className="text-base font-bold text-white">Tus Datos de Contacto</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Nombre y Apellido *
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
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Número de WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="Ej: 0991234567"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
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

            {/* Botón de Confirmación */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-300">
                  Resumen: <strong>{selectedService.name}</strong> con <strong>{selectedSpecialist.name}</strong>
                </div>
                <div className="text-sm text-purple-400 font-bold mt-0.5">
                  Fecha: {selectedDate} a las {selectedTime} • Total: ${selectedService.price.toFixed(2)}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Agendando...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirmar Turno por WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
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
