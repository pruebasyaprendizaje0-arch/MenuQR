import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Mapeo oficial de subdominios a carpetas de verticales dentro de src/app/(verticales)
const VERTICAL_SUBDOMAINS: Record<string, string> = {
  menuqr: "menuqr",
  catalogo: "ctalo",
  ctalo: "ctalo",
  servicios: "servicios",
  citas: "citas",
  reservas: "reservas",
};

// Rutas globales del sistema que no deben ser reescritas a verticales
const SYSTEM_PREFIXES = [
  "/api",
  "/_next",
  "/uploads",
  "/admin",
  "/super-admin",
  "/caja",
  "/login",
  "/registro",
  "/cocina",
  "/mesas",
  "/rastreo",
  "/ruleta",
  "/recuperar-password",
  "/restablecer-password",
  "/privacidad",
  "/terminos",
  "/faq",
  "/marketplace",
  "/catalogos",
  "/restaurantes",
];

// Extensiones de archivos estáticos que se ignoran
const STATIC_EXT_REGEX = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|txt|xml|json|woff|woff2|ttf|map)$/i;

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Omitir archivos estáticos o chunks internos
  if (STATIC_EXT_REGEX.test(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // 2. Perímetro de seguridad para /admin (redirección preventiva a login si no hay sesión)
  if (pathname.startsWith("/admin")) {
    const sessionToken = request.cookies.get("session_token")?.value;
    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Rutas globales del sistema: permitir acceso directo sin reescritura de vertical
  const isSystemRoute = SYSTEM_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isSystemRoute) {
    return NextResponse.next();
  }

  // 4. Detección de Host y Subdominio dinámico
  const hostHeader =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  
  // Limpiar puerto del host (ej: localhost:3000 -> localhost)
  const host = hostHeader.split(":")[0].toLowerCase();

  // Soporte de anulación para desarrollo y pruebas (ej: ?subdomain=menuqr o ?vertical=citas o header x-subdomain)
  const queryOverride =
    searchParams.get("__vertical") ||
    searchParams.get("vertical") ||
    searchParams.get("subdomain");
  const headerOverride = request.headers.get("x-subdomain");

  let detectedSubdomain: string | null = null;

  if (queryOverride && VERTICAL_SUBDOMAINS[queryOverride.toLowerCase()]) {
    detectedSubdomain = queryOverride.toLowerCase();
  } else if (headerOverride && VERTICAL_SUBDOMAINS[headerOverride.toLowerCase()]) {
    detectedSubdomain = headerOverride.toLowerCase();
  } else {
    // Extracción de subdominio del host
    // Ejemplos:
    // menuqr.ubicame.cc -> "menuqr"
    // catalogo.ubicame.cc -> "catalogo"
    // citas.localhost -> "citas"
    // ubicame.cc / www.ubicame.cc / localhost -> null
    const parts = host.split(".");
    if (parts.length >= 3 && !host.endsWith(".localhost")) {
      // Caso dominio público con subdominio: sub.ubicame.cc
      const sub = parts[0];
      if (sub !== "www") {
        detectedSubdomain = sub;
      }
    } else if (parts.length >= 2 && (host.endsWith(".localhost") || parts[parts.length - 1] === "local")) {
      // Caso desarrollo local: sub.localhost
      detectedSubdomain = parts[0];
    }
  }

  // 5. Si se detecta un subdominio válido de una vertical, reescribir la ruta interna
  if (detectedSubdomain && VERTICAL_SUBDOMAINS[detectedSubdomain]) {
    const verticalFolder = VERTICAL_SUBDOMAINS[detectedSubdomain];

    // Evitar duplicar el prefijo si ya viene con /verticalFolder
    if (pathname.startsWith(`/${verticalFolder}`)) {
      const response = NextResponse.next();
      response.headers.set("x-subdomain", detectedSubdomain);
      response.headers.set("x-vertical", verticalFolder);
      return response;
    }

    // Si es la raíz del subdominio (ej: menuqr.ubicame.cc/ -> /menuqr)
    // Si tiene slug (ej: menuqr.ubicame.cc/mi-restaurante -> /menuqr/mi-restaurante)
    const targetPath = pathname === "/" ? `/${verticalFolder}` : `/${verticalFolder}${pathname}`;
    const rewriteUrl = new URL(targetPath, request.url);

    // Propagar parámetros de búsqueda
    searchParams.forEach((val, key) => {
      rewriteUrl.searchParams.set(key, val);
    });

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-subdomain", detectedSubdomain);
    requestHeaders.set("x-vertical", verticalFolder);
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("x-current-host", hostHeader);

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 6. Dominio principal (ubicame.cc o localhost)
  // Las rutas directas como /menuqr, /ctalo, /servicios, /citas, /reservas funcionan de forma nativa por el route group (verticales)
  const defaultResponse = NextResponse.next();
  defaultResponse.headers.set("x-subdomain", "main");
  defaultResponse.headers.set("x-current-host", hostHeader);
  return defaultResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (persistent volume files)
     * - common static files (.png, .jpg, .svg, etc.)
     */
    "/((?!_next/static|_next/image|uploads|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff|woff2)$).*)",
  ],
};
