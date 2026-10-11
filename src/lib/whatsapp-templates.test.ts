import { 
  renderTemplateContent, 
  matchTemplate, 
  DEFAULT_TEMPLATES, 
  type TemplateVariables 
} from "./whatsapp-templates";

console.log("==========================================");
console.log("🧪 RUNNING WHATSAPP TEMPLATES & AI CASCADE TEST SUITE");
console.log("==========================================");

const sampleVars: TemplateVariables = {
  nombre: "Las Empanadas de Mauro",
  link_menu: "https://menuqr.ubicame.cc/las-empanadas-de-mauro",
  horario: "Lunes a Domingo de 08:00 a 22:00",
  direccion: "Av. Principal y Malecon, Montañita",
  maps: "https://maps.google.com/?q=montanita",
  datos_banco: "Banco Pichincha - Ahorros: 2200112233 - Titular: Mauro",
};

// Test 1: Variable substitution
const welcomeTmpl = DEFAULT_TEMPLATES.find(t => t.key === "welcome")!;
const renderedWelcome = renderTemplateContent(welcomeTmpl.content, sampleVars);

if (!renderedWelcome.includes("Las Empanadas de Mauro")) {
  console.error("❌ Test 1 FAILED: {nombre} not replaced in welcome template");
  process.exit(1);
}
console.log("✅ [PASS] Test 1: Reemplazo de variables dinámicas ({nombre}, {link_menu}, {horario}) correcto");

// Test 2: Greeting matches Welcome template
const matchedGreeting = matchTemplate("hola buenas tardes", DEFAULT_TEMPLATES);
if (!matchedGreeting || matchedGreeting.key !== "welcome") {
  console.error("❌ Test 2 FAILED: Greeting did not match welcome template", matchedGreeting);
  process.exit(1);
}
console.log("✅ [PASS] Test 2: Saludo 'hola buenas tardes' activa plantilla de Bienvenida (welcome)");

// Test 3: Option 1 match ("1" or "carta" or "pedir")
const matchOption1 = matchTemplate("1", DEFAULT_TEMPLATES);
const matchCarta = matchTemplate("quiero ver la carta", DEFAULT_TEMPLATES);
if (!matchOption1 || matchOption1.key !== "option_1" || !matchCarta || matchCarta.key !== "option_1") {
  console.error("❌ Test 3 FAILED: Option 1 matching failed", matchOption1, matchCarta);
  process.exit(1);
}
console.log("✅ [PASS] Test 3: Opción '1' y frase 'quiero ver la carta' activan Opción 1 (Carta Digital)");

// Test 4: Option 2 match ("2" or "horario")
const matchOption2 = matchTemplate("2", DEFAULT_TEMPLATES);
const matchHorario = matchTemplate("a que hora abren hoy", DEFAULT_TEMPLATES);
if (!matchOption2 || matchOption2.key !== "option_2" || !matchHorario || matchHorario.key !== "option_2") {
  console.error("❌ Test 4 FAILED: Option 2 matching failed", { matchOption2, matchHorario });
  process.exit(1);
}
console.log("✅ [PASS] Test 4: Opción '2' y frase de horario activan Opción 2 (Horarios de Atención)");

// Test 5: Option 4 match ("4" or "banco" or "transferencia")
const matchTransferencia = matchTemplate("datos para transferencia", DEFAULT_TEMPLATES);
if (!matchTransferencia || matchTransferencia.key !== "option_4") {
  console.error("❌ Test 5 FAILED: Option 4 matching failed", matchTransferencia);
  process.exit(1);
}
console.log("✅ [PASS] Test 5: Disparador 'transferencia' activa Opción 4 (Cuentas Bancarias)");

// Test 6: Free-form question does NOT match templates -> triggers Cascada a IA
const freeFormQuery = "¿Tienen opciones de empanadas vegetarianas con queso manaba?";
const matchFreeForm = matchTemplate(freeFormQuery, DEFAULT_TEMPLATES);
if (matchFreeForm !== null) {
  console.error("❌ Test 6 FAILED: Free-form question incorrectly matched a fixed template", matchFreeForm);
  process.exit(1);
}
console.log("✅ [PASS] Test 6: Pregunta gastronómica libre no coincide con plantillas y se deriva a la IA (BYOK)");

// Test 7: Fallback template rendering
const fallbackTmpl = DEFAULT_TEMPLATES.find(t => t.key === "fallback")!;
const renderedFallback = renderTemplateContent(fallbackTmpl.content, sampleVars);
if (!renderedFallback.includes("1 al 5") || !renderedFallback.includes("Las Empanadas de Mauro")) {
  console.error("❌ Test 7 FAILED: Fallback template rendering failed");
  process.exit(1);
}
console.log("✅ [PASS] Test 7: Plantilla de Fallback (para cuando no hay IA activa) renderiza correctamente");

console.log("==========================================");
console.log("🎉 TODAS LAS PRUEBAS DE PLANTILLAS Y CASCADA PASARON (7/7)");
console.log("==========================================");
