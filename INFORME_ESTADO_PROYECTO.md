# INFORME DE ESTADO, ARQUITECTURA Y AUDITORÍA TÉCNICA
## Proyecto: MenuQR Pro (Plataforma Multi-Tenant SaaS Gastronómica y Comercial)
**Fecha de Auditoría:** 6 de Noviembre de 2026  
**Auditor Principal:** Arquitecto de Software Principal & Especialista en Auditorías de Código  
**Versión del Sistema:** `0.1.0` (Producción en Coolify / Vultr)  
**Clasificación:** Confidencial / Auditoría Técnica Integral  

---

## 1. FICHA TÉCNICA Y STACK TECNOLÓGICO

### 1.1 Runtime, Framework y Compilación
* **Framework Web:** Next.js `16.3.4` (App Router, Server Actions, Standalone Build).
* **Biblioteca UI:** React `19.2.3` / React-DOM `19.2.3`.
* **Runtime de Ejecución:** Node.js `>=20.9.0` (LTS recomendado en imagen base Docker `node:20-alpine`).
* **Gestor de Paquetes:** pnpm `>=9.0.0`.
* **Tipado Estático:** TypeScript `^5.0.0` (Configuración estricta en `tsconfig.json`, target `ES2022`).
* **Estilos y CSS:** Tailwind CSS `^3.4.1`, PostCSS `^8.0.0`, Autoprefixer.

### 1.2 Mapeo de Librerías Externas Clave
| Categoría | Librería | Versión | Propósito Arquitectural |
|---|---|---|---|
| **ORM Principal** | `@prisma/client` / `prisma` | `^6.2.1` | Modelado relacional, migraciones automáticas (`prisma migrate deploy`) y transacciones ACID. |
| **Driver SQL Directo** | `pg` / `@types/pg` | `^8.23.1` | Pool de conexiones PostgreSQL nativo (`src/lib/db-pool.ts`) para operaciones operativas de cocina y mesero en tiempo real. |
| **Validación de Datos** | `zod` | `^4.6.7` | Validación de contratos, schemas de facturación, suscripciones y notificaciones internas. |
| **Autenticación y Cripto** | `jsonwebtoken`, `bcryptjs` | `^9.0.3` / `^3.0.3` | Generación y verificación de tokens de sesión JWT (`user_session`, `superadmin_session`) y hashing de contraseñas. |
| **Tiempo Real** | `socket.io`, `socket.io-client` | `^4.8.4` | Comunicación bidireccional cliente-servidor para comandas, pedidos y cocina. |
| **Generación QR / Escáner** | `qrcode`, `qrcode.react`, `html5-qrcode` | `^1.5.4` / `^4.2.0` / `^2.3.8` | Generación de códigos QR de mesa/negocio y lectura por cámara web/móvil. |
| **Mensajería y Correo** | `resend`, `nodemailer` | `^6.25.0` / `^10.3.1` | Envío transaccional de correos electrónicos y alertas. |
| **Hojas de Cálculo** | `xlsx` (SheetJS) | `^0.18.5` | Importación y exportación masiva de cartas, clientes y platos en Excel. |
| **Iconografía** | `lucide-react` | `^1.28.0` | Conjunto de iconos vectoriales para dashboards y módulo táctil. |

### 1.3 Estructura de Directorios del Repositorio
```
MenuQR Pro/
├── .agents/                    # Reglas de negocio y skills de agentes de desarrollo
├── prisma/
│   ├── schema.prisma           # Esquema central Prisma (33 modelos relacionales)
│   └── migrations/             # Historial de migraciones SQL aplicadas
├── public/
│   ├── uploads/                # Directorio persistente montado en Coolify (imágenes, logos)
│   └── sounds/                 # Alertas sonoras para cocina KDS y salón
├── src/
│   ├── app/                    # Next.js App Router (Páginas, Layouts y Endpoints)
│   │   ├── (verticales)/       # Subrutas especializadas (citas, ctalo, menuqr, reservas, servicios)
│   │   ├── [slug]/             # Vista comercial pública del comercio (/slug, /slug/cocina, /slug/mesas, /slug/caja)
│   │   ├── admin/              # Panel de control de administradores de restaurante
│   │   ├── super-admin/        # Panel de SuperAdmin SaaS (Gestión multi-negocio, finanzas, métricas)
│   │   ├── api/                # 53 API Route Handlers REST y Webhooks
│   │   ├── caja/               # Terminal POS de Punto de Venta y cobro de mesas
│   │   ├── cocina/             # Pantalla KDS de preparación de comandas en tiempo real
│   │   ├── mesas/              # Terminal de camareros / comandas de salón
│   │   ├── marketplace/        # Catálogo centralizado y buscador gastronómico
│   │   └── rastreo/            # Seguimiento de pedidos para clientes finales
│   └── lib/                    # Lógica de dominio, servicios, Server Actions y utilitarios
│       ├── actions.ts          # Server Actions principales (Auth, Menú, Platos, Pedidos)
│       ├── db-pool.ts          # Conexión nativa Pool PG y DDL dinámico (`ensureDbTables`)
│       ├── prisma.ts           # Cliente singleton y fábrica multi-inquilino de Prisma
│       ├── stock-service.ts    # Motor universal de stock transaccional y control de raciones
│       ├── split-bill-actions.ts # Motor financiero de división de cuentas (partes iguales e ítems)
│       ├── staff-actions.ts    # Acceso de meseros, PINs y seguridad de cocina
│       └── telegram-alert.ts   # Despacho de alertas a Telegram / n8n
```

---

## 2. ARQUITECTURA DE DATOS Y AISLAMIENTO MULTI-TENANT

### 2.1 Modelo de Datos Principal (Prisma Schema)
El archivo `prisma/schema.prisma` define 33 modelos estructurados en torno a una arquitectura multi-inquilino basada en discriminador relacional (`restaurantId` / `negocio_id`):

1. **Núcleo de Inquilinos y Usuarios:**
   * `User`: Propietario del negocio (`id`, `email`, `password`, `restaurants[]`).
   * `Restaurant`: Inquilino comercial (`id`, `userId`, `slug` [único], `name`, `businessType`, `plan` [FREE/PRO/ELITE], configuraciones tributarias, horarios y personalizaciones).
2. **Estructura de Menú y Catálogo:**
   * `Category`: Categorías de productos asociadas a `restaurantId` con soporte de ordenación (`order`).
   * `Dish`: Platos o artículos comerciales (`categoryId`, `restaurantId`, `name`, `price`, `stock`, `trackStock`, `minStock`, `isAvailable`).
   * `DishRecipeItem`, `SupplyItem`, `Supplier`, `PurchaseOrder`: Módulo de costeo e inventario avanzado de materias primas.
3. **Comandas, Pedidos y Sesiones de Mesa:**
   * `Order`: Pedidos formales (`restaurantId`, `tableName`, `total`, `subtotal`, `iva`, `serviceCharge`, `tip`, `status`).
   * `OrderItem`: Líneas individuales de plato con precio congelado al momento de la orden.
   * `TableSession`: Sesión activa de una mesa física (`restaurantId`, `tableName`, `totalAmount`, `paidAmount`, `status`).
   * `TableSplitPayment`: Intentos de pago parciales o divididos (efectivo, tarjeta, transferencia).
   * `TableSessionOrder`: Vinculación N:M de comandas agrupadas por mesa.
4. **Marketing, Fidelización y CRM:**
   * `RuletaConfig`, `RuletaGiro`: Gamificación de descuentos anti-fraude por IP y teléfono.
   * `Coupon`: Cupones de descuento porcentuales o de monto fijo.
   * `Customer`, `Lead`, `CrmNote`: Libreta de comensales y seguimiento de prospección.
   * `InAppNotification`, `InAppNotificationRead`: Sistema interno de alertas operativas con aislamiento de lectura por inquilino.

### 2.2 Dualidad de Acceso a Datos: Prisma ORM vs. `pg.Pool`
El proyecto implementa una **arquitectura de doble cliente SQL**, lo cual constituye un factor crítico de diseño:

```
                            [ PostgreSQL Database ]
                               /              \
                              /                \
        [ Prisma ORM Client ]                    [ pg.Pool Client ]
       (src/lib/prisma.ts)                      (src/lib/db-pool.ts)
                │                                         │
    • Tablas: Restaurant, User,               • Tablas: negocios, camareros,
      Dish, Order, TableSession                 pedidos, pedido_items
    • Usado por: Admin, SuperAdmin,           • Usado por: Cocina KDS,
      Server Actions, Marketplace               Mesas, Polling de Comandas
```

* **Cliente Prisma (`src/lib/prisma.ts`):** Gestiona la conexión mediante `DATABASE_URL`. Implementa una caché global (`tenantCache = new Map<string, PrismaClient>()`) con límite defensivo de `connection_limit=3` para conexiones dinámicas.
* **Cliente pg.Pool (`src/lib/db-pool.ts`):** Gestiona un pool nativo de hasta 10 conexiones simultáneas (`max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`) para despachar lecturas y escrituras ultrarrápidas de la operativa de cocina y meseros.
* **Sincronización:** La función `ensureDbTables()` en `src/lib/db-pool.ts` ejecuta consultas DDL y sincroniza los registros entre la tabla `Restaurant` de Prisma y la tabla `negocios` de PG Pool.

---

## 3. MAPEO COMPLETO DE SUPERFICIE DE ENTRADA (RUTAS Y ACCIONES)

### 3.1 Matriz Completa de Route Handlers (`src/app/api/**/route.ts`)
Se auditaron los 53 archivos de rutas REST del proyecto:

| Endpoint | Método(s) | Parámetros (Query / Body / Path) | Nivel de Protección Actual |
|---|---|---|---|
| `/api/admin/ai-settings` | **GET, POST** | **Query:** `restaurantId`<br>**Body:** `restaurantId, aiProvider, aiApiKey, aiModel...` | 🔒 Sesión Requerida (Validación Tenant `userId`) |
| `/api/admin/ai-settings/models` | **POST** | **Body:** `restaurantId, aiProvider, aiApiKey` | 🔒 Sesión Requerida (Validación Tenant `userId`) |
| `/api/admin/ai-settings/test` | **POST** | **Body:** `restaurantId, aiProvider, aiApiKey...` | 🔒 Sesión Requerida (Validación Tenant `userId`) |
| `/api/admin/notifications` | **GET** | Ninguno | 🔒 Sesión Admin / SuperAdmin (`resolveAdminAuth`) |
| `/api/admin/notifications/[id]/dismiss` | **PATCH** | **Param:** `[id]` | 🔒 Sesión Admin / SuperAdmin (`resolveAdminAuth`) |
| `/api/admin/notifications/[id]/read` | **PATCH** | **Param:** `[id]` | 🔒 Sesión Admin / SuperAdmin (`resolveAdminAuth`) |
| `/api/admin/whatsapp-templates` | **GET, POST, PUT, DELETE** | **Query:** `restaurantId`<br>**Body:** `restaurantId, id, key, title, trigger...` | 🔒 Sesión Requerida (Validación Tenant `userId`) |
| `/api/admin/whatsapp/instance` | **GET, POST, DELETE** | Ninguno (Ruta stub deshabilitada) | Público |
| `/api/admin/whatsapp/qr` | **GET, POST** | Ninguno (Ruta stub deshabilitada) | Público |
| `/api/admin/whatsapp/sync-webhook` | **POST** | Ninguno (Ruta stub deshabilitada) | Público |
| `/api/auth/google` | **GET** | **Query:** `type, mode` | Público |
| `/api/auth/google/callback` | **GET** | **Query:** `code, state, error` | Público (Intercambio OAuth) |
| `/api/camareros` | **GET, POST** | **Query:** `negocio_id`<br>**Body:** `negocio_id, nombre, pin` | ⚠️ **Público (Expone PINs en GET y creación libre en POST)** |
| `/api/camareros/[id]` | **PUT, DELETE** | **Body:** `nombre, pin, activo`<br>**Param:** `[id]` | ⚠️ **Público (Modificación y borrado de camareros sin auth)** |
| `/api/camareros/validar-pin` | **POST** | **Body:** `negocio_id, camarero_id, pin` | 🔑 Validación PIN Local (Salón) |
| `/api/citas` | **GET, POST** | **Query:** `negocio_id, slug, fecha...`<br>**Body:** `negocio_id, cliente_nombre...` | Público (Agendamiento comensal) |
| `/api/citas/[id]` | **DELETE, PATCH** | **Body:** `estado, notas_internas...`<br>**Param:** `[id]` | Público |
| `/api/citas/config` | **GET, POST** | **Query:** `negocio_id, slug`<br>**Body:** `negocio_id, specialists...` | Público |
| `/api/citas/disponibilidad` | **GET** | **Query:** `negocio_id, slug, fecha, especialista_id` | Público |
| `/api/cocina/validar-pin` | **POST** | **Body:** `slug, pin` | 🔑 Validación PIN Local (Cocina KDS) |
| `/api/diagnose` | **GET** | Ninguno (Diagnóstico interno DB) | Público |
| `/api/health` | **GET** | Ninguno (Liveness check Coolify) | Público |
| `/api/internal/metrics/weekly-summary` | **GET, POST** | **Query:** `restaurantId, weekOffset...` | 🔒 API Key Interna (`x-internal-api-key`) |
| `/api/internal/notifications/create` | **POST** | **Body:** JSON estructurado | 🔒 API Key Interna (`x-internal-api-key`) |
| `/api/internal/subscriptions/check-status` | **GET, POST** | **Query:** `daysThreshold, status...` | 🔒 API Key Interna (`x-internal-api-key`) |
| `/api/negocios` | **GET** | **Query:** `slug, negocio_id` | 🔒 Sesión Requerida (Filtra por permisos) |
| `/api/negocios/[id]` | **GET** | **Param:** `[id]` | Público (Carga productos y datos del local) |
| `/api/pedidos` | **GET, POST** | **Query:** `negocio_id, slug, activos, mesa`<br>**Body:** `vertical, items, mesa, total...` | Público (Creación comensal y polling KDS) |
| `/api/pedidos/[id]` | **PUT, DELETE** | **Body:** `estado, solicita_mesero, motivo...`<br>**Param:** `[id]` | ⚠️ **Público (Permite cambiar estado o anular pedido)** |
| `/api/pedidos/[id]/cancelar-item` | **POST** | **Body:** `itemId, motivo, marcar_agotado`<br>**Param:** `[id]` | Público (Consumido por Cocina/Mesero) |
| `/api/pedidos/live` | **GET** | Ninguno (Informativo Socket.IO) | Público |
| `/api/pedidos/llamar-mesero` | **POST** | **Body:** `negocio_id, mesa, comensal` | Público (Botón de asistencia en mesa) |
| `/api/pedidos/metricas` | **GET** | **Query:** `negocio_id` | Público (Resumen comensales y ventas) |
| `/api/pedidos/pedir-cuenta` | **POST** | **Body:** `negocio_id, mesa, metodo_pago` | Público (Solicitud de cierre de cuenta) |
| `/api/productos/[id]/disponible` | **PATCH** | **Body:** `isAvailable, stock, negocio_id`<br>**Param:** `[id]` | Público (Acción directa Cocina KDS) |
| `/api/public/v1/analytics` | **POST** | **Body:** `eventType, restaurantId, metadata` | Público (Telemetría de eventos) |
| `/api/public/v1/marketplace` | **GET** | **Query:** `type, search, province, canton...` | Público (Directorio comercial) |
| `/api/public/v1/restaurants` | **GET** | **Query:** `city, province, category, q` | Público (Directorio comercial) |
| `/api/public/v1/search` | **GET** | **Query:** `q, province, minPrice, maxPrice...` | Público (Motor de búsqueda con geolocalización) |
| `/api/reservas` | **GET, POST** | **Query:** `negocio_id, estado`<br>**Body:** `check_in, check_out...` | Público (Hospedaje y cabañas) |
| `/api/reservas/[id]` | **DELETE, PATCH** | **Body:** `estado, notas_hospedaje`<br>**Param:** `[id]` | Público |
| `/api/reservas/cabanas` | **GET, PATCH** | **Query:** `negocio_id`<br>**Body:** `dish_id, beds, price...` | Público |
| `/api/reservas/config` | **GET, POST** | **Query:** `negocio_id, slug`<br>**Body:** `amenities, checkInTime...` | Público |
| `/api/ruleta/config/[slug]` | **GET** | **Query:** `modo, tablet, kiosk`<br>**Param:** `[slug]` | Público (Configuración sectores ruleta) |
| `/api/ruleta/girar` | **POST** | **Body:** `slug, telefono, nombre...` | Público (Anti-fraude de giros) |
| `/api/ruleta/validar-cupon` | **POST** | **Body:** `codigo_cupon, restaurantId` | ⚠️ **Sesión Requerida (Sin verificación de tenant)** |
| `/api/stock-check` | **GET, POST** | **Query:** `restaurantId, slug`<br>**Body:** `restaurantId, items` | Público (Validación de stock antes de ordenar) |
| `/api/sugeridos/[slug]` | **GET, POST** | **Body:** `dishId`<br>**Param:** `[slug]` | Público (Platos del día) |
| `/api/superadmin/restaurant/toggle-bot` | **PATCH** | **Body:** `restaurantId, enabled` | 🔒 SuperAdmin Requerido |
| `/api/uploads/[filename]` | **GET** | **Param:** `[filename]` | Público (Entrega de archivos persistentes) |
| `/api/webhook/whatsapp` | **GET, POST** | Payload entrante WhatsApp Webhook | Público (Protegido por token en query) |
| `/api/whatsapp/qr` | **GET, POST** | **Query:** `restaurantId` | Público |
| `/api/whatsapp/webhook` | **GET, POST** | Payload entrante Evolution API | Público |

---

### 3.2 Catálogo de Server Actions (`"use server"`)
Las operaciones transaccionales críticas del panel de administración se ejecutan mediante Server Actions fuertemente tipadas:

1. **`src/lib/actions.ts` (Acciones Centrales):**
   * *Autenticación:* `loginUserAction`, `registerUserAction`, `logoutUserAction`, `requestPasswordResetAction`, `resetPasswordAction`.
   * *Restaurante y Marca:* `updateRestaurantAction`, `updateRestaurantSchedulesAction`, `updateLogoDirectAction`, `updateCoverDirectAction`.
   * *Gestión de Menú:* `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, `reorderCategoriesAction`, `createDishAction`, `updateDishAction`, `deleteDishAction`, `toggleDishAvailabilityAction`, `quickUpdateDishStockAction`, `createBatchDishesAction`.
   * *Menú del Día:* `createDailyMenuCategoryAction`, `saveDailyMenuDishAction`, `toggleAllDailyMenuDishesAction`, `deleteDailyMenuDishAction`.
   * *SuperAdmin:* `superAdminLoginAction`, `extendTrialAction`, `deleteRestaurantAction`, `superAdminCreateRestaurantAction`, `reassignRestaurantOwnerAction`, `impersonateUserAction`, `changeUserPlanAction`.
   * *CRM y Clientes:* `createCustomerAction`, `updateCustomerAction`, `deleteCustomerAction`, `importCustomersAction`, `createProspectLeadAction`, `addCrmNoteAction`.
   * *Tarifas y Temporadas:* `createSeasonRateAction`, `updateSeasonRateAction`, `deleteSeasonRateAction`, `toggleSeasonRateAction`.
2. **`src/lib/staff-actions.ts` (Personal y Seguridad):**
   * `getStaffDataAction`, `createWaiterAction`, `updateWaiterAction`, `deleteWaiterAction`, `saveKitchenSecurityAction`. Todas verifican propiedad mediante `verifyRestaurantAccess(restaurantId)`.
3. **`src/lib/split-bill-actions.ts` (División de Cuentas POS):**
   * `createTableSessionAction`, `getTableSessionAction`, `calculateEqualSplitAction`, `calculateProductSplitAction`, `requestProductSplitPaymentAction`, `confirmSplitPaymentAction`, `closeTableSessionAction`.
4. **`src/lib/caja-actions.ts` (Caja y Turnos POS):**
   * `createManualBillAction`, `processSplitBillAction`, `closeShiftAction`, `getShiftReportAction`, `getOpenOrdersAction`.
5. **`src/lib/campaign-actions.ts` (Marketing):**
   * `createCampaignAction`, `updateCampaignAction`, `deleteCampaignAction`, `toggleCampaignStatusAction`.
6. **`src/lib/inventory-actions.ts` (Recetas e Inventario):**
   * `saveSupplierAction`, `saveSupplyItemAction`, `saveDishRecipeAction`, `createPurchaseOrderAction`.
7. **`src/lib/ruleta-actions.ts` (Ruleta Gamificada):**
   * `saveRuletaConfigAction`, `toggleRuletaVisibilityAction`.
8. **`src/lib/suggested-dishes-actions.ts` (Platos Sugeridos):**
   * `getSuggestedDishIdsAction`, `toggleSuggestedDishAction`, `getMarketplaceDishesAction`.
9. **`src/lib/superadmin-extra-actions.ts`:**
   * `saveGlobalAnnouncementAction`, `checkInfrastructureHealthAction`.
10. **`src/lib/onboarding-actions.ts`:**
    * `completeOnboardingAction`.

---

## 4. FLUJOS OPERATIVOS DEL NEGOCIO

### 4.1 Ciclo de Vida del Pedido (Comanda Gastronómica)
El flujo operativo integra validaciones de stock, concurrencia en mesa y despacho:

```
[ Cliente en Mesa / Web ]
         │
         ▼
   (Selección de platos y raciones)
         │
         ├───▶ [ GET /api/stock-check ] ──▶ Valida disponibilidad en tiempo real
         │
         ▼
[ POST /api/pedidos ]
         │
         ├───▶ `deductStockUniversal` (Transacción atómica: resta stock o marca agotado)
         ├───▶ `INSERT INTO pedidos` + `INSERT INTO pedido_items` (PostgreSQL Pool)
         ├───▶ `Order` + `OrderItem` (Espejo en Prisma ORM)
         ├───▶ `emitNuevoPedido` (Socket.IO broadcast a la sala del negocio)
         └───▶ `sendTelegramAlert` / `notificarSuperAdmin` (Notificaciones externas)
         │
         ▼
[ Pantalla Cocina KDS (/slug/cocina) ]
         │
         ├───▶ Sondeo activo HTTP cada 3s (`GET /api/pedidos?negocio_id=...&activos=true`)
         ├───▶ Sonido de comanda: `kitchenAudio.playNuevoPedido()`
         │
         ├───▶ Cambio de estado: "nuevo" ➔ "en_cocina" (`PUT /api/pedidos/[id]`)
         └───▶ Cambio de estado: "en_cocina" ➔ "listo" (`PUT /api/pedidos/[id]`)
         │
         ▼
[ Módulo Camarero (/slug/mesas) ]
         │
         ├───▶ Notificación sonora y visual de plato listo para entrega
         ├───▶ Modo Mesa: Interfaz amplificada táctil para pasar el teléfono al comensal
         │
         ▼
[ Cierre y Cobro (Caja POS /slug/caja) ]
         │
         ├───▶ División de cuenta (`split-bill-actions.ts`: partes iguales o por producto)
         ├───▶ Registro de pago (`confirmSplitPaymentAction` o `PUT /api/pedidos/[id]`: "pagado")
         └───▶ Liberación de mesa: Se limpian comensales, alertas y sesiones huérfanas
```

### 4.2 Módulos de Cocina (KDS) y Meseros: Mecanismo de Actualización
* **Tiempo Real Mixto:** La arquitectura implementa un **diseño resiliente de doble capa**:
  1. *Socket.IO:* Los componentes cliente (`CocinaClient.tsx`, `MesasClient.tsx`) intentan suscribirse a `io({ path: "/api/socket" })` y escuchar eventos `nuevo_pedido`, `items_añadidos`, `pedido_actualizado` y `stock_actualizado`.
  2. *Sondeo Polling Fallback:* Debido a que Next.js en modo standalone no ejecuta un servidor Socket.IO integrado nativamente, los clientes ejecutan un **sondeo HTTP permanente cada 3.000 ms (`setInterval`)** contra `/api/pedidos?negocio_id=${negocio.id}&activos=true`.
* **Control de Acceso:**
  * Cocina KDS: Protegida opcionalmente por PIN de 4 a 8 dígitos (`CocinaPinLockScreen`), validado contra `/api/cocina/validar-pin` y recordado en `sessionStorage`.
  * Meseros: Autenticación por PIN individual de camarero contra `/api/camareros/validar-pin`.

### 4.3 Integraciones y Webhooks Externos
1. **Telegram Alerts (`src/lib/telegram-alert.ts`):** Envía webhooks JSON estructurados con orden, mesa, comensal y total hacia un webhook de **n8n** o bot de Telegram corporativo sin bloquear el hilo principal.
2. **WhatsApp Bot & IA Cascada (`src/lib/whatsapp-ai.ts`, `src/lib/whatsapp-templates.ts`):**
   * Las solicitudes entrantes son procesadas por un motor en cascada de 3 niveles:
     * *Nivel 1 (Plantillas exactas):* Disparadores clave ("carta", "horario", "cuenta", "transferencia").
     * *Nivel 2 (IA Conversacional BYOK):* Si no hay coincidencia de plantilla, consulta el modelo de IA configurado por el restaurante (OpenAI GPT-4o, DeepSeek, etc.).
     * *Nivel 3 (Fallback automático):* Mensaje de atención de guardia si el restaurante no tiene API Key de IA configurada.

---

## 5. DIAGNÓSTICO DE PUNTOS CRÍTICOS Y ESTABILIDAD INMEDIATA

### 5.1 🚨 Contención de Locks DDL por `ensureDbTables()` Concurrente (Severidad Alta)
* **Archivo:** `src/lib/db-pool.ts` (Línea 32)
* **Invocaciones:** Invocado en `src/app/api/pedidos/route.ts` (líneas 46 y 224), `src/app/api/camareros/route.ts` (líneas 9 y 42), `src/app/api/citas/route.ts`, `src/app/api/reservas/route.ts` y en `src/lib/staff-actions.ts`.
* **Diagnóstico:** Cada llamada a `ensureDbTables()` ejecuta sentencias DDL pesadas:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE TABLE IF NOT EXISTS negocios (...);
  CREATE TABLE IF NOT EXISTS camareros (...);
  CREATE TABLE IF NOT EXISTS pedidos (...);
  ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ...;
  DO $$ ... INSERT INTO negocios SELECT ... $$;
  ```
* **Impacto en Concurrencia:** Con múltiples pantallas de cocina y teléfonos de meseros sondeando `/api/pedidos` cada 3 segundos, se ejecutan cientos de consultas DDL de catálogo de sistema por minuto. En PostgreSQL, las consultas `ALTER TABLE ADD COLUMN` adquieren bloqueos `ShareUpdateExclusiveLock` o `AccessExclusiveLock`, provocando esperas en cola de transacciones (lock contention) y picos innecesarios de CPU.
* **Recomendación:** Modificar `ensureDbTables()` para verificar de inmediato la bandera en memoria:
  ```typescript
  if (globalForPg.tablesInitialized) return;
  ```
  y ejecutar la inicialización únicamente una sola vez al arrancar la aplicación o mediante migraciones de Prisma.

### 5.2 🚨 Exposición de Credenciales y Operaciones CRUD en `/api/camareros` (Severidad Alta)
* **Archivo:** `src/app/api/camareros/route.ts` y `src/app/api/camareros/[id]/route.ts`
* **Vulnerabilidad 1 (Fuga de PINs):** El endpoint `GET /api/camareros?negocio_id=...` ejecuta:
  ```typescript
  SELECT id, negocio_id, nombre, pin, activo, created_at FROM camareros WHERE negocio_id = $1
  ```
  y devuelve los **PINs de todos los meseros en texto plano** sin requerir sesión ni token de administrador.
* **Vulnerabilidad 2 (Escritura No Autorizada):** Los endpoints `POST /api/camareros`, `PUT /api/camareros/[id]` y `DELETE /api/camareros/[id]` permiten crear, modificar o eliminar meseros sin validar autenticación del restaurante.
* **Impacto:** Cualquier usuario que conozca el `negocio_id` público puede consultar los PINs de los meseros o alterar el personal de salón.
* **Recomendación:** Proteger estas rutas con `resolveAdminAuth(req)` o restringir `GET /api/camareros` para que jamás retorne el campo `pin`.

### 5.3 ⚠️ Control de Acceso en Modificación y Cancelación de Pedidos (Severidad Media)
* **Archivo:** `src/app/api/pedidos/[id]/route.ts` (Líneas 22 y 152)
* **Diagnóstico:** Los métodos `PUT` (cambiar estado a "pagado" o "cancelado") y `DELETE` (anular pedido) no verifican sesión de usuario, PIN de mesero ni token de mesa. Reciben únicamente el UUID del pedido en la URL.
* **Mitigación actual:** La probabilidad de acierto por fuerza bruta de un UUIDv4 es despreciable ($2^{-122}$), pero no cumple con el principio de defensa en profundidad.
* **Recomendación:** Exigir cabecera de autorización o firma de token de mesa / PIN de mesero al anular comandas.

### 5.4 ⚠️ Falta de Validación Zod en Endpoints de Alto Tráfico (Severidad Media)
* **Archivos:** `src/app/api/pedidos/route.ts`, `src/app/api/pedidos/[id]/route.ts`, `src/app/api/camareros/route.ts`.
* **Diagnóstico:** Los endpoints REST operan sobre `await req.json()` desestructurando propiedades en bruto con comprobaciones manuales (`if (!body.mesa)`) en lugar de esquemas Zod rigurosos.
* **Impacto:** Posibilidad de inyección de tipos inesperados (`null`, `array` en lugar de `string`, o valores numéricos negativos en precios o cantidades).
* **Recomendación:** Centralizar esquemas Zod en `src/lib/schemas/order.ts` y aplicar `OrderInputSchema.safeParse(body)`.

### 5.5 ⚠️ Validación de Cupones Multi-Tenant en `/api/ruleta/validar-cupon` (Severidad Baja)
* **Archivo:** `src/app/api/ruleta/validar-cupon/route.ts` (Líneas 9-45)
* **Diagnóstico:** El endpoint verifica que exista una sesión de usuario (`session || superAdmin`), pero no valida que el `session.userId` sea el propietario del `restaurantId` asociado al cupón consultado.
* **Impacto:** Un usuario autenticado de un restaurante "A" podría validar o canjear cupones de un restaurante "B" si envía el `restaurantId` objetivo.

---

## 6. RESUMEN DE SALUD DE DEPENDENCIAS

Del análisis automatizado de `audit-deps.json` y `package.json`, se registran **9 vulnerabilidades** en el árbol de dependencias:

```
Vulnerabilidades Totales: 9
├── Críticas: 0
├── Altas: 1 (xlsx / SheetJS)
├── Moderadas: 8 (Entorno de desarrollo: eslint / typescript-eslint / minimatch)
└── Bajas / Info: 0
```

### 6.1 Vulnerabilidad Alta en Dependencia de Producción
* **Paquete:** `xlsx` (SheetJS) versión `^0.18.5`
* **Severidad:** **High**
* **Vectores:** Prototype Pollution y ReDoS en el procesamiento de hojas de cálculo maliciosas.
* **Causa Raíz:** SheetJS cesó la publicación de actualizaciones en el registro público de `npm` a partir de la versión `0.18.5` y trasladó sus parches exclusivamente a su CDN propietario (`https://cdn.sheetjs.com`).
* **Acción Recomendada:**
  1. Si la importación de Excel es solo usada por administradores de confianza, aislar el endpoint y desinfectar nombres de columnas.
  2. O migrar la exportación/importación a librerías modernas de código abierto mantenidas en npm como `exceljs` o `read-excel-file`.

### 6.2 Vulnerabilidades Moderadas en Entorno de Desarrollo
* **Paquetes:** `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `typescript-eslint`, `minimatch`, `eslint-config-next`.
* **Impacto:** **Nulo en producción.** Son herramientas de linting y formateo de código que no forman parte del artefacto compilado standalone de Next.js (`node .next/standalone/server.js`).

---

## 7. MATRIZ DE RECOMENDACIONES PRIORIZADAS

| Prioridad | Área | Tarea Técnica | Impacto |
|---|---|---|---|
| **P1 - Inmediato** | Rendimiento DB | Añadir guard `if (globalForPg.tablesInitialized) return;` en `ensureDbTables()` (`src/lib/db-pool.ts`). | Elimina contención de locks DDL en PostgreSQL cada 3 segundos. |
| **P1 - Inmediato** | Seguridad API | Excluir el campo `pin` en la respuesta de `GET /api/camareros` y proteger `POST/PUT/DELETE` con `resolveAdminAuth`. | Previene fuga masiva de credenciales de meseros. |
| **P2 - Corto Plazo** | Validación | Implementar esquemas Zod en `POST /api/pedidos` y `POST /api/camareros`. | Garantiza integridad de tipos e input sanitizado. |
| **P2 - Corto Plazo** | Multi-Tenant | Enforzar `restaurant.userId === session.userId` en `POST /api/ruleta/validar-cupon`. | Cierra fuga de canje de cupones entre inquilinos. |
| **P3 - Mantenimiento** | Dependencias | Reemplazar `xlsx` por `exceljs` para solventar la alerta de seguridad en importación de cartas. | Remedia vulnerabilidad de severidad alta reportada en npm audit. |

---
*Informe generado automáticamente tras escaneo estático y análisis de flujo del código fuente de MenuQR Pro.*

