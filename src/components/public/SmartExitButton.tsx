"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

interface SmartExitButtonProps {
  fallbackUrl: string;
  title?: string;
  className?: string;
  iconClassName?: string;
}

export function SmartExitButton({
  fallbackUrl,
  title = "Salir / Volver a la vitrina",
  className = "p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer shadow-md active:scale-95 flex items-center justify-center shrink-0",
  iconClassName = "h-5 w-5",
}: SmartExitButtonProps) {
  const router = useRouter();

  const handleExit = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      // Si el cliente navegó desde nuestro propio dominio/marketplace
      const hasInternalReferrer =
        document.referrer && document.referrer.includes(window.location.host);

      if (window.history.length > 1 && hasInternalReferrer) {
        window.history.back();
        return;
      }
    }
    // Fallback seguro a la vitrina de la vertical
    router.push(fallbackUrl);
  };

  return (
    <button
      type="button"
      onClick={handleExit}
      className={className}
      title={title}
      aria-label={title}
    >
      <LogOut className={iconClassName} />
    </button>
  );
}
