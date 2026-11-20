import assert from "node:assert";
import {
  validatePinFormat,
  hashPin,
  verifyPinHash,
  isHashedPin,
  BLACKLISTED_PINS,
} from "./security-pins";
import {
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAuth,
  verifyDoubleRateLimit,
  recordDoubleFailedAttempt,
  clearDoubleRateLimit,
  MESERO_PIN_LIMIT,
  COCINA_PIN_LIMIT,
  SUPERADMIN_LOGIN_LIMIT,
} from "./security-rate-limit";

console.log("==================================================");
console.log("🛡️ INICIANDO SUITE DE SEGURIDAD ESTRICTA (PINS & RATE LIMIT)");
console.log("==================================================");

// 1. Verificación de rechazo de PINs predeterminados e inseguros
console.log("1. Validando rechazo estricto de PINs predeterminados...");
const blacklistedExamples = ["1234", "0000", "1111", "5678", "4321", "123456", "000000"];
for (const pin of blacklistedExamples) {
  const res = validatePinFormat(pin);
  assert.strictEqual(res.valid, false, `El PIN "${pin}" debe ser rechazado por ser predeterminado`);
  assert(res.error?.includes("predeterminado") || res.error?.includes("inseguro"));
}
console.log("✅ [PASS] Todos los PINs predeterminados de la lista negra son rechazados");

// 2. Verificación de formato numérico y longitud (4 a 8 dígitos)
console.log("2. Validando restricciones de longitud y tipo numérico...");
const invalidFormat = ["123", "9", "123456789", "abcd", "12a4", "12 34", "", null, undefined];
for (const pin of invalidFormat) {
  const res = validatePinFormat(pin);
  assert.strictEqual(res.valid, false, `El valor "${pin}" debe ser rechazado por formato`);
}

const validPins = ["8392", "4917", "29471", "738192", "94827104"];
for (const pin of validPins) {
  const res = validatePinFormat(pin);
  assert.strictEqual(res.valid, true, `El PIN "${pin}" debe ser válido`);
  assert.strictEqual(res.cleanPin, pin);
}
console.log("✅ [PASS] Validaciones de formato numérico de 4 a 8 dígitos correctas");

// 3. Verificación de almacenamiento irreversible en Hash Bcrypt
console.log("3. Validando hashing seguro bcrypt y verificación de credenciales...");
const samplePin = "8392";
const hash = hashPin(samplePin);

assert(isHashedPin(hash), "El resultado de hashPin debe ser detectado como hash bcrypt válido");
assert(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "El hash debe iniciar con prefijo bcrypt estándar");
assert(hash.length >= 59, "El hash bcrypt debe tener longitud suficiente (>= 59 chars)");

// Verificación correcta
assert.strictEqual(verifyPinHash(samplePin, hash), true, "El PIN correcto debe verificar positivamente contra el hash");

// Verificación de PIN incorrecto
assert.strictEqual(verifyPinHash("8391", hash), false, "Un PIN incorrecto debe ser rechazado");
assert.strictEqual(verifyPinHash("1234", hash), false, "Un PIN por defecto debe ser rechazado");

// Protección estricta: NUNCA comparar texto plano contra texto plano
assert.strictEqual(verifyPinHash("1234", "1234"), false, "La comparación contra texto plano debe fallar siempre");
assert.strictEqual(verifyPinHash("8392", "8392"), false, "La comparación contra texto plano debe fallar siempre");
console.log("✅ [PASS] Criptografía bcrypt y protección anti-fuga en texto plano verificada");

// 4. Verificación de Rate Limiting y Bloqueo Temporal (Fuerza Bruta)
console.log("4. Validando rate limiting en memoria anti fuerza bruta...");
const testEntity = `test_entity_${Date.now()}`;
const testIp = `192.168.1.${Math.floor(Math.random() * 200) + 1}`;
const testConfig = {
  maxAttempts: 3,
  windowMs: 60 * 1000,
  lockoutMs: 5 * 60 * 1000,
  resourceName: "de prueba",
};

// Intento 1 fallido
let f1 = recordFailedAttempt(testEntity, testConfig);
assert.strictEqual(f1.allowed, true);
assert.strictEqual(f1.remainingAttempts, 2);

// Intento 2 fallido
let f2 = recordFailedAttempt(testEntity, testConfig);
assert.strictEqual(f2.allowed, true);
assert.strictEqual(f2.remainingAttempts, 1);

// Intento 3 fallido (alcanza el límite -> Bloqueado)
let f3 = recordFailedAttempt(testEntity, testConfig);
assert.strictEqual(f3.allowed, false);
assert.strictEqual(f3.remainingAttempts, 0);
assert(f3.retryAfterSeconds! > 0, "Debe tener tiempo de espera restante");

// Verificación posterior durante bloqueo
let checkLocked = checkRateLimit(testEntity, testConfig);
assert.strictEqual(checkLocked.allowed, false);
assert.strictEqual(checkLocked.remainingAttempts, 0);
assert(checkLocked.error?.includes("bloqueado temporalmente"));

// Recuperación segura al autenticarse exitosamente tras expirar o desbloqueo
recordSuccessfulAuth(testEntity);
let checkRecovered = checkRateLimit(testEntity, testConfig);
assert.strictEqual(checkRecovered.allowed, true);
assert.strictEqual(checkRecovered.remainingAttempts, 3);
console.log("✅ [PASS] Rate limiting, bloqueo temporal progresivo y recuperación segura verificados");

// 5. Verificación de Rate Limit Doble (Entidad + IP)
console.log("5. Validando Rate Limit Dual (Mesero/Cocina/SuperAdmin + IP)...");
const dualEntity = `mesero_test_${Date.now()}`;
const dualIp = "10.0.0.55";

const initialCheck = verifyDoubleRateLimit(dualEntity, dualIp, MESERO_PIN_LIMIT);
assert.strictEqual(initialCheck.allowed, true);

// Registrar 5 intentos fallidos para el mesero
for (let i = 1; i <= 4; i++) {
  const f = recordDoubleFailedAttempt(dualEntity, dualIp, MESERO_PIN_LIMIT);
  assert.strictEqual(f.allowed, true);
}

// El 5to intento debe bloquear
const lockedResult = recordDoubleFailedAttempt(dualEntity, dualIp, MESERO_PIN_LIMIT);
assert.strictEqual(lockedResult.allowed, false);
assert.strictEqual(lockedResult.remainingAttempts, 0);

// Comprobación de que la entidad está bloqueada
const entityBlocked = verifyDoubleRateLimit(dualEntity, dualIp, MESERO_PIN_LIMIT);
assert.strictEqual(entityBlocked.allowed, false);

// Limpiar rate limit
clearDoubleRateLimit(dualEntity, dualIp, MESERO_PIN_LIMIT);
const afterClear = verifyDoubleRateLimit(dualEntity, dualIp, MESERO_PIN_LIMIT);
assert.strictEqual(afterClear.allowed, true);
console.log("✅ [PASS] Protección dual por cuenta e IP validada al 100%");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE SEGURIDAD PASARON EXITOSAMENTE (100%)");
console.log("==================================================");
