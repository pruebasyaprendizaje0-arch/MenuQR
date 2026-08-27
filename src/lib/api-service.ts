/**
 * Capa de Servicios de API Central (`ubicame-api`) para MenuQR Pro.
 * Permite la conexión cliente/servidor HTTP con https://api.ubicame.cc
 */

const API_BASE_URL = (
  process.env.VITE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "https://api.ubicame.cc"
).replace(/\/$/, "");

export const isCentralApiEnabled = (): boolean => {
  return (
    process.env.USE_CENTRAL_API === "true" ||
    !!process.env.VITE_API_URL ||
    !!process.env.NEXT_PUBLIC_API_URL
  );
};

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Realiza peticiones HTTP a la API Central enviando cabeceras y JWT Bearer Token.
 */
async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  console.log(`[API Client Central] ${options.method || "GET"} ${url}`);

  const response = await fetch(url, {
    headers,
    ...restOptions,
  });

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

  return response.json();
}

export const centralApiService = {
  /**
   * Obtener menú público completo (categorías y productos) de una sucursal.
   * GET /v1/branches/:branchId/menu
   */
  async getMenu(branchIdOrSlug: string) {
    return apiFetch(`/v1/branches/${branchIdOrSlug}/menu`);
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
   * Obtener lista de pedidos de una sucursal.
   * GET /v1/branches/:branchId/orders
   */
  async getOrders(branchId: string, token: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch(`/v1/branches/${branchId}/orders${query}`, {
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

  /**
   * Listar negocios del usuario autenticado.
   * GET /v1/businesses
   */
  async getBusinesses(token: string) {
    return apiFetch("/v1/businesses", { token });
  },

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
   * Listar sucursales de un negocio.
   * GET /v1/businesses/:businessId/branches
   */
  async getBranches(businessId: string, token: string) {
    return apiFetch(`/v1/businesses/${businessId}/branches`, { token });
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
};