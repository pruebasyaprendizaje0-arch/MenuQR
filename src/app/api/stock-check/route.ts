import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    const slug = searchParams.get("slug");

    if (!restaurantId && !slug) {
      return NextResponse.json(
        { error: "Debe proporcionar restaurantId o slug" },
        { status: 400 }
      );
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: restaurantId ? { id: restaurantId } : { slug: slug! },
      select: {
        id: true,
        slug: true,
        customLabels: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    let isInventoryOn = true;
    let isCajaOn = true;
    if (restaurant.customLabels) {
      try {
        const parsed =
          typeof restaurant.customLabels === "string"
            ? JSON.parse(restaurant.customLabels)
            : restaurant.customLabels;
        const disabled: string[] = Array.isArray(parsed?.disabledModules)
          ? parsed.disabledModules
          : [];
        isInventoryOn = !disabled.includes("inventory");
        isCajaOn = !disabled.includes("caja");
      } catch {}
    }
    const forceTrackStock = isInventoryOn && isCajaOn;

    const dishes = await prisma.dish.findMany({
      where: { restaurantId: restaurant.id },
      select: {
        id: true,
        name: true,
        stock: true,
        minStock: true,
        trackStock: true,
        isAvailable: true,
        isService: true,
      },
    });

    const stockMap: Record<
      string,
      {
        stock: number | null;
        isAvailable: boolean;
        trackStock: boolean;
        minStock: number;
      }
    > = {};

    for (const d of dishes) {
      const shouldTrack = Boolean(d.trackStock || (forceTrackStock && !d.isService));
      const effectiveStock = shouldTrack
        ? typeof d.stock === "number"
          ? d.stock
          : 0
        : d.stock;
      const effectiveAvailable =
        d.isAvailable && (!shouldTrack || (effectiveStock ?? 0) > 0);

      stockMap[d.id] = {
        stock: effectiveStock,
        isAvailable: effectiveAvailable,
        trackStock: shouldTrack,
        minStock: d.minStock ?? 0,
      };
    }

    return NextResponse.json(
      {
        success: true,
        restaurantId: restaurant.id,
        forceTrackStock,
        dishes: stockMap,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/stock-check:", error);
    return NextResponse.json(
      { error: "Error interno al verificar existencias" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurantId, items } = body as {
      restaurantId: string;
      items: Array<{ dishId: string; quantity: number }>;
    };

    if (!restaurantId || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Datos de entrada inválidos" },
        { status: 400 }
      );
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { customLabels: true },
    });

    let forceTrackStock = true;
    if (restaurant?.customLabels) {
      try {
        const parsed =
          typeof restaurant.customLabels === "string"
            ? JSON.parse(restaurant.customLabels)
            : restaurant.customLabels;
        const disabled: string[] = Array.isArray(parsed?.disabledModules)
          ? parsed.disabledModules
          : [];
        forceTrackStock =
          !disabled.includes("inventory") && !disabled.includes("caja");
      } catch {}
    }

    const dishIds = items.map((i) => i.dishId).filter(Boolean);
    const dbDishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        restaurantId,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        minStock: true,
        trackStock: true,
        isAvailable: true,
        isService: true,
      },
    });

    const dishMap = new Map(dbDishes.map((d) => [d.id, d]));
    const adjustments: Array<{
      dishId: string;
      name: string;
      requested: number;
      available: number;
      status: "SOLD_OUT" | "REDUCED";
      message: string;
    }> = [];

    const stockMap: Record<
      string,
      {
        stock: number | null;
        isAvailable: boolean;
        trackStock: boolean;
        minStock: number;
      }
    > = {};

    for (const d of dbDishes) {
      const shouldTrack = Boolean(d.trackStock || (forceTrackStock && !d.isService));
      const effectiveStock = shouldTrack
        ? typeof d.stock === "number"
          ? d.stock
          : 0
        : d.stock;
      const effectiveAvailable =
        d.isAvailable && (!shouldTrack || (effectiveStock ?? 0) > 0);

      stockMap[d.id] = {
        stock: effectiveStock,
        isAvailable: effectiveAvailable,
        trackStock: shouldTrack,
        minStock: d.minStock ?? 0,
      };
    }

    for (const item of items) {
      const d = dishMap.get(item.dishId);
      if (!d) {
        adjustments.push({
          dishId: item.dishId,
          name: "Producto desconocido",
          requested: item.quantity,
          available: 0,
          status: "SOLD_OUT",
          message: "Este producto ya no se encuentra en el menú.",
        });
        continue;
      }

      const shouldTrack = Boolean(d.trackStock || (forceTrackStock && !d.isService));
      const currentStock = shouldTrack
        ? typeof d.stock === "number"
          ? d.stock
          : 0
        : d.stock;

      if (!d.isAvailable || (shouldTrack && (currentStock ?? 0) <= 0)) {
        adjustments.push({
          dishId: d.id,
          name: d.name,
          requested: item.quantity,
          available: 0,
          status: "SOLD_OUT",
          message: `"${d.name}" se encuentra agotado.`,
        });
      } else if (shouldTrack && typeof currentStock === "number" && item.quantity > currentStock) {
        adjustments.push({
          dishId: d.id,
          name: d.name,
          requested: item.quantity,
          available: currentStock,
          status: "REDUCED",
          message: `Solo quedan ${currentStock} unidad(es) disponibles de "${d.name}".`,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        valid: adjustments.length === 0,
        adjustments,
        dishes: stockMap,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in POST /api/stock-check:", error);
    return NextResponse.json(
      { error: "Error al validar stock de los productos" },
      { status: 500 }
    );
  }
}
