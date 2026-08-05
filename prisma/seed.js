const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // Clean database
  await prisma.dish.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.restaurant.deleteMany({});
  await prisma.user.deleteMany({});

  // 1 month in the future
  const trialEndDate = new Date();
  trialEndDate.setMonth(trialEndDate.getMonth() + 1);

  // Hash password for default admin user
  const hashedPassword = bcrypt.hashSync("admin123", 10);

  // Create default Owner User
  const user = await prisma.user.create({
    data: {
      name: "Administrador Mamma Mia",
      email: "admin@admin.com",
      password: hashedPassword,
    }
  });

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      userId: user.id,
      slug: "mamma-mia",
      name: "Mamma Mia",
      logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      whatsapp: "593999999999", // Ecuador WhatsApp number
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

  // Create categories
  const combos = await prisma.category.create({
    data: {
      name: "Combos",
      order: 1,
      restaurantId: restaurant.id,
    },
  });

  const pizzas = await prisma.category.create({
    data: {
      name: "Pizzas",
      order: 2,
      restaurantId: restaurant.id,
    },
  });

  const pastas = await prisma.category.create({
    data: {
      name: "Pastas",
      order: 3,
      restaurantId: restaurant.id,
    },
  });

  const bebidas = await prisma.category.create({
    data: {
      name: "Bebidas",
      order: 4,
      restaurantId: restaurant.id,
    },
  });

  // Create dishes
  await prisma.dish.createMany({
    data: [
      {
        name: "Combo Pareja 🍕🍝",
        description: "1 Pizza Margherita grande + 1 Fettuccine Alfredo clásico + 2 Coca Colas heladas. Ideal para compartir.",
        price: 26.5,
        imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        isAvailable: true,
        categoryId: combos.id,
        restaurantId: restaurant.id,
      },
      {
        name: "Combo Familiar 👨‍👩‍👧‍👦",
        description: "2 Pizzas Pepperoni grandes + 1 Lasagna de Carne grande + 1 Botella de Agua Mineral. ¡El favorito de los domingos!",
        price: 39.99,
        imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        isAvailable: true,
        categoryId: combos.id,
        restaurantId: restaurant.id,
      },
      {
        name: "Combo Individual 🍕🥤",
        description: "1 Pizza Margherita personal + 1 Bebida a elección (Coca Cola o Agua). Almuerzo rápido y delicioso.",
        price: 13.5,
        imageUrl: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
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
        name: "Pizza Pepperoni",
        description: "Mozzarella premium, abundante pepperoni americano y orégano.",
        price: 14.0,
        imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        isAvailable: true,
        categoryId: pizzas.id,
        restaurantId: restaurant.id,
      },
      {
        name: "Fettuccine Alfredo",
        description: "Pasta fresca al huevo con una salsa cremosa de queso parmesano y manteca.",
        price: 15.5,
        imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        isAvailable: true,
        categoryId: pastas.id,
        restaurantId: restaurant.id,
      },
      {
        name: "Lasagna de Carne",
        description: "Capas de pasta rellenas de boloñesa casera, salsa bechamel y queso gratinado.",
        price: 17.0,
        imageUrl: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
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
      {
        name: "Agua Mineral",
        description: "Agua mineral sin gas de 500ml.",
        price: 2.0,
        imageUrl: "https://images.unsplash.com/photo-1608885898957-a599fb1b468e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        isAvailable: true,
        categoryId: bebidas.id,
        restaurantId: restaurant.id,
      },
    ],
  });

  console.log("Seeding finished successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
