# INFORME DE AUDITORÍA DE SEGURIDAD DE APLICACIONES (CLOUDFLARE SECURITY AUDIT PROTOCOL)
## Proyecto: MenuQR Pro | SaaS Gastronómico y Comercial Multi-Tenant
**Fecha:** 6 de Noviembre de 2026  
**Auditor:** Auditor Senior de Seguridad de Aplicaciones (AppSec Specialist)  
**Metodología:** Cloudflare Application Security Audit Protocol con Validación Adversaria (Anti-Falsos Positivos)  
**Alcance:** 53 API Route Handlers (`src/app/api/**/route.ts`) + 10 Módulos de Server Actions (`src/lib/*.ts`)  
**Clasificación:** Confidencial / Auditoría de Seguridad  

---

## 1. RESUMEN EJECUTIVO DE POSTURA DE SEGURIDAD

Se ejecutó un análisis exhaustivo de superficie de ataque y límites de confianza en la totalidad del backend de **MenuQR Pro**.

```
═══════════════════════════════════════════════════════════════════
   PUNTUACIÓN GLOBAL DE POSTURA DE SEGURIDAD: 6.8 / 10 (MODERADA)
═══════════════════════════════════════════════════════════════════
   Total Componentes Evaluados: 63 (53 Endpoints API + 10 Action Modules)
   ├── [CONFIRMED] Hallazgos Críticos/Altos/Medios: 8
   ├── [NEEDS_RUNTIME_VALIDATION] Hallazgos de Entorno: 3
   └── [REFUTED] Falsos Positivos Neutralizados: 6
═══════════════════════════════════════════════════════════════════
```

### Principales Fortalezas Arquitecturales Identificadas:
1. **Server Actions fuertemente resguardadas:** Los módulos centrales de administración (`src/lib/actions.ts`, `src/lib/caja-actions.ts`, `src/lib/inventory-actions.ts`, `src/lib/campaign-actions.ts`) implementan sistemáticamente `verifyRestaurantOwnership(restaurantId)` garantizando aislamiento multi-tenant contra `session.userId`.
2. **Defensa estricta contra SQL Injection:** Las consultas nativas en `src/lib/db-pool.ts` y route handlers utilizan parámetros posicionales (`$1, $2, ...`) evitando concatenación de cadenas vulnerables.
3. **Endpoints internos blindados:** `/api/internal/**` utiliza comparación criptográfica en tiempo constante (`crypto.timingSafeEqual`) previniendo ataques de temporización (timing attacks).
4. **Patrón Singleton DDL activo:** La reciente neutralización de `ensureDbTables()` protege la base de datos contra DoS por contención de locks en PostgreSQL.

### Principales Vulnerabilidades Detectadas ([CONFIRMED]):
* **BOLA / Broken Access Control en Endpoints Especializados:** Determinadas rutas REST heredadas o de verticales secundarias (`citas`, `reservas`, `productos/disponible`, `sugeridos`) carecen de middleware o verificación de sesión, permitiendo a atacantes anónimos modificar precios de platos, sobrescribir disponibilidad de stock o cambiar configuraciones del comercio sin autenticación.
* **Falla de Control de Acceso en SuperAdmin:** La ruta `/api/superadmin/restaurant/toggle-bot` lee `isSuperAdmin` pero no evalúa el resultado antes de actualizar la base de datos.
* **Fuga de Métricas Financieras:** `/api/pedidos/metricas` permite la exfiltración de ventas diarias y rendimiento de meseros mediante el simple envío del `negocio_id` en query params.

---

## 2. TABLA DE HALLAZGOS CONFIRMADOS ([CONFIRMED])

| ID | Vulnerabilidad | Severidad (CVSS v3.1) | Archivo y Línea | Vector de Explotación | Parche Recomendado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **BOLA & Modificación Arbitraria de Precios de Platos** | **CRÍTICA (9.1)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H` | [`src/app/api/reservas/cabanas/route.ts#L69-L150`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/reservas/cabanas/route.ts#L69-L150) | Un atacante no autenticado envía un payload `PATCH` con `dish_id` y `price: 0.01`, modificando el precio de venta en vivo de cualquier plato en la base de datos de Prisma sin sesión ni control de propiedad. | Exigir `getUserSession()`, verificar que el `Dish.restaurantId` pertenezca al `session.userId` y rechazar con HTTP 401/403 si no coincide. |
| **SEC-02** | **Falta de Validación de Rol en Endpoint SuperAdmin** | **ALTA (7.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` | [`src/app/api/superadmin/restaurant/toggle-bot/route.ts#L12-L16`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/superadmin/restaurant/toggle-bot/route.ts#L12-L16) | El handler invoca `const isSuperAdmin = await getSuperAdminSession();` pero nunca valida la condición `if (!isSuperAdmin)`. Procede directamente a ejecutar `prisma.restaurant.update` activando o desactivando bots de cualquier comercio de forma anónima. | Agregar de inmediato: `if (!isSuperAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });` antes de procesar el body. |
| **SEC-03** | **Manipulación No Autorizada de Stock y Disponibilidad** | **ALTA (7.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` | [`src/app/api/productos/[id]/disponible/route.ts#L7-L35`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/productos/[id]/disponible/route.ts#L7-L35) | El endpoint PATCH no tiene ninguna guarda de autenticación. Permite a cualquier usuario marcar cualquier producto de la plataforma como agotado (`isAvailable: false, stock: 0`), provocando una denegación de servicio comercial a restaurantes competidores. | Validar sesión de usuario propietaria del restaurante del plato o requerir PIN de cocina verificado en headers/cookies. |
| **SEC-04** | **Exfiltración de Métricas Financieras y Rendimiento de Personal (IDOR)** | **ALTA (7.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` | [`src/app/api/pedidos/metricas/route.ts#L7-L55`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/pedidos/metricas/route.ts#L7-L55) | Ruta GET pública que recibe `?negocio_id=...` y extrae total facturado en el día, ticket promedio, mesas atendidas y nombres completos de los camareros sin autenticar la sesión del solicitante. | Enforzar `resolveAdminAuth(req)` o verificar que `negocio_id` pertenezca a la sesión del usuario antes de retornar métricas sensibles. |
| **SEC-05** | **Sobrescritura Arbitraria de Configuración de Citas y Hospedaje** | **ALTA (7.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` | [`src/app/api/citas/config/route.ts#L64-L115`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/citas/config/route.ts#L64-L115) y [`src/app/api/reservas/config/route.ts#L94-L140`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/reservas/config/route.ts#L94-L140) | Ambos endpoints reciben `negocio_id` en el body JSON y ejecutan un `UPDATE "Restaurant" SET "customLabels" = ...` sobrescribiendo especialistas, horarios, comodidades y reglas del negocio sin verificar sesión de administración. | Exigir autenticación de sesión y validar que el `negocio_id` pertenezca al `session.userId`. |
| **SEC-06** | **Anulación y Alteración de Estados de Comandas sin Autorización** | **MEDIA (6.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` | [`src/app/api/pedidos/[id]/route.ts#L22-L60`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/pedidos/[id]/route.ts#L22-L60) y [`src/app/api/pedidos/[id]/cancelar-item/route.ts#L15`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/pedidos/[id]/cancelar-item/route.ts#L15) | Conociendo el UUID de un pedido o comanda, cualquier usuario puede enviar `PUT` (cambiándolo a "pagado"), `DELETE` (anulando la comanda de la mesa), o cancelar platos individuales apagando el stock sin presentar credencial de mesero o administrador. | Implementar firma de token de mesa temporal o validar sesión/PIN de mesero en cabeceras de autorización. |
| **SEC-07** | **Modificación No Autorizada de Platos Sugeridos (Plato del Día)** | **MEDIA (6.5)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:M/A:N` | [`src/app/api/sugeridos/[slug]/route.ts#L39-L65`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/sugeridos/[slug]/route.ts#L39-L65) y [`src/lib/suggested-dishes-actions.ts#L31`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/lib/suggested-dishes-actions.ts#L31) | `POST /api/sugeridos/[slug]` y la Server Action `toggleSuggestedDishAction` reciben `restaurantId` y `dishId` sin validar autenticación, permitiendo a extraños alterar qué platos aparecen destacados en la portada del comercio. | Requerir `verifyRestaurantOwnership(restaurantId)` en la Server Action y en el endpoint de la API. |
| **SEC-08** | **Fuga de Información Personal (PII) de Comensales en Listado de Pedidos** | **MEDIA (5.3)**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` | [`src/app/api/pedidos/route.ts#L113-L120`](file:///c:/Users/Frank/Documents/MenuQR%20Pro/src/app/api/pedidos/route.ts#L113-L120) | Si un usuario consulta `GET /api/pedidos` sin especificar mesa o slug, el endpoint cae en un fallback `SELECT id FROM negocios LIMIT 1` y devuelve el historial activo completo con nombres, teléfonos y platos consumidos de comensales ajenos. | Eliminar el fallback a "primer negocio" y restringir el listado para comensales únicamente a las órdenes de su propia mesa mediante token verificado. |

---

## 3. TABLA DE HALLAZGOS QUE REQUIEREN VALIDACIÓN EN ENTORNO ([NEEDS_RUNTIME_VALIDATION])

| ID | Área / Componente | Condición de Riesgo | Verificación Requerida en Producción (Coolify / Vultr) |
| :--- | :--- | :--- | :--- |
| **ENV-01** | **Webhooks de Alertas Telegram (`src/lib/telegramAdmin.ts`)** | Si la variable `N8N_SUPERADMIN_WEBHOOK_URL` no está configurada en `.env`, el código utiliza por defecto `https://n8n.ubicame.cc/webhook/alertas-superadmin`. | Verificar que la URL configurada en producción pertenezca a la instancia n8n privada y no reciba cargas maliciosas de red externa. |
| **ENV-02** | **Protección Anti-CSRF en Flujo Google OAuth (`/api/auth/google`)** | El parámetro `state` enviado a Google Accounts se construye con un `base64url` de timestamp y modo sin firma HMAC ni cookie de nonce previa. | Validar si en producción se restringe el dominio en Google Cloud Console (`Authorized redirect URIs`) y agregar firma criptográfica al `state`. |
| **ENV-03** | **Secreto de API Interna (`INTERNAL_API_KEY`)** | El sistema usa fail-safe cerrado si no existe la variable, pero si se configura un valor débil o predecible en Coolify, los endpoints `/api/internal/**` podrían ser invocados por actores no autorizados. | Comprobar que `INTERNAL_API_KEY` en producción sea una cadena pseudo-aleatoria de alta entropía (mínimo 32 bytes en formato hex). |

---

## 4. REGISTRO DE HALLAZGOS REFUTADOS ([REFUTED])

La siguiente tabla documenta las hipótesis de ataque que fueron evaluadas rigurosamente y **descartadas por la presencia comprobada de mecanismos defensivos en código**:

| Hipótesis Adversarial | Componente Evaluado | Veredicto | Mecanismo Defensivo Verificado en Código |
| :--- | :--- | :--- | :--- |
| **Inyección SQL en consultas PostgreSQL nativas (`pool.query`)** | `src/lib/db-pool.ts`, `src/app/api/pedidos/route.ts`, `camareros/route.ts` | **[REFUTED]** | Todas las variables controlables por usuario se pasan estrictamente mediante parámetros posicionales (`$1, $2, $3`). Las únicas interpolaciones encontradas corresponden a constantes de catálogo o enums ternarios de código (`mode === "REAL"`). |
| **Falsificación de Solicitudes en Endpoints Internos (`/api/internal/**`)** | `/api/internal/metrics/weekly-summary`, `/api/internal/notifications/create`, `/api/internal/subscriptions/check-status` | **[REFUTED]** | Protegidos de forma obligatoria por `verifyInternalApiKey` en `src/lib/internal-auth.ts`, el cual utiliza `crypto.timingSafeEqual` y deniega por defecto si la clave no coincide o no existe. |
| **Manipulación BOLA en Facturación y División de Cuentas POS** | `src/lib/split-bill-actions.ts` (`confirmSplitPaymentAction`, `closeTableSessionAction`, `rejectSplitPaymentAction`) | **[REFUTED]** | Toda acción que altera saldos o aprueba pagos invoca `await owner(restaurantId)`, validando que el usuario autenticado sea el dueño legítimo del comercio antes de ejecutar la transacción en Prisma. |
| **Path Traversal en Carga de Archivos e Imágenes (`/api/uploads/[filename]`)** | `src/app/api/uploads/[filename]/route.ts` | **[REFUTED]** | La función aplica sanitización de caracteres mediante `filename.replace(/[^a-zA-Z0-9_.-]/g, "")`, valida extensiones MIME permitidas (`png, jpg, webp, svg`) y aplica cabeceras `Content-Security-Policy: sandbox` en archivos SVG para evitar XSS almacenado. |
| **Falsificación de Webhooks de WhatsApp / Baileys** | `/api/webhook/whatsapp`, `/api/whatsapp/webhook`, `/api/admin/whatsapp/instance` | **[REFUTED]** | Los handlers se encuentran desactivados intencionalmente retornando `{ status: "disabled" }` para proteger la memoria del servidor, por lo que no procesan cargas dinámicas ni ejecutan código backend. |
| **Validación Cruzada de Cupones Multi-Tenant en Ruleta** | `/api/ruleta/validar-cupon` | **[REFUTED]** | Protegido mediante el parche recientemente aplicado que valida que `restaurantId` coincida de manera estricta con la sesión de usuario o pertenezca a sus restaurantes en Prisma, rechazando cualquier intento con HTTP 403. |

---

## 5. LEDGER DE COBERTURA COMPLETA (63 COMPONENTES AUDITADOS)

### 5.1 Endpoints de API REST (`src/app/api/**/route.ts`) - 53 Evaluados (100%)
1. `/api/admin/ai-settings`: ✅ Protegido (`getUserSession` + validación tenant)
2. `/api/admin/ai-settings/models`: ✅ Protegido (`getUserSession` + validación tenant)
3. `/api/admin/ai-settings/test`: ✅ Protegido (`getUserSession` + validación tenant)
4. `/api/admin/notifications`: ✅ Protegido (`resolveAdminAuth`)
5. `/api/admin/notifications/[id]/dismiss`: ✅ Protegido (`resolveAdminAuth`)
6. `/api/admin/notifications/[id]/read`: ✅ Protegido (`resolveAdminAuth`)
7. `/api/admin/whatsapp-templates`: ✅ Protegido (`authorizeRestaurant`)
8. `/api/admin/whatsapp/instance`: ✅ Stub inactivo (`disabled`)
9. `/api/admin/whatsapp/qr`: ✅ Stub inactivo (`disabled`)
10. `/api/admin/whatsapp/sync-webhook`: ✅ Stub inactivo (`disabled`)
11. `/api/auth/google`: ⚠️ Falta firma anti-CSRF en state (`[NEEDS_RUNTIME_VALIDATION]`)
12. `/api/auth/google/callback`: ⚠️ Intercambio OAuth sin verificación de CSRF nonce (`[NEEDS_RUNTIME_VALIDATION]`)
13. `/api/camareros`: ✅ Protegido (Parche de autenticación y exclusión de PIN aplicado)
14. `/api/camareros/[id]`: ✅ Protegido (Parche de autenticación de admin aplicado)
15. `/api/camareros/validar-pin`: ✅ Protegido (Validación PIN local por camarero)
16. `/api/citas`: ℹ️ Endpoint público de reserva de turnos para clientes
17. `/api/citas/[id]`: ⚠️ Falta autenticación en PATCH/DELETE (Ver `SEC-06`)
18. `/api/citas/config`: ❌ Vulnerable a modificación no autorizada (`SEC-05`)
19. `/api/citas/disponibilidad`: ℹ️ Endpoint público de consulta de horarios
20. `/api/cocina/validar-pin`: ✅ Protegido (Validación de PIN de KDS contra base de datos)
21. `/api/diagnose`: ✅ Diagnóstico simple sin exposición de datos
22. `/api/health`: ✅ Health check sin estado
23. `/api/internal/metrics/weekly-summary`: ✅ Protegido (`verifyInternalApiKey`)
24. `/api/internal/notifications/create`: ✅ Protegido (`verifyInternalApiKey`)
25. `/api/internal/subscriptions/check-status`: ✅ Protegido (`verifyInternalApiKey`)
26. `/api/negocios`: ✅ Protegido (`getUserSession` + filtrado)
27. `/api/negocios/[id]`: ✅ Saneado (Exclusión de PIN de camareros)
28. `/api/pedidos`: ⚠️ Fuga de pedidos de otros comensales si no se envía mesa (`SEC-08`)
29. `/api/pedidos/[id]`: ⚠️ Falta autenticación para anulación de comandas (`SEC-06`)
30. `/api/pedidos/[id]/cancelar-item`: ⚠️ Falta autenticación en cancelación individual (`SEC-06`)
31. `/api/pedidos/live`: ✅ Informativo de conexión Socket.IO
32. `/api/pedidos/llamar-mesero`: ℹ️ Endpoint público de comensal en mesa
33. `/api/pedidos/metricas`: ❌ Vulnerable a exfiltración de ventas y personal (`SEC-04`)
34. `/api/pedidos/pedir-cuenta`: ℹ️ Solicitud pública de comensal (no altera montos en DB)
35. `/api/productos/[id]/disponible`: ❌ Vulnerable a modificación no autorizada de stock (`SEC-03`)
36. `/api/public/v1/analytics`: ℹ️ Telemetría pública de eventos
37. `/api/public/v1/marketplace`: ℹ️ Búsqueda pública de comercios
38. `/api/public/v1/restaurants`: ℹ️ Directorio público
39. `/api/public/v1/search`: ℹ️ Motor de búsqueda gastronómica
40. `/api/reservas`: ℹ️ Creación pública de reservas de hospedaje
41. `/api/reservas/[id]`: ⚠️ Falta autenticación en cancelación/edición (`SEC-06`)
42. `/api/reservas/cabanas`: ❌ Vulnerable a modificación no autorizada de precios (`SEC-01`)
43. `/api/reservas/config`: ❌ Vulnerable a sobrescritura de reglas y comodidades (`SEC-05`)
44. `/api/ruleta/config/[slug]`: ℹ️ Configuración de sectores de ruleta pública
45. `/api/ruleta/girar`: ✅ Protegido por limitación de giros anti-fraude
46. `/api/ruleta/validar-cupon`: ✅ Protegido (Parche de aislamiento multi-tenant aplicado)
47. `/api/stock-check`: ℹ️ Validación pública de existencias antes de ordenar
48. `/api/sugeridos/[slug]`: ❌ Vulnerable a modificación no autorizada de platos del día (`SEC-07`)
49. `/api/superadmin/restaurant/toggle-bot`: ❌ Vulnerable a escalación de privilegios (`SEC-02`)
50. `/api/uploads/[filename]`: ✅ Protegido contra path traversal con CSP
51. `/api/webhook/whatsapp`: ✅ Desactivado
52. `/api/whatsapp/qr`: ✅ Desactivado
53. `/api/whatsapp/webhook`: ✅ Desactivado

### 5.2 Módulos de Server Actions (`src/lib/*.ts`) - 10 Evaluados (100%)
1. `src/lib/actions.ts`: ✅ Protegido (`verifyRestaurantOwnership`, `verifySuperAdmin`)
2. `src/lib/caja-actions.ts`: ✅ Protegido (`verifyRestaurantOwnership`)
3. `src/lib/campaign-actions.ts`: ✅ Protegido (`verifyRestaurantOwnership`)
4. `src/lib/inventory-actions.ts`: ✅ Protegido (`verifyRestaurantOwnership`)
5. `src/lib/onboarding-actions.ts`: ✅ Protegido (`getUserSession`)
6. `src/lib/ruleta-actions.ts`: ✅ Protegido (`verifyRestaurantOwnership`)
7. `src/lib/split-bill-actions.ts`: ✅ Protegido (`owner` en acciones financieras de cierre)
8. `src/lib/staff-actions.ts`: ✅ Protegido (`verifyRestaurantAccess`)
9. `src/lib/suggested-dishes-actions.ts`: ⚠️ Falta verificación de sesión en `toggleSuggestedDishAction` (`SEC-07`)
10. `src/lib/superadmin-extra-actions.ts`: ✅ Protegido (`getSuperAdminSession`)

---

## 6. PLAN DE REMEDIACIÓN RECOMENDADO

1. **Remediación Inmediata (Hotfix):**
   * Corregir `src/app/api/superadmin/restaurant/toggle-bot/route.ts` añadiendo la condición de bloqueo si `!isSuperAdmin`.
   * Proteger `src/app/api/reservas/cabanas/route.ts` exigiendo sesión y pertenencia del restaurante antes de actualizar precios de platos.
   * Proteger `src/app/api/productos/[id]/disponible/route.ts` validando sesión de restaurante o PIN de cocina.
2. **Remediación de Mediano Plazo:**
   * Proteger `src/app/api/pedidos/metricas/route.ts` mediante `resolveAdminAuth`.
   * Proteger `src/app/api/citas/config/route.ts` y `src/app/api/reservas/config/route.ts` con verificación de sesión de inquilino.
   * Agregar validación de sesión de propietario en `toggleSuggestedDishAction` de `src/lib/suggested-dishes-actions.ts` y `/api/sugeridos/[slug]`.
   * Incorporar token firmado o nonce cookie en el flujo OAuth de Google en `/api/auth/google`.

---
*Fin del Informe de Auditoría de Seguridad.*

