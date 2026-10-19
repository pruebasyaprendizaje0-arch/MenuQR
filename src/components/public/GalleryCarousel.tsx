"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Sparkles,
  Camera,
} from "lucide-react";

export interface GalleryCarouselProps {
  images: string[];
  title?: string;
  badge?: string;
  themeColor?: string;
  className?: string;
  aspectRatio?: "16:9" | "21:9" | "4:3";
  autoPlayIntervalMs?: number; // 0 or undefined to disable
}

export function GalleryCarousel({
  images = [],
  title = "Instalaciones & Áreas",
  badge = "📸 Galería",
  themeColor = "#10b981",
  className = "",
  aspectRatio = "16:9",
  autoPlayIntervalMs = 5000,
}: GalleryCarouselProps) {
  // Sanitize and limit to 4 valid image URLs
  const validImages = images
    .filter((img) => typeof img === "string" && img.trim().length > 0)
    .slice(0, 4);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const total = validImages.length;

  const goToNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goToPrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Autoplay
  useEffect(() => {
    if (total <= 1 || !autoPlayIntervalMs || isLightboxOpen) return;

    autoPlayTimerRef.current = setInterval(() => {
      goToNext();
    }, autoPlayIntervalMs);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [total, autoPlayIntervalMs, isLightboxOpen, goToNext]);

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (total <= 1) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || total <= 1) return;
    const currentX = e.touches[0].clientX;
    setTouchDeltaX(currentX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (total <= 1 || touchStartX === null) return;
    const threshold = 50; // min px to trigger swipe
    if (touchDeltaX < -threshold) {
      goToNext();
    } else if (touchDeltaX > threshold) {
      goToPrev();
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  if (total === 0) return null;

  const aspectClass =
    aspectRatio === "21:9"
      ? "aspect-[21/9] sm:h-80"
      : aspectRatio === "4:3"
      ? "aspect-[4/3] sm:h-96"
      : "aspect-[16/9] sm:h-80";

  return (
    <section className={`w-full space-y-3 ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {badge && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm"
              style={{
                backgroundColor: `${themeColor}15`,
                color: themeColor,
                borderColor: `${themeColor}40`,
              }}
            >
              <Sparkles className="w-3 h-3" />
              {badge}
            </span>
          )}
          <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
            {title}
          </h3>
        </div>

        {total > 1 && (
          <div className="text-[11px] font-bold text-slate-400 bg-slate-900/90 border border-slate-800 px-2.5 py-0.5 rounded-xl">
            <span className="text-white">{currentIndex + 1}</span> / {total}
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div
        className={`relative w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/90 shadow-2xl group select-none ${aspectClass}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slides Track */}
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {validImages.map((src, idx) => (
            <div
              key={idx}
              className="relative w-full h-full flex-shrink-0 cursor-zoom-in overflow-hidden"
              onClick={() => setIsLightboxOpen(true)}
            >
              <img
                src={src}
                alt={`${title} - Foto ${idx + 1}`}
                className="w-full h-full object-cover select-none"
                loading={idx === 0 ? "eager" : "lazy"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Action Button: Lightbox zoom */}
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-2xl bg-slate-950/75 backdrop-blur-md text-white/80 hover:text-white hover:bg-slate-900 border border-white/10 transition shadow-lg cursor-pointer"
          title="Ver en pantalla completa"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Prev / Next Controls (if > 1 image) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-2xl bg-slate-950/75 backdrop-blur-md text-white border border-white/10 flex items-center justify-center opacity-80 group-hover:opacity-100 hover:scale-105 transition shadow-lg cursor-pointer"
              title="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-2xl bg-slate-950/75 backdrop-blur-md text-white border border-white/10 flex items-center justify-center opacity-80 group-hover:opacity-100 hover:scale-105 transition shadow-lg cursor-pointer"
              title="Siguiente foto"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots Indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10">
              {validImages.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(dotIdx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    currentIndex === dotIdx
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  title={`Ir a imagen ${dotIdx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails Row (if > 1 image) */}
      {total > 1 && (
        <div className="grid grid-cols-4 gap-2 pt-1">
          {validImages.map((thumbSrc, tIdx) => {
            const isActive = currentIndex === tIdx;
            return (
              <button
                key={tIdx}
                type="button"
                onClick={() => setCurrentIndex(tIdx)}
                className={`relative aspect-[16/10] rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "ring-2 scale-102 opacity-100 shadow-md"
                    : "opacity-60 hover:opacity-90 border-slate-800"
                }`}
                style={{
                  borderColor: isActive ? themeColor : undefined,
                  boxShadow: isActive ? `0 0 12px ${themeColor}40` : undefined,
                }}
              >
                <img
                  src={thumbSrc}
                  alt={`Miniatura ${tIdx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[8px] font-black px-1 rounded bg-black/70 text-white">
                  {tIdx + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Full-screen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between max-w-5xl mx-auto w-full z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-white">
              <Camera className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold truncate">{title}</span>
              <span className="text-xs text-slate-400">
                ({currentIndex + 1} de {total})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Full Image */}
          <div
            className="relative flex-1 flex items-center justify-center max-w-5xl mx-auto w-full my-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={validImages[currentIndex]}
              alt={`${title} - Foto ampliada ${currentIndex + 1}`}
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />

            {/* Prev / Next inside Lightbox */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-white/20 flex items-center justify-center transition shadow-xl cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-white/20 flex items-center justify-center transition shadow-xl cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Thumbnails Bottom Bar */}
          {total > 1 && (
            <div
              className="flex items-center justify-center gap-3 max-w-md mx-auto w-full z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {validImages.map((src, lIdx) => (
                <button
                  key={lIdx}
                  type="button"
                  onClick={() => setCurrentIndex(lIdx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                    currentIndex === lIdx
                      ? "border-white scale-110 shadow-lg"
                      : "border-white/20 opacity-50 hover:opacity-80"
                  }`}
                >
                  <img
                    src={src}
                    alt={`Miniatura ${lIdx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
