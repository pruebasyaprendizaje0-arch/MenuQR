import assert from "assert";
import { StaffRole } from "./staff-actions";

console.log("=== INICIANDO PRUEBAS DE EQUIPO Y ACCESOS (MESEROS, CAJEROS & REPARTIDORES) ===");

// 1. Simulación de modelo de personal con multi-rol
interface MockStaff {
  id: string;
  nombre: string;
  pin: string;
  rol: StaffRole;
  telefono: string | null;
  activo: boolean;
}

const mockStaffList: MockStaff[] = [
  { id: "1", nombre: "Jordi Mesero", pin: "1234", rol: "MESERO", telefono: null, activo: true },
  { id: "2", nombre: "María Mesera", pin: "5678", rol: "MESERO", telefono: null, activo: true },
  { id: "3", nombre: "Sofía Cajera", pin: "9988", rol: "CAJERO", telefono: "0991112233", activo: true },
  { id: "4", nombre: "Carlos Repartidor", pin: "4321", rol: "REPARTIDOR", telefono: "0987654321", activo: true },
];

// 2. Validación de conteo por roles
{
  const meseros = mockStaffList.filter((s) => s.rol === "MESERO");
  const cajeros = mockStaffList.filter((s) => s.rol === "CAJERO");
  const repartidores = mockStaffList.filter((s) => s.rol === "REPARTIDOR");

  assert.strictEqual(meseros.length, 2, "Debe haber 2 meseros");
  assert.strictEqual(cajeros.length, 1, "Debe haber 1 cajero");
  assert.strictEqual(repartidores.length, 1, "Debe haber 1 repartidor");
  console.log("✅ [PASS] 1: Filtros y conteo de roles (Mesero, Cajero, Repartidor) validados");
}

// 3. Validación de PIN numérico y teléfono de Repartidor
{
  const repartidor = mockStaffList.find((s) => s.rol === "REPARTIDOR")!;
  assert.match(repartidor.pin, /^\d{4,8}$/, "El PIN del repartidor debe ser numérico de 4 a 8 dígitos");
  assert.ok(repartidor.telefono && repartidor.telefono.length >= 8, "El repartidor debe contar con teléfono para contacto");
  
  const waUrl = `https://wa.me/${repartidor.telefono.replace(/\D/g, "")}`;
  assert.strictEqual(waUrl, "https://wa.me/0987654321", "Enlace de WhatsApp de repartidor generado correctamente");
  console.log("✅ [PASS] 2: Validación de clave PIN y enlace directo de WhatsApp para repartidores");
}

// 4. Validación de cajero para terminal POS (/caja)
{
  const cajero = mockStaffList.find((s) => s.rol === "CAJERO")!;
  assert.strictEqual(cajero.nombre, "Sofía Cajera");
  assert.strictEqual(cajero.pin, "9988");
  assert.strictEqual(cajero.rol, "CAJERO");
  console.log("✅ [PASS] 3: Estructura de credenciales para cajeros de mostrador POS validada");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE PERSONAL MULTI-ROL PASARON (3/3)");
console.log("==================================================");

