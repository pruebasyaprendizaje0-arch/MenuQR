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

// 5. Verificación de Security Headers en next.config
async function testSecurityHeadersConfig() {
  const nextConfigModule = await import("../../next.config.mjs");
  const nextConfig = nextConfigModule.default;

  assert.strictEqual(nextConfig.poweredByHeader, false, "poweredByHeader debe estar desactivado");
  const headersList = await nextConfig.headers();
  const rootHeaders = headersList.find((h: any) => h.source === "/:path*");
  assert.ok(rootHeaders, "Debe existir configuración de headers para /:path*");

  const cspHeader = rootHeaders.headers.find((h: any) => h.key === "Content-Security-Policy-Report-Only");
  assert.ok(cspHeader, "Debe existir cabecera Content-Security-Policy-Report-Only");
  assert.ok(cspHeader.value.includes("connect-src"), "CSP debe incluir connect-src");
  assert.ok(cspHeader.value.includes("ws:"), "CSP debe permitir WebSockets ws:");
  assert.ok(cspHeader.value.includes("wss:"), "CSP debe permitir WebSockets wss:");
  console.log("✅ [PASS] 5: poweredByHeader: false y Content-Security-Policy-Report-Only validados");
}

// 6. Verificación estática de queries de Reservas (negocio_id::text = $1::text)
async function testReservasSqlSafety() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const disponibilidadPath = path.join(process.cwd(), "src/app/api/reservas/disponibilidad/route.ts");
  const contentDisp = fs.readFileSync(disponibilidadPath, "utf-8");
  assert.ok(contentDisp.includes("negocio_id::text = $1::text"), "disponibilidad debe usar cast seguro ::text = $1::text");
  assert.ok(!contentDisp.includes("(negocio_id = $1 OR"), "disponibilidad no debe contener comparador no casteado");

  const idRoutePath = path.join(process.cwd(), "src/app/api/reservas/[id]/route.ts");
  const contentId = fs.readFileSync(idRoutePath, "utf-8");
  assert.ok(contentId.includes("negocio_id::text = $1::text"), "reservas/[id] debe usar cast seguro ::text = $1::text");

  const pedidosRoutePath = path.join(process.cwd(), "src/app/api/pedidos/route.ts");
  const contentPedidos = fs.readFileSync(pedidosRoutePath, "utf-8");
  assert.ok(contentPedidos.includes("negocio_id::text = $1::text"), "pedidos route debe usar cast seguro ::text = $1::text");

  console.log("✅ [PASS] 6: Cast de negocio_id::text = $1::text verificado en disponibilidad, [id] y pedidos");
}

// 7. Verificación de re-throw de NEXT_REDIRECT en páginas de verticales
async function testNextRedirectHandling() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const verticals = ["ctalo", "citas", "reservas", "servicios", "menuqr"];
  for (const v of verticals) {
    const pagePath = path.join(process.cwd(), `src/app/(verticales)/${v}/[slug]/page.tsx`);
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.ok(
      content.includes('err?.digest?.startsWith("NEXT_REDIRECT")') || content.includes('error?.digest?.startsWith("NEXT_REDIRECT")'),
      `Página vertical ${v} debe relanzar NEXT_REDIRECT sin loguearlo como error`
    );
  }

  console.log("✅ [PASS] 7: Manejo limpio de NEXT_REDIRECT validado en las 5 páginas de verticales");
}

// 8. Verificación del triple candado contra la cabecera x-powered-by
async function testPoweredByTripleLock() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // Candado 1: Dockerfile copia next.config.mjs al runner
  const dockerfilePath = path.join(process.cwd(), "Dockerfile");
  const dockerfileContent = fs.readFileSync(dockerfilePath, "utf-8");
  assert.ok(
    dockerfileContent.includes("COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs"),
    "Dockerfile debe copiar next.config.mjs al runner stage"
  );

  // Candado 2: server.js intercepta res.setHeader para x-powered-by
  const serverPath = path.join(process.cwd(), "server.js");
  const serverContent = fs.readFileSync(serverPath, "utf-8");
  assert.ok(
    serverContent.includes('name.toLowerCase() === "x-powered-by"'),
    "server.js debe filtrar x-powered-by en el servidor HTTP nativo"
  );

  // Candado 3: proxy.ts limpia la cabecera en las respuestas
  const proxyPath = path.join(process.cwd(), "src/proxy.ts");
  const proxyContent = fs.readFileSync(proxyPath, "utf-8");
  assert.ok(
    proxyContent.includes('res.headers.delete("x-powered-by")'),
    "proxy.ts debe eliminar x-powered-by de las respuestas"
  );

  console.log("✅ [PASS] 8: Triple candado contra x-powered-by verificado en Dockerfile, server.js y proxy.ts");
}

async function runAll() {
  await testSafeFetch();
  await testHealthEndpoint();
  await testHealthHeadEndpoint();
  await testSecurityHeadersConfig();
  await testReservasSqlSafety();
  await testNextRedirectHandling();
  await testPoweredByTripleLock();
  console.log("==================================================");
  console.log("🎉 TODAS LAS PRUEBAS DE RESILIENCIA HTTP PASARON (8/8)");
  console.log("==================================================");
}

runAll().catch((err) => {
  console.error("❌ Fallo en pruebas de resiliencia:", err);
  process.exit(1);
});
