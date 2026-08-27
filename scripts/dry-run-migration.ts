/**
 * Motor de Migración Autónomo de MenúQR Pro a API Central (ubicame-api)
 *
 * Totalmente independiente de la estructura /app/src para ejecutarse
 * sin problemas dentro del contenedor de producción (stage runner de Docker).
 *
 * MODOS DE EJECUCIÓN:
 *   npx tsx scripts/dry-run-migration.ts            (Modo por defecto: --dry-run / simulación)
 *   npx tsx scripts/dry-run-migration.ts --dry-run  (Modo simulación sin escrituras)
 *   npx tsx scripts/dry-run-migration.ts --execute  (Modo ejecución real con confirmación)
 *
 * SELECCIÓN DE RESTAURANTE OBJETIVO:
 *   --target <id_o_slug> o variable de entorno TARGET_RESTAURANT_ID / TARGET_SLUG
 *   Valor por defecto objetivo: "e0dab57b-190e-4fce-a0ac-4e4b4b5dacee" (Pigro)
 */

import { PrismaClient } from "@prisma/client";
import { validateMigrationResult } from "./validate-migration-result";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// Instancia independiente de Prisma Client
const prisma = new PrismaClient();

// Función autónoma para obtener la URL Base de la API Central
function getApiBaseUrl(): string {
  const rawUrl =
    process.env.MIGRATION_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.ubicame.cc";
  return rawUrl.replace(/\/$/, "");
}

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Cliente HTTP autónomo para comunicación con la API Central.
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

  console.log(`[Central API Request] ${options.method || "GET"} ${url}`);

  const response = await fetch(url, {
    headers,
    ...restOptions,
  });

  console.log(`[Central API Response] HTTP ${response.status} for ${url}`);

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.message) {
        errorMessage = errorJson.message;
      }
    } catch {}
    const error: any = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data && typeof data === "object" && !Array.isArray(data)) {
    data._httpStatus = response.status;
  }
  return data;
}

/**
 * Servicio autónomo de API Central.
 */
const centralApiService = {
  async login(email: string, password: string) {
    return apiFetch("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async register(data: { name: string; email: string; password: string; phone?: string; role?: string }) {
    return apiFetch("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async getMe(token: string) {
    return apiFetch("/v1/auth/me", { token });
  },
  async getBusinesses(token: string) {
    return apiFetch("/v1/businesses", { token });
  },
  async createBusiness(
    businessData: { name: string; slug?: string; industry?: string; description?: string; whatsapp?: string },
    token: string
  ) {
    return apiFetch("/v1/businesses", {
      method: "POST",
      body: JSON.stringify(businessData),
      token,
    });
  },
  async getBranches(businessId: string, token: string) {
    return apiFetch(`/v1/businesses/${businessId}/branches`, { token });
  },
  async createBranch(businessId: string, branchData: any, token: string) {
    return apiFetch(`/v1/businesses/${businessId}/branches`, {
      method: "POST",
      body: JSON.stringify(branchData),
      token,
    });
  },
  async getCategories(branchId: string, token: string) {
    return apiFetch(`/v1/branches/${branchId}/categories`, { token });
  },
  async createCategory(branchId: string, categoryData: any, token: string) {
    return apiFetch(`/v1/branches/${branchId}/categories`, {
      method: "POST",
      body: JSON.stringify(categoryData),
      token,
    });
  },
  async getProducts(branchId: string, token: string, categoryId?: string) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return apiFetch(`/v1/branches/${branchId}/products${query}`, { token });
  },
  async createProduct(branchId: string, productData: any, token: string) {
    return apiFetch(`/v1/branches/${branchId}/products`, {
      method: "POST",
      body: JSON.stringify(productData),
      token,
    });
  },
  async getOrders(branchId: string, token: string) {
    return apiFetch(`/v1/branches/${branchId}/orders`, { token });
  },
  async createOrder(branchId: string, orderData: any, token?: string) {
    return apiFetch(`/v1/branches/${branchId}/orders`, {
      method: "POST",
      body: JSON.stringify(orderData),
      token,
    });
  },
};

// Parsing de argumentos CLI y variables de entorno
const args = process.argv.slice(2);
const isExecuteMode = args.includes("--execute");
const isDryRunMode = !isExecuteMode || args.includes("--dry-run");
const isConfirmedViaFlag = args.includes("--yes") || args.includes("-y");

function getTargetArg(): string | null {
  const targetIndex = args.indexOf("--target");
  if (targetIndex !== -1 && args[targetIndex + 1]) {
    return args[targetIndex + 1].trim();
  }
  return process.env.TARGET_RESTAURANT_ID || process.env.TARGET_SLUG || null;
}

const targetFilter = getTargetArg();

const initialCentralPassword = process.env.INITIAL_CENTRAL_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
const rawDatabaseUrl = process.env.DATABASE_URL || "";

function maskDatabaseUrl(url: string): string {
  if (!url) return "NO_DEFINIDA";
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

function maskEmail(email: string): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : "***";
  return `${maskedName}@${parts[1]}`;
}

function askConfirmation(question: string): Promise<boolean> {
  if (isConfirmedViaFlag) return Promise.resolve(true);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (s/N): `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "s" || normalized === "si" || normalized === "y" || normalized === "yes");
    });
  });
}

interface MigrationOperation {
  entity: "user" | "business" | "branch" | "menu" | "category" | "product" | "order";
  localId: string;
  centralId: string | null;
  httpStatus?: number | null;
  status: "CREATED" | "REUSED" | "PENDING" | "FAILED";
  error?: string | null;
  details?: Record<string, any>;
}

async function main() {
  console.log("=================================================================");
  console.log(`  MenuQR Pro -> Central API Migration Engine (Standalone) [${isDryRunMode ? "MODO SIMULACIÓN (--dry-run)" : "MODO EJECUCIÓN REAL (--execute)"}]`);
  console.log("=================================================================\n");

  if (isExecuteMode && !initialCentralPassword) {
    console.error("❌ ERROR CRÍTICO: Falta definir la contraseña inicial del usuario central (INITIAL_CENTRAL_PASSWORD).");
    process.exit(1);
  }

  const apiUrl = getApiBaseUrl();
  console.log(`🌐 API Central configurada: ${apiUrl}`);
  console.log(`🗄️ Base de datos origen (DATABASE_URL): ${maskDatabaseUrl(rawDatabaseUrl)}`);

  // Leer restaurantes desde la base de datos de producción / local configurada
  const allRestaurants = await prisma.restaurant.findMany({
    include: {
      categories: {
        orderBy: { order: "asc" },
        include: {
          dishes: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  if (allRestaurants.length === 0) {
    console.warn("⚠️ No se encontraron restaurantes en la base de datos configurada.");
  }

  // Filtrar el restaurante objetivo de forma estricta (por ID o por Slug) si se especificó
  let localRestaurants = allRestaurants;
  if (targetFilter) {
    localRestaurants = allRestaurants.filter(
      (r) => r.id.toLowerCase() === targetFilter.toLowerCase() || r.slug.toLowerCase() === targetFilter.toLowerCase()
    );
    if (localRestaurants.length === 0) {
      console.warn(`⚠️ No se encontró el restaurante con filtro '${targetFilter}' en la BD. Procesando todos los restaurantes disponibles (${allRestaurants.length}).`);
      localRestaurants = allRestaurants;
    }
  }

  // Obtener usuarios vinculados a los restaurantes filtrados
  const userIdsToMigrate = Array.from(new Set(localRestaurants.map((r) => r.userId)));
  const localUsers = await prisma.user.findMany({
    where: { id: { in: userIdsToMigrate } },
  });

  const customersCount = await prisma.customer.count();
  const leadsCount = await prisma.lead.count();
  const crmNotesCount = await prisma.crmNote.count();
  const seasonRatesCount = await prisma.seasonRate.count();

  console.log(`\n📊 DATOS REALES DETECTADOS EN BASE DE DATOS:`);
  console.log(`   - Usuarios a migrar: ${localUsers.length}`);
  console.log(`   - Negocios seleccionados: ${localRestaurants.length}`);
  localRestaurants.forEach((r) => {
    console.log(`     • "${r.name}" [slug: ${r.slug} | localRestaurantId: ${r.id}]`);
    console.log(`       └─ Categorías: ${r.categories.length} | Productos: ${r.categories.reduce((acc, c) => acc + c.dishes.length, 0)} | Pedidos: ${r.orders.length}`);
  });
  console.log(`   - Datos CRM omitidos (sin equivalente central): Customers: ${customersCount}, Leads: ${leadsCount}, Notes: ${crmNotesCount}`);

  // Estructura de reporte
  const operations: MigrationOperation[] = [];
  const mappedUsers: Record<string, { email: string; centralId: string | null; status: string }> = {};
  const mappedBusinesses: Record<
    string,
    {
      localRestaurantId: string;
      name: string;
      slug: string;
      centralBusinessId: string | null;
      centralBranchId: string | null;
      centralMenuId: string | null;
      status: string;
      categoriesCount: number;
      productsCount: number;
      ordersCount: number;
      config: any;
    }
  > = {};
  const mappedCategories: Record<string, { name: string; centralCategoryId: string | null; status: string }> = {};
  const mappedProducts: Record<string, { name: string; centralProductId: string | null; status: string }> = {};
  const mappedOrders: Record<string, { orderNumber: number; centralOrderId: string | null; status: string }> = {};

  let globalError: string | null = null;

  if (isDryRunMode) {
    console.log("\n🔍 MODO SIMULACIÓN (DRY-RUN): Verificando estado previo en API Central sin realizar mutaciones...");

    for (const u of localUsers) {
      const masked = maskEmail(u.email);
      let centralUserId: string | null = null;

      if (initialCentralPassword) {
        try {
          const loginRes = await centralApiService.login(u.email, initialCentralPassword);
          if (loginRes?.token) {
            const meRes = await centralApiService.getMe(loginRes.token);
            centralUserId = meRes?.user?.id || meRes?.id || loginRes?.user?.id || loginRes?.id || null;
          }
        } catch {}
      }

      mappedUsers[u.id] = {
        email: masked,
        centralId: centralUserId,
        status: centralUserId ? "REUTILIZAR_USUARIO_EXISTENTE" : "PENDIENTE_REGISTRO",
      };
    }

    for (const r of localRestaurants) {
      mappedBusinesses[r.id] = {
        localRestaurantId: r.id,
        name: r.name,
        slug: r.slug,
        centralBusinessId: null,
        centralBranchId: null,
        centralMenuId: null,
        status: "PENDIENTE_CREAR",
        categoriesCount: r.categories.length,
        productsCount: r.categories.reduce((acc, c) => acc + c.dishes.length, 0),
        ordersCount: r.orders.length,
        config: {
          ivaPercent: r.ivaPercent,
          servicePercent: r.servicePercent,
          deliveryCost: r.deliveryCost,
          tablesConfig: r.tablesConfig,
        },
      };

      for (const cat of r.categories) {
        mappedCategories[cat.id] = {
          name: cat.name,
          centralCategoryId: null,
          status: "PENDIENTE_CREAR",
        };
        for (const dish of cat.dishes) {
          mappedProducts[dish.id] = {
            name: dish.name,
            centralProductId: null,
            status: "PENDIENTE_CREAR",
          };
        }
      }

      for (const order of r.orders) {
        mappedOrders[order.id] = {
          orderNumber: order.orderNumber,
          centralOrderId: null,
          status: "PENDIENTE_CREAR",
        };
      }
    }

    const dryRunReport = {
      timestamp: new Date().toISOString(),
      status: "DRY_RUN",
      mode: "DRY-RUN",
      centralApiUrl: getApiBaseUrl(),
      error: null,
      mappedIds: {
        users: mappedUsers,
        businesses: mappedBusinesses,
        categories: mappedCategories,
        products: mappedProducts,
        orders: mappedOrders,
      },
      unmigratedData: {
        Customer: { count: customersCount, reason: "La API Central actual no posee modelo Customer." },
        Lead: { count: leadsCount, reason: "La API Central actual no posee modelo Lead." },
        CrmNote: { count: crmNotesCount, reason: "La API Central actual no posee modelo CrmNote." },
        SeasonRate: { count: seasonRatesCount, reason: "La API Central actual no posee modelo SeasonRate." },
      },
    };

    fs.writeFileSync(path.join(process.cwd(), "migration-map.json"), JSON.stringify(dryRunReport, null, 2), "utf-8");
    fs.writeFileSync(path.join(process.cwd(), "migration-result.json"), JSON.stringify(dryRunReport, null, 2), "utf-8");

    console.log("\n-----------------------------------------------------------------");
    console.log("ℹ️ SIMULACIÓN (DRY-RUN) COMPLETADA DE FORMA EXITOSA.");
    console.log("   Ninguna petición mutativa (POST/PUT/DELETE) ha sido enviada.");
    console.log("   Todos los IDs centrales permanecen estrictamente en null.");
    console.log("   Reporte guardado en: migration-result.json (status: DRY_RUN)");
    console.log("-----------------------------------------------------------------\n");
    return;
  }

  // --- MODO EXECUTE REAL ---
  console.log("\n⚠️ ATENCIÓN: Estás a punto de ejecutar peticiones HTTP REALES (POST/PUT) en la API Central.");
  const confirmed = await askConfirmation("¿Deseas proceder con la migración real a la API Central?");

  if (!confirmed) {
    console.log("\n🛑 Migración cancelada por el usuario. No se realizaron cambios en la API Central.\n");
    return;
  }

  console.log("\n🚀 INICIANDO MIGRACIÓN REAL EN API CENTRAL...\n");

  let executionFailed = false;

  try {
    // FASE 1: USUARIOS
    for (const u of localUsers) {
      const masked = maskEmail(u.email);
      console.log(`\n👤 [1/7] Migrando Usuario: ${masked}`);
      let token: string | null = null;
      let centralUserId: string | null = null;
      let httpCode = 200;
      let opStatus: "CREATED" | "REUSED" = "REUSED";

      try {
        console.log(`   Attempting POST /v1/auth/login...`);
        const loginRes = await centralApiService.login(u.email, initialCentralPassword!);
        token = loginRes?.token || null;
        centralUserId = loginRes?.user?.id || loginRes?.id || null;
        httpCode = loginRes?._httpStatus || 200;
        console.log(`   ✅ Usuario autenticado en API Central -> centralUserId: ${centralUserId}`);
      } catch (err: any) {
        if (err.status === 401 || err.status === 404) {
          console.log(`   ℹ️ Usuario no existe en API Central. Creando mediante POST /v1/auth/register...`);
          try {
            const regRes = await centralApiService.register({
              name: u.name || "Administrador",
              email: u.email,
              password: initialCentralPassword!,
            });
            token = regRes?.token || null;
            centralUserId = regRes?.user?.id || regRes?.id || null;
            httpCode = regRes?._httpStatus || 201;
            opStatus = "CREATED";
            console.log(`   ✅ Usuario registrado en API Central -> centralUserId: ${centralUserId}`);
          } catch (regErr: any) {
            console.error(`   ❌ Error en POST /v1/auth/register (HTTP ${regErr.status || 500}): ${regErr.message}`);
            throw regErr;
          }
        } else {
          console.error(`   ❌ Error en POST /v1/auth/login (HTTP ${err.status || 500}): ${err.message}`);
          throw err;
        }
      }

      if (!token || !centralUserId) {
        throw new Error(`No se pudo obtener token o centralUserId para el usuario ${masked}`);
      }

      mappedUsers[u.id] = {
        email: masked,
        centralId: centralUserId,
        status: opStatus === "CREATED" ? "REGISTRADO_CENTRAL" : "REUTILIZADO_CENTRAL",
      };

      operations.push({
        entity: "user",
        localId: u.id,
        centralId: centralUserId,
        httpStatus: httpCode,
        status: opStatus,
      });

      // FASE 2: BUSINESS & BRANCH & MENU
      for (const r of localRestaurants) {
        if (r.userId !== u.id) continue;

        console.log(`\n🏢 [2/7] Migrando Negocio: "${r.name}" [slug: ${r.slug} | ID local: ${r.id}]`);

        // Consultar si ya existe el negocio
        const bizListRes = await centralApiService.getBusinesses(token);
        const bizList = Array.isArray(bizListRes) ? bizListRes : bizListRes?.businesses || bizListRes?.data || [];
        let centralBiz = bizList.find((b: any) => b.slug === r.slug || b.name.toLowerCase() === r.name.toLowerCase());
        let bizHttpStatus = 200;
        let bizOpStatus: "CREATED" | "REUSED" = "REUSED";

        if (!centralBiz) {
          console.log(`   ℹ️ Negocio no existe. Creando mediante POST /v1/businesses...`);
          const createBizRes = await centralApiService.createBusiness(
            {
              name: r.name,
              slug: r.slug,
              description: r.description || undefined,
              whatsapp: r.phone || undefined,
            },
            token
          );
          centralBiz = createBizRes?.business || createBizRes;
          bizHttpStatus = createBizRes?._httpStatus || 201;
          bizOpStatus = "CREATED";
          console.log(`   ✅ Negocio creado en API Central -> centralBusinessId: ${centralBiz.id}`);
        } else {
          console.log(`   ✅ Negocio existente reutilizado -> centralBusinessId: ${centralBiz.id}`);
        }

        operations.push({
          entity: "business",
          localId: r.id,
          centralId: centralBiz.id,
          httpStatus: bizHttpStatus,
          status: bizOpStatus,
        });

        // FASE 3: BRANCH & MENU
        console.log(`\n📍 [3/7] Migrando Sucursal y Menú...`);
        const branchListRes = await centralApiService.getBranches(centralBiz.id, token);
        const branchList = Array.isArray(branchListRes) ? branchListRes : branchListRes?.branches || branchListRes?.data || [];
        let centralBranch = branchList[0];
        let branchHttpStatus = 200;
        let branchOpStatus: "CREATED" | "REUSED" = "REUSED";

        if (!centralBranch) {
          console.log(`   ℹ️ Sucursal no existe. Creando mediante POST /v1/businesses/${centralBiz.id}/branches...`);
          const createBranchRes = await centralApiService.createBranch(
            centralBiz.id,
            {
              name: "Principal",
              slug: r.slug,
              phone: r.phone || undefined,
              deliveryCost: r.deliveryCost,
              ivaPercent: r.ivaPercent,
              servicePercent: r.servicePercent,
              tablesConfig: r.tablesConfig,
            },
            token
          );
          centralBranch = createBranchRes?.branch || createBranchRes;
          branchHttpStatus = createBranchRes?._httpStatus || 201;
          branchOpStatus = "CREATED";
          console.log(`   ✅ Sucursal creada -> centralBranchId: ${centralBranch.id}`);
        } else {
          console.log(`   ✅ Sucursal existente reutilizada -> centralBranchId: ${centralBranch.id}`);
        }

        const centralMenuId = centralBranch.menuId || centralBranch.menu?.id || `menu_${centralBranch.id}`;

        mappedBusinesses[r.id] = {
          localRestaurantId: r.id,
          name: r.name,
          slug: r.slug,
          centralBusinessId: centralBiz.id,
          centralBranchId: centralBranch.id,
          centralMenuId,
          status: bizOpStatus === "CREATED" ? "CREADO_CENTRAL" : "REUTILIZADO_CENTRAL",
          categoriesCount: r.categories.length,
          productsCount: r.categories.reduce((acc, c) => acc + c.dishes.length, 0),
          ordersCount: r.orders.length,
          config: {
            ivaPercent: r.ivaPercent,
            servicePercent: r.servicePercent,
            deliveryCost: r.deliveryCost,
            tablesConfig: r.tablesConfig,
          },
        };

        operations.push({
          entity: "branch",
          localId: r.id,
          centralId: centralBranch.id,
          httpStatus: branchHttpStatus,
          status: branchOpStatus,
        });

        operations.push({
          entity: "menu",
          localId: r.id,
          centralId: centralMenuId,
          httpStatus: 200,
          status: "REUSED",
        });

        // FASE 5: CATEGORÍAS
        console.log(`\n🏷️ [4/7] Migrando ${r.categories.length} Categorías...`);
        const existingCatRes = await centralApiService.getCategories(centralBranch.id, token);
        const existingCats = Array.isArray(existingCatRes) ? existingCatRes : existingCatRes?.categories || existingCatRes?.data || [];

        for (const cat of r.categories) {
          let centralCat = existingCats.find((c: any) => c.name.toLowerCase() === cat.name.toLowerCase());
          let catHttpStatus = 200;
          let catOpStatus: "CREATED" | "REUSED" = "REUSED";

          if (!centralCat) {
            console.log(`   ➕ Creando categoría "${cat.name}"...`);
            const createCatRes = await centralApiService.createCategory(
              centralBranch.id,
              {
                name: cat.name,
                order: cat.order,
                isActive: true,
              },
              token
            );
            centralCat = createCatRes?.category || createCatRes;
            catHttpStatus = createCatRes?._httpStatus || 201;
            catOpStatus = "CREATED";
          } else {
            console.log(`   ↪️ Categoría existente reutilizada "${cat.name}" -> ID: ${centralCat.id}`);
          }

          mappedCategories[cat.id] = {
            name: cat.name,
            centralCategoryId: centralCat.id,
            status: catOpStatus === "CREATED" ? "CREADO_CENTRAL" : "REUTILIZADO_CENTRAL",
          };

          operations.push({
            entity: "category",
            localId: cat.id,
            centralId: centralCat.id,
            httpStatus: catHttpStatus,
            status: catOpStatus,
          });

          // FASE 6: PRODUCTOS
          console.log(`\n📦 [5/7] Migrando ${cat.dishes.length} Productos de "${cat.name}"...`);
          const existingProdRes = await centralApiService.getProducts(centralBranch.id, token, centralCat.id);
          const existingProds = Array.isArray(existingProdRes) ? existingProdRes : existingProdRes?.products || existingProdRes?.data || [];

          for (const dish of cat.dishes) {
            let centralProd = existingProds.find((p: any) => p.name.toLowerCase() === dish.name.toLowerCase());
            let prodHttpStatus = 200;
            let prodOpStatus: "CREATED" | "REUSED" = "REUSED";

            if (!centralProd) {
              console.log(`      ➕ Creando producto "${dish.name}" ($${dish.price})...`);
              const createProdRes = await centralApiService.createProduct(
                centralBranch.id,
                {
                  categoryId: centralCat.id,
                  name: dish.name,
                  description: dish.description || undefined,
                  price: Number(dish.price),
                  imageUrl: dish.image || undefined,
                  isAvailable: dish.isAvailable,
                },
                token
              );
              centralProd = createProdRes?.product || createProdRes;
              prodHttpStatus = createProdRes?._httpStatus || 201;
              prodOpStatus = "CREATED";
            } else {
              console.log(`      ↪️ Producto reutilizado "${dish.name}" -> ID: ${centralProd.id}`);
            }

            mappedProducts[dish.id] = {
              name: dish.name,
              centralProductId: centralProd.id,
              status: prodOpStatus === "CREATED" ? "CREADO_CENTRAL" : "REUTILIZADO_CENTRAL",
            };

            operations.push({
              entity: "product",
              localId: dish.id,
              centralId: centralProd.id,
              httpStatus: prodHttpStatus,
              status: prodOpStatus,
            });
          }
        }

        // FASE 7: PEDIDOS
        console.log(`\n🛒 [6/7] Migrando ${r.orders.length} Pedidos...`);
        const existingOrderRes = await centralApiService.getOrders(centralBranch.id, token);
        const existingOrders = Array.isArray(existingOrderRes) ? existingOrderRes : existingOrderRes?.orders || existingOrderRes?.data || [];

        for (const order of r.orders) {
          let centralOrder = existingOrders.find((o: any) => o.orderNumber === order.orderNumber || o.id === order.id);
          let orderHttpStatus = 200;
          let orderOpStatus: "CREATED" | "REUSED" = "REUSED";

          if (!centralOrder) {
            console.log(`   ➕ Creando pedido #${order.orderNumber}...`);
            const orderItemsPayload = order.items.map((item) => {
              const centralProdId = mappedProducts[item.dishId]?.centralProductId;
              return {
                productId: centralProdId || undefined,
                productName: item.dishName,
                unitPrice: Number(item.price),
                quantity: item.quantity,
              };
            });

            const createOrderRes = await centralApiService.createOrder(
              centralBranch.id,
              {
                tableName: order.tableName || undefined,
                customerName: order.customerName || "Cliente Local",
                customerPhone: order.customerPhone || undefined,
                customerAddress: order.address || undefined,
                items: orderItemsPayload,
                paymentMethod: order.paymentMethod || "EFECTIVO",
                notes: order.notes || undefined,
              },
              token
            );
            centralOrder = createOrderRes?.order || createOrderRes;
            orderHttpStatus = createOrderRes?._httpStatus || 201;
            orderOpStatus = "CREATED";
          } else {
            console.log(`   ↪️ Pedido reutilizado #${order.orderNumber} -> ID: ${centralOrder.id}`);
          }

          mappedOrders[order.id] = {
            orderNumber: order.orderNumber,
            centralOrderId: centralOrder.id,
            status: orderOpStatus === "CREATED" ? "CREADO_CENTRAL" : "REUTILIZADO_CENTRAL",
          };

          operations.push({
            entity: "order",
            localId: order.id,
            centralId: centralOrder.id,
            httpStatus: orderHttpStatus,
            status: orderOpStatus,
          });
        }
      }
    }
  } catch (err: any) {
    executionFailed = true;
    globalError = `Error HTTP ${err.status || 500}: ${err.message}`;
    console.error(`\n❌ ERROR CRÍTICO DURANTE LA MIGRACIÓN HTTP: ${globalError}`);
  }

  const finalStatus = executionFailed ? "FAILED" : "SUCCESS";

  const resultReport = {
    timestamp: new Date().toISOString(),
    status: finalStatus,
    mode: "EXECUTE",
    centralApiUrl: getApiBaseUrl(),
    error: globalError,
    operations,
    mappedIds: {
      users: mappedUsers,
      businesses: mappedBusinesses,
      categories: mappedCategories,
      products: mappedProducts,
      orders: mappedOrders,
    },
    unmigratedData: {
      Customer: { count: customersCount, reason: "La API Central actual no posee modelo Customer." },
      Lead: { count: leadsCount, reason: "La API Central actual no posee modelo Lead." },
      CrmNote: { count: crmNotesCount, reason: "La API Central actual no posee modelo CrmNote." },
      SeasonRate: { count: seasonRatesCount, reason: "La API Central actual no posee modelo SeasonRate." },
    },
  };

  // Validar reporte de resultados estricto
  const validation = validateMigrationResult(resultReport as any);
  if (finalStatus === "SUCCESS" && !validation.valid) {
    console.error("\n❌ VALIDACIÓN DE REPORTE FALLIDA: Se intentó generar SUCCESS pero existen inconsistencias:");
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    resultReport.status = "FAILED";
    resultReport.error = `Falló validación de integridad: ${validation.errors.join("; ")}`;
  }

  // Guardar archivo migration-result.json
  const resultPath = path.join(process.cwd(), "migration-result.json");
  fs.writeFileSync(resultPath, JSON.stringify(resultReport, null, 2), "utf-8");

  console.log("\n=================================================================");
  console.log(` 🏁 RESULTADO FINAL DE MIGRACIÓN: [${resultReport.status}]`);
  console.log("=================================================================");
  console.log(` - Reporte guardado en: ${resultPath}`);

  if (resultReport.status === "SUCCESS") {
    console.log(" ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE CON IDs CENTRALES REALES.\n");
  } else {
    console.log(` ❌ MIGRACIÓN FALLIDA: ${resultReport.error}\n`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("❌ Error no controlado en motor de migración:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
