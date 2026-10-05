/**
 * Evolution API Helper (Desactivado a solicitud del usuario)
 * Todas las funciones son inertes para garantizar 0 llamadas de red, 0 bloqueos y 0 timeouts.
 * Los pedidos se envían directamente por WhatsApp mediante enlaces nativos wa.me.
 */

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface ParsedWhatsAppMessage {
  instance: string;
  remoteJid: string;
  phone: string;
  senderName: string;
  fromMe: boolean;
  isGroup: boolean;
  messageId: string;
  text: string;
  messageType?: string;
  timestamp?: number;
}

export interface SendMessageOptions {
  instance?: string;
  to: string;
  text: string;
  delay?: number;
}

export interface SendPresenceOptions {
  instance?: string;
  to: string;
  presence: "composing" | "recording" | "paused";
  delay?: number;
}

export function verifyWebhookAuth(_headers: Headers): { valid: boolean; reason?: string } {
  return { valid: true };
}

export function parseEvolutionPayload(_payload: EvolutionWebhookPayload): ParsedWhatsAppMessage | null {
  return null;
}

export async function getEvolutionCredentials(): Promise<{ baseUrl: string; apiKey: string }> {
  return { baseUrl: "", apiKey: "" };
}

export async function fetchEvolutionRequest(
  _path: string,
  _options: { method?: string; body?: any; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  return { ok: false, status: 503, data: null, error: "Evolution API desactivada" };
}

export async function ensureWhatsAppWebhook(_instanceName: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return { success: false, error: "Evolution API desactivada" };
}

export async function sendWhatsAppText(_options: SendMessageOptions): Promise<{ success: boolean; data?: any; error?: string }> {
  return { success: false, error: "Evolution API desactivada" };
}

export async function sendWhatsAppPresence(_options: SendPresenceOptions): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Evolution API desactivada" };
}

export async function getWhatsAppConnectionState(_instanceName: string): Promise<{ state: "close"; raw?: any; error?: string }> {
  return { state: "close" };
}

export async function connectWhatsAppInstance(_instanceName: string): Promise<{
  success: boolean;
  qrcode?: string;
  base64?: string;
  pairingCode?: string;
  state?: string;
  alreadyConnected?: boolean;
  error?: string;
}> {
  return { success: false, error: "Evolution API desactivada" };
}

export async function logoutWhatsAppInstance(_instanceName: string): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

export async function deleteWhatsAppInstance(_instanceName: string): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}
