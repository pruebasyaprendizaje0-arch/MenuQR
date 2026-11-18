/**
 * Proveedor de datos demo enriquecidos en memoria para MenuQR y Catálogo (Ubícame Pro)
 * Asegura que las páginas de muestra (/demo, /[slug]/[dishSlug], /ruleta/demo)
 * funcionen de inmediato sin arrojar errores 404 ni productos sin existencias.
 */

export interface DemoDishItem {
  id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  isSuggested: boolean;
  stock: number;
  trackStock: boolean;
  minStock: number;
  category?: { id: string; name: string };
  modifierGroups?: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: Array<{
      id: string;
      name: string;
      extraPrice: number;
      isDefault: boolean;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function getMockDemoRestaurant() {
  const now = new Date().toISOString();

  const dishes: DemoDishItem[] = [
    {
      id: "dish-1",
      name: "Smash Burger Trufada",
      slug: "smash-burger-trufada",
      description: "Doble carne angus 180g, queso cheddar fundido, cebolla caramelizada, tocineta crocante y mayo de trufas negras en pan brioche artesanal.",
      price: 9.50,
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
      isAvailable: true,
      isSuggested: true,
      stock: 50,
      trackStock: true,
      minStock: 5,
      modifierGroups: [
        {
          id: "mod-term",
          name: "Término de la carne",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          options: [
            { id: "term-1", name: "Término Medio (Jugosa)", extraPrice: 0, isDefault: true },
            { id: "term-2", name: "Tres Cuartos", extraPrice: 0, isDefault: false },
            { id: "term-3", name: "Bien Cocida", extraPrice: 0, isDefault: false },
          ],
        },
        {
          id: "mod-extra",
          name: "Acompañamiento",
          required: false,
          minSelect: 0,
          maxSelect: 2,
          options: [
            { id: "opt-papas", name: "Papas Rústicas al Romero", extraPrice: 1.50, isDefault: false },
            { id: "opt-aros", name: "Aros de Cebolla Crocantes", extraPrice: 2.00, isDefault: false },
            { id: "opt-queso", name: "Extra Queso Cheddar Fundido", extraPrice: 1.25, isDefault: false },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dish-2",
      name: "Bacon Cheeseburger Monster",
      slug: "bacon-cheeseburger-monster",
      description: "Carne a la parrilla, queso colby jack, salsa BBQ ahumada artesanal, aros de cebolla y pan brioche horneado a diario.",
      price: 8.75,
      imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80",
      isAvailable: true,
      isSuggested: false,
      stock: 50,
      trackStock: true,
      minStock: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dish-3",
      name: "Bife de Chorizo 400g",
      slug: "bife-de-chorizo-400g",
      description: "Corte premium certificado, papas rústicas al romero, ensalada fresca de la huerta y chimichurri criollo.",
      price: 18.50,
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
      isAvailable: true,
      isSuggested: true,
      stock: 35,
      trackStock: true,
      minStock: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dish-4",
      name: "Cerveza IPA Tropical 473ml",
      slug: "cerveza-ipa-tropical-473ml",
      description: "Cerveza artesanal de autor con aromas a maracuyá y mango, amargor balanceado y cuerpo sedoso. Servida bien fría.",
      price: 4.50,
      // Fotografía de cerveza artesanal verificada y de alta disponibilidad en Unsplash
      imageUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800&auto=format&fit=crop&q=80",
      isAvailable: true,
      isSuggested: false,
      stock: 60,
      trackStock: true,
      minStock: 10,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    id: "demo-restaurant-id",
    userId: "demo-user",
    name: "La Parrilla Criolla & Bar (Demo)",
    slug: "demo",
    whatsapp: "593999999999",
    whatsappNumber: "593999999999",
    phone: "593999999999",
    themeColor: "#ef4444",
    logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80",
    address: "Av. República de El Salvador y Moscú, Quito",
    description: "Cortes madurados a la brasa, hamburguesas ahumadas, cervezas artesanales y cócteles de autor.",
    locality: "Quito Norte",
    city: "Quito",
    specialty: "Carnes a la Parrilla y Hamburguesas",
    plan: "PRO",
    tablesConfig: "1,2,3,4,5,6,7,8,9,10,Terraza 1,Terraza 2",
    ivaPercent: 15.0,
    servicePercent: 10.0,
    deliveryCost: 1.50,
    deliveryEnabled: true,
    ivaOnTable: true,
    ivaOnTakeout: true,
    serviceOnTable: true,
    serviceOnTakeout: false,
    trialEndsAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    createdAt: now,
    updatedAt: now,
    isOwner: false,
    isRuletaActiva: true,
    ruletaConfig: {
      id: "demo-ruleta-config-id",
      premio1Label: "10% de Descuento",
      premio1Tipo: "descuento",
      premio1Valor: 10,
      premio2Label: "Postre Artesanal Gratis",
      premio2Tipo: "postre",
      premio2Valor: 0,
      premio3Label: "Cerveza IPA Gratis",
      premio3Tipo: "bebida",
      premio3Valor: 0,
      premio4Label: "Papas Rústicas Gratis",
      premio4Tipo: "regalo",
      premio4Valor: 0,
      premio5Label: "$5.00 de Descuento",
      premio5Tipo: "monto",
      premio5Valor: 5,
      premio6Label: "Sigue Participando",
      premio6Tipo: "nada",
      premio6Valor: 0,
      expiracionHoras: 24,
    },
    categories: [
      {
        id: "cat-1",
        name: "🍔 Hamburguesas de Autor",
        order: 1,
        imageAspectRatio: "DEFAULT",
        restaurantId: "demo-restaurant-id",
        createdAt: now,
        updatedAt: now,
        dishes: [dishes[0], dishes[1]],
      },
      {
        id: "cat-2",
        name: "🥩 Cortes a la Brasa",
        order: 2,
        imageAspectRatio: "DEFAULT",
        restaurantId: "demo-restaurant-id",
        createdAt: now,
        updatedAt: now,
        dishes: [dishes[2]],
      },
      {
        id: "cat-3",
        name: "🍺 Cervezas Artesanales & Bebidas",
        order: 3,
        imageAspectRatio: "DEFAULT",
        restaurantId: "demo-restaurant-id",
        createdAt: now,
        updatedAt: now,
        dishes: [dishes[3]],
      },
    ],
    seasonRates: [],
  };
}

export function getMockDemoDish(dishSlug: string) {
  const demoRest = getMockDemoRestaurant();
  const clean = dishSlug.toLowerCase().trim();
  const allDishes = demoRest.categories.flatMap(c => c.dishes);
  const dish = allDishes.find(d =>
    d.id === clean ||
    d.slug === clean ||
    d.name.toLowerCase().includes(clean.replace(/-/g, " ")) ||
    clean.includes(d.id)
  ) || allDishes[0];

  return {
    restaurant: demoRest,
    dish,
  };
}

export function getMockDemoStore() {
  const now = new Date().toISOString();
  return {
    id: "demo-boutique-id",
    name: "Aura Boutique & Calzado Urbano (Demo)",
    slug: "demo",
    whatsapp: "593999999999",
    logoUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=80",
    coverUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&auto=format&fit=crop&q=80",
    address: "Mall del Sol, Nivel 2, Local 45, Guayaquil",
    description: "Colección exclusiva de moda femenina, calzado en cuero genuino, joyas en plata 925 y accesorios de temporada.",
    galleryImages: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1000&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1000&auto=format&fit=crop&q=80",
    ],
    deliveryCost: 1.50, // Flete base consistente
    deliveryRates: JSON.stringify([
      { id: "km-1", label: "Hasta 2 KM (Zona Centro / Mall)", price: 1.50, minOrder: 0 },
      { id: "km-2", label: "De 2 a 5 KM (Norte / Samborondón)", price: 2.50, minOrder: 10 },
      { id: "km-3", label: "De 5 a 10 KM (Vía a la Costa)", price: 4.00, minOrder: 15 },
      { id: "km-4", label: "Más de 10 KM (Periferia / Cantones)", price: 6.00, minOrder: 25 },
    ]),
    enableDelivery: true,
    enableTakeout: true,
    taxRate: 15.0,
    serviceRate: 0.0,
    categories: [
      {
        id: "cat-calzado",
        name: "👟 Calzado & Sneakers",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-1",
            name: "Sneakers Urbanos Blancos Suela Chunky",
            description: "Calzado de cuero sintético premium transpirable, plantilla acolchada y suela antideslizante.",
            price: 49.99,
            imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80",
            hasVariants: true,
            attribute1Name: "Talla",
            attribute1Options: ["36", "37", "38", "39", "40"],
            attribute2Name: "Color",
            attribute2Options: ["Blanco Puro", "Blanco con Detalles Oro", "Beige Arena"],
            tallas: ["36", "37", "38", "39", "40"],
            colores: ["Blanco Puro", "Blanco con Detalles Oro", "Beige Arena"],
            stock: 25,
            trackStock: true,
            isAvailable: true,
            isNew: true,
          },
          {
            id: "prod-2",
            name: "Botines de Cuero Chelsea Dark",
            description: "Botines clásicos con elásticos laterales, forro térmico suave y tacón bajo cuadrado de 4 cm.",
            price: 68.00,
            imageUrl: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80",
            hasVariants: true,
            attribute1Name: "Talla",
            attribute1Options: ["37", "38", "39", "40", "41"],
            attribute2Name: "Color",
            attribute2Options: ["Negro Mate", "Café Chocolate", "Vino"],
            tallas: ["37", "38", "39", "40", "41"],
            colores: ["Negro Mate", "Café Chocolate", "Vino"],
            stock: 20,
            trackStock: true,
            isAvailable: true,
            isNew: false,
          },
        ],
      },
      {
        id: "cat-ropa",
        name: "👗 Ropa & Prendas",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-3",
            name: "Vestido Midi Plisado Seda Fría",
            description: "Corte evasé con escote en V, cinto ajustable a la cintura y falda fluida con forro interno.",
            price: 39.50,
            imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80",
            hasVariants: true,
            attribute1Name: "Talla",
            attribute1Options: ["S", "M", "L", "XL"],
            attribute2Name: "Color",
            attribute2Options: ["Verde Esmeralda", "Terracota", "Negro Clásico", "Azul Noche"],
            tallas: ["S", "M", "L", "XL"],
            colores: ["Verde Esmeralda", "Terracota", "Negro Clásico", "Azul Noche"],
            stock: 30,
            trackStock: true,
            isAvailable: true,
            isNew: true,
          },
          {
            id: "prod-4",
            name: "Blazer Oversize Sastrería Chic",
            description: "Chaqueta estructurada con hombreras suaves, solapa invertida y botones dorados grabados.",
            price: 45.00,
            imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80",
            hasVariants: true,
            attribute1Name: "Talla",
            attribute1Options: ["S", "M", "L"],
            attribute2Name: "Color",
            attribute2Options: ["Beige Camel", "Blanco Marfil", "Negro", "Lila Pastel"],
            tallas: ["S", "M", "L"],
            colores: ["Beige Camel", "Blanco Marfil", "Negro", "Lila Pastel"],
            stock: 18,
            trackStock: true,
            isAvailable: true,
            isNew: false,
          },
        ],
      },
      {
        id: "cat-joyas",
        name: "💍 Joyería & Accesorios",
        imageAspectRatio: "DEFAULT",
        products: [
          {
            id: "prod-5",
            name: "Juego de Aretes y Collar Perlas Barrocas",
            description: "Bañado en oro de 18k hipoalergénico con perlas de agua dulce cultivadas. Incluye estuche de regalo.",
            price: 28.00,
            imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80",
            hasVariants: true,
            attribute1Name: "Presentación",
            attribute1Options: ["Oro 18k", "Plata 925"],
            attribute2Name: "Estuche",
            attribute2Options: ["Estuche Tradicional", "Estuche Premium Terciopelo"],
            tallas: ["Oro 18k", "Plata 925"],
            colores: ["Estuche Tradicional", "Estuche Premium Terciopelo"],
            stock: 40,
            trackStock: true,
            isAvailable: true,
            isNew: true,
          },
        ],
      },
    ],
  };
}
