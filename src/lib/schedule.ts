export type DaySchedule = {
  active: boolean;
  open: string;  // e.g. "08:00"
  close: string; // e.g. "22:00"
};

export type WeeklySchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export type BlockedDateItem = {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string;
  fullDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
};

export type ScheduleCheckResult = {
  isOpen: boolean;
  isBlocked: boolean;
  reason?: string;
  scheduleText?: string;
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { active: true, open: "08:00", close: "22:00" },
  tuesday: { active: true, open: "08:00", close: "22:00" },
  wednesday: { active: true, open: "08:00", close: "22:00" },
  thursday: { active: true, open: "08:00", close: "22:00" },
  friday: { active: true, open: "08:00", close: "22:00" },
  saturday: { active: true, open: "08:00", close: "22:00" },
  sunday: { active: true, open: "08:00", close: "22:00" },
};

const DAY_KEYS: (keyof WeeklySchedule)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const DAY_LABELS: Record<keyof WeeklySchedule, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export function parseWeeklySchedule(rawJson: string | null | undefined): WeeklySchedule {
  if (!rawJson) return DEFAULT_WEEKLY_SCHEDULE;
  try {
    const parsed = JSON.parse(rawJson);
    return {
      monday: parsed.monday || DEFAULT_WEEKLY_SCHEDULE.monday,
      tuesday: parsed.tuesday || DEFAULT_WEEKLY_SCHEDULE.tuesday,
      wednesday: parsed.wednesday || DEFAULT_WEEKLY_SCHEDULE.wednesday,
      thursday: parsed.thursday || DEFAULT_WEEKLY_SCHEDULE.thursday,
      friday: parsed.friday || DEFAULT_WEEKLY_SCHEDULE.friday,
      saturday: parsed.saturday || DEFAULT_WEEKLY_SCHEDULE.saturday,
      sunday: parsed.sunday || DEFAULT_WEEKLY_SCHEDULE.sunday,
    };
  } catch (e) {
    return DEFAULT_WEEKLY_SCHEDULE;
  }
}

export function parseBlockedDates(rawJson: string | null | undefined): BlockedDateItem[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function isRestaurantOpen(
  restaurant: {
    schedule?: string | null;
    localSchedule?: string | null;
    deliverySchedule?: string | null;
    blockedDates?: string | null;
  },
  serviceType: "local" | "delivery" = "local",
  customDate: Date = new Date()
): ScheduleCheckResult {
  const now = customDate;

  // 1. Check Blocked Dates
  const blockedList = parseBlockedDates(restaurant.blockedDates);
  // Date in YYYY-MM-DD format (local timezone)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const currentDateStr = `${year}-${month}-${day}`;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const item of blockedList) {
    if (item.date === currentDateStr) {
      if (item.fullDay) {
        return {
          isOpen: false,
          isBlocked: true,
          reason: `Cierre especial: ${item.reason || "Día no laborable"}`,
        };
      }
      if (item.startTime && item.endTime) {
        const [sH, sM] = item.startTime.split(":").map(Number);
        const [eH, eM] = item.endTime.split(":").map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          return {
            isOpen: false,
            isBlocked: true,
            reason: `Cierre temporal (${item.startTime} - ${item.endTime}): ${item.reason || "Mantenimiento / Evento"}`,
          };
        }
      }
    }
  }

  // 2. Check Weekly Schedule
  const scheduleJson =
    serviceType === "delivery"
      ? restaurant.deliverySchedule || restaurant.localSchedule
      : restaurant.localSchedule;

  const weeklySchedule = parseWeeklySchedule(scheduleJson);
  const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday...
  const dayKey = DAY_KEYS[dayIndex];
  const dayConfig = weeklySchedule[dayKey];

  if (!dayConfig || !dayConfig.active) {
    return {
      isOpen: false,
      isBlocked: false,
      reason: `Cerrado los días ${DAY_LABELS[dayKey]}`,
    };
  }

  const [openH, openM] = dayConfig.open.split(":").map(Number);
  const [closeH, closeM] = dayConfig.close.split(":").map(Number);

  const openMin = openH * 60 + openM;
  let closeMin = closeH * 60 + closeM;

  // Handle midnight crossing (e.g. 18:00 to 02:00 next day)
  if (closeMin <= openMin) {
    closeMin += 24 * 60;
  }

  const checkMin = currentMinutes < openMin && closeMin > 24 * 60
    ? currentMinutes + 24 * 60
    : currentMinutes;

  if (checkMin >= openMin && checkMin <= closeMin) {
    return {
      isOpen: true,
      isBlocked: false,
      scheduleText: `${DAY_LABELS[dayKey]}: ${dayConfig.open} - ${dayConfig.close}`,
    };
  }

  return {
    isOpen: false,
    isBlocked: false,
    reason: `Fuera de horario (${dayConfig.open} - ${dayConfig.close})`,
    scheduleText: `${DAY_LABELS[dayKey]}: ${dayConfig.open} - ${dayConfig.close}`,
  };
}
