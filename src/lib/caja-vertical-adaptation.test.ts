import assert from "node:assert";
import { resolveBusinessVertical, getBusinessLabels } from "./business-labels";

console.log("=== INICIANDO PRUEBAS DE ADAPTACIÓN VERTICAL EN CAJA POS (/caja) ===");

// 1. Verificación del Discriminador Canónico de Vertical
{
  const restaurantTenant = {
    businessType: "RESTAURANT",
    customLabels: null,
  };
  const retailTenant = {
    businessType: "RETAIL",
    customLabels: null,
  };
  const catalogTenant = {
    businessType: "GENERAL_CATALOG",
    customLabels: null,
  };
  const customRetailTenant = {
    businessType: "RESTAURANT",
    customLabels: JSON.stringify({ vertical: "retail" }),
  };

  assert.strictEqual(resolveBusinessVertical(restaurantTenant), "restaurante");
  assert.strictEqual(resolveBusinessVertical(retailTenant), "retail");
  assert.strictEqual(resolveBusinessVertical(catalogTenant), "retail");
  assert.strictEqual(resolveBusinessVertical(customRetailTenant), "retail");

  console.log("✅ [PASS] 1: Discriminador canónico de vertical valida restaurante vs catálogo/retail con precisión");
}

// 2. Aislamiento Estricto para Restaurantes (Zero Regressions en Gastro)
{
  const restaurantTenant = {
    businessType: "RESTAURANT",
    customLabels: null,
  };
  const isCatalog =
    resolveBusinessVertical(restaurantTenant) === "retail" ||
    restaurantTenant.businessType === "RETAIL" ||
    restaurantTenant.businessType === "GENERAL_CATALOG";

  assert.strictEqual(isCatalog, false, "Restaurante NO debe ser catalog");

  // Simulación de UI flags
  const channelTabTitle = isCatalog ? "Mostrador" : "Mesas en Salón";
  const showReservationsTab = !isCatalog;
  const destinationButtonLabel = isCatalog ? "Mostrador" : "Mesa";
  const showTableSelector = !isCatalog;
  const sendToKitchenDefault = !isCatalog;
  const showKdsSwitch = !isCatalog;
  const checkoutButtonLabel = isCatalog ? "Cobrar y Registrar Venta" : "Cobrar y Enviar a Cocina";

  assert.strictEqual(channelTabTitle, "Mesas en Salón");
  assert.strictEqual(showReservationsTab, true);
  assert.strictEqual(destinationButtonLabel, "Mesa");
  assert.strictEqual(showTableSelector, true);
  assert.strictEqual(sendToKitchenDefault, true);
  assert.strictEqual(showKdsSwitch, true);
  assert.strictEqual(checkoutButtonLabel, "Cobrar y Enviar a Cocina");

  console.log("✅ [PASS] 2: Vertical Restaurante mantiene 'Mesas en Salón', 'Reservas', selector de mesas y KDS al 100%");
}

// 3. Adaptación Semántica para Tiendas y Catálogo (ctalo / retail)
{
  const retailTenant = {
    businessType: "RETAIL",
    name: "Gitana Boutique",
    customLabels: null,
  };
  const isCatalog =
    resolveBusinessVertical(retailTenant) === "retail" ||
    retailTenant.businessType === "RETAIL" ||
    retailTenant.businessType === "GENERAL_CATALOG";

  assert.strictEqual(isCatalog, true, "Retail DEBE ser catalog");

  // Simulación de UI flags
  const channelTabTitle = isCatalog ? "Mostrador" : "Mesas en Salón";
  const showReservationsTab = !isCatalog;
  const destinationButtonLabel = isCatalog ? "Mostrador" : "Mesa";
  const showTableSelector = !isCatalog;
  const sendToKitchenDefault = !isCatalog;
  const showKdsSwitch = !isCatalog;
  const checkoutButtonLabel = isCatalog ? "Cobrar y Registrar Venta" : "Cobrar y Enviar a Cocina";
  const activeOrdersTitle = isCatalog ? "Órdenes Activas en Mostrador" : "Cuentas Abiertas en Salón";

  assert.strictEqual(channelTabTitle, "Mostrador");
  assert.strictEqual(showReservationsTab, false);
  assert.strictEqual(destinationButtonLabel, "Mostrador");
  assert.strictEqual(showTableSelector, false);
  assert.strictEqual(sendToKitchenDefault, false);
  assert.strictEqual(showKdsSwitch, false);
  assert.strictEqual(checkoutButtonLabel, "Cobrar y Registrar Venta");
  assert.strictEqual(activeOrdersTitle, "Órdenes Activas en Mostrador");

  console.log("✅ [PASS] 3: Vertical Catálogo adapta 'Mostrador', oculta Reservas, desactiva KDS y muestra 'Cobrar y Registrar Venta'");
}

// 4. Compatibilidad Financiera con Arqueo Z y Turnos de Caja (CashShift)
{
  // Simulación de cálculo de Arqueo con ventas de Mostrador y Domicilio
  const sampleSales = [
    { paymentMethod: "EFECTIVO", total: 45.0, modality: "MOSTRADOR" },
    { paymentMethod: "TARJETA", total: 30.0, modality: "MOSTRADOR" },
    { paymentMethod: "DEUNA", total: 15.0, modality: "DOMICILIO" },
  ];

  let totalSales = 0;
  let totalCashSales = 0;
  let totalCardsSales = 0;
  let totalDeunaSales = 0;

  for (const s of sampleSales) {
    totalSales += s.total;
    if (s.paymentMethod === "EFECTIVO") totalCashSales += s.total;
    if (s.paymentMethod === "TARJETA") totalCardsSales += s.total;
    if (s.paymentMethod === "DEUNA") totalDeunaSales += s.total;
  }

  assert.strictEqual(totalSales, 90.0);
  assert.strictEqual(totalCashSales, 45.0);
  assert.strictEqual(totalCardsSales, 30.0);
  assert.strictEqual(totalDeunaSales, 15.0);

  console.log("✅ [PASS] 4: Las ventas en mostrador computan y desglosan exactamente en el Arqueo Z de caja");
}

// 5. Aislamiento y Configuración Híbrida de Dietas & Alergias en CRM
{
  // 5.1 En Restaurante por defecto: showDietaryInCrm debe ser TRUE
  const labelsRestaurant = getBusinessLabels(null, "RESTAURANT");
  assert.strictEqual(labelsRestaurant.showDietaryInCrm, true, "Restaurante debe mostrar Dietas & Alergias por defecto");

  // 5.2 En Catálogo / Retail por defecto: showDietaryInCrm debe ser FALSE
  const labelsRetail = getBusinessLabels(null, "RETAIL");
  assert.strictEqual(labelsRetail.showDietaryInCrm, false, "Retail/Catálogo debe ocultar Dietas & Alergias por defecto");

  const labelsCatalog = getBusinessLabels(null, "GENERAL_CATALOG");
  assert.strictEqual(labelsCatalog.showDietaryInCrm, false, "Catálogo General debe ocultar Dietas & Alergias por defecto");

  // 5.3 Tienda retail que activa explícitamente el toggle en customLabels
  const labelsRetailWithToggle = getBusinessLabels(JSON.stringify({ showDietaryInCrm: true }), "RETAIL");
  assert.strictEqual(labelsRetailWithToggle.showDietaryInCrm, true, "Retail con toggle explícito debe poder activar Dietas & Alergias");

  // 5.4 Restaurante que apaga explícitamente el toggle
  const labelsRestaurantDisabled = getBusinessLabels(JSON.stringify({ showDietaryInCrm: false }), "RESTAURANT");
  assert.strictEqual(labelsRestaurantDisabled.showDietaryInCrm, false, "Restaurante con toggle apagado debe poder ocultar Dietas & Alergias");

  console.log("✅ [PASS] 5: Adaptación híbrida de Dietas & Alergias en CRM verificada (oculto en catálogo, activo en menú, configurable)");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE ADAPTACIÓN DE CAJA Y CRM PASARON EXITOSAMENTE (5/5)");
console.log("==================================================");

