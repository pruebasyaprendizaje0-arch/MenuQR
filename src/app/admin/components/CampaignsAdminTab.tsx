"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Flame,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Tag,
  Share2,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Copy,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  CampaignType,
  CampaignDiscountType,
  BusinessCampaignData,
  CampaignDishDetail,
} from "@/lib/campaign-types";
import {
  getRestaurantCampaignsAction,
  saveCampaignAction,
  deleteCampaignAction,
  toggleCampaignActiveAction,
} from "@/lib/campaign-actions";
import { calculateItemPromoPrice } from "@/lib/campaign-utils";

interface DishOption {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string;
}

interface CampaignsAdminTabProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    themeColor?: string;
    logoUrl?: string | null;
    whatsapp?: string;
    categories?: Array<{
      id: string;
      name: string;
      dishes?: Array<{
        id: string;
        name: string;
        price: number;
        imageUrl?: string | null;
      }>;
    }>;
  };
}

export default function CampaignsAdminTab({ restaurant }: CampaignsAdminTabProps) {
  const [campaigns, setCampaigns] = useState<BusinessCampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<CampaignType>("PROMO");
  const [formTitle, setFormTitle] = useState("");
  const [formBadge, setFormBadge] = useState("Promo Semanal");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEventDate, setFormEventDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formDaysOfWeek, setFormDaysOfWeek] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<CampaignDiscountType>("PERCENTAGE");
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0);
  const [formCtaText, setFormCtaText] = useState("Aprovechar por WhatsApp");
  const [formWhatsappMsg, setFormWhatsappMsg] = useState("");
  const [formExternalUrl, setFormExternalUrl] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Linked Dishes State
  const [selectedDishes, setSelectedDishes] = useState<
    Array<{ dishId: string; promoPrice?: number | null; promoLabel?: string | null }>
  >([]);
  const [dishSearchQuery, setDishSearchQuery] = useState("");

  const allAvailableDishes: DishOption[] = useMemo(() => {
    const list: DishOption[] = [];
    (restaurant.categories || []).forEach((cat) => {
      (cat.dishes || []).forEach((d) => {
        list.push({
          id: d.id,
          name: d.name,
          price: d.price,
          imageUrl: d.imageUrl,
          categoryName: cat.name,
        });
      });
    });
    return list;
  }, [restaurant.categories]);

  const filteredDishes = useMemo(() => {
    if (!dishSearchQuery.trim()) return allAvailableDishes;
    const q = dishSearchQuery.toLowerCase();
    return allAvailableDishes.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.categoryName && d.categoryName.toLowerCase().includes(q))
    );
  }, [allAvailableDishes, dishSearchQuery]);

  const loadCampaigns = async () => {
    setLoading(true);
    const res = await getRestaurantCampaignsAction(restaurant.id, false);
    if (res.success) {
      setCampaigns(res.campaigns);
    } else {
      setErrorMsg(res.error || "Error al cargar campañas");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, [restaurant.id]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormType("PROMO");
    setFormTitle("");
    setFormBadge("Promo Semanal");
    setFormDescription("");
    setFormStartDate("");
    setFormEndDate("");
    setFormEventDate("");
    setFormStartTime("");
    setFormEndTime("");
    setFormDaysOfWeek("");
    setFormDiscountType("PERCENTAGE");
    setFormDiscountValue(0);
    setFormCtaText("Aprovechar por WhatsApp");
    setFormWhatsappMsg("");
    setFormExternalUrl("");
    setFormImageUrl("");
    setFormIsActive(true);
    setSelectedDishes([]);
    setDishSearchQuery("");
    setIsModalOpen(true);
  };

  const openEditModal = (camp: BusinessCampaignData) => {
    setEditingId(camp.id);
    setFormType(camp.type);
    setFormTitle(camp.title);
    setFormBadge(camp.badgeText || "");
    setFormDescription(camp.description || "");
    setFormStartDate(camp.startDate ? camp.startDate.substring(0, 10) : "");
    setFormEndDate(camp.endDate ? camp.endDate.substring(0, 10) : "");
    setFormEventDate(camp.eventDate ? camp.eventDate.substring(0, 10) : "");
    setFormStartTime(camp.startTime || "");
    setFormEndTime(camp.endTime || "");
    setFormDaysOfWeek(camp.daysOfWeek || "");
    setFormDiscountType(camp.discountType);
    setFormDiscountValue(camp.discountValue || 0);
    setFormCtaText(camp.ctaText || "Aprovechar por WhatsApp");
    setFormWhatsappMsg(camp.whatsappMessage || "");
    setFormExternalUrl(camp.externalUrl || "");
    setFormImageUrl(camp.imageUrl || "");
    setFormIsActive(camp.isActive);
    setSelectedDishes(
      (camp.dishes || []).map((d) => ({
        dishId: d.dishId,
        promoPrice: d.promoPrice,
        promoLabel: d.promoLabel,
      }))
    );
    setDishSearchQuery("");
    setIsModalOpen(true);
  };

  const handleToggleActive = async (camp: BusinessCampaignData) => {
    const nextState = !camp.isActive;
    const res = await toggleCampaignActiveAction(camp.id, restaurant.id, nextState);
    if (res.success) {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === camp.id ? { ...c, isActive: nextState } : c))
      );
    } else {
      alert(res.error || "Error al actualizar estado");
    }
  };

  const handleDelete = async (campId: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;
    const res = await deleteCampaignAction(campId, restaurant.id);
    if (res.success) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campId));
      setSuccessMsg("Publicación eliminada correctamente.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } else {
      alert(res.error || "Error al eliminar");
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Por favor ingresa un título para la campaña o evento.");
      return;
    }

    setIsSaving(true);
    const formData = new FormData();
    if (editingId) formData.append("id", editingId);
    formData.append("restaurantId", restaurant.id);
    formData.append("title", formTitle.trim());
    formData.append("type", formType);
    formData.append("badgeText", formBadge.trim());
    formData.append("description", formDescription.trim());
    if (formStartDate) formData.append("startDate", formStartDate);
    if (formEndDate) formData.append("endDate", formEndDate);
    if (formEventDate) formData.append("eventDate", formEventDate);
    if (formStartTime) formData.append("startTime", formStartTime);
    if (formEndTime) formData.append("endTime", formEndTime);
    if (formDaysOfWeek) formData.append("daysOfWeek", formDaysOfWeek);
    formData.append("discountType", formDiscountType);
    formData.append("discountValue", String(formDiscountValue || 0));
    formData.append("ctaText", formCtaText);
    formData.append("whatsappMessage", formWhatsappMsg);
    formData.append("externalUrl", formExternalUrl);
    formData.append("isActive", String(formIsActive));
    if (formImageUrl.trim()) formData.append("imageUrl", formImageUrl.trim());
    formData.append("dishesJson", JSON.stringify(selectedDishes));

    const res = await saveCampaignAction(formData);
    setIsSaving(false);

    if (res.success) {
      setIsModalOpen(false);
      setSuccessMsg(editingId ? "¡Campaña actualizada!" : "¡Campaña creada con éxito!");
      setTimeout(() => setSuccessMsg(""), 3500);
      await loadCampaigns();
    } else {
      alert(res.error || "Ocurrió un error al guardar la campaña.");
    }
  };

  const toggleSelectDish = (dishId: string) => {
    setSelectedDishes((prev) => {
      const exists = prev.some((d) => d.dishId === dishId);
      if (exists) {
        return prev.filter((d) => d.dishId !== dishId);
      } else {
        return [...prev, { dishId, promoPrice: null, promoLabel: null }];
      }
    });
  };

  const updateDishPromoPrice = (dishId: string, promoPrice: number | null) => {
    setSelectedDishes((prev) =>
      prev.map((d) => (d.dishId === dishId ? { ...d, promoPrice } : d))
    );
  };

  const handleCopyShareText = async (camp: BusinessCampaignData) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const publicUrl = `${origin}/${restaurant.slug}`;
    const emoji = camp.type === "EVENT" ? "🎉" : camp.type === "ACTIVITY" ? "⚡" : "🔥";

    let text = `${emoji} *¡Novedad en ${restaurant.name}!* ${emoji}\n\n`;
    text += `*${camp.title}*\n`;
    if (camp.badgeText) text += `🏷️ *${camp.badgeText}*\n`;
    if (camp.daysOfWeek) text += `📅 ${camp.daysOfWeek}\n`;
    if (camp.description) text += `\n${camp.description}\n`;
    text += `\n👉 *Consulta detalles y pide aquí:* ${publicUrl}\n`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedId(camp.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const activeCount = campaigns.filter((c) => c.isActive).length;
  const eventsCount = campaigns.filter((c) => c.type === "EVENT").length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Flame className="w-5 h-5 animate-pulse" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Campañas, Eventos & Promociones Semanales
              </h2>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Publica promociones de tus productos o servicios, eventos en vivo o actividades especiales.
              Los artículos vinculados se destacan automáticamente con precio de oferta en tu catálogo o menú digital.
            </p>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                <Flame className="w-3.5 h-3.5" />
                <span>{activeCount} Activas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                <Calendar className="w-3.5 h-3.5" />
                <span>{eventsCount} Eventos</span>
              </div>
              <div className="text-xs text-slate-500">
                Total: {campaigns.length}
              </div>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="self-start md:self-center inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-rose-500/25 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Campaña / Evento</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Campaigns List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Cargando publicaciones...</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center space-y-4 bg-slate-900/30">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 text-slate-400 flex items-center justify-center mx-auto">
            <Flame className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-base">No hay campañas o eventos creados</h3>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              Comienza creando tu primera promoción semanal o evento presencial para atraer más clientes desde tu perfil comercial.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            Crear mi primera publicación
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((camp) => {
            const isEvent = camp.type === "EVENT";
            const isActivity = camp.type === "ACTIVITY";

            return (
              <div
                key={camp.id}
                className={`rounded-3xl border p-5 sm:p-6 space-y-4 transition-all duration-300 ${
                  camp.isActive
                    ? "bg-slate-900/80 border-white/15 shadow-xl"
                    : "bg-slate-950/40 border-white/5 opacity-70"
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                        isEvent
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : isActivity
                          ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {camp.badgeText || (isEvent ? "Evento" : "Promoción")}
                    </span>

                    {camp.daysOfWeek && (
                      <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                        {camp.daysOfWeek}
                      </span>
                    )}
                  </div>

                  {/* Toggle Active Switch */}
                  <button
                    onClick={() => handleToggleActive(camp)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                      camp.isActive
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                    title={camp.isActive ? "Desactivar campaña" : "Activar campaña"}
                  >
                    {camp.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{camp.isActive ? "Activa" : "Pausada"}</span>
                  </button>
                </div>

                {/* Content: Title & Preview */}
                <div className="flex gap-4">
                  {camp.imageUrl ? (
                    <img
                      src={camp.imageUrl}
                      alt={camp.title}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 text-slate-500">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-white font-extrabold text-sm sm:text-base leading-snug truncate">
                      {camp.title}
                    </h4>
                    {camp.description && (
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                        {camp.description}
                      </p>
                    )}
                    {camp.dishes && camp.dishes.length > 0 && (
                      <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 pt-1">
                        <Tag className="w-3 h-3" />
                        <span>{camp.dishes.length} productos en promoción</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates & Expiry */}
                {(camp.startDate || camp.endDate || camp.eventDate) && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-white/5">
                    {camp.startDate && (
                      <span>Desde: {new Date(camp.startDate).toLocaleDateString()}</span>
                    )}
                    {camp.endDate && (
                      <span className="text-amber-300 font-semibold">
                        Hasta: {new Date(camp.endDate).toLocaleDateString()}
                      </span>
                    )}
                    {camp.startTime && <span>Horario: {camp.startTime}</span>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    onClick={() => handleCopyShareText(camp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
                    title="Copiar texto listo para WhatsApp o Historias"
                  >
                    {copiedId === camp.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Copiar para Redes</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(camp)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(camp.id)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {editingId ? "Editar Publicación" : "Nueva Campaña / Evento"}
                </h3>
                <p className="text-slate-400 text-xs">
                  Configura la publicación que se mostrará en tu perfil de negocio y catálogo digital.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-6">
              {/* 1. Tipo de Publicación */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Tipo de Publicación *</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("PROMO");
                      setFormBadge("Promo Semanal");
                    }}
                    className={`p-3 rounded-2xl border text-center transition ${
                      formType === "PROMO"
                        ? "bg-rose-500/20 border-rose-500 text-white shadow-lg"
                        : "bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <Flame className="w-5 h-5 mx-auto mb-1 text-rose-400" />
                    <span className="text-xs font-bold block">Promoción</span>
                    <span className="text-[10px] text-slate-400 block">Descuento o 2x1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType("EVENT");
                      setFormBadge("Evento Especial");
                    }}
                    className={`p-3 rounded-2xl border text-center transition ${
                      formType === "EVENT"
                        ? "bg-amber-500/20 border-amber-500 text-white shadow-lg"
                        : "bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                    <span className="text-xs font-bold block">Evento</span>
                    <span className="text-[10px] text-slate-400 block">En vivo o fecha</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType("ACTIVITY");
                      setFormBadge("Actividad");
                    }}
                    className={`p-3 rounded-2xl border text-center transition ${
                      formType === "ACTIVITY"
                        ? "bg-sky-500/20 border-sky-500 text-white shadow-lg"
                        : "bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <Sparkles className="w-5 h-5 mx-auto mb-1 text-sky-400" />
                    <span className="text-xs font-bold block">Actividad</span>
                    <span className="text-[10px] text-slate-400 block">Taller / Feria</span>
                  </button>
                </div>
              </div>

              {/* 2. Título y Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Título de la Publicación *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ej: Semana del 2x1 en Hamburguesas o Noche de Saxofón"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Etiqueta / Badge</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="Ej: 2x1, 25% OFF"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* 3. Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Descripción o Condiciones</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explica qué incluye la promoción, horarios o detalles especiales para tus clientes..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* 4. Fechas y Vigencia */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Vigencia y Horarios
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Fecha de Fin (Auto-expiración)
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Días Válidos</label>
                    <input
                      type="text"
                      value={formDaysOfWeek}
                      onChange={(e) => setFormDaysOfWeek(e.target.value)}
                      placeholder="Ej: Jueves a Sábado"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                    />
                  </div>
                </div>

                {formType === "EVENT" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Fecha del Evento</label>
                      <input
                        type="date"
                        value={formEventDate}
                        onChange={(e) => setFormEventDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Hora Inicio</label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Hora Fin</label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Flyer / Imagen Promocional (Solo URL) */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                    Flyer / Imagen Publicitaria (Opcional)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Solo URL externa o ruta /uploads/...</span>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400 block">URL de la Imagen (HTTPS o /uploads/...)</label>
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://i.postimg.cc/xxxxx/flyer.webp o /uploads/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500 placeholder:text-slate-600"
                  />
                  <p className="text-[11px] text-slate-500">
                    Pega el enlace web directo de tu volante o foto promocional (ej. Postimages, Imgur, Cloudinary o /uploads/...).
                  </p>
                </div>

                {formImageUrl.trim() && (
                  <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    <img
                      src={formImageUrl.trim()}
                      alt="Vista previa del flyer"
                      className="w-14 h-14 rounded-xl object-cover border border-white/15 bg-slate-900 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                      onLoad={(e) => {
                        (e.target as HTMLElement).style.display = "block";
                      }}
                    />
                    <div className="text-[11px] text-slate-400 min-w-0">
                      <span className="text-emerald-400 font-bold block">✓ Vista previa detectada</span>
                      <span className="text-slate-500 truncate block font-mono text-[10px]">{formImageUrl.trim()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Vinculación con Catálogo / Platos (Opción 3) */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Vincular Productos / Servicios del Catálogo
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedDishes.length} seleccionados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Tipo de Descuento</label>
                    <select
                      value={formDiscountType}
                      onChange={(e) => setFormDiscountType(e.target.value as CampaignDiscountType)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                    >
                      <option value="PERCENTAGE">Descuento Porcentual (%)</option>
                      <option value="FIXED_PRICE">Precio Fijo Especial ($)</option>
                      <option value="DEAL_2X1">2x1 / Combo Especial</option>
                      <option value="CUSTOM">Beneficio Personalizado</option>
                    </select>
                  </div>

                  {formDiscountType === "PERCENTAGE" && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Porcentaje de Descuento (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formDiscountValue || ""}
                        onChange={(e) => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                        placeholder="Ej: 20"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Dish Selector with search */}
                <div className="space-y-2 pt-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={dishSearchQuery}
                      onChange={(e) => setDishSearchQuery(e.target.value)}
                      placeholder="Buscar producto o servicio para agregar a la promo..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-900/50 border border-white/5">
                    {filteredDishes.length === 0 ? (
                      <p className="text-center text-slate-500 text-xs py-3">No se encontraron productos</p>
                    ) : (
                      filteredDishes.map((dish) => {
                        const isSelected = selectedDishes.some((d) => d.dishId === dish.id);
                        const selItem = selectedDishes.find((d) => d.dishId === dish.id);

                        return (
                          <div
                            key={dish.id}
                            className={`flex items-center justify-between p-2 rounded-xl transition ${
                              isSelected
                                ? "bg-emerald-500/15 border border-emerald-500/30"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <div
                              onClick={() => toggleSelectDish(dish.id)}
                              className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                            >
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                    : "border-slate-600"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-semibold text-white truncate">
                                {dish.name}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                (${dish.price.toFixed(2)})
                              </span>
                            </div>

                            {isSelected && (
                              <div className="flex items-center gap-2 shrink-0">
                                <label className="text-[10px] text-slate-400">Precio Promo ($):</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Auto"
                                  value={selItem?.promoPrice ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                    updateDishPromoPrice(dish.id, val);
                                  }}
                                  className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-white/20 text-xs text-emerald-400 font-bold"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* 7. WhatsApp y CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Texto del Botón CTA</label>
                  <input
                    type="text"
                    value={formCtaText}
                    onChange={(e) => setFormCtaText(e.target.value)}
                    placeholder="Ej: Pedir por WhatsApp"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Mensaje WhatsApp Prellenado</label>
                  <input
                    type="text"
                    value={formWhatsappMsg}
                    onChange={(e) => setFormWhatsappMsg(e.target.value)}
                    placeholder="Ej: Hola! Quisiera ordenar la promo..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-lg transition disabled:opacity-50"
                >
                  {isSaving ? "Guardando..." : editingId ? "Actualizar Publicación" : "Publicar Ahora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
