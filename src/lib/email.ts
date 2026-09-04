import nodemailer from "nodemailer";
import { Resend } from "resend";

function getBaseUrl(): string {
  let url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!url && process.env.NODE_ENV === "production") {
    url = "https://menuqr.ubicame.cc";
  }
  if (!url) {
    url = "http://localhost:3000";
  }
  url = url.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = getBaseUrl();
  const resetLink = `${baseUrl}/restablecer-password?token=${token}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const timestamp = new Date().toISOString();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer Contraseña - MenuQR Pro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; margin: 0; padding: 40px 20px; color: #f8fafc; }
        .container { max-width: 560px; margin: 0 auto; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 40px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        .logo-badge { width: 56px; height: 56px; background: linear-gradient(135deg, #dc2626, #f59e0b); border-radius: 14px; margin: 0 auto 20px; line-height: 56px; color: white; font-size: 24px; font-weight: bold; }
        h1 { color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 12px; tracking-tight; }
        p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px; text-align: left; }
        .btn-container { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background: linear-gradient(90deg, #dc2626, #ea580c); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-weight: 700; font-size: 15px; shadow: 0 4px 14px rgba(220,38,38,0.4); }
        .footer { margin-top: 36px; padding-top: 24px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; text-align: center; }
        .link-box { background: #020617; padding: 12px; border-radius: 8px; font-size: 12px; color: #f59e0b; word-break: break-all; margin-top: 16px; border: 1px solid #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-badge">🍽️</div>
        <h1>Recuperación de Contraseña</h1>
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>MenuQR Pro</strong>. Haz clic en el botón a continuación para crear una nueva contraseña:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" target="_blank" class="btn">Restablecer mi Contraseña</a>
        </div>

        <p>Este enlace de seguridad expirará automáticamente en <strong>1 hora</strong>.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo de manera segura. Tu contraseña actual no sufrirá ninguna modificación.</p>

        <div class="footer">
          <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
          <div class="link-box">${resetLink}</div>
          <p style="margin-top: 20px;">© MenuQR Pro — Sistema de Menús Digitales para Restaurantes</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Envío prioritario vía Resend API
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM || process.env.SMTP_FROM || '"MenuQR Pro" <no-reply@send.ubicame.cc>';
      
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: "Restablece tu contraseña - MenuQR Pro",
        html: htmlContent,
      });

      if (error) {
        console.error(`[Email Service] [${timestamp}] Error en Resend API enviando a ${email}:`, error);
        return { success: false, error: `Error en servicio de correo (Resend): ${error.message}` };
      }

      console.log(`[Email Service] [${timestamp}] Correo de recuperación enviado vía Resend API (ID: ${data?.id})`);
      return { success: true, mode: "resend", id: data?.id };
    } catch (error: any) {
      console.error(`[Email Service] [${timestamp}] Excepción crítica en Resend API al enviar a ${email}:`, error);
      return { success: false, error: `Error al enviar correo electrónico: ${error?.message || "Error inesperado en servidor de correo."}` };
    }
  }

  // 2. Fallback: Servidor SMTP tradicional (Nodemailer)
  if (host && user && pass) {
    try {
      const from = process.env.SMTP_FROM || (user ? `"MenuQR Pro" <${user}>` : '"MenuQR Pro" <soporte@menuqrpro.com>');
      const secureEnv = process.env.SMTP_SECURE;
      const secure = secureEnv !== undefined ? secureEnv === "true" : port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
      });

      await transporter.sendMail({
        from,
        to: email,
        subject: "Restablece tu contraseña - MenuQR Pro",
        html: htmlContent,
      });

      console.log(`[Email Service] [${timestamp}] Correo de recuperación enviado mediante SMTP.`);
      return { success: true, mode: "smtp" };
    } catch (error: any) {
      console.error(`[Email Service] [${timestamp}] Error al enviar correo vía SMTP a ${email}:`, error);
      return { success: false, error: `Error al enviar correo vía SMTP: ${error?.message || "No se pudo conectar al servidor de correo."}` };
    }
  }

  // In production, never expose a reset token through logs or a response.
  if (process.env.NODE_ENV === "production") {
    console.error(`[Email Service] [${timestamp}] No hay proveedor de correo configurado.`);
    return { success: false, error: "El servicio de correo no está configurado." };
  }

  // Local development only: returning the link makes password-reset UI testable.
  console.warn(`[Email Service] [${timestamp}] Correo no configurado; enlace disponible solo para desarrollo local.`);
  return { success: true, mode: "development", resetLink };
}
