import assert from "node:assert";
import {
  PRICING_VERSION_V4,
  buildPricingSnapshot,
  extractPricingSnapshot,
  attachPricingSnapshot,
  stripClientPricingFields,
  buildMirrorPaymentDetails,
  buildReconciledPedidoMetadata,
  calculateV4OrderTotals,
  calculatePostOrderTotals,
  computeSyncCreateTotals,
  computeSyncUpdateTotals,
  toCents,
  fromCents,
  applyRateCents,
  applyRateSignedCents,
  resolveTaxAndServiceInclusion,
  type OrderPricingConfig,
} from "./order-pricing";

let passed = 0;
function runTest(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("=== PRUEBAS PURAS v4_tax_base, RECONCILIACIÓN, LEGADO Y ADAPTADORES ===");

const configAdicional: OrderPricingConfig = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: false,
  serviceOnTable: false,
  ivaOnTakeout: false,
  serviceOnTakeout: false,
};

const configIncluido: OrderPricingConfig = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: true,
  serviceOnTable: true,
  ivaOnTakeout: true,
  serviceOnTakeout: false,
};

// 1. Casos confirmados v4_tax_base: 22.50, 26.57, 24.07 y 21.13
runTest("1. Reglas v4_tax_base: cupón 22.50, temporada 26.57, ambos 24.07 y 16.90 -> 21.13", () => {
  const snap = buildPricingSnapshot(configAdicional, true);
  assert.strictEqual(snap.pricingVersion, PRICING_VERSION_V4);

  const withCoupon = calculateV4OrderTotals({
    itemsSubtotal: 20.0,
    isTable: true,
    snapshot: snap,
    discountAmount: 2.0,
  });
  assert.strictEqual(withCoupon.iva, 2.7);
  assert.strictEqual(withCoupon.serviceCharge, 1.8);
  assert.strictEqual(withCoupon.total, 22.5);

  const withSeason = calculateV4OrderTotals({
    itemsSubtotal: 20.0,
    isTable: true,
    snapshot: snap,
    seasonRateAmount: 1.25,
  });
  assert.strictEqual(withSeason.iva, 3.19);
  assert.strictEqual(withSeason.serviceCharge, 2.13);
  assert.strictEqual(withSeason.total, 26.57);

  const withBoth = calculateV4OrderTotals({
    itemsSubtotal: 20.0,
    isTable: true,
    snapshot: snap,
    discountAmount: 2.0,
    seasonRateAmount: 1.25,
  });
  assert.strictEqual(withBoth.iva, 2.89);
  assert.strictEqual(withBoth.serviceCharge, 1.93);
  assert.strictEqual(withBoth.total, 24.07);

  const case1690 = calculateV4OrderTotals({
    itemsSubtotal: 16.9,
    isTable: true,
    snapshot: snap,
  });
  assert.strictEqual(case1690.iva, 2.54);
  assert.strictEqual(case1690.serviceCharge, 1.69);
  assert.strictEqual(case1690.total, 21.13);
});

// 2. Recorrido serializado real: creación -> espejo -> reconciliación (sin y con pedido previo) -> ronda -> sync -> repetición
runTest("2. Recorrido serializado real: creación -> espejo -> reconciliación -> ronda -> sync -> repetición", () => {
  const serverSnap = buildPricingSnapshot(configAdicional, true);
  const created = calculateV4OrderTotals({
    itemsSubtotal: 10.0,
    isTable: true,
    snapshot: serverSnap,
    discountAmount: 2.0,
    seasonRateAmount: 1.25,
    deliveryCost: 0,
    tip: 1.0,
  });

  // 2a. Creación en Order.paymentDetails (descarta inyección cliente y conserva claves autoritativas)
  const clientPaymentDetails = stripClientPricingFields({
    pricing_version: "v4_tax_base",
    pricing_snapshot: { pricingVersion: "v4_tax_base", ivaPercent: 0, servicePercent: 0, ivaIncluded: true, serviceIncluded: true },
    exige_prepago: true,
    pago_confirmado: false,
    pago_estado: "pendiente_prepago",
    customFlag: "keep-me",
  });
  const orderPaymentDetails = JSON.stringify(attachPricingSnapshot(clientPaymentDetails, serverSnap));

  // 2b. Reconciliación SIN pedido previo en pedidos (buildReconciledPedidoMetadata real)
  const reconciledNewMeta = buildReconciledPedidoMetadata({
    tableName: "Mesa 3",
    subtotal: created.subtotal,
    iva: created.iva,
    serviceCharge: created.serviceCharge,
    discountAmount: created.discountAmount,
    seasonRateAmount: created.seasonRateAmount,
    tip: created.tip,
    deliveryCost: created.deliveryCost,
    paymentMethod: "deuna",
    paymentDetails: orderPaymentDetails,
  });
  assert.strictEqual(reconciledNewMeta.pricing_version, PRICING_VERSION_V4);
  assert.deepStrictEqual(reconciledNewMeta.pricing_snapshot, serverSnap);
  assert.strictEqual(reconciledNewMeta.discount_amount, 2.0);
  assert.strictEqual(reconciledNewMeta.season_rate_amount, 1.25);
  assert.strictEqual(reconciledNewMeta.tip, 1.0);
  assert.strictEqual(reconciledNewMeta.exige_prepago, true);
  assert.strictEqual(reconciledNewMeta.pago_confirmado, false);
  assert.strictEqual(reconciledNewMeta.pago_estado, "pendiente_prepago");
  assert.strictEqual(reconciledNewMeta.metodo_pago, "deuna");
  assert.strictEqual(reconciledNewMeta.reconciled, true);

  // 2c. Reconciliación CON pedido previo en pedidos (conserva processed_round_ids y notas_entrega sin sobrescribir)
  const existingPedidoMeta = {
    processed_round_ids: ["attempt-1"],
    notas_entrega: "Tocar timbre",
    origenExtra: "preservado",
  };
  const reconciledExistingMeta = buildReconciledPedidoMetadata(
    {
      tableName: "Mesa 3",
      subtotal: created.subtotal,
      iva: created.iva,
      serviceCharge: created.serviceCharge,
      discountAmount: created.discountAmount,
      seasonRateAmount: created.seasonRateAmount,
      tip: created.tip,
      deliveryCost: created.deliveryCost,
      paymentMethod: "deuna",
      paymentDetails: orderPaymentDetails,
    },
    existingPedidoMeta
  );
  assert.deepStrictEqual(reconciledExistingMeta.processed_round_ids, ["attempt-1"]);
  assert.strictEqual(reconciledExistingMeta.notas_entrega, "Tocar timbre");
  assert.strictEqual(reconciledExistingMeta.origenExtra, "preservado");
  assert.strictEqual(reconciledExistingMeta.pricing_version, PRICING_VERSION_V4);

  // 2d. Cambio posterior del negocio NO debe afectar ronda ni sync del pedido ya versionado
  const laterConfig: OrderPricingConfig = {
    ivaPercent: 22,
    servicePercent: 0,
    ivaOnTable: true,
    serviceOnTable: true,
  };
  const extractedSnap = extractPricingSnapshot(reconciledExistingMeta);
  assert.ok(extractedSnap);

  // Ronda (+10.00 -> 20.00) usando snapshot extraído
  const roundTotals = calculateV4OrderTotals({
    itemsSubtotal: 20.0,
    isTable: true,
    snapshot: extractedSnap!,
    discountAmount: reconciledExistingMeta.discount_amount,
    seasonRateAmount: reconciledExistingMeta.season_rate_amount,
    deliveryCost: reconciledExistingMeta.costo_envio,
    tip: reconciledExistingMeta.tip,
  });
  assert.strictEqual(roundTotals.iva, 2.89);
  assert.strictEqual(roundTotals.serviceCharge, 1.93);
  assert.strictEqual(roundTotals.total, 25.07); // 24.07 + 1.00 tip

  // Espejo creación/actualización con buildMirrorPaymentDetails (copia snapshot desde metadata si faltaba en Order)
  const mirrorCreate = computeSyncCreateTotals({
    itemsSubtotal: 20.0,
    isTableOrder: true,
    config: laterConfig,
    isOrderCancelled: false,
    hasCancelledItems: false,
    hasActiveItems: true,
    deliveryCost: 0,
    meta: {
      ...reconciledExistingMeta,
      subtotal: roundTotals.subtotal,
      iva: roundTotals.iva,
      service_charge: roundTotals.serviceCharge,
    },
    originTotal: roundTotals.total,
  });
  assert.strictEqual(mirrorCreate.snapshot?.ivaPercent, 15);
  assert.strictEqual(mirrorCreate.total, 25.07);

  const syncedPaymentDetails = buildMirrorPaymentDetails(
    JSON.stringify({ roundAttempts: ["attempt-1"] }),
    reconciledExistingMeta,
    mirrorCreate.snapshot
  );
  assert.ok(syncedPaymentDetails);
  const parsedSyncedPd = JSON.parse(syncedPaymentDetails!);
  assert.deepStrictEqual(parsedSyncedPd.roundAttempts, ["attempt-1"]);
  assert.strictEqual(parsedSyncedPd.exige_prepago, true);
  assert.strictEqual(parsedSyncedPd.pricing_version, PRICING_VERSION_V4);

  // Sync update y repetición (idempotencia)
  const syncUpd1 = computeSyncUpdateTotals({
    activeItemsSubtotal: 20.0,
    isTableOrder: true,
    config: laterConfig,
    allCancelled: false,
    hasActiveItems: true,
    preservedDiscount: 2.0,
    preservedSeason: 1.25,
    preservedDelivery: 0,
    preservedTip: 1.0,
    snapshot: extractPricingSnapshot(syncedPaymentDetails),
  });
  assert.deepStrictEqual(syncUpd1, roundTotals);

  const syncUpd2 = computeSyncUpdateTotals({
    activeItemsSubtotal: syncUpd1.subtotal,
    isTableOrder: true,
    config: laterConfig,
    allCancelled: false,
    hasActiveItems: true,
    preservedDiscount: syncUpd1.discountAmount,
    preservedSeason: syncUpd1.seasonRateAmount,
    preservedDelivery: syncUpd1.deliveryCost,
    preservedTip: syncUpd1.tip,
    snapshot: extractPricingSnapshot(syncedPaymentDetails),
  });
  assert.deepStrictEqual(syncUpd2, syncUpd1);
});

// 3. Protección de legado incluso con subtotal desajustado respecto a suma de líneas y configuración cambiada
runTest("3. Legado sin versión conserva importes y desglose aunque subtotal != suma de líneas y cambie config", () => {
  // Subtotal guardado 20.00 pero suma de líneas activas 16.90 (desajuste preexistente); sin pricing_version
  const legacyMismatch = computeSyncUpdateTotals({
    activeItemsSubtotal: 16.9,
    isTableOrder: true,
    config: { ivaPercent: 25, servicePercent: 15, ivaOnTable: false, serviceOnTable: false },
    allCancelled: false,
    hasActiveItems: true,
    preservedDiscount: 0,
    preservedSeason: 1.25,
    preservedDelivery: 0,
    preservedTip: 0,
    snapshot: null,
    lockedOrderTotals: {
      subtotal: 20.0,
      iva: 3.0,
      serviceCharge: 2.0,
      total: 26.25,
    },
  });
  assert.strictEqual(legacyMismatch.subtotal, 20.0);
  assert.strictEqual(legacyMismatch.iva, 3.0);
  assert.strictEqual(legacyMismatch.serviceCharge, 2.0);
  assert.strictEqual(legacyMismatch.total, 26.25);

  // Reconciliación sobre orden legado sin snapshot nunca inventa pricing_version
  const legacyReconciledMeta = buildReconciledPedidoMetadata(
    {
      tableName: "Mesa 5",
      subtotal: 20.0,
      iva: 3.0,
      serviceCharge: 2.0,
      discountAmount: 0,
      seasonRateAmount: 1.25,
      tip: 0,
      deliveryCost: 0,
      paymentDetails: JSON.stringify({ exige_prepago: false }),
    },
    { notaLegacy: "no-tocar" }
  );
  assert.strictEqual(legacyReconciledMeta.pricing_version, undefined);
  assert.strictEqual(legacyReconciledMeta.pricing_snapshot, undefined);
  assert.strictEqual(legacyReconciledMeta.notaLegacy, "no-tocar");
  assert.strictEqual(legacyReconciledMeta.season_rate_amount, 1.25);
});

// 4. Base neta más temporada negativa SIN recorte unilateral a cero
runTest("4. Base negativa con temporada -5.00 (10.00 - 8.00 - 5.00 = -3.00 -> IVA -0.45, Serv -0.30, Total -3.75)", () => {
  assert.strictEqual(applyRateSignedCents(-300, 15), -45);
  assert.strictEqual(applyRateSignedCents(-300, 10), -30);

  const negBase = calculateV4OrderTotals({
    itemsSubtotal: 10.0,
    isTable: true,
    snapshot: buildPricingSnapshot(configAdicional, true),
    discountAmount: 8.0,
    seasonRateAmount: -5.0,
  });
  assert.strictEqual(negBase.subtotal, 10.0);
  assert.strictEqual(negBase.discountAmount, 8.0);
  assert.strictEqual(negBase.seasonRateAmount, -5.0);
  assert.strictEqual(negBase.iva, -0.45);
  assert.strictEqual(negBase.serviceCharge, -0.3);
  assert.strictEqual(negBase.total, -3.75);
});

// 5. Cero líneas activas, cancelación parcial, incluidos/canales, origen cero y redondeo exacto
runTest("5. Cero líneas activas, cancelación parcial, canales, origen 0 y redondeo exacto", () => {
  assert.strictEqual(fromCents(toCents(10.075)), 10.08);
  assert.strictEqual(fromCents(toCents(4.015)), 4.02);
  assert.strictEqual(applyRateCents(1690, 15), 254);

  // Cero líneas activas
  const zeroActive = calculateV4OrderTotals({
    itemsSubtotal: 20.0,
    isTable: true,
    snapshot: buildPricingSnapshot(configAdicional, true),
    hasActiveItems: false,
    discountAmount: 2.0,
    seasonRateAmount: 1.25,
    deliveryCost: 2.0,
    tip: 1.0,
  });
  assert.strictEqual(zeroActive.total, 0);
  assert.strictEqual(zeroActive.iva, 0);

  // Cancelación parcial en creación de espejo v4
  const snap = buildPricingSnapshot(configAdicional, true);
  const partialV4 = computeSyncCreateTotals({
    itemsSubtotal: 20.0,
    isTableOrder: true,
    config: configIncluido,
    isOrderCancelled: false,
    hasCancelledItems: true,
    hasActiveItems: true,
    deliveryCost: 0,
    meta: attachPricingSnapshot(
      { subtotal: 30.0, iva: 4.5, service_charge: 3.0, discount_amount: 2.0, season_rate_amount: 1.25 },
      snap
    ),
    originTotal: 36.75,
  });
  assert.strictEqual(partialV4.subtotal, 20.0);
  assert.strictEqual(partialV4.iva, 2.89);
  assert.strictEqual(partialV4.serviceCharge, 1.93);
  assert.strictEqual(partialV4.total, 24.07);

  // Origen cero válido
  const zeroOrigin = computeSyncCreateTotals({
    itemsSubtotal: 10.0,
    isTableOrder: true,
    config: configAdicional,
    isOrderCancelled: false,
    hasCancelledItems: false,
    hasActiveItems: true,
    deliveryCost: 0,
    meta: { subtotal: 10.0, iva: 0, service_charge: 0 },
    originTotal: 0,
  });
  assert.strictEqual(zeroOrigin.total, 0);

  // Canales e incluidos en v4
  const delivery = calculateV4OrderTotals({
    itemsSubtotal: 16.9,
    isTable: false,
    snapshot: buildPricingSnapshot(configAdicional, false),
    deliveryCost: 2.5,
  });
  assert.strictEqual(delivery.serviceCharge, 0);
  assert.strictEqual(delivery.iva, 2.54);
  assert.strictEqual(delivery.total, 21.94);

  const included = calculateV4OrderTotals({
    itemsSubtotal: 16.9,
    isTable: true,
    snapshot: buildPricingSnapshot(configIncluido, true),
  });
  assert.strictEqual(included.iva, 0);
  assert.strictEqual(included.serviceCharge, 0);
  assert.strictEqual(included.total, 16.9);

  // Adaptadores legados conservan semántica mixta previa
  assert.deepStrictEqual(
    resolveTaxAndServiceInclusion({ ivaOnTable: undefined, serviceOnTable: undefined }, true, "post"),
    { ivaIncluded: false, serviceIncluded: false }
  );
  assert.deepStrictEqual(
    resolveTaxAndServiceInclusion({ ivaOnTable: undefined, serviceOnTable: undefined }, true, "sync"),
    { ivaIncluded: true, serviceIncluded: true }
  );
  assert.strictEqual(
    calculatePostOrderTotals({ itemsSubtotal: 10.0, isTable: true, config: configAdicional, discountAmount: 12.0, deliveryCost: 1.5 }).total,
    2.0
  );
});

// 6. buildMirrorPaymentDetails: texto libre, JSON válido, JSON inválido y null (legado vs v4_tax_base)
runTest("6. buildMirrorPaymentDetails preserva texto libre, JSON inválido, JSON válido y null sin pérdida", () => {
  const snap = buildPricingSnapshot(configAdicional, true);
  const metaConFlags = { exige_prepago: true, pago_confirmado: false, pago_estado: "pendiente_prepago" };

  // 6a. Pedido legado (snapshot null): si no necesita agregar flags, retorna undefined (no sobrescribe)
  assert.strictEqual(buildMirrorPaymentDetails("Transferencia Pichincha #9981", metaConFlags, null), undefined);
  assert.strictEqual(buildMirrorPaymentDetails("{json_invalido_sin_cierre", metaConFlags, null), undefined);
  assert.strictEqual(buildMirrorPaymentDetails(null, {}, null), undefined);
  assert.strictEqual(buildMirrorPaymentDetails('{"ref":"ABC"}', {}, null), undefined);
  const legacyWithFlags = buildMirrorPaymentDetails('{"ref":"ABC"}', metaConFlags, null);
  assert.ok(legacyWithFlags);
  assert.strictEqual(JSON.parse(legacyWithFlags!).ref, "ABC");
  assert.strictEqual(JSON.parse(legacyWithFlags!).exige_prepago, true);

  // 6b. Pedido v4_tax_base: texto libre y JSON inválido se conservan en { text } junto al snapshot
  const wrappedText = buildMirrorPaymentDetails("Transferencia Pichincha #9981", metaConFlags, snap);
  assert.ok(wrappedText);
  const parsedText = JSON.parse(wrappedText!);
  assert.strictEqual(parsedText.text, "Transferencia Pichincha #9981");
  assert.strictEqual(parsedText.pricing_version, PRICING_VERSION_V4);
  assert.deepStrictEqual(parsedText.pricing_snapshot, snap);
  assert.strictEqual(parsedText.exige_prepago, true);

  const wrappedInvalid = buildMirrorPaymentDetails("{json_invalido", metaConFlags, snap);
  assert.ok(wrappedInvalid);
  const parsedInvalid = JSON.parse(wrappedInvalid!);
  assert.strictEqual(parsedInvalid.text, "{json_invalido");
  assert.strictEqual(parsedInvalid.pricing_version, PRICING_VERSION_V4);

  // 6c. JSON válido en v4 conserva referencias y claves ajenas
  const mergedValid = buildMirrorPaymentDetails('{"roundAttempts":["r1"],"ref":"XYZ"}', metaConFlags, snap);
  assert.ok(mergedValid);
  const parsedValid = JSON.parse(mergedValid!);
  assert.strictEqual(parsedValid.ref, "XYZ");
  assert.deepStrictEqual(parsedValid.roundAttempts, ["r1"]);
  assert.strictEqual(parsedValid.pricing_version, PRICING_VERSION_V4);
  assert.strictEqual(parsedValid.pago_estado, "pendiente_prepago");

  // 6d. null en v4 guarda snapshot y flags
  const fromNull = buildMirrorPaymentDetails(null, metaConFlags, snap);
  assert.ok(fromNull);
  assert.strictEqual(JSON.parse(fromNull!).pricing_version, PRICING_VERSION_V4);
});

// 7. Protección legado antes de allCancelled / cero líneas ACTIVE (UNRESOLVED, 0 líneas o cancelados previos)
runTest("7. Legado 20.00/3.00/2.00/26.25 conserva importes ante 0 ACTIVE, UNRESOLVED o estados cancelados previos", () => {
  const lockedLegacy = {
    subtotal: 20.0,
    iva: 3.0,
    serviceCharge: 2.0,
    total: 26.25,
  };

  // Caso A: 0 líneas ACTIVE (ej. líneas UNRESOLVED o sin líneas) con hasActiveItems: false
  const withZeroActive = computeSyncUpdateTotals({
    activeItemsSubtotal: 0,
    isTableOrder: true,
    config: { ivaPercent: 25, servicePercent: 15, ivaOnTable: false, serviceOnTable: false },
    allCancelled: false,
    hasActiveItems: false,
    preservedDiscount: 0,
    preservedSeason: 1.25,
    preservedDelivery: 0,
    preservedTip: 0,
    snapshot: null,
    lockedOrderTotals: lockedLegacy,
  });
  assert.strictEqual(withZeroActive.subtotal, 20.0);
  assert.strictEqual(withZeroActive.iva, 3.0);
  assert.strictEqual(withZeroActive.serviceCharge, 2.0);
  assert.strictEqual(withZeroActive.seasonRateAmount, 1.25);
  assert.strictEqual(withZeroActive.total, 26.25);

  // Caso B: allCancelled: true en sincronización pasiva sobre pedido legado (no reescribe finanzas a 0)
  const withAllCancelledLegacy = computeSyncUpdateTotals({
    activeItemsSubtotal: 0,
    isTableOrder: true,
    config: configAdicional,
    allCancelled: true,
    hasActiveItems: false,
    preservedDiscount: 0,
    preservedSeason: 1.25,
    preservedDelivery: 0,
    preservedTip: 0,
    snapshot: null,
    lockedOrderTotals: lockedLegacy,
  });
  assert.strictEqual(withAllCancelledLegacy.subtotal, 20.0);
  assert.strictEqual(withAllCancelledLegacy.iva, 3.0);
  assert.strictEqual(withAllCancelledLegacy.serviceCharge, 2.0);
  assert.strictEqual(withAllCancelledLegacy.total, 26.25);
});

console.log(`\n✅ ${passed} suites puras aprobadas exitosamente.`);
