import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ state: "close", message: "WhatsApp Evolution integration disabled" }, { status: 200 });
}

export async function POST() {
  return NextResponse.json({ success: false, error: "WhatsApp Evolution integration disabled" }, { status: 200 });
}

export async function DELETE() {
  return NextResponse.json({ success: true, message: "WhatsApp Evolution integration disabled" }, { status: 200 });
}
