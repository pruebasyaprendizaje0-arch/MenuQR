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
      fetchPriority="high"
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
  icon?: React.ReactNode;
}

export function SmartCover({
  src,
  alt,
  name,
  className = "w-full h-full object-cover",
  themeColor,
  icon,
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
              <div className="h-10 w-10 text-amber-400 animate-bounce flex items-center justify-center font-black">
                {getInitials(name)}
              </div>
            </div>
          )}
          <img
            src={cleanSrc}
            alt={alt || name}
            loading="eager"
            // @ts-ignore
            fetchPriority="high"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`${className} transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950"
          style={{ backgroundColor: themeColor ? `${themeColor}cc` : undefined }}
        >
          {icon ? (
            <div className="text-amber-400">{icon}</div>
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black text-amber-400 shadow-xl">
              {getInitials(name)}
            </div>
          )}
          <span className="font-extrabold text-xl tracking-tight max-w-[85%] truncate">{name}</span>
        </div>
      )}
    </div>
  );
}
