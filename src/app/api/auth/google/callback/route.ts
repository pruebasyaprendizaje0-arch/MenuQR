import { NextRequest, NextResponse } from "next/server";
import { prismaControl, prismaTenant } from "@/lib/db";
import { setUserSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  if (process.env.APP_URL && !process.env.APP_URL.includes("localhost")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam || !code) {
    const errorUrl = new URL("/login", req.url);
    errorUrl.searchParams.set("error", errorParam || "google_auth_failed");
    return NextResponse.redirect(errorUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    const errorUrl = new URL("/login", req.url);
    errorUrl.searchParams.set("error", "google_config_missing");
    return NextResponse.redirect(errorUrl);
  }

  // Decodificar estado (vertical / modo)
  let businessType = "RESTAURANT";
  let mode = "login";
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      if (decoded.businessType) businessType = decoded.businessType;
      if (decoded.mode) mode = decoded.mode;
    } catch (e) {
      console.warn("No se pudo decodificar state de Google OAuth:", e);
    }
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // 1. Intercambiar código de autorización por token de acceso
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Error al obtener tokens de Google:", tokenData);
      const errorUrl = new URL("/login", req.url);
      errorUrl.searchParams.set("error", "google_token_error");
      return NextResponse.redirect(errorUrl);
    }

    // 2. Obtener perfil de usuario desde Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userRes.json();
    if (!userRes.ok || !profile.email) {
      console.error("Error al obtener perfil de Google:", profile);
      const errorUrl = new URL("/login", req.url);
      errorUrl.searchParams.set("error", "google_profile_error");
      return NextResponse.redirect(errorUrl);
    }

    const cleanEmail = profile.email.toLowerCase().trim();

    // 3. Buscar si el usuario ya existe en la base de datos
    let user = await prismaControl.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user) {
      // Usuario existente: buscar su negocio
      const existingRestaurant = await prismaTenant.restaurant.findFirst({
        where: { userId: user.id },
        select: { id: true, slug: true },
      });

      if (existingRestaurant) {
        await setUserSession(user.id, user.email, existingRestaurant.id);
        return NextResponse.redirect(new URL("/admin", baseUrl));
      } else {
        // Usuario existe pero aún no configuró negocio
        await setUserSession(user.id, user.email);
        const onboardingUrl = new URL("/registro/onboarding", baseUrl);
        onboardingUrl.searchParams.set("type", businessType);
        return NextResponse.redirect(onboardingUrl);
      }
    } else {
      // 4. Usuario Nuevo: Registro Express transparente
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = bcrypt.hashSync(randomPassword, 10);

      const newUser = await prismaControl.user.create({
        data: {
          name: profile.name || profile.given_name || "Usuario Google",
          email: cleanEmail,
          password: hashedPassword,
        },
      });

      await setUserSession(newUser.id, newUser.email);

      // Redirigir al Onboarding Express para elegir nombre y vertical de negocio en 1 clic
      const onboardingUrl = new URL("/registro/onboarding", baseUrl);
      onboardingUrl.searchParams.set("type", businessType);
      onboardingUrl.searchParams.set("is_new", "true");
      return NextResponse.redirect(onboardingUrl);
    }
  } catch (error) {
    console.error("Excepción en callback de Google OAuth:", error);
    const errorUrl = new URL("/login", baseUrl);
    errorUrl.searchParams.set("error", "server_auth_error");
    return NextResponse.redirect(errorUrl);
  }
}
