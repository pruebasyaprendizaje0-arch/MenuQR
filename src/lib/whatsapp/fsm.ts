import { WhatsAppBotState } from "@prisma/client";

export interface ProcessFSMResult {
  status: "success" | "ignored" | "paused" | "error";
  reason?: string;
  sessionState?: WhatsAppBotState;
  responseSent?: boolean;
}

export async function processWhatsAppFSM(_msg: any): Promise<ProcessFSMResult> {
  return { status: "ignored", reason: "Evolution API disabled" };
}

export async function sendOrderStatusNotification(_orderId: string, _newStatus: string): Promise<boolean> {
  return false;
}
