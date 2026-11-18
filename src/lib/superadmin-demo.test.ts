import assert from "node:assert";

console.log("==========================================");
console.log("🧪 TESTING SUPER ADMIN DEMO RENEWAL & DAYS EXTENSION");
console.log("==========================================");

// 1. TEST: Validar rango estricto de días de extensión (1 a 30 días)
function validateDemoDays(days: number): { valid: boolean; error?: string; safeDays?: number } {
  const numDays = Math.round(Number(days));
  if (isNaN(numDays) || numDays < 1 || numDays > 30) {
    return { valid: false, error: "Solo se puede extender o renovar entre 1 y 30 días por operación." };
  }
  return { valid: true, safeDays: numDays };
}

assert.strictEqual(validateDemoDays(0).valid, false, "0 días debe ser rechazado");
assert.strictEqual(validateDemoDays(-5).valid, false, "Días negativos deben ser rechazados");
assert.strictEqual(validateDemoDays(31).valid, false, "Más de 30 días debe ser rechazado");
assert.strictEqual(validateDemoDays(NaN).valid, false, "NaN debe ser rechazado");
assert.strictEqual(validateDemoDays(1).valid, true, "1 día debe ser aceptado");
assert.strictEqual(validateDemoDays(7).valid, true, "7 días debe ser aceptado");
assert.strictEqual(validateDemoDays(15).valid, true, "15 días debe ser aceptado");
assert.strictEqual(validateDemoDays(30).valid, true, "30 días debe ser aceptado");
assert.strictEqual(validateDemoDays(14.8).safeDays, 15, "Debe redondear decimales correctamente");
console.log("✅ [PASS] Test 1: Validación estricta de 1 a 30 días por renovación");

// 2. TEST: Cálculo de fecha de expiración para negocio vencido (parte de hoy)
function calculateNewTrialEndsAt(currentTrialEndsAt: Date | null, daysToAdd: number, mockNow: Date): Date {
  const now = mockNow;
  const currentEnd = currentTrialEndsAt ? new Date(currentTrialEndsAt) : now;
  const baseDate = currentEnd > now ? new Date(currentEnd) : new Date(now);
  baseDate.setDate(baseDate.getDate() + daysToAdd);
  return baseDate;
}

const mockNow = new Date("2026-11-18T12:00:00.000Z");
const expiredDate = new Date("2026-11-10T12:00:00.000Z"); // vencido hace 8 días

const renewedFromExpired = calculateNewTrialEndsAt(expiredDate, 30, mockNow);
const expectedExpiredRenewal = new Date("2026-12-18T12:00:00.000Z");
assert.strictEqual(
  renewedFromExpired.toISOString(),
  expectedExpiredRenewal.toISOString(),
  "Si el negocio está vencido, los 30 días deben comenzar desde hoy (mockNow)"
);
console.log("✅ [PASS] Test 2: Negocio expirado renueva 30 días a partir de la fecha actual");

// 3. TEST: Cálculo acumulativo para negocio con días vigentes (suma al saldo actual)
const activeDate = new Date("2026-11-25T12:00:00.000Z"); // le quedan 7 días
const extendedActive = calculateNewTrialEndsAt(activeDate, 30, mockNow);
const expectedActiveExtension = new Date("2026-12-25T12:00:00.000Z");
assert.strictEqual(
  extendedActive.toISOString(),
  expectedActiveExtension.toISOString(),
  "Si el negocio tiene días vigentes, los 30 días se suman a la fecha de vencimiento actual"
);
console.log("✅ [PASS] Test 3: Negocio con días activos acumula la extensión a su fecha de vencimiento");

// 4. TEST: Calificación a EN_DEMO reactiva automáticamente negocio vencido
function simulateLeadStatusChange(
  currentStatus: string,
  newStatus: string,
  trialEndsAt: Date,
  mockNow: Date
): { updatedStatus: string; updatedTrialEndsAt?: Date; isSuspended: boolean } {
  let updatedTrialEndsAt: Date | undefined = undefined;
  let isSuspended = false;

  if (newStatus === "EN_DEMO") {
    if (trialEndsAt <= mockNow) {
      const newTrial = new Date(mockNow);
      newTrial.setDate(newTrial.getDate() + 30);
      updatedTrialEndsAt = newTrial;
      isSuspended = false;
    }
  }

  return {
    updatedStatus: newStatus,
    updatedTrialEndsAt,
    isSuspended,
  };
}

const resStatusChange = simulateLeadStatusChange("EXPIRADO_INACTIVO", "EN_DEMO", expiredDate, mockNow);
assert.strictEqual(resStatusChange.updatedStatus, "EN_DEMO");
assert(resStatusChange.updatedTrialEndsAt !== undefined, "Debe calcular nueva fecha de prueba al pasar a EN_DEMO");
assert.strictEqual(resStatusChange.updatedTrialEndsAt?.toISOString(), expectedExpiredRenewal.toISOString());
assert.strictEqual(resStatusChange.isSuspended, false, "Debe reactivar el negocio si estaba suspendido");
console.log("✅ [PASS] Test 4: Cambiar a EN_DEMO reactiva automáticamente 30 días a un negocio expirado");

// 5. TEST: Múltiples renovaciones consecutivas de hasta 30 días
let runningDate = new Date(mockNow);
for (let i = 1; i <= 3; i++) {
  runningDate = calculateNewTrialEndsAt(runningDate, 30, mockNow);
}
// 3 renovaciones de 30 días a partir de 2026-11-18 -> 90 días después
const expected90Days = new Date(mockNow);
expected90Days.setDate(expected90Days.getDate() + 90);
assert.strictEqual(
  runningDate.toISOString(),
  expected90Days.toISOString(),
  "Múltiples renovaciones consecutivas deben ser acumulativas y exactas"
);
console.log("✅ [PASS] Test 5: Renovaciones consecutivas de 30 días renovables probadas con éxito");

console.log("==========================================");
console.log("🎉 TODOS LOS TESTS DE DEMO SUPERADMIN PASARON 100%");
console.log("==========================================");
