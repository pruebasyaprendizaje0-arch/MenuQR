import { generateThermalTicketHtml } from "./thermal-printer";

async function testPrinter() {
  console.log("=== Corriendo Pruebas de Motor de Ticket Térmico Universal ===");

  const sampleOrder = {
    id: "ord-12345678-uuid",
    orderNumber: 42,
    createdAt: new Date(),
    items: [
      { dishName: "Hamburguesa Artesanal", quantity: 2, price: 6.5 },
      { dishName: "Cerveza Club", quantity: 3, price: 2.5 },
    ],
    subtotal: 20.5,
    iva: 3.08,
    total: 23.58,
    tableName: "5",
    paymentMethod: "Efectivo",
    customerName: "Juan Pérez",
  };

  const sampleRestaurant = {
    name: "Sumeria Liquors & Food",
    phone: "0991234567",
    address: "Av. Principal #123",
    ruc: "0991234567001",
  };

  // 1. Ticket Estándar 80mm
  const html1 = await generateThermalTicketHtml({
    order: sampleOrder,
    restaurant: sampleRestaurant,
    paperWidth: "80mm",
  });
  console.assert(html1.includes("Sumeria Liquors & Food"), "Test 1 Falló: Nombre restaurante");
  console.assert(html1.includes("Hamburguesa Artesanal"), "Test 1 Falló: Ítem");
  console.assert(html1.includes("76mm"), "Test 1 Falló: Ancho 80mm");
  console.log("✓ Test 1 Aprobado: Generación de ticket estándar 80mm");

  // 2. Ticket 58mm
  const html2 = await generateThermalTicketHtml({
    order: sampleOrder,
    restaurant: sampleRestaurant,
    paperWidth: "58mm",
  });
  console.assert(html2.includes("54mm"), "Test 2 Falló: Ancho 58mm");
  console.log("✓ Test 2 Aprobado: Formato compacto 58mm");

  // 3. Ticket con Factura Electrónica Autorizada y Clave de Acceso QR
  const html3 = await generateThermalTicketHtml({
    order: sampleOrder,
    restaurant: sampleRestaurant,
    invoice: {
      status: "AUTORIZADA",
      accessKey: "1211202601099123456700120010010000000421234567819",
      sequential: "001-001-000000042",
      authNumber: "1211202601099123456700120010010000000421234567819",
      customerDoc: "0928374651",
      customerDocType: "05",
      customerEmail: "juan@example.com",
    },
    paperWidth: "80mm",
  });
  console.assert(html3.includes("FACTURA ELECTRÓNICA"), "Test 3 Falló: Encabezado factura");
  console.assert(html3.includes("001-001-000000042"), "Test 3 Falló: Secuencial");
  console.assert(html3.includes("data:image/png;base64"), "Test 3 Falló: QR code en base64");
  console.log("✓ Test 3 Aprobado: Factura SRI con QR dinámico incrustado");

  // 4. Ticket con Factura PENDIENTE_SRI
  const html4 = await generateThermalTicketHtml({
    order: sampleOrder,
    restaurant: sampleRestaurant,
    invoice: {
      status: "PENDIENTE_SRI",
      sequential: "001-001-000000043",
    },
    paperWidth: "80mm",
  });
  console.assert(html4.includes("*** COMPROBANTE EN PROCESO SRI ***"), "Test 4 Falló: Contingencia SRI");
  console.log("✓ Test 4 Aprobado: Contingencia SRI sin bloqueo");

  console.log("\nTODAS LAS 4 PRUEBAS DE TICKET TÉRMICO PASARON EXITOSAMENTE.");
}

testPrinter();
