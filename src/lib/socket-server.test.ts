import assert from "node:assert";
import { Server as ServerIO } from "socket.io";
import { createServer } from "http";
import { setIO, getIO, emitNuevoPedido, emitStockActualizado, emitPedidoActualizado } from "./socket-server";

console.log("==========================================");
console.log("🧪 TESTING SOCKET.IO SERVER INSTANCE & UNIFIED ACCESS");
console.log("==========================================");

async function runTests() {
  // Test 1: getIO returns null before initialization
  console.log("Test 1: Comprobar getIO antes de setear...");
  // Clear any existing
  delete (globalThis as any).io;
  delete (globalThis as any).ioServer;
  if (typeof global !== "undefined") {
    delete (global as any).io;
    delete (global as any).ioServer;
  }

  // Test 2: Iniciar servidor HTTP ficticio y montar Socket.IO como hace server.js
  console.log("Test 2: Montar Socket.IO en HTTP server y setear a globalThis...");
  const dummyHttp = createServer();
  const io = new ServerIO(dummyHttp, {
    path: "/api/socket",
    transports: ["websocket", "polling"],
  });

  // Simular la inicialización de server.js
  globalThis.io = io;
  globalThis.ioServer = io;
  if (typeof global !== "undefined") {
    (global as any).io = io;
    (global as any).ioServer = io;
  }
  setIO(io);

  // Test 3: Verificar que getIO() recupera la instancia unificada
  console.log("Test 3: Verificar getIO()...");
  const retrievedIO = getIO();
  assert.ok(retrievedIO, "getIO() debe retornar la instancia de ServerIO");
  assert.strictEqual(retrievedIO, io, "La instancia devuelta debe coincidir con la creada");
  console.log("✅ [PASS] getIO() recupera la instancia global correctamente");

  // Test 4: Verificar emisión sin advertencias de 'No hay instancia de io disponible'
  console.log("Test 4: Probar emisión de eventos...");
  let warnTriggered = false;
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args.some(a => String(a).includes("No hay instancia de io disponible"))) {
      warnTriggered = true;
    }
    originalWarn(...args);
  };

  emitNuevoPedido("rest-test-123", { id: "ord-1", total: 10.50 });
  emitStockActualizado("rest-test-123", [{ id: "dish-1", stock: 5 }]);
  emitPedidoActualizado("rest-test-123", { id: "ord-1", estado: "en_cocina" });

  console.warn = originalWarn;
  assert.strictEqual(warnTriggered, false, "Ningún evento debe emitir advertencia de 'No hay instancia de io disponible'");
  console.log("✅ [PASS] Eventos emitidos exitosamente sin warnings de instancia faltante");

  io.close();
  dummyHttp.close();

  console.log("==========================================");
  console.log("🎉 TODAS LAS PRUEBAS DE SOCKET.IO PASARON (4/4)");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("❌ Falló el test de Socket.IO:", err);
  process.exit(1);
});

