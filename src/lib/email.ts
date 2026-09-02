import nodemailer from "nodemailer";
import { Resend } from "resend";

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/restablecer-password?token=${token}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Log link in server console for local testing / fallback
  console.log(`\n==================================================`);
  console.log(`[PASSWORD RESET LINK FOR ${email}]:`);
  console.log(resetLink);
  console.log(`==================================================\n`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #090d16; margin: 0; padding: 40px 20px; color: #f8fafc; }
        .container { max-width: 560px; margin: 0 auto; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 40px; text-align: center; }
        .logo-badge { width: 56px; height: 56px; background: linear-gradient(135deg, #dc2626, #f59e0b); border-radius: 14px; margin: 0 auto 20px; line-height: 56px; color: white; font-size: 24px; font-weight: bold; }
        h1 { color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 8px; }
        p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px; text-align: left; }
        .btn-container { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background: linear-gradient(90deg, #dc2626, #ea580c); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; shadow: 0 4px 14px rgba(220,38,38,0.4); }
        .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; text-align: center; }
        .link-box { background: #020617; padding: 12px; border-radius: 8px; font-size: 12px; color: #f59e0b; word-break: break-all; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-badge">🍽️</div>
        <h1>Recuperación de Contraseña</h1>
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>MenuQR Pro</strong>. Haz clic en el botón a continuación para crear una nueva contraseña:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" class="btn">Restablecer mi Contraseña</a>
        </div>

        <p>Este enlace expirará automáticamente en <strong>1 hora</strong> por razones de seguridad.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo de manera segura. Tu contraseña actual no cambiará.</p>

        <div class="footer">
          <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <div class="link-box">${resetLink}</div>
          <p style="margin-top: 16px;">© MenuQR Pro — Gestión de Menús Digitales</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Prioridad: Resend API
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM || process.env.SMTP_FROM || "MenuQR Pro <onboarding@resend.dev>";
      
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: "Restablece tu contraseña - MenuQR Pro",
        html: htmlContent,
      });

      if (error) {
        console.error("[Email Service] Resend API Error:", error);
        return { success: false, error: `Error al enviar correo vía Resend: ${error.message}` };
      }

      console.log(`[Email Service] Correo enviado con éxito a ${email} mediante Resend (ID: ${data?.id})`);
      return { success: true, mode: "resend", id: data?.id };
    } catch (error: any) {
      console.error("[Email Service] Excepción en Resend API:", error);
      return { success: false, error: `Excepción en servicio Resend: ${error?.message || "Error desconocido"}` };
    }
  }

  // 2. Fallback: SMTP vía Nodemailer
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

      console.log(`[Email Service] Correo enviado con éxito a ${email} mediante servidor SMTP (${host}:${port})`);
      return { success: true, mode: "smtp" };
    } catch (error: any) {
      console.error("[Email Service] Error al enviar correo vía SMTP:", error);
      return { success: false, error: `Error al enviar correo vía SMTP: ${error?.message || "No se pudo conectar al servidor de correo."}` };
    }
  }

  // 3. Fallback: Modo Consola para Desarrollo
  console.warn(
    "[Email Service] Faltan variables RESEND_API_KEY o credenciales SMTP en el entorno (.env). El enlace se registró únicamente en la consola del servidor."
  );
  return { success: true, mode: "console", resetLink };
}
