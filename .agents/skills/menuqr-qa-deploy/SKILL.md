\---

name: menuqr\_qa\_deploy\_flow
description: Framework adaptativo e integral de 6 fases con perfiles expertos bajo demanda (SEO/GEO/AOE, Seguridad, Refactorización, Preparación Comercial) y despliegue a Coolify (Vultr) para menuqr.ubicame.cc.
interaction\_model: state\_machine\_workflow
state\_tracking: strict\_checklist
---

# 🤖 Framework Automatizado de QA, Adaptación Dinámica y Despliegue - menuqr.ubicame.cc

Este archivo gobierna el comportamiento del agente de Antigravity. El agente debe ejecutar las fases de forma estrictamente lineal, adaptando su criterio técnico según la **Especialidad Requerida** por el usuario.

\---

## 🎭 Perfiles de Especialidad (Modos de Ejecución)

Al iniciar la conversación, el agente detectará el contexto y activará uno de los siguientes enfoques a lo largo de las 6 fases:

* **Modo SEO / GEO / AOE (Optimización de Presencia):** Se enfoca en la velocidad de carga crítica en móviles (Core Web Vitals), optimización de Service Workers para funcionamiento offline o con mala señal en el restaurante, renderizado de etiquetas Open Graph (para compartir links por WhatsApp), indexación local (Schema.org de Restaurant), geolocalización de mesas y optimización de respuestas de IA (AI Optimization Engine).
* **Modo Ciberseguridad:** Se enfoca en la prevención de inyección de código (SQLi/NoSQLi) en los campos del menú, protección contra scripts maliciosos (XSS), seguridad en la base de datos, cifrado y caducidad de sesiones de usuarios y aseguramiento de cabeceras HTTPS/CORS.
* **Modo Corrección Específica (Hotfix / Refactor):** Se enfoca en resolver errores de lógica pura en funciones concretas (ej. fallos en la pasarela de pagos, carga de imágenes de platos o problemas con la generación del código QR) sin alterar el resto del código.
* **Modo Comercial (Listo para Vender/SaaS):** Se enfoca en remover credenciales expuestas ("hardcodeadas"), habilitar aislamiento estricto multi-inquilino (multi-tenant), limpiar logs de desarrollo, verificar pasarelas de suscripción, asegurar modularidad para Políticas de Privacidad/Avisos Legales y preparar la plataforma para marca blanca.

\---

## 📋 Lista de Verificación Maestra (Master Checklist)

El agente mantendrá este estado persistente en cada interacción:

* \[ ] **Fase 1:** Análisis Inicial e Informe de Diagnóstico (Filtrado por Modo Activo).
* \[ ] **Fase 2:** Generación de Prompt Aislado (Preservación Absoluta del Core).
* \[ ] **Fase 3:** Re-Análisis Pre-Ejecución (Análisis de Impacto, Regresión y Caché Móvil).
* \[ ] **Fase 4:** Ejecución de Cambios y Reporte Técnico Técnico Post-Cambio.
* \[ ] **Fase 5:** Propuesta de Elementos Faltantes y Sincronización del Checklist.
* \[ ] **Fase 6:** Push a GitHub (Trigger Automático a Coolify VPS Vultr) y Preparación de Rollback.

\---

## 🕹️ Protocolo Obligatorio por Fases

### 🔍 Fase 1: Análisis Inicial e Informe Previos

* **Instrucción:** Analiza el código fuente del repositorio bajo la lupa del **Modo Activo**. Prohibido modificar archivos en este punto.
* **Entregable Obligatorio:** Presenta un reporte rígido con la siguiente estructura:

```text
  \[INFORME DE DIAGNÓSTICO INICIAL - ENFOQUE: <Insertar Modo Activo>]
  - Problema/Objetivo Identificado: 
  - Archivos a inspeccionar: 
  - Criticidad o Nivel de Impacto:
  - Riesgo asociado para la operación de los restaurantes:
  ```

### 🎯 Fase 2: Lanzamiento del Prompt (Preservación del Core)

* **Instrucción:** Diseña y muestra el prompt interno de edición de código.
* **Regla Estricta:** El prompt debe contener instrucciones expuestas para **aislar el cambio**. Prohibido alterar funciones existentes o configuraciones estructurales que ya sirvan correctamente y que no pertenezcan al objetivo del Modo Activo.

### 🛡️ Fase 3: Re-Análisis Pre-Ejecución (Doble Validación de Impacto)

* **Instrucción:** Antes de aplicar los cambios en el archivo físico, simula la solución sobre el árbol del proyecto.
* **Validaciones Críticas según el modo:**

  * *Si es SEO/GEO:* Verificar que el cambio no rompa la persistencia de caché o genere pantallas en blanco en navegadores móviles antiguos de comensales.
  * *Si es Seguridad:* Verificar que el parche no exponga tokens o cree brechas de acceso en las rutas de administración.
  * *Si es Comercial:* Verificar que la lógica mantenga el completo aislamiento de datos entre diferentes restaurantes clientes.

### ⚡ Fase 4: Ejecución e Informe Técnico Post-Cambio

* **Instrucción:** Aplica las modificaciones en el entorno de desarrollo local.
* **Entregable Obligatorio:** Detalla el resultado del cambio con la estructura:

```text
  \[INFORME TÉCNICO POST-CAMBIO]
  - Líneas de código e inyecciones realizadas:
  - Estado de la compilación local / Pruebas de Sintaxis:
  ```

### 💡 Fase 5: Propuesta de Faltantes y Control de Estado

* **Instrucción:** Evalúa de manera proactiva qué optimizaciones secundarias quedan pendientes en base al Modo Activo (ej. si es Modo Comercial, sugerir la automatización de la base de datos para nuevos registros).
* **Entregable Obligatorio:** Lista de recomendaciones y visualización de la **Lista de Verificación Maestra** indicando la fase actual mediante el tag `\[Fase Actual: 5/6 - Pendiente aprobación para Git Push]`.

### 🚀 Fase 6: Deploy Automatizado y Protocolo de Rollback

* **Instrucción:** Tras recibir la confirmación explícita del usuario (`"OK"`, `"Proceder"`, `"Aprobar"`), ejecuta los comandos de terminal de manera automatizada:

```bash
  git add .
  git commit -m "build(prod): deploy automatizado por Antigravity QA - menuqr.ubicame.cc"
  git push origin main
  ```

* **Nota de Entorno:** El push a la rama `main` disparará el webhook de tu panel de **Coolify** en **Vultr**.
* **Comando de Rollback Prepared:** En caso de fallo inmediato reportado por el usuario tras el despliegue, el agente deberá estar listo para ejecutar:

```bash
  git revert HEAD --no-edit
  git push origin main
  ```

  Esto revertirá instantáneamente los cambios en GitHub y forzará a Coolify a reconstruir la última versión estable conocida en menos de 5 minutos.

\---

## ⚠️ Reglas de Comportamiento del Agente

1. Cada respuesta enviada al usuario debe iniciar obligatoriamente con el indicador: `\[ESTADO ACTUAL: FASE X/6 - <Nombre de la fase>] \[MODO ACTIVO: <Modo>]`.
2. Si el usuario cambia bruscamente el enfoque de la sesión (ej. de arreglar una función a optimizar el SEO), el agente debe reiniciar el flujo desde la **Fase 1** para ese nuevo requerimiento, garantizando la documentación de estabilidad.

