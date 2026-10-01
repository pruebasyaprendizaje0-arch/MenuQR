#!/usr/bin/env node

/**
 * Script de Verificación Automatizada de Salud y Latencia (Healthcheck)
 * Evolution API (v2.3.7) <-> MenuQR Pro (Next.js App Router)
 *
 * Uso:
 *   node scripts/healthcheck-evolution.js
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

// Cargar variables de entorno del archivo .env local si existe
try {
  require("dotenv").config();
} catch (e) {
  // dotenv no instalado o .env cargado nativamente
}

// Colores para consola
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const config = {
  evolutionUrl: (process.env.EVOLUTION_API_URL || "https://evolucion.ubicame.cc").replace(/\/+$/, ""),
  apiKey: process.env.EVOLUTION_API_KEY || "tu_global_api_key",
  instance: process.env.EVOLUTION_INSTANCE_NAME || "menuqr",
  nextjsWebhookUrl: (process.env.NEXTJS_WEBHOOK_URL || "https://ubicame.cc/api/webhook/whatsapp").replace(/\/+$/, ""),
  webhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET || process.env.EVOLUTION_API_KEY || "",
};

function logHeader(title) {
  console.log(`\n${colors.cyan}${colors.bright}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}====================================================${colors.reset}`);
}

function logStatus(label, pass, detail = "") {
  const icon = pass ? `${colors.green}✔ PASÓ${colors.reset}` : `${colors.red}✖ FALLÓ${colors.reset}`;
  console.log(`[${icon}] ${colors.bright}${label}${colors.reset} ${detail ? colors.dim + "(" + detail + ")" + colors.reset : ""}`);
}

function makeRequest(urlStr, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const startTime = Date.now();

    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: {
        "User-Agent": "MenuQR-HealthCheck/1.0",
        ...options.headers,
      },
      timeout: 10000,
    };

    const req = client.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const latency = Date.now() - startTime;
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          latency,
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout de conexión (10s)"));
    });

    if (bodyData) {
      req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runHealthCheck() {
  logHeader("🔍 DIAGNÓSTICO DE INFRAESTRUCTURA Y HEALTH CHECK");
  console.log(`• Evolution API URL : ${colors.yellow}${config.evolutionUrl}${colors.reset}`);
  console.log(`• Next.js Webhook URL: ${colors.yellow}${config.nextjsWebhookUrl}${colors.reset}`);
  console.log(`• Instancia Objetivo : ${colors.yellow}${config.instance}${colors.reset}`);

  let overallPassed = true;

  // -------------------------------------------------------------
  // TEST 1: Conectividad con Evolution API
  // -------------------------------------------------------------
  logHeader("1. Prueba de Conectividad a Evolution API");
  try {
    const res = await makeRequest(`${config.evolutionUrl}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: config.apiKey },
    });

    if (res.status === 200) {
      logStatus("Evolution API reachable", true, `HTTP 200 | Latencia: ${res.latency}ms`);
    } else {
      logStatus("Evolution API reachable", false, `HTTP ${res.status}`);
      overallPassed = false;
    }
  } catch (err) {
    logStatus("Evolution API reachable", false, `Error: ${err.message}`);
    overallPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 2: Inspeccionar Configuración del Webhook en la Instancia
  // -------------------------------------------------------------
  logHeader("2. Verificación de Parámetros del Webhook en la Instancia");
  try {
    const res = await makeRequest(`${config.evolutionUrl}/webhook/find/${config.instance}`, {
      method: "GET",
      headers: { apikey: config.apiKey },
    });

    if (res.status === 200 && res.data) {
      const webhookData = res.data.webhook || res.data;
      const isEnabled = Boolean(webhookData.enabled);
      const isUrlMatch = webhookData.url === config.nextjsWebhookUrl;
      const isByEventsCorrect = webhookData.byEvents === false;
      const isBase64Correct = webhookData.base64 === false;

      logStatus("Webhook Habilitado (enabled: true)", isEnabled, isEnabled ? "Activo" : "Inactivo");
      logStatus(`URL Coincide (${config.nextjsWebhookUrl})`, isUrlMatch, `URL Actual: ${webhookData.url || "N/A"}`);
      logStatus("Parámetro 'byEvents' es false", isByEventsCorrect, `byEvents: ${webhookData.byEvents}`);
      logStatus("Parámetro 'base64' es false", isBase64Correct, `base64: ${webhookData.base64}`);

      if (!isEnabled || !isUrlMatch || !isByEventsCorrect || !isBase64Correct) {
        overallPassed = false;
        console.log(`\n${colors.yellow}⚠️ RECOMENDACIÓN: Ejecuta la reconfiguración del webhook con byEvents=false y base64=false.${colors.reset}`);
      }
    } else {
      logStatus("Webhook Configurado", false, `HTTP ${res.status}`);
      overallPassed = false;
    }
  } catch (err) {
    logStatus("Lectura de Webhook", false, `Error: ${err.message}`);
    overallPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 3: Prueba Directa al Endpoint de Next.js App Router
  // -------------------------------------------------------------
  logHeader("3. Prueba de Invocación Directa al Webhook Next.js");
  try {
    const mockPayload = {
      event: "MESSAGES_UPSERT",
      instance: config.instance,
      data: {
        key: {
          remoteJid: "593999999999@s.whatsapp.net",
          fromMe: false,
          id: `HEALTHCHECK_${Date.now()}`,
        },
        pushName: "Tester Automatizado",
        message: {
          conversation: "menu",
        },
        messageType: "conversation",
      },
    };

    const res = await makeRequest(
      config.nextjsWebhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.webhookSecret,
        },
      },
      mockPayload
    );

    if (res.status === 200) {
      logStatus("Respuesta HTTP 200 OK del Webhook", true, `Latencia: ${res.latency}ms`);
      if (res.latency > 1500) {
        console.log(`  ${colors.yellow}⚠️ Advertencia: Latencia alta (${res.latency}ms). Verifica procesamiento asíncrono.${colors.reset}`);
      } else {
        console.log(`  ${colors.green}⚡ Excelente latencia de respuesta (${res.latency}ms).${colors.reset}`);
      }
    } else {
      logStatus("Respuesta HTTP 200 OK del Webhook", false, `HTTP ${res.status}`);
      overallPassed = false;
    }
  } catch (err) {
    logStatus("Invocación al Webhook Next.js", false, `Error: ${err.message}`);
    overallPassed = false;
  }

  // -------------------------------------------------------------
  // RESUMEN FINAL
  // -------------------------------------------------------------
  logHeader("📊 RESUMEN FINAL DE SALUD DE INFRAESTRUCTURA");
  if (overallPassed) {
    console.log(`${colors.green}${colors.bright}🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!${colors.reset}`);
    console.log(`La integración entre Evolution API y Next.js App Router está sana y optimizada.\n`);
  } else {
    console.log(`${colors.red}${colors.bright}❌ SE DETECTARON ANOMALÍAS EN LA INFRAESTRUCTURA.${colors.reset}`);
    console.log(`Revisa las recomendaciones y los logs anteriores para corregir la configuración.\n`);
    process.exit(1);
  }
}

runHealthCheck().catch((err) => {
  console.error("Error crítico ejecutando Health Check:", err);
  process.exit(1);
});
