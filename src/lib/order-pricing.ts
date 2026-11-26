/**
 * Pure monetary calculation module for MenuQR Pro orders.
 * Operates strictly in integer cents with exact decimal parsing and integer half-up
 * rounding (no Number.EPSILON float hacks), preserving each route's existing commercial rules
 * through explicit adapters.
 *
 * Admitted domain: finite non-negative numbers (>= 0). Non-finite or negative values
 * passed directly to low-level cent helpers throw RangeError.
 */

export const PRICING_VERSION_V4 = "v4_tax_base" as const;

export interface OrderPricingSnapshot {
  pricingVersion: typeof PRICING_VERSION_V4;
  ivaPercent: number;
  servicePercent: number;
  ivaIncluded: boolean;
  serviceIncluded: boolean;
}

export interface OrderPricingConfig {
  ivaPercent?: number | null;
  servicePercent?: number | null;
  ivaOnTable?: boolean | null;
  serviceOnTable?: boolean | null;
  ivaOnTakeout?: boolean | null;
  serviceOnTakeout?: boolean | null;
}

/**
 * Builds an immutable server-side pricing snapshot from the restaurant's global
 * tax/service configuration at order creation time.
 * Uses the global toggles (ivaOnTable ?? false, serviceOnTable ?? false).
 */
export function buildPricingSnapshot(config: OrderPricingConfig, _isTable: boolean): OrderPricingSnapshot {
  const ivaPercent = typeof config.ivaPercent === "number" ? normalizeNonNegative(config.ivaPercent) : 15.0;
  const servicePercent = typeof config.servicePercent === "number" ? normalizeNonNegative(config.servicePercent) : 10.0;
  return {
    pricingVersion: PRICING_VERSION_V4,
    ivaPercent,
    servicePercent,
    ivaIncluded: config.ivaOnTable ?? false,
    serviceIncluded: config.serviceOnTable ?? false,
  };
}

/**
 * Safely parses a JSON string or object and extracts a server-produced v4 pricing snapshot.
 * Returns null for legacy orders or malformed/unversioned payloads.
 */
export function extractPricingSnapshot(container: unknown): OrderPricingSnapshot | null {
  if (!container) return null;
  let obj: any = container;
  if (typeof container === "string") {
    const trimmed = container.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  if (obj.pricing_version !== PRICING_VERSION_V4) return null;
  const snap = obj.pricing_snapshot;
  if (!snap || typeof snap !== "object" || snap.pricingVersion !== PRICING_VERSION_V4) return null;
  if (
    typeof snap.ivaPercent !== "number" ||
    !Number.isFinite(snap.ivaPercent) ||
    snap.ivaPercent < 0 ||
    typeof snap.servicePercent !== "number" ||
    !Number.isFinite(snap.servicePercent) ||
    snap.servicePercent < 0 ||
    typeof snap.ivaIncluded !== "boolean" ||
    typeof snap.serviceIncluded !== "boolean"
  ) {
    return null;
  }
  return {
    pricingVersion: PRICING_VERSION_V4,
    ivaPercent: snap.ivaPercent,
    servicePercent: snap.servicePercent,
    ivaIncluded: snap.ivaIncluded,
    serviceIncluded: snap.serviceIncluded,
  };
}

/**
 * Attaches the server-generated pricing version and snapshot to a JSON metadata/paymentDetails object
 * while preserving all unrelated keys.
 */
export function attachPricingSnapshot<T extends Record<string, any>>(
  target: T,
  snapshot: OrderPricingSnapshot
): T & { pricing_version: typeof PRICING_VERSION_V4; pricing_snapshot: OrderPricingSnapshot } {
  return {
    ...target,
    pricing_version: PRICING_VERSION_V4,
    pricing_snapshot: snapshot,
  };
}

/**
 * Strips any untrusted pricing version/snapshot fields supplied by a client payload.
 */
export function stripClientPricingFields<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const copy = { ...obj };
  delete (copy as any).pricing_version;
  delete (copy as any).pricing_snapshot;
  delete (copy as any).pricingVersion;
  delete (copy as any).pricingSnapshot;
  return copy;
}

export type TaxableBaseMode = "gross_subtotal" | "after_discount";
export type TaxInclusionMode = "post" | "sync";

export interface OrderTotalsInput {
  itemsSubtotal: number;
  isTable: boolean;
  config: OrderPricingConfig;
  hasActiveItems?: boolean;
  discountAmount?: number;
  seasonRateAmount?: number;
  deliveryCost?: number;
  tip?: number;
  taxableBaseMode?: TaxableBaseMode;
  inclusionMode?: TaxInclusionMode;
}

export interface OrderTotalsResult {
  subtotal: number;
  iva: number;
  serviceCharge: number;
  deliveryCost: number;
  discountAmount: number;
  seasonRateAmount: number;
  tip: number;
  total: number;
}

/**
 * Parses a finite non-negative decimal number into { digits: string, scale: number }
 * without multiplying by 100 in IEEE-754 floating point.
 */
function parseNonNegativeDecimal(value: number, label: string): { intDigits: string; scale: number } {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number (received ${String(value)})`);
  }
  if (value === 0) return { intDigits: "0", scale: 0 };

  const str = value.toString().toLowerCase();
  let mantissa = str;
  let exp = 0;

  if (str.includes("e")) {
    const [m, e] = str.split("e");
    mantissa = m;
    exp = parseInt(e, 10);
  }

  const dotIdx = mantissa.indexOf(".");
  const rawDigits = dotIdx === -1 ? mantissa : mantissa.slice(0, dotIdx) + mantissa.slice(dotIdx + 1);
  const fracLen = dotIdx === -1 ? 0 : mantissa.length - dotIdx - 1;
  const netShift = exp - fracLen;

  if (netShift >= 0) {
    return { intDigits: rawDigits + "0".repeat(netShift), scale: 0 };
  }
  return { intDigits: rawDigits, scale: -netShift };
}

/**
 * Converts a finite non-negative dollar amount to integer cents,
 * rounding half-up at the third decimal place without float epsilon hacks.
 */
export function toCents(amount: number): number {
  const { intDigits, scale } = parseNonNegativeDecimal(amount, "amount");
  if (scale <= 2) {
    return parseInt(intDigits, 10) * Math.pow(10, 2 - scale);
  }
  const padded = intDigits.padStart(scale + 1, "0");
  const cut = padded.length - (scale - 2);
  const wholeCents = parseInt(padded.slice(0, cut), 10);
  const nextDigit = parseInt(padded[cut] || "0", 10);
  return nextDigit >= 5 ? wholeCents + 1 : wholeCents;
}

/**
 * Converts integer cents back to a two-decimal dollar number.
 */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`cents must be a non-negative integer (received ${String(cents)})`);
  }
  return cents / 100;
}

/**
 * Applies a non-negative percentage rate to an integer cent base using exact integer
 * division and half-up rounding to the nearest cent.
 */
export function applyRateCents(baseCents: number, percent: number): number {
  if (!Number.isInteger(baseCents) || baseCents < 0) {
    throw new RangeError(`baseCents must be a non-negative integer (received ${String(baseCents)})`);
  }
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0) {
    throw new RangeError(`percent must be a finite non-negative number (received ${String(percent)})`);
  }
  if (baseCents === 0 || percent === 0) return 0;

  const { intDigits, scale } = parseNonNegativeDecimal(percent, "percent");
  const scaledPercent = parseInt(intDigits, 10);
  const denominator = 100 * Math.pow(10, scale);
  const numerator = baseCents * scaledPercent;

  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

/**
 * Signed wrapper over applyRateCents that preserves sign when baseCents is negative,
 * matching prior createOrderAction arithmetic without silent clamping.
 */
export function applyRateSignedCents(baseCents: number, percent: number): number {
  if (baseCents === 0) return 0;
  return baseCents < 0 ? -applyRateCents(Math.abs(baseCents), percent) : applyRateCents(baseCents, percent);
}

/**
 * Converts a finite dollar amount (positive, zero, or negative) to signed integer cents
 * using exact decimal half-up rounding on magnitude.
 */
function toSignedCents(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) return 0;
  return amount < 0 ? -toCents(Math.abs(amount)) : toCents(amount);
}

/**
 * Converts signed integer cents back to a two-decimal dollar number.
 */
function fromSignedCents(cents: number): number {
  if (cents === 0) return 0;
  return cents / 100;
}

function finiteOrZero(value: number | undefined | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeNonNegative(value: number | undefined | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Resolves tax and service inclusion flags preserving each route's exact semantics.
 */
export function resolveTaxAndServiceInclusion(
  config: OrderPricingConfig,
  isTable: boolean,
  mode: TaxInclusionMode = "post"
): { ivaIncluded: boolean; serviceIncluded: boolean } {
  if (mode === "sync") {
    const ivaIncluded =
      config.ivaOnTable === false
        ? false
        : isTable
          ? (config.ivaOnTable ?? true)
          : (config.ivaOnTakeout ?? true);

    const serviceIncluded =
      config.serviceOnTable === false
        ? false
        : isTable
          ? (config.serviceOnTable ?? true)
          : (config.serviceOnTakeout ?? false);

    return { ivaIncluded, serviceIncluded };
  }

  const ivaIncluded =
    config.ivaOnTable === true
      ? true
      : config.ivaOnTable === false
        ? false
        : Boolean(isTable ? config.ivaOnTable : config.ivaOnTakeout);

  const serviceIncluded =
    config.serviceOnTable === true
      ? true
      : config.serviceOnTable === false
        ? false
        : Boolean(isTable ? config.serviceOnTable : config.serviceOnTakeout);

  return { ivaIncluded, serviceIncluded };
}

/**
 * Core pure calculation in integer cents parameterized by explicit route rules.
 */
export function calculateOrderTotals(input: OrderTotalsInput): OrderTotalsResult {
  const hasActiveItems = input.hasActiveItems ?? true;
  if (!hasActiveItems) {
    return {
      subtotal: 0,
      iva: 0,
      serviceCharge: 0,
      deliveryCost: 0,
      discountAmount: 0,
      seasonRateAmount: 0,
      tip: 0,
      total: 0,
    };
  }

  const ivaPercent = typeof input.config.ivaPercent === "number" ? normalizeNonNegative(input.config.ivaPercent) : 15.0;
  const servicePercent = typeof input.config.servicePercent === "number" ? normalizeNonNegative(input.config.servicePercent) : 10.0;
  const inclusionMode = input.inclusionMode ?? "post";
  const taxableBaseMode = input.taxableBaseMode ?? "gross_subtotal";

  const { ivaIncluded, serviceIncluded } = resolveTaxAndServiceInclusion(
    input.config,
    input.isTable,
    inclusionMode
  );

  const subtotalCents = toCents(normalizeNonNegative(input.itemsSubtotal));
  const discountCents = toSignedCents(finiteOrZero(input.discountAmount));
  const seasonCents = toSignedCents(finiteOrZero(input.seasonRateAmount));
  const deliveryCents = toSignedCents(finiteOrZero(input.deliveryCost));
  const tipCents = toSignedCents(finiteOrZero(input.tip));

  const netSubtotalAfterDiscountCents = Math.max(0, subtotalCents - discountCents);
  const taxableBaseCents = taxableBaseMode === "after_discount" ? netSubtotalAfterDiscountCents : subtotalCents;

  const ivaCents = ivaPercent > 0 && !ivaIncluded ? applyRateCents(taxableBaseCents, ivaPercent) : 0;
  const serviceCents =
    input.isTable && servicePercent > 0 && !serviceIncluded
      ? applyRateCents(taxableBaseCents, servicePercent)
      : 0;

  // POST subtracts discount from total without flooring (subtotal - discount);
  // sync update floors max(0, subtotal - discount) before adding delivery and tip.
  const totalCents =
    taxableBaseMode === "after_discount"
      ? netSubtotalAfterDiscountCents + seasonCents + ivaCents + serviceCents + deliveryCents + tipCents
      : subtotalCents - discountCents + seasonCents + ivaCents + serviceCents + deliveryCents + tipCents;

  return {
    subtotal: fromCents(subtotalCents),
    iva: fromCents(ivaCents),
    serviceCharge: fromCents(serviceCents),
    deliveryCost: fromSignedCents(deliveryCents),
    discountAmount: fromSignedCents(discountCents),
    seasonRateAmount: fromSignedCents(seasonCents),
    tip: fromSignedCents(tipCents),
    total: fromSignedCents(totalCents),
  };
}

export interface V4OrderTotalsInput {
  itemsSubtotal: number;
  isTable: boolean;
  snapshot: OrderPricingSnapshot;
  hasActiveItems?: boolean;
  discountAmount?: number;
  seasonRateAmount?: number;
  deliveryCost?: number;
  tip?: number;
}

/**
 * Unified v4_tax_base calculation:
 * - Coupon/discount reduces subtotal before IVA/service (floored at 0).
 * - Pre-calculated season amount enters the taxable base (tax base floored at 0 for rate calculation).
 * - Respects global ivaIncluded / serviceIncluded from creation snapshot; service only on table.
 * - Delivery and tip remain outside taxable base.
 * - Preserves finite signed components in final total using exact cent arithmetic.
 */
export function calculateV4OrderTotals(input: V4OrderTotalsInput): OrderTotalsResult {
  const hasActiveItems = input.hasActiveItems ?? true;
  if (!hasActiveItems) {
    return {
      subtotal: 0,
      iva: 0,
      serviceCharge: 0,
      deliveryCost: 0,
      discountAmount: 0,
      seasonRateAmount: 0,
      tip: 0,
      total: 0,
    };
  }

  const subtotalCents = toCents(normalizeNonNegative(input.itemsSubtotal));
  const discountCents = toSignedCents(finiteOrZero(input.discountAmount));
  const seasonCents = toSignedCents(finiteOrZero(input.seasonRateAmount));
  const deliveryCents = toSignedCents(finiteOrZero(input.deliveryCost));
  const tipCents = toSignedCents(finiteOrZero(input.tip));

  const subtotalAfterCouponCents = Math.max(0, subtotalCents - discountCents);
  const taxableBaseCents = subtotalAfterCouponCents + seasonCents;

  const ivaCents =
    input.snapshot.ivaPercent > 0 && !input.snapshot.ivaIncluded
      ? applyRateSignedCents(taxableBaseCents, input.snapshot.ivaPercent)
      : 0;

  const serviceCents =
    input.isTable && input.snapshot.servicePercent > 0 && !input.snapshot.serviceIncluded
      ? applyRateSignedCents(taxableBaseCents, input.snapshot.servicePercent)
      : 0;

  const totalCents =
    subtotalAfterCouponCents + seasonCents + ivaCents + serviceCents + deliveryCents + tipCents;

  return {
    subtotal: fromCents(subtotalCents),
    iva: fromSignedCents(ivaCents),
    serviceCharge: fromSignedCents(serviceCents),
    deliveryCost: fromSignedCents(deliveryCents),
    discountAmount: fromSignedCents(discountCents),
    seasonRateAmount: fromSignedCents(seasonCents),
    tip: fromSignedCents(tipCents),
    total: fromSignedCents(totalCents),
  };
}

/**
 * Explicit adapter for POST /api/pedidos (legacy unversioned orders):
 * - Computes IVA/service on gross subtotal (before discount), subtracting discount from total.
 * - Uses POST channel inclusion semantics.
 */
export function calculatePostOrderTotals(input: Omit<OrderTotalsInput, "taxableBaseMode" | "inclusionMode">): OrderTotalsResult {
  return calculateOrderTotals({
    ...input,
    taxableBaseMode: "gross_subtotal",
    inclusionMode: "post",
  });
}

export interface SyncCreateTotalsInput {
  itemsSubtotal: number;
  isTableOrder: boolean;
  config: OrderPricingConfig;
  isOrderCancelled: boolean;
  hasCancelledItems: boolean;
  hasActiveItems: boolean;
  deliveryCost: number;
  meta?: {
    subtotal?: unknown;
    iva?: unknown;
    service_charge?: unknown;
    discount_amount?: unknown;
    descuento?: unknown;
    season_rate_amount?: unknown;
    temporada?: unknown;
    tip?: unknown;
    propina?: unknown;
    pricing_version?: unknown;
    pricing_snapshot?: unknown;
  } | null;
  originTotal: number;
}

/**
 * Explicit adapter for mirror creation in syncSinglePedidoToPrisma and syncPedidosToPrismaOrders:
 * - Preserves originTotal === 0 (and signed originTotal) when not cancelled and no cancelled items.
 * - Uses v4_tax_base snapshot if present in meta; otherwise preserves legacy sync behavior.
 */
export function computeSyncCreateTotals(input: SyncCreateTotalsInput): {
  subtotal: number;
  iva: number;
  serviceCharge: number;
  deliveryCost: number;
  discountAmount: number;
  seasonRateAmount: number;
  tip: number;
  total: number;
  snapshot: OrderPricingSnapshot | null;
} {
  const snapshot = extractPricingSnapshot(input.meta);
  if (input.isOrderCancelled) {
    return {
      subtotal: 0,
      iva: 0,
      serviceCharge: 0,
      deliveryCost: 0,
      discountAmount: 0,
      seasonRateAmount: 0,
      tip: 0,
      total: 0,
      snapshot,
    };
  }

  const meta = input.meta;
  const metaDiscount = finiteOrZero((meta?.discount_amount ?? meta?.descuento) as number);
  const metaSeason = finiteOrZero((meta?.season_rate_amount ?? meta?.temporada) as number);
  const metaTip = finiteOrZero((meta?.tip ?? meta?.propina) as number);

  const calc = snapshot
    ? calculateV4OrderTotals({
        itemsSubtotal: input.itemsSubtotal,
        isTable: input.isTableOrder,
        snapshot,
        hasActiveItems: input.hasActiveItems,
        discountAmount: metaDiscount,
        seasonRateAmount: metaSeason,
        deliveryCost: input.deliveryCost,
        tip: metaTip,
      })
    : calculateOrderTotals({
        itemsSubtotal: input.itemsSubtotal,
        isTable: input.isTableOrder,
        config: input.config,
        hasActiveItems: input.hasActiveItems,
        deliveryCost: input.deliveryCost,
        taxableBaseMode: "gross_subtotal",
        inclusionMode: "sync",
      });

  if (input.hasCancelledItems) {
    return {
      subtotal: calc.subtotal,
      iva: calc.iva,
      serviceCharge: calc.serviceCharge,
      deliveryCost: calc.deliveryCost,
      discountAmount: snapshot ? calc.discountAmount : fromSignedCents(toSignedCents(metaDiscount)),
      seasonRateAmount: snapshot ? calc.seasonRateAmount : fromSignedCents(toSignedCents(metaSeason)),
      tip: snapshot ? calc.tip : fromSignedCents(toSignedCents(metaTip)),
      total: calc.total,
      snapshot,
    };
  }

  const subtotal = typeof meta?.subtotal === "number" ? fromSignedCents(toSignedCents(finiteOrZero(meta.subtotal))) : calc.subtotal;
  const iva = typeof meta?.iva === "number" ? fromSignedCents(toSignedCents(finiteOrZero(meta.iva))) : calc.iva;
  const serviceCharge = typeof meta?.service_charge === "number" ? fromSignedCents(toSignedCents(finiteOrZero(meta.service_charge))) : calc.serviceCharge;
  const total = fromSignedCents(toSignedCents(finiteOrZero(input.originTotal)));

  return {
    subtotal,
    iva,
    serviceCharge,
    deliveryCost: calc.deliveryCost,
    discountAmount: fromSignedCents(toSignedCents(metaDiscount)),
    seasonRateAmount: fromSignedCents(toSignedCents(metaSeason)),
    tip: fromSignedCents(toSignedCents(metaTip)),
    total,
    snapshot,
  };
}

export interface SyncUpdateTotalsInput {
  activeItemsSubtotal: number;
  isTableOrder: boolean;
  config: OrderPricingConfig;
  allCancelled: boolean;
  hasActiveItems: boolean;
  preservedDiscount: number;
  preservedSeason?: number;
  preservedDelivery: number;
  preservedTip: number;
  snapshot?: OrderPricingSnapshot | null;
  lockedOrderTotals?: {
    subtotal: number;
    iva: number;
    serviceCharge: number;
    total: number;
  } | null;
}

/**
 * Explicit adapter for mirror update in syncSinglePedidoToPrisma and syncPedidosToPrismaOrders:
 * - If snapshot (v4_tax_base) is present, recalculates using v4 rules and frozen snapshot.
 * - If snapshot is absent (legacy order) and item subtotal is unchanged (not cancelled),
 *   preserves the existing Order breakdown and total verbatim.
 * - Otherwise applies legacy sync update calculation (after_discount, floor 0 before delivery/tip).
 */
export function computeSyncUpdateTotals(input: SyncUpdateTotalsInput): OrderTotalsResult {
  // Legacy protection MUST run BEFORE checking allCancelled / !hasActiveItems:
  // 0 ACTIVE lines (e.g. UNRESOLVED or 0 items) in passive sync does not prove an authorized
  // explicit cancellation and must never rewrite legacy order financials.
  if (!input.snapshot && input.lockedOrderTotals) {
    return {
      subtotal: fromSignedCents(toSignedCents(finiteOrZero(input.lockedOrderTotals.subtotal))),
      iva: fromSignedCents(toSignedCents(finiteOrZero(input.lockedOrderTotals.iva))),
      serviceCharge: fromSignedCents(toSignedCents(finiteOrZero(input.lockedOrderTotals.serviceCharge))),
      deliveryCost: fromSignedCents(toSignedCents(finiteOrZero(input.preservedDelivery))),
      discountAmount: fromSignedCents(toSignedCents(finiteOrZero(input.preservedDiscount))),
      seasonRateAmount: fromSignedCents(toSignedCents(finiteOrZero(input.preservedSeason))),
      tip: fromSignedCents(toSignedCents(finiteOrZero(input.preservedTip))),
      total: fromSignedCents(toSignedCents(finiteOrZero(input.lockedOrderTotals.total))),
    };
  }

  if (input.allCancelled || !input.hasActiveItems) {
    return calculateOrderTotals({
      itemsSubtotal: 0,
      isTable: input.isTableOrder,
      config: input.config,
      hasActiveItems: false,
      taxableBaseMode: "after_discount",
      inclusionMode: "sync",
    });
  }

  if (input.snapshot) {
    return calculateV4OrderTotals({
      itemsSubtotal: input.activeItemsSubtotal,
      isTable: input.isTableOrder,
      snapshot: input.snapshot,
      hasActiveItems: true,
      discountAmount: input.preservedDiscount,
      seasonRateAmount: input.preservedSeason ?? 0,
      deliveryCost: input.preservedDelivery,
      tip: input.preservedTip,
    });
  }

  return calculateOrderTotals({
    itemsSubtotal: input.activeItemsSubtotal,
    isTable: input.isTableOrder,
    config: input.config,
    hasActiveItems: true,
    discountAmount: input.preservedDiscount,
    deliveryCost: input.preservedDelivery,
    tip: input.preservedTip,
    taxableBaseMode: "after_discount",
    inclusionMode: "sync",
  });
}

function parseJsonObjectSafe(container: unknown): Record<string, any> {
  if (!container) return {};
  if (typeof container === "string") {
    const trimmed = container.trim();
    if (!trimmed.startsWith("{")) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof container === "object" && !Array.isArray(container) ? { ...(container as Record<string, any>) } : {};
}

function parseExistingPaymentDetailsPreservingRaw(container: unknown): {
  obj: Record<string, any>;
  isRawTextOrInvalidJson: boolean;
  rawString: string | null;
} {
  if (container === null || container === undefined) {
    return { obj: {}, isRawTextOrInvalidJson: false, rawString: null };
  }
  if (typeof container === "string") {
    const trimmed = container.trim();
    if (!trimmed) {
      return { obj: {}, isRawTextOrInvalidJson: false, rawString: null };
    }
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { obj: parsed, isRawTextOrInvalidJson: false, rawString: null };
        }
      } catch {
        return { obj: { text: container }, isRawTextOrInvalidJson: true, rawString: container };
      }
    }
    return { obj: { text: container }, isRawTextOrInvalidJson: true, rawString: container };
  }
  if (typeof container === "object" && !Array.isArray(container)) {
    return { obj: { ...(container as Record<string, any>) }, isRawTextOrInvalidJson: false, rawString: null };
  }
  return { obj: {}, isRawTextOrInvalidJson: false, rawString: null };
}

/**
 * Pure builder for Order.paymentDetails during mirror creation/update.
 * - Preserves free text and invalid JSON without loss (using { text: raw } when wrapping for v4 snapshot,
 *   or returning undefined on legacy orders when no modification is needed so the existing field is never overwritten).
 * - Preserves existing unrelated keys, propagates authoritative payment flags from pedidos.metadata
 *   only when missing on Order, and attaches v4 snapshot only when server-verified.
 */
export function buildMirrorPaymentDetails(
  existingOrderPaymentDetails: unknown,
  pedidoMeta: unknown,
  verifiedSnapshot: OrderPricingSnapshot | null
): string | undefined {
  const { obj: parsedOrderObj, isRawTextOrInvalidJson, rawString } =
    parseExistingPaymentDetailsPreservingRaw(existingOrderPaymentDetails);
  const metaObj = parseJsonObjectSafe(pedidoMeta);

  // Legacy order without v4 snapshot: never overwrite free text or invalid JSON,
  // and if there are no new authoritative flags to add, leave Order.paymentDetails untouched.
  if (!verifiedSnapshot && isRawTextOrInvalidJson) {
    return undefined;
  }

  const orderObj = stripClientPricingFields(parsedOrderObj);
  let addedFlags = false;

  if (typeof orderObj.exige_prepago !== "boolean" && typeof metaObj.exige_prepago === "boolean") {
    orderObj.exige_prepago = metaObj.exige_prepago;
    addedFlags = true;
  }
  if (typeof orderObj.pago_confirmado !== "boolean" && typeof metaObj.pago_confirmado === "boolean") {
    orderObj.pago_confirmado = metaObj.pago_confirmado;
    addedFlags = true;
  }
  if (!orderObj.pago_estado && typeof metaObj.pago_estado === "string") {
    orderObj.pago_estado = metaObj.pago_estado;
    addedFlags = true;
  }

  if (!verifiedSnapshot && !addedFlags) {
    return rawString !== null ? rawString : undefined;
  }

  const finalObj = verifiedSnapshot ? attachPricingSnapshot(orderObj, verifiedSnapshot) : orderObj;
  return Object.keys(finalObj).length > 0 ? JSON.stringify(finalObj) : undefined;
}

export interface ReconcileOrderSource {
  tableName: string;
  customerAddress?: string | null;
  deliveryCost?: number | null;
  subtotal: number;
  iva: number;
  serviceCharge: number;
  discountAmount?: number | null;
  seasonRateAmount?: number | null;
  tip?: number | null;
  paymentMethod?: string | null;
  paymentDetails?: unknown;
}

/**
 * Pure builder for pedidos.metadata in reconcileUndispatchedOrders.
 * Merges with existing pedidos.metadata (if row already exists), preserves unrelated keys
 * (e.g. processed_round_ids, notas_entrega), propagates authoritative discount/season/tip/payment
 * status from Order, and copies v4 snapshot only from verified server sources (never inventing one).
 */
export function buildReconciledPedidoMetadata(
  ord: ReconcileOrderSource,
  existingPedidoMetadata?: unknown
): Record<string, any> {
  const existingMeta = stripClientPricingFields(parseJsonObjectSafe(existingPedidoMetadata));
  const orderDetails = parseJsonObjectSafe(ord.paymentDetails);
  const verifiedSnapshot =
    extractPricingSnapshot(ord.paymentDetails) ?? extractPricingSnapshot(existingPedidoMetadata);

  const isDelivery = ord.tableName === "Domicilio";
  const isTakeout = ord.tableName === "Llevar";

  const merged: Record<string, any> = {
    ...existingMeta,
    tipo_pedido: isDelivery ? "delivery" : isTakeout ? "llevar" : "mesa",
    tipo_entrega: isDelivery ? "DOMICILIO" : isTakeout ? "RETIRO" : "SALON",
    cliente_direccion: ord.customerAddress ?? existingMeta.cliente_direccion ?? null,
    costo_envio: typeof ord.deliveryCost === "number" ? ord.deliveryCost : (existingMeta.costo_envio ?? 0),
    subtotal: ord.subtotal,
    iva: ord.iva,
    service_charge: ord.serviceCharge,
    discount_amount: typeof ord.discountAmount === "number" ? ord.discountAmount : (existingMeta.discount_amount ?? 0),
    season_rate_amount: typeof ord.seasonRateAmount === "number" ? ord.seasonRateAmount : (existingMeta.season_rate_amount ?? 0),
    tip: typeof ord.tip === "number" ? ord.tip : (existingMeta.tip ?? 0),
    metodo_pago: ord.paymentMethod || existingMeta.metodo_pago || null,
    notas_entrega: existingMeta.notas_entrega ?? null,
    reconciled: true,
  };

  if (typeof orderDetails.exige_prepago === "boolean") {
    merged.exige_prepago = orderDetails.exige_prepago;
  }
  if (typeof orderDetails.pago_confirmado === "boolean") {
    merged.pago_confirmado = orderDetails.pago_confirmado;
  }
  if (typeof orderDetails.pago_estado === "string") {
    merged.pago_estado = orderDetails.pago_estado;
  }

  return verifiedSnapshot ? attachPricingSnapshot(merged, verifiedSnapshot) : merged;
}
