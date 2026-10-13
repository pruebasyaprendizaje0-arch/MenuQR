export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initAllConnectedWhatsAppSessions } = await import("@/lib/whatsapp-native");
      initAllConnectedWhatsAppSessions().catch((err) => {
        console.error("[Instrumentation] Error inicializando sesiones de WhatsApp en boot:", err);
      });
    } catch (e) {
      console.error("[Instrumentation] Error cargando módulo whatsapp-native:", e);
    }
  }
}
