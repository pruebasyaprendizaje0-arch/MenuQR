"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Calendar as CalendarIcon,
  Users,
  MapPin,
  Star,
  CheckCircle2,
  Check,
  Send,
  Coffee,
  Flame,
  Trees,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Plus,
  Minus,
  Store,
  BedDouble,
} from "lucide-react";
import { BusinessProfileView } from "@/components/public/BusinessProfileView";
import { BusinessCompactFooter } from "@/components/footer/BusinessCompactFooter";
import { SmartLogo } from "@/components/SmartImage";
import { SmartExitButton } from "@/components/public/SmartExitButton";
import { FloatingWhatsAppButton } from "@/components/public/FloatingWhatsAppButton";

interface Accommodation {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  maxGuests?: number | null;
  beds?: string | null;
  imageUrl?: string | null;
}

interface ExtraItem {
  id: string;
  name: string;
  price: number;
  perPerson: boolean;
}

interface PropertyData {
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
  amenities: string[];
  accommodations: Accommodation[];
  availableExtras: ExtraItem[];
  showBedsBadge?: boolean;
  showGuestsBadge?: boolean;
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

export function ReservasClient({ property }: { property: PropertyData }) {
  const [currentTab, setCurrentTab] = useState<"profile" | "reservar">("profile");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      if (hash === "#reservar" || params.get("tab") === "reservar") {
        setCurrentTab("reservar");
      }
    }
  }, []);
  // Fechas predeterminadas: mañana y pasado mañana
  const defaultCheckIn = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const defaultCheckOut = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  }, []);

  const [checkIn, setCheckIn] = useState<string>(defaultCheckIn);
  const [checkOut, setCheckOut] = useState<string>(defaultCheckOut);

  // Huéspedes
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);

  // Alojamiento seleccionado
  const [selectedRoom, setSelectedRoom] = useState<Accommodation>(
    property.accommodations[0] || {
      id: "default-room",
      name: "Cabaña Estándar",
      description: "",
      pricePerNight: 80,
      maxGuests: 4,
      beds: "1 Cama King",
      imageUrl: "",
    }
  );

  // Extras seleccionados
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Datos del titular
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [arrivalTime, setArrivalTime] = useState<string>("15:00");
  const [specialRequests, setSpecialRequests] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [booked, setBooked] = useState<boolean>(false);

  // Cálculo dinámico de noches
  const nightsCount = useMemo(() => {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const diffTime = outDate.getTime() - inDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }, [checkIn, checkOut]);

  // Cálculo de extras
  const extrasTotal = useMemo(() => {
    let total = 0;
    property.availableExtras.forEach((ext) => {
      if (selectedExtras.includes(ext.id)) {
        if (ext.perPerson) {
          total += ext.price * (adults + children) * nightsCount;
        } else {
          total += ext.price;
        }
      }
    });
    return total;
  }, [selectedExtras, property.availableExtras, adults, children, nightsCount]);

  // Subtotal alojamiento
  const roomSubtotal = selectedRoom.pricePerNight * nightsCount;
  const grandTotal = roomSubtotal + extrasTotal;

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim() || !guestPhone.trim()) {
      alert("Por favor completa tu nombre y número de WhatsApp.");
      return;
    }

    setIsSubmitting(true);

    try {
      const chosenExtrasList = property.availableExtras
        .filter((e) => selectedExtras.includes(e.id))
        .map((e) => ({ nombre: e.name, precio: e.price }));

      const payload = {
        vertical: "reservas",
        negocio_id: property.id,
        slug: property.slug,
        cliente_nombre: guestName,
        cliente_telefono: guestPhone,
        check_in: checkIn,
        check_out: checkOut,
        noches: nightsCount,
        huespedes_adultos: adults,
        huespedes_ninos: children,
        tipo_habitacion: selectedRoom.name,
        extras: chosenExtrasList,
        total_reserva: grandTotal,
        hora_llegada_estimada: arrivalTime,
        notas_entrega: specialRequests,
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok && data.whatsapp_url) {
        setBooked(true);
        window.open(data.whatsapp_url, "_blank");
      } else {
        alert("No se pudo completar la solicitud de reserva. Por favor intenta de nuevo.");
      }
    } catch (err) {
      console.error("Error booking lodging:", err);
      alert("Error de conexión al procesar la reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 pb-28 md:pb-12">
      {/* Top Bar with Dynamic Tabs */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-white/10 py-2.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-emerald-500/50 bg-slate-900 shrink-0">
              <Image src={property.logoUrl} alt={property.name} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">Hospedaje & Cabañas</span>
              <h2 className="text-xs sm:text-sm font-black text-white leading-tight truncate">{property.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex p-1 bg-slate-900/90 border border-white/10 rounded-2xl gap-1 w-full sm:w-auto shadow-lg">
              <button
                type="button"
                onClick={() => setCurrentTab("profile")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "profile"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>Perfil Comercial</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab("reservar")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  currentTab === "reservar"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Trees className="h-3.5 w-3.5" />
                <span>Reservar Estadía</span>
              </button>
            </div>

            <SmartExitButton fallbackUrl="/reservas" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {currentTab === "profile" ? (
          <BusinessProfileView
            {...property}
            galleryTitle="Instalaciones & Entorno de la Propiedad"
            galleryBadge="🏡 Cabañas & Espacios"
            actionTabTitle="Reservar Estadía"
            actionTabIcon={<Trees className="h-4.5 w-4.5 shrink-0" />}
            onSelectActionTab={() => setCurrentTab("reservar")}
            verticalBadge="Hospedaje & Cabañas"
          />
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Banner Superior & Propiedad en Motor de Reservas */}
            <div className="relative h-48 sm:h-64 w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
              {property.coverUrl && property.coverUrl.trim() !== "" ? (
                <img
                  src={property.coverUrl}
                  alt={property.name}
                  className="w-full h-full object-cover opacity-40 blur-xs"
                />
              ) : (
                <div 
                  className="w-full h-full opacity-30 bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950"
                  style={{ backgroundColor: property.themeColor ? `${property.themeColor}33` : undefined }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"></div>

              <div className="absolute bottom-4 left-4 right-4 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl bg-slate-900 shrink-0">
                    <SmartLogo
                      src={property.logoUrl}
                      alt={property.name}
                      name={property.name}
                      themeColor={property.themeColor}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Trees className="w-3 h-3" />
                        Hospedaje & Naturaleza
                      </span>
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {property.rating}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {property.name}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {property.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Amenidades de la Propiedad */}
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((am, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-medium"
                >
                  {am}
                </span>
              ))}
            </div>

        {booked ? (
          <div className="max-w-xl mx-auto p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">¡Solicitud de Reserva Registrada!</h2>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Alojamiento:</span>
                <span className="font-bold text-white">{selectedRoom.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fechas:</span>
                <span className="font-bold text-emerald-400">{checkIn} al {checkOut} ({nightsCount} noches)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Huéspedes:</span>
                <span className="font-bold text-white">{adults} Adulto(s){children > 0 ? `, ${children} Niño(s)` : ""}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-300">TOTAL ESTIMADO:</span>
                <span className="text-emerald-400 text-sm">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Se ha abierto WhatsApp con los detalles de tu estancia para acordar el abono o garantía de la cabaña.
            </p>
            <button
              onClick={() => setBooked(false)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-bold text-xs hover:bg-emerald-500 transition"
            >
              Hacer Otra Consulta
            </button>
          </div>
        ) : (
          <form onSubmit={handleBook} className="space-y-8">
            {/* Paso 1: Buscador de Fechas y Huéspedes */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  1
                </span>
                <h3 className="text-base font-bold text-white">Elige Fechas de Estancia y Huéspedes</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Fecha de Check-in
                  </label>
                  <input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Fecha de Check-out
                  </label>
                  <input
                    type="date"
                    required
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Adultos (Mayores de 12)
                  </label>
                  <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAdults((a) => Math.max(1, a - 1))}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-white">{adults} Adulto(s)</span>
                    <button
                      type="button"
                      onClick={() => setAdults((a) => a + 1)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Niños (0 a 11 años)
                  </label>
                  <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setChildren((c) => Math.max(0, c - 1))}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-white">{children} Niño(s)</span>
                    <button
                      type="button"
                      onClick={() => setChildren((c) => c + 1)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Duración calculada: <strong className="text-emerald-400">{nightsCount} noche(s)</strong></span>
                <span>Capacidad total: <strong className="text-white">{adults + children} personas</strong></span>
              </div>
            </div>

            {/* Paso 2: Selector de Alojamiento / Cabaña */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h3 className="text-base font-bold text-white">Selecciona tu Cabaña o Habitación</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {property.accommodations.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`rounded-2xl border overflow-hidden cursor-pointer transition flex flex-col justify-between ${
                      selectedRoom.id === room.id
                        ? "bg-emerald-500/10 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-102"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                        {room.imageUrl ? (
                          <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 gap-1.5 p-4 text-center">
                            <BedDouble className="w-8 h-8 text-emerald-500/40" />
                            <span className="text-[11px] font-bold text-slate-400">{room.name}</span>
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur border border-slate-700 text-emerald-400 font-black text-xs">
                          ${room.pricePerNight.toFixed(2)} / noche
                        </span>
                      </div>

                      <div className="p-4">
                        <h4 className="text-sm font-bold text-white mb-1">{room.name}</h4>
                        {room.description && (
                          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed line-clamp-2">
                            {room.description}
                          </p>
                        )}
                        {((property.showBedsBadge !== false && room.beds) ||
                          (property.showGuestsBadge !== false && room.maxGuests && room.maxGuests > 0)) && (
                          <div className="text-[10px] text-slate-400 space-y-1">
                            {property.showBedsBadge !== false && room.beds && <div>🛏️ {room.beds}</div>}
                            {property.showGuestsBadge !== false && room.maxGuests && room.maxGuests > 0 && (
                              <div>👥 Hasta {room.maxGuests} huéspedes</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        type="button"
                        className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          selectedRoom.id === room.id
                            ? "bg-emerald-500 text-slate-950 shadow"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {selectedRoom.id === room.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Seleccionada</span>
                          </>
                        ) : (
                          <span>Elegir esta Cabaña</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paso 3: Servicios Adicionales */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  3
                </span>
                <h3 className="text-base font-bold text-white">Servicios Adicionales & Experiencias (Opcional)</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {property.availableExtras.map((extra) => {
                  const isChecked = selectedExtras.includes(extra.id);
                  return (
                    <div
                      key={extra.id}
                      onClick={() => toggleExtra(extra.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-500 text-slate-950"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold">{extra.name}</h5>
                          <span className="text-[10px] text-slate-400">
                            {extra.perPerson ? "Por persona / día" : "Por estadía"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400">
                        +${extra.price.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Paso 4: Datos del Titular y Checkout */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  4
                </span>
                <h3 className="text-base font-bold text-white">Datos del Titular de la Reserva</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ej: Marcelo Cárdenas"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Número de WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Ej: 0987654321"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Hora estimada de Check-in
                  </label>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Requerimientos especiales (Opcional)
                </label>
                <input
                  type="text"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Ej: Viajamos con mascota pequeña / Celebración de aniversario"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Resumen Final de Reserva & Botón */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-xs">
                <div className="text-slate-300">
                  Reserva en: <strong>{selectedRoom.name}</strong> • {nightsCount} noche(s) ({checkIn} al {checkOut})
                </div>
                <div className="text-slate-400">
                  Alojamiento: ${roomSubtotal.toFixed(2)} {extrasTotal > 0 ? `+ Extras: $${extrasTotal.toFixed(2)}` : ""}
                </div>
                <div className="text-lg font-black text-emerald-400">
                  TOTAL APROXIMADO: ${grandTotal.toFixed(2)}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Registrando reserva...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-slate-950" />
                    <span>Confirmar Reserva por WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Pie de Página Comercial Ecosistema Ubícame & Ubícame.info */}
        <BusinessCompactFooter
          businessName={property.name}
          slug={property.slug}
          ubicameUrl={property.ubicameUrl}
          vertical="reservas"
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
            style={{ color: currentTab === "profile" ? (property.themeColor || "#10b981") : "#94a3b8" }}
          >
            <Store className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Inicio</span>
          </button>

          {/* Tab 2: Cabañas / Habitaciones */}
          <button
            onClick={() => {
              setCurrentTab("reservar");
              setTimeout(() => {
                if (typeof window !== "undefined") window.scrollTo({ top: 320, behavior: "smooth" });
              }, 50);
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition duration-200 active:scale-95"
            style={{ color: currentTab === "reservar" ? (property.themeColor || "#10b981") : "#94a3b8" }}
          >
            <BedDouble className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Cabañas</span>
          </button>

          {/* Tab 3: Fechas / Reservar */}
          <button
            onClick={() => {
              setCurrentTab("reservar");
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition duration-200 active:scale-95"
          >
            <CalendarIcon className="h-5 w-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Fechas</span>
          </button>

          {/* Tab 4: WhatsApp Directo */}
          {(() => {
            const rawPhone = (property.whatsappNumber || property.whatsapp || "").toString();
            let cleanPhone = rawPhone.replace(/\D/g, "");
            if (!cleanPhone.startsWith("593") && cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
            else if (!cleanPhone.startsWith("593") && cleanPhone.length === 9) cleanPhone = "593" + cleanPhone;
            return (
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${property.name}, quisiera consultar disponibilidad para reservar una estadía.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-emerald-400 hover:text-emerald-300 transition duration-200 active:scale-95"
              >
                <Trees className="h-5 w-5" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">WhatsApp</span>
              </a>
            );
          })()}
        </div>
      </div>

      {/* Floating WhatsApp Action Button */}
      <FloatingWhatsAppButton
        phone={property.whatsappNumber || property.whatsapp}
        businessName={property.name}
        customMessage={`¡Hola! Quisiera consultar disponibilidad para reservar una estadía en *${property.name}*.`}
      />
    </div>
  );
}
