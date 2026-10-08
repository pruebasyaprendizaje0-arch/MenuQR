import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: "Los eventos en tiempo real se transmiten mediante Socket.IO en /api/socket",
  });
}
