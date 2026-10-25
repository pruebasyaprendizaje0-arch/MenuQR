export type CampaignType = "PROMO" | "EVENT" | "ACTIVITY";
export type CampaignDiscountType = "PERCENTAGE" | "FIXED_PRICE" | "DEAL_2X1" | "CUSTOM";

export interface CampaignDishInput {
  dishId: string;
  promoPrice?: number | null;
  promoLabel?: string | null;
}

export interface CampaignDishDetail {
  id: string;
  campaignId: string;
  dishId: string;
  promoPrice: number | null;
  promoLabel: string | null;
  dish: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    category?: {
      name: string;
    } | null;
  };
}

export interface BusinessCampaignData {
  id: string;
  restaurantId: string;
  title: string;
  type: CampaignType;
  badgeText: string | null;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: string | null;
  discountType: CampaignDiscountType;
  discountValue: number | null;
  ctaType: string;
  ctaText: string | null;
  whatsappMessage: string | null;
  externalUrl: string | null;
  isActive: boolean;
  showInProfile: boolean;
  showInCatalog: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  dishes?: CampaignDishDetail[];
}
