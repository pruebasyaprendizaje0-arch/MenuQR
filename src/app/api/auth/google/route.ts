import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(req: NextRequest) {
  if (process.env.APP_URL && !process.env.APP_URL.includes("localhost") && !process.env.APP_URL.includes("0.0.0.0")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  let host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!host || host.includes("0.0.0.0")) {
    host = "localhost:3000";
  }
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// GET /api/auth/google?type=RETAIL&mode=register
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const searchParams = req.nextUrl.searchParams;
  const businessType = searchParams.get("type") || "RESTAURANT";
  const mode = searchParams.get("mode") || "login";
  const baseUrl = getBaseUrl(req);

  if (!clientId) {
    const errorUrl = new URL(mode === "register" ? "/registro" : "/login", baseUrl);
    errorUrl.searchParams.set("error", "google_config_missing");
    return NextResponse.redirect(errorUrl);
  }
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // Empaquetar estado para persistir intención (vertical / modo)
  const statePayload = Buffer.from(
    JSON.stringify({
      businessType,
      mode,
      timestamp: Date.now(),
    })
  ).toString("base64url");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", statePayload);
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(googleAuthUrl.toString());
}
