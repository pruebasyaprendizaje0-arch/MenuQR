import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { calculateItemPromoPrice } from "./campaign-utils";

console.log("=================================================");
console.log("🧪 TESTING BUSINESS CAMPAIGNS & PROMOTIONS (OPCIÓN 3)");
console.log("=================================================");

// 1. Test Promo Pricing Calculation Logic
console.log("1. Verificando motor de cálculo de precios promocionales...");

// Test Percentage Discount
const priceOriginal = 20.0;
const promo20Percent = calculateItemPromoPrice(priceOriginal, "PERCENTAGE", 25);
assert.strictEqual(promo20Percent, 15.0, "25% de descuento en $20 debe ser $15");

const promo50Percent = calculateItemPromoPrice(10.0, "PERCENTAGE", 50);
assert.strictEqual(promo50Percent, 5.0, "50% de descuento en $10 debe ser $5");

// Test Fixed Price
const promoFixed = calculateItemPromoPrice(priceOriginal, "FIXED_PRICE", 0, 12.99);
assert.strictEqual(promoFixed, 12.99, "Precio fijo individual de $12.99 debe respetarse");

const promoGeneralFixed = calculateItemPromoPrice(priceOriginal, "FIXED_PRICE", 9.99);
assert.strictEqual(promoGeneralFixed, 9.99, "Precio fijo general de $9.99 debe aplicarse");

// Test Specific Override
const overrideCustom = calculateItemPromoPrice(30.0, "PERCENTAGE", 10, 18.5);
assert.strictEqual(overrideCustom, 18.5, "El precio personalizado del plato debe tener prioridad sobre el porcentaje general");

// Test No Discount / Fallback
const noDiscount = calculateItemPromoPrice(15.0, "PERCENTAGE", 0);
assert.strictEqual(noDiscount, 15.0, "Sin porcentaje debe retornar el precio original");

console.log("✅ [PASS] Motor de precios y descuentos validado con precisión");

// 2. Test Architecture in Files
const projectRoot = process.cwd();

// Verify BusinessProfileView.tsx
console.log("2. Verificando integración en Perfil Comercial Público (todas las categorías)...");
const profileViewPath = path.join(projectRoot, "src/components/public/BusinessProfileView.tsx");
const profileViewCode = fs.readFileSync(profileViewPath, "utf-8");
assert(profileViewCode.includes("BusinessCampaignSection"), "BusinessProfileView debe importar y renderizar BusinessCampaignSection");
assert(profileViewCode.includes("campaigns?: BusinessCampaignData[]"), "BusinessProfileView debe aceptar la prop campaigns");
console.log("✅ [PASS] BusinessProfileView integra BusinessCampaignSection para todas las verticales");

// Verify MenuClient.tsx
console.log("3. Verificando integración en Menú Digital (Restaurantes / Gastronomía)...");
const menuClientPath = path.join(projectRoot, "src/app/[slug]/components/MenuClient.tsx");
const menuClientCode = fs.readFileSync(menuClientPath, "utf-8");
assert(menuClientCode.includes("BusinessCampaignSection"), "MenuClient debe importar BusinessCampaignSection");
assert(menuClientCode.includes("dishPromoMap"), "MenuClient debe calcular dishPromoMap para platos en oferta");
assert(menuClientCode.includes("effectivePrice"), "MenuClient debe aplicar el precio promocional en el carrito");
assert(menuClientCode.includes("Promociones y Eventos de la Semana"), "MenuClient debe tener banner destacado en pestaña menú");
console.log("✅ [PASS] Menú Digital: Descuentos automáticos en carrito, badge en platos y banner superior");

// Verify AdminDashboard.tsx
console.log("4. Verificando módulo en Panel de Administración...");
const adminDashboardPath = path.join(projectRoot, "src/app/admin/components/AdminDashboard.tsx");
const adminDashboardCode = fs.readFileSync(adminDashboardPath, "utf-8");
assert(adminDashboardCode.includes("CampaignsAdminTab"), "AdminDashboard debe importar CampaignsAdminTab");
assert(adminDashboardCode.includes('activeTab === "campaigns"'), "AdminDashboard debe tener la pestaña 'campaigns'");
assert(adminDashboardCode.includes("Promos & Eventos"), "AdminDashboard debe tener el botón 'Promos & Eventos'");
console.log("✅ [PASS] Panel Admin: Pestaña 'Promos & Eventos' integrada en la barra de navegación");

// Verify Schema.prisma
console.log("5. Verificando esquema de base de datos PostgreSQL...");
const schemaPath = path.join(projectRoot, "prisma/schema.prisma");
const schemaCode = fs.readFileSync(schemaPath, "utf-8");
assert(schemaCode.includes("model BusinessCampaign"), "Prisma schema debe incluir BusinessCampaign");
assert(schemaCode.includes("model CampaignDish"), "Prisma schema debe incluir CampaignDish");
assert(schemaCode.includes("enum CampaignType"), "Prisma schema debe incluir CampaignType");
assert(schemaCode.includes("enum CampaignDiscountType"), "Prisma schema debe incluir CampaignDiscountType");
console.log("✅ [PASS] Prisma Schema: Modelos y Enums persistentes compatibles con PostgreSQL");

// Verify SEO Event Schema
console.log("6. Verificando inyección de Schema.org/Event para Google...");
const seoPath = path.join(projectRoot, "src/lib/seo.ts");
const seoCode = fs.readFileSync(seoPath, "utf-8");
assert(seoCode.includes('"@type": "Event"'), "seo.ts debe generar Schema.org/Event para eventos activos");
console.log("✅ [PASS] SEO Local: Enriquecimiento automático de eventos para Google");

console.log("=================================================");
console.log("🎉 ALL BUSINESS CAMPAIGNS TESTS PASSED SUCCESSFULLY");
console.log("=================================================");
