"use client";

import React from "react";
import { MessageSquare } from "lucide-react";

export interface FloatingWhatsAppButtonProps {
  phone?: string | null;
  businessName: string;
  customMessage?: string;
  className?: string;
  bottomOffsetClass?: string;
  title?: string;
}

/**
 * Normaliza cualquier formato de teléfono (con o sin código de país, ceros o guiones)
 * garantizando que funcione de inmediato para Ecuador (593) o internacional.
 */
export function formatWhatsappPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  let clean = rawPhone.toString().replace(/\D/g, "");
  if (!clean) return "";

  // Si empieza con 09 (móvil Ecuador estándar: 09XXXXXXXX)
  if (clean.length === 10 && clean.startsWith("09")) {
    return "593" + clean.substring(1);
  }
  // Si empieza con 0 (fijo o móvil: 0XXXXXXXXX)
  if (clean.startsWith("0")) {
    return "593" + clean.substring(1);
  }
  // Si tiene 9 dígitos (móvil sin el primer cero: 9XXXXXXXX)
  if (clean.length === 9) {
    return "593" + clean;
  }
  // Si ya tiene código internacional o formato completo
  return clean;
}

export function FloatingWhatsAppButton({
  phone,
  businessName,
  customMessage,
  className = "",
  bottomOffsetClass = "bottom-20 right-4 sm:bottom-8 sm:right-8",
  title = "Chatear por WhatsApp",
}: FloatingWhatsAppButtonProps) {
  const formattedPhone = formatWhatsappPhone(phone);
  if (!formattedPhone) return null;

  const defaultMsg = `¡Hola! Me gustaría recibir información de *${businessName}*.`;
  const messageText = customMessage || defaultMsg;
  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contactar a ${businessName} por WhatsApp`}
      className={`fixed ${bottomOffsetClass} z-40 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-[0_10px_30px_rgba(37,211,102,0.45)] hover:shadow-[0_15px_35px_rgba(37,211,102,0.65)] transition-all duration-300 hover:scale-105 active:scale-95 group/wa cursor-pointer select-none ${className}`}
      title={title}
    >
      <div className="relative flex items-center justify-center">
        <MessageSquare className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-white shrink-0 group-hover/wa:rotate-12 transition-transform duration-300" />
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-200 animate-ping opacity-75 pointer-events-none"></span>
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white pointer-events-none"></span>
      </div>
      <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">
        WhatsApp
      </span>
    </a>
  );
}
