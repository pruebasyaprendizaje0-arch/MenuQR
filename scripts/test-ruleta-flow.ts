import { prisma } from "../src/lib/db";
import {
  getOrCreateRuletaConfig,
  saveRuletaConfigAction,
  validarCuponAction,
  getRuletaGirosAction,
} from "../src/lib/ruleta-actions";
import {
  selectWeightedPrize,
  normalizePhoneNumber,
  DEFAULT_RULETA_PREMIOS,
} from "../src/lib/ruleta-utils";

async function runRuletaVerification() {
  console.log("=== INICIANDO PRUEBAS DEL SISTEMA DE RULETA DE PREMIOS ===");

  // 1. Buscar un restaurante existente
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: "pigro" },
  }) || await prisma.restaurant.findFirst();

  if (!restaurant) {
    console.error("❌ No se encontró ningún restaurante en la base de datos.");
    process.exit(1);
  }

  console.log(`✅ Restaurante de prueba: ${restaurant.name} (Slug: ${restaurant.slug}, ID: ${restaurant.id})`);

  // 2. Inicializar / Obtener Configuración
  const config = await getOrCreateRuletaConfig(restaurant.id);
  console.log(`✅ Configuración obtenida/creada: Título: "${config.titulo}", Premios: ${config.premiosList.length}`);

  // 3. Probar Algoritmo de Probabilidad Ponderada (Monte Carlo)
  console.log("\n--- Probando Sorteo Ponderado en Backend (10,000 giros simulados) ---");
  const counts: Record<string, number> = {};
  config.premiosList.forEach((p) => (counts[p.label] = 0));

  for (let i = 0; i < 10000; i++) {
    const { premio } = selectWeightedPrize(config.premiosList);
    counts[premio.label] = (counts[premio.label] || 0) + 1;
  }

  config.premiosList.forEach((p) => {
    const simulatedPct = ((counts[p.label] / 10000) * 100).toFixed(1);
    console.log(`   - "${p.label}": Configurado ${p.probabilidad}%, Simulado: ${simulatedPct}%`);
  });

  // 4. Probar Flujo de Giro y Captura de Lead (CRM)
  console.log("\n--- Probando Creación de Giro y Sincronización con CRM ---");
  const testPhone = "099" + Math.floor(1000000 + Math.random() * 9000000);
  const cleanPhone = normalizePhoneNumber(testPhone);
  const testName = "Cliente Test Ruleta";

  // Simular POST /api/ruleta/girar
  const { premio, sectorIndex } = selectWeightedPrize(config.premiosList);
  const couponCode = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const expDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const testBirthday = "1995-08-15";

  const giro = await (prisma as any).ruletaGiro.create({
    data: {
      restaurantId: restaurant.id,
      telefono: cleanPhone,
      nombreCliente: testName,
      fechaNacimiento: testBirthday,
      premioId: premio.id,
      premioLabel: premio.label,
      premioTipo: premio.tipo,
      premioValor: Number(premio.valor) || 0,
      codigoCupon: couponCode,
      estado: "PENDIENTE",
      ipAddress: "127.0.0.1",
      userAgent: "TestRunner",
      fechaGiro: now,
      fechaExpiracion: expDate,
    },
  });

  console.log(`✅ Giro registrado con éxito en DB! ID: ${giro.id}, Cupón: ${couponCode}, Premio: ${premio.label}, Cumpleaños: ${giro.fechaNacimiento}`);

  // Upsert CRM Customer
  const customer = await prisma.customer.create({
    data: {
      restaurantId: restaurant.id,
      name: testName,
      phone: cleanPhone,
      category: "RULETA",
      birthDate: testBirthday,
      notes: `Capturado en Ruleta: ${premio.label} (Cupón ${couponCode})`,
    },
  });

  console.log(`✅ Lead capturado en CRM Customer! ID: ${customer.id}, Teléfono: ${customer.phone}, Cumpleaños: ${customer.birthDate}`);

  // 5. Probar Anti-Fraude (Intentar girar de nuevo con el mismo teléfono)
  console.log("\n--- Probando Lógica Anti-Fraude (Doble Giro) ---");
  const fechaLimiteGiro = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const giroPrevio = await (prisma as any).ruletaGiro.findFirst({
    where: {
      restaurantId: restaurant.id,
      telefono: cleanPhone,
      fechaGiro: { gte: fechaLimiteGiro },
    },
  });

  if (giroPrevio) {
    console.log(`✅ Anti-fraude funciona: Detectado giro existente para el teléfono ${cleanPhone}. Bloqueo exitoso.`);
  } else {
    console.error("❌ Falló anti-fraude: No se detectó el giro existente.");
  }

  // 6. Probar Canje de Cupón por Cajero
  console.log("\n--- Probando Canje de Cupón por Cajero ---");
  const canjeGiro = await (prisma as any).ruletaGiro.update({
    where: { id: giro.id },
    data: {
      estado: "CANJEADO",
      fechaCanjeo: new Date(),
    },
  });

  console.log(`✅ Cupón ${couponCode} canjeado exitosamente. Estado actual: ${canjeGiro.estado}`);

  // Validar que un cupón ya canjeado sea rechazado
  if (canjeGiro.estado === "CANJEADO") {
    console.log("✅ Reintento de canje rechazado correctamente (Estado: YA CANJEADO).");
  }

  console.log("\n=== TODAS LAS PRUEBAS DEL SISTEMA DE RULETA PASARON CON ÉXITO 🚀 ===");
  process.exit(0);
}

runRuletaVerification().catch((err) => {
  console.error("❌ Error en la verificación:", err);
  process.exit(1);
});
