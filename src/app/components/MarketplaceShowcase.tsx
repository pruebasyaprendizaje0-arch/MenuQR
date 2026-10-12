"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, UtensilsCrossed, ShoppingBag, ArrowRight, MapPin, MessageCircle, ExternalLink, Tag } from "lucide-react";
import type { MarketplaceItem } from "@/lib/suggested-dishes-actions";

export function MarketplaceShowcase({
  initialDishes,
  restaurantCount,
  storeCount,
}: {
  initialDishes: MarketplaceItem[];
  restaurantCount: number;
  storeCount: number;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "restaurant" | "store">("all");

  const filteredDishes = initialDishes.filter((dish) => {
    if (activeTab === "all") return true;
    return dish.itemType === activeTab;
  });

  // Mostrar un máximo de 8 en el teaser de la home para mantener velocidad y elegancia
  const displayDishes = filteredDishes.slice(0, 8);

  const getWhatsappUrl = (dish: MarketplaceItem) => {
    const rawPhone = dish.restaurant.whatsapp || "593999999999";
    let formattedPhone = rawPhone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("593") && formattedPhone.startsWith("0")) {
      formattedPhone = "593" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("593") && formattedPhone.length === 9) {
      formattedPhone = "593" + formattedPhone;
    }
    const msg = `Hola *${dish.restaurant.name}*, vi su especial sugerido *${dish.name}* ($${dish.price.toFixed(2)}) en el Marketplace de MenuQR Pro y deseo realizar un pedido.`;
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <section className="w-full space-y-8 pt-8 pb-4">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          Vitrina de Especiales del Día
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
          Sugeridos de Hoy en Gastronomía y Comercios
        </h2>
        <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
          Los platillos insignia recomendados por chefs y los productos destacados en catálogos de tiendas locales, listos para ordenar directo a WhatsApp.
        </p>
      </div>

      {/* Segmented Filter Switch */}
      <div className="flex justify-center items-center">
        <div className="inline-flex p-1.5 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-xl gap-1.5 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>✨ Ver Todo</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-950/60 text-slate-200">
              {initialDishes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("restaurant")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "restaurant"
                ? "bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md shadow-red-600/20"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
            <span>🍽️ Gastronomía (Platos del Día)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-950/60 text-amber-300">
              {restaurantCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "store"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-600/20"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
            <span>🛍️ Tiendas & Comercios</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-950/60 text-cyan-300">
              {storeCount}
            </span>
          </button>
        </div>
      </div>

      {/* Grid of Product Cards */}
      {displayDishes.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 max-w-lg mx-auto shadow-2xl space-y-3">
          <Tag className="w-10 h-10 text-slate-500 mx-auto" />
          <h4 className="text-white font-bold text-sm">No hay productos sugeridos en esta categoría</h4>
          <p className="text-slate-400 text-xs">
            Pronto se agregarán nuevos especiales sugeridos por los restaurantes y tiendas registrados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayDishes.map((item) => {
            const isStore = item.itemType === "store";
            return (
              <div
                key={item.id}
                className="group bg-slate-900/95 border border-slate-700/80 hover:border-amber-400/90 rounded-3xl overflow-hidden flex flex-col justify-between shadow-xl hover:shadow-[0_16px_36px_rgba(0,0,0,0.7)] transition-all duration-300 transform hover:-translate-y-1 backdrop-blur-xl"
              >
                {/* Media Container with Badges */}
                <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden border-b border-slate-800">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                      {isStore ? (
                        <ShoppingBag className="w-12 h-12 text-slate-500" />
                      ) : (
                        <UtensilsCrossed className="w-12 h-12 text-slate-500" />
                      )}
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {item.categoryName}
                      </span>
                    </div>
                  )}

                  {/* Badge Tipo: Restaurante vs Tienda */}
                  <div className="absolute top-3 left-3">
                    {isStore ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600/90 text-white shadow-md backdrop-blur-md flex items-center gap-1 border border-blue-400/30">
                        <ShoppingBag className="w-3 h-3 text-cyan-200" /> Tienda
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md backdrop-blur-md flex items-center gap-1 border border-amber-400/30">
                        <UtensilsCrossed className="w-3 h-3 text-amber-200" /> Plato del Día
                      </span>
                    )}
                  </div>

                  {/* Price Tag Float */}
                  <div className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-700/90 backdrop-blur-md px-3 py-1 rounded-xl shadow-lg">
                    <span className="text-emerald-400 font-black text-sm tracking-tight">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* Item Name */}
                    <h3 className="text-white font-extrabold text-base leading-snug group-hover:text-amber-400 transition-colors line-clamp-1">
                      {item.name}
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 font-normal">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Restaurant / Store Info */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <Link
                      href={`/${item.restaurant.slug}`}
                      className="flex items-center justify-between text-xs group/loc hover:text-amber-300 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {item.restaurant.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-200 group-hover/loc:text-amber-400 truncate text-xs">
                          {item.restaurant.name}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover/loc:text-amber-400 shrink-0 ml-1" />
                    </Link>

                    {item.restaurant.locality && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium truncate">
                        <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{item.restaurant.locality}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/${item.restaurant.slug}`}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-[11px] text-center border border-slate-700 transition"
                    >
                      Ver Menú
                    </Link>
                    <a
                      href={getWhatsappUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] text-center shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1 active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Pedir
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Call to action to view entire marketplace */}
      <div className="pt-4 flex justify-center">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 hover:from-amber-400 hover:to-red-500 shadow-xl shadow-orange-950/30 transform hover:scale-[1.02] transition-all duration-200"
        >
          <span>Explorar Todo el Marketplace de Productos y Menús</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
