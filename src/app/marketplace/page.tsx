import { Metadata } from "next";
import { getMarketplaceDishesAction } from "@/lib/suggested-dishes-actions";
import { MarketplaceClient } from "./MarketplaceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketplace de Gastronomía y Comercios | MenuQR Pro Ecuador",
  description:
    "Explora los mejores platos del día, bebidas de autor y productos destacados en tiendas asociadas en Ecuador. Pide directo a WhatsApp sin intermediarios ni comisiones.",
  keywords: [
    "marketplace ecuador",
    "platos del dia ecuador",
    "menu qr pro",
    "pedidos whatsapp restaurante",
    "catalogo comercial tiendas ecuador",
    "restaurantes manta",
    "restaurantes montanita",
  ],
  openGraph: {
    title: "Marketplace Oficial | MenuQR Pro",
    description:
      "Descubre platos y productos recomendados de restaurantes y comercios en Ecuador. Haz tu pedido directo por WhatsApp.",
    type: "website",
  },
};

export default async function MarketplacePage() {
  const result = await getMarketplaceDishesAction({
    type: "all",
    onlySuggested: true,
    limit: 100,
  });

  return <MarketplaceClient initialDishes={result.dishes} />;
}
