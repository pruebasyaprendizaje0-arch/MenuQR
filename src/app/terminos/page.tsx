import Link from "next/link";
import { UtensilsCrossed, ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Términos y Condiciones | MenuQR Pro",
  description: "Términos y Condiciones de Uso del servicio SaaS MenuQR Pro bajo la legislación de la República del Ecuador.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-5xl w-full mx-auto px-6 py-6 flex items-center justify-between relative z-10 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-white text-base tracking-tight">
            MenuQR <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Pro</span>
          </span>
        </Link>
        <Link 
          href="/registro" 
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al Registro
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-4xl w-full mx-auto px-6 py-12 relative z-10 space-y-8 text-slate-300 leading-relaxed text-sm">
        <div className="space-y-3 border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] uppercase font-extrabold text-amber-500 tracking-wider">
            <FileText className="h-3.5 w-3.5" /> Marco Legal Ecuatoriano
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Términos y Condiciones de Uso</h1>
          <p className="text-slate-400 text-xs">
            Última actualización: 19 de Agosto de 2026. Aplicable en todo el territorio de la República del Ecuador.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            1. Ámbito de Aplicación y Aceptación
          </h2>
          <p>
            Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma SaaS <strong>MenuQR Pro</strong> (en adelante, &quot;el Servicio&quot;), proporcionada para la gestión de menús digitales QR y envío automatizado de pedidos a restaurantes en la República del Ecuador.
          </p>
          <p>
            Al registrarse y utilizar el Servicio, el Usuario acepta de forma expresa e incondicional estos Términos, de conformidad con lo establecido en la <strong>Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos (Ley No. 2002-67)</strong> del Ecuador.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            2. Descripción del Servicio y Plan Tarifario
          </h2>
          <p>
            MenuQR Pro permite a propietarios de establecimientos gastronómicos crear y personalizar su menú digital, generar códigos QR para mesas y recibir pedidos directamente en su cuenta de WhatsApp.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Prueba Gratuita:</strong> Al registrarse, el Usuario recibe 30 días de prueba sin costo.</li>
            <li><strong>Único Plan Premium:</strong> Transcurrida la prueba, el costo del servicio es de <strong>$10.00 USD mensuales</strong> (dólares de los Estados Unidos de América).</li>
            <li><strong>Sin Comisiones:</strong> MenuQR Pro no cobra comisiones por pedido ni intermediación sobre las ventas del restaurante.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            3. Obligaciones y Responsabilidades del Usuario
          </h2>
          <p>El Usuario se compromete a:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>Proporcionar información veraz de su establecimiento (Nombre, Provincia, Cantón, Parroquia, Sector y WhatsApp).</li>
            <li>Garantizar que los precios, impuestos (IVA/Servicio) y productos publicados cumplen con las normas ecuatorianas de protección al consumidor (Ley Orgánica de Defensa del Consumidor).</li>
            <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            4. Propiedad Intelectual
          </h2>
          <p>
            Todos los derechos de propiedad intelectual del software, código fuente, logotipos y diseños de MenuQR Pro pertenecen exclusivamente a la plataforma, protegidos por el <strong>Código Orgánico de la Economía Social de los Conocimientos (Código Ingenios)</strong> de la República del Ecuador.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            5. Jurisdicción y Ley Aplicable
          </h2>
          <p>
            Este acuerdo se rige e interpreta bajo las leyes de la República del Ecuador. Para cualquier controversia derivada del presente contrato, las partes se someten expresamente a los tribunales ordinarios del cantón de residencia del establecimiento o a los Centros de Arbitraje y Mediación reconocidos en el Ecuador.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <p>MenuQR Pro Ecuador - Cumplimiento Legal Garantizado.</p>
          <Link href="/privacidad" className="text-amber-400 hover:underline">
            Ver Política de Privacidad LOPDP &rarr;
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-600">
        © 2026 MenuQR Pro Ecuador. Todos los derechos reservados.
      </footer>
    </div>
  );
}
