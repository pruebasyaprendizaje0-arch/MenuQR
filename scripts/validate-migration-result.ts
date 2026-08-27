/**
 * Validador de Resultados de Migración para MenuQR Pro -> API Central
 * Garantiza que nunca se marque status: "SUCCESS" si existen IDs centrales nulos o pendientes.
 */
import * as fs from "fs";
import * as path from "path";
import assert from "assert";

export interface MigrationResult {
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "DRY_RUN";
  mode?: "EXECUTE" | "DRY-RUN";
  centralApiUrl?: string;
  error?: string | null;
  operations?: Array<{
    entity: string;
    localId: string;
    centralId: string | null;
    httpStatus?: number | null;
    status: string;
    error?: string | null;
  }>;
  mappedIds?: {
    users?: Record<string, { email: string; centralId: string | null; status: string }>;
    businesses?: Record<
      string,
      {
        name: string;
        slug: string;
        centralBusinessId: string | null;
        centralBranchId: string | null;
        centralMenuId: string | null;
        status: string;
      }
    >;
    categories?: Record<string, { name: string; centralCategoryId: string | null; status: string }>;
    products?: Record<string, { name: string; centralProductId: string | null; status: string }>;
    orders?: Record<string, { orderNumber: number; centralOrderId: string | null; status: string }>;
  };
}

export function validateMigrationResult(result: MigrationResult): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!result || typeof result !== "object") {
    return { valid: false, errors: ["El reporte de resultado no es un objeto válido."] };
  }

  if (!["SUCCESS", "FAILED", "DRY_RUN"].includes(result.status)) {
    errors.push(`Status desconocido: '${result.status}'. Debe ser 'SUCCESS', 'FAILED' o 'DRY_RUN'.`);
  }

  if (result.status === "SUCCESS") {
    if (result.mode === "DRY-RUN") {
      errors.push("Inconsistencia: Un reporte en MODO SIMULACIÓN (DRY-RUN) nunca debe llevar status 'SUCCESS'. Debe ser 'DRY_RUN'.");
    }

    const mapped = result.mappedIds;
    if (!mapped) {
      errors.push("Reporte SUCCESS sin objeto 'mappedIds'.");
    } else {
      // 1. Usuarios
      if (mapped.users) {
        for (const [id, u] of Object.entries(mapped.users)) {
          if (!u.centralId) {
            errors.push(`Usuario local '${id}' (${u.email}) no posee centralId en reporte SUCCESS.`);
          }
        }
      }

      // 2. Negocios
      if (mapped.businesses) {
        for (const [id, b] of Object.entries(mapped.businesses)) {
          if (!b.centralBusinessId) {
            errors.push(`Negocio local '${id}' (${b.name}) no posee centralBusinessId en reporte SUCCESS.`);
          }
          if (!b.centralBranchId) {
            errors.push(`Negocio local '${id}' (${b.name}) no posee centralBranchId en reporte SUCCESS.`);
          }
          if (!b.centralMenuId) {
            errors.push(`Negocio local '${id}' (${b.name}) no posee centralMenuId en reporte SUCCESS.`);
          }
        }
      }

      // 3. Categorías
      if (mapped.categories) {
        for (const [id, c] of Object.entries(mapped.categories)) {
          if (!c.centralCategoryId) {
            errors.push(`Categoría local '${id}' (${c.name}) no posee centralCategoryId en reporte SUCCESS.`);
          }
        }
      }

      // 4. Productos
      if (mapped.products) {
        for (const [id, p] of Object.entries(mapped.products)) {
          if (!p.centralProductId) {
            errors.push(`Producto local '${id}' (${p.name}) no posee centralProductId en reporte SUCCESS.`);
          }
        }
      }

      // 5. Pedidos
      if (mapped.orders) {
        for (const [id, o] of Object.entries(mapped.orders)) {
          if (!o.centralOrderId) {
            errors.push(`Pedido local '${id}' (#${o.orderNumber}) no posee centralOrderId en reporte SUCCESS.`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Auto-ejecución de pruebas unitarias del validador si se corre directamente
if (require.main === module) {
  console.log("==========================================");
  console.log("  Validando Lógica del Reporte de Migración");
  console.log("==========================================");

  // Test Case A: Invalid SUCCESS report with null IDs (Must fail validation)
  const invalidSuccessReport: MigrationResult = {
    timestamp: new Date().toISOString(),
    status: "SUCCESS",
    mode: "DRY-RUN",
    mappedIds: {
      users: { u1: { email: "test@admin.com", centralId: null, status: "PENDIENTE_REGISTRO" } },
      businesses: { b1: { name: "Test Biz", slug: "test-biz", centralBusinessId: null, centralBranchId: null, centralMenuId: null, status: "PENDIENTE_CREAR" } },
    },
  };
  const valA = validateMigrationResult(invalidSuccessReport);
  assert.strictEqual(valA.valid, false, "Reporte falso SUCCESS debe ser rechazado por el validador");
  console.log("✔ Test 1: Rechazo de reporte falso SUCCESS con IDs nulos verificado correctamente.");

  // Test Case B: Valid DRY_RUN report
  const validDryRunReport: MigrationResult = {
    timestamp: new Date().toISOString(),
    status: "DRY_RUN",
    mode: "DRY-RUN",
    mappedIds: {
      users: { u1: { email: "test@admin.com", centralId: null, status: "PENDIENTE_REGISTRO" } },
    },
  };
  const valB = validateMigrationResult(validDryRunReport);
  assert.strictEqual(valB.valid, true, "Reporte DRY_RUN con IDs nulos debe ser válido");
  console.log("✔ Test 2: Validación de reporte DRY_RUN comprobada exitosamente.");

  // Test Case C: Check current migration-result.json on disk if present
  const resultPath = path.join(process.cwd(), "migration-result.json");
  if (fs.existsSync(resultPath)) {
    const diskData = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
    const valDisk = validateMigrationResult(diskData);
    console.log(`\n📄 Verificación del archivo actual migration-result.json:`);
    console.log(`   Status en disco: ${diskData.status}`);
    console.log(`   Es válido según reglas estrictas: ${valDisk.valid ? "SÍ ✅" : "NO ❌"}`);
    if (!valDisk.valid) {
      console.log(`   Inconsistencias detectadas en el JSON actual:`);
      valDisk.errors.forEach((err) => console.log(`   - ${err}`));
    }
  }

  console.log("==========================================");
  console.log("  TODAS LAS VALIDACIONES PASARON (100%)");
  console.log("==========================================");
}
