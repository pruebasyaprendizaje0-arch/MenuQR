import Link from "next/link";
import { UtensilsCrossed, ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Política de Privacidad (LOPDP Ecuador) | MenuQR Pro",
  description: "Política de Protección de Datos Personales conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.",
};

export default function PrivacidadPage() {
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px] uppercase font-extrabold tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> LOPDP Ecuador - Registro Oficial Sup. 459
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">Política de Privacidad y Tratamiento de Datos Personales</h1>
          <p className="text-slate-400 text-xs">
            En cumplimiento estricto de la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            1. Identificación del Responsable del Tratamiento
          </h2>
          <p>
            La plataforma <strong>MenuQR Pro Ecuador</strong> actúa como Responsable del Tratamiento de los datos personales recolectados a través de su sitio web y aplicación SaaS, garantizando los principios de juridicidad, lealtad, transparencia, finalidad y seguridad exigidos por la LOPDP.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            2. Datos Personales Recabados
          </h2>
          <p>Para la prestación del Servicio, recolectamos los siguientes datos personales de los usuarios registrados:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Identificación y Contacto:</strong> Nombre del titular, correo electrónico y número de teléfono/WhatsApp.</li>
            <li><strong>Ubicación Geográfica:</strong> Provincia, Cantón, Parroquia y Sector del establecimiento en Ecuador.</li>
            <li><strong>Información Comercial:</strong> Nombre comercial del restaurante, logotipo, catálogo de productos y precios.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            3. Finalidades del Tratamiento
          </h2>
          <p>Los datos suministrados serán tratados exclusivamente para las siguientes finalidades legitimadas:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>Creación y administración de la cuenta de Usuario y del menú digital QR.</li>
            <li>Enrutamiento automatizado de pedidos desde el menú público hacia el número de WhatsApp del establecimiento.</li>
            <li>Gestión de cobro y facturación del Único Plan Premium ($5 USD/mes).</li>
            <li>Brindar soporte técnico y comunicaciones operativas del Servicio.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            4. Derechos de los Titulares (Derechos ARCO+)
          </h2>
          <p>
            De conformidad con los Artículos 13 al 20 de la LOPDP ecuatoriana, los Usuarios tienen derecho a ejercer sus derechos de:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-white">Acceso e Información:</strong> Conocer qué datos personales tenemos almacenados.
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-white">Rectificación y Actualización:</strong> Modificar datos inexactos o desactualizados.
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-white">Eliminación / Supresión:</strong> Solicitar el borrado de sus datos cuando termine el servicio.
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-white">Oposición y Portabilidad:</strong> Oponerse al tratamiento o solicitar la entrega estructurada de sus datos.
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Para ejercer cualquiera de estos derechos, el titular puede enviar una solicitud formal a nuestro correo electrónico o soporte por WhatsApp.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            5. Seguridad y Confidencialidad
          </h2>
          <p>
            MenuQR Pro implementa medidas técnicas, organizativas y de cifrado (SSL/HTTPS, contraseñas encriptadas con bcrypt, tokens JWT) para proteger los datos personales contra acceso no autorizado, pérdida o alteración. No vendemos ni compartimos sus datos personales con terceros con fines comerciales.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <p>Conforme a la Autoridad de Protección de Datos Personales del Ecuador.</p>
          <Link href="/terminos" className="text-amber-400 hover:underline">
            Ver Términos y Condiciones &rarr;
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
