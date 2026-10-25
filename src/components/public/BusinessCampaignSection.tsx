"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Flame,
  Calendar,
  Sparkles,
  Clock,
  MessageCircle,
  ExternalLink,
  Share2,
  Check,
  Maximize2,
  X,
  Tag,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";
import { BusinessCampaignData, CampaignDishDetail } from "@/lib/campaign-types";
import { calculateItemPromoPrice } from "@/lib/campaign-utils";

interface BusinessCampaignSectionProps {
  campaigns: BusinessCampaignData[];
  themeColor?: string | null;
  businessName: string;
  businessWhatsapp?: string | null;
  onSelectDish?: (dishId: string) => void;
}

export function BusinessCampaignSection({
  campaigns,
  themeColor = "#ef4444",
  businessName,
  businessWhatsapp,
  onSelectDish,
}: BusinessCampaignSectionProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (!c.isActive) return false;
      if (c.endDate) {
        const end = new Date(c.endDate);
        if (end < now) return false;
      }
      return true;
    });
  }, [campaigns, now]);

  if (activeCampaigns.length === 0) {
    return null;
  }

  const effectiveTheme = themeColor || "#ef4444";

  const handleShare = async (campaign: BusinessCampaignData) => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareText = `🔥 ¡Mira esta promoción en ${businessName}!: "${campaign.title}"`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: campaign.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {}
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setCopiedId(campaign.id);
        setTimeout(() => setCopiedId(null), 2500);
      } catch (err) {}
    }
  };

  const getCountdownText = (endDateStr: string | null, eventDateStr: string | null) => {
    const targetStr = endDateStr || eventDateStr;
    if (!targetStr) return null;

    const target = new Date(targetStr);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return "Termina hoy";

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 1) return `Termina en ${days} días`;
    if (days === 1) return `Termina mañana`;
    if (hours > 0) return `Termina en ${hours} horas`;
    return "¡Últimas horas!";
  };

  const buildWhatsAppUrl = (campaign: BusinessCampaignData) => {
    const cleanNumber = (businessWhatsapp || "").replace(/[^0-9]/g, "");
    if (!cleanNumber) return null;

    const defaultMsg = `¡Hola ${businessName}! Vi en su perfil la promoción: *"${campaign.title}"* y quisiera más información o realizar un pedido.`;
    const msg = campaign.whatsappMessage?.trim() || defaultMsg;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <section className="space-y-6 my-4">
      {activeCampaigns.map((camp) => {
        const countdown = getCountdownText(camp.endDate, camp.eventDate);
        const waUrl = buildWhatsAppUrl(camp);
        const isEvent = camp.type === "EVENT";
        const isActivity = camp.type === "ACTIVITY";

        const badgeIcon = isEvent ? (
          <Calendar className="w-3.5 h-3.5 text-amber-300" />
        ) : isActivity ? (
          <Sparkles className="w-3.5 h-3.5 text-sky-300" />
        ) : (
          <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        );

        return (
          <div
            key={camp.id}
            className="relative rounded-[2.5rem] bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-white/10 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 group hover:border-white/20"
            style={{
              boxShadow: `0 20px 45px -15px ${effectiveTheme}25`,
            }}
          >
            {/* Ambient subtle glow matching themeColor */}
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[100px] pointer-events-none opacity-20"
              style={{ backgroundColor: effectiveTheme }}
            />

            {/* Header: Badges and Expiry */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black tracking-wider uppercase text-white shadow-md border border-white/15"
                  style={{ backgroundColor: effectiveTheme }}
                >
                  {badgeIcon}
                  <span>{camp.badgeText || (isEvent ? "Evento Especial" : "Promo Semanal")}</span>
                </span>

                {camp.daysOfWeek && (
                  <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    {camp.daysOfWeek}
                  </span>
                )}
              </div>

              {countdown && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{countdown}</span>
                </div>
              )}
            </div>

            {/* Main content grid: Text & Flyer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Text Description column */}
              <div className={`${camp.imageUrl ? "lg:col-span-7" : "lg:col-span-12"} space-y-4`}>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  {camp.title}
                </h3>

                {camp.description && (
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {camp.description}
                  </p>
                )}

                {/* Event Schedule Info */}
                {(camp.startTime || camp.eventDate) && (
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
                    {camp.eventDate && (
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold">
                          {new Date(camp.eventDate).toLocaleDateString([], {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    )}
                    {camp.startTime && (
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold">
                          {camp.startTime} {camp.endTime ? `- ${camp.endTime}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* CTAs */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{camp.ctaText || "Pedir por WhatsApp"}</span>
                    </a>
                  )}

                  {camp.externalUrl && (
                    <a
                      href={camp.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-sky-300 hover:text-white bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Más información</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleShare(camp)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                    title="Compartir promoción"
                  >
                    {copiedId === camp.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 text-amber-400" />
                        <span>Compartir</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Flyer Showcase column */}
              {camp.imageUrl && (
                <div className="lg:col-span-5 flex justify-center">
                  <div
                    onClick={() => setSelectedImage(camp.imageUrl)}
                    className="relative w-full max-w-sm aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl cursor-pointer group/img"
                  >
                    <img
                      src={camp.imageUrl}
                      alt={camp.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-between p-3">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5" />
                        Ver volante completo
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Linked Dishes / Services participating in this campaign */}
            {camp.dishes && camp.dishes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Productos / Servicios en Promoción
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {camp.dishes.length} {camp.dishes.length === 1 ? "artículo" : "artículos"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {camp.dishes.map((item) => {
                    const dish = item.dish;
                    if (!dish) return null;

                    const promoPrice = calculateItemPromoPrice(
                      dish.price,
                      camp.discountType,
                      camp.discountValue || 0,
                      item.promoPrice
                    );

                    const hasDiscount = promoPrice < dish.price;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200"
                      >
                        {dish.imageUrl ? (
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 text-slate-500">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{dish.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {hasDiscount ? (
                              <>
                                <span className="text-xs font-black text-emerald-400">
                                  ${promoPrice.toFixed(2)}
                                </span>
                                <span className="text-[11px] text-slate-500 line-through">
                                  ${dish.price.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-white">
                                ${dish.price.toFixed(2)}
                              </span>
                            )}
                            {item.promoLabel && (
                              <span className="text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                {item.promoLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {onSelectDish && (
                          <button
                            onClick={() => onSelectDish(dish.id)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Ver en menú"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal Zoom for Flyer Image */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/20 bg-slate-950">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Flyer promocional"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}
