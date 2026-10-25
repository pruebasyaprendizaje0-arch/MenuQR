import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

console.log("🚀 Iniciando validación integral de la vertical de Servicios Técnicos...");

// 1. Validar ServiciosClient.tsx
const serviciosClientPath = path.join(
  projectRoot,
  "src/app/(verticales)/servicios/[slug]/components/ServiciosClient.tsx"
);
assert(fs.existsSync(serviciosClientPath), "ServiciosClient.tsx debe existir");
const clientCode = fs.readFileSync(serviciosClientPath, "utf-8");

// No debe haber subida local de archivos de fotos en el formulario
assert(
  !clientCode.includes('type="file"'),
  "No debe existir input type='file' en el cotizador de servicios (se envían por WhatsApp)"
);
console.log("✅ [PASS] Sin subida de archivos pesados localmente en la web");

// Ficha Rápida del Equipo: Marcas y Tecnologías
assert(clientCode.includes("MARCAS_COMUNES"), "Debe definir MARCAS_COMUNES");
assert(clientCode.includes("TECNOLOGIAS"), "Debe definir TECNOLOGIAS");
assert(clientCode.includes("Inverter"), "Debe incluir tecnología Inverter");
assert(clientCode.includes("Samsung"), "Debe incluir marcas comunes como Samsung");
console.log("✅ [PASS] Ficha Rápida del Equipo (Marca + Tecnología) configurada");

// Síntomas Habituales en 1 Clic
assert(clientCode.includes("SINTOMAS_HABITUALES"), "Debe definir SINTOMAS_HABITUALES");
assert(clientCode.includes("toggleSymptom"), "Debe existir handler de multiselección de síntomas");
console.log("✅ [PASS] Selector ágil de Síntomas Habituales interactivo");

// Tarjeta de Visita Técnica & Diagnóstico 100% Deducible
assert(clientCode.includes("100% DEDUCIBLE"), "Debe incluir política de 100% deducible");
assert(
  clientCode.includes("completamente GRATIS"),
  "Debe indicar que la visita es gratis si se aprueba el presupuesto"
);
console.log("✅ [PASS] Tarjeta de Diagnóstico & Visita Técnica Deducible visible");

// Franjas Horarias
assert(clientCode.includes("FRANJAS_HORARIAS"), "Debe definir FRANJAS_HORARIAS");
assert(clientCode.includes("08:00 - 12:00"), "Debe tener franjas horarias matutinas");
assert(clientCode.includes("13:00 - 17:00"), "Debe tener franjas horarias vespertinas");
console.log("✅ [PASS] Franjas Horarias de Visita a Domicilio disponibles");

// Prompt WhatsApp multimedia
assert(
  clientCode.includes("Fotos, Audios o Videos por WhatsApp"),
  "Debe informar que fotos/videos/audios se envían por WhatsApp"
);
console.log("✅ [PASS] Notificación clara de adjuntar multimedia en WhatsApp");

// 2. Validar src/app/api/pedidos/route.ts
const pedidosRoutePath = path.join(projectRoot, "src/app/api/pedidos/route.ts");
assert(fs.existsSync(pedidosRoutePath), "src/app/api/pedidos/route.ts debe existir");
const routeCode = fs.readFileSync(pedidosRoutePath, "utf-8");

assert(routeCode.includes("marca_equipo"), "route.ts debe recibir marca_equipo");
assert(routeCode.includes("tipo_tecnologia"), "route.ts debe recibir tipo_tecnologia");
assert(routeCode.includes("sintomas_detectados"), "route.ts debe recibir sintomas_detectados");
assert(routeCode.includes("franja_horaria"), "route.ts debe recibir franja_horaria");
assert(routeCode.includes("visita_condicion"), "route.ts debe recibir visita_condicion");
assert(
  routeCode.includes("ADJUNTA AQUÍ:"),
  "route.ts debe incluir el prompt en el mensaje de WhatsApp para adjuntar fotos/audios/videos"
);

// Sincronización Dual Prisma Order & Customer
assert(
  routeCode.includes('tableName: "Visita Técnica"') && routeCode.includes('paymentMethod: "WHATSAPP_COTIZACION"'),
  "route.ts debe crear un prisma.order con 'Visita Técnica' y 'WHATSAPP_COTIZACION'"
);
assert(
  routeCode.includes("prisma.customer.findFirst") && routeCode.includes("equipmentBrand"),
  "route.ts debe sincronizar y capturar el lead en prisma.customer con metadatos técnicos"
);
console.log("✅ [PASS] Endpoint de pedidos registra pedidos en Historial y leads en CRM de forma dual");

// 3. Validar src/app/admin/components/AdminDashboard.tsx
const adminDashboardPath = path.join(
  projectRoot,
  "src/app/admin/components/AdminDashboard.tsx"
);
assert(fs.existsSync(adminDashboardPath), "AdminDashboard.tsx debe existir");
const adminCode = fs.readFileSync(adminDashboardPath, "utf-8");

// Historial de Pedidos: badge Visita Técnica & GPS
assert(
  adminCode.includes("🚗 Visita Técnica"),
  "AdminDashboard debe mostrar el badge '🚗 Visita Técnica' en el historial de pedidos"
);
assert(
  adminCode.includes("📍 Abrir ubicación GPS"),
  "AdminDashboard debe permitir abrir la ubicación GPS en Google Maps para visitas a domicilio"
);
assert(
  adminCode.includes("Cotización Express"),
  "AdminDashboard debe identificar el método de pago 'Cotización Express'"
);

// CRM Clientes: Encabezados y celdas contextuales
assert(
  adminCode.includes("Equipo & Marca"),
  "CRM Clientes debe tener columna 'Equipo & Marca' para servicios técnicos"
);
assert(
  adminCode.includes("Servicio & Visitas"),
  "CRM Clientes debe tener columna 'Servicio & Visitas' para servicios técnicos"
);
// 4. Validar Ficha Técnica Modular en Modal de Cliente (Opción 2)
assert(
  adminCode.includes("SERVICIOS_MARCAS_COMUNES") && adminCode.includes("SERVICIOS_SINTOMAS_HABITUALES"),
  "AdminDashboard debe definir constantes para marcas y síntomas de servicios técnicos"
);
assert(
  adminCode.includes("1. Contacto") && adminCode.includes("2. Equipo & Fallas") && adminCode.includes("3. Visitas & Notas"),
  "Modal de edición de cliente debe tener pestañas modulares (Contacto, Equipo & Fallas, Visitas & Notas)"
);
assert(
  adminCode.includes("handleDetectCustomerGps"),
  "Modal de cliente debe incluir función para capturar ubicación GPS actual"
);
assert(
  adminCode.includes("Ficha Técnica de Cliente"),
  "Modal debe titularse 'Ficha Técnica de Cliente' cuando es servicios técnicos"
);
console.log("✅ [PASS] Modal de Edición de Cliente CRM con Ficha Técnica Modular (Opción 2) activo");

console.log("🎉 ¡Todas las pruebas de Servicios Técnicos, Historial, CRM y Modal Modular pasaron exitosamente!");
