import { NextRequest, NextResponse } from "next/server";
import { verifyInternalApiKey } from "@/lib/internal-auth";
import {
  calculateWeeklyMetrics,
  generateAllActiveRestaurantsWeeklySummaries,
  getPreviousWeekDateRange,
} from "@/lib/metrics-engine";

export async function GET(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API interno inválido o ausente." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const restaurantId = searchParams.get("restaurantId");
    const weekOffset = parseInt(searchParams.get("weekOffset") || "1", 10);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      const range = getPreviousWeekDateRange(Number.isNaN(weekOffset) ? 1 : weekOffset);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    if (restaurantId) {
      const summary = await calculateWeeklyMetrics(restaurantId, startDate, endDate);
      if (!summary) {
        return NextResponse.json(
          { success: false, error: `Restaurante '${restaurantId}' no encontrado` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        count: 1,
        data: [summary],
      });
    }

    const summaries = await generateAllActiveRestaurantsWeeklySummaries(startDate, endDate);
    return NextResponse.json({
      success: true,
      count: summaries.length,
      data: summaries,
    });
  } catch (error: any) {
    console.error("Error en GET /api/internal/metrics/weekly-summary:", error);
    return NextResponse.json(
      { success: false, error: "Error al generar resumen de métricas semanales" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json(
      { success: false, error: "No autorizado. Token de API interno inválido o ausente." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const restaurantId = body?.restaurantId;
    const weekOffset = typeof body?.weekOffset === "number" ? body.weekOffset : 1;
    const startDateParam = body?.startDate;
    const endDateParam = body?.endDate;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      const range = getPreviousWeekDateRange(weekOffset);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    if (restaurantId) {
      const summary = await calculateWeeklyMetrics(restaurantId, startDate, endDate);
      if (!summary) {
        return NextResponse.json(
          { success: false, error: `Restaurante '${restaurantId}' no encontrado` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        count: 1,
        data: [summary],
      });
    }

    const summaries = await generateAllActiveRestaurantsWeeklySummaries(startDate, endDate);
    return NextResponse.json({
      success: true,
      count: summaries.length,
      data: summaries,
    });
  } catch (error: any) {
    console.error("Error en POST /api/internal/metrics/weekly-summary:", error);
    return NextResponse.json(
      { success: false, error: "Error al generar resumen de métricas semanales" },
      { status: 500 }
    );
  }
}
