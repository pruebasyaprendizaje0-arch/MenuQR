import { NextResponse } from "next/server";
import os from "os";
import dns from "dns/promises";
import http from "http";
import https from "https";
import net from "net";

function probeTcp(host: string, port: number, timeoutMs = 800): Promise<{ host: string; port: number; open: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ host, port, open: true, latencyMs });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ host, port, open: false, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ host, port, open: false, error: "TIMEOUT" });
    });
  });
}

function probeHttpWithHostHeader(proxyHost: string, proxyPort: number, targetHost: string, isHttps = false, timeoutMs = 1500): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = isHttps ? https : http;
    const req = mod.request(
      {
        host: proxyHost,
        port: proxyPort,
        path: "/instance/fetchInstances",
        method: "GET",
        headers: {
          Host: targetHost,
          apikey: process.env.EVOLUTION_API_KEY || "429644463e6e438816e6f4b3d6f97136",
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 400 : false,
            status: res.statusCode,
            latencyMs: Date.now() - start,
            bodyPreview: data.substring(0, 100),
          });
        });
      }
    );

    req.on("error", (err) => resolve({ ok: false, error: err.message, latencyMs: Date.now() - start }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "TIMEOUT", latencyMs: Date.now() - start });
    });
    req.end();
  });
}

export async function GET() {
  const interfaces = os.networkInterfaces();

  // 1. Probar DNS
  const dnsQueries = [
    "api-qe0f2p00ggzokragtimc4w9u",
    "qe0f2p00ggzokragtimc4w9u-api",
    "coolify-proxy",
    "evolucion.ubicame.cc",
    "host.docker.internal",
  ];
  const dnsResults: Record<string, any> = {};
  for (const name of dnsQueries) {
    try {
      const res = await dns.lookup(name);
      dnsResults[name] = res.address;
    } catch (err: any) {
      dnsResults[name] = `FAIL: ${err.code || err.message}`;
    }
  }

  // 2. Probar TCP en IPs de la subred 10.0.2.x y 172.x
  const tcpProbes = await Promise.all([
    probeTcp("10.0.2.1", 8080),
    probeTcp("10.0.2.2", 8080),
    probeTcp("10.0.2.3", 8080),
    probeTcp("10.0.2.4", 8080),
    probeTcp("10.0.2.5", 8080),
    probeTcp("10.0.2.6", 8080),
    probeTcp("10.0.2.7", 8080),
    probeTcp("coolify-proxy", 80),
    probeTcp("coolify-proxy", 443),
  ]);

  // 3. Probar conexión HTTP a Traefik con Host header
  const traefikHttp = await probeHttpWithHostHeader("coolify-proxy", 80, "evolucion.ubicame.cc", false);
  const traefikHttps = await probeHttpWithHostHeader("coolify-proxy", 443, "evolucion.ubicame.cc", true);

  // 4. Probar Fetch nativo
  let nativeFetchDirect: any = null;
  try {
    const start = Date.now();
    const res = await fetch("https://evolucion.ubicame.cc/instance/fetchInstances", {
      headers: { apikey: process.env.EVOLUTION_API_KEY || "429644463e6e438816e6f4b3d6f97136" },
      signal: AbortSignal.timeout(2000),
    });
    nativeFetchDirect = { status: res.status, ok: res.ok, latencyMs: Date.now() - start };
  } catch (err: any) {
    nativeFetchDirect = { error: err.message };
  }

  return NextResponse.json({
    containerInterfaces: interfaces,
    dnsResults,
    tcpProbes: tcpProbes.filter((p) => p.open || p.host.includes("coolify") || p.host === "10.0.2.4"),
    traefikHttp,
    traefikHttps,
    nativeFetchDirect,
    env: {
      EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
      EVOLUTION_INTERNAL_URL: process.env.EVOLUTION_INTERNAL_URL,
      hasApiKey: Boolean(process.env.EVOLUTION_API_KEY),
    },
  });
}
