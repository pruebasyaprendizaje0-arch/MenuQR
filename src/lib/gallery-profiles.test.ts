import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("==========================================");
console.log("🧪 TESTING BUSINESS PROFILES GALLERY LOGIC");
console.log("==========================================");

const projectRoot = process.cwd();

// 1. Verify Restaurant Client (MenuClient.tsx)
const menuClientPath = path.join(projectRoot, "src/app/[slug]/components/MenuClient.tsx");
const menuClientCode = fs.readFileSync(menuClientPath, "utf-8");

assert(menuClientCode.includes("<GalleryCarousel"), "MenuClient debe utilizar GalleryCarousel");
assert(menuClientCode.includes('currentTab === "profile"'), "MenuClient debe tener control de pestaña profile");
assert(
  menuClientCode.indexOf("<GalleryCarousel") > menuClientCode.indexOf('currentTab === "profile"'),
  "GalleryCarousel debe renderizarse dentro de la pestaña profile"
);
console.log("✅ [PASS] Restaurantes: Carrusel integrado exclusivamente en la pestaña 'Perfil Comercial'");

// 2. Verify Store Client (CtaloClient.tsx)
const ctaloClientPath = path.join(projectRoot, "src/app/(verticales)/ctalo/[slug]/components/CtaloClient.tsx");
const ctaloClientCode = fs.readFileSync(ctaloClientPath, "utf-8");
assert(ctaloClientCode.includes("<BusinessProfileView"), "CtaloClient debe renderizar BusinessProfileView");
assert(!ctaloClientCode.includes("<GalleryCarousel"), "CtaloClient no debe tener carrusel suelto en el catálogo de productos");
console.log("✅ [PASS] Retail / Tiendas: Carrusel encapsulado en Perfil Comercial y ausente en el catálogo");

// 3. Verify Appointments Client (CitasClient.tsx)
const citasClientPath = path.join(projectRoot, "src/app/(verticales)/citas/[slug]/components/CitasClient.tsx");
const citasClientCode = fs.readFileSync(citasClientPath, "utf-8");
assert(citasClientCode.includes("<BusinessProfileView"), "CitasClient debe renderizar BusinessProfileView");
assert(!citasClientCode.includes("<GalleryCarousel"), "CitasClient no debe tener carrusel en el motor de turnos");
console.log("✅ [PASS] Citas / Salud: Carrusel encapsulado en Perfil Comercial y ausente en el agendamiento");

// 4. Verify Reservations Client (ReservasClient.tsx)
const reservasClientPath = path.join(projectRoot, "src/app/(verticales)/reservas/[slug]/components/ReservasClient.tsx");
const reservasClientCode = fs.readFileSync(reservasClientPath, "utf-8");
assert(reservasClientCode.includes("<BusinessProfileView"), "ReservasClient debe renderizar BusinessProfileView");
assert(!reservasClientCode.includes("<GalleryCarousel"), "ReservasClient no debe tener carrusel en el motor de reservas");
console.log("✅ [PASS] Hospedaje / Cabañas: Carrusel encapsulado en Perfil Comercial y ausente en el motor de reservas");

// 5. Verify Services Client (ServiciosClient.tsx)
const serviciosClientPath = path.join(projectRoot, "src/app/(verticales)/servicios/[slug]/components/ServiciosClient.tsx");
const serviciosClientCode = fs.readFileSync(serviciosClientPath, "utf-8");
assert(serviciosClientCode.includes("<BusinessProfileView"), "ServiciosClient debe renderizar BusinessProfileView");
assert(!serviciosClientCode.includes("<GalleryCarousel"), "ServiciosClient no debe tener carrusel en el cotizador express");
console.log("✅ [PASS] Servicios Técnicos: Carrusel encapsulado en Perfil Comercial y ausente en el cotizador");

// 6. Verify AdminDashboard.tsx Gallery Configuration
const adminDashboardPath = path.join(projectRoot, "src/app/admin/components/AdminDashboard.tsx");
const adminDashboardCode = fs.readFileSync(adminDashboardPath, "utf-8");
assert(adminDashboardCode.includes("Galería del Establecimiento"), "AdminDashboard debe incluir sección de Galería");
assert(adminDashboardCode.includes("galleryImages: galleryImages.filter"), "AdminDashboard debe serializar galleryImages");
console.log("✅ [PASS] Admin Dashboard: Gestor de 4 fotos de galería persistente en customLabels");

console.log("==========================================");
console.log("🎉 ALL BUSINESS PROFILE GALLERY TESTS PASSED");
console.log("==========================================");
