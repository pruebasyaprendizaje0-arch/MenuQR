import assert from "node:assert";
import {
  signStaffToken,
  verifyStaffToken,
  StaffRole,
} from "./jwt";
import {
  checkRoleCanTransitionOrder,
  checkRoleCanDeleteOrder,
  verifyOrderStaffAuth,
} from "./order-auth";
import { NextRequest } from "next/server";

console.log("🔒 INICIANDO PRUEBAS DE AUTORIZACIÓN Y AISLAMIENTO DE PEDIDOS EN SERVIDOR");

async function runOrderAuthorizationSuite() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res && typeof (res as Promise<void>).then === "function") {
        return (res as Promise<void>).then(() => {
          passed++;
          console.log(`  ✅ [PASS] ${name}`);
        });
      } else {
        passed++;
        console.log(`  ✅ [PASS] ${name}`);
      }
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err);
      throw err;
    }
  }

  const negocioA = "11111111-1111-4111-a111-111111111111";
  const negocioB = "22222222-2222-4222-b222-222222222222";

  // 1. Criptografía y emisión de tokens de personal
  await test("Generación y verificación de token firmado de Cocina", () => {
    const token = signStaffToken({
      role: "COCINA",
      negocioId: negocioA,
    });
    assert(typeof token === "string" && token.length > 20, "Token debe ser un JWT no vacío");

    const decoded = verifyStaffToken(token);
    assert(decoded !== null, "Token debe decodificarse exitosamente");
    assert.strictEqual(decoded.role, "COCINA");
    assert.strictEqual(decoded.negocioId, negocioA);
    assert.strictEqual(decoded.purpose, "staff_session");
  });

  await test("Generación y verificación de token firmado de Mesero", () => {
    const token = signStaffToken({
      role: "MESERO",
      negocioId: negocioA,
      staffId: "mesero-42",
      staffNombre: "Carlos Mesero",
    });

    const decoded = verifyStaffToken(token);
    assert(decoded !== null, "Token de mesero debe decodificarse");
    assert.strictEqual(decoded.role, "MESERO");
    assert.strictEqual(decoded.negocioId, negocioA);
    assert.strictEqual(decoded.staffId, "mesero-42");
    assert.strictEqual(decoded.staffNombre, "Carlos Mesero");
  });

  await test("Rechazo de tokens adulterados o inválidos", () => {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
    const decoded = verifyStaffToken(fakeToken);
    assert.strictEqual(decoded, null, "Token falsificado debe ser nulo");
  });

  // 2. Matriz de permisos de transición de estados por Rol
  await test("Cocina PUEDE cambiar estados operacionales: 'en_cocina' y 'listo'", () => {
    const check1 = checkRoleCanTransitionOrder("COCINA", "en_cocina");
    assert.strictEqual(check1.allowed, true);

    const check2 = checkRoleCanTransitionOrder("COCINA", "listo");
    assert.strictEqual(check2.allowed, true);
  });

  await test("Cocina NO PUEDE cobrar pedidos ('pagado' o 'por_pagar')", () => {
    const checkPagado = checkRoleCanTransitionOrder("COCINA", "pagado");
    assert.strictEqual(checkPagado.allowed, false, "Cocina no debe poder marcar como pagado");
    assert(checkPagado.error?.includes("Cocina no tiene permisos"), "Debe devolver mensaje claro");

    const checkPorPagar = checkRoleCanTransitionOrder("COCINA", "por_pagar");
    assert.strictEqual(checkPorPagar.allowed, false, "Cocina no debe poder marcar por pagar");
  });

  await test("Cocina NO PUEDE anular ni resetear pedidos ('cancelado' o 'nuevo')", () => {
    const checkCancelado = checkRoleCanTransitionOrder("COCINA", "cancelado");
    assert.strictEqual(checkCancelado.allowed, false, "Cocina no debe poder cancelar");

    const checkNuevo = checkRoleCanTransitionOrder("COCINA", "nuevo");
    assert.strictEqual(checkNuevo.allowed, false, "Cocina no debe poder resetear a nuevo");
  });

  await test("Cocina NO PUEDE anular/eliminar pedidos completos (DELETE)", () => {
    const deleteCheck = checkRoleCanDeleteOrder("COCINA");
    assert.strictEqual(deleteCheck.allowed, false, "DELETE debe ser denegado a Cocina");
    assert(deleteCheck.error?.includes("Cocina no tiene permisos"), "Error explicativo de permiso");
  });

  await test("Mesero, Administrador y Superadmin SÍ pueden cobrar, transicionar y anular", () => {
    const roles: StaffRole[] = ["MESERO", "CAJERO", "ADMIN", "SUPERADMIN"];
    const estados = ["en_cocina", "listo", "por_pagar", "pagado", "cancelado"];

    for (const r of roles) {
      for (const e of estados) {
        const transCheck = checkRoleCanTransitionOrder(r, e);
        assert.strictEqual(transCheck.allowed, true, `Rol ${r} debe poder transicionar a ${e}`);
      }
      const delCheck = checkRoleCanDeleteOrder(r);
      assert.strictEqual(delCheck.allowed, true, `Rol ${r} debe poder eliminar pedidos`);
    }
  });

  // 3. Verificación de autorización en el servidor y aislamiento multi-tenant
  await test("Petición sin credenciales es rechazada con 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/pedidos?negocio_id=" + negocioA);
    const auth = await verifyOrderStaffAuth(req, negocioA);

    assert.strictEqual(auth.authorized, false, "Sin credenciales no debe estar autorizado");
    assert.strictEqual(auth.status, 401, "Código de respuesta debe ser 401");
    assert(auth.error?.includes("Acceso no autorizado"), "Mensaje de no autorización presente");
  });

  await test("Petición con token de Cocina en Header Bearer para el mismo negocio es ACEPTADA (200)", async () => {
    const token = signStaffToken({ role: "COCINA", negocioId: negocioA });
    const req = new NextRequest("http://localhost:3000/api/pedidos?negocio_id=" + negocioA, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const auth = await verifyOrderStaffAuth(req, negocioA);
    assert.strictEqual(auth.authorized, true, "Cocina autorizada para su negocio");
    assert.strictEqual(auth.role, "COCINA");
    assert.strictEqual(auth.negocioId, negocioA);
  });

  await test("Petición con token de Mesero en Header x-staff-token para el mismo negocio es ACEPTADA", async () => {
    const token = signStaffToken({
      role: "MESERO",
      negocioId: negocioA,
      staffId: "mes-1",
      staffNombre: "María",
    });
    const req = new NextRequest("http://localhost:3000/api/pedidos?negocio_id=" + negocioA, {
      headers: {
        "x-staff-token": token,
      },
    });

    const auth = await verifyOrderStaffAuth(req, negocioA);
    assert.strictEqual(auth.authorized, true);
    assert.strictEqual(auth.role, "MESERO");
    assert.strictEqual(auth.negocioId, negocioA);
    assert.strictEqual(auth.staffNombre, "María");
  });

  await test("Aislamiento Multi-Tenant: Token de Negocio A intentando operar en Negocio B es RECHAZADO con 403 Forbidden", async () => {
    // Mesero autenticado en Negocio A
    const tokenA = signStaffToken({ role: "MESERO", negocioId: negocioA });

    // Intenta consultar o modificar Negocio B
    const req = new NextRequest("http://localhost:3000/api/pedidos?negocio_id=" + negocioB, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    const auth = await verifyOrderStaffAuth(req, negocioB);
    assert.strictEqual(auth.authorized, false, "Debe rechazar acceso a negocio ajeno");
    assert.strictEqual(auth.status, 403, "Código debe ser 403 Forbidden");
    assert(auth.error?.includes("negocio ajeno"), "Mensaje debe indicar prohibición por negocio ajeno");
  });

  await test("Aislamiento Multi-Tenant: Token de Cocina de Negocio B intentando operar en Negocio A es RECHAZADO con 403 Forbidden", async () => {
    const tokenB = signStaffToken({ role: "COCINA", negocioId: negocioB });

    const req = new NextRequest("http://localhost:3000/api/pedidos/" + "order-123", {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    const auth = await verifyOrderStaffAuth(req, negocioA);
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.status, 403);
  });

  await test("Soporte de cookies de sesión de personal (staff_session / cocina_session)", async () => {
    const token = signStaffToken({ role: "COCINA", negocioId: negocioA });
    const req = new NextRequest("http://localhost:3000/api/pedidos?negocio_id=" + negocioA, {
      headers: {
        cookie: `staff_session=${token}`,
      },
    });

    const auth = await verifyOrderStaffAuth(req, negocioA);
    assert.strictEqual(auth.authorized, true);
    assert.strictEqual(auth.role, "COCINA");
    assert.strictEqual(auth.negocioId, negocioA);
  });

  console.log(`\n🎉 TODAS LAS PRUEBAS DE AUTORIZACIÓN DE PEDIDOS PASARON EXITOSAMENTE (${passed}/${total})\n`);
}

runOrderAuthorizationSuite().catch((err) => {
  console.error("FATAL ERROR EN PRUEBAS DE AUTORIZACIÓN:", err);
  process.exit(1);
});
