import { createOrderAction } from "./actions";
import { prisma } from "./prisma";

async function runOrderSecurityTests() {
  console.log("=== RUNNING FULL COMMERCIAL TAX & SECURITY TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ""}`);
      failed++;
    }
  }

  let user = await prisma.user.findFirst({ where: { email: { startsWith: "test-sec-" } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `test-sec-${Date.now()}@example.com`,
        password: "hashedpassword",
        name: "Security Tester",
      },
    });
  }

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      userId: user.id,
      name: "Restaurante Test Comercial",
      slug: `sec-comm-${Date.now()}`,
      whatsapp: "+593999999999",
      ivaPercent: 15.0,
      servicePercent: 10.0,
      deliveryCost: 2.5,
      ivaOnTable: false, // false = adicional, true = incluido
      serviceOnTable: false, // false = adicional, true = incluido
    },
  });

  // Create category & dishes
  const category = await prisma.category.create({
    data: {
      name: "Platos Principales",
      restaurantId: restaurant.id,
    },
  });

  const dishA = await prisma.dish.create({
    data: {
      name: "Hamburguesa Real",
      price: 10.0,
      isAvailable: true,
      categoryId: category.id,
      restaurantId: restaurant.id,
    },
  });

  const dishUnavailable = await prisma.dish.create({
    data: {
      name: "Plato Agotado",
      price: 5.0,
      isAvailable: false,
      categoryId: category.id,
      restaurantId: restaurant.id,
    },
  });

  const coupon = await prisma.coupon.create({
    data: {
      code: `DESC2-${Date.now()}`,
      discountType: "FIXED",
      discountValue: 2.0,
      isActive: true,
      restaurantId: restaurant.id,
    },
  });

  // Create second restaurant for tenant isolation testing
  const restaurantB = await prisma.restaurant.create({
    data: {
      userId: user.id,
      name: "Restaurante B",
      slug: `sec-comm-b-${Date.now()}`,
      whatsapp: "+593999999998",
    },
  });

  const categoryB = await prisma.category.create({
    data: {
      name: "Pizzas B",
      restaurantId: restaurantB.id,
    },
  });

  const dishB = await prisma.dish.create({
    data: {
      name: "Pizza B",
      price: 15.0,
      isAvailable: true,
      categoryId: categoryB.id,
      restaurantId: restaurantB.id,
    },
  });

  const testOrderIds: string[] = [];

  try {
    // Helper function to update restaurant tax settings
    async function updateTaxSettings(ivaPercent: number, ivaIncluded: boolean, servicePercent: number, serviceIncluded: boolean) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          ivaPercent,
          ivaOnTable: ivaIncluded,
          ivaOnTakeout: ivaIncluded,
          servicePercent,
          serviceOnTable: serviceIncluded,
          serviceOnTakeout: serviceIncluded,
        },
      });
    }

    // -------------------------------------------------------------
    // SECTION 15 TESTS: COMMERCIAL TAX & SERVICE COMBINATIONS (1 - 15)
    // -------------------------------------------------------------

    // TEST 1: IVA 0% (Sin IVA)
    {
      await updateTaxSettings(0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 0 && order?.total === 10.0, "PROMPT TEST 1: IVA 0% -> iva = 0, total = 10.00", `iva: ${order?.iva}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 1: IVA 0%", res.error);
      }
    }

    // TEST 2: IVA adicional 15%
    {
      await updateTaxSettings(15.0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 1.5 && order?.total === 11.5, "PROMPT TEST 2: IVA adicional 15% -> iva = 1.50, total = 11.50", `iva: ${order?.iva}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 2: IVA adicional 15%", res.error);
      }
    }

    // TEST 3: IVA incluido 15%
    {
      await updateTaxSettings(15.0, true, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 0 && order?.total === 10.0, "PROMPT TEST 3: IVA incluido 15% -> iva = 0.00 adic, total = 10.00", `iva: ${order?.iva}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 3: IVA incluido 15%", res.error);
      }
    }

    // TEST 4: Servicio 0% (Sin servicio)
    {
      await updateTaxSettings(0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.serviceCharge === 0 && order?.total === 10.0, "PROMPT TEST 4: Servicio 0% -> serviceCharge = 0, total = 10.00", `serviceCharge: ${order?.serviceCharge}`);
      } else {
        assert(false, "PROMPT TEST 4: Servicio 0%", res.error);
      }
    }

    // TEST 5: Servicio adicional 10%
    {
      await updateTaxSettings(0, false, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.serviceCharge === 1.0 && order?.total === 11.0, "PROMPT TEST 5: Servicio adicional 10% -> serviceCharge = 1.00, total = 11.00", `serviceCharge: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 5: Servicio adicional 10%", res.error);
      }
    }

    // TEST 6: Servicio incluido 10%
    {
      await updateTaxSettings(0, false, 10.0, true);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.serviceCharge === 0 && order?.total === 10.0, "PROMPT TEST 6: Servicio incluido 10% -> serviceCharge = 0.00 adic, total = 10.00", `serviceCharge: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 6: Servicio incluido 10%", res.error);
      }
    }

    // TEST 7: IVA adicional (15%) + servicio adicional (10%)
    {
      await updateTaxSettings(15.0, false, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 1.5 && order?.serviceCharge === 1.0 && order?.total === 12.5, "PROMPT TEST 7: IVA adicional + servicio adicional -> total = 12.50", `iva: ${order?.iva}, service: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 7: IVA adicional + servicio adicional", res.error);
      }
    }

    // TEST 8: IVA incluido (15%) + servicio adicional (10%)
    {
      await updateTaxSettings(15.0, true, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 0 && order?.serviceCharge === 1.0 && order?.total === 11.0, "PROMPT TEST 8: IVA incluido + servicio adicional -> total = 11.00", `iva: ${order?.iva}, service: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 8: IVA incluido + servicio adicional", res.error);
      }
    }

    // TEST 9: IVA adicional (15%) + servicio incluido (10%)
    {
      await updateTaxSettings(15.0, false, 10.0, true);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 1.5 && order?.serviceCharge === 0 && order?.total === 11.5, "PROMPT TEST 9: IVA adicional + servicio incluido -> total = 11.50", `iva: ${order?.iva}, service: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 9: IVA adicional + servicio incluido", res.error);
      }
    }

    // TEST 10: IVA incluido (15%) + servicio incluido (10%)
    {
      await updateTaxSettings(15.0, true, 10.0, true);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(order?.iva === 0 && order?.serviceCharge === 0 && order?.total === 10.0, "PROMPT TEST 10: IVA incluido + servicio incluido -> total = 10.00", `iva: ${order?.iva}, service: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 10: IVA incluido + servicio incluido", res.error);
      }
    }

    // TEST 11: Cupón + IVA adicional 15%
    {
      await updateTaxSettings(15.0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        couponCode: coupon.code,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        // Subtotal $10 - Coupon $2 = Base $8. IVA 15% of $8 = $1.20. Total = $9.20
        assert(order?.discountAmount === 2.0 && order?.iva === 1.2 && order?.total === 9.2, "PROMPT TEST 11: Cupón ($2) + IVA adicional (15%) -> base = $8, iva = $1.20, total = $9.20", `disc: ${order?.discountAmount}, iva: ${order?.iva}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 11: Cupón + IVA", res.error);
      }
    }

    // TEST 12: Cupón + Servicio adicional 10%
    {
      await updateTaxSettings(0, false, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        couponCode: coupon.code,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        // Subtotal $10 - Coupon $2 = Base $8. Service 10% of $8 = $0.80. Total = $8.80
        assert(order?.discountAmount === 2.0 && order?.serviceCharge === 0.8 && order?.total === 8.8, "PROMPT TEST 12: Cupón ($2) + Servicio adicional (10%) -> base = $8, service = $0.80, total = $8.80", `disc: ${order?.discountAmount}, service: ${order?.serviceCharge}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 12: Cupón + Servicio", res.error);
      }
    }

    // TEST 13: IVA adicional (15%) + Servicio adicional (10%) + Propina ($3.00)
    {
      await updateTaxSettings(15.0, false, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        tip: 3.0,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        // Subtotal $10 + IVA $1.50 + Service $1.00 + Tip $3.00 = $15.50
        assert(order?.tip === 3.0 && order?.total === 15.5, "PROMPT TEST 13: IVA + servicio + propina -> total = $15.50", `tip: ${order?.tip}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 13: IVA + servicio + propina", res.error);
      }
    }

    // TEST 14: IVA adicional (15%) + Servicio adicional (10%) + Delivery ($2.50)
    {
      await updateTaxSettings(15.0, false, 10.0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "Domicilio",
        customerName: "Juan Pérez",
        customerPhone: "0991234567",
        customerAddress: "Av. Amazonas 123",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        // Subtotal $10 + IVA $1.50 + Service $1.00 + Delivery $2.50 = $15.00
        assert(order?.deliveryCost === 2.5 && order?.total === 15.0, "PROMPT TEST 14: IVA + servicio + delivery -> total = $15.00", `del: ${order?.deliveryCost}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 14: IVA + servicio + delivery", res.error);
      }
    }

    // TEST 15: Pedido con cantidades múltiples (qty = 3 * $10.00 = $30.00) + IVA adicional (15%)
    {
      await updateTaxSettings(15.0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 3 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId } });
        // Subtotal $30 + IVA 15% ($4.50) = $34.50
        assert(order?.subtotal === 30.0 && order?.iva === 4.5 && order?.total === 34.5, "PROMPT TEST 15: Cantidades múltiples (qty=3) -> subtotal = $30, iva = $4.50, total = $34.50", `sub: ${order?.subtotal}, iva: ${order?.iva}, total: ${order?.total}`);
      } else {
        assert(false, "PROMPT TEST 15: Cantidades múltiples", res.error);
      }
    }

    // -------------------------------------------------------------
    // SECTION 15 TESTS: SECURITY & MANIPULATION (16 - 18)
    // -------------------------------------------------------------

    // TEST 16: Precio manipulado desde cliente
    {
      await updateTaxSettings(15.0, false, 0, false);
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, price: 0.01, quantity: 1 }],
        subtotal: 0.01,
        total: 0.01,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const order = await prisma.order.findUnique({ where: { id: res.orderId }, include: { items: true } });
        assert(order?.items[0]?.price === 10.0 && order?.subtotal === 10.0, "PROMPT TEST 16: Precio manipulado (client 0.01) -> Servidor usa precio oficial $10.00", `price: ${order?.items[0]?.price}`);
      } else {
        assert(false, "PROMPT TEST 16: Precio manipulado", res.error);
      }
    }

    // TEST 17: RestaurantId manipulado desde cliente (dishId from restaurant B sent to restaurant A)
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishB.id, quantity: 1 }],
      });
      assert(!res.success && !!res.error, "PROMPT TEST 17: RestaurantId/Dish manipulado de otro restaurante -> Rechazado", res.error);
    }

    // TEST 18: Producto no disponible (isAvailable = false)
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishUnavailable.id, quantity: 1 }],
      });
      assert(!res.success && !!res.error, "PROMPT TEST 18: Producto no disponible -> Rechazado", res.error);
    }

  } finally {
    // Cleanup test data
    if (testOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: testOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: testOrderIds } } });
    }
    await prisma.dish.deleteMany({ where: { id: { in: [dishA.id, dishUnavailable.id, dishB.id] } } });
    await prisma.category.deleteMany({ where: { id: { in: [category.id, categoryB.id] } } });
    await prisma.coupon.deleteMany({ where: { id: coupon.id } });
    await prisma.restaurant.deleteMany({ where: { id: { in: [restaurant.id, restaurantB.id] } } });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runOrderSecurityTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
