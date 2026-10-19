"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  User,
  Phone,
  MessageSquare,
  Search,
  Filter,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Save,
  Trees,
  BedDouble,
  DollarSign,
  MapPin,
  Sparkles,
  Users,
  Compass,
  Coffee,
  Flame,
  Check,
  X,
  Send,
  Sliders,
  Edit2,
  Eye,
  EyeOff,
  Camera,
  Image as ImageIcon,
} from "lucide-react";

interface CabanaItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryName: string;
  beds: string | null;
  maxGuests: number | null;
}

interface ReservaItem {
  id: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono: string;
  total: number;
  created_at: string;
  check_in: string;
  check_out: string;
  noches: number;
  huespedes_adultos: number;
  huespedes_ninos: number;
  tipo_habitacion: string;
  hora_llegada_estimada: string;
  extras: Array<{ nombre?: string; name?: string; precio?: number; price?: number }>;
  notas_hospedaje: string;
  items: Array<any>;
}

interface LodgingExtra {
  id: string;
  name: string;
  price: number;
  perPerson: boolean;
}

interface ReservasAdminTabProps {
  restaurant: any;
  onNavigateToDishes?: () => void;
}

const COMMON_AMENITY_PRESETS = [
  "📶 WiFi de Alta Velocidad",
  "🔥 Chimenea / Fogata a Leña",
  "🛁 Jacuzzi Privado",
  "🚗 Parqueadero Gratuito",
  "🐾 Pet Friendly",
  "☕ Desayuno Campestre",
  "🌿 Senderos Ecológicos Privados",
  "💧 Agua Caliente a Presión",
  "🏊‍♂️ Piscina Climatizada",
  "🍖 Zona de BBQ / Asados",
  "🍳 Cocina Equipada",
  "🏔️ Vista Panorámica a la Montaña",
];

export default function ReservasAdminTab({ restaurant, onNavigateToDishes }: ReservasAdminTabProps) {
  const [subTab, setSubTab] = useState<"reservas" | "amenities" | "extras" | "cabanas" | "galeria">("reservas");
  const [galleryImages, setGalleryImages] = useState<string[]>(["", "", "", ""]);
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Métricas
  const [metricas, setMetricas] = useState({
    totalReservas: 0,
    totalNoches: 0,
    totalHuespedes: 0,
    totalIngresos: 0,
    pendientes: 0,
    confirmadas: 0,
    hospedados: 0,
    finalizadas: 0,
    canceladas: 0,
  });

  // Configuración de Hospedaje (Amenities, Extras, Insignias)
  const [amenities, setAmenities] = useState<string[]>([]);
  const [extras, setExtras] = useState<LodgingExtra[]>([]);
  const [newAmenityText, setNewAmenityText] = useState<string>("");
  const [checkInTime, setCheckInTime] = useState<string>("14:00");
  const [checkOutTime, setCheckOutTime] = useState<string>("12:00");
  const [showBedsBadge, setShowBedsBadge] = useState<boolean>(true);
  const [showGuestsBadge, setShowGuestsBadge] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Gestión de Cabañas / Habitaciones
  const [cabanas, setCabanas] = useState<CabanaItem[]>([]);
  const [isLoadingCabanas, setIsLoadingCabanas] = useState<boolean>(false);
  const [editingCabana, setEditingCabana] = useState<CabanaItem | null>(null);
  const [editCabanaName, setEditCabanaName] = useState<string>("");
  const [editCabanaPrice, setEditCabanaPrice] = useState<string>("");
  const [editCabanaBeds, setEditCabanaBeds] = useState<string>("");
  const [editCabanaGuests, setEditCabanaGuests] = useState<string>("");
  const [isSavingCabana, setIsSavingCabana] = useState<boolean>(false);

  // Modal Nuevo Extra
  const [showNewExtraModal, setShowNewExtraModal] = useState<boolean>(false);
  const [extraName, setExtraName] = useState<string>("");
  const [extraPrice, setExtraPrice] = useState<string>("");
  const [extraPerPerson, setExtraPerPerson] = useState<boolean>(false);

  // Modal Nueva Reserva Manual
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualName, setManualName] = useState<string>("");
  const [manualPhone, setManualPhone] = useState<string>("");
  const [manualCheckIn, setManualCheckIn] = useState<string>("");
  const [manualCheckOut, setManualCheckOut] = useState<string>("");
  const [manualNights, setManualNights] = useState<number>(1);
  const [manualAdults, setManualAdults] = useState<number>(2);
  const [manualChildren, setManualChildren] = useState<number>(0);
  const [manualRoom, setManualRoom] = useState<string>("Cabaña Principal");
  const [manualTotal, setManualTotal] = useState<string>("80.00");
  const [manualNotes, setManualNotes] = useState<string>("");
  const [isCreatingManual, setIsCreatingManual] = useState<boolean>(false);

  // Cargar reservas
  const fetchReservas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/reservas?negocio_id=${restaurant.id}`);
      const data = await res.json();

      if (data.ok) {
        setReservas(data.reservas || []);
        if (data.metricas) {
          setMetricas(data.metricas);
        }
      } else {
        setError(data.error || "No se pudieron cargar las reservas.");
      }
    } catch (err: any) {
      console.error("[ReservasAdminTab] Error al cargar reservas:", err);
      setError("Error de conexión al cargar la agenda de hospedaje.");
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar configuración de hospedaje
  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/reservas/config?negocio_id=${restaurant.id}`);
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.amenities)) setAmenities(data.amenities);
        if (Array.isArray(data.availableExtras)) setExtras(data.availableExtras);
        if (data.checkInTime) setCheckInTime(data.checkInTime);
        if (data.checkOutTime) setCheckOutTime(data.checkOutTime);
        if (data.showBedsBadge !== undefined) setShowBedsBadge(Boolean(data.showBedsBadge));
        if (data.showGuestsBadge !== undefined) setShowGuestsBadge(Boolean(data.showGuestsBadge));
        if (Array.isArray(data.galleryImages)) {
          const loaded = data.galleryImages.slice(0, 4);
          while (loaded.length < 4) loaded.push("");
          setGalleryImages(loaded);
        }
      }
    } catch (err) {
      console.error("[ReservasAdminTab] Error al cargar configuración:", err);
    }
  };

  // Cargar Cabañas y Alojamiento
  const fetchCabanas = async () => {
    try {
      setIsLoadingCabanas(true);
      const res = await fetch(`/api/reservas/cabanas?negocio_id=${restaurant.id}`);
      const data = await res.json();
      if (data.ok) {
        setCabanas(data.cabanas || []);
      }
    } catch (err) {
      console.error("[ReservasAdminTab] Error al cargar cabañas:", err);
    } finally {
      setIsLoadingCabanas(false);
    }
  };

  const handleOpenEditCabana = (cab: CabanaItem) => {
    setEditingCabana(cab);
    setEditCabanaName(cab.name);
    setEditCabanaPrice(cab.price.toString());
    setEditCabanaBeds(cab.beds || "");
    setEditCabanaGuests(cab.maxGuests ? cab.maxGuests.toString() : "");
  };

  const handleSaveCabana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCabana) return;

    setIsSavingCabana(true);
    try {
      const res = await fetch("/api/reservas/cabanas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_id: editingCabana.id,
          name: editCabanaName,
          price: parseFloat(editCabanaPrice) || editingCabana.price,
          beds: editCabanaBeds.trim(),
          maxGuests: editCabanaGuests.trim() ? parseInt(editCabanaGuests, 10) : 0,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setEditingCabana(null);
        fetchCabanas();
      } else {
        alert(data.error || "Error al actualizar cabaña");
      }
    } catch (err) {
      console.error("Error al guardar cabaña:", err);
      alert("Error de conexión al guardar cambios.");
    } finally {
      setIsSavingCabana(false);
    }
  };

  const handleQuickRemoveBadges = async (cabanaId: string) => {
    if (!confirm("¿Deseas quitar las insignias de camas y huéspedes de esta cabaña? No se mostrarán en la tarjeta pública.")) return;
    try {
      const res = await fetch("/api/reservas/cabanas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_id: cabanaId,
          beds: "",
          maxGuests: 0,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchCabanas();
      } else {
        alert(data.error || "Error al quitar insignias");
      }
    } catch (err) {
      console.error("Error al quitar insignias:", err);
    }
  };

  useEffect(() => {
    fetchReservas();
    fetchConfig();
    fetchCabanas();
  }, [restaurant.id]);

  // Guardar configuración (amenities, extras e insignias)
  const handleSaveConfig = async () => {
    try {
      setIsSavingConfig(true);
      setConfigSuccessMsg(null);

      const res = await fetch("/api/reservas/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: restaurant.id,
          amenities,
          availableExtras: extras,
          checkInTime,
          checkOutTime,
          showBedsBadge,
          showGuestsBadge,
          galleryImages: galleryImages.filter((img) => typeof img === "string" && img.trim().length > 0).slice(0, 4),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setConfigSuccessMsg("¡Configuración de hospedaje guardada correctamente!");
        setTimeout(() => setConfigSuccessMsg(null), 4000);
      } else {
        alert(data.error || "Error al guardar la configuración.");
      }
    } catch (err) {
      console.error("Error al guardar config de reservas:", err);
      alert("Error de conexión al guardar.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Cambiar estado de una reserva
  const handleUpdateEstado = async (reservaId: string, nuevoEstado: string) => {
    try {
      const res = await fetch(`/api/reservas/${reservaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchReservas();
      } else {
        alert(data.error || "Error al cambiar estado.");
      }
    } catch (err) {
      console.error("Error actualizando estado:", err);
    }
  };

  // Cancelar reserva
  const handleCancelarReserva = async (reservaId: string) => {
    if (!confirm("¿Seguro que deseas cancelar esta reserva de estadía?")) return;
    try {
      const res = await fetch(`/api/reservas/${reservaId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        fetchReservas();
      } else {
        alert(data.error || "Error al cancelar la reserva.");
      }
    } catch (err) {
      console.error("Error cancelando reserva:", err);
    }
  };

  // Crear reserva manual
  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualCheckIn || !manualCheckOut) {
      alert("Por favor completa el nombre del huésped y las fechas de check-in / check-out.");
      return;
    }

    setIsCreatingManual(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: restaurant.id,
          cliente_nombre: manualName,
          cliente_telefono: manualPhone,
          check_in: manualCheckIn,
          check_out: manualCheckOut,
          noches: manualNights,
          huespedes_adultos: manualAdults,
          huespedes_ninos: manualChildren,
          tipo_habitacion: manualRoom,
          total: parseFloat(manualTotal) || 0,
          notas_hospedaje: manualNotes,
          estado: "confirmado",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShowManualModal(false);
        setManualName("");
        setManualPhone("");
        setManualNotes("");
        fetchReservas();
      } else {
        alert(data.error || "Error al registrar la reserva manual.");
      }
    } catch (err) {
      console.error("Error creando reserva manual:", err);
      alert("Error al procesar la reserva manual.");
    } finally {
      setIsCreatingManual(false);
    }
  };

  // Agregar comodidad
  const handleAddAmenity = (textToAdd?: string) => {
    const text = (textToAdd || newAmenityText).trim();
    if (!text) return;
    if (amenities.includes(text)) {
      alert("Esta comodidad ya está en la lista.");
      return;
    }
    setAmenities([...amenities, text]);
    setNewAmenityText("");
  };

  // Eliminar comodidad
  const handleRemoveAmenity = (indexToRemove: number) => {
    setAmenities(amenities.filter((_, idx) => idx !== indexToRemove));
  };

  // Agregar extra
  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraName.trim() || !extraPrice) {
      alert("Ingresa el nombre y precio del servicio extra.");
      return;
    }
    const newExt: LodgingExtra = {
      id: `ext-${Date.now()}`,
      name: extraName.trim(),
      price: parseFloat(extraPrice) || 0,
      perPerson: extraPerPerson,
    };
    setExtras([...extras, newExt]);
    setExtraName("");
    setExtraPrice("");
    setExtraPerPerson(false);
    setShowNewExtraModal(false);
  };

  // Eliminar extra
  const handleRemoveExtra = (idToRemove: string) => {
    setExtras(extras.filter((e) => e.id !== idToRemove));
  };

  // 1-Click WhatsApp: Confirmar & Enviar Datos Bancarios
  const handleWhatsAppConfirmar = (reserva: ReservaItem) => {
    if (!reserva.cliente_telefono) {
      alert("Esta reserva no tiene número de teléfono registrado.");
      return;
    }
    let phoneClean = reserva.cliente_telefono.replace(/\D/g, "");
    if (phoneClean.startsWith("09") && phoneClean.length === 10) {
      phoneClean = "593" + phoneClean.slice(1);
    }

    const bancoInfo = restaurant.bankName 
      ? `\n*Datos para Depósito / Transferencia:*\n- Banco: ${restaurant.bankName}\n- Tipo: ${restaurant.bankAccountType || "Corriente"}\n- Cta: ${restaurant.bankAccountNumber || ""}\n- Titular: ${restaurant.bankAccountName || restaurant.name}\n- CI/RUC: ${restaurant.bankAccountDocument || ""}\n`
      : "";

    const mensaje = `Hola *${reserva.cliente_nombre}*, ¡te saludamos de *${restaurant.name}*! 🏡✨\n\n` +
      `Confirmamos tu solicitud de reserva para:\n` +
      `• *Alojamiento:* ${reserva.tipo_habitacion}\n` +
      `• *Check-in:* ${reserva.check_in} (desde las ${checkInTime})\n` +
      `• *Check-out:* ${reserva.check_out} (hasta las ${checkOutTime})\n` +
      `• *Estadía:* ${reserva.noches} noche(s) para ${reserva.huespedes_adultos} adulto(s)` + (reserva.huespedes_ninos > 0 ? ` y ${reserva.huespedes_ninos} niño(s)` : "") + `\n` +
      `• *Total Estadía:* $${reserva.total.toFixed(2)}\n` +
      bancoInfo +
      `\n_Por favor envíanos la foto del comprobante para asegurar tu fecha. ¡Será un gusto recibirte!_ 🌄`;

    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  // 1-Click WhatsApp: Enviar Ubicación & Guía de Llegada
  const handleWhatsAppUbicacion = (reserva: ReservaItem) => {
    if (!reserva.cliente_telefono) {
      alert("Esta reserva no tiene número de teléfono registrado.");
      return;
    }
    let phoneClean = reserva.cliente_telefono.replace(/\D/g, "");
    if (phoneClean.startsWith("09") && phoneClean.length === 10) {
      phoneClean = "593" + phoneClean.slice(1);
    }

    const mapLink = restaurant.googleBusinessUrl || restaurant.mapEmbedUrl || "";
    const mensaje = `Hola *${reserva.cliente_nombre}*, te compartimos las indicaciones para tu llegada a *${restaurant.name}* 📍:\n\n` +
      `• *Dirección:* ${restaurant.address || restaurant.locality || "Sector Turístico"}\n` +
      (mapLink ? `• *Ubicación GPS:* ${mapLink}\n` : "") +
      `• *Hora de Check-in:* a partir de las ${checkInTime}\n` +
      `• *Contacto recepción:* ${restaurant.whatsapp || ""}\n\n` +
      `¡Buen viaje y nos vemos pronto! 🚗🌿`;

    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  // Filtrado de reservas
  const filteredReservas = useMemo(() => {
    return reservas.filter((r) => {
      if (filterEstado !== "todos" && r.estado !== filterEstado) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.cliente_nombre.toLowerCase().includes(q);
        const matchesPhone = r.cliente_telefono.includes(q);
        const matchesRoom = r.tipo_habitacion.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesRoom;
      }
      return true;
    });
  }, [reservas, filterEstado, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Banner Principal de Hospedaje */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Trees className="w-64 h-64 text-emerald-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Trees className="w-3.5 h-3.5" /> Motor de Reservas & Hospedaje Directo
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Gestión de Cabañas, Domos & Huéspedes
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Recibe solicitudes directas de estadía con check-in y check-out sin comisiones, gestiona abonos bancarios y confirma a tus huéspedes con un solo clic por WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={`/reservas/${restaurant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs flex items-center gap-2 transition shadow-lg"
            >
              <span>Ver Motor Público</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Reserva Manual</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Total Reservas</span>
              <CalendarDays className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{metricas.totalReservas}</div>
            <div className="text-[11px] text-emerald-400 font-medium mt-1">
              {metricas.pendientes} pendientes de abono
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Noches Reservadas</span>
              <BedDouble className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-400">{metricas.totalNoches}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Noches de ocupación
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Total Huéspedes</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{metricas.totalHuespedes}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Adultos y niños recibidos
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Ingresos Proyectados</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              ${metricas.totalIngresos.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Sin comisiones de plataformas
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navegación de Pestañas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setSubTab("reservas")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === "reservas"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Agenda & Huéspedes ({reservas.length})</span>
        </button>

        <button
          onClick={() => setSubTab("amenities")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === "amenities"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Comodidades / Amenities ({amenities.length})</span>
        </button>

        <button
          onClick={() => setSubTab("extras")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === "extras"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Coffee className="w-4 h-4 text-cyan-400" />
          <span>Servicios Extras & Tours ({extras.length})</span>
        </button>

        <button
          onClick={() => setSubTab("cabanas")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === "cabanas"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <BedDouble className="w-4 h-4 text-purple-400" />
          <span>Cabañas & Alojamientos</span>
        </button>

        <button
          onClick={() => setSubTab("galeria")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === "galeria"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-300" />
          <span>📸 Galería de Instalaciones (Máx. 4)</span>
        </button>
      </div>

      {/* =========================================================================
          SUB-TAB 1: AGENDA & RESERVAS
         ========================================================================= */}
      {subTab === "reservas" && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre de huésped, teléfono o cabaña..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Píldoras de Estado */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "todos", label: "Todas" },
                { id: "nuevo", label: "🟡 Pendientes" },
                { id: "confirmado", label: "🔵 Confirmadas" },
                { id: "hospedado", label: "🟢 Hospedados" },
                { id: "finalizado", label: "⚪ Finalizadas" },
                { id: "cancelado", label: "🔴 Canceladas" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilterEstado(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                    filterEstado === pill.id
                      ? "bg-emerald-500/20 border border-emerald-500 text-emerald-300"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchReservas}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition shrink-0"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Lista de Reservas */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
              Cargando reservas de hospedaje...
            </div>
          ) : filteredReservas.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <Trees className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-white font-bold text-base">No hay reservas registradas</div>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                Las solicitudes que tus huéspedes completen desde el motor público aparecerán aquí en tiempo real con 1-clic para confirmar abonos.
              </p>
              <button
                onClick={() => setShowManualModal(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Registrar Primera Reserva Manual
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReservas.map((reserva) => {
                const isPendiente = reserva.estado === "nuevo";
                const isConfirmado = reserva.estado === "confirmado";
                const isHospedado = reserva.estado === "hospedado";
                const isFinalizado = reserva.estado === "finalizado";
                const isCancelado = reserva.estado === "cancelado";

                return (
                  <div
                    key={reserva.id}
                    className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-xl transition-all ${
                      isPendiente
                        ? "border-amber-500/40 bg-amber-500/5"
                        : isConfirmado
                        ? "border-cyan-500/30"
                        : isHospedado
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800"
                    }`}
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-base">
                            {reserva.cliente_nombre}
                          </span>
                          {reserva.cliente_telefono && (
                            <span className="text-xs text-slate-400 font-mono">
                              ({reserva.cliente_telefono})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{reserva.tipo_habitacion}</span>
                        </div>
                      </div>

                      {/* Dropdown de Estado */}
                      <select
                        value={reserva.estado}
                        onChange={(e) => handleUpdateEstado(reserva.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none cursor-pointer ${
                          isPendiente
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : isConfirmado
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : isHospedado
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : isFinalizado
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-red-500/20 text-red-300 border-red-500/40"
                        }`}
                      >
                        <option value="nuevo">🟡 Pendiente de Abono</option>
                        <option value="confirmado">🔵 Confirmada (Abono OK)</option>
                        <option value="hospedado">🟢 En Hospedaje (Check-In)</option>
                        <option value="finalizado">⚪ Finalizada (Check-Out)</option>
                        <option value="cancelado">🔴 Cancelada</option>
                      </select>
                    </div>

                    {/* Detalles de Fechas y Huéspedes */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">
                          Check-In
                        </span>
                        <span className="text-white font-bold">{reserva.check_in || "No indicada"}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">
                          Check-Out
                        </span>
                        <span className="text-white font-bold">{reserva.check_out || "No indicada"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          {reserva.noches} noche(s)
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          {reserva.huespedes_adultos} ad. {reserva.huespedes_ninos > 0 ? `+ ${reserva.huespedes_ninos} niños` : ""}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] block uppercase font-bold">Total Estadía</span>
                        <span className="text-base font-black text-emerald-400">
                          ${reserva.total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Extras seleccionados */}
                    {reserva.extras && reserva.extras.length > 0 && (
                      <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/50 text-xs">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
                          Servicios Adicionales Solicitados:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {reserva.extras.map((ex, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]"
                            >
                              + {ex.nombre || ex.name || "Servicio extra"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notas o Requerimientos */}
                    {reserva.notas_hospedaje && (
                      <div className="text-xs text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 italic">
                        "{reserva.notas_hospedaje}"
                      </div>
                    )}

                    {/* Botonera de Acción 1-Click WhatsApp */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleWhatsAppConfirmar(reserva)}
                        className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Confirmar & Abono</span>
                      </button>

                      <button
                        onClick={() => handleWhatsAppUbicacion(reserva)}
                        className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>GPS & Llegada</span>
                      </button>

                      <button
                        onClick={() => handleCancelarReserva(reserva.id)}
                        className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 text-red-400 transition"
                        title="Cancelar reserva"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: COMODIDADES / AMENITIES
         ========================================================================= */}
      {subTab === "amenities" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Comodidades y Servicios Incluidos en el Hospedaje
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Estos sellos de comodidad se muestran en la cabecera del motor de reservas público para transmitir confianza y confort a los viajeros.
            </p>
          </div>

          {/* Formulario Agregar Comodidad */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newAmenityText}
              onChange={(e) => setNewAmenityText(e.target.value)}
              placeholder="Ej: 📶 WiFi Starlink de Alta Velocidad, 🛁 Jacuzzi Hidromasaje..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAmenity();
                }
              }}
            />
            <button
              onClick={() => handleAddAmenity()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Presets Sugeridos */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Sugerencias Rápidas:
            </span>
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITY_PRESETS.map((preset, idx) => {
                const isAlreadyAdded = amenities.includes(preset);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !isAlreadyAdded && handleAddAmenity(preset)}
                    disabled={isAlreadyAdded}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                      isAlreadyAdded
                        ? "bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed"
                        : "bg-slate-950/80 border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
                    }`}
                  >
                    <span>{preset}</span>
                    {isAlreadyAdded ? <Check className="w-3 h-3 text-slate-600" /> : <Plus className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Comodidades Activas */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <span className="text-xs font-bold text-white block">
              Comodidades Activas ({amenities.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {amenities.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
                >
                  <span>{item}</span>
                  <button
                    onClick={() => handleRemoveAmenity(index)}
                    className="hover:text-red-400 transition"
                    title="Eliminar comodidad"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Horarios Check-In / Check-Out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Hora Habitual de Check-In (Entrada)
              </label>
              <input
                type="text"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                placeholder="Ej: 14:00"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Hora Habitual de Check-Out (Salida)
              </label>
              <input
                type="text"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                placeholder="Ej: 12:00"
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Opciones de Visibilidad de Insignias en Tarjetas */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Visibilidad de Insignias en Tarjetas de Cabañas</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Controla si deseas mostrar u ocultar las etiquetas de camas y capacidad máxima en el motor de reservas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition ${
                showBedsBadge ? "bg-emerald-950/30 border-emerald-500/40 text-white" : "bg-slate-950/60 border-slate-800 text-slate-400"
              }`}>
                <input
                  type="checkbox"
                  checked={showBedsBadge}
                  onChange={(e) => setShowBedsBadge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-800 bg-slate-900 text-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>🛏️ Mostrar Detalle de Camas / Baño</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {showBedsBadge ? "✓ Visible en tarjetas públicas (si está configurado)" : "✕ Oculto en todas las tarjetas de cabañas"}
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition ${
                showGuestsBadge ? "bg-emerald-950/30 border-emerald-500/40 text-white" : "bg-slate-950/60 border-slate-800 text-slate-400"
              }`}>
                <input
                  type="checkbox"
                  checked={showGuestsBadge}
                  onChange={(e) => setShowGuestsBadge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-800 bg-slate-900 text-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>👥 Mostrar Capacidad de Huéspedes</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {showGuestsBadge ? "✓ Visible en tarjetas públicas (si está configurado)" : "✕ Oculto en todas las tarjetas de cabañas"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {configSuccessMsg ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {configSuccessMsg}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Los cambios se reflejarán inmediatamente en tu motor público.
              </span>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? "Guardando..." : "Guardar Comodidades"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: EXTRAS & EXPERIENCIAS OPCIONALES
         ========================================================================= */}
      {subTab === "extras" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Coffee className="w-5 h-5 text-cyan-400" />
                Servicios Adicionales, Experiencias & Extras
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Permite a tus huéspedes añadir leña para fogata, desayunos campestres, tours o sesiones de jacuzzi al momento de reservar.
              </p>
            </div>

            <button
              onClick={() => setShowNewExtraModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Extra</span>
            </button>
          </div>

          {/* Listado de Extras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extras.map((extra) => (
              <div
                key={extra.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md"
              >
                <div>
                  <div className="text-sm font-extrabold text-white">{extra.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <span className="text-emerald-400 font-bold">${extra.price.toFixed(2)}</span>{" "}
                    {extra.perPerson ? "(por persona / noche)" : "(tarifa fija total)"}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveExtra(extra.id)}
                  className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-red-400 transition"
                  title="Eliminar extra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Botón Guardar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {configSuccessMsg ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {configSuccessMsg}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Guarda los cambios para que aparezcan en la cotización de tus huéspedes.
              </span>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? "Guardando..." : "Guardar Extras"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 4: CABAÑAS & ALOJAMIENTOS
         ========================================================================= */}
      {subTab === "cabanas" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-emerald-400" />
                Gestión de Cabañas, Camas & Huéspedes
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Personaliza la descripción de camas y la capacidad de personas de cada alojamiento, o quítalas si no deseas mostrarlas en las tarjetas del motor.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchCabanas}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
                title="Refrescar lista"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCabanas ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToDishes) {
                    onNavigateToDishes();
                  } else {
                    window.location.hash = "#dishes";
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Administrar en Catálogo</span>
              </button>
            </div>
          </div>

          {isLoadingCabanas ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
              Cargando cabañas y habitaciones...
            </div>
          ) : cabanas.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 text-center space-y-3">
              <BedDouble className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                No tienes cabañas registradas en tu catálogo de alojamiento aún.
              </p>
              <button
                onClick={() => {
                  if (onNavigateToDishes) onNavigateToDishes();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Crear tu primera cabaña
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cabanas.map((cab) => (
                <div
                  key={cab.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-lg hover:border-slate-700 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                      {cab.imageUrl ? (
                        <img src={cab.imageUrl} alt={cab.name} className="h-full w-full object-cover" />
                      ) : (
                        <BedDouble className="w-6 h-6 text-emerald-500/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-white truncate">{cab.name}</h4>
                        <span className="text-xs font-black text-emerald-400 shrink-0">
                          ${cab.price.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ noche</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{cab.categoryName}</div>
                      
                      {/* Insignias Actuales */}
                      <div className="mt-2.5 space-y-1">
                        <div className="text-[11px] flex items-center gap-1.5">
                          {cab.beds ? (
                            <span className="text-slate-300 font-medium">🛏️ {cab.beds}</span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">🛏️ Sin camas configuradas (oculto en tarjeta)</span>
                          )}
                        </div>
                        <div className="text-[11px] flex items-center gap-1.5">
                          {cab.maxGuests && cab.maxGuests > 0 ? (
                            <span className="text-slate-300 font-medium">👥 Hasta {cab.maxGuests} huéspedes</span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">👥 Sin capacidad configurada (oculto en tarjeta)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-850">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCabana(cab)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Insignias & Precio</span>
                    </button>

                    {(cab.beds || (cab.maxGuests && cab.maxGuests > 0)) && (
                      <button
                        type="button"
                        onClick={() => handleQuickRemoveBadges(cab.id)}
                        className="text-[11px] text-slate-400 hover:text-red-400 transition"
                        title="Quitar las insignias de esta cabaña"
                      >
                        ✕ Quitar insignias
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: EDITAR CABAÑA E INSIGNIAS
         ========================================================================= */}
      {editingCabana && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-emerald-400" />
                Editar Insignias de Alojamiento
              </h3>
              <button
                type="button"
                onClick={() => setEditingCabana(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCabana} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre de la Cabaña / Habitación *</label>
                <input
                  type="text"
                  required
                  value={editCabanaName}
                  onChange={(e) => setEditCabanaName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Tarifa por Noche ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editCabanaPrice}
                  onChange={(e) => setEditCabanaPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              {/* Insignia: Camas */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-300">
                    🛏️ Distribución de Camas / Baño
                  </label>
                  {editCabanaBeds && (
                    <button
                      type="button"
                      onClick={() => setEditCabanaBeds("")}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      ✕ Quitar camas
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editCabanaBeds}
                  onChange={(e) => setEditCabanaBeds(e.target.value)}
                  placeholder="ej: Camas equipadas y baño privado"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
                <p className="text-[10px] text-slate-400">
                  💡 Déjalo vacío si no deseas que aparezca esta insignia en la tarjeta.
                </p>
              </div>

              {/* Insignia: Capacidad */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-300">
                    👥 Capacidad Máxima (Huéspedes)
                  </label>
                  {editCabanaGuests && (
                    <button
                      type="button"
                      onClick={() => setEditCabanaGuests("")}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      ✕ Quitar capacidad
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={editCabanaGuests}
                  onChange={(e) => setEditCabanaGuests(e.target.value)}
                  placeholder="ej: 2 o 4"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
                <p className="text-[10px] text-slate-400">
                  💡 Déjalo vacío o en 0 si no deseas que aparezca la capacidad.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCabana(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCabana}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg"
                >
                  {isSavingCabana ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 5: GALERÍA DE INSTALACIONES (MÁXIMO 4 FOTOS)
         ========================================================================= */}
      {subTab === "galeria" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-[0.25em] block mb-1">
                EXPERIENCIA VISUAL DEL HUÉSPED
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <Camera className="w-6 h-6 text-emerald-400" /> Galería de Instalaciones & Áreas Comunes
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Configura hasta 4 fotografías de tus instalaciones (piscina, zona de BBQ, hamacas, naturaleza). Se mostrarán en un carrusel táctil interactivo con ampliación en pantalla completa tanto en tu <strong>Perfil Comercial</strong> como en el <strong>Motor de Reservas</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/reservas/${restaurant.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <span>Ver en Vivo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? "Guardando..." : "Guardar Galería"}</span>
              </button>
            </div>
          </div>

          {configSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{configSuccessMsg}</span>
            </div>
          )}

          {/* Grid de 4 Slots de Fotos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { slot: 0, label: "Foto 1 (Principal)", placeholder: "Piscina, fachada o área principal", defaultHelp: "Ej: Piscina climatizada o vista principal de las cabañas" },
              { slot: 1, label: "Foto 2 (Área Social)", placeholder: "Parrilla, asadero o zona BBQ", defaultHelp: "Ej: Zona de BBQ, asador campestre o chimenea" },
              { slot: 2, label: "Foto 3 (Descanso)", placeholder: "Hamacas, pérgola o jardines", defaultHelp: "Ej: Área de hamacas o senderos naturales privados" },
              { slot: 3, label: "Foto 4 (Entorno / Panorámica)", placeholder: "Vista a la montaña, río o naturaleza", defaultHelp: "Ej: Mirador, paisajes o terraza al atardecer" },
            ].map(({ slot, label, placeholder, defaultHelp }) => {
              const url = galleryImages[slot] || "";
              return (
                <div
                  key={slot}
                  className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center border border-emerald-500/30">
                          {slot + 1}
                        </span>
                        {label}
                      </span>
                      {url && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...galleryImages];
                            updated[slot] = "";
                            setGalleryImages(updated);
                          }}
                          className="text-[11px] text-red-400 hover:text-red-300 font-bold transition cursor-pointer"
                        >
                          ✕ Limpiar
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const updated = [...galleryImages];
                          updated[slot] = e.target.value;
                          setGalleryImages(updated);
                        }}
                        placeholder={`https://... (${placeholder})`}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {defaultHelp}
                    </p>
                  </div>

                  {/* Vista Previa Visual */}
                  <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center group">
                    {url.trim() ? (
                      <>
                        <img
                          src={url.trim()}
                          alt={`Vista previa slot ${slot + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30">
                          ✓ Enlace Activo
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5 p-4 text-center">
                        <ImageIcon className="w-8 h-8 opacity-40 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-500">Sin imagen configurada</span>
                        <span className="text-[9px] text-slate-600">Pega un enlace web directo para previsualizar</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              💡 Puedes usar imágenes alojadas en Unsplash, URLs directas o subidas desde el editor de platos/perfil.
            </p>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? "Guardando cambios..." : "Guardar Galería de Hospedaje"}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NUEVA RESERVA MANUAL
         ========================================================================= */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trees className="w-4 h-4 text-emerald-400" />
                Registrar Reserva Manual / Telefónica
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre del Huésped *</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ej: Carolina Morales"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="Ej: 0998765432"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Fecha Check-In *</label>
                  <input
                    type="date"
                    required
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Fecha Check-Out *</label>
                  <input
                    type="date"
                    required
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Noches</label>
                  <input
                    type="number"
                    min="1"
                    value={manualNights}
                    onChange={(e) => setManualNights(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Adultos</label>
                  <input
                    type="number"
                    min="1"
                    value={manualAdults}
                    onChange={(e) => setManualAdults(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Niños</label>
                  <input
                    type="number"
                    min="0"
                    value={manualChildren}
                    onChange={(e) => setManualChildren(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Cabaña / Habitación</label>
                  <input
                    type="text"
                    value={manualRoom}
                    onChange={(e) => setManualRoom(e.target.value)}
                    placeholder="Ej: Domo Glamping"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Total a Cobrar ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualTotal}
                    onChange={(e) => setManualTotal(e.target.value)}
                    placeholder="Ej: 95.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Notas / Requerimientos</label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Ej: Huésped llega tarde a las 20:00, solicitaron leña extra."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingManual}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg"
                >
                  {isCreatingManual ? "Guardando..." : "Guardar Reserva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NUEVO EXTRA
         ========================================================================= */}
      {showNewExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Coffee className="w-4 h-4 text-cyan-400" />
                Agregar Servicio Extra o Experiencia
              </h3>
              <button
                onClick={() => setShowNewExtraModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExtra} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nombre del Servicio Extra *</label>
                <input
                  type="text"
                  required
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="Ej: Desayuno Campestre Tradicional, Cesta de Leña..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Precio ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                  placeholder="Ej: 6.50"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="perPersonCheck"
                  checked={extraPerPerson}
                  onChange={(e) => setExtraPerPerson(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="perPersonCheck" className="text-slate-300 font-semibold cursor-pointer">
                  Cobrar por persona / por noche (ej. desayunos)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewExtraModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg"
                >
                  Agregar a la Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
