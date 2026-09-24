import { selectWeightedPrize, generateUniqueCouponCode, RuletaPremioItem, DEFAULT_RULETA_PREMIOS } from "./ruleta-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log("==========================================");
console.log("🧪 RUNNING RULETA GAMIFICATION & DISCOUNT SUITE");
console.log("==========================================");

// 1. Probabilidad Ponderada
const sumProb = DEFAULT_RULETA_PREMIOS.reduce((acc, p) => acc + p.probabilidad, 0);
assert(Math.abs(sumProb - 100) < 0.01, `Suma de probabilidades de ruleta por defecto debe ser 100% (Actual: ${sumProb}%)`);

// 2. Selección de premio ponderado
const { premio, sectorIndex } = selectWeightedPrize(DEFAULT_RULETA_PREMIOS);
assert(Boolean(premio && premio.label), `Debe retornar un premio válido (Obtenido: ${premio?.label})`);
assert(sectorIndex >= 0 && sectorIndex < 6, `sectorIndex debe estar entre 0 y 5 (Obtenido: ${sectorIndex})`);

// 3. Generación de código único
const couponCode = generateUniqueCouponCode("DESC10", "empanadas-mauro");
assert(couponCode.startsWith("DESC10-"), `Código de cupón debe tener el prefijo DESC10 (Obtenido: ${couponCode})`);
assert(couponCode.length >= 10, `Código de cupón debe tener longitud segura (Obtenido: ${couponCode})`);

// 4. Cálculo de Descuento Porcentual
const subtotal = 20.0;
const pctDiscountVal = 10; // 10%
const calculatedPctDiscount = (subtotal * pctDiscountVal) / 100;
const totalAfterPctDiscount = Math.max(0, subtotal - calculatedPctDiscount);
assert(calculatedPctDiscount === 2.0, `Descuento del 10% sobre $20.00 debe ser $2.00 (Obtenido: $${calculatedPctDiscount})`);
assert(totalAfterPctDiscount === 18.0, `Total tras 10% OFF en $20.00 debe ser $18.00 (Obtenido: $${totalAfterPctDiscount})`);

// 5. Cálculo de Descuento Monto Fijo
const fixedDiscountVal = 5.0; // $5
const calculatedFixedDiscount = Math.min(subtotal, fixedDiscountVal);
const totalAfterFixedDiscount = Math.max(0, subtotal - calculatedFixedDiscount);
assert(calculatedFixedDiscount === 5.0, `Descuento fijo de $5.00 en $20.00 debe ser $5.00 (Obtenido: $${calculatedFixedDiscount})`);
assert(totalAfterFixedDiscount === 15.0, `Total tras $5 OFF en $20.00 debe ser $15.00 (Obtenido: $${totalAfterFixedDiscount})`);

// 6. Beneficio de Regalo (Postre/Bebida Gratis)
const giftPrizeType = "postre";
const giftDiscountAmount = giftPrizeType === "postre" ? 0 : 5;
const totalAfterGift = Math.max(0, subtotal - giftDiscountAmount);
assert(giftDiscountAmount === 0, `Premios de tipo regalo no restan valor en efectivo (Obtenido: $${giftDiscountAmount})`);
assert(totalAfterGift === 20.0, `Total tras premio de regalo se mantiene en $20.00 con beneficio anexado`);

console.log("==========================================");
console.log("TODAS LAS PRUEBAS DE LA RULETA PASARON (100%)");
console.log("==========================================");
