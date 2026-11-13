import assert from "node:assert";
import { validateEcuadorianRuc } from "./datil-service";

console.log("=== INICIANDO PRUEBAS DE VALIDACIÓN TRIBUTARIA DÁTIL / SRI ECUADOR ===");

// 1. Validación de RUC Ecuatoriano (13 dígitos terminados en 001)
assert.strictEqual(validateEcuadorianRuc("1790012345001"), true, "RUC válido de 13 dígitos terminado en 001");
assert.strictEqual(validateEcuadorianRuc("0923456789001"), true, "RUC natural válido terminado en 001");

// Casos inválidos
assert.strictEqual(validateEcuadorianRuc("1790012345"), false, "RUC incompleto (< 13 dígitos) debe ser inválido");
assert.strictEqual(validateEcuadorianRuc("1790012345002"), false, "RUC que no termina en 001 debe ser inválido");
assert.strictEqual(validateEcuadorianRuc("179001234500A"), false, "RUC con letras debe ser inválido");
assert.strictEqual(validateEcuadorianRuc(""), false, "RUC vacío debe ser inválido");
console.log("✅ [PASS] 1: Validación rigurosa de formato RUC para SRI Ecuador");

// 2. Regla SRI para Consumidor Final ($50.00 USD)
function validateConsumidorFinalAllowed(totalAmount: number): { allowed: boolean; reason?: string } {
  if (totalAmount > 50.0) {
    return {
      allowed: false,
      reason: "Por normativa del SRI de Ecuador, ventas superiores a $50.00 USD requieren obligatoriamente datos del cliente (Cédula o RUC) y no pueden emitirse a Consumidor Final.",
    };
  }
  return { allowed: true };
}

assert.strictEqual(validateConsumidorFinalAllowed(25.0).allowed, true, "Venta de $25 permite Consumidor Final");
assert.strictEqual(validateConsumidorFinalAllowed(50.0).allowed, true, "Venta de $50 exactos permite Consumidor Final");
assert.strictEqual(validateConsumidorFinalAllowed(50.01).allowed, false, "Venta de $50.01 bloquea Consumidor Final");
assert.strictEqual(validateConsumidorFinalAllowed(120.0).allowed, false, "Venta de $120 bloquea Consumidor Final");
console.log("✅ [PASS] 2: Regla fiscal SRI de $50 USD para bloqueo de Consumidor Final verificada");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS TRIBUTARIAS DÁTIL PASARON (2/2)");
console.log("==================================================");
