/**
 * Cliente HTTP defensivo para el servidor Next.js.
 * 
 * Reglas de protección:
 * 1. NUNCA permite que un fetch del lado del servidor quede colgado indefinidamente.
 *    Aplica un timeout estricto por defecto (5000 ms).
 * 2. Previene errores "SSL routines: wrong version number" al sanitizar llamadas internas
 *    (localhost, 127.0.0.1, 0.0.0.0, Docker container hosts) forzando http:// en lugar de https://.
 * 3. Provee manejo resiliente de errores para degradar con gracia sin congelar SSR ni Server Actions.
 */

export interface SafeServerFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface SafeServerFetchResult<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T | null;
  error?: string;
  response?: Response;
}

/**
 * Sanitiza una URL para llamadas internas del servidor:
 * Si apunta a localhost / 127.0.0.1 / 0.0.0.0 con https://, lo convierte a http://
 * para evitar fallos de negociación TLS contra el puerto HTTP puro del contenedor.
 */
export function sanitizeInternalUrl(inputUrl: string | URL): string {
  const urlStr = inputUrl.toString().trim();

  // Detectar https hacia localhost o ips locales
  if (/^https:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(urlStr)) {
    return urlStr.replace(/^https:/i, "http:");
  }

  return urlStr;
}

/**
 * Fetch con timeout garantizado. Si no se provee signal, asigna AbortSignal.timeout(timeoutMs).
 * Si se pasa un signal existente, enlaza ambos para respetar cualquiera de las cancelaciones.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init?: SafeServerFetchOptions
): Promise<Response> {
  const sanitizedUrl = sanitizeInternalUrl(input);
  const timeoutMs = init?.timeoutMs ?? 5000;

  let signal = init?.signal;
  if (!signal) {
    signal = AbortSignal.timeout(timeoutMs);
  } else if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    // Si la versión de Node soporta AbortSignal.any, combinamos ambos
    signal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  }

  const fetchOptions: RequestInit = {
    ...init,
    signal,
  };

  return fetch(sanitizedUrl, fetchOptions);
}

/**
 * Envoltorio seguro de fetch que nunca lanza excepciones no capturadas.
 * Retorna un objeto con { ok, status, data, error } para degradación controlada.
 */
export async function safeServerFetch<T = any>(
  input: string | URL,
  init?: SafeServerFetchOptions
): Promise<SafeServerFetchResult<T>> {
  try {
    const res = await fetchWithTimeout(input, init);

    let parsedData: T | null = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        parsedData = (await res.json()) as T;
      } catch {
        parsedData = null;
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      data: parsedData,
      response: res,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    const errorMessage = isTimeout
      ? `Tiempo de espera agotado (${init?.timeoutMs ?? 5000}ms)`
      : err?.message || String(err);

    console.warn(`[safeServerFetch] Fallo en petición hacia [${input.toString()}]: ${errorMessage}`);

    return {
      ok: false,
      status: isTimeout ? 504 : 500,
      statusText: isTimeout ? "Gateway Timeout" : "Internal Server Error",
      data: null,
      error: errorMessage,
    };
  }
}
