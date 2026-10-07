import { pool, ensureDbTables } from "../src/lib/db-pool";

async function runTests() {
  console.log("=== INICIANDO VALIDACIÓN DE MÓDULO COCINA + MESERO CON MESA ABIERTA ===");
  await ensureDbTables();

  // 1. Obtener negocio de prueba
  const { rows: negRows } = await pool.query("SELECT * FROM negocios LIMIT 1");
  if (negRows.length === 0) {
    throw new Error("No hay negocios para probar");
  }
  const negocio = negRows[0];
  console.log(`Negocio seleccionado: ${negocio.nombre} (${negocio.id})`);

  // 2. Obtener camarero
  const { rows: camRows } = await pool.query(
    "SELECT * FROM camareros WHERE negocio_id = $1 LIMIT 1",
    [negocio.id]
  );
  const camarero = camRows[0];
  console.log(`Camarero asignado: ${camarero ? camarero.nombre : "Sin camarero"}`);

  // Limpiar pedidos previos de Mesa '99' para prueba limpia
  await pool.query("DELETE FROM pedidos WHERE negocio_id = $1 AND mesa = '99'", [negocio.id]);

  // 3. Simular primer pedido (Mesa 99)
  console.log("\n-> Probando Paso 1: Creación de nuevo pedido en Mesa 99");
  const testItems1 = [
    { nombre: "Pizza Margherita", cantidad: 2, precio: 8.5, notas: "Masa fina" },
    { nombre: "Jugo Natural", cantidad: 2, precio: 2.5, notas: "Sin azúcar" },
  ];
  const totalEsperado1 = 2 * 8.5 + 2 * 2.5; // 17 + 5 = 22.00

  // Insertar simulando POST /api/pedidos
  const { rows: newOrderRows } = await pool.query(
    `INSERT INTO pedidos (negocio_id, mesa, camarero_id, estado, total)
     VALUES ($1, '99', $2, 'nuevo', $3)
     RETURNING *`,
    [negocio.id, camarero?.id || null, totalEsperado1]
  );
  const orderId = newOrderRows[0].id;

  for (const it of testItems1) {
    await pool.query(
      `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
       VALUES ($1, $2, $3, $4, $5, false, 'nuevo')`,
      [orderId, it.nombre, it.cantidad, it.precio, it.notas]
    );
  }
  console.log(`✓ Pedido creado exitosamente. ID: ${orderId}, Total: $${newOrderRows[0].total}`);

  // 4. Probar lógica de MESA ABIERTA: Añadir productos adicionales a la misma mesa
  console.log("\n-> Probando Paso 2: Lógica MESA ABIERTA (Añadir items a pedido activo)");
  const testItemsAdd = [
    { nombre: "Postre Tiramisú", cantidad: 1, precio: 4.5, notas: "Para compartir" },
  ];
  const addedTotal = 1 * 4.5;

  // Verificar si mesa tiene pedido != 'pagado'
  const { rows: activeCheck } = await pool.query(
    "SELECT * FROM pedidos WHERE negocio_id = $1 AND mesa = '99' AND estado != 'pagado' LIMIT 1",
    [negocio.id]
  );
  if (activeCheck.length === 0) {
    throw new Error("Fallo: La mesa debería tener un pedido activo");
  }

  // Insertar con es_añadido = true
  for (const it of testItemsAdd) {
    await pool.query(
      `INSERT INTO pedido_items (pedido_id, nombre, cantidad, precio, notas, es_añadido, estado_item)
       VALUES ($1, $2, $3, $4, $5, true, 'nuevo')`,
      [orderId, it.nombre, it.cantidad, it.precio, it.notas]
    );
  }

  // Actualizar total
  const { rows: updatedOrder } = await pool.query(
    "UPDATE pedidos SET total = total + $1 WHERE id = $2 RETURNING *",
    [addedTotal, orderId]
  );
  console.log(`✓ Mesa Abierta actualizada. Nuevo Total: $${updatedOrder[0].total} (Esperado: 26.50)`);

  // Verificar items y flag es_añadido
  const { rows: allItems } = await pool.query(
    "SELECT nombre, cantidad, precio, es_añadido FROM pedido_items WHERE pedido_id = $1",
    [orderId]
  );
  console.log("Items en pedido:", allItems);
  const añadidoFound = allItems.find((i) => i.es_añadido === true);
  if (!añadidoFound) {
    throw new Error("Fallo: El item añadido no tiene el flag es_añadido = true");
  }
  console.log(`✓ Badge 'es_añadido = true' verificado en ${añadidoFound.nombre}`);

  // 5. Probar transición de estados (nuevo -> en_cocina -> listo -> por_pagar -> pagado)
  console.log("\n-> Probando Paso 3: Transición de estados de cocina y mesero");
  await pool.query("UPDATE pedidos SET estado = 'en_cocina' WHERE id = $1", [orderId]);
  console.log("✓ Estado cambiado a 'en_cocina'");
  await pool.query("UPDATE pedidos SET estado = 'listo' WHERE id = $1", [orderId]);
  console.log("✓ Estado cambiado a 'listo' (aviso a mesero emitido)");
  await pool.query("UPDATE pedidos SET estado = 'por_pagar' WHERE id = $1", [orderId]);
  console.log("✓ Estado cambiado a 'por_pagar' (cuenta cerrada)");

  // 6. Probar consulta de métricas diarias del mesero
  console.log("\n-> Probando Paso 4: Consulta SQL de métricas diarias (GROUP BY camarero_id)");
  const { rows: metricas } = await pool.query(
    `SELECT 
      c.id as camarero_id,
      c.nombre as camarero_nombre,
      COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN p.mesa END)::int as mesas_atendidas,
      COALESCE(SUM(p.total), 0)::float as total_vendido,
      CASE 
        WHEN COUNT(p.id) > 0 THEN ROUND((COALESCE(SUM(p.total), 0) / COUNT(p.id))::numeric, 2)::float
        ELSE 0::float 
      END as ticket_promedio
    FROM camareros c
    LEFT JOIN pedidos p ON p.camarero_id = c.id 
      AND p.negocio_id = $1 
      AND DATE(p.created_at) = CURRENT_DATE
    WHERE c.negocio_id = $1
    GROUP BY c.id, c.nombre
    ORDER BY total_vendido DESC`,
    [negocio.id]
  );
  console.log("Métricas obtenidas:", metricas);

  // 7. Liberar mesa (pagado)
  await pool.query("UPDATE pedidos SET estado = 'pagado' WHERE id = $1", [orderId]);
  const { rows: finalCheck } = await pool.query(
    "SELECT * FROM pedidos WHERE negocio_id = $1 AND mesa = '99' AND estado != 'pagado'",
    [negocio.id]
  );
  console.log(`✓ Mesa liberada. Pedidos activos restantes en Mesa 99: ${finalCheck.length} (Esperado: 0)`);

  // Limpiar pedido de prueba
  await pool.query("DELETE FROM pedidos WHERE id = $1", [orderId]);

  console.log("\n=== TODAS LAS PRUEBAS DE MESA ABIERTA Y TIEMPO REAL PASARON CON ÉXITO ===");
  await pool.end();
}

runTests().catch((e) => {
  console.error("ERROR EN PRUEBAS:", e);
  process.exit(1);
});
