import assert from "node:assert";
import { hashPin, isHashedPin } from "./security-pins";

// Inyectar pool simulado ANTES de importar db-pool y staff-maintenance para no inicializar cliente pg real
interface RecordedQuery {
  sql: string;
  params: any[];
}

const recordedEnsureQueries: RecordedQuery[] = [];
(globalThis as any).pgPool = {
  query: async (sql: string, params: any[] = []) => {
    recordedEnsureQueries.push({ sql, params });
    return { rows: [] };
  },
};

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`));
}

async function main() {
  const { ensureDbTables } = await import("./db-pool");
  const {
    parseMaintenanceCliArgs,
    runStaffMaintenance,
  } = await import("./staff-maintenance");

  const BIZ_ID = "11111111-2222-4333-8444-555555555555";
  const EXISTING_HASH = hashPin("7391");

  console.log("=== PRUEBAS PURAS Y SIMULADAS: db-pool & staff-maintenance ===");

  // 1. ensureDbTables solo ejecuta DDL estructural (sin INSERT/UPDATE/DELETE ni init.sql)
  await runTest("1. ensureDbTables solo ejecuta DDL estructural sin INSERT/UPDATE/DELETE ni init.sql", async () => {
    recordedEnsureQueries.length = 0;
    await ensureDbTables();
    assert.strictEqual(recordedEnsureQueries.length, 2, "Debe ejecutar exactamente los 2 bloques DDL estructurales");
    for (const q of recordedEnsureQueries) {
      const upper = q.sql.toUpperCase();
      assert.strictEqual(/\bINSERT\s+INTO\b/.test(upper), false, "No debe contener INSERT INTO");
      assert.strictEqual(/\bUPDATE\s+\w+\s+SET\b/.test(upper), false, "No debe contener UPDATE ... SET");
      assert.strictEqual(/\bDELETE\s+FROM\b/.test(upper), false, "No debe contener DELETE FROM");
      assert.strictEqual(/TABLERESERVATION/i.test(q.sql), false, "No debe ejecutar init.sql (TableReservation)");
    }
  });

  // 2. Rechazo de falta de negocio, UUID inválido, falta de tarea y prohibición de --all
  await runTest("2. Rechaza falta de negocio/tarea, UUID inválido y opción --all", async () => {
    assert.throws(() => parseMaintenanceCliArgs(["--all", `--business-id=${BIZ_ID}`, "--task=migrate_pins"]), /--all/);
    assert.throws(() => parseMaintenanceCliArgs(["--task=migrate_pins"]), /UUID válido/);
    assert.throws(() => parseMaintenanceCliArgs(["--business-id=no-es-uuid", "--task=migrate_pins"]), /UUID válido/);
    assert.throws(() => parseMaintenanceCliArgs([`--business-id=${BIZ_ID}`]), /tarea válida/);
    assert.throws(() => parseMaintenanceCliArgs([`--business-id=${BIZ_ID}`, "--task=unknown"]), /tarea válida/);

    await assert.rejects(
      () => runStaffMaintenance({ businessId: "", task: "migrate_pins" }),
      /UUID válido/
    );
  });

  // 3. Dry-run por defecto: cero escrituras aunque haya PIN plano válido e inválido
  await runTest("3. Simulación (dry-run por defecto) ejecuta cero escrituras", async () => {
    const queries: RecordedQuery[] = [];
    const mockRunner = {
      query: async (sql: string, params: any[] = []) => {
        queries.push({ sql, params });
        if (sql.includes("FROM camareros")) {
          return {
            rows: [
              { id: "cam-hash", pin: EXISTING_HASH },
              { id: "cam-valid", pin: "8426" },
              { id: "cam-blacklisted", pin: "1234" },
              { id: "cam-short", pin: "99" },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const report = await runStaffMaintenance({
      businessId: BIZ_ID,
      task: "migrate_pins",
      queryRunner: mockRunner,
    });

    assert.strictEqual(report.mode, "dry-run");
    assert.strictEqual(report.writesExecuted, 0);
    assert.strictEqual(queries.length, 1, "Solo debe ejecutar el SELECT acotado al negocio");
    assert.ok(queries[0].sql.includes("WHERE negocio_id = $1::uuid AND pin IS NOT NULL"));
    assert.deepStrictEqual(queries[0].params, [BIZ_ID]);
    assert.deepStrictEqual(
      report.actions.map((a) => a.action),
      ["preserve_existing_hash", "hash_valid_plain_pin", "revoke_invalid_pin", "revoke_invalid_pin"]
    );
    // Verificar que ningún log/detalle expone PINs ni hashes
    const serialized = JSON.stringify(report);
    assert.strictEqual(serialized.includes("8426"), false);
    assert.strictEqual(serialized.includes("1234"), false);
    assert.strictEqual(serialized.includes(EXISTING_HASH), false);
  });

  // 4. Aplicación (apply: true) de migrate_pins: conserva hash existente sin UPDATE, hashea válido, revoca inválidos y SQL acotado al negocio
  await runTest("4. migrate_pins con apply=true conserva hash existente, hashea plano válido, revoca inválidos y deja NULL intacto", async () => {
    const queries: RecordedQuery[] = [];
    const mockRunner = {
      query: async (sql: string, params: any[] = []) => {
        queries.push({ sql, params });
        if (sql.includes("FROM camareros")) {
          // Simula que PostgreSQL filtró pin IS NOT NULL (cam-null nunca se toca)
          return {
            rows: [
              { id: "cam-hash", pin: EXISTING_HASH },
              { id: "cam-valid", pin: "9517" },
              { id: "cam-blacklist", pin: "0000" },
              { id: "cam-nondigit", pin: "12ab" },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const report = await runStaffMaintenance({
      businessId: BIZ_ID,
      task: "migrate_pins",
      apply: true,
      queryRunner: mockRunner,
    });

    assert.strictEqual(report.mode, "applied");
    assert.strictEqual(report.writesExecuted, 3, "Solo 3 UPDATE (cam-hash no debe recibir UPDATE)");
    const updates = queries.filter((q) => q.sql.trim().startsWith("UPDATE"));
    assert.strictEqual(updates.length, 3);

    // cam-valid -> hash bcrypt válido, acotado a negocio_id
    assert.ok(updates[0].sql.includes("WHERE id = $2 AND negocio_id = $3::uuid"));
    assert.ok(isHashedPin(updates[0].params[0]), "El PIN plano válido debe guardarse como hash bcrypt");
    assert.strictEqual(updates[0].params[1], "cam-valid");
    assert.strictEqual(updates[0].params[2], BIZ_ID);

    // cam-blacklist y cam-nondigit -> NULL, acotado a negocio_id
    assert.ok(updates[1].sql.includes("SET pin = NULL WHERE id = $1 AND negocio_id = $2::uuid"));
    assert.deepStrictEqual(updates[1].params, ["cam-blacklist", BIZ_ID]);
    assert.deepStrictEqual(updates[2].params, ["cam-nondigit", BIZ_ID]);
  });

  // 5. sync_negocio, seed_demo y ensure_waiters acotados estrictamente a businessId
  await runTest("5. sync_negocio, seed_demo y ensure_waiters acotan toda consulta y escritura al UUID del negocio", async () => {
    const syncQueries: RecordedQuery[] = [];
    const syncReport = await runStaffMaintenance({
      businessId: BIZ_ID,
      task: "sync_negocio",
      apply: true,
      queryRunner: {
        query: async (sql, params = []) => {
          syncQueries.push({ sql, params });
          if (sql.includes(`FROM "Restaurant"`)) return { rows: [{ id: BIZ_ID, name: "Rest Fixture", slug: "rest-fix" }] };
          if (sql.includes("FROM negocios")) return { rows: [] };
          return { rows: [] };
        },
      },
    });
    assert.strictEqual(syncReport.writesExecuted, 1);
    assert.strictEqual(syncQueries[2].params[0], BIZ_ID);

    const demoQueries: RecordedQuery[] = [];
    const demoReport = await runStaffMaintenance({
      businessId: BIZ_ID,
      task: "seed_demo",
      apply: true,
      queryRunner: {
        query: async (sql, params = []) => {
          demoQueries.push({ sql, params });
          if (sql.includes("FROM negocios")) return { rows: [] };
          if (sql.includes("COUNT(*)")) return { rows: [{ c: 0 }] };
          return { rows: [] };
        },
      },
    });
    assert.strictEqual(demoReport.writesExecuted, 2);
    assert.ok(demoQueries.every((q) => q.params.includes(BIZ_ID)));

    const waiterQueries: RecordedQuery[] = [];
    const waiterReport = await runStaffMaintenance({
      businessId: BIZ_ID,
      task: "ensure_waiters",
      apply: true,
      queryRunner: {
        query: async (sql, params = []) => {
          waiterQueries.push({ sql, params });
          if (sql.includes("FROM negocios")) return { rows: [{ id: BIZ_ID }] };
          if (sql.includes("COUNT(*)")) return { rows: [{ c: 0 }] };
          return { rows: [] };
        },
      },
    });
    assert.strictEqual(waiterReport.writesExecuted, 1);
    assert.ok(waiterQueries.every((q) => q.params.includes(BIZ_ID)));
  });

  console.log("\n✅ 5 suites puras/simuladas de db-pool y staff-maintenance aprobadas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
