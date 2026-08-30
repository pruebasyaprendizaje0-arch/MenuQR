const { PrismaClient: PrismaControlClient } = require("../node_modules/.prisma/control");
const { PrismaClient: PrismaTenantClient } = require("../node_modules/.prisma/tenant");
const bcrypt = require("bcryptjs");

const prismaControl = new PrismaControlClient();
const prismaTenant = new PrismaTenantClient();

async function main() {
  console.log("Seeding multi-tenant databases...");

  const trialEndDate = new Date();
  trialEndDate.setMonth(trialEndDate.getMonth() + 1);

  const hashedPassword = bcrypt.hashSync("admin123", 10);

  // 1. Create or upsert Admin User in Control DB
  const user = await prismaControl.user.upsert({
    where: { email: "admin@admin.com" },
    update: {},
    create: {
      id: "seed-user-admin-123",
      name: "Administrador Mamma Mia",
      email: "admin@admin.com",
      password: hashedPassword,
    },
  });

  // 2. Create or upsert Restaurant in Tenant DB
  let restaurant = await prismaTenant.restaurant.findUnique({
    where: { slug: "mamma-mia" },
  });

  if (!restaurant) {
    restaurant = await prismaTenant.restaurant.create({
      data: {
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
        locality: "Manta, Manabí, Ecuador",
        schedule: "Lunes a Domingo: 12:00 PM - 11:00 PM",
        specialty: "Pizza Napolitana & Pastas Artesanales",
        services: "Wi-Fi gratis, Parqueadero privado, Pet Friendly, Aire Acondicionado, Terraza exterior",
        contactNumbers: "+593 99 999 9999, +593 5 262 1234",
        instagram: "https://instagram.com/pizzeriamammamia",
        tiktok: "https://tiktok.com/@mammamiapizza",
        ubicameUrl: "https://ubicame.info/mamma-mia",
      },
    });

    const combos = await prismaTenant.category.create({
      data: { name: "Combos", order: 1, restaurantId: restaurant.id },
    });
    const pizzas = await prismaTenant.category.create({
      data: { name: "Pizzas", order: 2, restaurantId: restaurant.id },
    });
    const pastas = await prismaTenant.category.create({
      data: { name: "Pastas", order: 3, restaurantId: restaurant.id },
    });
    const bebidas = await prismaTenant.category.create({
      data: { name: "Bebidas", order: 4, restaurantId: restaurant.id },
    });

    await prismaTenant.dish.createMany({
      data: [
        {
          name: "Combo Pareja 🍕🍝",
          description: "1 Pizza Margherita grande + 1 Fettuccine Alfredo clásico + 2 Coca Colas heladas.",
          price: 26.5,
          imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: combos.id,
          restaurantId: restaurant.id,
        },
        {
          name: "Pizza Margherita",
          description: "Salsa de tomate, mozzarella premium, albahaca fresca y aceite de oliva.",
          price: 12.5,
          imageUrl: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: pizzas.id,
          restaurantId: restaurant.id,
        },
        {
          name: "Fettuccine Alfredo",
          description: "Pasta fresca al huevo con una salsa cremosa de queso parmesano.",
          price: 15.5,
          imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: pastas.id,
          restaurantId: restaurant.id,
        },
        {
          name: "Coca Cola",
          description: "Refresco clásico de 350ml bien helado.",
          price: 2.5,
          imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
          isAvailable: true,
          categoryId: bebidas.id,
          restaurantId: restaurant.id,
        },
      ],
    });
  }

  console.log("Seeding multi-tenant databases finished successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaControl.$disconnect();
    await prismaTenant.$disconnect();
  });
