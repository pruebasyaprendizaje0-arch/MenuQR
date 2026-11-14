"use server";

import { prisma } from "@/lib/prisma";
import { verifyRestaurantOwnership } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import {
  encryptDatilPassword,
  decryptDatilPassword,
  maskDatilPassword,
} from "./datil-encryption";
import {
  emitDatilInvoice,
  checkDatilInvoiceStatus,
  EmitInvoiceResult,
} from "./datil-service";
import { validateEcuadorianRuc, CustomerInvoiceInput } from "./datil-utils";

export interface DatilConfigDTO {
  isEnabled: boolean;
  environment: "TEST" | "PROD";
  apiKey: string;
  hasPassword: boolean;
  apiPasswordMasked: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  direccionEstablecimiento: string;
  regimen: "GENERAL" | "RIMPE_EMPRENDEDOR" | "RIMPE_POPULAR";
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string;
  establecimiento: string;
  puntoEmision: string;
  secuencialFactura: number;
}

const DATIL_API_URL = "https://api.datil.co/v1";
const TIMEOUT_MS = 6000;



/**
 * Obtiene la configuración de Dátil para el negocio (enmascarando credenciales sensibles).
 */
export async function getDatilConfigAction(
  restaurantId: string
): Promise<{ success: boolean; config?: DatilConfigDTO; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const config = await prisma.datilConfig.findUnique({
      where: { restaurantId },
    });

    if (!config) {
      return {
        success: true,
        config: {
          isEnabled: false,
          environment: "TEST",
          apiKey: "",
          hasPassword: false,
          apiPasswordMasked: "",
          ruc: "",
          razonSocial: "",
          nombreComercial: "",
          direccionMatriz: "",
          direccionEstablecimiento: "",
          regimen: "GENERAL",
          obligadoContabilidad: false,
          contribuyenteEspecial: "",
          establecimiento: "001",
          puntoEmision: "001",
          secuencialFactura: 1,
        },
      };
    }

    // Si la apiKey almacenada accidentalmente contiene un correo electrónico (por autocompletado del navegador),
    // purgar de inmediato de la base de datos para no retener credenciales personales jamás.
    let sanitizedApiKey = config.apiKey || "";
    let hasPassword = Boolean(
      config.apiPasswordEncrypted && config.apiPasswordEncrypted.length > 0
    );

    if (config.apiKey && config.apiKey.includes("@")) {
      await prisma.datilConfig.update({
        where: { restaurantId },
        data: {
          apiKey: "",
          apiPasswordEncrypted: null,
        },
      });
      sanitizedApiKey = "";
      hasPassword = false;
    }

    return {
      success: true,
      config: {
        isEnabled: config.isEnabled,
        environment: (config.environment as "TEST" | "PROD") || "TEST",
        apiKey: sanitizedApiKey,
        hasPassword,
        apiPasswordMasked: maskDatilPassword(hasPassword),
        ruc: config.ruc || "",
        razonSocial: config.razonSocial || "",
        nombreComercial: config.nombreComercial || "",
        direccionMatriz: config.direccionMatriz || "",
        direccionEstablecimiento: config.direccionEstablecimiento || "",
        regimen: (config.regimen as any) || "GENERAL",
        obligadoContabilidad: config.obligadoContabilidad || false,
        contribuyenteEspecial: config.contribuyenteEspecial || "",
        establecimiento: config.establecimiento || "001",
        puntoEmision: config.puntoEmision || "001",
        secuencialFactura: config.secuencialFactura || 1,
      },
    };
  } catch (error: any) {
    console.error("Error al obtener configuración de Dátil:", error);
    return { success: false, error: "Error al cargar la configuración de facturación." };
  }
}

/**
 * Prueba la conexión en vivo con la API de Dátil usando X-Key y X-Password.
 * Timeout estricto de 6 segundos para garantizar tolerancia a fallos.
 */
export async function testDatilConnectionAction(params: {
  restaurantId: string;
  apiKey: string;
  apiPassword?: string;
  environment: "TEST" | "PROD";
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(params.restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const apiKey = params.apiKey?.trim();
    if (!apiKey) {
      return { success: false, error: "Debes ingresar el X-Key (API Key) de Dátil." };
    }
    if (apiKey.includes("@")) {
      return {
        success: false,
        error: "El X-Key no puede ser un correo electrónico personal. Debes ingresar la API Key provista por el portal de Dátil.",
      };
    }

    let apiPasswordPlain = params.apiPassword?.trim();

    // Si no se pasó contraseña nueva, intentar descifrar la guardada en la base de datos
    if (!apiPasswordPlain) {
      const existing = await prisma.datilConfig.findUnique({
        where: { restaurantId: params.restaurantId },
        select: { apiPasswordEncrypted: true },
      });
      if (existing?.apiPasswordEncrypted) {
        apiPasswordPlain = decryptDatilPassword(existing.apiPasswordEncrypted);
      }
    }

    if (!apiPasswordPlain) {
      return { success: false, error: "Debes ingresar el X-Password (Contraseña de API) de Dátil." };
    }

    // Consulta de prueba a la API de Dátil con timeout de 6s
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${DATIL_API_URL}/invoices?limit=1`, {
        method: "GET",
        headers: {
          "X-Key": apiKey,
          "X-Password": apiPasswordPlain,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 200 || res.status === 204) {
        return {
          success: true,
          message: `¡Conexión exitosa con la API de Dátil (${params.environment === "PROD" ? "Ambiente Producción SRI" : "Ambiente Pruebas SRI"})!`,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: "Credenciales rechazadas por Dátil: Verifica que tu X-Key y X-Password sean correctos.",
        };
      }

      const errorText = await res.text().catch(() => "");
      return {
        success: false,
        error: `Dátil devolvió estado ${res.status}: ${errorText.slice(0, 150) || "Error de autenticación"}`,
      };
    } catch (fetchErr: any) {
      clearTimeout(timer);
      if (fetchErr.name === "AbortError" || fetchErr.message?.includes("aborted")) {
        return {
          success: false,
          error: "Tiempo de espera agotado (6s). El servidor de Dátil o el SRI no respondieron a tiempo.",
        };
      }
      return {
        success: false,
        error: "No se pudo contactar a la API de Dátil. Verifica tu conexión de red o las credenciales.",
      };
    }
  } catch (err: any) {
    console.error("Error probando conexión a Dátil:", err);
    return { success: false, error: err.message || "Error al probar conexión con Dátil." };
  }
}

/**
 * Guarda o actualiza la configuración tributaria y de Dátil del emisor.
 * Cifra la contraseña de API en AES-256 antes de guardarla en la base de datos.
 */
export async function saveDatilConfigAction(
  restaurantId: string,
  formData: {
    isEnabled: boolean;
    environment: "TEST" | "PROD";
    apiKey: string;
    apiPassword?: string;
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccionMatriz: string;
    direccionEstablecimiento?: string;
    regimen: "GENERAL" | "RIMPE_EMPRENDEDOR" | "RIMPE_POPULAR";
    obligadoContabilidad: boolean;
    contribuyenteEspecial?: string;
    establecimiento: string;
    puntoEmision: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const cleanRuc = (formData.ruc || "").trim();
    if (formData.isEnabled && !validateEcuadorianRuc(cleanRuc)) {
      return {
        success: false,
        error: "El RUC del emisor debe tener 13 dígitos y terminar en 001 (ej. 1790012345001).",
      };
    }

    if (formData.isEnabled && !formData.razonSocial?.trim()) {
      return {
        success: false,
        error: "La Razón Social del emisor registrada en el SRI es obligatoria.",
      };
    }

    if (formData.isEnabled && !formData.direccionMatriz?.trim()) {
      return {
        success: false,
        error: "La Dirección Matriz del emisor es obligatoria para la factura electrónica.",
      };
    }

    const cleanApiKey = (formData.apiKey || "").trim();
    if (formData.isEnabled && !cleanApiKey) {
      return {
        success: false,
        error: "El X-Key (API Key) de Dátil es obligatorio si la facturación está habilitada.",
      };
    }
    if (cleanApiKey.includes("@")) {
      return {
        success: false,
        error: "El X-Key no puede ser un correo electrónico personal. Debes ingresar la API Key provista por el portal de Dátil.",
      };
    }

    // Manejo seguro de la contraseña cifrada
    const existingConfig = await prisma.datilConfig.findUnique({
      where: { restaurantId },
      select: { apiPasswordEncrypted: true },
    });

    let newEncryptedPassword = existingConfig?.apiPasswordEncrypted || "";

    if (formData.apiPassword && formData.apiPassword.trim().length > 0) {
      newEncryptedPassword = encryptDatilPassword(formData.apiPassword.trim());
    }

    if (formData.isEnabled && !newEncryptedPassword) {
      return {
        success: false,
        error: "El X-Password (Contraseña de API) de Dátil es obligatorio para emitir comprobantes.",
      };
    }

    const establecimiento = (formData.establecimiento || "001").trim().padStart(3, "0").slice(0, 3);
    const puntoEmision = (formData.puntoEmision || "001").trim().padStart(3, "0").slice(0, 3);

    await prisma.datilConfig.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        isEnabled: formData.isEnabled,
        environment: formData.environment || "TEST",
        apiKey: cleanApiKey,
        apiPasswordEncrypted: newEncryptedPassword,
        ruc: cleanRuc,
        razonSocial: formData.razonSocial?.trim() || "",
        nombreComercial: formData.nombreComercial?.trim() || null,
        direccionMatriz: formData.direccionMatriz?.trim() || "",
        direccionEstablecimiento: formData.direccionEstablecimiento?.trim() || null,
        regimen: formData.regimen || "GENERAL",
        obligadoContabilidad: Boolean(formData.obligadoContabilidad),
        contribuyenteEspecial: formData.contribuyenteEspecial?.trim() || null,
        establecimiento,
        puntoEmision,
      },
      update: {
        isEnabled: formData.isEnabled,
        environment: formData.environment || "TEST",
        apiKey: cleanApiKey,
        apiPasswordEncrypted: newEncryptedPassword,
        ruc: cleanRuc,
        razonSocial: formData.razonSocial?.trim() || "",
        nombreComercial: formData.nombreComercial?.trim() || null,
        direccionMatriz: formData.direccionMatriz?.trim() || "",
        direccionEstablecimiento: formData.direccionEstablecimiento?.trim() || null,
        regimen: formData.regimen || "GENERAL",
        obligadoContabilidad: Boolean(formData.obligadoContabilidad),
        contribuyenteEspecial: formData.contribuyenteEspecial?.trim() || null,
        establecimiento,
        puntoEmision,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");

    return {
      success: true,
      message: "Configuración de Facturación Electrónica (Dátil / SRI) guardada exitosamente.",
    };
  } catch (error: any) {
    console.error("Error guardando configuración de Dátil:", error);
    return { success: false, error: error.message || "Error al guardar la configuración tributaria." };
  }
}

/**
 * Server Action para emitir factura electrónica con Dátil para una orden
 */
export async function emitDatilInvoiceAction(
  restaurantId: string,
  orderId: string,
  customerData?: CustomerInvoiceInput
): Promise<EmitInvoiceResult> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) {
      return { success: false, status: "RECHAZADA_SRI", error: auth.error };
    }

    const res = await emitDatilInvoice(restaurantId, orderId, customerData);
    revalidatePath("/admin");
    revalidatePath("/caja");
    return res;
  } catch (err: any) {
    return {
      success: false,
      status: "RECHAZADA_SRI",
      error: err?.message || "Error al procesar emisión de factura electrónica",
    };
  }
}

/**
 * Server Action para consultar estado SRI de una factura en proceso
 */
export async function checkDatilInvoiceStatusAction(
  restaurantId: string,
  orderId: string
): Promise<EmitInvoiceResult> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) {
      return { success: false, status: "RECHAZADA_SRI", error: auth.error };
    }

    const res = await checkDatilInvoiceStatus(orderId);
    revalidatePath("/admin");
    revalidatePath("/caja");
    return res;
  } catch (err: any) {
    return {
      success: false,
      status: "PENDIENTE_SRI",
      error: err?.message || "Error al consultar estado de factura en Dátil",
    };
  }
}

/**
 * Server Action para resetear y eliminar por completo las credenciales de Dátil de un negocio
 */
export async function resetDatilCredentialsAction(
  restaurantId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { success: false, error: auth.error };

    await prisma.datilConfig.updateMany({
      where: { restaurantId },
      data: {
        apiKey: "",
        apiPasswordEncrypted: "",
        isEnabled: false,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/caja");
    return {
      success: true,
      message: "Credenciales de Dátil eliminadas y reseteadas por defecto en blanco.",
    };
  } catch (err: any) {
    console.error("Error reseteando credenciales de Dátil:", err);
    return { success: false, error: err?.message || "Error al resetear credenciales." };
  }
}

