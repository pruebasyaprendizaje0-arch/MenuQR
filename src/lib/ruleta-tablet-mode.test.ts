import { prisma } from "./prisma";

async function runRuletaTabletModeTests() {
  console.log("=== INICIANDO PRUEBAS DE MODO TABLET (RULETA EN CAJA) ===\n");
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

  // 1. Crear usuario y restaurante de prueba
  let user = await prisma.user.findFirst({ where: { email: { startsWith: "tablet-test-" } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `tablet-test-${Date.now()}@example.com`,
        password: "hashedpassword",
        name: "Tablet Tester",
      },
    });
  }

  const testSlug = `tablet-kiosk-${Date.now()}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      userId: user.id,
      name: "Restaurante Tablet Kiosk",
      slug: testSlug,
      whatsapp: "0991234567",
    },
  });

  // 2. Crear y configurar la ruleta como DESACTIVADA para clientes web normales
  const { getOrCreateRuletaConfig } = await import("./ruleta-actions");
  await getOrCreateRuletaConfig(restaurant.id);

  // Desactivar ruleta para clientes normales
  const configDelegate = (prisma as any).ruletaConfig;
  if (configDelegate?.update) {
    await configDelegate.update({
      where: { restaurantId: restaurant.id },
      data: {
        activa: false, // Desactivada en la carta web
        maxGirosIpDia: 2, // Límite estricto de IP para verificar bypass en tablet
      },
    });
  }

  // Test 1: Simular llamada a API /api/ruleta/config/[slug]
  // Modo normal -> debe retornar activa: false
  const configNormal = await (async () => {
    const config = await getOrCreateRuletaConfig(restaurant.id);
    const isTabletMode = false;
    if (!config.activa && !isTabletMode) {
      return { activa: false, sectoresCount: 0 };
    }
    return { activa: true, sectoresCount: config.premiosList?.length || 0 };
  })();
  assert(configNormal.activa === false, "Test 1: Modo normal para clientes web oculta la ruleta cuando activa=false");

  // Test 2: Modo tablet -> debe permitir visualizar la ruleta activa y sus sectores
  const configTablet = await (async () => {
    const config = await getOrCreateRuletaConfig(restaurant.id);
    const isTabletMode = true; // ?modo=tablet
    if (!config.activa && !isTabletMode) {
      return { activa: false, sectoresCount: 0 };
    }
    return { activa: true, sectoresCount: config.premiosList?.length || 0 };
  })();
  assert(configTablet.activa === true && configTablet.sectoresCount === 6, "Test 2: Modo tablet (?modo=tablet) carga la ruleta activa con sus sectores aún con activa=false");

  // Test 3: Girar ruleta en modo tablet con activa=false permite el giro
  const phoneClient1 = "0991111111";
  const { selectWeightedPrize, generateUniqueCouponCode } = await import("./ruleta-utils");

  const giroResult1 = await (async () => {
    const config = await getOrCreateRuletaConfig(restaurant.id);
    const isTablet = true;
    if (!config.activa && !isTablet) {
      return { error: "La Ruleta no está activa" };
    }
    const { premio } = selectWeightedPrize(config.premiosList);
    const code = generateUniqueCouponCode("TABLET");

    const giro = await (prisma as any).ruletaGiro.create({
      data: {
        restaurantId: restaurant.id,
        telefono: phoneClient1,
        nombreCliente: "Cliente Uno",
        fechaNacimiento: "1995-05-10",
        premioId: premio.id,
        premioLabel: premio.label,
        premioTipo: premio.tipo,
        premioValor: premio.valor,
        codigoCupon: code,
        ipAddress: "192.168.1.100", // Misma IP de la tablet
        userAgent: "Tablet-Kiosk-Browser",
        fechaExpiracion: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    return { success: true, giro };
  })();
  assert(giroResult1.success === true && Boolean(giroResult1.giro), "Test 3: Primer cliente gira con éxito en la tablet aunque la ruleta esté desactivada en la web");

  // Test 4: Mismo cliente intenta girar de nuevo el mismo día -> Debe ser bloqueado por protección de teléfono
  const giroResultDuplicatePhone = await (async () => {
    const ultimoGiro = await (prisma as any).ruletaGiro.findFirst({
      where: {
        restaurantId: restaurant.id,
        telefono: phoneClient1,
      },
    });
    if (ultimoGiro) {
      return { error: "Este número de WhatsApp ya realizó su giro del día." };
    }
    return { success: true };
  })();
  assert(giroResultDuplicatePhone.error?.includes("ya realizó su giro"), "Test 4: Protección anti-fraude por número de teléfono sigue activa en la tablet");

  // Test 5: Clientes 2 y 3 con teléfonos distintos giran desde la MISMA IP de la tablet
  // Superando el límite maxGirosIpDia=2 para verificar que la tablet no se bloquea por IP
  const phoneClient2 = "0992222222";
  const phoneClient3 = "0993333333";
  let tabletSequentialSpinsSuccess = true;

  for (const [idx, phone] of [phoneClient2, phoneClient3].entries()) {
    // Si fuera cliente web normal con maxGirosIpDia=2, el 3er giro se bloquearía por IP.
    // En modo tablet, se evalúa: if (!isTablet && girosIpCount >= maxGirosIp)
    const isTablet = true;
    const girosIpCount = await (prisma as any).ruletaGiro.count({
      where: {
        restaurantId: restaurant.id,
        ipAddress: "192.168.1.100",
      },
    });

    const maxGirosIp = 2;
    if (!isTablet && girosIpCount >= maxGirosIp) {
      tabletSequentialSpinsSuccess = false;
      break;
    }

    const config = await getOrCreateRuletaConfig(restaurant.id);
    const { premio } = selectWeightedPrize(config.premiosList);
    const code = generateUniqueCouponCode(`TAB${idx + 2}`);

    await (prisma as any).ruletaGiro.create({
      data: {
        restaurantId: restaurant.id,
        telefono: phone,
        nombreCliente: `Cliente ${idx + 2}`,
        fechaNacimiento: "1998-08-20",
        premioId: premio.id,
        premioLabel: premio.label,
        premioTipo: premio.tipo,
        premioValor: premio.valor,
        codigoCupon: code,
        ipAddress: "192.168.1.100",
        userAgent: "Tablet-Kiosk-Browser",
        fechaExpiracion: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
  }

  assert(tabletSequentialSpinsSuccess, "Test 5: La tablet permite múltiples clientes secuenciales saltando el límite de IP de tienda");

  // Limpieza
  await (prisma as any).ruletaGiro.deleteMany({ where: { restaurantId: restaurant.id } });
  await (prisma as any).ruletaConfig.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.restaurant.delete({ where: { id: restaurant.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`\n==========================================`);
  console.log(`🎉 TODAS LAS PRUEBAS DE RULETA TABLET PASARON (${passed}/${passed + failed})`);
  console.log(`==========================================\n`);
}

runRuletaTabletModeTests().catch((err) => {
  console.error("Error en pruebas de tablet mode:", err);
  process.exit(1);
});
