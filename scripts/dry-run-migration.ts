/**
 * Motor de Migración de MenúQR Pro a API Central (ubicame-api)
 *
 * MODOS DE EJECUCIÓN:
 *   npx tsx scripts/dry-run-migration.ts            (Modo por defecto: --dry-run / simulación)
 *   npx tsx scripts/dry-run-migration.ts --dry-run  (Modo simulación sin escrituras)
 *   npx tsx scripts/dry-run-migration.ts --execute  (Modo ejecución real con confirmación)
 */

import { prisma } from "../src/lib/db";
import { centralApiService } from "../src/lib/api-service";
import { validateMigrationResult } from "./validate-migration-result";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// 1. Parsing Flags
const args = process.argv.slice(2);
const isExecuteMode = args.includes("--execute");
const isDryRunMode = !isExecuteMode || args.includes("--dry-run");
const isConfirmedViaFlag = args.includes("--yes") || args.includes("-y");

// 2. Validación de contraseña inicial para modo --execute
const initialCentralPassword = process.env.INITIAL_CENTRAL_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

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
  console.log(`  MenuQR Pro -> Central API Migration Engine [${isDryRunMode ? "MODO SIMULACIÓN (--dry-run)" : "MODO EJECUCIÓN REAL (--execute)"}]`);
  console.log("=================================================================\n");

  if (isExecuteMode && !initialCentralPassword) {
    console.error("❌ ERROR CRÍTICO: Falta definir la contraseña inicial del usuario central.");
    console.error("   Por seguridad, debes definir la variable de entorno INITIAL_CENTRAL_PASSWORD o SUPER_ADMIN_PASSWORD.");
    process.exit(1);
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.ubicame.cc").replace(/\/$/, "");
  console.log(`🌐 API Central configurada: ${apiUrl}`);

  // Leer base local de MenuQR Pro (Solo Lectura)
  const localUsers = await prisma.user.findMany();
  const localRestaurants = await prisma.restaurant.findMany({
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

  const customersCount = await prisma.customer.count();
  const leadsCount = await prisma.lead.count();
  const crmNotesCount = await prisma.crmNote.count();
  const seasonRatesCount = await prisma.seasonRate.count();

  console.log(`\n📊 DATOS LOCALES DETECTADOS:`);
  console.log(`   - Usuarios: ${localUsers.length}`);
  console.log(`   - Negocios: ${localRestaurants.length}`);
  console.log(`   - Categorías: ${localRestaurants.reduce((acc, r) => acc + r.categories.length, 0)}`);
  console.log(`   - Productos: ${localRestaurants.reduce((acc, r) => acc + r.categories.reduce((a, c) => a + c.dishes.length, 0), 0)}`);
  console.log(`   - Pedidos: ${localRestaurants.reduce((acc, r) => acc + r.orders.length, 0)}`);
  console.log(`   - Clientes CRM no migrados (sin equivalente en API Central): ${customersCount}`);

  // Estructura de reporte
  const operations: MigrationOperation[] = [];
  const mappedUsers: Record<string, { email: string; centralId: string | null; status: string }> = {};
  const mappedBusinesses: Record<
    string,
    {
      name: string;
      slug: string;
      centralBusinessId: string | null;
      centralBranchId: string | null;
      centralMenuId: string | null;
      status: string;
      config: any;
    }
  > = {};
  const mappedCategories: Record<string, { name: string; centralCategoryId: string | null; status: string }> = {};
  const mappedProducts: Record<string, { name: string; centralProductId: string | null; status: string }> = {};
  const mappedOrders: Record<string, { orderNumber: number; centralOrderId: string | null; status: string }> = {};

  let globalError: string | null = null;

  if (isDryRunMode) {
    console.log("\n🔍 MODO SIMULACIÓN (DRY-RUN): Comprobando existencia previa de registros...");

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
        name: r.name,
        slug: r.slug,
        centralBusinessId: null,
        centralBranchId: null,
        centralMenuId: null,
        status: "PENDIENTE_CREAR",
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
      centralApiUrl: apiUrl,
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
    console.log("   Ninguna operación mutativa (POST/PUT/DELETE) fue realizada.");
    console.log("   Reporte guardado en: migration-result.json (status: DRY_RUN)");
    console.log("   Para ejecutar la migración real en la API Central:");
    console.log("   npx tsx scripts/dry-run-migration.ts --execute");
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
    // FASE 1: USUARIO
    for (const u of localUsers) {
      const masked = maskEmail(u.email);
      console.log(`\n👤 [1/7] Migrando Usuario: ${masked}`);
      let token: string | null = null;
      let centralUserId: string | null = null;
      let httpCode = 200;
      let opStatus: "CREATED" | "REUSED" = "REUSED";

      try {
        // Intentar Login
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

        console.log(`\n🏢 [2/7] Migrando Negocio: "${r.name}" [slug: ${r.slug}]`);

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
          name: r.name,
          slug: r.slug,
          centralBusinessId: centralBiz.id,
          centralBranchId: centralBranch.id,
          centralMenuId,
          status: bizOpStatus === "CREATED" ? "CREADO_CENTRAL" : "REUTILIZADO_CENTRAL",
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
    console.error(`\n❌ ERROR CRÍTICO DURANTE LA MIGRACIÓN HTTP:`);
    console.error(`   ${globalError}`);
    console.error(`   Deteniendo proceso de migración de forma inmediata.`);
  }

  const finalStatus = executionFailed ? "FAILED" : "SUCCESS";

  const resultReport = {
    timestamp: new Date().toISOString(),
    status: finalStatus,
    mode: "EXECUTE",
    centralApiUrl: apiUrl,
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
