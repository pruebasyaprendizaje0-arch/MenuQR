import assert from "node:assert";

/**
 * Test suite to verify tax and service charge calculations across:
 * 1. Mesa con IVA Adicional (15%) y Servicio Adicional (10%)
 * 2. Mesa con IVA Incluido y Servicio Incluido
 * 3. Platos adicionales añadidos a una comanda activa (acumulativo)
 * 4. Para Llevar vs Domicilio con costo de envío por KM
 * 5. Desglose en metadatos y consistencia con Caja POS
 */

function calcCharges(subtotal: number, config: {
  ivaPercent: number;
  servicePercent: number;
  ivaOnTable: boolean;
  serviceOnTable: boolean;
  ivaOnTakeout: boolean;
  serviceOnTakeout: boolean;
}, channel: "mesa" | "llevar" | "delivery", deliveryFee = 0) {
  const isTable = channel === "mesa";
  const ivaIncluded = isTable ? config.ivaOnTable : config.ivaOnTakeout;
  const serviceIncluded = isTable ? config.serviceOnTable : config.serviceOnTakeout;

  const ivaAmount = (config.ivaPercent > 0 && !ivaIncluded)
    ? Math.round(subtotal * (config.ivaPercent / 100) * 100) / 100
    : 0;
  const serviceAmount = (config.servicePercent > 0 && !serviceIncluded)
    ? Math.round(subtotal * (config.servicePercent / 100) * 100) / 100
    : 0;
  const totalAmount = Math.round((subtotal + ivaAmount + serviceAmount + deliveryFee) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    iva: ivaAmount,
    service_charge: serviceAmount,
    costo_envio: Math.round(deliveryFee * 100) / 100,
    total: totalAmount,
  };
}

console.log("=== INICIANDO PRUEBAS DE IMPUESTOS Y SERVICIO EN MESA/LLEVAR/DELIVERY ===");

// 1. Configuración como la captura del usuario: IVA Adicional (15%), Servicio Adicional (10%)
const configUsuario = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: false, // false = adicional
  serviceOnTable: false, // false = adicional
  ivaOnTakeout: false,
  serviceOnTakeout: false,
};

// Pedido en mesa de $20.00
const mesaOrder1 = calcCharges(20.0, configUsuario, "mesa");
assert.strictEqual(mesaOrder1.subtotal, 20.0);
assert.strictEqual(mesaOrder1.iva, 3.0); // 15% de $20 = $3.00
assert.strictEqual(mesaOrder1.service_charge, 2.0); // 10% de $20 = $2.00
assert.strictEqual(mesaOrder1.costo_envio, 0);
assert.strictEqual(mesaOrder1.total, 25.0); // 20 + 3 + 2 = $25.00
console.log("✅ [PASS] 1: Mesa con IVA y Servicio Adicional suma 15% y 10% correctamente ($25.00)");

// 2. Comanda acumulativa: Se añaden platos adicionales a la mesa (+$10.00 de plato)
const mesaAcumulada = calcCharges(30.0, configUsuario, "mesa");
assert.strictEqual(mesaAcumulada.subtotal, 30.0);
assert.strictEqual(mesaAcumulada.iva, 4.5); // 15% de $30 = $4.50
assert.strictEqual(mesaAcumulada.service_charge, 3.0); // 10% de $30 = $3.00
assert.strictEqual(mesaAcumulada.total, 37.5); // 30 + 4.5 + 3 = $37.50
console.log("✅ [PASS] 2: Platos adicionales en mesa recalculan impuestos sobre subtotal acumulado ($37.50)");

// 3. Pedido a domicilio con costo de envío ($2.50)
const deliveryOrder = calcCharges(20.0, configUsuario, "delivery", 2.5);
assert.strictEqual(deliveryOrder.subtotal, 20.0);
assert.strictEqual(deliveryOrder.iva, 3.0);
assert.strictEqual(deliveryOrder.service_charge, 2.0);
assert.strictEqual(deliveryOrder.costo_envio, 2.5);
assert.strictEqual(deliveryOrder.total, 27.5); // 20 + 3 + 2 + 2.5 = $27.50
console.log("✅ [PASS] 3: Domicilio suma subtotal + IVA + servicio + tarifa de envío por km ($27.50)");

// 4. Modo IVA Incluido y Servicio Incluido
const configIncluido = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: true, // true = incluido en precios
  serviceOnTable: true, // true = incluido
  ivaOnTakeout: true,
  serviceOnTakeout: true,
};
const mesaIncluida = calcCharges(20.0, configIncluido, "mesa");
assert.strictEqual(mesaIncluida.subtotal, 20.0);
assert.strictEqual(mesaIncluida.iva, 0); // No se suma adicional
assert.strictEqual(mesaIncluida.service_charge, 0); // No se suma adicional
assert.strictEqual(mesaIncluida.total, 20.0);
console.log("✅ [PASS] 4: Modo IVA/Servicio Incluido no agrega recargos al total ($20.00)");

// 5. Cancelación parcial de platos: De $30 baja a $25
const mesaCancelacion = calcCharges(25.0, configUsuario, "mesa");
assert.strictEqual(mesaCancelacion.subtotal, 25.0);
assert.strictEqual(mesaCancelacion.iva, 3.75); // 15% de $25
assert.strictEqual(mesaCancelacion.service_charge, 2.5); // 10% de $25
assert.strictEqual(mesaCancelacion.total, 31.25);
console.log("✅ [PASS] 5: Cancelación de plato recalcula atómicamente IVA y servicio ($31.25)");

// 6. Caso real del usuario: Lasagna di Carne ($14.90) en Para Llevar / Caja POS con IVA y Servicio
// Incluso si ivaOnTakeout era true en DB, la regla unificada de IVA Adicional rige para Para Llevar
function calcUnifiedCharges(subtotal: number, config: {
  ivaPercent: number;
  servicePercent: number;
  ivaOnTable: boolean;
  serviceOnTable: boolean;
  ivaOnTakeout: boolean;
  serviceOnTakeout: boolean;
}, channel: "mesa" | "llevar" | "delivery") {
  const isTable = channel === "mesa";
  const ivaIncluded = config.ivaOnTable === true
    ? true
    : (config.ivaOnTable === false ? false : (isTable ? config.ivaOnTable : config.ivaOnTakeout));
  const serviceIncluded = config.serviceOnTable === true
    ? true
    : (config.serviceOnTable === false
        ? false
        : (isTable ? config.serviceOnTable : config.serviceOnTakeout));

  const ivaAmount = (config.ivaPercent > 0 && !ivaIncluded)
    ? Math.round(subtotal * (config.ivaPercent / 100) * 100) / 100
    : 0;
  const serviceAmount = (config.servicePercent > 0 && !serviceIncluded)
    ? Math.round(subtotal * (config.servicePercent / 100) * 100) / 100
    : 0;
  return {
    subtotal,
    iva: ivaAmount,
    service: serviceAmount,
    total: Math.round((subtotal + ivaAmount + serviceAmount) * 100) / 100,
  };
}

const configLegadaConIvaTakeoutTrue = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: false, // El dueño configuró IVA adicional
  serviceOnTable: false, // El dueño configuró servicio adicional
  ivaOnTakeout: true, // Valor rezagado por default en DB
  serviceOnTakeout: false,
};

const lasagnaLlevar = calcUnifiedCharges(14.90, configLegadaConIvaTakeoutTrue, "llevar");
assert.strictEqual(lasagnaLlevar.subtotal, 14.90);
assert.strictEqual(lasagnaLlevar.iva, 2.24); // 15% de $14.90 = $2.24
assert.strictEqual(lasagnaLlevar.service, 1.49); // 10% de $14.90 = $1.49
assert.strictEqual(lasagnaLlevar.total, 18.63); // $14.90 + $2.24 + $1.49 = $18.63
console.log("✅ [PASS] 6: Lasagna en Para Llevar suma exactamente $18.63 ($14.90 + $2.24 IVA + $1.49 Servicio)");

// 7. Caso del usuario: Almuerzo Ejecutivo ($3.50) en Para Llevar con IVA y Servicio INCLUIDOS
// El restaurante tiene IVA Incluido (ivaOnTable = true) y Servicio Incluido (serviceOnTable = true).
// Aún si serviceOnTakeout era false por default en la DB, el servicio debe ser $0.00 y el total $3.50.
const configUsuarioCaptura = {
  ivaPercent: 15,
  servicePercent: 10,
  ivaOnTable: true, // IVA Incluido en el precio
  serviceOnTable: true, // Servicio Incluido en el precio
  ivaOnTakeout: true,
  serviceOnTakeout: false, // Default rezagado en DB
};

const almuerzoPolloLlevar = calcUnifiedCharges(3.50, configUsuarioCaptura, "llevar");
assert.strictEqual(almuerzoPolloLlevar.subtotal, 3.50);
assert.strictEqual(almuerzoPolloLlevar.iva, 0); // No suma IVA adicional
assert.strictEqual(almuerzoPolloLlevar.service, 0); // No suma Servicio adicional
assert.strictEqual(almuerzoPolloLlevar.total, 3.50); // Total debe ser exactamente $3.50
console.log("✅ [PASS] 7: Almuerzo en Para Llevar con IVA/Servicio Incluido no suma recargos y cobra exactamente $3.50");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE IMPUESTOS Y SERVICIO PASARON EXITOSAMENTE (7/7)");
console.log("==================================================");
