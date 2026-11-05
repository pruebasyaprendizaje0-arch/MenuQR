"use client";

import React, { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  MapPin,
  Settings,
  Heart,
  UtensilsCrossed,
  BookOpen,
  Calendar,
  Bookmark,
  Wrench,
  Clock,
  ChevronRight,
  Sparkles,
  Phone,
  Bell,
  X,
  Compass,
  Store,
} from "lucide-react";
import {
  PassProfile,
  PassFavoritePlace,
  PassFavoriteItem,
  PassHistoryRecord,
  UbicameVertical,
  getPassProfile,
  savePassProfile,
  getPassFavoritePlaces,
  togglePassFavoritePlace,
  getPassFavoriteItems,
  getPassHistory,
  calculateDistanceKm,
  sanitizeImageUrl,
} from "@/lib/ubicame-pass";

interface Props {
  initialNetworkPlaces: PassFavoritePlace[];
  initialPopularItems: PassFavoriteItem[];
}

const VERTICAL_TABS: { id: UbicameVertical | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "Todos", icon: Compass },
  { id: "menuqr", label: "Restaurantes", icon: UtensilsCrossed },
  { id: "ctalo", label: "Catálogos", icon: BookOpen },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "reservas", label: "Reservas", icon: Bookmark },
  { id: "servicios", label: "Servicios", icon: Wrench },
];

export function UbicamePassClient({ initialNetworkPlaces, initialPopularItems }: Props) {
  // Suscripción segura para detección de hidratación sin render en cascada ni mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Estado de Perfil inicializado idéntico en SSR y cliente
  const [profile, setProfile] = useState<PassProfile>({
    name: "Invitado",
    phone: "",
    geoAlertsEnabled: true,
    updatedAt: "",
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Estado de Favoritos e Historial (valores iniciales seguros para SSR)
  const [favoritePlaces, setFavoritePlaces] = useState<PassFavoritePlace[]>(() =>
    initialNetworkPlaces.slice(0, 8)
  );
  const [favoriteItems, setFavoriteItems] = useState<PassFavoriteItem[]>(() =>
    initialPopularItems.slice(0, 8)
  );
  const [history, setHistory] = useState<PassHistoryRecord[]>([
    {
      id: "seed-1",
      type: "pedido",
      businessName: initialNetworkPlaces[0]?.name || "Mar y Sabor",
      businessSlug: initialNetworkPlaces[0]?.slug || "mar-y-sabor",
      vertical: "menuqr",
      date: "Hoy",
      time: "13:20",
      total: 18.5,
      status: "Entregado",
      details: "Almuerzo Ejecutivo + Bebida",
    },
    {
      id: "seed-2",
      type: "pedido",
      businessName: initialNetworkPlaces[1]?.name || "Café Manglar",
      businessSlug: initialNetworkPlaces[1]?.slug || "cafe-manglar",
      vertical: "menuqr",
      date: "Ayer",
      time: "09:15",
      total: 6.5,
      status: "Para llevar",
      details: "Café de especialidad + Tostada",
    },
  ]);

  // Cargar datos locales solo tras el montaje en el navegador
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = getPassProfile();
    setProfile(p);
    setEditName(p.name === "Invitado" ? "" : p.name);
    setEditPhone(p.phone);

    const savedPlaces = getPassFavoritePlaces();
    if (savedPlaces.length > 0) {
      setFavoritePlaces(savedPlaces);
    }

    const savedItems = getPassFavoriteItems();
    if (savedItems.length > 0) {
      // Priorizar los platos reales pedidos por el cliente al frente
      const userItemNames = new Set(savedItems.map((s) => s.name.toLowerCase().trim()));
      const extraPopular = initialPopularItems.filter(
        (i) => !userItemNames.has(i.name.toLowerCase().trim())
      );
      setFavoriteItems([...savedItems, ...extraPopular]);
    }

    const savedHistory = getPassHistory();
    if (savedHistory.length > 0) {
      setHistory(savedHistory);
    }
  }, [initialPopularItems]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filtro activo de vertical
  const [activeVertical, setActiveVertical] = useState<UbicameVertical | "all">("all");

  // Fallback de imágenes rotas
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Geolocalización del navegador
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatusMsg, setGeoStatusMsg] = useState<string>("");
  const [dismissGeoCard, setDismissGeoCard] = useState(false);

  // Solicitar geolocalización si las alertas están activas
  useEffect(() => {
    if (profile.geoAlertsEnabled && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatusMsg("Ubicación activa");
        },
        () => {
          setGeoStatusMsg("Ubicación aproximada");
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    }
  }, [profile.geoAlertsEnabled]);

  // Alternar switch de Alertas de proximidad
  const handleToggleGeoAlerts = () => {
    if (!profile) return;
    const nextState = !profile.geoAlertsEnabled;
    const updated = savePassProfile({ geoAlertsEnabled: nextState });
    setProfile(updated);

    if (nextState && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatusMsg("Ubicación activa");
        },
        () => {
          setGeoStatusMsg("Permiso de GPS declinado");
        }
      );
    }
  };

  // Guardar configuración del perfil
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = savePassProfile({
      name: editName.trim() || "Invitado",
      phone: editPhone.trim(),
    });
    setProfile(updated);
    setShowSettingsModal(false);
  };

  // Toggle de lugar favorito
  const handleTogglePlace = (place: PassFavoritePlace) => {
    const isNowFavorite = togglePassFavoritePlace(place);
    if (isNowFavorite) {
      setFavoritePlaces((prev) => [place, ...prev]);
    } else {
      setFavoritePlaces((prev) => prev.filter((p) => p.slug !== place.slug && p.id !== place.id));
    }
  };

  // Lugares calculados con distancia y filtrados por vertical
  const computedPlaces = useMemo(() => {
    return favoritePlaces
      .filter((p) => activeVertical === "all" || p.vertical === activeVertical)
      .map((p) => {
        let dist = p.distanceKm ?? null;
        if (userCoords && p.latitude && p.longitude) {
          dist = calculateDistanceKm(userCoords.lat, userCoords.lng, p.latitude, p.longitude);
        }
        return { ...p, calculatedDistance: dist };
      })
      .sort((a, b) => {
        if (a.calculatedDistance != null && b.calculatedDistance != null) {
          return a.calculatedDistance - b.calculatedDistance;
        }
        return 0;
      });
  }, [favoritePlaces, activeVertical, userCoords]);

  // Platos/Items favoritos filtrados por vertical
  const computedItems = useMemo(() => {
    return favoriteItems.filter((i) => activeVertical === "all" || i.vertical === activeVertical);
  }, [favoriteItems, activeVertical]);

  // Lugar más cercano para el banner de proximidad
  const nearestPlace = useMemo(() => {
    if (!userCoords || computedPlaces.length === 0) {
      return favoritePlaces[0] || initialNetworkPlaces[0] || null;
    }
    return computedPlaces[0] || null;
  }, [userCoords, computedPlaces, favoritePlaces, initialNetworkPlaces]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* HEADER SUPERIOR RESPONSIVE */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <MapPin className="w-5 h-5 fill-slate-950 stroke-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-base sm:text-lg text-white tracking-tight">Ubícame Pass</h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    PWA v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">Tu pase digital de fidelidad y pedidos multi-comercio</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/marketplace"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white border border-slate-800 transition"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Explorar Directorio</span>
            </Link>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 flex items-center gap-1.5 text-xs font-bold transition active:scale-95"
              title="Configuración de Perfil"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Configurar Perfil</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL: SIDEBAR + FEED (GRID MULTI-COLUMNA RESPONSIVE) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ============================================================== */}
          {/* COLUMNA IZQUIERDA: SIDEBAR DEL CLIENTE (STICKY EN PC)          */}
          {/* ============================================================== */}
          <aside className="lg:col-span-4 xl:col-span-4 space-y-5 lg:sticky lg:top-24">
            
            {/* Tarjeta de Perfil del Cliente */}
            <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-900/60 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
                    <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                      {mounted && profile?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sanitizeImageUrl(profile.avatarUrl)}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-black text-emerald-400" suppressHydrationWarning>
                          {mounted ? (profile?.name || "U")[0]?.toUpperCase() : "U"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md active:scale-90 transition hover:bg-emerald-400"
                    title="Editar Perfil"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black text-white truncate" suppressHydrationWarning>
                    {mounted && profile?.name && profile.name !== "Invitado" ? profile.name : "¡Hola, Comensal!"}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-mono truncate" suppressHydrationWarning>
                      {mounted && profile?.phone ? profile.phone : "Sin teléfono registrado"}
                    </span>
                  </div>
                  {geoStatusMsg && (
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-400/90 mt-1 font-semibold">
                      <Compass className="w-3.5 h-3.5 animate-spin-slow text-teal-400" />
                      <span>{geoStatusMsg}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Switch de Alerta de Proximidad */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Avisarme cerca de mis lugares</span>
                  <p className="text-[11px] text-slate-400">Alertas de proximidad y pedidos rápidos GPS</p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleGeoAlerts}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1 ${
                    mounted && profile?.geoAlertsEnabled
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{mounted && profile?.geoAlertsEnabled ? "ON" : "OFF"}</span>
                </button>
              </div>

              {/* Métricas Rápidas del Pase */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <span className="block text-base font-black text-white font-mono">{favoritePlaces.length}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Lugares</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <span className="block text-base font-black text-emerald-400 font-mono">{favoriteItems.length}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Favoritos</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <span className="block text-base font-black text-teal-300 font-mono">{history.length}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Pedidos</span>
                </div>
              </div>
            </div>

            {/* Banner de Proximidad Geofence (En PC queda visible en el sidebar) */}
            {!dismissGeoCard && nearestPlace && (
              <div className="p-4 rounded-3xl bg-gradient-to-tr from-teal-950/80 via-slate-900 to-emerald-950/70 border border-teal-500/40 shadow-xl space-y-3 animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 animate-bounce-slow" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">
                        Cerca de ti en {nearestPlace.city || nearestPlace.name}
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                        ¡Estás a pocos pasos de <strong className="text-teal-300 font-bold">{nearestPlace.name}</strong>! ¿Quieres tu orden habitual?
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setDismissGeoCard(true)}
                    className="text-slate-500 hover:text-slate-300 p-1"
                    title="Cerrar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDismissGeoCard(true)}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 font-bold text-xs hover:bg-slate-800 transition text-center"
                  >
                    Ahora no
                  </button>

                  <Link
                    href={`/${nearestPlace.slug}`}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:from-teal-400 hover:to-emerald-400 transition text-center shadow-lg shadow-teal-500/20 active:scale-95"
                  >
                    Pedir ahora
                  </Link>
                </div>
              </div>
            )}

            {/* Navegación Rápida de Categorías en PC (Lista vertical con contadores) */}
            <div className="hidden lg:block p-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold uppercase tracking-wider mb-2">
                <span>Categorías de Negocios</span>
                <span className="text-emerald-400 text-[10px]">5 Verticals</span>
              </div>

              <div className="space-y-1">
                {VERTICAL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeVertical === tab.id;
                  const count =
                    tab.id === "all"
                      ? favoritePlaces.length
                      : favoritePlaces.filter((p) => p.vertical === tab.id).length;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveVertical(tab.id)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                        isActive
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                          : "bg-slate-950/60 text-slate-300 border-slate-800/80 hover:border-slate-700 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-emerald-400"}`} />
                        <span>{tab.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isActive ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ============================================================== */}
          {/* COLUMNA DERECHA: CONTENIDO PRINCIPAL (FEED EXPANDIDO EN PC)    */}
          {/* ============================================================== */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-8">
            
            {/* PASTILLAS HORIZONTALES PARA MÓVIL Y TABLET */}
            <div className="block lg:hidden space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold uppercase tracking-wider">
                <span>Explorar Ecosistema</span>
                <span className="text-emerald-400 text-[10px]">5 Verticals</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {VERTICAL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeVertical === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveVertical(tab.id)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border active:scale-95 ${
                        isActive
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-slate-950" : "text-emerald-400"}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 1: MIS LUGARES FAVORITOS (GRID EXPANDIDO EN PC) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
                    <span>Mis Lugares Favoritos</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Comercios recurrentes y guardados para visita frecuente</p>
                </div>
                <Link href="/marketplace" className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  <span>Ver todos</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {computedPlaces.length === 0 ? (
                <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <Compass className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-400">Aún no tienes lugares guardados en esta categoría.</p>
                  <Link href="/marketplace" className="inline-block text-xs text-emerald-400 font-bold hover:underline">
                    Explorar directorio comercial →
                  </Link>
                </div>
              ) : (
                <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
                  {computedPlaces.map((place, idx) => {
                    const url = `/${place.slug}`;
                    const imgKey = `place-${place.id || place.slug}`;
                    const isBroken = brokenImages[imgKey];
                    const safeCover = isBroken
                      ? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80"
                      : sanitizeImageUrl(
                          place.coverUrl || place.logoUrl,
                          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80"
                        );

                    return (
                      <div
                        key={`place-${place.id || place.slug}-${idx}`}
                        className="w-48 sm:w-auto shrink-0 rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl hover:border-slate-700 transition flex flex-col justify-between group"
                      >
                        <div className="relative h-32 sm:h-36 bg-slate-950 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={safeCover}
                            onError={() => setBrokenImages((prev) => ({ ...prev, [imgKey]: true }))}
                            alt={place.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <button
                            onClick={() => handleTogglePlace(place)}
                            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-slate-950/70 backdrop-blur-md text-rose-400 flex items-center justify-center hover:bg-slate-950 transition active:scale-90"
                            title="Quitar de favoritos"
                          >
                            <Heart className="w-4 h-4 fill-rose-500 stroke-rose-500" />
                          </button>

                          <div className="absolute bottom-2 left-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-slate-800 px-2 py-0.5 rounded-full">
                              {place.vertical}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-white truncate">{place.name}</h4>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate">
                                {place.calculatedDistance != null
                                  ? `${place.calculatedDistance} km · `
                                  : ""}
                                {place.category || place.city || "Comercio asociado"}
                              </span>
                            </div>
                          </div>

                          <Link
                            href={url}
                            className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-bold text-center block transition shadow-sm active:scale-95"
                          >
                            Ver Menú / Tienda
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECCIÓN 2: MIS PLATOS / PRODUCTOS HABITUALES (GRID DE 3-4 EN PC) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Mis Platos & Productos Habituales</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Tus pedidos más repetidos con opción de reordenar en 1 clic</p>
                </div>
                <span className="text-xs text-slate-400 font-mono">{computedItems.length} items</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                {computedItems.map((item, idx) => {
                  const targetUrl = `/${item.businessSlug}`;
                  const imgKey = `item-${item.id}`;
                  const isBroken = brokenImages[imgKey];
                  const safeImg = isBroken
                    ? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80"
                    : sanitizeImageUrl(
                        item.imageUrl,
                        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80"
                      );

                  return (
                    <div
                      key={`item-${item.id}-${idx}`}
                      className="rounded-3xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between space-y-3 shadow-xl hover:border-slate-700 transition group"
                    >
                      <div className="space-y-2.5">
                        <div className="h-32 sm:h-36 rounded-2xl bg-slate-950 overflow-hidden relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={safeImg}
                            onError={() => setBrokenImages((prev) => ({ ...prev, [imgKey]: true }))}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-black text-emerald-400 font-mono border border-slate-800">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{item.name}</h4>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{item.businessName}</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[11px] text-amber-300 font-semibold block">
                          Favorito · {item.orderCount} {item.orderCount === 1 ? "pedido" : "pedidos"}
                        </span>
                        <Link
                          href={targetUrl}
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider text-center block transition shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                          Pedir de nuevo
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECCIÓN 3: HISTORIAL UNIFICADO DE ACTIVIDAD */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-teal-400" />
                    <span>Historial de Visitas & Pedidos</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Registro unificado de compras y servicios en la red Ubícame</p>
                </div>
                <span className="text-xs text-slate-400 font-mono">{history.length} registros</span>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 divide-y divide-slate-800/80 shadow-xl">
                {history.map((rec, idx) => (
                  <div key={`hist-${rec.id}-${idx}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-bold text-white truncate">{rec.businessName}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">
                          {rec.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate pl-4">
                        {rec.date} {rec.time ? `· ${rec.time}` : ""} {rec.details ? `· ${rec.details}` : ""}
                      </p>
                    </div>

                    {rec.total != null && (
                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-base text-emerald-400 block">${rec.total.toFixed(2)}</span>
                        {rec.status && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {rec.status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* MODAL DE EDICIÓN DE PERFIL SIN CONTRASEÑA */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white">Mi Ubícame Pass</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tu Nombre o Apodo</label>
                <input
                  type="text"
                  placeholder="Ej. Frank Hernandez"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">WhatsApp / Teléfono</label>
                <input
                  type="tel"
                  placeholder="Ej. 0994916812"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Se usa exclusivamente para auto-completar tus pedidos y citas. No compartimos tus datos.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-600/20"
                >
                  Guardar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
