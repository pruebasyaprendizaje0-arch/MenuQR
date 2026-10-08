import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function MesasRootPage() {
  const session = await getUserSession();
  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeRestId = session.restaurantId || cookieStore.get("active_restaurant_id")?.value;

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { id: activeRestId || undefined },
        { userId: session.userId },
      ],
    },
    select: { slug: true },
  });

  if (restaurant?.slug) {
    redirect(`/${restaurant.slug}/mesas`);
  }

  redirect("/admin");
}
