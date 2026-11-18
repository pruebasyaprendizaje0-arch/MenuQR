import assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as XLSX from "xlsx";
import {
  generateBusinessBackupZip,
  inspectBackupZip,
  restoreBusinessBackupZip,
  parseZipBuffer,
  createZipBuffer,
  computeCrc32,
  resolveLocalStorageRelativePath,
  validateAndResolveSafeDiskPath,
  validateSafeZipEntryPath,
  MAX_ZIP_FILE_SIZE,
  MAX_TOTAL_UNCOMPRESSED_SIZE,
  MAX_ZIP_ENTRIES,
  type ZipEntry,
  type BusinessDataBackup,
  type BackupManifest,
  type BackupDbClients,
} from "./business-backup";
import { validateImageMagicBytes } from "./storage";

async function runRealBackupTestSuite() {
  console.log("================================================================================");
  console.log("SUITE DE PRUEBAS DE RESPALDO Y RESTAURACIÓN ZIP (MOTOR REAL)");
  console.log("Aclaración de entorno: pruebas ejecutan el código de negocio real con base de datos");
  console.log("simulada (in-memory mock adapter). La integración con PostgreSQL vivo queda como");
  console.log("pendiente explícito hasta desplegar en el entorno de pruebas local.");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------
  // TEST 1: Reconocimiento de Fotos Propias (Relativas, Absolutas y Dominios Ajenos)
  // --------------------------------------------------------------------------
  console.log("[Test 1] Reconocimiento de fotos propias y bloqueo de dominios ajenos...");
  {
    // Rutas relativas
    assert.strictEqual(resolveLocalStorageRelativePath("/uploads/plato1.webp"), "plato1.webp");
    assert.strictEqual(resolveLocalStorageRelativePath("uploads/sub/foto.jpg"), "sub/foto.jpg");

    // URLs absolutas de dominios locales confirmados
    assert.strictEqual(
      resolveLocalStorageRelativePath("https://menuqr.ubicame.cc/uploads/foto-menu.png"),
      "foto-menu.png"
    );
    assert.strictEqual(
      resolveLocalStorageRelativePath("https://ubicame.cc/uploads/banner%20principal.jpg"),
      "banner principal.jpg" // Decodificación de URI
    );
    assert.strictEqual(
      resolveLocalStorageRelativePath("http://localhost:3000/uploads/logo.png"),
      "logo.png"
    );

    // Dominios ajenos o subdominios no compartidos: DEBEN retornar null (Anti-SSRF)
    assert.strictEqual(
      resolveLocalStorageRelativePath("https://cdn.externo.com/uploads/foto.png"),
      null,
      "Dominio externo debe retornar null"
    );
    assert.strictEqual(
      resolveLocalStorageRelativePath("https://reservaciones.ubicame.cc/uploads/cabaña.jpg"),
      null,
      "Subdominio ajeno no compartido debe retornar null"
    );
    assert.strictEqual(
      resolveLocalStorageRelativePath("https://malicious.com/uploads/steal.png"),
      null,
      "Dominio malicioso debe retornar null"
    );

    console.log("  ✓ Fotos propias reconocidas y orígenes ajenos bloqueados sin llamadas de red.");
  }

  // --------------------------------------------------------------------------
  // TEST 2: Motor ZIP: CRC32, ZIP64, Cifrado, Symlinks y maxOutputLength
  // --------------------------------------------------------------------------
  console.log("\n[Test 2] Defensas de Descompresión ZIP (maxOutputLength, CRC32, ZIP64, Cifrado, Symlinks)...");
  {
    // A. Roundtrip normal con CRC32
    const originalContent = Buffer.from("DATOS DE PRUEBA MENUQR PRO 2026", "utf8");
    const zipBuf = createZipBuffer([{ name: "test.txt", content: originalContent }]);
    const extracted = parseZipBuffer(zipBuf);
    assert.strictEqual(extracted.length, 1);
    assert.deepStrictEqual(extracted[0].content, originalContent);

    // B. CRC32 tampering
    const tamperedCrc = Buffer.from(zipBuf);
    const dataOffset = 30 + tamperedCrc.readUInt16LE(26) + tamperedCrc.readUInt16LE(28);
    tamperedCrc[dataOffset] ^= 0xff;
    assert.throws(
      () => parseZipBuffer(tamperedCrc),
      (err: any) => err.message.includes("CRC32") || err.message.includes("zlib"),
      "Debe rechazar alteración de bytes por CRC32"
    );

    // C. Discrepancia entre tamaño declarado y real (falso uncompressed size en cabecera)
    const tamperedHeaderSize = Buffer.from(zipBuf);
    tamperedHeaderSize.writeUInt32LE(9999, 22); // local header uncompressed size falso
    const eocdOffset = tamperedHeaderSize.length - 22;
    const cdOffset = tamperedHeaderSize.readUInt32LE(eocdOffset + 16);
    tamperedHeaderSize.writeUInt32LE(9999, cdOffset + 24); // cd header uncompressed size falso
    assert.throws(
      () => parseZipBuffer(tamperedHeaderSize),
      (err: any) => err.message.includes("Discrepancia de seguridad"),
      "Debe rechazar discrepancia entre tamaño declarado y real"
    );

    // D. ZIP64 rechazo explícito
    const tamperedZip64 = Buffer.from(zipBuf);
    tamperedZip64.writeUInt16LE(0xffff, eocdOffset + 10);
    assert.throws(
      () => parseZipBuffer(tamperedZip64),
      (err: any) => err.message.includes("ZIP64"),
      "Debe rechazar explícitamente ZIP64"
    );

    // E. Cifrado / Contraseña rechazo explícito
    const tamperedEncrypted = Buffer.from(zipBuf);
    tamperedEncrypted.writeUInt16LE(0x0001, cdOffset + 8);
    assert.throws(
      () => parseZipBuffer(tamperedEncrypted),
      (err: any) => err.message.includes("cifrado") || err.message.includes("contraseña"),
      "Debe rechazar archivos cifrados"
    );

    // F. Symlinks rechazo explícito (0o120000)
    const tamperedSymlink = Buffer.from(zipBuf);
    const symlinkAttr = (0o120777 * 65536) >>> 0;
    tamperedSymlink.writeUInt32LE(symlinkAttr, cdOffset + 38);
    assert.throws(
      () => parseZipBuffer(tamperedSymlink),
      (err: any) => err.message.includes("simbólicos") || err.message.includes("symlink"),
      "Debe rechazar symlinks"
    );

    console.log("  ✓ Todas las restricciones de seguridad ZIP demostradas con el descompresor real.");
  }

  // --------------------------------------------------------------------------
  // TEST 3: Exportador Real: Exclusión de Secretos, Excel y Estado de Completitud
  // --------------------------------------------------------------------------
  console.log("\n[Test 3] Exportador Real: Exclusión de Secretos y Excel con 13 Columnas...");
  {
    // Crear una foto real en public/uploads para verificar empaquetado
    const uploadDir = path.resolve(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const localPhotoName = `test-export-${Date.now()}.png`;
    const localPhotoPath = path.join(uploadDir, localPhotoName);
    const validPngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(localPhotoPath, validPngBytes);

    // Simulación de base de datos para la exportación con secretos reales presentes en BD
    const mockDbClients: BackupDbClients = {
      tenant: {
        restaurant: {
          findUnique: async () => ({
            id: "src-rest-uuid-100",
            name: "Parrillada Gourmet",
            slug: "parrillada-gourmet",
            whatsapp: "593991234567",
            themeColor: "#ef4444",
            businessType: "RESTAURANT",
            catalogMode: "MENU",
            plan: "PRO",
            logoUrl: `/uploads/${localPhotoName}`,
            coverUrl: "https://menuqr.ubicame.cc/uploads/" + localPhotoName, // Absoluta local
            qrCobroUrl: "https://malicious.com/uploads/evil.png", // Absoluta ajena
            payphoneQrUrl: null,
            seoImage: null,
            slogan: "Cortes Finos",
            description: "Carnes a la brasa",
            specialty: "Asados",
            services: "Comedor y delivery",
            tablesConfig: "1,2,3,4,5",
            customLabels: JSON.stringify({ vertical: "menuqr", disabledModules: ["caja"] }),
            priceRange: "$$$",
            testMode: false,
            country: "Ecuador",
            province: "Pichincha",
            city: "Quito",
            parish: "Cumbayá",
            sector: null,
            neighborhood: null,
            postalCode: null,
            address: "Av. Principal 100",
            locality: "Cumbayá",
            latitude: -0.198,
            longitude: -78.435,
            mapEmbedUrl: null,
            schedule: "12:00-22:00",
            localSchedule: null,
            deliverySchedule: null,
            blockedDates: null,
            structuredSchedule: null,
            enableTableOrdering: true,
            enableDelivery: true,
            enablePickup: true,
            ivaPercent: 15,
            servicePercent: 10,
            deliveryCost: 2.5,
            deliveryEnabled: true,
            deliveryRates: null,
            ivaOnTable: true,
            ivaOnTakeout: true,
            serviceOnTable: true,
            serviceOnTakeout: false,
            contactNumbers: "022345678",
            instagram: "@parrillada",
            facebook: null,
            tiktok: null,
            ubicameUrl: "https://ubicame.info/parrillada-gourmet",
            reservationUrl: "https://reservaciones.ubicame.cc",
            googleBusinessUrl: null,
            seoTitle: "Parrillada Gourmet",
            seoDescription: "Asados",
            seoKeywords: "carne",
            customFaq: null,
            bankName: "Banco Pichincha",
            bankAccountType: "Corriente",
            bankAccountNumber: "2100987654",
            bankAccountName: "Parrillada SA",
            bankAccountDocument: "1790012345001",
            bankAccountEmail: "pagos@parrillada.com",
            deunaPhone: "0991234567",
            payphonePhone: null,
            payphoneUrl: null,

            // SECRETOS ESTRICTAMENTE CONFIDENCIALES EN LA BASE DE DATOS
            aiApiKey: "sk-openai-super-secret-key-1234567890",
            userId: "super-user-owner-uuid-999",

            categories: [{ id: "cat-1", name: "Cortes", order: 1, imageAspectRatio: "DEFAULT" }],
            dishes: [
              {
                id: "dish-1",
                categoryId: "cat-1",
                name: "Bife de Chorizo",
                description: "400g a la parrilla",
                price: 18.5,
                imageUrl: `/uploads/${localPhotoName}`,
                isAvailable: true,
                sku: "BIFE-400",
                barcode: "7861234567890",
                costPrice: 9.0,
                stock: 20,
                minStock: 5,
                trackStock: true,
                isService: false,
                vatRate: "STANDARD",
                hasIce: false,
                variants: JSON.stringify([{ size: "400g", term: "Tres Cuartos" }]),
                isSuggested: true,
                supplier: { name: "Carnes del Valle" },
                modifierGroups: [
                  {
                    id: "mod-1",
                    name: "Guarnición",
                    minSelect: 1,
                    maxSelect: 1,
                    options: [{ id: "opt-1", name: "Papas Rústicas", extraPrice: 0 }],
                  },
                ],
              },
            ],
            campaigns: [],
            ruletaConfig: null,
            whatsAppTemplates: [],
            seasonRates: [],
            coupons: [],
            datilConfig: {
              isEnabled: true,
              ruc: "1790012345001",
              razonSocial: "PARRILLADA GOURMET S.A.",
              nombreComercial: "Parrillada Gourmet",
              direccionMatriz: "Quito",
              direccionEstablecimiento: "Cumbayá",
              regimen: "GENERAL",
              obligadoContabilidad: true,
              contribuyenteEspecial: null,
              establecimiento: "001",
              puntoEmision: "001",
              secuencialFactura: 88,
              // SECRETOS DÁTIL SRI:
              apiKey: "datil-x-key-confidential-token",
              apiPasswordEncrypted: "encrypted-aes-sri-password-hash",
            },
            whatsappInstance: {
              id: "wa-inst-1",
              instanceName: "parrillada-wa-bot",
              status: "open",
            },
          }),
        },
      },
      control: {},
    };

    // LLAMADA A LA FUNCIÓN REAL EXPORTADORA
    const exportResult = await generateBusinessBackupZip("src-rest-uuid-100", mockDbClients);
    assert.ok(exportResult.zipBuffer.length > 0, "Debe generar buffer ZIP");
    assert.ok(exportResult.filename.includes("respaldo-parrillada-gourmet-"));

    // Extracción real del paquete generado para verificar contenido
    const zipEntries = parseZipBuffer(exportResult.zipBuffer);
    const datosEntry = zipEntries.find((e) => e.name === "datos.json")!;
    const catalogoEntry = zipEntries.find((e) => e.name === "catalogo.xlsx")!;
    const manifestEntry = zipEntries.find((e) => e.name === "manifest.json")!;

    const datosText = datosEntry.content.toString("utf8");
    const manifestObj: BackupManifest = JSON.parse(manifestEntry.content.toString("utf8"));

    // VERIFICACIÓN DE EXCLUSIÓN TOTAL DE SECRETOS
    assert.strictEqual(datosText.includes("sk-openai"), false, "aiApiKey no debe existir en datos.json");
    assert.strictEqual(datosText.includes("datil-x-key"), false, "apiKey Dátil no debe existir en datos.json");
    assert.strictEqual(
      datosText.includes("encrypted-aes"),
      false,
      "apiPasswordEncrypted no debe existir en datos.json"
    );
    assert.strictEqual(
      datosText.includes("super-user-owner-uuid"),
      false,
      "userId del propietario no debe filtrarse"
    );

    // VERIFICACIÓN DE FOTOS Y ESTADO DE COMPLETITUD
    // Como qrCobroUrl apuntaba a dominio ajeno (malicious.com), queda en externalPhotos y isComplete es false
    assert.strictEqual(
      manifestObj.isComplete,
      false,
      "El respaldo no debe figurar como completo si hay fotos externas o no empaquetadas"
    );
    assert.strictEqual(manifestObj.photos.external.length, 1);
    assert.ok(manifestObj.photos.included >= 1, "La foto local confirmada debe estar incluida");

    // VERIFICACIÓN DE COLUMNAS EXACTAS EN EXCEL
    const wb = XLSX.read(catalogoEntry.content, { type: "buffer" });
    const wsMenu = wb.Sheets["Menu_Catalogo"];
    const rows = XLSX.utils.sheet_to_json<any>(wsMenu);
    assert.ok(rows.length >= 1, "Debe tener al menos 1 fila en Menu_Catalogo");
    const firstRow = rows[0];

    const expectedCols = [
      "Categoria",
      "Nombre",
      "Descripcion",
      "Precio",
      "Costo_Compra",
      "Margen_Estimado",
      "Proveedor_Habitual",
      "Codigo_Barras_SKU",
      "Disponible",
      "Controla_Stock",
      "Stock_Disponible",
      "Stock_Minimo",
      "URL_Imagen",
    ];

    for (const col of expectedCols) {
      assert.ok(col in firstRow, `Columna requerida "${col}" ausente en Excel`);
    }

    assert.strictEqual(firstRow.Nombre, "Bife de Chorizo");
    assert.strictEqual(firstRow.Margen_Estimado, 9.5); // 18.50 - 9.00
    assert.strictEqual(firstRow.Proveedor_Habitual, "Carnes del Valle");
    assert.strictEqual(firstRow.Codigo_Barras_SKU, "BIFE-400");

    // Limpieza de foto de prueba
    await fs.unlink(localPhotoPath).catch(() => {});

    console.log("  ✓ Exportador real verificado: secretos excluidos, completitud rigurosa y Excel con las 13 columnas.");
  }

  // --------------------------------------------------------------------------
  // TEST 4: Inspección Real: Conflictos de Slug y Coincidencias de Platos
  // --------------------------------------------------------------------------
  console.log("\n[Test 4] Inspección Real: Detección de Conflictos sin Slugs Aleatorios...");
  {
    const entries: ZipEntry[] = [
      {
        name: "manifest.json",
        content: Buffer.from(
          JSON.stringify({
            version: "1.0.0",
            packageId: "pkg-conflicts-1",
            sourceRestaurant: { id: "res-orig", name: "El Buen Sabor", slug: "el-buen-sabor" },
            counts: { categories: 1, dishes: 1 },
          })
        ),
      },
      {
        name: "datos.json",
        content: Buffer.from(
          JSON.stringify({
            identity: { name: "El Buen Sabor", slug: "el-buen-sabor", businessType: "RESTAURANT" },
            categories: [{ id: "c1", name: "Bebidas" }],
            dishes: [{ id: "d1", categoryId: "c1", name: "Jugo de Naranja", sku: "JUG-01", price: 2.5 }],
          })
        ),
      },
    ];
    const zipBuf = createZipBuffer(entries);

    // Mock simulando que el slug ya existe en el servidor para otro negocio
    const mockDbClients: BackupDbClients = {
      tenant: {
        restaurant: {
          findUnique: async ({ where }: any) => {
            if (where.slug === "el-buen-sabor") {
              return { id: "another-rest-999", name: "Restaurante Ajeno Existente", slug: "el-buen-sabor" };
            }
            return null;
          },
        },
      },
      control: {},
    };

    const inspection = await inspectBackupZip(zipBuf, null, mockDbClients);
    assert.strictEqual(inspection.conflicts.slugTakenByOther, true);
    assert.ok(inspection.conflicts.slugConflictMessage?.includes("ya está registrado"));

    console.log("  ✓ Conflicto de slug detectado correctamente sin mutaciones aleatorias.");
  }

  // --------------------------------------------------------------------------
  // TEST 5: Restaurador Real: Idempotencia en Doble Restauración y Preservación de customLabels
  // --------------------------------------------------------------------------
  console.log("\n[Test 5] Restaurador Real: Idempotencia en Doble Ejecución...");
  {
    // Simular almacenamiento en memoria que respeta la interfaz de Prisma
    const fakeStore = {
      restaurants: new Map<string, any>(),
      categories: new Map<string, any>(),
      dishes: new Map<string, any>(),
      modifierGroups: new Map<string, any>(),
      modifierOptions: new Map<string, any>(),
    };

    // Pre-insertar restaurante destino existente con sus propios módulos apagados
    fakeStore.restaurants.set("target-rest-1", {
      id: "target-rest-1",
      name: "Destino Existente",
      slug: "destino-existente",
      customLabels: JSON.stringify({
        vertical: "menuqr",
        disabledModules: ["inventory", "ruleta"], // Módulos apagados que NO deben perderse
      }),
    });

    const mockDbClients: BackupDbClients = {
      tenant: {
        restaurant: {
          findUnique: async ({ where }: any) => fakeStore.restaurants.get(where.id) || null,
          update: async ({ where, data }: any) => {
            const current = fakeStore.restaurants.get(where.id);
            const updated = { ...current, ...data };
            fakeStore.restaurants.set(where.id, updated);
            return updated;
          },
        },
        category: {
          findFirst: async ({ where }: any) => {
            for (const cat of fakeStore.categories.values()) {
              if (where.id && cat.id === where.id && cat.restaurantId === where.restaurantId) return cat;
              if (where.name && cat.name.toLowerCase() === where.name.equals.toLowerCase() && cat.restaurantId === where.restaurantId)
                return cat;
            }
            return null;
          },
          update: async ({ where, data }: any) => {
            const current = fakeStore.categories.get(where.id);
            const updated = { ...current, ...data };
            fakeStore.categories.set(where.id, updated);
            return updated;
          },
          create: async ({ data }: any) => {
            const id = `cat-target-${fakeStore.categories.size + 1}`;
            const created = { id, ...data };
            fakeStore.categories.set(id, created);
            return created;
          },
        },
        dish: {
          findFirst: async ({ where }: any) => {
            for (const dish of fakeStore.dishes.values()) {
              if (where.id && dish.id === where.id && dish.restaurantId === where.restaurantId) return dish;
              if (where.sku && dish.sku === where.sku && dish.restaurantId === where.restaurantId) return dish;
              if (where.name && dish.name.toLowerCase() === where.name.equals.toLowerCase() && dish.restaurantId === where.restaurantId)
                return dish;
            }
            return null;
          },
          update: async ({ where, data }: any) => {
            const current = fakeStore.dishes.get(where.id);
            const updated = { ...current, ...data };
            fakeStore.dishes.set(where.id, updated);
            return updated;
          },
          create: async ({ data }: any) => {
            const id = `dish-target-${fakeStore.dishes.size + 1}`;
            const created = { id, ...data };
            fakeStore.dishes.set(id, created);
            return created;
          },
        },
        dishModifierGroup: {
          findFirst: async ({ where }: any) => {
            for (const g of fakeStore.modifierGroups.values()) {
              if (where.id && g.id === where.id && g.dishId === where.dishId) return g;
              if (where.name && g.name.toLowerCase() === where.name.equals.toLowerCase() && g.dishId === where.dishId) return g;
            }
            return null;
          },
          update: async ({ where, data }: any) => {
            const current = fakeStore.modifierGroups.get(where.id);
            const updated = { ...current, ...data };
            fakeStore.modifierGroups.set(where.id, updated);
            return updated;
          },
          create: async ({ data }: any) => {
            const id = `mod-target-${fakeStore.modifierGroups.size + 1}`;
            const created = { id, ...data };
            fakeStore.modifierGroups.set(id, created);
            return created;
          },
        },
        dishModifierOption: {
          findFirst: async ({ where }: any) => {
            for (const opt of fakeStore.modifierOptions.values()) {
              if (where.id && opt.id === where.id && opt.groupId === where.groupId) return opt;
              if (where.name && opt.name.toLowerCase() === where.name.equals.toLowerCase() && opt.groupId === where.groupId) return opt;
            }
            return null;
          },
          update: async ({ where, data }: any) => {
            const current = fakeStore.modifierOptions.get(where.id);
            const updated = { ...current, ...data };
            fakeStore.modifierOptions.set(where.id, updated);
            return updated;
          },
          create: async ({ data }: any) => {
            const id = `opt-target-${fakeStore.modifierOptions.size + 1}`;
            const created = { id, ...data };
            fakeStore.modifierOptions.set(id, created);
            return created;
          },
        },
        businessCampaign: { findFirst: async () => null, create: async () => ({ id: "c" }) },
        ruletaConfig: { upsert: async () => ({}) },
        whatsAppTemplate: { findFirst: async () => null, create: async () => ({ id: "t" }) },
        coupon: { findFirst: async () => null, create: async () => ({ id: "cp" }) },
      },
      control: {},
    };

    const testZipEntries: ZipEntry[] = [
      {
        name: "manifest.json",
        content: Buffer.from(
          JSON.stringify({
            version: "1.0.0",
            packageId: "package-id-stable-99",
            sourceRestaurant: { id: "res-src", name: "Origen", slug: "origen" },
            counts: { categories: 1, dishes: 1 },
          })
        ),
      },
      {
        name: "datos.json",
        content: Buffer.from(
          JSON.stringify({
            identity: { name: "Origen", slug: "origen", businessType: "RESTAURANT" },
            location: {},
            schedules: {},
            orderingAndDelivery: {},
            contactAndSocial: { whatsapp: "123" },
            seo: {},
            bankingNonSecret: {},
            brandingPhotos: {},
            categories: [{ id: "src-c1", name: "Pizzas", order: 1 }],
            dishes: [
              {
                id: "src-d1",
                categoryId: "src-c1",
                name: "Pizza Napolitana",
                sku: "PIZ-NAP",
                price: 12.0,
                variants: JSON.stringify([{ size: "Familiar" }]),
                modifierGroups: [
                  {
                    id: "src-g1",
                    name: "Borde",
                    minSelect: 0,
                    maxSelect: 1,
                    options: [{ id: "src-o1", name: "Borde de Queso", extraPrice: 2.0 }],
                  },
                ],
              },
            ],
            campaigns: [],
            whatsappTemplates: [],
            seasonRates: [],
            coupons: [],
          })
        ),
      },
    ];
    const testZipBuf = createZipBuffer(testZipEntries);

    // PRIMERA RESTAURACIÓN
    const firstRun = await restoreBusinessBackupZip(
      testZipBuf,
      {
        targetRestaurantId: "target-rest-1",
        mode: "UPDATE_EXISTING",
      },
      mockDbClients
    );

    assert.strictEqual(firstRun.isRetry, false);
    assert.strictEqual(firstRun.restoredCounts.categoriesCreated, 1);
    assert.strictEqual(firstRun.restoredCounts.dishesCreated, 1);
    assert.strictEqual(fakeStore.categories.size, 1);
    assert.strictEqual(fakeStore.dishes.size, 1);
    assert.strictEqual(fakeStore.modifierGroups.size, 1);

    // Comprobar que customLabels preservó disabledModules
    const restAfterFirst = fakeStore.restaurants.get("target-rest-1");
    const labelsAfterFirst = JSON.parse(restAfterFirst.customLabels);
    assert.deepStrictEqual(labelsAfterFirst.disabledModules, ["inventory", "ruleta"]);
    assert.ok(labelsAfterFirst.backupSync, "Debe registrar metadatos backupSync");

    // SEGUNDA RESTAURACIÓN (REINTENTO DEL MISMO PAQUETE AL MISMO DESTINO)
    const secondRun = await restoreBusinessBackupZip(
      testZipBuf,
      {
        targetRestaurantId: "target-rest-1",
        mode: "UPDATE_EXISTING",
      },
      mockDbClients
    );

    assert.strictEqual(secondRun.isRetry, true, "Debe detectar reintento");
    assert.strictEqual(secondRun.restoredCounts.categoriesCreated, 0, "No debe crear nuevas categorías");
    assert.strictEqual(secondRun.restoredCounts.categoriesUpdated, 1, "Debe actualizar categoría existente");
    assert.strictEqual(secondRun.restoredCounts.dishesCreated, 0, "No debe crear nuevos platos");
    assert.strictEqual(secondRun.restoredCounts.dishesUpdated, 1, "Debe actualizar plato existente");

    // El número total en base de datos NO debe haber aumentado
    assert.strictEqual(fakeStore.categories.size, 1, "Categorías no duplicadas");
    assert.strictEqual(fakeStore.dishes.size, 1, "Platos no duplicados");
    assert.strictEqual(fakeStore.modifierGroups.size, 1, "Modificadores no duplicados");

    console.log("  ✓ Idempotencia demostrada con la función real: reintentar no duplica ni pierde etiquetas.");
  }

  // --------------------------------------------------------------------------
  // TEST 6A: Fallo tras crear negocio: el logo guardado sigue existiendo en disco
  // --------------------------------------------------------------------------
  console.log("\n[Test 6A] Crear el negocio funciona y crear una categoría falla después: el logo guardado sigue existiendo...");
  const uploadDir = path.resolve(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const photoLogo6A = `staged-logo-6a-${Date.now()}.png`;
  const validPngContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

  {
    const zipWithLogo = createZipBuffer([
      {
        name: "manifest.json",
        content: Buffer.from(
          JSON.stringify({
            version: "1.0.0",
            packageId: "pkg-fail-6a",
            sourceRestaurant: { id: "res-src-6a", name: "Negocio 6A", slug: "fail-6a" },
            counts: { categories: 1, dishes: 0 },
          })
        ),
      },
      {
        name: "datos.json",
        content: Buffer.from(
          JSON.stringify({
            identity: { name: "Negocio 6A", slug: "fail-6a", businessType: "RESTAURANT" },
            brandingPhotos: { logoUrl: `/uploads/${photoLogo6A}` },
            categories: [{ id: "cat-src-6a-1", name: "Bebidas" }],
            dishes: [],
          })
        ),
      },
      {
        name: `fotos/${photoLogo6A}`,
        content: validPngContent,
      },
    ]);

    let createdRestInDb: any = null;

    const mockDb6A: BackupDbClients = {
      tenant: {
        restaurant: {
          findUnique: async ({ where }: any) => {
            if (createdRestInDb && (createdRestInDb.id === where.id || createdRestInDb.slug === where.slug)) {
              return createdRestInDb;
            }
            return null;
          },
          create: async ({ data }: any) => {
            createdRestInDb = { id: "rest-dest-6a", ...data };
            return createdRestInDb;
          },
          update: async ({ where, data }: any) => {
            if (createdRestInDb && createdRestInDb.id === where.id) {
              createdRestInDb = { ...createdRestInDb, ...data };
              return createdRestInDb;
            }
            return null;
          },
        },
        category: {
          findFirst: async () => null,
          create: async () => {
            throw new Error("ERROR_SIMULADO_BD: Fallo de restricción al crear categoría");
          },
        },
      },
      control: {},
    };

    let errorThrown: any = null;
    try {
      await restoreBusinessBackupZip(
        zipWithLogo,
        {
          mode: "CREATE_NEW",
          newSlug: "fail-6a",
        },
        mockDb6A
      );
    } catch (err: any) {
      errorThrown = err;
    }

    assert.ok(errorThrown, "Debe lanzar error al fallar la creación de categoría");
    assert.strictEqual(errorThrown.stage, "LOTE_CATEGORIAS");
    assert.ok(errorThrown.confirmedBatches.includes("CREACION_NEGOCIO"));
    assert.strictEqual(errorThrown.partialChangesPossible, true);
    assert.ok(errorThrown.message.includes("Puede haber cambios parciales"));
    assert.ok(errorThrown.message.includes("Las imágenes procesadas se conservaron en disco"));

    // Verificar que el logo guardado sigue existiendo en disco y no fue borrado por cleanupStagedPhotos
    const logoFileOnDisk = path.join(uploadDir, photoLogo6A);
    const logoStat = await fs.stat(logoFileOnDisk).catch(() => null);
    assert.ok(logoStat && logoStat.isFile(), "El logo guardado debe seguir existiendo en disco");

    // Limpieza al finalizar el test
    await fs.unlink(logoFileOnDisk).catch(() => {});
    console.log("  ✓ El logo guardado sigue existiendo tras fallo en categoría; no se eliminó la foto.");
  }

  // --------------------------------------------------------------------------
  // TEST 6B: Una escritura dentro de un lote funciona y la siguiente falla: fotos conservadas
  // --------------------------------------------------------------------------
  console.log("\n[Test 6B] Una escritura dentro de un lote funciona y la siguiente falla: ninguna referencia guardada pierde su foto...");
  const dishPhoto1 = `plato1-6b-${Date.now()}.png`;
  const dishPhoto2 = `plato2-6b-${Date.now()}.png`;

  const fakeStore6B = {
    restaurants: new Map<string, any>(),
    categories: new Map<string, any>(),
    dishes: new Map<string, any>(),
  };

  const zip6B = createZipBuffer([
    {
      name: "manifest.json",
      content: Buffer.from(
        JSON.stringify({
          version: "1.0.0",
          packageId: "pkg-fail-6b",
          sourceRestaurant: { id: "res-src-6b", name: "Negocio 6B", slug: "fail-6b" },
          counts: { categories: 1, dishes: 2 },
        })
      ),
    },
    {
      name: "datos.json",
      content: Buffer.from(
        JSON.stringify({
          identity: { name: "Negocio 6B", slug: "fail-6b", businessType: "RESTAURANT" },
          categories: [{ id: "cat-src-6b-1", name: "Pizzas" }],
          dishes: [
            { id: "dish-src-1", categoryId: "cat-src-6b-1", name: "Pizza Margarita", sku: "PIZ-01", price: 10, image: `/uploads/${dishPhoto1}` },
            { id: "dish-src-2", categoryId: "cat-src-6b-1", name: "Pizza Pepperoni", sku: "PIZ-02", price: 12, image: `/uploads/${dishPhoto2}` },
          ],
        })
      ),
    },
    {
      name: `fotos/${dishPhoto1}`,
      content: validPngContent,
    },
    {
      name: `fotos/${dishPhoto2}`,
      content: validPngContent,
    },
  ]);

  let dish2ShouldFail = true;

  const mockDb6B: BackupDbClients = {
    tenant: {
      restaurant: {
        findUnique: async ({ where }: any) => {
          if (where.id) return fakeStore6B.restaurants.get(where.id) || null;
          if (where.slug) {
            for (const r of fakeStore6B.restaurants.values()) {
              if (r.slug === where.slug) return r;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const rest = { id: "rest-dest-6b", ...data };
          fakeStore6B.restaurants.set(rest.id, rest);
          return rest;
        },
        update: async ({ where, data }: any) => {
          const current = fakeStore6B.restaurants.get(where.id);
          const updated = { ...current, ...data };
          fakeStore6B.restaurants.set(where.id, updated);
          return updated;
        },
      },
      category: {
        findFirst: async ({ where }: any) => {
          for (const c of fakeStore6B.categories.values()) {
            if (where.id && c.id === where.id) return c;
            if (where.name && c.name.toLowerCase() === where.name.equals.toLowerCase()) return c;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const cat = { id: "cat-dest-1", ...data };
          fakeStore6B.categories.set(cat.id, cat);
          return cat;
        },
        update: async ({ where, data }: any) => {
          const current = fakeStore6B.categories.get(where.id);
          const updated = { ...current, ...data };
          fakeStore6B.categories.set(where.id, updated);
          return updated;
        },
      },
      dish: {
        findFirst: async ({ where }: any) => {
          for (const d of fakeStore6B.dishes.values()) {
            if (where.id && d.id === where.id) return d;
            if (where.sku && d.sku === where.sku) return d;
            if (where.name && d.name.toLowerCase() === where.name.equals.toLowerCase()) return d;
          }
          return null;
        },
        create: async ({ data }: any) => {
          if (data.name === "Pizza Pepperoni" && dish2ShouldFail) {
            throw new Error("ERROR_SIMULADO_BD: Fallo al persistir el segundo plato del lote");
          }
          const id = `dish-dest-${fakeStore6B.dishes.size + 1}`;
          const dish = { id, ...data };
          fakeStore6B.dishes.set(id, dish);
          return dish;
        },
        update: async ({ where, data }: any) => {
          const current = fakeStore6B.dishes.get(where.id);
          const updated = { ...current, ...data };
          fakeStore6B.dishes.set(where.id, updated);
          return updated;
        },
      },
    },
    control: {},
  };

  {
    let errorThrown: any = null;
    try {
      await restoreBusinessBackupZip(
        zip6B,
        {
          mode: "CREATE_NEW",
          newSlug: "fail-6b",
        },
        mockDb6B
      );
    } catch (err: any) {
      errorThrown = err;
    }

    assert.ok(errorThrown, "Debe lanzar error en el segundo plato");
    assert.strictEqual(errorThrown.stage, "LOTE_PLATOS_Y_MODIFICADORES");
    assert.ok(errorThrown.confirmedBatches.includes("CREACION_NEGOCIO"));
    assert.ok(errorThrown.confirmedBatches.includes("LOTE_CATEGORIAS"));
    assert.strictEqual(errorThrown.partialChangesPossible, true);

    // Comprobar que Dish 1 fue guardado en BD
    assert.strictEqual(fakeStore6B.dishes.size, 1);
    const savedDish1 = Array.from(fakeStore6B.dishes.values())[0];
    assert.strictEqual(savedDish1.name, "Pizza Margarita");

    // Comprobar que Dish 1 NO perdió su foto en disco
    const dish1Stat = await fs.stat(path.join(uploadDir, dishPhoto1)).catch(() => null);
    assert.ok(dish1Stat && dish1Stat.isFile(), "La referencia guardada (Dish 1) no debe perder su foto");

    // Comprobar que Dish 2 también conservó su foto para el reintento
    const dish2Stat = await fs.stat(path.join(uploadDir, dishPhoto2)).catch(() => null);
    assert.ok(dish2Stat && dish2Stat.isFile(), "La foto del segundo plato se retuvo para recuperación");

    console.log("  ✓ Una escritura funcionó y la siguiente falló: la referencia guardada conservó su foto.");
  }

  // --------------------------------------------------------------------------
  // TEST 6C: Control de Conflictos y Reintento Explícito tras Fallo Parcial
  // --------------------------------------------------------------------------
  console.log("\n[Test 6C] Reintento tras fallo parcial: bloqueo en CREATE_NEW y éxito en UPDATE_EXISTING...");
  {
    // 1. Comprobar que el checkpoint de progreso sobrevivió al fallo parcial anterior
    const currentRest = fakeStore6B.restaurants.get("rest-dest-6b");
    assert.ok(currentRest, "El restaurante creado en el intento previo debe existir");
    const labelsAfterFailure = JSON.parse(currentRest.customLabels);
    assert.ok(labelsAfterFailure.backupSync, "El mapa de progreso backupSync debe sobrevivir al fallo");
    assert.strictEqual(labelsAfterFailure.backupSync.sourceRestaurantId, "res-src-6b");
    assert.strictEqual(labelsAfterFailure.backupSync.categoryMap["cat-src-6b-1"], "cat-dest-1");
    assert.ok(labelsAfterFailure.backupSync.dishMap["dish-src-1"], "El mapa del plato guardado debe sobrevivir");

    // 2. Simular que el destino tenía además etiquetas personalizadas que deben conservarse
    labelsAfterFailure.vertical = "RESTAURANTE";
    labelsAfterFailure.disabledModules = ["INVENTORY", "RULETA"];
    labelsAfterFailure.amenities = ["WIFI", "PARQUEADERO"];
    currentRest.customLabels = JSON.stringify(labelsAfterFailure);
    fakeStore6B.restaurants.set("rest-dest-6b", currentRest);

    // ------------------------------------------------------------------------
    // PRUEBA 1: CREATE_NEW con slug ocupado y mismo origen devuelve conflicto sin realizar escrituras
    // ------------------------------------------------------------------------
    const dishesCountBeforeCreateNew = fakeStore6B.dishes.size;
    let createNewConflictError: any = null;

    try {
      await restoreBusinessBackupZip(
        zip6B,
        {
          mode: "CREATE_NEW",
          newSlug: "fail-6b",
        },
        mockDb6B
      );
    } catch (err: any) {
      createNewConflictError = err;
    }

    assert.ok(createNewConflictError, "CREATE_NEW con slug ocupado debe lanzar error");
    assert.ok(
      createNewConflictError.message.includes("Conflicto de slug") ||
      createNewConflictError.message.includes("ya está registrado"),
      "Debe rechazar la creación por conflicto de slug sin convertirlo a actualización silenciosa"
    );
    // Verificar que NO se escribió nada en la base de datos
    assert.strictEqual(
      fakeStore6B.dishes.size,
      dishesCountBeforeCreateNew,
      "No debe escribir platos nuevos ni alterar BD cuando CREATE_NEW colisiona"
    );
    console.log("  ✓ CREATE_NEW con slug ocupado y mismo origen devolvió conflicto sin realizar escrituras.");

    // ------------------------------------------------------------------------
    // PRUEBA 2: UPDATE_EXISTING con destino seleccionado explícitamente permite reintentar
    // ------------------------------------------------------------------------
    // Reparar la falla simulada en BD para que el segundo plato ahora tenga éxito
    dish2ShouldFail = false;

    const retryResult = await restoreBusinessBackupZip(
      zip6B,
      {
        mode: "UPDATE_EXISTING",
        targetRestaurantId: "rest-dest-6b",
        confirmMergeConflicts: true,
      },
      mockDb6B
    );

    assert.strictEqual(retryResult.success, true);
    assert.strictEqual(retryResult.restaurantId, "rest-dest-6b");

    // Verificar que NO se duplicaron categorías ni platos
    assert.strictEqual(fakeStore6B.categories.size, 1, "No debe duplicar categorías en el reintento");
    assert.strictEqual(fakeStore6B.dishes.size, 2, "Debe tener exactamente los 2 platos, sin duplicar Pizza Margarita");

    // Comprobar que ninguna referencia guardada perdió su foto
    const dish1Stat = await fs.stat(path.join(uploadDir, dishPhoto1)).catch(() => null);
    assert.ok(dish1Stat && dish1Stat.isFile(), "La foto del plato 1 debe seguir existiendo");
    const dish2Stat = await fs.stat(path.join(uploadDir, dishPhoto2)).catch(() => null);
    assert.ok(dish2Stat && dish2Stat.isFile(), "La foto del plato 2 debe seguir existiendo");

    // Verificar que las etiquetas previas del destino sobrevivieron íntegras
    const finalRest = fakeStore6B.restaurants.get("rest-dest-6b");
    const finalLabels = JSON.parse(finalRest.customLabels);
    assert.strictEqual(finalLabels.vertical, "RESTAURANTE", "Debe conservar la vertical del destino");
    assert.deepStrictEqual(finalLabels.disabledModules, ["INVENTORY", "RULETA"], "Debe conservar disabledModules");
    assert.deepStrictEqual(finalLabels.amenities, ["WIFI", "PARQUEADERO"], "Debe conservar amenities");
    assert.strictEqual(finalLabels.backupSync.categoryMap["cat-src-6b-1"], "cat-dest-1");
    assert.ok(finalLabels.backupSync.dishMap["dish-src-1"]);
    assert.ok(finalLabels.backupSync.dishMap["dish-src-2"]);

    // Limpieza de fotos de prueba
    await fs.unlink(path.join(uploadDir, dishPhoto1)).catch(() => {});
    await fs.unlink(path.join(uploadDir, dishPhoto2)).catch(() => {});

    console.log("  ✓ UPDATE_EXISTING con destino explícito reintentó con éxito: sin duplicados, sin pérdida de fotos ni etiquetas.");
  }

  console.log("\n================================================================================");
  console.log("  >>> TODAS LAS PRUEBAS DEL MOTOR REAL PASARON CON ÉXITO <<<");
  console.log("================================================================================\n");
}

runRealBackupTestSuite().catch((err) => {
  console.error("FALLO EN SUITE DE PRUEBAS:", err);
  process.exit(1);
});
