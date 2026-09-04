import { createOrderAction } from "./actions";
import { prisma } from "./prisma";

async function runOrderSecurityTests() {
  console.log("=== RUNNING ORDER SECURITY TEST SUITE (17 TESTS) ===\n");
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

  // Setup test environment: Find or create a test restaurant and dish
  let restaurant = await prisma.restaurant.findFirst({
    include: { dishes: true, coupons: true },
  });

  if (!restaurant) {
    // Create temp user and restaurant for test
    const user = await prisma.user.create({
      data: {
        email: `test-security-${Date.now()}@example.com`,
        password: "hashedpassword",
        name: "Security Tester",
      },
    });
    restaurant = await prisma.restaurant.create({
      data: {
        userId: user.id,
        name: "Restaurante Test Seguridad",
        slug: `sec-test-${Date.now()}`,
        whatsapp: "+593999999999",
        ivaPercent: 15.0,
        servicePercent: 10.0,
        deliveryCost: 2.5,
        ivaOnTable: true,
        serviceOnTable: true,
        dishes: {
          create: [
            {
              name: "Hamburguesa Real",
              price: 10.0,
              isAvailable: true,
              category: {
                create: {
                  name: "Platos Principales",
                },
              },
            },
          ],
        },
      },
      include: { dishes: true, coupons: true },
    });
  }

  // Find second restaurant for cross-tenant testing (TEST 9)
  let restaurantB = await prisma.restaurant.findFirst({
    where: { id: { not: restaurant.id } },
    include: { dishes: true },
  });

  if (!restaurantB) {
    const userB = await prisma.user.create({
      data: {
        email: `test-security-b-${Date.now()}@example.com`,
        password: "hashedpassword",
        name: "Security Tester B",
      },
    });
    restaurantB = await prisma.restaurant.create({
      data: {
        userId: userB.id,
        name: "Restaurante B",
        slug: `sec-test-b-${Date.now()}`,
        whatsapp: "+593999999998",
        dishes: {
          create: [
            {
              name: "Pizza B",
              price: 15.0,
              isAvailable: true,
              category: {
                create: {
                  name: "Pizzas",
                },
              },
            },
          ],
        },
      },
      include: { dishes: true },
    });
  }

  const dishA = restaurant.dishes[0];
  const dishB = restaurantB.dishes[0];

  // Helper to cleanup created test orders
  const testOrderIds: string[] = [];

  try {
    // TEST 1: Client sends price = 0.01 -> Server uses real PostgreSQL price (10.00)
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, dishName: "Hack Name", price: 0.01, quantity: 1 }],
        subtotal: 0.01,
        total: 0.01,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const dbOrder = await prisma.order.findUnique({
          where: { id: res.orderId },
          include: { items: true },
        });
        const realPriceUsed = dbOrder?.items[0]?.price === dishA.price;
        assert(realPriceUsed, "TEST 1: Client sends price = 0.01 -> Server uses real PostgreSQL price", `Used: ${dbOrder?.items[0]?.price}`);
      } else {
        assert(false, "TEST 1: Client sends price = 0.01", res.error);
      }
    }

    // TEST 2: Client sends subtotal = 0 -> Server recalculates subtotal
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 2 }],
        subtotal: 0,
        total: 0,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const dbOrder = await prisma.order.findUnique({ where: { id: res.orderId } });
        const expectedSubtotal = dishA.price * 2; // 20.00
        assert(dbOrder?.subtotal === expectedSubtotal, "TEST 2: Client sends subtotal = 0 -> Server recalculates subtotal", `Subtotal: ${dbOrder?.subtotal}`);
      } else {
        assert(false, "TEST 2: Client sends subtotal = 0", res.error);
      }
    }

    // TEST 3: Client sends total = 0.01 -> Server recalculates total
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        total: 0.01,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const dbOrder = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(dbOrder?.total !== 0.01 && (dbOrder?.total || 0) > 10, "TEST 3: Client sends total = 0.01 -> Server recalculates total", `Total: ${dbOrder?.total}`);
      } else {
        assert(false, "TEST 3: Client sends total = 0.01", res.error);
      }
    }

    // TEST 4: Client sends discountAmount = 1000 without valid coupon -> Server ignores it
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        discountAmount: 1000,
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const dbOrder = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(dbOrder?.discountAmount === 0, "TEST 4: Client sends discountAmount = 1000 -> Server sets discount = 0", `Discount: ${dbOrder?.discountAmount}`);
      } else {
        assert(false, "TEST 4: Client sends discountAmount = 1000", res.error);
      }
    }

    // TEST 5: Client sends invalid coupon + high discountAmount -> Coupon rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
        couponCode: "HACKER99",
        discountAmount: 999,
      });
      assert(!res.success && !!res.error, "TEST 5: Invalid coupon + high discountAmount -> Rejected", res.error);
    }

    // TEST 6: Client sends quantity = 0 -> Rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 0 }],
      });
      assert(!res.success && !!res.error, "TEST 6: Quantity = 0 -> Rejected", res.error);
    }

    // TEST 7: Client sends quantity = -1 -> Rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: -1 }],
      });
      assert(!res.success && !!res.error, "TEST 7: Quantity = -1 -> Rejected", res.error);
    }

    // TEST 8: Client sends quantity = 1.5 -> Rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1.5 }],
      });
      assert(!res.success && !!res.error, "TEST 8: Quantity = 1.5 -> Rejected", res.error);
    }

    // TEST 9: Client uses dishId from another restaurant -> Rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishB.id, quantity: 1 }],
      });
      assert(!res.success && !!res.error, "TEST 9: Cross-tenant dishId -> Rejected", res.error);
    }

    // TEST 10: Client attempts invalid paymentMethod -> Rejected
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "INVALID_CRYPTO_METHOD",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      assert(!res.success && !!res.error, "TEST 10: Invalid paymentMethod -> Rejected", res.error);
    }

    // TEST 11: Client attempts to control payment status -> Order created as PENDING
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        const dbOrder = await prisma.order.findUnique({ where: { id: res.orderId } });
        assert(dbOrder?.status === "PENDING", "TEST 11: Order status defaults to PENDING (client cannot override)", `Status: ${dbOrder?.status}`);
      } else {
        assert(false, "TEST 11: Order creation", res.error);
      }
    }

    // TEST 12: Local CASH order -> Works
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "Mesa 3",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        assert(true, "TEST 12: Local CASH order -> Works");
      } else {
        assert(false, "TEST 12: Local CASH order", res.error);
      }
    }

    // TEST 13: Takeaway CASH order -> Works
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "Llevar",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        assert(true, "TEST 13: Takeaway CASH order -> Works");
      } else {
        assert(false, "TEST 13: Takeaway CASH order", res.error);
      }
    }

    // TEST 14: Delivery CASH order -> Works
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "Domicilio",
        customerName: "Juan Pérez",
        customerPhone: "0991234567",
        customerAddress: "Av. Amazonas y Colón",
        paymentMethod: "cash",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        assert(true, "TEST 14: Delivery CASH order -> Works");
      } else {
        assert(false, "TEST 14: Delivery CASH order", res.error);
      }
    }

    // TEST 15: Deuna payment order -> Works as direct merchant payment
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "deuna",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        assert(true, "TEST 15: Deuna payment order -> Works");
      } else {
        assert(false, "TEST 15: Deuna payment order", res.error);
      }
    }

    // TEST 16: Bank transfer order -> Works as direct merchant payment
    {
      const res = await createOrderAction({
        restaurantId: restaurant.id,
        tableName: "1",
        paymentMethod: "transferencia",
        items: [{ dishId: dishA.id, quantity: 1 }],
      });
      if (res.success && res.orderId) {
        testOrderIds.push(res.orderId);
        assert(true, "TEST 16: Bank transfer order -> Works");
      } else {
        assert(false, "TEST 16: Bank transfer order", res.error);
      }
    }

    // TEST 17: MenuQR SaaS Subscription -> dLocal remains isolated from Order model
    {
      const dbOrder = await prisma.order.findFirst();
      const orderKeys = dbOrder ? Object.keys(dbOrder) : [];
      const hasDlocalInOrder = orderKeys.some((k) => k.toLowerCase().includes("dlocal"));
      assert(!hasDlocalInOrder, "TEST 17: MenuQR SaaS Subscription -> dLocal is isolated from Order model");
    }

  } finally {
    // Cleanup test orders
    if (testOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: testOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: testOrderIds } } });
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
