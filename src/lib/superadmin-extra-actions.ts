"use server";

import { getSuperAdminSession } from "@/lib/auth";
import { prismaControl, prismaTenant } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface GlobalAnnouncementData {
  text: string;
  type: "info" | "success" | "warning" | "promo";
  link?: string;
  active: boolean;
  updatedAt?: string;
}

export async function saveGlobalAnnouncementAction(data: GlobalAnnouncementData) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  try {
    const nowIso = new Date().toISOString();

    const settingsToSave = [
      { key: "global_announcement_text", value: data.text.trim() },
      { key: "global_announcement_type", value: data.type || "info" },
      { key: "global_announcement_link", value: (data.link || "").trim() },
      { key: "global_announcement_active", value: data.active ? "true" : "false" },
      { key: "global_announcement_updated_at", value: nowIso },
    ];

    for (const item of settingsToSave) {
      await prismaControl.systemSetting.upsert({
        where: { key: item.key },
        create: { key: item.key, value: item.value },
        update: { value: item.value },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/super-admin");
    return { success: true, updatedAt: nowIso };
  } catch (error) {
    console.error("Error saving global announcement:", error);
    return { error: "No se pudo guardar el comunicado global." };
  }
}

export async function checkInfrastructureHealthAction() {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const results = {
    db: {
      status: "ERROR" as "OK" | "WARNING" | "ERROR",
      latencyMs: 0,
      message: "Sin comprobar",
    },
    evolution: {
      status: "ERROR" as "OK" | "WARNING" | "ERROR",
      latencyMs: 0,
      url: process.env.EVOLUTION_API_URL || "No configurada",
      message: "Sin comprobar",
    },
    email: {
      status: "ERROR" as "OK" | "WARNING" | "ERROR",
      provider: "Resend / SMTP",
      message: "Sin comprobar",
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Check PostgreSQL Database
  const startDb = Date.now();
  try {
    await prismaTenant.$queryRaw`SELECT 1`;
    results.db.latencyMs = Date.now() - startDb;
    results.db.status = results.db.latencyMs < 300 ? "OK" : "WARNING";
    results.db.message = `Conexión activa (${results.db.latencyMs}ms)`;
  } catch (err: any) {
    results.db.status = "ERROR";
    results.db.message = err?.message?.slice(0, 80) || "Fallo de conexión a Postgres";
  }

  // 2. Check WhatsApp Evolution API
  const evoUrl = process.env.EVOLUTION_API_URL?.trim();
  const evoKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!evoUrl) {
    results.evolution.status = "WARNING";
    results.evolution.message = "Variable EVOLUTION_API_URL no configurada";
  } else {
    const startEvo = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const checkUrl = `${evoUrl.replace(/\/$/, "")}/instance/fetchInstances`;
      const res = await fetch(checkUrl, {
        headers: evoKey ? { apikey: evoKey } : {},
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      results.evolution.latencyMs = Date.now() - startEvo;
      if (res.ok) {
        results.evolution.status = "OK";
        results.evolution.message = `API en línea (${results.evolution.latencyMs}ms)`;
      } else {
        results.evolution.status = "WARNING";
        results.evolution.message = `Respondió con código HTTP ${res.status}`;
      }
    } catch (err: any) {
      results.evolution.status = "ERROR";
      results.evolution.message = err?.name === "AbortError" 
        ? "Tiempo de espera agotado (>4s)" 
        : (err?.message?.slice(0, 60) || "Inalcanzable");
    }
  }

  // 3. Check Email Provider (Resend or SMTP configured)
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith("re_"));
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  if (hasResend) {
    results.email.status = "OK";
    results.email.provider = "Resend API";
    results.email.message = `Activo (${process.env.RESEND_FROM || "no-reply"})`;
  } else if (hasSmtp) {
    results.email.status = "OK";
    results.email.provider = `SMTP (${process.env.SMTP_HOST})`;
    results.email.message = `Configurado para ${process.env.SMTP_USER}`;
  } else {
    results.email.status = "WARNING";
    results.email.message = "Sin proveedor configurado en .env";
  }

  return { success: true, health: results };
}
