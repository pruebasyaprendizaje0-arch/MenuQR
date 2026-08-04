import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  // Find user's restaurant
  const restaurant = await prisma.restaurant.findFirst({
    where: { userId: session.userId },
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: {
          dishes: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!restaurant) {
    // If no restaurant exists, create a default one for the user
    const cleanSlug = `restaurante-${session.userId.substring(0, 5)}`;
    await prisma.restaurant.create({
      data: {
        userId: session.userId,
        name: "Mi Restaurante",
        slug: cleanSlug,
        whatsapp: "",
        themeColor: "#ef4444",
        plan: "FREE",
      },
    });
    
    // Redirect to configure it
    redirect("/admin/restaurante");
  }

  // Map null fields to avoid typescript warnings in component
  const serializedRestaurant = {
    ...restaurant,
    logoUrl: restaurant.logoUrl,
    whatsappNumber: restaurant.whatsapp,
    paymentQrUrl: restaurant.qrCobroUrl,
    trialEndsAt: restaurant.trialEndsAt.toISOString(),
    categories: restaurant.categories.map(c => ({
      ...c,
      dishes: c.dishes.map(d => ({
        ...d,
        description: d.description || null,
        imageUrl: d.imageUrl || null
      }))
    }))
  };

  return <AdminDashboard restaurant={serializedRestaurant as unknown as Parameters<typeof AdminDashboard>[0]["restaurant"]} />;
}
