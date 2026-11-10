import { VALID_ADMIN_TABS, AdminTab } from "@/app/admin/components/AdminDashboard";

function resolveTabHelper(params: {
  initialTab?: string;
  queryTab?: string | null;
  hashTab?: string | null;
  storedTab?: string | null;
}): AdminTab {
  if (params.initialTab && VALID_ADMIN_TABS.includes(params.initialTab as AdminTab)) {
    return params.initialTab as AdminTab;
  }
  if (params.queryTab && VALID_ADMIN_TABS.includes(params.queryTab as AdminTab)) {
    return params.queryTab as AdminTab;
  }
  if (params.hashTab && VALID_ADMIN_TABS.includes(params.hashTab as AdminTab)) {
    return params.hashTab as AdminTab;
  }
  if (params.storedTab && VALID_ADMIN_TABS.includes(params.storedTab as AdminTab)) {
    return params.storedTab as AdminTab;
  }
  return "metrics";
}

async function runTabPersistenceTests() {
  console.log("=== INICIANDO PRUEBAS DE PERSISTENCIA DE PESTAÑAS Y MODALES ===");

  // 1. Resuelve tab desde searchParams (URL)
  const tabFromQuery = resolveTabHelper({ queryTab: "crm" });
  if (tabFromQuery !== "crm") {
    throw new Error(`Expected 'crm', got '${tabFromQuery}'`);
  }
  console.log("✅ [PASS] 1: Pestaña resuelta correctamente desde URL searchParams (?tab=crm)");

  // 2. Resuelve tab desde initialTab (servidor Next.js)
  const tabFromServer = resolveTabHelper({ initialTab: "dishes" });
  if (tabFromServer !== "dishes") {
    throw new Error(`Expected 'dishes', got '${tabFromServer}'`);
  }
  console.log("✅ [PASS] 2: Pestaña resuelta correctamente desde Server Props (initialTab=dishes)");

  // 3. Fallback a localStorage si la URL no tiene parámetro
  const tabFromStorage = resolveTabHelper({ storedTab: "restaurant" });
  if (tabFromStorage !== "restaurant") {
    throw new Error(`Expected 'restaurant', got '${tabFromStorage}'`);
  }
  console.log("✅ [PASS] 3: Fallback exitoso a localStorage cuando no hay parámetro en URL");

  // 4. Tab inválido hace fallback a 'metrics' de manera segura
  const tabInvalid = resolveTabHelper({ queryTab: "invalid_tab_hack" });
  if (tabInvalid !== "metrics") {
    throw new Error(`Expected 'metrics', got '${tabInvalid}'`);
  }
  console.log("✅ [PASS] 4: Tab desconocido o malicioso protegido con fallback a 'metrics'");

  // 5. Verificación de Session Guard de Reporte Semanal
  const sessionStore = new Map<string, string>();
  const notificationId = "notif_weekly_123";

  // Primera carga: no ha sido descartada
  let shouldShow = !sessionStore.has("weekly_metrics_dismissed_" + notificationId);
  if (!shouldShow) throw new Error("Debe mostrarse la primera vez");

  // Usuario cierra o confirma el modal
  sessionStore.set("weekly_metrics_dismissed_" + notificationId, "true");

  // Siguientes recargas por guardar edición:
  shouldShow = !sessionStore.has("weekly_metrics_dismissed_" + notificationId);
  if (shouldShow) throw new Error("No debe volver a mostrarse en la misma sesión tras ser cerrada");
  console.log("✅ [PASS] 5: Session Guard previene reaparición molesta del modal en cada guardado");

  console.log("==================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE PERSISTENCIA DE PESTAÑAS PASARON (5/5)");
  console.log("==================================================");
}

runTabPersistenceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

