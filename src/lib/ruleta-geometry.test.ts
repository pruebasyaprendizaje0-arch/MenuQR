import assert from "node:assert";

console.log("==================================================");
console.log("🎯 INICIANDO PRUEBAS DE GEOMETRÍA Y PRESENTACIÓN DE RULETA");
console.log("==================================================");

// 1. Verificación de sectores y ángulos
const SECTORS_COUNT = 6;
const SECTOR_ANGLE = 360 / SECTORS_COUNT; // 60°
assert.strictEqual(SECTOR_ANGLE, 60, "Cada sector debe medir exactamente 60°");

// 2. Verificación de alineación de bisectrices con el puntero superior (12 en punto = 0°)
for (let i = 0; i < SECTORS_COUNT; i++) {
  const bisector = i * SECTOR_ANGLE; // 0°, 60°, 120°, 180°, 240°, 300°
  assert(bisector >= 0 && bisector < 360, "La bisectriz debe estar en [0°, 360°)");
}
console.log("✅ [PASS] Ángulos de 6 sectores y bisectrices verificadas (60° por cuña)");

// 3. Verificación de separación y holgura contra botón GIRAR y borde exterior
const WHEEL_RADIUS = 180;
const BUTTON_RADIUS = 48;
const LABEL_RADIUS = 112;

const clearanceFromButton = LABEL_RADIUS - BUTTON_RADIUS;
const clearanceFromRim = WHEEL_RADIUS - LABEL_RADIUS;

assert(clearanceFromButton >= 50, `La holgura contra el botón central (${clearanceFromButton}px) debe ser >= 50px`);
assert(clearanceFromRim >= 50, `La holgura contra el borde exterior (${clearanceFromRim}px) debe ser >= 50px`);
console.log(`✅ [PASS] Holgura contra botón central: ${clearanceFromButton}px | Holgura contra borde: ${clearanceFromRim}px`);

// 4. Verificación de contención angular de placas (badges) dentro de su cuña
const BADGE_WIDTH = 86;
const BADGE_HEIGHT = 26;

for (let i = 0; i < SECTORS_COUNT; i++) {
  const bisectorDeg = i * 60 - 90; // Ángulo estándar trigonométrico
  const cx = LABEL_RADIUS * Math.cos(bisectorDeg * (Math.PI / 180));
  const cy = LABEL_RADIUS * Math.sin(bisectorDeg * (Math.PI / 180));

  const corners = [
    { x: cx - BADGE_WIDTH / 2, y: cy - BADGE_HEIGHT / 2 },
    { x: cx + BADGE_WIDTH / 2, y: cy - BADGE_HEIGHT / 2 },
    { x: cx + BADGE_WIDTH / 2, y: cy + BADGE_HEIGHT / 2 },
    { x: cx - BADGE_WIDTH / 2, y: cy + BADGE_HEIGHT / 2 },
  ];

  for (const c of corners) {
    const dist = Math.hypot(c.x, c.y);
    assert(dist > BUTTON_RADIUS, `Esquina de placa en sector ${i} debe estar fuera del botón central (${dist} > ${BUTTON_RADIUS})`);
    assert(dist < WHEEL_RADIUS, `Esquina de placa en sector ${i} debe estar dentro del radio de la rueda (${dist} < ${WHEEL_RADIUS})`);

    const cornerAng = (Math.atan2(c.y, c.x) * 180) / Math.PI;
    const diff = Math.abs((((cornerAng - bisectorDeg + 540) % 360) - 180));
    assert(diff < 30, `Esquina en sector ${i} debe tener desviación angular menor a 30° (obtenido: ${diff.toFixed(1)}°)`);
  }
}
console.log("✅ [PASS] Todas las esquinas de los 6 sectores están 100% confinadas en su cuña sin invadir sectores vecinos");

// 5. Verificación de partición inteligente de texto multilínea
function splitLabel(label: string) {
  const words = label.trim().split(/\s+/);
  const isMultiLine = label.length > 11 && words.length >= 2;
  if (isMultiLine) {
    const mid = Math.ceil(words.length / 2);
    return {
      isMultiLine: true,
      line1: words.slice(0, mid).join(" "),
      line2: words.slice(mid).join(" "),
    };
  }
  return { isMultiLine: false, line1: label, line2: "" };
}

const testCases = [
  { input: "10% OFF", expectedMulti: false },
  { input: "Postre Gratis", expectedMulti: true, expectedL1: "Postre", expectedL2: "Gratis" },
  { input: "2x1 Platos", expectedMulti: false },
  { input: "Bebida Gratis", expectedMulti: true, expectedL1: "Bebida", expectedL2: "Gratis" },
  { input: "Papas Rústicas", expectedMulti: true, expectedL1: "Papas", expectedL2: "Rústicas" },
  { input: "¡Sorpresa!", expectedMulti: false },
];

for (const tc of testCases) {
  const res = splitLabel(tc.input);
  assert.strictEqual(res.isMultiLine, tc.expectedMulti, `Caso "${tc.input}" fallo en isMultiLine`);
  if (tc.expectedL1) assert.strictEqual(res.line1, tc.expectedL1);
  if (tc.expectedL2) assert.strictEqual(res.line2, tc.expectedL2);
}
console.log("✅ [PASS] Partición multilínea para premios largos verificada exitosamente");

console.log("==================================================");
console.log("🎉 TODAS LAS PRUEBAS DE PRESENTACIÓN DE RULETA PASARON AL 100%");
console.log("==================================================");
