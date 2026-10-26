import assert from "node:assert";

console.log("==========================================");
console.log("🧪 RUNNING STAFF & KITCHEN PIN SECURITY SUITE");
console.log("==========================================");

// --- TEST 1: Validación de formato de PIN (4 a 8 dígitos numéricos) ---
function isValidPin(pin: string): boolean {
  const p = pin.trim();
  return p.length >= 4 && p.length <= 8 && /^\d+$/.test(p);
}

assert.strictEqual(isValidPin("1234"), true, "Test 1.1 failed: 1234 should be valid");
assert.strictEqual(isValidPin("0000"), true, "Test 1.2 failed: 0000 should be valid");
assert.strictEqual(isValidPin("98765432"), true, "Test 1.3 failed: 8 digits should be valid");
assert.strictEqual(isValidPin("123"), false, "Test 1.4 failed: 3 digits should be invalid");
assert.strictEqual(isValidPin("123456789"), false, "Test 1.5 failed: 9 digits should be invalid");
assert.strictEqual(isValidPin("12a4"), false, "Test 1.6 failed: alphanumeric should be invalid");
assert.strictEqual(isValidPin(""), false, "Test 1.7 failed: empty should be invalid");
console.log("✅ [PASS] Test 1: Validación estricta de formato PIN numérico (4 a 8 dígitos)");

// --- TEST 2: Parsing y preservación de customLabels para seguridad de Cocina ---
interface CustomLabelsObj {
  kitchenPin?: string;
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
    current.kitchenPin = securityUpdates.kitchenPin.trim();
  }
  if (securityUpdates.kitchenPinRequired !== undefined) {
    current.kitchenPinRequired = Boolean(securityUpdates.kitchenPinRequired && current.kitchenPin);
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
  kitchenPin: "5566",
  kitchenPinRequired: true,
  waiterPinRequired: true,
});

assert.strictEqual(update1.merged.isGastro, true, "Test 2.1: Existing customLabels fields must be preserved");
assert.strictEqual(update1.merged.kitchenPin, "5566", "Test 2.2: kitchenPin saved");
assert.strictEqual(update1.merged.kitchenPinRequired, true, "Test 2.3: kitchenPinRequired saved");
console.log("✅ [PASS] Test 2: Inmutabilidad de configuraciones preexistentes en customLabels al actualizar PIN");

// --- TEST 3: Si kitchenPin está vacío, kitchenPinRequired debe forzarse a false ---
const update2 = parseAndMergeKitchenSecurity(update1.updatedJson, {
  kitchenPin: "",
  kitchenPinRequired: true, // Should become false because pin is empty
});
assert.strictEqual(update2.merged.kitchenPinRequired, false, "Test 3.1: Required cannot be true if PIN is empty");
console.log("✅ [PASS] Test 3: Desactivación automática de bloqueo si se quita el PIN de cocina (Acceso Libre)");

// --- TEST 4: Validación de credencial en pantalla de Cocina KDS ---
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

  const pin = typeof customObj.kitchenPin === "string" ? customObj.kitchenPin.trim() : "";
  const required = Boolean(customObj.kitchenPinRequired && pin);

  // Sin clave requerida -> acceso libre
  if (!required || !pin) {
    return { authorized: true, reason: "Acceso libre permitido (sin PIN configurado)" };
  }

  if (inputPin.trim() === pin) {
    return { authorized: true, reason: "PIN correcto" };
  }

  return { authorized: false, reason: "PIN incorrecto" };
}

const lockedConfig = JSON.stringify({ kitchenPin: "9988", kitchenPinRequired: true });
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "9988").authorized, true, "Test 4.1: Correct PIN authorizes");
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "1111").authorized, false, "Test 4.2: Wrong PIN denied");
assert.strictEqual(verifyKitchenPinAccess(lockedConfig, "").authorized, false, "Test 4.3: Empty PIN denied");

const unlockedConfig = JSON.stringify({ kitchenPin: "", kitchenPinRequired: false });
assert.strictEqual(verifyKitchenPinAccess(unlockedConfig, "").authorized, true, "Test 4.4: Free access permitted");
console.log("✅ [PASS] Test 4: Verificación de acceso a Pantalla Cocina KDS (Correcto / Incorrecto / Libre)");

// --- TEST 5: Control de meseros (nombre y pin) ---
function validateWaiterPayload(nombre: string, pin: string): { valid: boolean; error?: string } {
  const cleanNombre = nombre?.trim();
  if (!cleanNombre) {
    return { valid: false, error: "El nombre del mesero es obligatorio." };
  }
  if (!isValidPin(pin)) {
    return { valid: false, error: "El PIN debe ser numérico de 4 a 8 dígitos." };
  }
  return { valid: true };
}

assert.strictEqual(validateWaiterPayload("Carlos", "1234").valid, true, "Test 5.1: Valid waiter");
assert.strictEqual(validateWaiterPayload("   ", "1234").valid, false, "Test 5.2: Blank name invalid");
assert.strictEqual(validateWaiterPayload("Ana", "abc").valid, false, "Test 5.3: Non-numeric PIN invalid");
console.log("✅ [PASS] Test 5: Validación de datos de mesero para creación y edición");

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE EQUIPO Y SEGURIDAD PIN PASARON (5/5)");
console.log("==========================================");
