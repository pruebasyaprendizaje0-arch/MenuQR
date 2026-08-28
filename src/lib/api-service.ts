/**
 * Capa de Servicios de API Central (`ubicame-api`) para MenuQR Pro.
 * Conecta las peticiones cliente/servidor HTTP con https://api.ubicame.cc
 */

export const getApiBaseUrl = (): string => {
  const rawUrl =
    process.env.MIGRATION_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.VITE_API_URL ||
    "https://api.ubicame.cc";
  return rawUrl.replace(/\/$/, "");
};

export const isCentralApiEnabled = (): boolean => {
  return (
    process.env.USE_CENTRAL_API === "true" ||
    process.env.NEXT_PUBLIC_USE_CENTRAL_API === "true" ||
    !!process.env.MIGRATION_API_URL ||
    !!process.env.API_URL ||
    !!process.env.NEXT_PUBLIC_API_URL ||
    !!process.env.VITE_API_URL
  );
};

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Realiza peticiones HTTP a la API Central enviando cabeceras y JWT Bearer Token.
 */
function resolveCentralBranchId(slugOrId: string): string {
  const clean = slugOrId.toLowerCase().trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  if (isUuid) {
    return clean;
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const resultPath = path.join(process.cwd(), "migration-result.json");
    if (fs.existsSync(resultPath)) {
      const data = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
      const businesses = data?.mappedIds?.businesses || {};
      for (const key of Object.keys(businesses)) {
        const biz = businesses[key];
        if (biz.slug && biz.slug.toLowerCase().trim() === clean) {
          if (biz.centralBranchId) {
            return biz.centralBranchId;
          }
        }
      }
    }
  } catch {}

  const knownMappings: Record<string, string> = {
    "pigro": "6b8f6423-7ef6-4c8b-9305-51fc0b201f3f",
    "mamma-mia": "f4dfe49c-622b-4f71-9d46-3aaf95074e8b",
    "principal": "7aa64a1c-016c-4b6a-bbcc-6c2b7c3db89d",
  };

  return knownMappings[clean] || clean;
}

/**
 * Realiza peticiones HTTP a la API Central enviando cabeceras y JWT Bearer Token.
 * Soporta timeout de 5 segundos con AbortController y revalidación de caché de Next.js.
 */
async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
    headers["Authorization"] = `Bearer ${cleanToken}`;
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const method = (options.method || "GET").toUpperCase();

  // Configurar timeout máximo de 5 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const startTime = performance.now();
  console.log(`[Central API Request] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      // Aplicar caché de revalidación de 60s para lecturas GET si no se especifica caché personalizada
      ...(isGet ? { next: { revalidate: 60 } } : {}),
      ...restOptions,
    });

    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - startTime);
    console.log(`[Central API Timing] ${method} ${url} respondió en ${duration}ms (HTTP ${response.status})`);

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Ignorar si no es JSON
      }
      const error: any = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      data._httpStatus = response.status;
    }
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const duration = Math.round(performance.now() - startTime);
    if (err.name === "AbortError") {
      console.error(`[Central API Timeout Error] ${method} ${url} superó el tiempo límite de 5000ms (${duration}ms)`);
      const timeoutError: any = new Error(`Request to Central API timed out after 5000ms (${url})`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    console.error(`[Central API Error] ${method} ${url} falló en ${duration}ms: ${err.message}`);
    throw err;
  }
}

export const centralApiService = {
  // --- FASE 1: AUTENTICACIÓN ---

  /**
   * Iniciar sesión en la API Central.
   * POST /v1/auth/login
   */
  async login(email: string, password: string) {
    return apiFetch("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Registrar nuevo usuario en la API Central.
   * POST /v1/auth/register
   */
  async register(data: { name: string; email: string; password: string; phone?: string; role?: string }) {
    return apiFetch("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Obtener perfil del usuario autenticado mediante JWT.
   * GET /v1/auth/me
   */
  async getMe(token: string) {
    return apiFetch("/v1/auth/me", { token });
  },

  // --- FASE 2: LECTURAS ---

  /**
   * Obtener menú público completo (categorías y productos) por branchId o Slug.
   * GET /v1/branches/:branchId/menu
   */
  async getMenu(branchIdOrSlug: string) {
    const branchId = resolveCentralBranchId(branchIdOrSlug);
    const endpoint = `/v1/branches/${branchId}/menu`;
    console.log(`[getMenu Debug Log] URL consultada: ${getApiBaseUrl()}${endpoint} | slug: ${branchIdOrSlug} | branchId: ${branchId}`);
    return apiFetch(endpoint);
  },

  /**
   * Listar negocios del usuario autenticado.
   * GET /v1/businesses
   */
  async getBusinesses(token: string) {
    return apiFetch("/v1/businesses", { token });
  },

  /**
   * Obtener detalle de negocio por ID o Slug.
   * GET /v1/businesses/:businessId
   */
  async getBusinessById(businessIdOrSlug: string, token: string) {
    return apiFetch(`/v1/businesses/${businessIdOrSlug}`, { token });
  },

  /**
   * Listar sucursales de un negocio.
   * GET /v1/businesses/:businessId/branches
   */
  async getBranches(businessId: string, token: string) {
    return apiFetch(`/v1/businesses/${businessId}/branches`, { token });
  },

  /**
   * Listar categorías de una sucursal.
   * GET /v1/branches/:branchId/categories
   */
  async getCategories(branchId: string, token: string) {
    return apiFetch(`/v1/branches/${branchId}/categories`, { token });
  },

  /**
   * Listar productos de una sucursal.
   * GET /v1/branches/:branchId/products
   */
  async getProducts(branchId: string, token: string, categoryId?: string) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return apiFetch(`/v1/branches/${branchId}/products${query}`, { token });
  },

  /**
   * Obtener lista de pedidos de una sucursal.
   * GET /v1/branches/:branchId/orders
   */
  async getOrders(branchId: string, token: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch(`/v1/branches/${branchId}/orders${query}`, { token });
  },

  // --- FASE 3: ESCRITURAS ---

  /**
   * Crear un nuevo negocio.
   * POST /v1/businesses
   */
  async createBusiness(businessData: {
    name: string;
    slug?: string;
    industry?: string;
    description?: string;
    whatsapp?: string;
  }, token: string) {
    return apiFetch("/v1/businesses", {
      method: "POST",
      body: JSON.stringify(businessData),
      token,
    });
  },

  /**
   * Actualizar un negocio existente.
   * PUT /v1/businesses/:businessId
   */
  async updateBusiness(businessId: string, businessData: any, token: string) {
    return apiFetch(`/v1/businesses/${businessId}`, {
      method: "PUT",
      body: JSON.stringify(businessData),
      token,
    });
  },

  /**
   * Crear una nueva sucursal en un negocio.
   * POST /v1/businesses/:businessId/branches
   */
  async createBranch(businessId: string, branchData: {
    name: string;
    slug?: string;
    address?: string;
    phone?: string;
    deliveryCost?: number;
    ivaPercent?: number;
    servicePercent?: number;
    tablesConfig?: string;
  }, token: string) {
    return apiFetch(`/v1/businesses/${businessId}/branches`, {
      method: "POST",
      body: JSON.stringify(branchData),
      token,
    });
  },

  /**
   * Crear una nueva categoría en una sucursal.
   * POST /v1/branches/:branchId/categories
   */
  async createCategory(branchId: string, categoryData: {
    name: string;
    order?: number;
    isActive?: boolean;
  }, token: string) {
    return apiFetch(`/v1/branches/${branchId}/categories`, {
      method: "POST",
      body: JSON.stringify(categoryData),
      token,
    });
  },

  /**
   * Actualizar una categoría existente.
   * PUT /v1/categories/:categoryId
   */
  async updateCategory(categoryId: string, categoryData: {
    name?: string;
    order?: number;
    isActive?: boolean;
  }, token: string) {
    return apiFetch(`/v1/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(categoryData),
      token,
    });
  },

  /**
   * Eliminar una categoría.
   * DELETE /v1/categories/:categoryId
   */
  async deleteCategory(categoryId: string, token: string) {
    return apiFetch(`/v1/categories/${categoryId}`, {
      method: "DELETE",
      token,
    });
  },

  /**
   * Crear un nuevo producto en una sucursal.
   * POST /v1/branches/:branchId/products
   */
  async createProduct(branchId: string, productData: {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable?: boolean;
    order?: number;
  }, token: string) {
    return apiFetch(`/v1/branches/${branchId}/products`, {
      method: "POST",
      body: JSON.stringify(productData),
      token,
    });
  },

  /**
   * Actualizar un producto existente.
   * PUT /v1/products/:productId
   */
  async updateProduct(productId: string, productData: {
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    isAvailable?: boolean;
    order?: number;
  }, token: string) {
    return apiFetch(`/v1/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(productData),
      token,
    });
  },

  /**
   * Cambiar disponibilidad de un producto (Activar / Desactivar).
   * PATCH /v1/products/:productId/availability
   */
  async setProductAvailability(productId: string, isAvailable: boolean, token: string) {
    return apiFetch(`/v1/products/${productId}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable }),
      token,
    });
  },

  /**
   * Eliminar un producto.
   * DELETE /v1/products/:productId
   */
  async deleteProduct(productId: string, token: string) {
    return apiFetch(`/v1/products/${productId}`, {
      method: "DELETE",
      token,
    });
  },

  /**
   * Crear un nuevo pedido en una sucursal.
   * POST /v1/branches/:branchId/orders
   */
  async createOrder(branchId: string, orderData: {
    tableName?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: Array<{
      productId?: string;
      productName: string;
      unitPrice: number;
      quantity: number;
    }>;
    paymentMethod?: string;
    notes?: string;
  }, token?: string) {
    return apiFetch(`/v1/branches/${branchId}/orders`, {
      method: "POST",
      body: JSON.stringify(orderData),
      token,
    });
  },

  /**
   * Actualizar estado de un pedido.
   * PATCH /v1/orders/:orderId/status
   */
  async updateOrderStatus(orderId: string, status: string, token: string) {
    return apiFetch(`/v1/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      token,
    });
  },
};