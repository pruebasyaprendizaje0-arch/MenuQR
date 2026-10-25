import { CampaignDiscountType } from "./campaign-types";

/**
 * Helper para calcular precio promocional sincrónicamente
 * (Apto para componentes de cliente y servidor sin requerir RPC)
 */
export function calculateItemPromoPrice(
  originalPrice: number,
  discountType: CampaignDiscountType,
  discountValue: number,
  customPromoPrice?: number | null
): number {
  if (typeof customPromoPrice === "number" && customPromoPrice >= 0) {
    return Number(customPromoPrice.toFixed(2));
  }

  if (discountType === "PERCENTAGE" && discountValue > 0) {
    const discounted = originalPrice * (1 - discountValue / 100);
    return Math.max(0, Number(discounted.toFixed(2)));
  }

  if (discountType === "FIXED_PRICE" && discountValue > 0) {
    return Number(discountValue.toFixed(2));
  }

  return originalPrice;
}
