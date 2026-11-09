import assert from "node:assert";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

function createMockRequest(urlStr: string, host: string, forwardedHost?: string): NextRequest {
  const url = new URL(urlStr);
  const headers = new Headers();
  headers.set("host", host);
  if (forwardedHost) {
    headers.set("x-forwarded-host", forwardedHost);
  }
  return new NextRequest(url, { headers });
}

console.log("=== INICIANDO PRUEBAS DE PROXY DE SUBDOMINIOS (NEXT.JS 16) ===");

// 1. ctalo.ubicame.cc en la raíz '/'
{
  const req = createMockRequest("https://ctalo.ubicame.cc/", "ctalo.ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.ok(rewriteUrl && rewriteUrl.endsWith("/ctalo"), "Debe reescribir '/' a '/ctalo'");
  console.log("✅ [PASS] 1: ctalo.ubicame.cc '/' reescribe internamente a '/ctalo'");
}

// 2. ctalo.ubicame.cc en comercio '/aura-boutique'
{
  const req = createMockRequest("https://ctalo.ubicame.cc/aura-boutique", "ctalo.ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.ok(rewriteUrl && rewriteUrl.endsWith("/ctalo/aura-boutique"), "Debe reescribir a '/ctalo/aura-boutique'");
  console.log("✅ [PASS] 2: ctalo.ubicame.cc '/aura-boutique' reescribe a '/ctalo/aura-boutique'");
}

// 3. ctalo.localhost:3000 en comercio '/calzado-urbano'
{
  const req = createMockRequest("http://ctalo.localhost:3000/calzado-urbano", "ctalo.localhost:3000");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.ok(rewriteUrl && rewriteUrl.endsWith("/ctalo/calzado-urbano"), "Debe reescribir a '/ctalo/calzado-urbano'");
  console.log("✅ [PASS] 3: ctalo.localhost:3000 '/calzado-urbano' reescribe a '/ctalo/calzado-urbano'");
}

// 4. x-forwarded-host detrás de proxy inverso (Coolify / Cloudflare)
{
  const req = createMockRequest("http://localhost:3000/tienda-demo", "localhost:3000", "ctalo.ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.ok(rewriteUrl && rewriteUrl.endsWith("/ctalo/tienda-demo"), "Debe detectar x-forwarded-host");
  console.log("✅ [PASS] 4: x-forwarded-host detecta proxy inverso y reescribe correctamente");
}

// 5. Exclusiones críticas en subdominio ctalo: /api/pedidos debe pasar limpio sin rewrite
{
  const req = createMockRequest("https://ctalo.ubicame.cc/api/pedidos", "ctalo.ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.strictEqual(rewriteUrl, null, "Rutas /api no deben reescribirse");
  console.log("✅ [PASS] 5: Rutas /api/pedidos pasan directo sin reescritura");
}

// 6. Exclusiones de administración y login en subdominio ctalo
{
  const reqAdmin = createMockRequest("https://ctalo.ubicame.cc/admin", "ctalo.ubicame.cc");
  const resAdmin = proxy(reqAdmin);
  assert.strictEqual(resAdmin.headers.get("x-middleware-rewrite"), null, "Rutas /admin no deben reescribirse");

  const reqLogin = createMockRequest("https://ctalo.ubicame.cc/login", "ctalo.ubicame.cc");
  const resLogin = proxy(reqLogin);
  assert.strictEqual(resLogin.headers.get("x-middleware-rewrite"), null, "Rutas /login no deben reescribirse");
  console.log("✅ [PASS] 6: Rutas /admin y /login pasan directo sin reescritura");
}

// 7. Subdominio menuqr.ubicame.cc (Zero-Regressions para restaurantes)
{
  const req = createMockRequest("https://menuqr.ubicame.cc/las-empanadas-de-mauro", "menuqr.ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.strictEqual(rewriteUrl, null, "menuqr.ubicame.cc no debe sufrir reescrituras");
  console.log("✅ [PASS] 7: menuqr.ubicame.cc '/las-empanadas-de-mauro' opera de forma 100% transparente (Zero-Regressions)");
}

// 8. Dominio principal ubicame.cc en la raíz
{
  const req = createMockRequest("https://ubicame.cc/", "ubicame.cc");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.strictEqual(rewriteUrl, null, "Dominio principal no debe ser alterado");
  console.log("✅ [PASS] 8: ubicame.cc opera de forma 100% transparente sin alteraciones");
}

// 9. Submódulo operacional /:slug/mesas en subdominio ctalo pasa directo sin reescritura
{
  const req = createMockRequest("http://ctalo.localhost:3000/las-empanadas-de-mauro/mesas", "ctalo.localhost:3000");
  const res = proxy(req);
  const rewriteUrl = res.headers.get("x-middleware-rewrite");
  assert.strictEqual(rewriteUrl, null, "Rutas operacionales /:slug/mesas no deben reescribirse a la vertical");
  console.log("✅ [PASS] 9: ctalo.localhost '/las-empanadas-de-mauro/mesas' pasa directo a src/app/[slug]/mesas");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE PROXY PASARON (9/9)");
console.log("==================================================");

