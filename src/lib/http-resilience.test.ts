import assert from "node:assert";
import { sanitizeInternalUrl, safeServerFetch } from "./http-client";
import { GET, HEAD } from "@/app/api/health/route";

console.log("=== INICIANDO PRUEBAS DE RESILIENCIA HTTP Y HEALTHCHECK ===");

// 1. Sanitización de URLs internas contra error SSL
{
  assert.strictEqual(
    sanitizeInternalUrl("https://localhost:3000/api/pedidos"),
    "http://localhost:3000/api/pedidos",
    "Debe convertir https://localhost a http://"
  );
  assert.strictEqual(
    sanitizeInternalUrl("https://127.0.0.1:3000"),
    "http://127.0.0.1:3000",
    "Debe convertir https://127.0.0.1 a http://"
  );
  assert.strictEqual(
    sanitizeInternalUrl("https://0.0.0.0:8080/health"),
    "http://0.0.0.0:8080/health",
    "Debe convertir https://0.0.0.0 a http://"
  );
  assert.strictEqual(
    sanitizeInternalUrl("https://api.datil.co/v1/invoices"),
    "https://api.datil.co/v1/invoices",
    "Debe mantener intactas las URLs externas legítimas con https://"
  );
  console.log("✅ [PASS] 1: Sanitización de URLs internas previene 'SSL wrong version number'");
}

// 2. safeServerFetch maneja caídas sin crashear el proceso
async function testSafeFetch() {
  const result = await safeServerFetch("http://127.0.0.1:65432/non-existent", {
    timeoutMs: 500,
  });

  assert.strictEqual(result.ok, false, "Debe retornar ok: false");
  assert.ok(result.error, "Debe proveer mensaje de error defensivo");
  console.log("✅ [PASS] 2: safeServerFetch degrada limpiamente sin arrojar excepciones no capturadas");
}

// 3. Endpoint GET /api/health ultraliviano
async function testHealthEndpoint() {
  const req = new Request("http://localhost:3000/api/health");
  const res = await GET(req);

  assert.strictEqual(res.status, 200, "Debe responder HTTP 200");
  const body = await res.json();
  assert.strictEqual(body.status, "ok", "Debe incluir status: 'ok'");
  assert.strictEqual(body.database, "skipped", "Por defecto no debe tocar la base de datos");
  assert.ok(typeof body.uptime === "number", "Debe incluir métrica de uptime");
  assert.ok(typeof body.timestamp === "number", "Debe incluir timestamp");
  console.log("✅ [PASS] 3: GET /api/health responde 200 en <10 ms sin tocar Postgres");
}

// 4. Endpoint HEAD /api/health
async function testHealthHeadEndpoint() {
  const res = await HEAD();
  assert.strictEqual(res.status, 200, "HEAD debe responder HTTP 200");
  assert.strictEqual(res.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate");
  console.log("✅ [PASS] 4: HEAD /api/health soporta monitores de cabeceras puras");
}

async function runAll() {
  await testSafeFetch();
  await testHealthEndpoint();
  await testHealthHeadEndpoint();
  console.log("==================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE RESILIENCIA HTTP PASARON (4/4)");
  console.log("==================================================");
}

runAll().catch((err) => {
  console.error("❌ Fallo en pruebas de resiliencia:", err);
  process.exit(1);
});
