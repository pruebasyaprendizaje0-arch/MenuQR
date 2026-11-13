import assert from "node:assert";
import { encryptDatilPassword, decryptDatilPassword, maskDatilPassword } from "./datil-encryption";

console.log("=== INICIANDO PRUEBAS DE SEGURIDAD Y CIFRADO DÁTIL (AES-256-GCM) ===");

// 1. Cifrado y descifrado exacto
const originalSecret = "MiContraseñaDeApiDatil_2026_SRI!#";
const encrypted = encryptDatilPassword(originalSecret);

assert.notStrictEqual(encrypted, originalSecret, "El texto cifrado no debe contener la contraseña en plano");
assert.ok(encrypted.includes(":"), "Debe tener formato iv:tag:data");

const decrypted = decryptDatilPassword(encrypted);
assert.strictEqual(decrypted, originalSecret, "La contraseña descifrada debe ser exactamente igual a la original");
console.log("✅ [PASS] 1: Cifrado y descifrado AES-256-GCM exacto y verificado");

// 2. Cifrados sucesivos del mismo texto deben producir IVs y ciphertexts diferentes (Anti-replay)
const encrypted2 = encryptDatilPassword(originalSecret);
assert.notStrictEqual(encrypted, encrypted2, "Cada cifrado debe usar un IV aleatorio único");
assert.strictEqual(decryptDatilPassword(encrypted2), originalSecret);
console.log("✅ [PASS] 2: Aleatoriedad de IV y protección contra análisis de frecuencia");

// 3. Manejo de cadenas vacías y tokens corruptos
assert.strictEqual(encryptDatilPassword(""), "");
assert.strictEqual(decryptDatilPassword(""), "");
assert.strictEqual(decryptDatilPassword("token_corrupto_sin_dos_puntos"), "");
console.log("✅ [PASS] 3: Manejo seguro y tolerante a fallos de tokens inválidos");

// 4. Enmascaramiento para UI
assert.strictEqual(maskDatilPassword(true), "••••••••••••••••");
assert.strictEqual(maskDatilPassword(false), "");
console.log("✅ [PASS] 4: Enmascaramiento de UI correcto");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE CIFRADO DÁTIL PASARON (4/4)");
console.log("==================================================");
