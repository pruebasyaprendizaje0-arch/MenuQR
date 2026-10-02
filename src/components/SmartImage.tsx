"use client";

import React, { useState } from "react";
import { Utensils } from "lucide-react";

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "QR";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}

interface SmartLogoProps {
  src?: string | null;
  alt?: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
  themeColor?: string | null;
}

export function SmartLogo({
  src,
  alt,
  name,
  className = "h-12 w-12 rounded-2xl object-cover border border-slate-800 shadow-md",
  fallbackClassName,
  themeColor,
}: SmartLogoProps) {
  const [hasError, setHasError] = useState(false);
  const cleanSrc = src && src.trim() !== "" ? src.trim() : null;

  if (!cleanSrc || hasError) {
    return (
      <div
        className={
          fallbackClassName ||
          `${className.replace(/object-\w+/g, "")} flex items-center justify-center font-extrabold text-amber-400 border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 shadow-md shrink-0 select-none`
        }
        style={{
          backgroundColor: themeColor ? `${themeColor}dd` : undefined,
        }}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt || name}
      loading="eager"
      // @ts-ignore
      fetchpriority="high"
      decoding="async"
      onError={() => setHasError(true)}
      className={`${className} shrink-0 bg-slate-900`}
    />
  );
}

interface SmartCoverProps {
  src?: string | null;
  alt?: string;
  name: string;
  className?: string;
  themeColor?: string | null;
}

export function SmartCover({
  src,
  alt,
  name,
  className = "w-full h-full object-cover",
  themeColor,
}: SmartCoverProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const cleanSrc = src && src.trim() !== "" ? src.trim() : null;

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      {cleanSrc && !hasError ? (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-slate-900/90 animate-pulse flex items-center justify-center">
              <Utensils className="h-10 w-10 text-slate-700 animate-bounce" />
            </div>
          )}
          <img
            src={cleanSrc}
            alt={alt || name}
            loading="eager"
            // @ts-ignore
            fetchpriority="high"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`${className} transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950"
          style={{ backgroundColor: themeColor ? `${themeColor}cc` : undefined }}
        >
          <Utensils className="h-16 w-16 opacity-80 text-amber-400 animate-pulse" />
          <span className="font-extrabold text-xl tracking-tight">{name}</span>
        </div>
      )}
    </div>
  );
}
