# INFORME TÉCNICO FORMAL DE AUDITORÍA PRE-COMERCIAL: MENUQR
**URL de Producción:** `https://menuqr.ubicame.cc`  
**Vertical:** Menú Digital QR, KDS Cocina, Comandero de Meseros y Caja POS para Restaurantes, Bares y Cafeterías.

---

## 1. ENCABEZADO EJECUTIVO

| Parámetro | Detalle |
| :--- | :--- |
| **Fecha de Auditoría** | 18 de Noviembre de 2026 |
| **Auditor Líder** | Principal QA Engineer, Full-Stack Architect & Security Auditor |
| **Entorno Analizado** | Staging / Pre-Producción (Coolify en VPS Vultr) & Workspace Local |
| **Stack Tecnológico** | Next.js 16 (Turbopack, Server Actions), React 19, TypeScript, Prisma ORM 6.2, PostgreSQL, Socket.IO 4.8 |
| **Mercado Objetivo** | Ecuador (SRI, Código de Trabajo / Ley de Turismo, Métodos de Pago: Deuna, Efectivo, Tarjeta/Payphone) |
| **Veredicto Final de Go-Live** | **`LISTO PARA VENDER`** *(Bloqueantes críticos remediados y verificados al 100%)* |

### Resumen del Veredicto
La vertical **MenuQR** ha superado con éxito la auditoría técnica integral y las pruebas de esfuerzo numéricas. Durante la inspección se identificaron y subsanaron **3 vulnerabilidades de severidad Alta/Crítica** (eliminación de la puerta trasera de PIN universal `1234`, bloqueo de fuga multi-tenant por fallback anónimo en `/api/pedidos`, y corrección estricta del 10% de servicio para que sea `$0.00` en Para Llevar y Delivery conforme a la legislación ecuatoriana).  
Con la suite de pruebas `src/lib/menuqr-audit-pre-venta.test.ts` ejecutándose al 100% de efectividad y la verificación estricta de TypeScript (`npx tsc --noEmit` con 0 errores), la plataforma se declara **técnicamente apta para el inicio de comercialización y onboarding de clientes reales**.

---

## 2. MATRIZ DE EVALUACIÓN POR MÓDULO (15 PUNTOS CRÍTICOS)

| # | Módulo Crítico | Estado | Archivos Auditados | Evidencia / Prueba Realizada |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Aislamiento Multi-Tenant** | ✅ APROBADO | `src/app/api/pedidos/route.ts`<br>`src/lib/admin-auth.ts` | Eliminado fallback `LIMIT 1`. Todas las consultas exigen `negocio_id` o `slug` válido. |
| **2** | **Control de Roles y PIN** | ✅ APROBADO | `src/app/api/camareros/validar-pin/route.ts`<br>`src/app/api/cocina/validar-pin/route.ts`<br>`src/lib/staff-actions.ts` | Eliminado PIN universal `"1234"`. Validación estricta `pinIngresado === pinAlmacenado`. |
| **3** | **Resiliencia Socket.IO** | ✅ APROBADO | `src/lib/socket-server.ts`<br>`src/app/cocina/components/CocinaClient.tsx` | Rooms `negocio_${id}` con fallback de polling HTTP a PostgreSQL cada 8s ante microcortes. |
| **4** | **Cálculo de IVA (15%)** | ✅ APROBADO | `src/lib/actions.ts`<br>`src/app/[slug]/components/MenuClient.tsx`<br>`src/lib/order-sync.ts` | Soporte dual: IVA adicional (suma 15%) e IVA incluido (desglose inverso SRI: Base = Total / 1.15). |
| **5** | **10% de Servicio (Ecuador)** | ✅ APROBADO | `src/lib/actions.ts`<br>`src/app/api/pedidos/route.ts`<br>`src/app/caja/CajaClient.tsx` | Aplicado **únicamente** en `MESA / SALÓN`. Estrictamente `$0.00` en `LLEVAR` y `DELIVERY`. |
| **6** | **Delivery por KM (Haversine)** | ✅ APROBADO | `src/lib/geo-utils.ts`<br>`src/app/[slug]/components/MenuClient.tsx` | Cálculo ortodrómico por tramos (0-2 km, 2-5 km, 5-10 km, +10 km) validado con GPS real. |
| **7** | **Monto Mínimo de Pedido** | ✅ APROBADO | `src/lib/actions.ts` (L. 2905)<br>`MenuClient.tsx` | Backend rechaza pedidos inferiores al `minOrder` configurado por zona con error explícito. |
| **8** | **Modificadores e Inventario** | ✅ APROBADO | `src/lib/actions.ts` (L. 2725-2754)<br>`src/lib/stock-service.ts` | Modificadores validan y suman precio antes de impuestos; platos agotados bloquean pedido. |
| **9** | **Tarifas y Temporadas** | ✅ APROBADO | `src/lib/actions.ts` (L. 2851)<br>`src/app/[slug]/components/MenuClient.tsx` | Fechas activas aplican sobreprecios/descuentos en nuevas órdenes sin mutar historial cerrado. |
| **10** | **Generador de QR de Mesa** | ✅ APROBADO | `src/lib/table-token.ts`<br>`src/app/admin/components/AdminDashboard.tsx` | URLs generadas con token criptográfico HMAC (`?mesa=X&auth=TOKEN`) previenen suplantación. |
| **11** | **Momento 1: Salón (Mesas)** | ✅ APROBADO | `src/app/api/pedidos/route.ts`<br>`src/app/api/pedidos/llamar-mesero/route.ts` | Rondas adicionales consolidan cuenta con `es_añadido: true` y emiten `items_añadidos` a cocina. |
| **12** | **Momento 2: Take Away** | ✅ APROBADO | `src/lib/actions.ts`<br>`src/app/caja/CajaClient.tsx` | Etiquetado `🥡 PARA LLEVAR`, sin flete, $0 servicio y cálculo de tiempo de preparación. |
| **13** | **Momento 3: Delivery** | ✅ APROBADO | `src/app/[slug]/components/MenuClient.tsx`<br>`src/lib/actions.ts` | Dirección obligatoria, flete por km, desglose de cambio en efectivo y formato de WhatsApp optimizado. |
| **14** | **KDS, Meseros y Split Bill** | ✅ APROBADO | `src/app/cocina/components/CocinaClient.tsx`<br>`src/lib/split-bill-actions.ts` | División equitativa distribuye centavos residuales (suma 100% exacta sin pérdida de centavos). |
| **15** | **Caja POS y Reporte Z (80mm)**| ✅ APROBADO | `src/lib/caja-actions.ts`<br>`src/app/caja/components/ReporteZTicketModal.tsx` | `CashShift` reconcilia ventas por medio (Efectivo, Tarjeta, Transferencia, Deuna) y diferencia. |

---

## 3. HALLAZGOS Y BUGS DETECTADOS (CLASIFICADOS POR SEVERIDAD)

### 🔴 HALLAZGO 1: Bypass Universal de Autenticación de Meseros (CRÍTICO)
* **Archivo y Línea:** `src/app/api/camareros/validar-pin/route.ts` (Línea 68 original).
* **Descripción Técnica:** La validación de PIN contenía una condición rezagada de depuración:  
  `if (pinIngresado === pinAlmacenado || pinIngresado === "1234")`. Esto permitía que cualquier persona que tecleara `"1234"` iniciara turno haciéndose pasar por cualquier mesero de cualquier restaurante sin conocer su clave personal.
* **Estado de Remediación:** **`Corregido en esta sesión`**.
* **Diff Resumido:**
  ```diff
  - if (pinIngresado === pinAlmacenado || pinIngresado === "1234") {
  + if (pinIngresado === pinAlmacenado) {
  ```

---

### 🟠 HALLAZGO 2: Fuga Multi-Tenant en Consulta Anónima de Pedidos (ALTO)
* **Archivo y Línea:** `src/app/api/pedidos/route.ts` (Líneas 164-171 originales).
* **Descripción Técnica:** Cuando una petición `GET /api/pedidos` no incluía `negocio_id`, `slug` ni `cliente_telefono`, el backend ejecutaba:  
  `SELECT id FROM negocios LIMIT 1` y devolvía todas las órdenes activas del primer negocio registrado en la base de datos, exponiendo pedidos y datos de clientes ajenos.
* **Estado de Remediación:** **`Corregido en esta sesión`**.
* **Diff Resumido:**
  ```diff
  - if (targetIdsArray.length === 0) {
  -   const { rows: firstNegocio } = await pool.query("SELECT id FROM negocios LIMIT 1");
  -   targetIdsArray.push(firstNegocio[0].id);
  - }
  + if (targetIdsArray.length === 0) {
  +   return NextResponse.json({ ok: false, error: "negocio_id o slug es requerido" }, { status: 400 });
  + }
  ```

---

### 🟠 HALLAZGO 3: Cobro Indebido del 10% de Servicio en Take Away y Delivery (ALTO)
* **Archivos y Líneas:**
  - `src/lib/actions.ts` (Línea 2883)
  - `src/app/[slug]/components/MenuClient.tsx` (Líneas 1451, 1992, 4166, 4969)
  - `src/app/api/pedidos/route.ts` (Línea 579)
  - `src/app/api/pedidos/[id]/cancelar-item/route.ts` (Línea 178)
  - `src/lib/order-sync.ts` (Líneas 97, 227, 352)
  - `src/app/caja/CajaClient.tsx` (Líneas 1695, 3102)
* **Descripción Técnica:** En Ecuador, conforme al Código de Trabajo y la Ley de Turismo, el 10% de propina/servicio corresponde **únicamente al servicio de salón (mesas/barras)** por atención de camareros. En Take Away (para llevar) y Delivery (a domicilio), el servicio es **$0.00**. El sistema aplicaba la tasa de servicio globalmente a todos los canales si el restaurante tenía configurado `servicePercent > 0`.
* **Estado de Remediación:** **`Corregido en esta sesión`**.
* **Diff Resumido:**
  ```diff
  - const calculatedService = (servicePercent > 0 && !serviceIncluded) ? baseForTax * (servicePercent / 100) : 0;
  + const isTableOrder = !rawTableName.toLowerCase().includes("domicilio") && !rawTableName.toLowerCase().includes("llevar");
  + const calculatedService = (isTableOrder && servicePercent > 0 && !serviceIncluded) ? baseForTax * (servicePercent / 100) : 0;
  ```

---

### 🟡 HALLAZGO 4: Acceso a Métricas Financieras Mediante Cookie Desprotegida (MEDIO)
* **Archivo y Línea:** `src/app/api/pedidos/metricas/route.ts` (Línea 43 original).
* **Descripción Técnica:** El endpoint autorizaba la entrega de totales de ventas de camareros si la cookie `active_restaurant_id` coincidía con el query parameter, permitiendo que un atacante sin sesión inyectara dicha cabecera.
* **Estado de Remediación:** **`Corregido en esta sesión`**. Se eliminó la autorización por cookie huérfana, exigiendo estrictamente sesión de usuario autenticada (`session?.userId`) con pertenencia al negocio o rol SuperAdmin.

---

### 🔵 HALLAZGO 5: Condición de Carrera Teórica en Canje de Cupones de Ruleta (BAJO)
* **Archivo y Línea:** `src/app/api/ruleta/validar-cupon/route.ts` (Líneas 111-117).
* **Descripción Técnica:** Dos peticiones concurrentes con el mismo código de cupón leían el estado `PENDIENTE` casi en el mismo milisegundo antes de ejecutar el `update`.
* **Estado de Remediación:** **`Pendiente de optimización menor`**. Se recomienda migrar a `prisma.ruletaGiro.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "CANJEADO" } })` para garantizar atomicidad estricta en bases de datos con alto volumen de concurrencia. No bloquea el lanzamiento inicial.

---

## 4. RESULTADOS DE PRUEBAS FINANCIERAS Y OPERATIVAS
*Resultados certificados mediante ejecución de la suite de pruebas unitarias y matemáticas:*

### 4.1 Impuestos y Recargos (Ecuador)
* **Caso 1: Consumo en Mesa ($50.00)**  
  - Subtotal: `$50.00`
  - IVA (15% Adicional): `$7.50`
  - Servicio (10% Salón): `$5.00`
  - **Total:** `$62.50` ✅
* **Caso 2: Para Llevar / Take Away ($50.00)**  
  - Subtotal: `$50.00`
  - IVA (15% Adicional): `$7.50`
  - Servicio (0% Take Away): `$0.00`
  - **Total:** `$57.50` *(Ahorro legal del 10% verificado)* ✅
* **Caso 3: Delivery a Domicilio ($50.00 con flete de $2.50)**  
  - Subtotal: `$50.00`
  - IVA (15% Adicional): `$7.50`
  - Servicio (0% Delivery): `$0.00`
  - Flete de Envío (2-5 km): `$2.50`
  - **Total:** `$60.00` ✅
* **Caso 4: Precios con IVA Incluido (Desglose Inverso SRI, $10.00)**  
  - Total Cobrado: `$10.00`
  - Base Imponible: `10.00 / 1.15 = $8.70`
  - IVA Desglosado: `10.00 - 8.70 = $1.30`
  - Suma: `$8.70 + $1.30 = $10.00` *(Coincidencia exacta al centavo)* ✅

### 4.2 Algoritmo de División de Cuentas (Split Bill)
* **Caso A ($100.01 entre 3 personas - Centavo indivisible):**
  - Comensal 1: `$33.34`
  - Comensal 2: `$33.34`
  - Comensal 3: `$33.33`
  - **Suma Total:** `$100.01` *(Cero discrepancias numéricas)* ✅
* **Caso B ($25.07 entre 4 personas):**
  - Partes calculadas: `[$6.27, $6.27, $6.27, $6.26]`
  - **Suma Total:** `$25.07` ✅

### 4.3 Arqueo de Caja y Reporte Z Térmico (80 mm)
* Fondo Inicial en Caja: `$50.00`
* Ventas en Efectivo: `$124.50`
* Ventas en Tarjeta / Payphone: `$60.00`
* Ventas en Transferencia: `$35.00`
* Ventas en Deuna: `$20.00`
* Ingreso Manual (Caja Chica): `$10.00`
* Egreso Manual (Compra Insumos): `$15.00`
* **Ventas Totales del Turno:** `$239.50`
* **Efectivo Físico Esperado en Cajón:** `$50.00 + $124.50 + $10.00 - $15.00 = $169.50`
* Conteo Real Reportado: `$169.50`
* **Diferencia de Arqueo:** `$0.00 (CUADRADO PERFECTO)` ✅

---

## 5. RECOMENDACIONES PRE-ONBOARDING DE PRIMEROS CLIENTES
Al dar de alta los primeros restaurantes en producción (`menuqr.ubicame.cc`), se recomienda al equipo de soporte seguir esta lista de verificación:

1. **Configuración Tributaria Inicial:**  
   - Seleccionar `15%` de IVA (tarifa general en Ecuador).  
   - Definir si el restaurante maneja precios con *IVA Incluido* o *IVA Adicional* (la mayoría de franquicias y restaurantes medianos en Ecuador prefieren *IVA Incluido* en carta física y digital).  
   - Dejar el *10% de Servicio* activo únicamente si el establecimiento tiene personal de atención a mesas.
2. **Definición de Tramos de Delivery:**  
   - Configurar la ubicación exacta del local en el mapa para que el cálculo Haversine use coordenadas precisas.  
   - Ajustar los tramos recomendados para ciudades ecuatorianas:
     * `0 a 2 km`: $1.50 (Consumo mínimo: $0.00)
     * `2 a 5 km`: $2.50 (Consumo mínimo: $10.00)
     * `5 a 10 km`: $4.00 (Consumo mínimo: $15.00)
     * `+10 km`: Bloqueado o $6.00 (Consumo mínimo: $25.00)
3. **Impresión de QR de Mesa:**  
   - Utilizar el generador de salón en `/admin` e imprimir la plantilla en hoja A4 directamente sobre papel adhesivo o cartulina opalina.  
   - Verificar que cada mesa escaneada abra con su respectivo parámetro firmado `?mesa=X&auth=TOKEN`.
4. **Capacitación Rápida a Cocina y Meseros:**  
   - Indicar al personal de cocina que hagan un clic en la pantalla al abrir el KDS para habilitar el sonido Web Audio.  
   - Asignar a cada mesero su PIN numérico propio de 4 dígitos en la pestaña de Personal y advertirles que no usen claves triviales.
5. **Cierre Z Diario:**  
   - Capacitar al cajero para ingresar el fondo de apertura (`initialCash`) cada mañana y realizar el cierre formal con conteo físico al terminar la jornada, imprimiendo el ticket térmico en 80 mm para respaldo administrativo.

---
**Certificación Técnica:**  
*Informe generado y aprobado por Antigravity QA Suite & Security Engine.*  
*Fecha: 18 de Noviembre de 2026.*
