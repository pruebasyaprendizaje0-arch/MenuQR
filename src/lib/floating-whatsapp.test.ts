import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { formatWhatsappPhone } from "../components/public/FloatingWhatsAppButton";

console.log("==========================================");
console.log("🧪 TESTING FLOATING WHATSAPP BUTTON ACROSS ALL PROFILES");
console.log("==========================================");

// 1. Phone number normalization unit tests
assert.strictEqual(formatWhatsappPhone("0999999999"), "593999999999", "Debe transformar 09XXXXXXXX a 5939XXXXXXXX");
assert.strictEqual(formatWhatsappPhone("999999999"), "593999999999", "Debe transformar 9XXXXXXXX a 5939XXXXXXXX");
assert.strictEqual(formatWhatsappPhone("593999999999"), "593999999999", "Debe preservar números ya formateados con 593");
assert.strictEqual(formatWhatsappPhone("+593 99-999-9999"), "593999999999", "Debe limpiar símbolos y espacios");
assert.strictEqual(formatWhatsappPhone("042123456"), "59342123456", "Debe transformar fijos con 0 inicial a 593");
assert.strictEqual(formatWhatsappPhone(""), "", "Debe retornar vacío si no hay teléfono");
assert.strictEqual(formatWhatsappPhone(null), "", "Debe retornar vacío si es null");
console.log("✅ [PASS] Normalización de números telefónicos nacional e internacional verificada");

const projectRoot = process.cwd();

// 2. Verify Restaurant Menus & Profiles (MenuClient.tsx)
const menuClientPath = path.join(projectRoot, "src/app/[slug]/components/MenuClient.tsx");
const menuClientCode = fs.readFileSync(menuClientPath, "utf-8");
assert(menuClientCode.includes("<FloatingWhatsAppButton"), "MenuClient debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Menús y Perfiles de Restaurantes: Botón flotante de WhatsApp activo");

// 3. Verify Single Dish / Product Detail Page ([dishSlug]/page.tsx)
const dishPagePath = path.join(projectRoot, "src/app/[slug]/[dishSlug]/page.tsx");
const dishPageCode = fs.readFileSync(dishPagePath, "utf-8");
assert(dishPageCode.includes("<FloatingWhatsAppButton"), "[dishSlug]/page.tsx debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Páginas de Plato / Producto Individual: Botón flotante de WhatsApp activo");

// 4. Verify Retail Stores & Catalogs (CtaloClient.tsx)
const ctaloClientPath = path.join(projectRoot, "src/app/(verticales)/ctalo/[slug]/components/CtaloClient.tsx");
const ctaloClientCode = fs.readFileSync(ctaloClientPath, "utf-8");
assert(ctaloClientCode.includes("<FloatingWhatsAppButton"), "CtaloClient debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Catálogos de Tiendas y Retail: Botón flotante de WhatsApp activo");

// 5. Verify Lodging & Reservations (ReservasClient.tsx)
const reservasClientPath = path.join(projectRoot, "src/app/(verticales)/reservas/[slug]/components/ReservasClient.tsx");
const reservasClientCode = fs.readFileSync(reservasClientPath, "utf-8");
assert(reservasClientCode.includes("<FloatingWhatsAppButton"), "ReservasClient debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Hospedaje y Cabañas: Botón flotante de WhatsApp activo");

// 6. Verify Appointments & Clinics (CitasClient.tsx)
const citasClientPath = path.join(projectRoot, "src/app/(verticales)/citas/[slug]/components/CitasClient.tsx");
const citasClientCode = fs.readFileSync(citasClientPath, "utf-8");
assert(citasClientCode.includes("<FloatingWhatsAppButton"), "CitasClient debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Citas y Salud: Botón flotante de WhatsApp activo");

// 7. Verify Technical Services & Quotes (ServiciosClient.tsx)
const serviciosClientPath = path.join(projectRoot, "src/app/(verticales)/servicios/[slug]/components/ServiciosClient.tsx");
const serviciosClientCode = fs.readFileSync(serviciosClientPath, "utf-8");
assert(serviciosClientCode.includes("<FloatingWhatsAppButton"), "ServiciosClient debe renderizar FloatingWhatsAppButton");
console.log("✅ [PASS] Servicios Técnicos y Cotizaciones: Botón flotante de WhatsApp activo");

console.log("==========================================");
console.log("🎉 ALL FLOATING WHATSAPP TESTS PASSED");
console.log("==========================================");
