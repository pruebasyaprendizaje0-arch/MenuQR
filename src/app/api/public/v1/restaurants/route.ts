import { NextResponse } from "next/server";
import { prismaTenant } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city") || searchParams.get("ciudad");
    const province = searchParams.get("province") || searchParams.get("provincia");
    const category = searchParams.get("category") || searchParams.get("categoria");
    const q = searchParams.get("q");

    const where: any = {};

    if (city) {
      where.OR = [
        { city: { equals: city, mode: "insensitive" } },
        { locality: { contains: city, mode: "insensitive" } },
      ];
    }

    if (province) {
      where.province = { equals: province, mode: "insensitive" };
    }

    if (category) {
      where.OR = [
        ...(where.OR || []),
        { specialty: { contains: category, mode: "insensitive" } },
        { categories: { some: { name: { contains: category, mode: "insensitive" } } } },
      ];
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { specialty: { contains: q, mode: "insensitive" } },
        { locality: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ];
    }

    const restaurants = await prismaTenant.restaurant.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        specialty: true,
        locality: true,
        city: true,
        province: true,
        sector: true,
        address: true,
        whatsapp: true,
        logoUrl: true,
        coverUrl: true,
        description: true,
        schedule: true,
        deliveryEnabled: true,
        deliveryCost: true,
        latitude: true,
        longitude: true,
        categories: {
          select: {
            id: true,
            name: true,
            dishes: {
              where: { isAvailable: true },
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error: any) {
    console.error("[Public API Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar restaurantes públicos." },
      { status: 500 }
    );
  }
}
