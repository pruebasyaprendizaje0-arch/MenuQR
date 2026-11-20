import assert from "node:assert";
import {
  validatePinFormat,
  hashPin,
  verifyPinHash,
  isHashedPin,
  BLACKLISTED_PINS,
} from "./security-pins";
import {
  verifyDoubleRateLimit,
  recordDoubleFailedAttempt,
  clearDoubleRateLimit,
  COCINA_PIN_LIMIT,
  MESERO_PIN_LIMIT,
} from "./security-rate-limit";

console.log("==========================================");
console.log("🧪 RUNNING STAFF & KITCHEN PIN SECURITY SUITE (HARDENED)");
console.log("==========================================");

// --- TEST 1: Validación estricta de formato de PIN y rechazo de predeterminados ---
assert.strictEqual(validatePinFormat("8392").valid, true, "Test 1.1: 8392 debe ser válido");
assert.strictEqual(validatePinFormat("98765432").valid, true, "Test 1.2: 8 dígitos debe ser válido");
assert.strictEqual(validatePinFormat("1234").valid, false, "Test 1.3: 1234 predeterminado debe ser rechazado");
assert.strictEqual(validatePinFormat("0000").valid, false, "Test 1.4: 0000 predeterminado debe ser rechazado");
assert.strictEqual(validatePinFormat("1111").valid, false, "Test 1.5: 1111 predeterminado debe ser rechazado");
assert.strictEqual(validatePinFormat("123").valid, false, "Test 1.6: 3 dígitos debe ser rechazado");
assert.strictEqual(validatePinFormat("123456789").valid, false, "Test 1.7: 9 dígitos debe ser rechazado");
assert.strictEqual(validatePinFormat("12a4").valid, false, "Test 1.8: alfanumérico debe ser rechazado");
assert.strictEqual(validatePinFormat("").valid, false, "Test 1.9: vacío debe ser rechazado");
console.log("✅ [PASS] Test 1: Validación estricta de formato PIN numérico y lista negra de valores predeterminados");

// --- TEST 2: Parsing y almacenamiento de Hash Bcrypt en customLabels para Cocina KDS ---
interface CustomLabelsObj {
  kitchenPin?: string;
  kitchenPinHash?: string | null;
  kitchenPinRequired?: boolean;
  waiterPinRequired?: boolean;
  isGastro?: boolean;
  [key: string]: unknown;
}

function parseAndMergeKitchenSecurity(
  rawCustomLabels: string | null | undefined,
  securityUpdates: { kitchenPin?: string; kitchenPinRequired?: boolean; waiterPinRequired?: boolean }
): { updatedJson: string; merged: CustomLabelsObj } {
  let current: CustomLabelsObj = {};
  if (rawCustomLabels) {
    try {
      current = JSON.parse(rawCustomLabels);
    } catch {
      current = {};
    }
  }

  if (securityUpdates.kitchenPin !== undefined) {
    const p = securityUpdates.kitchenPin.trim();
    if (p === "") {
      delete current.kitchenPin;
      current.kitchenPinHash = null;
    } else {
      const pinVal = validatePinFormat(p);
      if (pinVal.valid && pinVal.cleanPin) {
        current.kitchenPinHash = hashPin(pinVal.cleanPin);
        delete current.kitchenPin; // Eliminar texto plano
      }
    }
  }

  const hasHash = Boolean(current.kitchenPinHash && isHashedPin(String(current.kitchenPinHash)));

  if (securityUpdates.kitchenPinRequired !== undefined) {
    current.kitchenPinRequired = Boolean(securityUpdates.kitchenPinRequired && hasHash);
  }
  if (securityUpdates.waiterPinRequired !== undefined) {
    current.waiterPinRequired = Boolean(securityUpdates.waiterPinRequired);
  }

  return {
    updatedJson: JSON.stringify(current),
    merged: current,
  };
}

const initialJson = JSON.stringify({ isGastro: true, themeColor: "#f59e0b" });
const update1 = parseAndMergeKitchenSecurity(initialJson, {
  kitchenPin: "5567",
  kitchenPinRequired: true,
  waiterPinRequired: true,
});

assert.strictEqual(update1.merged.isGastro, true, "Test 2.1: Campos preexistentes preservados");
assert.strictEqual(Boolean(update1.merged.kitchenPinHash), true, "Test 2.2: kitchenPinHash almacenado");
assert.strictEqual(update1.merged.kitchenPin, undefined, "Test 2.3: kitchenPin en texto plano eliminado");
assert.strictEqual(isHashedPin(update1.merged.kitchenPinHash), true, "Test 2.4: Es hash bcrypt válido");
console.log("✅ [PASS] Test 2: Inmutabilidad de configuraciones preexistentes y almacenamiento como hash bcrypt");

// --- TEST 3: Si se quita el PIN, kitchenPinRequired debe desactivarse (Acceso Libre) ---
const update2 = parseAndMergeKitchenSecurity(update1.updatedJson, {
  kitchenPin: "",
  kitchenPinRequired: true,
});
assert.strictEqual(update2.merged.kitchenPinRequired, false, "Test 3.1: Required forzado a false si no hay hash");
assert.strictEqual(update2.merged.kitchenPinHash, null, "Test 3.2: Hash nulo");
console.log("✅ [PASS] Test 3: Desactivación automática de bloqueo si se quita el PIN de cocina (Acceso Libre)");

// --- TEST 4: Verificación criptográfica segura con bcrypt contra hash ---
function verifyKitchenPinAccess(
  customLabelsRaw: string | null | undefined,
  inputPin: string
): { authorized: boolean; reason: string } {
  let customObj: CustomLabelsObj = {};
  if (customLabelsRaw) {
    try {
      customObj = JSON.parse(customLabelsRaw);
    } catch {}
  }

  const hash = typeof customObj.kitchenPinHash === "string" ? customObj.kitchenPinHash.trim() : "";
  const required = Boolean(customObj.kitchenPinRequired && hash);

  if (!required || !hash) {
    return { authorized: true, reason: "Acceso libre permitido (sin PIN configurado)" };
  }

  const valid = verifyPinHash(inputPin, hash);
  return { authorized: valid, reason: valid ? "PIN verificado exitosamente" : "PIN incorrecto" };
}

const validPinForTest = "9982";
const lockedConfig = JSON.stringify({
  kitchenPinHash: hashPin(validPinForTest),
  kitchenPinRequired: true,
});

assert.strictEqual(verifyKitchenPinAccess(lockedConfig, validPinForTest).authorized, true, "Test 4.1: PIN correcto autoriza");
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "1111").authorized, false, "Test 4.2: PIN incorrecto denegado");
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "").authorized, false, "Test 4.3: PIN vacío denegado");
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "1234").authorized, false, "Test 4.4: PIN default denegado");
console.log("✅ [PASS] Test 4: Verificación criptográfica de acceso a Cocina KDS");

// --- TEST 5: Rate Limiting anti fuerza bruta ---
const testEntity = `kds_${Date.now()}`;
const testIp = "192.168.1.100";

for (let i = 1; i <= 4; i++) {
  const f = recordDoubleFailedAttempt(testEntity, testIp, COCINA_PIN_LIMIT);
  assert.strictEqual(f.allowed, true);
}
const locked = recordDoubleFailedAttempt(testEntity, testIp, COCINA_PIN_LIMIT);
assert.strictEqual(locked.allowed, false);
assert.strictEqual(locked.remainingAttempts, 0);

clearDoubleRateLimit(testEntity, testIp, COCINA_PIN_LIMIT);
const cleared = verifyDoubleRateLimit(testEntity, testIp, COCINA_PIN_LIMIT);
assert.strictEqual(cleared.allowed, true);
console.log("✅ [PASS] Test 5: Rate Limiting y recuperación segura tras desbloqueo");

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE EQUIPO Y SEGURIDAD PIN PASARON (5/5)");
console.log("==========================================");
