import { 
  generateTableToken, 
  verifyTableToken, 
  buildTableQrUrl, 
  parseTableFromUrl,
  normalizeTableName 
} from "./table-token";

console.log("==========================================");
console.log("🧪 RUNNING TABLE QR SECURITY TOKEN SUITE");
console.log("==========================================");

const REST_A = "rest_empanadas_123";
const REST_B = "rest_mamma_mia_456";

// Test 1: Deterministic generation
const tokenMesa1 = generateTableToken(REST_A, "1");
const tokenMesa1Repeat = generateTableToken(REST_A, "1");
if (tokenMesa1 !== tokenMesa1Repeat || tokenMesa1.length !== 10) {
  console.error("❌ Test 1 FAILED: Token generation not deterministic or wrong length", tokenMesa1);
  process.exit(1);
}
console.log("✅ [PASS] Test 1: Generación determinística de 10 caracteres:", tokenMesa1);

// Test 2: Table verification succeeds with valid token
const isValid1 = verifyTableToken(REST_A, "1", tokenMesa1);
if (!isValid1) {
  console.error("❌ Test 2 FAILED: Valid token was rejected");
  process.exit(1);
}
console.log("✅ [PASS] Test 2: Token válido verificado con éxito");

// Test 3: Anti-tamper protection - Tampering table number must fail
// Attacker tries to use Mesa 1's token for Mesa 2
const isTamperedTable = verifyTableToken(REST_A, "2", tokenMesa1);
if (isTamperedTable) {
  console.error("❌ Test 3 FAILED: Tampered table accepted token from another table!");
  process.exit(1);
}
console.log("✅ [PASS] Test 3: Ataque de manipulación de mesa (mesa 1 -> mesa 2) BLOQUEADO");

// Test 4: Cross-tenant protection - Token for Rest A must fail on Rest B
const isTamperedTenant = verifyTableToken(REST_B, "1", tokenMesa1);
if (isTamperedTenant) {
  console.error("❌ Test 4 FAILED: Cross-tenant attack accepted token!");
  process.exit(1);
}
console.log("✅ [PASS] Test 4: Ataque multi-tenant (Rest A -> Rest B) BLOQUEADO");

// Test 5: Table Name normalization
const normName = normalizeTableName("  Terraza 1  ");
const tokenMesaVip1 = generateTableToken(REST_A, " Terraza 1 ");
const tokenMesaVip2 = generateTableToken(REST_A, "terraza 1");
if (normName !== "terraza 1" || tokenMesaVip1 !== tokenMesaVip2) {
  console.error("❌ Test 5 FAILED: Normalization failed for whitespace/casing", { normName });
  process.exit(1);
}
console.log("✅ [PASS] Test 5: Normalización de espacios y mayúsculas/minúsculas funciona");

// Test 6: URL Builder
const url = buildTableQrUrl("https://menuqr.pro", "las-empanadas", "Mesa VIP", REST_A);
if (!url.includes("mesa=Mesa%20VIP") || !url.includes("&auth=")) {
  console.error("❌ Test 6 FAILED: Generated URL missing parameters", url);
  process.exit(1);
}
console.log("✅ [PASS] Test 6: URL completa de QR construida correctamente:", url);

// Test 7: Parameter parser with verified token
const paramsVerified = new URLSearchParams(`mesa=Mesa%20VIP&auth=${generateTableToken(REST_A, "Mesa VIP")}`);
const parsedOk = parseTableFromUrl(paramsVerified, REST_A);
if (!parsedOk.isVerified || parsedOk.tableName !== "Mesa VIP") {
  console.error("❌ Test 7 FAILED: Parser did not verify legitimate URL", parsedOk);
  process.exit(1);
}
console.log("✅ [PASS] Test 7: Parser de URL reconoce mesa legítima y verificada");

// Test 8: Parameter parser with missing/fake token
const paramsTampered = new URLSearchParams(`mesa=Mesa%20VIP&auth=fake_token_123`);
const parsedTampered = parseTableFromUrl(paramsTampered, REST_A);
if (parsedTampered.isVerified) {
  console.error("❌ Test 8 FAILED: Fake token marked as verified!");
  process.exit(1);
}
console.log("✅ [PASS] Test 8: Parser de URL detecta token falso como no verificado");

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE SEGURIDAD PASARON (8/8)");
console.log("==========================================");
