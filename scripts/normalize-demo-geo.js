const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("Normalizing GEO data for Demo Businesses...");

  const trialEndDate = new Date();
  trialEndDate.setMonth(trialEndDate.getMonth() + 3);

  const hashedPassword = bcrypt.hashSync("admin123", 10);

  // 1. Ensure Owner User exists
  let user = await prisma.user.findUnique({
    where: { email: "admin@admin.com" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Administrador Mamma Mia",
        email: "admin@admin.com",
        password: hashedPassword,
      },
    });
  }

  // 2. Normalize Business 1: Mamma Mia
  const mammaMia = await prisma.restaurant.upsert({
    where: { slug: "mamma-mia" },
    update: {
      country: "Ecuador",
      province: "Manabí",
      city: "Manta",
      parish: "Manta",
      sector: "Barbasquillo",
      locality: "Barbasquillo, Manta, Manabí, Ecuador",
      address: "Av. Barbasquillo y Calle 24",
      latitude: -0.9548,
      longitude: -80.7482,
      seoTitle: "Mamma Mia | Pizzería & Pasta Artesanal en Manta, Manabí",
      seoDescription: "Disfruta de auténtica pizza napolitana al horno de leña y pastas artesanales en Av. Barbasquillo, Manta. Menú digital y pedidos por WhatsApp.",
    },
    create: {
      userId: user.id,
      slug: "mamma-mia",
      name: "Mamma Mia",
      logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      whatsapp: "593999999999",
      themeColor: "#ef4444",
      plan: "PRO",
      trialEndsAt: trialEndDate,
      description: "Auténtica pizza napolitana al horno de leña, pastas artesanales y el mejor ambiente familiar de Manta.",
      address: "Av. Barbasquillo y Calle 24",
      locality: "Barbasquillo, Manta, Manabí, Ecuador",
      country: "Ecuador",
      province: "Manabí",
      city: "Manta",
      parish: "Manta",
      sector: "Barbasquillo",
      latitude: -0.9548,
      longitude: -80.7482,
      schedule: "Lunes a Domingo: 12:00 PM - 11:00 PM",
      specialty: "Pizza Napolitana & Pastas Artesanales",
      services: "Wi-Fi gratis, Parqueadero privado, Pet Friendly, Aire Acondicionado, Terraza exterior",
      contactNumbers: "+593 99 999 9999, +593 5 262 1234",
      instagram: "https://instagram.com/pizzeriamammamia",
      tiktok: "https://tiktok.com/@mammamiapizza",
      ubicameUrl: "https://ubicame.info/mamma-mia",
      seoTitle: "Mamma Mia | Pizzería & Pasta Artesanal en Manta, Manabí",
      seoDescription: "Disfruta de auténtica pizza napolitana al horno de leña y pastas artesanales en Av. Barbasquillo, Manta. Menú digital y pedidos por WhatsApp.",
    },
  });

  console.log("✔ Normalized Business 1 (Mamma Mia):", mammaMia.slug, "-> Province:", mammaMia.province, "City:", mammaMia.city);

  // 3. Normalize Business 2: Las Empanadas de Mauro
  let mauro = await prisma.restaurant.findUnique({
    where: { slug: "las-empanadas-de-mauro" },
  });

  if (!mauro) {
    mauro = await prisma.restaurant.create({
      data: {
        userId: user.id,
        slug: "las-empanadas-de-mauro",
        name: "Las Empanadas de Mauro",
        logoUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        whatsapp: "593988888888",
        themeColor: "#f59e0b",
        plan: "PRO",
        trialEndsAt: trialEndDate,
        description: "Las verdaderas empanadas gigantes de Montañita con relleno gourmet de carne, queso y mariscos frente al mar.",
        address: "Calle Cócteles y Av. Segunda",
        locality: "Montañita, Santa Elena, Ecuador",
        country: "Ecuador",
        province: "Santa Elena",
        city: "Santa Elena",
        parish: "Manglaralto",
        sector: "Montañita",
        latitude: -1.8267,
        longitude: -80.7533,
        schedule: "Lunes a Domingo: 16:00 PM - 02:00 AM",
        specialty: "Empanadas Gigantes & Cocteles",
        services: "Wi-Fi gratis, Vista al mar, Música en vivo, Pago con transferencia",
        contactNumbers: "+593 98 888 8888",
        instagram: "https://instagram.com/empanadasdemauro",
        ubicameUrl: "https://ubicame.info/las-empanadas-de-mauro",
        seoTitle: "Las Empanadas de Mauro | Empanadas Gigantes en Montañita, Santa Elena",
        seoDescription: "Empanadas gigantes gourmet de carne, queso y mariscos en Montañita, Santa Elena. Menú digital interactivo y pedidos por WhatsApp.",
      },
    });

    const empanadasCat = await prisma.category.create({
      data: { name: "Empanadas", order: 1, restaurantId: mauro.id },
    });

    const bebidasCat = await prisma.category.create({
      data: { name: "Bebidas & Cocteles", order: 2, restaurantId: mauro.id },
    });

    await prisma.dish.createMany({
      data: [
        {
          name: "Empanada Gigante de Carne y Queso 🥐🧀",
          description: "Masa crujiente artesanal rellena de abundante carne de res sazonada y queso manaba derretido.",
          price: 3.5,
          imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: empanadasCat.id,
          restaurantId: mauro.id,
        },
        {
          name: "Empanada Gigante de Camarón 🍤",
          description: "Rellena de jugosos camarones del Pacífico en salsa de la casa con queso derretido.",
          price: 4.5,
          imageUrl: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: empanadasCat.id,
          restaurantId: mauro.id,
        },
        {
          name: "Mojito Playero 🍹",
          description: "Ron blanco, menta fresca, limón recién exprimido y soda helada.",
          price: 5.0,
          imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: bebidasCat.id,
          restaurantId: mauro.id,
        },
        {
          name: "Jugo Natural de Maracuyá 🥤",
          description: "Jugo de maracuyá 100% natural bien helado (500ml).",
          price: 2.5,
          imageUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: bebidasCat.id,
          restaurantId: mauro.id,
        },
      ],
    });
  } else {
    mauro = await prisma.restaurant.update({
      where: { id: mauro.id },
      data: {
        country: "Ecuador",
        province: "Santa Elena",
        city: "Santa Elena",
        parish: "Manglaralto",
        sector: "Montañita",
        locality: "Montañita, Santa Elena, Ecuador",
        address: "Calle Cócteles y Av. Segunda",
        latitude: -1.8267,
        longitude: -80.7533,
        seoTitle: "Las Empanadas de Mauro | Empanadas Gigantes en Montañita, Santa Elena",
        seoDescription: "Empanadas gigantes gourmet de carne, queso y mariscos en Montañita, Santa Elena. Menú digital interactivo y pedidos por WhatsApp.",
      },
    });
  }

  console.log("✔ Normalized Business 2 (Las Empanadas de Mauro):", mauro.slug, "-> Province:", mauro.province, "City:", mauro.city);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
