// src/lib/checkout-recovery.ts
// Gestión de ciclo de vida, persistencia e idempotencia de compras inciertas para MenuQR Pro

export interface PendingCheckoutAttempt {
  orderId: string;
  clientSecret: string;
  actionPayload: any;
  itemsData: any[];
  kdsTargetMesa: string;
  kdsTargetTipoEntrega: string;
  kdsMetodoEntrega: string;
  fullCustomerAddress: string | null;
  customerName: string;
  customerPhone: string;
  deliveryCost: number;
  total: number;
  isTableOrder: boolean;
  isDeliveryOrder: boolean;
  savedAt: string;
}

export type CheckoutErrorCode =
  | "AUTH_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_CANCELLED"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "TRANSITIONAL_ERROR";

export interface ActionResultLike {
  success?: boolean;
  isRetry?: boolean;
  orderId?: string;
  orderNumber?: number;
  dispatchToken?: string;
  subtotal?: number;
  discountAmount?: number;
  seasonRateAmount?: number;
  seasonRateName?: string | null;
  iva?: number;
  serviceCharge?: number;
  deliveryCost?: number;
  tip?: number;
  total?: number;
  error?: string;
  errorCode?: CheckoutErrorCode | string;
}

export type CheckoutResolutionType =
  | "RETRY_SAME_ATTEMPT"        // Error transitorio / red: conserva snapshot y reintenta
  | "BLOCKED_NEEDS_RESOLUTION"  // Conflicto de contenido, auth o INVALID_INPUT incierto: NO crea segundo pedido
  | "ORDER_WAS_CANCELLED"       // Pedido cancelado en restaurante: notifica claramente que existió y se canceló
  | "DEFINITIVE_REJECTION"      // Rechazo seguro y definitivo confirmado por el servidor
  | "RESOLVED_SUCCESS";         // Orden confirmada / recuperada: procede a despacho

export interface CheckoutResolution {
  type: CheckoutResolutionType;
  shouldRetainAttempt: boolean;
  blockNewOrder: boolean;
  userMessage: string;
}

/**
 * Obtiene la clave de almacenamiento para sessionStorage aislada por negocio.
 */
export function getPendingAttemptStorageKey(businessSlugOrId: string): string {
  const cleanKey = String(businessSlugOrId || "default").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `menuqr_pending_attempt_${cleanKey}`;
}

/**
 * Guarda las claves y snapshot del pedido en sessionStorage ANTES de emitir createOrderAction.
 * No emite credenciales a logs ni a URLs.
 */
export function savePendingAttemptToStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  businessKey: string,
  attempt: PendingCheckoutAttempt
): boolean {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    const key = getPendingAttemptStorageKey(businessKey);
    storage.setItem(key, JSON.stringify(attempt));
    return true;
  } catch {
    // Falla segura sin exponer datos
    return false;
  }
}

/**
 * Restaura el intento pendiente desde sessionStorage al recargar la página.
 */
export function loadPendingAttemptFromStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
  businessKey: string
): PendingCheckoutAttempt | null {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const key = getPendingAttemptStorageKey(businessKey);
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.orderId === "string" && typeof parsed.clientSecret === "string" && parsed.actionPayload) {
      return parsed as PendingCheckoutAttempt;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Limpia el intento pendiente de sessionStorage ÚNICAMENTE cuando su resultado está resuelto.
 */
export function clearPendingAttemptFromStorage(
  storage: Pick<Storage, "removeItem"> | null | undefined,
  businessKey: string
): boolean {
  if (!storage || typeof storage.removeItem !== "function") return false;
  try {
    const key = getPendingAttemptStorageKey(businessKey);
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Evalúa la respuesta de createOrderAction distinguiendo códigos explícitos:
 * - Error transitorio o de red: conserva claves y snapshot para recuperar el mismo intento.
 * - Error de autorización o conflicto: no demuestra inexistencia; bloquea la creación automática de otra compra.
 * - Rechazo definitivo: libera el intento.
 * - Éxito: resuelve y libera.
 */
export function processCheckoutAttemptResult(
  resultOrError: ActionResultLike | Error | unknown
): CheckoutResolution {
  // 1. Error de red / excepción no controlada
  if (resultOrError instanceof Error) {
    return {
      type: "RETRY_SAME_ATTEMPT",
      shouldRetainAttempt: true,
      blockNewOrder: true,
      userMessage: "Comprobando el pedido anterior: la conexión con el servidor se interrumpió. Tu pedido anterior NO se ha cancelado ni borrado. Se volverá a comprobar en tu siguiente intento sin duplicar compras.",
    };
  }

  const res = (resultOrError || {}) as ActionResultLike;

  // 2. Éxito o reintento confirmado
  if (res.success || res.isRetry) {
    return {
      type: "RESOLVED_SUCCESS",
      shouldRetainAttempt: false,
      blockNewOrder: false,
      userMessage: "Pedido confirmado exitosamente.",
    };
  }

  // 3. Evaluar códigos de error estructurados del servidor
  const code = res.errorCode;

  if (code === "AUTH_CONFLICT" || code === "IDEMPOTENCY_CONFLICT" || code === "UNAUTHORIZED") {
    return {
      type: "BLOCKED_NEEDS_RESOLUTION",
      shouldRetainAttempt: true,
      blockNewOrder: true,
      userMessage: `⚠️ Atención: Se detectó una inconsistencia con tu pedido anterior (${res.error || "conflicto de autorización o contenido"}). Para protegerte de cobros duplicados, se ha bloqueado la creación de una segunda compra. Por favor verifica tu pedido con el personal del restaurante.`,
    };
  }

  if (code === "ORDER_CANCELLED") {
    const orderNumText = res.orderNumber ? `(#${res.orderNumber}) ` : "";
    return {
      type: "ORDER_WAS_CANCELLED",
      shouldRetainAttempt: false,
      blockNewOrder: false,
      userMessage: `Tu pedido anterior ${orderNumText}fue registrado en el restaurante, pero ha sido cancelado por el establecimiento. Si deseas, puedes realizar un nuevo pedido.`,
    };
  }

  if (code === "INVALID_INPUT") {
    // Para liberar un intento incierto, no basta con recibir INVALID_INPUT:
    // ese rechazo podría ocurrir antes de buscar un pedido ya creado (ej. stock agotado o cupón agotado por la compra previa).
    // Conserva el intento y bloquea un segundo pedido automático.
    return {
      type: "BLOCKED_NEEDS_RESOLUTION",
      shouldRetainAttempt: true,
      blockNewOrder: true,
      userMessage: `⚠️ Atención: El servidor reportó un error con los datos del pedido (${res.error || "datos inválidos"}). Dado que existe una compra previa en estado incierto, el intento no se descarta automáticamente para protegerte de cobros duplicados. Por favor verifica con el personal del restaurante.`,
    };
  }

  // 4. Error genérico o transitorio por defecto (TRANSITIONAL_ERROR u otros)
  return {
    type: "RETRY_SAME_ATTEMPT",
    shouldRetainAttempt: true,
    blockNewOrder: true,
    userMessage: res.error || "Ocurrió una interrupción temporal al verificar tu pedido. Tus datos originales se conservan para reintentar la comprobación.",
  };
}

export interface KdsDispatchPayload {
  order_id: string;
  dispatch_token: string;
  negocio_id: string;
  slug: string;
  mesa: string;
  tipo_entrega: string;
  metodo_entrega: string;
  skip_stock_deduction: boolean;
  is_round?: boolean;
  round_attempt_id?: string;
  table_session_token?: string;
  items: Array<{
    dishId?: string;
    id?: string;
    orderItemId?: string;
    nombre?: string;
    cantidad?: number;
    precio?: number;
    notas?: string | null;
  }>;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  costo_envio: number;
  total: number;
}

export interface KdsDispatchResult {
  confirmed: boolean;
  status?: number;
  pedido?: any;
  error?: string;
  savedAmounts?: {
    subtotal?: number;
    iva?: number;
    serviceCharge?: number;
    deliveryCost?: number;
    total?: number;
  };
}

/**
 * Ejecuta el despacho hacia el KDS de cocina (/api/pedidos) y verifica que la respuesta HTTP
 * sea satisfactoria (2xx) y contenga kdsData.ok === true.
 * Ante cualquier fallo (403, 500, red, JSON inválido), retorna confirmed: false.
 */
export async function executeKdsDispatch(
  fetchFn: typeof fetch,
  clientSecret: string,
  payload: KdsDispatchPayload
): Promise<KdsDispatchResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-client-secret": clientSecret,
    };
    if (payload.table_session_token) {
      headers["x-table-session"] = payload.table_session_token;
    }

    const res = await fetchFn("/api/pedidos", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        confirmed: false,
        status: res.status,
        error: `HTTP ${res.status}: Fallo en respuesta del KDS de cocina`,
      };
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return {
        confirmed: false,
        status: res.status,
        error: "Respuesta del KDS no contiene JSON válido",
      };
    }

    if (!data || !data.ok) {
      return {
        confirmed: false,
        status: res.status,
        error: data?.error || "KDS no confirmó el despacho del pedido (ok !== true)",
      };
    }

    return {
      confirmed: true,
      status: res.status,
      pedido: data.pedido,
      savedAmounts: data.subtotal !== undefined || data.total !== undefined ? {
        subtotal: typeof data.subtotal === "number" ? data.subtotal : undefined,
        iva: typeof data.iva === "number" ? data.iva : undefined,
        serviceCharge: typeof data.service_charge === "number" ? data.service_charge : (typeof data.serviceCharge === "number" ? data.serviceCharge : undefined),
        deliveryCost: typeof data.costo_envio === "number" ? data.costo_envio : (typeof data.deliveryCost === "number" ? data.deliveryCost : undefined),
        total: typeof data.total === "number" ? data.total : undefined,
      } : undefined,
    };
  } catch (err: any) {
    return {
      confirmed: false,
      error: err?.message || "Excepción de red al contactar el KDS de cocina",
    };
  }
}
