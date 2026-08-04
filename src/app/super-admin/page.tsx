import { getSuperAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SuperAdminLoginForm } from "./components/SuperAdminLoginForm";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const isSuperAdmin = await getSuperAdminSession();

  if (!isSuperAdmin) {
    return <SuperAdminLoginForm />;
  }

  // Load all restaurants
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      _count: {
        select: { categories: true }
      }
    }
  });

  // Calculate metrics
  const now = new Date();
  const totalRestaurants = restaurants.length;
  const activeTrials = restaurants.filter(r => new Date(r.trialEndsAt) > now).length;
  const expiredTrials = totalRestaurants - activeTrials;

  const totalCategories = await prisma.category.count();
  const totalDishes = await prisma.dish.count();

  const metrics = {
    totalRestaurants,
    activeTrials,
    expiredTrials,
    totalCategories,
    totalDishes
  };

  // Serialize dates to prevent Next.js boundaries errors
  const serializedRestaurants = restaurants.map(r => ({
    ...r,
    email: r.user.email,
    whatsappNumber: r.whatsapp,
    qrCobroUrl: r.qrCobroUrl,
    createdAt: r.createdAt.toISOString(),
    trialEndsAt: r.trialEndsAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <SuperAdminDashboard 
      restaurants={serializedRestaurants} 
      metrics={metrics} 
    />
  );
}
