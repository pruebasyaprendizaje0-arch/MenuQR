import {
  DEFAULT_ELEMENT_FILTERS_CONFIG,
  PRESET_CONFIGS,
  ElementFiltersConfig,
  ElementTag,
} from "./element-filters-types";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
  } catch (error: any) {
    console.error(`❌ [FAIL] ${name}:`, error.message);
    process.exit(1);
  }
}

function assertEquals(actual: any, expected: any, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || "Assertion failed"}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(msg || "Assertion failed: expected true, got false");
  }
}

function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

console.log("=== INICIANDO PRUEBAS UNITARIAS: FILTROS DE PROTEÍNAS & PLATO DEL DÍA ===");

// Test 1: Configuración inicial apagada por defecto
runTest("El módulo debe venir desactivado por defecto (enabled: false)", () => {
  assertEquals(DEFAULT_ELEMENT_FILTERS_CONFIG.enabled, false);
});

// Test 2: Integridad de las plantillas por tipo de negocio
runTest("Las plantillas por negocio deben contener elementos válidos", () => {
  const presets = ["mariscos", "cafeteria", "pizzeria", "parrillada"] as const;
  for (const p of presets) {
    const config = PRESET_CONFIGS[p];
    assertTrue(config.elements.length > 0, `Preset ${p} debe tener elementos`);
    assertTrue(config.title.length > 0, `Preset ${p} debe tener título`);
    for (const el of config.elements) {
      assertTrue(el.keywords.length > 0, `Elemento ${el.label} debe tener palabras clave`);
      assertTrue(typeof el.priority === "number", `Elemento ${el.label} debe tener prioridad`);
      assertTrue(Boolean(el.stockLevel), `Elemento ${el.label} debe tener stockLevel`);
    }
  }
});

// Test 3: Motor de búsqueda en platos reales (no inventa platos)
runTest("Debe hacer match preciso de palabras clave sobre platos reales existentes", () => {
  const mockDishes = [
    { id: "d1", name: "Ceviche de Camarón", description: "Fresco con cebolla y cilantro" },
    { id: "d2", name: "Corvina a la Plancha", description: "Pescado fresco del día con arroz" },
    { id: "d3", name: "Capuccino de Almendras", description: "Café espresso con leche de almendra" },
    { id: "d4", name: "Pizza Pepperoni", description: "Masa fina con mozzarella y embutido" },
  ];

  const camaronTag: ElementTag = {
    id: "mar-1",
    label: "Camarón",
    keywords: ["camaron", "camarones", "shrimp"],
  };

  const cafeTag: ElementTag = {
    id: "caf-1",
    label: "Café",
    keywords: ["cafe", "café", "espresso", "capuccino"],
  };

  const matchCamaron = mockDishes.filter((dish) => {
    const combined = normalizeText(`${dish.name} ${dish.description}`);
    return camaronTag.keywords.some((kw) => combined.includes(normalizeText(kw)));
  });

  assertEquals(matchCamaron.length, 1);
  assertEquals(matchCamaron[0].id, "d1");

  const matchCafe = mockDishes.filter((dish) => {
    const combined = normalizeText(`${dish.name} ${dish.description}`);
    return cafeTag.keywords.some((kw) => combined.includes(normalizeText(kw)));
  });

  assertEquals(matchCafe.length, 1);
  assertEquals(matchCafe[0].id, "d3");
});

// Test 4: Manejo de stock agotado
runTest("Los elementos con stock AGOTADO deben ordenarse al final o ser deshabilitados", () => {
  const elements: ElementTag[] = [
    { id: "1", label: "Pulpo", keywords: ["pulpo"], stockLevel: "AGOTADO", priority: 5 },
    { id: "2", label: "Camarón", keywords: ["camaron"], stockLevel: "MUCHO", priority: 4 },
    { id: "3", label: "Pescado", keywords: ["pescado"], stockLevel: "POCO", priority: 3 },
  ];

  const sorted = [...elements].sort((a, b) => {
    if (a.stockLevel === "AGOTADO" && b.stockLevel !== "AGOTADO") return 1;
    if (b.stockLevel === "AGOTADO" && a.stockLevel !== "AGOTADO") return -1;
    return (b.priority || 3) - (a.priority || 3);
  });

  assertEquals(sorted[0].id, "2"); // Camarón (MUCHO, priority 4)
  assertEquals(sorted[1].id, "3"); // Pescado (POCO, priority 3)
  assertEquals(sorted[2].id, "1"); // Pulpo (AGOTADO al final)
});

// Test 5: Plato del Día
runTest("Platos marcados en dailySpecialDishIds deben ser identificados correctamente", () => {
  const mockConfig: ElementFiltersConfig = {
    ...DEFAULT_ELEMENT_FILTERS_CONFIG,
    dailySpecialDishIds: ["d2", "d4"],
  };

  const allDishes = [
    { id: "d1", name: "Plato 1" },
    { id: "d2", name: "Plato Especial 2" },
    { id: "d3", name: "Plato 3" },
    { id: "d4", name: "Plato Especial 4" },
  ];

  const specials = allDishes.filter((d) => mockConfig.dailySpecialDishIds?.includes(d.id));
  assertEquals(specials.length, 2);
  assertEquals(specials.map((s) => s.id), ["d2", "d4"]);
});

console.log("🎉 ¡TODAS LAS PRUEBAS DE FILTROS & PLATO DEL DÍA PASARON SATISFACTORIAMENTE!");
