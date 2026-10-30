"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { CleanInAppNotification } from "@/lib/notifications";
import { AdminStickyBanner } from "./AdminStickyBanner";
import { AdminWeeklyMetricsModal } from "./AdminWeeklyMetricsModal";

interface NotificationContextValue {
  notifications: CleanInAppNotification[];
  unreadCount: number;
  activeBanner: CleanInAppNotification | null;
  metricsModalNotification: CleanInAppNotification | null;
  showMetricsModal: boolean;
  setShowMetricsModal: (show: boolean) => void;
  openMetricsModal: (notification: CleanInAppNotification) => void;
  markAsRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications debe usarse dentro de un AdminNotificationProvider");
  }
  return context;
}

interface AdminNotificationHostProps {
  restaurantId: string;
  initialNotifications?: CleanInAppNotification[];
  children?: React.ReactNode;
}

export function AdminNotificationProvider({
  restaurantId,
  initialNotifications = [],
  children,
}: AdminNotificationHostProps) {
  const [notifications, setNotifications] = useState<CleanInAppNotification[]>(initialNotifications);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<Set<string>>(new Set());

  // Encontrar la primera notificación de resumen semanal no leída
  const initialWeeklyReport = useMemo(() => {
    return initialNotifications.find(
      (n) => n.type === "METRIC_SUMMARY" && !n.isRead
    ) || null;
  }, [initialNotifications]);

  const [metricsModalNotification, setMetricsModalNotification] = useState<CleanInAppNotification | null>(
    initialWeeklyReport
  );
  const [showMetricsModal, setShowMetricsModal] = useState<boolean>(Boolean(initialWeeklyReport));

  // Notificación más prioritaria vigente para el banner
  const activeBanner = useMemo(() => {
    return (
      notifications.find(
        (n) =>
          !dismissedBannerIds.has(n.id) &&
          (n.priority === "URGENT" || n.priority === "HIGH" || n.type === "WARNING_EXPIRING" || n.type === "SUSPENDED")
      ) || null
    );
  }, [notifications, dismissedBannerIds]);

  // Contador de no leídas
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Función para refrescar notificaciones desde la API
  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(`/api/admin/notifications?restaurantId=${encodeURIComponent(restaurantId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);

          // Si hay un reporte semanal nuevo y no leído, prepararlo para el modal
          const unreadMetric = data.notifications.find(
            (n: CleanInAppNotification) => n.type === "METRIC_SUMMARY" && !n.isRead
          );
          if (unreadMetric && !metricsModalNotification) {
            setMetricsModalNotification(unreadMetric);
            setShowMetricsModal(true);
          }
        }
      }
    } catch (err) {
      console.warn("No se pudieron refrescar las notificaciones in-app:", err);
    }
  }, [restaurantId, metricsModalNotification]);

  // Polling suave cada 90 segundos únicamente si la pestaña está enfocada
  useEffect(() => {
    if (!restaurantId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (document.visibilityState === "visible") {
            refresh();
          }
        }, 90000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
    };
  }, [restaurantId, refresh]);

  // Mutación Optimista: Marcar como leída
  const markAsRead = useCallback(
    async (id: string) => {
      // 1. Actualización optimista inmediata en memoria
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );

      // 2. Disparo asíncrono en segundo plano
      try {
        await fetch(`/api/admin/notifications/${id}/read`, {
          method: "PATCH",
        });
      } catch (err) {
        console.error("Error al sincronizar lectura de notificación:", err);
      }
    },
    []
  );

  // Mutación Optimista: Descartar del banner
  const dismiss = useCallback(
    async (id: string) => {
      // 1. Ocultar inmediatamente de la vista
      setDismissedBannerIds((prev) => new Set(prev).add(id));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );

      // 2. Disparo asíncrono en segundo plano
      try {
        await fetch(`/api/admin/notifications/${id}/dismiss`, {
          method: "PATCH",
        });
      } catch (err) {
        console.error("Error al sincronizar descarte de notificación:", err);
      }
    },
    []
  );

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Actualización optimista de todos los elementos
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );

    // Enviar peticiones en paralelo
    await Promise.allSettled(
      unreadIds.map((id) =>
        fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" })
      )
    );
  }, [notifications]);

  // Abrir modal de métricas a demanda
  const openMetricsModal = useCallback((notification: CleanInAppNotification) => {
    setMetricsModalNotification(notification);
    setShowMetricsModal(true);
  }, []);

  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      activeBanner,
      metricsModalNotification,
      showMetricsModal,
      setShowMetricsModal,
      openMetricsModal,
      markAsRead,
      dismiss,
      markAllAsRead,
      refresh,
    }),
    [
      notifications,
      unreadCount,
      activeBanner,
      metricsModalNotification,
      showMetricsModal,
      openMetricsModal,
      markAsRead,
      dismiss,
      markAllAsRead,
      refresh,
    ]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {/* Banner Sticky Superior para alertas de alta prioridad */}
      {activeBanner && (
        <AdminStickyBanner
          notification={activeBanner}
          onDismiss={dismiss}
          onActionClick={(notif) => {
            if (notif.type === "METRIC_SUMMARY") {
              openMetricsModal(notif);
            }
          }}
        />
      )}

      {/* Modal flotante de Resumen Semanal de Operaciones */}
      {showMetricsModal && metricsModalNotification && (
        <AdminWeeklyMetricsModal
          notification={metricsModalNotification}
          onClose={() => setShowMetricsModal(false)}
          onMarkAsRead={markAsRead}
        />
      )}

      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Componente Host que puede montarse directamente en AdminLayout.
 * Si recibe children, envuelve el contenido como Provider.
 */
export function AdminNotificationHost({
  restaurantId,
  initialNotifications = [],
  children,
}: AdminNotificationHostProps) {
  return (
    <AdminNotificationProvider
      restaurantId={restaurantId}
      initialNotifications={initialNotifications}
    >
      {children}
    </AdminNotificationProvider>
  );
}
