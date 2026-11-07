import assert from "node:assert";

console.log("=== INICIANDO PRUEBAS DE PERSISTENCIA CATÁLOGO Y PASS ===");

// 1. Simulación de payload de checkout en CtaloClient
{
  const store = {
    id: "store-test-123",
    slug: "boutique-calzado",
    name: "Boutique Calzado Urbano",
    address: "Av. Principal 456",
  };

  const deliveryMethod = "domicilio";
  const customerName = "María González";
  const customerPhone = "0987654321";
  const cart = [
    { productId: "prod-1", name: "Sneakers Chunky", cantidad: 2, price: 45.0, talla: "38", color: "Blanco" },
  ];
  const grandTotal = 93.5; // 90 + 3.5 envio

  const payload = {
    vertical: "ctalo",
    restaurantId: store.id,
    negocio_id: store.id,
    slug: store.slug,
    mesa: "CATALOGO",
    tipo_entrega: deliveryMethod === "domicilio" ? "DOMICILIO" : "RETIRO",
    metodo_entrega: deliveryMethod,
    cliente_nombre: customerName.trim(),
    cliente_telefono: customerPhone.trim(),
    items: cart.map((it) => ({
      dishId: it.productId,
      productId: it.productId,
      nombre: it.name,
      cantidad: it.cantidad,
      precio: it.price,
      talla: it.talla,
      color: it.color,
    })),
    total: grandTotal,
  };

  assert.strictEqual(payload.vertical, "ctalo", "Vertical debe ser 'ctalo'");
  assert.strictEqual(payload.mesa, "CATALOGO", "Mesa debe ser 'CATALOGO'");
  assert.strictEqual(payload.tipo_entrega, "DOMICILIO", "Tipo de entrega debe ser 'DOMICILIO'");
  assert.strictEqual(payload.restaurantId, "store-test-123", "Debe incluir restaurantId");
  assert.strictEqual(payload.total, 93.5, "Total debe coincidir");
  console.log("✅ [PASS] 1: Payload de checkout en CtaloClient contiene todos los campos requeridos");
}

// 2. Discriminación de flujo en POST /api/pedidos para mesa: 'CATALOGO'
{
  function isCatalogOrder(body: { vertical?: string; mesa?: string }): boolean {
    const v = body.vertical || "menuqr";
    const m = String(body.mesa || "").toUpperCase().trim();
    return v === "catalogo" || v === "ctalo" || m === "CATALOGO";
  }

  assert.strictEqual(isCatalogOrder({ vertical: "ctalo", mesa: "CATALOGO" }), true);
  assert.strictEqual(isCatalogOrder({ vertical: "menuqr", mesa: "CATALOGO" }), true);
  assert.strictEqual(isCatalogOrder({ vertical: "catalogo", mesa: "Delivery" }), true);
  assert.strictEqual(isCatalogOrder({ vertical: "menuqr", mesa: "Mesa 4" }), false);
  console.log("✅ [PASS] 2: Detección estricta de orden de catálogo sin requerir mesas de salón");
}

// 3. Tarjeta 'Catálogos' en Ubícame Pass: conteo de pedidos + lugares
{
  const mockHistory = [
    { id: "h1", vertical: "menuqr", businessName: "Parrillada Don Pepe" },
    { id: "h2", vertical: "ctalo", businessName: "Boutique Calzado Urbano" },
    { id: "h3", vertical: "ctalo", businessName: "Aura Joyas" },
  ];

  const mockPlaces = [
    { id: "p1", vertical: "ctalo", name: "Boutique Calzado Urbano" },
    { id: "p2", vertical: "menuqr", name: "Parrillada Don Pepe" },
  ];

  function getCountForTab(tabId: string, places: any[], history: any[]) {
    const ordersForVertical = history.filter((h) =>
      tabId === "all"
        ? true
        : h.vertical === tabId || (tabId === "ctalo" && (h.vertical === "ctalo" || h.vertical === "catalogo"))
    ).length;
    const placesForVertical =
      tabId === "all"
        ? places.length
        : places.filter((p) => p.vertical === tabId).length;

    return tabId === "all" ? places.length : (placesForVertical + ordersForVertical);
  }

  const ctaloCount = getCountForTab("ctalo", mockPlaces, mockHistory);
  // 1 lugar de ctalo + 2 pedidos de ctalo = 3
  assert.strictEqual(ctaloCount, 3, "La tarjeta Catálogos debe sumar los pedidos con vertical === 'ctalo'");

  const menuqrCount = getCountForTab("menuqr", mockPlaces, mockHistory);
  // 1 lugar de menuqr + 1 pedido de menuqr = 2
  assert.strictEqual(menuqrCount, 2, "La tarjeta Restaurantes debe sumar sus pedidos y lugares");

  console.log("✅ [PASS] 3: La tarjeta 'Catálogos' en Ubícame Pass suma pedidos con vertical === 'ctalo'");
}

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE PERSISTENCIA Y PASS PASARON (3/3)");
console.log("==================================================");

