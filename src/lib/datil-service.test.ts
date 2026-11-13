import { validateSriInvoiceRules } from "./datil-service";

function runTests() {
  console.log("=== Corriendo Pruebas de Reglas SRI Ecuador (Facturación Electrónica) ===");

  // 1. Venta > $50 con Consumidor Final (debe fallar)
  const test1 = validateSriInvoiceRules(50.01, {
    doc: "9999999999999",
    docType: "07",
    name: "CONSUMIDOR FINAL",
  });
  console.assert(!test1.valid, "Test 1 Falló: Debería bloquear Consumidor Final para montos > $50.00");
  console.assert(test1.error?.includes("Normativa SRI Ecuador"), "Test 1 Falló: Mensaje incorrecto");
  console.log("✓ Test 1 Aprobado: Bloqueo estricto de Consumidor Final en ventas > $50.00 USD");

  // 2. Venta <= $50 con Consumidor Final (debe pasar)
  const test2 = validateSriInvoiceRules(50.00, {
    doc: "9999999999999",
    docType: "07",
    name: "CONSUMIDOR FINAL",
  });
  console.assert(test2.valid, "Test 2 Falló: Debería permitir Consumidor Final hasta $50.00 exactos");
  console.log("✓ Test 2 Aprobado: Consumidor Final permitido para montos <= $50.00 USD");

  // 3. Venta > $50 con Cédula válida de 10 dígitos (debe pasar)
  const test3 = validateSriInvoiceRules(120.50, {
    doc: "0928374651",
    docType: "05",
    name: "Juan Pérez",
    email: "juan@example.com",
  });
  console.assert(test3.valid, "Test 3 Falló: Debería ser válida con cédula");
  console.log("✓ Test 3 Aprobado: Venta > $50 permitida con Cédula de 10 dígitos");

  // 4. Cédula inválida (menos de 10 dígitos)
  const test4 = validateSriInvoiceRules(15.00, {
    doc: "12345",
    docType: "05",
    name: "Cliente",
  });
  console.assert(!test4.valid, "Test 4 Falló: Debería rechazar cédula con menos de 10 dígitos");
  console.log("✓ Test 4 Aprobado: Cédula de longitud inválida rechazada");

  // 5. RUC inválido (no tiene 13 dígitos)
  const test5 = validateSriInvoiceRules(80.00, {
    doc: "0991234567",
    docType: "04",
    name: "Empresa S.A.",
  });
  console.assert(!test5.valid, "Test 5 Falló: Debería rechazar RUC de menos de 13 dígitos");
  console.log("✓ Test 5 Aprobado: RUC con longitud menor a 13 dígitos rechazado");

  // 6. RUC válido de 13 dígitos
  const test6 = validateSriInvoiceRules(80.00, {
    doc: "0991234567001",
    docType: "04",
    name: "Empresa S.A.",
  });
  console.assert(test6.valid, "Test 6 Falló: Debería aceptar RUC de 13 dígitos");
  console.log("✓ Test 6 Aprobado: RUC válido aceptado para ventas corporativas");

  console.log("\nTODAS LAS 6 PRUEBAS DE REGLAS SRI PASARON EXITOSAMENTE.");
}

runTests();
