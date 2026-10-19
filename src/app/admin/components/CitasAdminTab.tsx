"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  Send,
  MessageSquare,
  Sparkles,
  MapPin,
  FileText,
  DollarSign,
  Plus,
  Loader2,
  CalendarCheck,
  UserX,
  Scissors,
  Stethoscope,
  Users,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Star,
  Settings2,
  Save,
  CheckSquare,
  Camera,
} from "lucide-react";

interface Specialist {
  id: string;
  name: string;
  title: string;
  rating: string;
  imageUrl: string;
}

interface CitaItem {
  id: string;
  negocio_id: string;
  mesa: string;
  estado: "nuevo" | "pendiente" | "confirmada" | "en_atencion" | "completada" | "cancelada" | "no_asistio" | string;
  total: number;
  created_at: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  vertical: string;
  metadata?: {
    servicio_nombre?: string;
    especialista_id?: string | null;
    especialista_nombre?: string;
    fecha_cita?: string;
    hora_cita?: string;
    duracion_min?: number;
    notas_cita?: string;
    notas_internas?: string;
  };
  items?: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    precio: number;
    notas?: string;
  }>;
}

interface MetricasCitas {
  total_hoy: number;
  pendientes: number;
  confirmadas: number;
  en_atencion: number;
  completadas: number;
  canceladas: number;
  ingresos_estimados_hoy: number;
}

interface CitasAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    address?: string | null;
    whatsappNumber?: string;
    logoUrl?: string | null;
    coverUrl?: string | null;
    mapEmbedUrl?: string | null;
    googleBusinessUrl?: string | null;
    customLabels?: string | null;
  };
}

export default function CitasAdminTab({ restaurant }: CitasAdminTabProps) {
  // Sub-pestañas: "turnos" | "especialistas" | "horarios" | "galeria"
  const [activeSubTab, setActiveSubTab] = useState<"turnos" | "especialistas" | "horarios" | "galeria">("turnos");
  const [galleryImages, setGalleryImages] = useState<string[]>(["", "", "", ""]);

  const [citas, setCitas] = useState<CitaItem[]>([]);
  const [metricas, setMetricas] = useState<MetricasCitas>({
    total_hoy: 0,
    pendientes: 0,
    confirmadas: 0,
    en_atencion: 0,
    completadas: 0,
    canceladas: 0,
    ingresos_estimados_hoy: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Estados de configuración de Especialistas y Horarios
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [morningSlots, setMorningSlots] = useState<string[]>([
    "09:00", "09:45", "10:30", "11:15", "12:00"
  ]);
  const [afternoonSlots, setAfternoonSlots] = useState<string[]>([
    "14:00", "14:45", "15:30", "16:15", "17:00", "17:45"
  ]);

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");

  // Modal para agregar o editar especialista
  const [showSpecialistModal, setShowSpecialistModal] = useState<boolean>(false);
  const [editingSpecialistId, setEditingSpecialistId] = useState<string | null>(null);
  const [specialistForm, setSpecialistForm] = useState<Specialist>({
    id: "",
    name: "",
    title: "",
    rating: "5.0",
    imageUrl: "",
  });

  // Inputs para añadir nuevas horas a las franjas
  const [newMorningSlot, setNewMorningSlot] = useState<string>("08:30");
  const [newAfternoonSlot, setNewAfternoonSlot] = useState<string>("18:30");

  // Filtros de citas
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSpecialist, setFilterSpecialist] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Estado de edición de notas internas por cita
  const [editingNotes, setEditingNotes] = useState<{ [citaId: string]: string }>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savedSuccessNoteId, setSavedSuccessNoteId] = useState<string | null>(null);

  // Modal para crear nueva cita manual
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isCreatingManual, setIsCreatingManual] = useState<boolean>(false);
  const [newCitaForm, setNewCitaForm] = useState({
    cliente_nombre: "",
    cliente_telefono: "",
    servicio_nombre: "Consulta Médica / Tratamiento",
    especialista_nombre: "Profesional de Turno",
    fecha_cita: todayStr,
    hora_cita: "10:00",
    duracion_min: 30,
    precio_estimado: 20,
    notas_cita: "",
    notas_internas: "",
  });

  // Cargar configuración de especialistas y horarios
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/citas/config?negocio_id=${restaurant.id}`);
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.specialists) && data.specialists.length > 0) {
          setSpecialists(data.specialists);
        } else {
          // Valores iniciales de ejemplo si no hay especialistas guardados
          setSpecialists([
            {
              id: "spec-1",
              name: "Dra. Valeria Campoverde",
              title: "Odontóloga / Médico Especialista",
              rating: "5.0",
              imageUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80",
            },
            {
              id: "spec-2",
              name: "Dr. Andrés Villacís",
              title: "Especialista Clínico / Cirujano",
              rating: "4.9",
              imageUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80",
            },
            {
              id: "spec-any",
              name: "Cualquier especialista disponible",
              title: "Primer turno libre disponible",
              rating: "5.0",
              imageUrl: "",
            },
          ]);
        }
        if (Array.isArray(data.morningSlots) && data.morningSlots.length > 0) {
          setMorningSlots(data.morningSlots);
        }
        if (Array.isArray(data.afternoonSlots) && data.afternoonSlots.length > 0) {
          setAfternoonSlots(data.afternoonSlots);
        }
        if (Array.isArray(data.galleryImages)) {
          const loaded = data.galleryImages.slice(0, 4);
          while (loaded.length < 4) loaded.push("");
          setGalleryImages(loaded);
        }
      }
    } catch (err) {
      console.error("[CitasAdminTab] Error al cargar configuración:", err);
    }
  }, [restaurant.id]);

  // Cargar citas y métricas
  const fetchCitas = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        negocio_id: restaurant.id,
        fecha: filterDate,
      });

      if (filterStatus !== "all") params.append("estado", filterStatus);
      if (filterSpecialist !== "all") params.append("especialista", filterSpecialist);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/citas?${params.toString()}`);
      const data = await res.json();

      if (data.ok) {
        setCitas(data.citas || []);
        if (data.metricas) {
          setMetricas(data.metricas);
        }
      }
    } catch (err) {
      console.error("[CitasAdminTab] Error al cargar citas:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurant.id, filterDate, filterStatus, filterSpecialist, searchQuery]);

  useEffect(() => {
    fetchCitas();
    fetchConfig();
  }, [fetchCitas, fetchConfig]);

  // Guardar configuración completa de Especialistas, Horarios y Galería en la Base de Datos
  const handleSaveConfig = async (
    newSpecs: Specialist[],
    newMorning: string[],
    newAfternoon: string[],
    newGallery?: string[]
  ) => {
    setIsSavingConfig(true);
    try {
      const activeGallery = (newGallery || galleryImages)
        .filter((img) => typeof img === "string" && img.trim().length > 0)
        .slice(0, 4);

      const res = await fetch("/api/citas/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: restaurant.id,
          specialists: newSpecs,
          morningSlots: newMorning,
          afternoonSlots: newAfternoon,
          galleryImages: activeGallery,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSaveSuccessMsg("¡Guardado con éxito! Visible de inmediato en la web.");
        setTimeout(() => setSaveSuccessMsg(""), 3500);
      } else {
        alert("Error al guardar: " + (data.error || ""));
      }
    } catch (err) {
      console.error("Error guardando config citas:", err);
      alert("Error de conexión al guardar configuración.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Abrir modal para crear especialista
  const handleOpenAddSpecialist = () => {
    setEditingSpecialistId(null);
    setSpecialistForm({
      id: `spec-${Date.now()}`,
      name: "",
      title: "Médico / Especialista / Profesional",
      rating: "5.0",
      imageUrl: "",
    });
    setShowSpecialistModal(true);
  };

  // Abrir modal para editar especialista
  const handleOpenEditSpecialist = (spec: Specialist) => {
    setEditingSpecialistId(spec.id);
    setSpecialistForm({ ...spec });
    setShowSpecialistModal(true);
  };

  // Guardar especialista (crear o editar)
  const handleSaveSpecialist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialistForm.name.trim()) {
      alert("Por favor ingresa el nombre del profesional.");
      return;
    }

    let updatedSpecs: Specialist[];
    if (editingSpecialistId) {
      updatedSpecs = specialists.map((s) =>
        s.id === editingSpecialistId ? { ...specialistForm } : s
      );
    } else {
      updatedSpecs = [...specialists, { ...specialistForm, id: `spec-${Date.now()}` }];
    }

    setSpecialists(updatedSpecs);
    setShowSpecialistModal(false);
    handleSaveConfig(updatedSpecs, morningSlots, afternoonSlots);
  };

  // Borrar especialista
  const handleDeleteSpecialist = (specId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este profesional de la agenda online?")) return;
    const updatedSpecs = specialists.filter((s) => s.id !== specId);
    setSpecialists(updatedSpecs);
    handleSaveConfig(updatedSpecs, morningSlots, afternoonSlots);
  };

  // Agregar franja horaria de la mañana
  const handleAddMorningSlot = () => {
    if (!newMorningSlot || morningSlots.includes(newMorningSlot)) return;
    const sorted = [...morningSlots, newMorningSlot].sort();
    setMorningSlots(sorted);
    handleSaveConfig(specialists, sorted, afternoonSlots);
  };

  // Eliminar franja horaria de la mañana
  const handleDeleteMorningSlot = (slot: string) => {
    const updated = morningSlots.filter((s) => s !== slot);
    setMorningSlots(updated);
    handleSaveConfig(specialists, updated, afternoonSlots);
  };

  // Agregar franja horaria de la tarde
  const handleAddAfternoonSlot = () => {
    if (!newAfternoonSlot || afternoonSlots.includes(newAfternoonSlot)) return;
    const sorted = [...afternoonSlots, newAfternoonSlot].sort();
    setAfternoonSlots(sorted);
    handleSaveConfig(specialists, morningSlots, sorted);
  };

  // Eliminar franja horaria de la tarde
  const handleDeleteAfternoonSlot = (slot: string) => {
    const updated = afternoonSlots.filter((s) => s !== slot);
    setAfternoonSlots(updated);
    handleSaveConfig(specialists, morningSlots, updated);
  };

  // Actualizar estado de una cita
  const handleUpdateStatus = async (citaId: string, newStatus: string) => {
    try {
      setCitas((prev) =>
        prev.map((c) => (c.id === citaId ? { ...c, estado: newStatus } : c))
      );

      const res = await fetch(`/api/citas/${citaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: newStatus }),
      });

      const data = await res.json();
      if (!data.ok) {
        alert("Error al actualizar estado de la cita");
        fetchCitas();
      } else {
        fetchCitas();
      }
    } catch (err) {
      console.error("Error updating cita status:", err);
      fetchCitas();
    }
  };

  // Guardar notas internas / historial clínico y preferencias
  const handleSaveInternalNotes = async (citaId: string) => {
    const noteText = editingNotes[citaId];
    if (noteText === undefined) return;

    setSavingNoteId(citaId);
    try {
      const res = await fetch(`/api/citas/${citaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas_internas: noteText }),
      });

      const data = await res.json();
      if (data.ok) {
        setSavedSuccessNoteId(citaId);
        setTimeout(() => setSavedSuccessNoteId(null), 2500);
        setCitas((prev) =>
          prev.map((c) =>
            c.id === citaId
              ? {
                  ...c,
                  metadata: {
                    ...(c.metadata || {}),
                    notas_internas: noteText,
                  },
                }
              : c
          )
        );
      } else {
        alert("No se pudo guardar la nota interna.");
      }
    } catch (err) {
      console.error("Error saving internal notes:", err);
      alert("Error de conexión al guardar nota.");
    } finally {
      setSavingNoteId(null);
    }
  };

  // Crear cita manual desde el panel
  const handleCreateManualCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCitaForm.cliente_nombre.trim() || !newCitaForm.hora_cita) {
      alert("Por favor indica al menos el nombre del cliente y la hora.");
      return;
    }

    setIsCreatingManual(true);
    try {
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio_id: restaurant.id,
          ...newCitaForm,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        setNewCitaForm({
          cliente_nombre: "",
          cliente_telefono: "",
          servicio_nombre: "Consulta Médica / Tratamiento",
          especialista_nombre: "Profesional de Turno",
          fecha_cita: todayStr,
          hora_cita: "10:00",
          duracion_min: 30,
          precio_estimado: 20,
          notas_cita: "",
          notas_internas: "",
        });
        fetchCitas();
      } else {
        alert(data.error || "Error al crear la cita");
      }
    } catch (err) {
      console.error("Error creating manual appointment:", err);
      alert("Error de red al registrar la cita.");
    } finally {
      setIsCreatingManual(false);
    }
  };

  // Generador de enlaces rápidos para WhatsApp (1-Click Actions)
  const formatPhoneForWhatsApp = (rawPhone: string | null) => {
    if (!rawPhone) return "";
    let clean = rawPhone.replace(/\D/g, "");
    if (clean.startsWith("0")) {
      clean = "593" + clean.slice(1);
    } else if (clean.length === 9) {
      clean = "593" + clean;
    }
    return clean;
  };

  const getWhatsAppActionUrl = (
    actionType: "confirm" | "reminder" | "location" | "reschedule",
    cita: CitaItem
  ) => {
    const phone = formatPhoneForWhatsApp(cita.cliente_telefono);
    if (!phone) return "";

    const nombre = cita.cliente_nombre || "Estimado(a) Cliente";
    const negocio = restaurant.name;
    const servicio = cita.metadata?.servicio_nombre || "Servicio";
    const especialista = cita.metadata?.especialista_nombre || "Profesional";
    const fecha = cita.metadata?.fecha_cita || "la fecha acordada";
    const hora = cita.metadata?.hora_cita || "la hora acordada";
    const direccion = restaurant.address || "nuestro local";
    const mapsLink =
      restaurant.googleBusinessUrl ||
      (restaurant.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            restaurant.address + " " + restaurant.name
          )}`
        : "");

    let message = "";

    if (actionType === "confirm") {
      message =
        `Hola *${nombre}*, te saluda *${negocio}*.\n\n` +
        `✅ *¡Tu cita está CONFIRMADA con éxito!*\n` +
        `🗓️ *Fecha:* ${fecha}\n` +
        `⏰ *Hora:* ${hora}\n` +
        `🩺 *Profesional / Especialista:* ${especialista}\n` +
        `💇‍♂️ *Tratamiento / Servicio:* ${servicio}\n` +
        `📍 *Dirección:* ${direccion}\n\n` +
        `Por favor llega 5 minutos antes. ¡Te esperamos!`;
    } else if (actionType === "reminder") {
      message =
        `Hola *${nombre}*, te recordamos tu cita hoy en *${negocio}*:\n\n` +
        `⏰ *Hora:* ${hora}\n` +
        `🩺 *Con:* ${especialista}\n` +
        `💇‍♂️ *Servicio:* ${servicio}\n\n` +
        `Por favor avísanos respondiendo a este mensaje si vienes en camino o si requieres reprogramar. ¡Te esperamos!`;
    } else if (actionType === "location") {
      message =
        `Hola *${nombre}*, aquí tienes la información de llegada para tu cita en *${negocio}*:\n\n` +
        `📍 *Dirección:* ${direccion}\n` +
        (mapsLink ? `🗺️ *Google Maps:* ${mapsLink}\n\n` : "\n") +
        `Cualquier consulta no dudes en escribirnos por aquí. ¡Buen viaje!`;
    } else if (actionType === "reschedule") {
      message =
        `Hola *${nombre}*, te escribimos de *${negocio}* respecto a tu turno agendado para el ${fecha} a las ${hora}.\n\n` +
        `Quisiéramos coordinar contigo para reprogramar tu cita en un horario que te sea más conveniente. ¿Qué día y hora te vendría bien?`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // Estilos de badge por estado
  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "nuevo":
      case "pendiente":
        return {
          label: "Pendiente",
          bg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          dot: "bg-amber-400",
        };
      case "confirmada":
        return {
          label: "Confirmada",
          bg: "bg-blue-500/15 text-blue-300 border-blue-500/30",
          dot: "bg-blue-400",
        };
      case "en_atencion":
        return {
          label: "En Atención",
          bg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
          dot: "bg-purple-400 animate-pulse",
        };
      case "completada":
      case "pagado":
        return {
          label: "Completada",
          bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          dot: "bg-emerald-400",
        };
      case "cancelada":
        return {
          label: "Cancelada",
          bg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
          dot: "bg-rose-400",
        };
      case "no_asistio":
        return {
          label: "No Asistió",
          bg: "bg-slate-750 text-slate-400 border-slate-700",
          dot: "bg-slate-500",
        };
      default:
        return {
          label: estado,
          bg: "bg-slate-800 text-slate-300 border-slate-700",
          dot: "bg-slate-400",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Principal con Métricas y Navegación de Sub-pestañas */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950/25 to-slate-900 border border-purple-500/20 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" />
                Panel de Citas & Agenda Médica
              </span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Edita Especialistas, Horarios, Logo y Portada
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {restaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Personaliza los profesionales que atienden, tus franjas horarias y gestiona los turnos en tiempo real con 1-Click WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchCitas();
                fetchConfig();
              }}
              disabled={refreshing}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition flex items-center justify-center"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agendar Turno Manual</span>
            </button>
          </div>
        </div>

        {/* Notificación de guardado exitoso */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Pestañas de Navegación del Módulo de Citas */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("turnos")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "turnos"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Agenda & Turnos (CRM)</span>
          </button>

          <button
            onClick={() => setActiveSubTab("especialistas")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "especialistas"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Especialistas / Profesionales ({specialists.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("horarios")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "horarios"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Horarios & Franjas ({morningSlots.length + afternoonSlots.length} turnos)</span>
          </button>

          <button
            onClick={() => setActiveSubTab("galeria")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "galeria"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-purple-300" />
            <span>📸 Galería de Consultorios (Máx. 4)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 1: AGENDA & TURNOS (CRM DE CITAS Y 1-CLICK WHATSAPP)          */}
      {/* ========================================================================= */}
      {activeSubTab === "turnos" && (
        <div className="space-y-6">
          {/* KPI Cards del Día */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group hover:border-purple-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Citas para Hoy</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">{metricas.total_hoy}</div>
              <p className="text-[10px] text-slate-500 mt-1">Total agendado para la fecha actual</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group hover:border-amber-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Por Confirmar</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock3 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400">{metricas.pendientes}</div>
              <p className="text-[10px] text-slate-500 mt-1">Requieren confirmación por WhatsApp</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group hover:border-blue-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmadas / Atendiendo</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-blue-400">
                {metricas.confirmadas + metricas.en_atencion}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{metricas.en_atencion} paciente(s) en consulta</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group hover:border-emerald-500/30 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proyección de Hoy</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                ${metricas.ingresos_estimados_hoy.toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{metricas.completadas} completada(s) / cobrada(s)</p>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilterDate(todayStr)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterDate === todayStr ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setFilterDate(tomorrowStr)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterDate === tomorrowStr ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Mañana
              </button>
              <button
                onClick={() => setFilterDate("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filterDate === "all" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                Todas
              </button>
              <input
                type="date"
                value={filterDate === "all" ? "" : filterDate}
                onChange={(e) => setFilterDate(e.target.value || "all")}
                className="bg-transparent text-slate-200 px-2 py-1 focus:outline-none text-xs border-l border-slate-800 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">Todos los estados</option>
                <option value="nuevo">Pendientes</option>
                <option value="confirmada">Confirmadas</option>
                <option value="en_atencion">En Atención</option>
                <option value="completada">Completadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="no_asistio">No Asistieron</option>
              </select>

              <div className="relative min-w-[200px] sm:min-w-[260px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar cliente, teléfono o servicio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lista de Citas */}
          {loading ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Cargando turnos y agenda...</p>
            </div>
          ) : citas.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                <CalendarCheck className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-white mb-1">No hay citas registradas para este filtro</h3>
                <p className="text-xs text-slate-400">
                  No se encontraron turnos con los criterios actuales. Puedes agendar una cita manual usando el botón superior o compartir tu enlace de reservas online.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Agendar Primer Turno
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {citas.map((cita) => {
                const meta = cita.metadata || {};
                const badge = getStatusBadge(cita.estado);
                const currentNote =
                  editingNotes[cita.id] !== undefined ? editingNotes[cita.id] : meta.notas_internas || "";
                const waPhone = formatPhoneForWhatsApp(cita.cliente_telefono);

                return (
                  <div
                    key={cita.id}
                    className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition shadow-lg space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-black text-white">
                            {meta.hora_cita || "Por confirmar"}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            ({meta.fecha_cita || "Hoy"})
                          </span>
                          {meta.duracion_min && (
                            <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md font-bold">
                              {meta.duracion_min} min
                            </span>
                          )}
                        </div>

                        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </div>

                        <div className="text-xs text-slate-300 flex items-center gap-1 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/60">
                          <User className="w-3.5 h-3.5 text-purple-400" />
                          <span className="font-semibold">{meta.especialista_nombre || "Profesional"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start lg:self-auto">
                        <span className="text-[11px] text-slate-400 font-medium mr-1 hidden sm:inline">
                          Cambiar estado:
                        </span>
                        <button
                          onClick={() => handleUpdateStatus(cita.id, "confirmada")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                            cita.estado === "confirmada"
                              ? "bg-blue-600 text-white"
                              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                          title="Marcar como Confirmada"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(cita.id, "en_atencion")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                            cita.estado === "en_atencion"
                              ? "bg-purple-600 text-white"
                              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                          title="Paciente en sillón o consulta"
                        >
                          En Atención
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(cita.id, "completada")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                            cita.estado === "completada" || cita.estado === "pagado"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                          title="Cita finalizada y cobrada"
                        >
                          Completada
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(cita.id, "cancelada")}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                            cita.estado === "cancelada"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-400"
                          }`}
                          title="Cancelar cita"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                          Cliente / Paciente
                        </span>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-purple-400" />
                          {cita.cliente_nombre || "Sin nombre registrado"}
                        </h4>
                        {cita.cliente_telefono ? (
                          <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            {cita.cliente_telefono}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Sin teléfono registrado</p>
                        )}
                        {meta.notas_cita && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 italic">
                            &quot;{meta.notas_cita}&quot;
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                          Servicio o Tratamiento
                        </span>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Scissors className="w-3.5 h-3.5 text-purple-400" />
                          {meta.servicio_nombre || "Consulta General"}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                          <span>Precio referencial:</span>
                          <span className="text-sm font-black text-emerald-400">
                            ${cita.total.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-2">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Acciones WhatsApp (1 Clic)
                        </span>

                        {waPhone ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            <a
                              href={getWhatsAppActionUrl("confirm", cita)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <Check className="w-3 h-3" />
                              Confirmar
                            </a>
                            <a
                              href={getWhatsAppActionUrl("reminder", cita)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <Clock3 className="w-3 h-3" />
                              Recordar
                            </a>
                            <a
                              href={getWhatsAppActionUrl("location", cita)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <MapPin className="w-3 h-3" />
                              Ubicación
                            </a>
                            <a
                              href={getWhatsAppActionUrl("reschedule", cita)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-[11px] font-bold transition flex items-center justify-center gap-1 text-center"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Reprogramar
                            </a>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic py-2">
                            Sin teléfono para WhatsApp directo
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-purple-400" />
                          Ficha CRM: Historial Clínico, Preferencias de Estilo y Observaciones Internas
                        </label>
                        {savedSuccessNoteId === cita.id && (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            ¡Nota guardada!
                          </span>
                        )}
                      </div>

                      <div className="flex items-end gap-2">
                        <textarea
                          rows={2}
                          value={currentNote}
                          onChange={(e) =>
                            setEditingNotes((prev) => ({
                              ...prev,
                              [cita.id]: e.target.value,
                            }))
                          }
                          placeholder="Escribe notas privadas del cliente (ej. Corte degradado 0.5, alergia a tinte, preferencias de atención, piezas dentales tratadas)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                        />

                        <button
                          onClick={() => handleSaveInternalNotes(cita.id)}
                          disabled={savingNoteId === cita.id}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition shrink-0 flex items-center gap-1.5"
                        >
                          {savingNoteId === cita.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          Guardar Ficha
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 2: ESPECIALISTAS Y PROFESIONALES (CREAR, EDITAR, BORRAR)     */}
      {/* ========================================================================= */}
      {activeSubTab === "especialistas" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Equipo de Especialistas y Profesionales
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Estos son los profesionales que tus clientes verán en el Paso 2 al reservar su turno online.
              </p>
            </div>

            <button
              onClick={handleOpenAddSpecialist}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Profesional</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {specialists.map((spec) => (
              <div
                key={spec.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-4 flex flex-col justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-purple-900/30 border border-purple-500/30 shrink-0">
                    {spec.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={spec.imageUrl} alt={spec.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-purple-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-sm font-bold text-white leading-tight truncate">
                      {spec.name}
                    </h4>
                    <p className="text-xs text-slate-400 leading-snug line-clamp-2">
                      {spec.title}
                    </p>
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold pt-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{spec.rating || "5.0"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => handleOpenEditSpecialist(spec)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3 text-purple-400" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteSpecialist(spec.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/30 border border-rose-900/40 text-rose-300 text-xs font-bold transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 3: HORARIOS Y FRANJAS DE ATENCIÓN (AGREGAR / QUITAR SLOTS)   */}
      {/* ========================================================================= */}
      {activeSubTab === "horarios" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Configuración de Turnos y Franjas Horarias
            </h3>
            <p className="text-xs text-slate-400">
              Define los horarios exactos que verán tus clientes para reservar en la mañana y en la tarde. Los turnos ocupados se bloquean de forma automática.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Franja de la Mañana */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-purple-400" />
                  Turnos de la Mañana
                </span>
                <span className="text-xs text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-md">
                  {morningSlots.length} horarios
                </span>
              </div>

              {/* Lista de horas mañana */}
              <div className="flex flex-wrap gap-2">
                {morningSlots.map((slot) => (
                  <div
                    key={slot}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white flex items-center gap-2 group hover:border-slate-700"
                  >
                    <span>{slot}</span>
                    <button
                      onClick={() => handleDeleteMorningSlot(slot)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title="Quitar hora"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Añadir hora mañana */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                <input
                  type="time"
                  value={newMorningSlot}
                  onChange={(e) => setNewMorningSlot(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleAddMorningSlot}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>

            {/* Franja de la Tarde */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Turnos de la Tarde
                </span>
                <span className="text-xs text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-md">
                  {afternoonSlots.length} horarios
                </span>
              </div>

              {/* Lista de horas tarde */}
              <div className="flex flex-wrap gap-2">
                {afternoonSlots.map((slot) => (
                  <div
                    key={slot}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white flex items-center gap-2 group hover:border-slate-700"
                  >
                    <span>{slot}</span>
                    <button
                      onClick={() => handleDeleteAfternoonSlot(slot)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title="Quitar hora"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Añadir hora tarde */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                <input
                  type="time"
                  value={newAfternoonSlot}
                  onChange={(e) => setNewAfternoonSlot(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleAddAfternoonSlot}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 4: GALERÍA DE CONSULTORIOS & INSTALACIONES (MÁX. 4 FOTOS)     */}
      {/* ========================================================================= */}
      {activeSubTab === "galeria" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-[10px] sm:text-xs font-black text-purple-400 uppercase tracking-[0.25em] block mb-1">
                CONFIANZA & EXPERIENCIA DEL PACIENTE
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                <Camera className="w-6 h-6 text-purple-400" /> Galería de Consultorios & Áreas de Atención
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Añade hasta 4 fotografías de tus consultorios, instrumental, sala de espera o recepción. Transmite máxima confianza profesional a tus pacientes con un carrusel táctil interactivo en tu <strong>Perfil Comercial</strong> y en el <strong>Agendador de Citas</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/citas/${restaurant.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <span>Ver en Vivo</span>
                <Save className="w-3.5 h-3.5 hidden" />
              </a>
              <button
                type="button"
                onClick={() => handleSaveConfig(specialists, morningSlots, afternoonSlots, galleryImages)}
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSavingConfig ? "Guardando..." : "Guardar Galería"}</span>
              </button>
            </div>
          </div>

          {saveSuccessMsg && (
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Grid de 4 Slots de Consultorios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { slot: 0, label: "Foto 1 (Consultorio Principal)", placeholder: "Sillón dental, camilla o área clínica", defaultHelp: "Ej: Sillón odontológico de última generación o consultorio privado" },
              { slot: 1, label: "Foto 2 (Recepción / Espera)", placeholder: "Recepción, sala de espera o entrada", defaultHelp: "Ej: Sala de espera climatizada con recepción ejecutiva" },
              { slot: 2, label: "Foto 3 (Tecnología / Equipos)", placeholder: "Instrumental, rayos X o esterilización", defaultHelp: "Ej: Equipos diagnósticos de alta precisión o esterilización" },
              { slot: 3, label: "Foto 4 (Fachada o Segunda Sala)", placeholder: "Instalaciones externas o sala auxiliar", defaultHelp: "Ej: Fachada del centro médico, laboratorio o box de atención" },
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
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-black flex items-center justify-center border border-purple-500/30">
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
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
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-purple-300 text-[9px] font-black uppercase tracking-wider border border-purple-500/30">
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
              💡 Puedes usar fotografías alojadas en Unsplash, enlaces web HTTPS o imágenes subidas en el perfil del negocio.
            </p>
            <button
              type="button"
              onClick={() => handleSaveConfig(specialists, morningSlots, afternoonSlots, galleryImages)}
              disabled={isSavingConfig}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition cursor-pointer"
            >
              {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingConfig ? "Guardando cambios..." : "Guardar Galería de Consultorios"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal para Crear o Editar Especialista */}
      {showSpecialistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                {editingSpecialistId ? "Editar Profesional" : "Nuevo Profesional / Especialista"}
              </h3>
              <button
                onClick={() => setShowSpecialistModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialist} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Dr. Carlos Mendoza / Barbero Alexander"
                  value={specialistForm.name}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Título o Especialidad
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cirujano Dental / Master Barber / Terapeuta"
                  value={specialistForm.title}
                  onChange={(e) => setSpecialistForm({ ...specialistForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Calificación (Estrellas)
                  </label>
                  <input
                    type="text"
                    placeholder="5.0"
                    value={specialistForm.rating}
                    onChange={(e) => setSpecialistForm({ ...specialistForm, rating: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    URL de Foto (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={specialistForm.imageUrl}
                    onChange={(e) => setSpecialistForm({ ...specialistForm, imageUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSpecialistModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                >
                  {isSavingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Profesional
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Agendar Cita Manual */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Agendar Turno Manual</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCita} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Nombre del Cliente / Paciente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={newCitaForm.cliente_nombre}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, cliente_nombre: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Teléfono Celular (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 0991234567"
                    value={newCitaForm.cliente_telefono}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, cliente_telefono: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Servicio o Tratamiento
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Consulta Médica / Corte Clásico"
                    value={newCitaForm.servicio_nombre}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, servicio_nombre: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Especialista Asignado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Dra. Carmen / Barbero Carlos"
                    value={newCitaForm.especialista_nombre}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, especialista_nombre: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={newCitaForm.fecha_cita}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, fecha_cita: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Hora *</label>
                  <input
                    type="time"
                    required
                    value={newCitaForm.hora_cita}
                    onChange={(e) =>
                      setNewCitaForm({ ...newCitaForm, hora_cita: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Precio ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCitaForm.precio_estimado}
                    onChange={(e) =>
                      setNewCitaForm({
                        ...newCitaForm,
                        precio_estimado: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Observaciones / Notas Internas
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles adicionales o preferencias del cliente..."
                  value={newCitaForm.notas_internas}
                  onChange={(e) =>
                    setNewCitaForm({ ...newCitaForm, notas_internas: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingManual}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                >
                  {isCreatingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar y Guardar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
