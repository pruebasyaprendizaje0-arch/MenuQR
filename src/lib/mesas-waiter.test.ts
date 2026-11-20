import assert from "node:assert";

console.log("🍽️ INICIANDO PRUEBAS DE MÓDULO DE MESERO: MÚLTIPLES CUENTAS EN UNA MISMA MESA");

interface TestPedidoItem {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  es_añadido?: boolean;
  estado_item?: string;
}

interface TestPedido {
  id: string;
  order_number?: number;
  negocio_id: string;
  mesa: string;
  estado: "nuevo" | "en_cocina" | "listo" | "por_pagar" | "pagado" | "cancelado";
  camarero_id?: string;
  cliente_nombre?: string;
  solicita_mesero?: boolean;
  total: number;
  created_at: string;
  items: TestPedidoItem[];
}

function runMesasWaiterSuite() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err);
      throw err;
    }
  }

  // Helper matching the implementation in MesasClient.tsx
  const getPedidosForMesa = (pedidos: TestPedido[], numMesa: number): TestPedido[] => {
    return pedidos.filter((p) => {
      const cleanP = String(p.mesa || "").replace(/^(mesa\s*#?|#)/i, "").trim().toLowerCase();
      return cleanP === String(numMesa).trim().toLowerCase() && p.estado !== "pagado" && p.estado !== "cancelado";
    });
  };

  // Mock initial state: Mesa 10 con 2 cuentas independientes, Mesa 5 con 1 cuenta, Mesa 3 vacía
  let pedidosState: TestPedido[] = [
    {
      id: "comanda-10-1",
      order_number: 101,
      negocio_id: "negocio-test-1",
      mesa: "10",
      estado: "en_cocina",
      cliente_nombre: "Grupo A (Carlos)",
      total: 18.5,
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      items: [
        { id: "item-1", nombre: "Fettuccine Alfredo", cantidad: 1, precio: 15.0 },
        { id: "item-2", nombre: "Bebida", cantidad: 1, precio: 3.5 },
      ],
    },
    {
      id: "comanda-10-2",
      order_number: 102,
      negocio_id: "negocio-test-1",
      mesa: "Mesa 10",
      estado: "nuevo",
      cliente_nombre: "Grupo B (Ana)",
      total: 25.0,
      created_at: new Date(Date.now() - 10 * 60000).toISOString(),
      items: [
        { id: "item-3", nombre: "Pizza Margarita", cantidad: 1, precio: 20.0 },
        { id: "item-4", nombre: "Cerveza", cantidad: 1, precio: 5.0 },
      ],
    },
    {
      id: "comanda-5-1",
      order_number: 99,
      negocio_id: "negocio-test-1",
      mesa: "5",
      estado: "por_pagar",
      cliente_nombre: "Pedro",
      total: 12.0,
      created_at: new Date(Date.now() - 45 * 60000).toISOString(),
      items: [{ id: "item-5", nombre: "Hamburguesa", cantidad: 1, precio: 12.0 }],
    },
  ];

  // 1. VISIBILIDAD DE CUENTAS POR MESA
  test("Visibilidad de Cuentas: Mesa 10 detecta exactamente 2 cuentas independientes activas", () => {
    const cuentasMesa10 = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentasMesa10.length, 2, "Mesa 10 debe mostrar 2 cuentas activas");
    assert.strictEqual(cuentasMesa10[0].id, "comanda-10-1");
    assert.strictEqual(cuentasMesa10[1].id, "comanda-10-2");

    // Ambos grupos visibles con sus datos
    assert.strictEqual(cuentasMesa10[0].cliente_nombre, "Grupo A (Carlos)");
    assert.strictEqual(cuentasMesa10[1].cliente_nombre, "Grupo B (Ana)");
  });

  test("Separación de Importes: Cada comanda conserva sus propios totales e ítems", () => {
    const cuentasMesa10 = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentasMesa10[0].total, 18.5);
    assert.strictEqual(cuentasMesa10[1].total, 25.0);
    assert.notStrictEqual(cuentasMesa10[0].total, cuentasMesa10[1].total);
    assert.strictEqual(cuentasMesa10[0].items.length, 2);
    assert.strictEqual(cuentasMesa10[1].items.length, 2);
  });

  test("Estado de Mesas: Mesa 10 ocupada (2 cuentas), Mesa 5 ocupada (1 cuenta), Mesa 3 libre (0 cuentas)", () => {
    const c10 = getPedidosForMesa(pedidosState, 10);
    const c5 = getPedidosForMesa(pedidosState, 5);
    const c3 = getPedidosForMesa(pedidosState, 3);

    assert.strictEqual(c10.length, 2, "Mesa 10 tiene 2 cuentas");
    assert.strictEqual(c5.length, 1, "Mesa 5 tiene 1 cuenta");
    assert.strictEqual(c3.length, 0, "Mesa 3 está libre");
  });

  // 2. AÑADIDO DE PRODUCTO EXCLUSIVAMENTE A LA COMANDA SELECCIONADA
  test("Añadir producto: Se agrega únicamente a la comanda seleccionada (Grupo A) sin tocar Grupo B ni crear pedido", () => {
    const selectedPedidoId = "comanda-10-1"; // Mesero selecciona comanda de Carlos
    const nuevoPlato: TestPedidoItem = {
      id: "item-new-1",
      nombre: "Tiramisú",
      cantidad: 1,
      precio: 6.0,
      es_añadido: true,
    };

    // Simulación del endpoint POST /api/pedidos con targetPedidoId
    const updatedPedidos = pedidosState.map((p) => {
      if (p.id === selectedPedidoId) {
        return {
          ...p,
          items: [...p.items, nuevoPlato],
          total: p.total + nuevoPlato.precio,
        };
      }
      return p;
    });

    pedidosState = updatedPedidos;

    const cuentasActualizadas = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentasActualizadas.length, 2, "Siguen existiendo exactamente 2 comandas, no se creó una tercera");

    const comandaA = cuentasActualizadas.find((p) => p.id === "comanda-10-1")!;
    const comandaB = cuentasActualizadas.find((p) => p.id === "comanda-10-2")!;

    // Comanda A aumentó a 3 platos y $24.50
    assert.strictEqual(comandaA.items.length, 3);
    assert.strictEqual(comandaA.total, 24.5);
    assert.strictEqual(comandaA.items[2].nombre, "Tiramisú");
    assert.strictEqual(comandaA.items[2].es_añadido, true);

    // Comanda B permaneció exactamente igual ($25.00 y 2 platos)
    assert.strictEqual(comandaB.items.length, 2);
    assert.strictEqual(comandaB.total, 25.0);
  });

  // 3. PAGO DE UNA CUENTA SIN AFECTAR LA OTRA
  test("Pago de una cuenta: Pagar comanda A no oculta ni cierra comanda B, y la mesa NO se marca libre", () => {
    const pedidoToPayId = "comanda-10-1";

    // Simulación de handlePagarYLiberar (PUT /api/pedidos/:id con estado="pagado")
    pedidosState = pedidosState.map((p) => (p.id === pedidoToPayId ? { ...p, estado: "pagado" } : p));

    const cuentasRestantes = getPedidosForMesa(pedidosState, 10);

    // Debe quedar comanda B activa
    assert.strictEqual(cuentasRestantes.length, 1, "Mesa 10 aún tiene 1 cuenta activa restante");
    assert.strictEqual(cuentasRestantes[0].id, "comanda-10-2");
    assert.strictEqual(cuentasRestantes[0].cliente_nombre, "Grupo B (Ana)");
    assert.strictEqual(cuentasRestantes[0].total, 25.0);

    // Mesa 10 NO está libre
    const isLibre = Boolean((cuentasRestantes.length as number) === 0);
    assert.strictEqual(isLibre, false, "Mesa 10 NO debe mostrarse libre mientras quede comanda activa");
  });

  // 4. ANULACIÓN DE UNA CUENTA SIN AFECTAR OTRAS
  test("Anulación de cuenta: Anular una comanda no cancela las demás de la misma mesa", () => {
    // Añadimos otra cuenta a Mesa 10 para probar anulación
    pedidosState.push({
      id: "comanda-10-3",
      order_number: 103,
      negocio_id: "negocio-test-1",
      mesa: "10",
      estado: "nuevo",
      cliente_nombre: "Grupo C (Elena)",
      total: 30.0,
      created_at: new Date().toISOString(),
      items: [{ id: "item-6", nombre: "Ceviche", cantidad: 2, precio: 15.0 }],
    });

    let cuentas = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentas.length, 2, "Mesa 10 tiene Comanda B y Comanda C");

    // Anular Comanda C
    const toCancelId = "comanda-10-3";
    pedidosState = pedidosState.map((p) => (p.id === toCancelId ? { ...p, estado: "cancelado" } : p));

    cuentas = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentas.length, 1, "Solo queda Comanda B activa");
    assert.strictEqual(cuentas[0].id, "comanda-10-2", "Comanda B sigue activa");
    assert.strictEqual(cuentas[0].total, 25.0);
  });

  // 5. MESA LIBRE SOLO CUANDO NO QUEDEN CUENTAS ACTIVAS
  test("Mesa libre: La mesa pasa a Disponible ÚNICAMENTE cuando se paga/anula la última cuenta", () => {
    // Pagar la última cuenta de Mesa 10 (Comanda B)
    pedidosState = pedidosState.map((p) => (p.id === "comanda-10-2" ? { ...p, estado: "pagado" } : p));

    const cuentasFinales = getPedidosForMesa(pedidosState, 10);
    assert.strictEqual(cuentasFinales.length, 0, "Ya no quedan cuentas activas en Mesa 10");

    const isLibre = cuentasFinales.length === 0;
    assert.strictEqual(isLibre, true, "Ahora sí, Mesa 10 está Disponible (Libre)");
  });

  // 6. AVISO DE ÍTEMS AÑADIDOS CON IDENTIFICADOR DE CUENTA Y NEGOCIO
  test("Socket items_añadidos: Identifica cuenta y negocio, actualizando ÚNICAMENTE la comanda destino en mesa compartida", () => {
    // Restaurar estado de prueba con 2 cuentas en Mesa 10
    const stateTest: TestPedido[] = [
      {
        id: "comanda-10-A",
        negocio_id: "negocio-test-1",
        mesa: "10",
        estado: "en_cocina",
        cliente_nombre: "Comensal A",
        total: 20.0,
        created_at: new Date().toISOString(),
        items: [{ id: "it-1", nombre: "Pasta", cantidad: 1, precio: 20.0 }],
      },
      {
        id: "comanda-10-B",
        negocio_id: "negocio-test-1",
        mesa: "10",
        estado: "nuevo",
        cliente_nombre: "Comensal B",
        total: 15.0,
        created_at: new Date().toISOString(),
        items: [{ id: "it-2", nombre: "Ensalada", cantidad: 1, precio: 15.0 }],
      },
    ];

    // Simulación del evento socket items_añadidos dirigido a comanda-10-A
    const eventPayload = {
      negocio_id: "negocio-test-1",
      pedido_id: "comanda-10-A",
      mesa: "10",
      total: 28.0, // Total guardado autoritativo en servidor (con nuevo ítem)
      items: [{ id: "it-3", nombre: "Vino", cantidad: 1, precio: 8.0, es_añadido: true }],
    };

    const targetNegocioId = "negocio-test-1";

    const nextState = stateTest.map((p) => {
      if (eventPayload.negocio_id && eventPayload.negocio_id !== targetNegocioId) return p;

      const isTarget = eventPayload.pedido_id
        ? p.id === eventPayload.pedido_id
        : String(p.mesa) === String(eventPayload.mesa);

      if (!isTarget) return p;

      const existingIds = new Set((p.items || []).map((i) => i.id));
      const newItems = eventPayload.items.filter((i) => !existingIds.has(i.id));

      const authoritativeTotal = typeof eventPayload.total === "number" ? eventPayload.total : null;
      const finalTotal = authoritativeTotal !== null
        ? authoritativeTotal
        : p.total + newItems.reduce((s, i) => s + i.precio * i.cantidad, 0);

      return {
        ...p,
        total: finalTotal,
        items: newItems.length > 0 ? [...p.items, ...newItems] : p.items,
      };
    });

    const comandaA = nextState.find((p) => p.id === "comanda-10-A")!;
    const comandaB = nextState.find((p) => p.id === "comanda-10-B")!;

    // Comanda A: se añadió el vino y su total ahora coincide exactamente con el guardado ($28.00)
    assert.strictEqual(comandaA.items.length, 2);
    assert.strictEqual(comandaA.items[1].nombre, "Vino");
    assert.strictEqual(comandaA.total, 28.0);

    // Comanda B: PERMANECE INTACTA ($15.00 y 1 solo ítem, NO recibió el vino)
    assert.strictEqual(comandaB.items.length, 1);
    assert.strictEqual(comandaB.items[0].nombre, "Ensalada");
    assert.strictEqual(comandaB.total, 15.0);
  });

  // 7. PREVENCIÓN DE DUPLICACIÓN DE ÍTEMS Y SUMA DOBLE DE IMPORTES
  test("Socket items_añadidos: Si el aviso se recibe por segunda vez, no duplica platos ni suma importes dos veces", () => {
    let state: TestPedido[] = [
      {
        id: "comanda-10-A",
        negocio_id: "negocio-test-1",
        mesa: "10",
        estado: "en_cocina",
        cliente_nombre: "Comensal A",
        total: 28.0, // Ya tiene el total guardado
        created_at: new Date().toISOString(),
        items: [
          { id: "it-1", nombre: "Pasta", cantidad: 1, precio: 20.0 },
          { id: "it-3", nombre: "Vino", cantidad: 1, precio: 8.0, es_añadido: true },
        ],
      },
    ];

    // Reenvío idéntico del evento
    const duplicatePayload = {
      negocio_id: "negocio-test-1",
      pedido_id: "comanda-10-A",
      mesa: "10",
      total: 28.0,
      items: [{ id: "it-3", nombre: "Vino", cantidad: 1, precio: 8.0, es_añadido: true }],
    };

    const nextState = state.map((p) => {
      const isTarget = duplicatePayload.pedido_id
        ? p.id === duplicatePayload.pedido_id
        : String(p.mesa) === String(duplicatePayload.mesa);

      if (!isTarget) return p;

      const existingIds = new Set((p.items || []).map((i) => i.id));
      const newItems = duplicatePayload.items.filter((i) => !existingIds.has(i.id));

      const authoritativeTotal = typeof duplicatePayload.total === "number" ? duplicatePayload.total : null;
      if (newItems.length === 0 && authoritativeTotal !== null && p.total === authoritativeTotal) {
        return p;
      }

      const finalTotal = authoritativeTotal !== null
        ? authoritativeTotal
        : p.total + newItems.reduce((s, i) => s + i.precio * i.cantidad, 0);

      return {
        ...p,
        total: finalTotal,
        items: newItems.length > 0 ? [...p.items, ...newItems] : p.items,
      };
    });

    const comanda = nextState[0];
    assert.strictEqual(comanda.items.length, 2, "No se debe duplicar el ítem");
    assert.strictEqual(comanda.total, 28.0, "El importe no se debe sumar dos veces");
  });

  // 8. AISLAMIENTO MULTI-TENANT EN AVISOS
  test("Socket items_añadidos: Avisos con negocio_id ajeno son descartados sin modificar comandas", () => {
    const initialState: TestPedido[] = [
      {
        id: "comanda-10-A",
        negocio_id: "negocio-test-1",
        mesa: "10",
        estado: "en_cocina",
        cliente_nombre: "Comensal A",
        total: 20.0,
        created_at: new Date().toISOString(),
        items: [{ id: "it-1", nombre: "Pasta", cantidad: 1, precio: 20.0 }],
      },
    ];

    const foreignPayload = {
      negocio_id: "negocio-ajeno-999",
      pedido_id: "comanda-10-A",
      mesa: "10",
      total: 99.0,
      items: [{ id: "it-fake", nombre: "Intruso", cantidad: 1, precio: 79.0 }],
    };

    const currentNegocioId = "negocio-test-1";
    const nextState = initialState.map((p) => {
      if (foreignPayload.negocio_id && foreignPayload.negocio_id !== currentNegocioId) {
        return p;
      }
      return { ...p, total: foreignPayload.total };
    });

    assert.strictEqual(nextState[0].total, 20.0, "El negocio ajeno no debe modificar el estado");
    assert.strictEqual(nextState[0].items.length, 1);
  });

  console.log(`\n🎉 TODAS LAS PRUEBAS DE MESERO (MÚLTIPLES CUENTAS POR MESA) PASARON (${passed}/${total})\n`);
}

runMesasWaiterSuite();
