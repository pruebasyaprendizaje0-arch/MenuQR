import Link from "next/link";
import { UtensilsCrossed, ArrowLeft, ShieldCheck, Lock, Mail, CheckCircle2, UserCheck } from "lucide-react";

export const metadata = {
  title: "Política de Privacidad y Tratamiento de Datos (LOPDP) | MenuQR Pro Ecuador",
  description: "Política de Protección de Datos Personales conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador para menuqr.ubicame.cc.",
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
          <div className="h-9 w-9 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
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
      <main className="max-w-4xl w-full mx-auto px-6 py-12 relative z-10 space-y-10 text-slate-300 leading-relaxed text-sm">
        {/* Top title and badge */}
        <div className="space-y-3 border-b border-slate-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] uppercase font-extrabold tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> LOPDP Ecuador - Registro Oficial Sup. 459
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Política de Privacidad y Tratamiento de Datos Personales
          </h1>
          <p className="text-slate-400 text-xs">
            <strong>Plataforma:</strong> menuqr.ubicame.cc | <strong>Marco Normativo:</strong> Ley Orgánica de Protección de Datos Personales (Ecuador)
          </p>
        </div>

        {/* 1. Responsable del Tratamiento */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">1</span>
            Identificación del Responsable del Tratamiento (Art. 12 LOPDP)
          </h2>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <p>
              La plataforma SaaS <strong>menuqr.ubicame.cc</strong> (perteneciente a la red tecnológica <strong>Ubicame</strong>) actúa como <strong>Responsable del Tratamiento de Datos Personales</strong>, garantizando que todo tratamiento se realiza bajo los principios de juridicidad, lealtad, transparencia, finalidad, pertinencia y minimización de datos exigidos por la legislación ecuatoriana.
            </p>
            <p className="text-slate-400">
              <strong>Canal de Atención para Datos Personales:</strong> <code className="text-amber-400 font-mono">privacidad@ubicame.cc</code> / <code className="text-amber-400 font-mono">soporte@menuqr.ubicame.cc</code>
            </p>
          </div>
        </section>

        {/* 2. Datos Personales Recabados */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">2</span>
            Categorías de Datos Personales Recabados
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <strong className="text-white flex items-center gap-1.5 text-sm">
                <UserCheck className="h-4 w-4 text-emerald-400" />
                Datos del Usuario / Restaurante
              </strong>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Nombres y apellidos del titular o administrador.</li>
                <li>Correo electrónico y credenciales de acceso protegidas.</li>
                <li>Número de teléfono / WhatsApp para recepción de pedidos.</li>
                <li>Ubicación geográfica del negocio (Provincia, Cantón, Parroquia y Sector en Ecuador).</li>
                <li>RUC o Cédula, Razón Social y nombre comercial del establecimiento.</li>
                <li>Comprobantes de transferencia bancaria y datos para emisión de Facturación Electrónica ante el SRI.</li>
              </ul>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <strong className="text-white flex items-center gap-1.5 text-sm">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                Datos de Comensales y Consumidores
              </strong>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Dirección IP y métricas anónimas de visualización del menú.</li>
                <li>Tipo de navegador y resolución de pantalla.</li>
                <li>No se recopilan datos biométricos, financieros ni datos sensibles de los comensales sin autorización previa y expresa.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Finalidades y Base de Licitud */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">3</span>
            Finalidades del Tratamiento y Base Jurídica
          </h2>
          <p>
            El tratamiento de sus datos se sustenta en el <strong>consentimiento libre, informado, específico e inequívoco</strong> del Titular (Art. 7 y 8 LOPDP) y en la <strong>ejecución de medidas contractuales</strong> para la prestación del servicio SaaS:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Creación y administración de la cuenta de usuario y generación de códigos QR.</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Enrutamiento y despacho de pedidos directo al WhatsApp del restaurante.</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Facturación y cobro de planes de suscripción de la plataforma.</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Soporte técnico, seguridad informática y prevención de accesos indebidos.</span>
            </div>
          </div>
        </section>

        {/* 4. Tiempo de Conservación */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">4</span>
            Plazo de Conservación de los Datos
          </h2>
          <p>
            Los datos personales serán conservados mientras se mantenga activa la relación contractual y el uso de la cuenta en <strong>menuqr.ubicame.cc</strong>. Una vez finalizada la relación o solicitada la eliminación por el titular, los datos se conservarán bloqueados únicamente durante los plazos legalmente exigidos por las normas tributarias del SRI y plazos de prescripción civil en el Ecuador (hasta 7 años).
          </p>
        </section>

        {/* 5. Derechos ARCO+ */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">5</span>
            Derechos de los Titulares (Derechos ARCO+ según la LOPDP)
          </h2>
          <p>
            De conformidad con los Artículos 13 al 20 de la LOPDP, todo titular de datos personales en el Ecuador puede ejercer los siguientes derechos:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Acceso (Art. 13 LOPDP):</strong>
              Conocer de forma clara qué datos personales se encuentran registrados y el tratamiento al que están sometidos.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Rectificación y Actualización (Art. 14 LOPDP):</strong>
              Modificar datos inexactos, erróneos, incompletos o desactualizados.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Eliminación / Supresión (Art. 15 LOPDP):</strong>
              Solicitar la supresión de sus datos personales cuando hayan dejado de ser necesarios para la finalidad para la cual fueron recogidos.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Oposición y Portabilidad (Art. 16 y 17 LOPDP):</strong>
              Oponerse al tratamiento en circunstancias específicas y solicitar la entrega de sus datos en formato estructurado e interoperable.
            </div>
          </div>
        </section>

        {/* 6. Canal para el Ejercicio de Derechos */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">6</span>
            Procedimiento y Canal para Ejercer sus Derechos
          </h2>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Mail className="h-4 w-4 text-amber-400" />
              Solicitud de Derechos ARCO en Ecuador
            </div>
            <p>
              Para ejercer cualquiera de sus derechos, envíe una comunicación dirigida al Delegado/Oficial de Protección de Datos al correo electrónico:
            </p>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-amber-400 text-center font-bold">
              privacidad@ubicame.cc
            </div>
            <p className="text-slate-400 text-[11px]">
              La solicitud debe incluir: Nombres completos, número de cédula/RUC del titular, descripción clara del derecho que desea ejercer y los documentos que sustenten la petición. Daremos respuesta en los términos fijados por la LOPDP.
            </p>
          </div>
        </section>

        {/* 7. Seguridad Técnica */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono">7</span>
            Medidas de Seguridad y Confidencialidad
          </h2>
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2 text-xs">
            <p className="flex items-center gap-2 text-white font-semibold">
              <Lock className="h-4 w-4 text-emerald-400" />
              Estándares de Protección de la Información
            </p>
            <p>
              La PLATAFORMA implementa cifrado en tránsito mediante protocolos HTTPS/TLS, algoritmos de hash criptográfico (bcrypt) para contraseñas de usuarios, tokens de sesión seguros (JWT) y segmentación de bases de datos para garantizar la integridad, confidencialidad y resiliencia de los datos almacenados.
            </p>
          </div>
        </section>

        {/* Bottom navigation */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© 2026 MenuQR Pro Ecuador (menuqr.ubicame.cc). Conforme a la LOPDP.</p>
          <Link href="/terminos" className="text-amber-400 hover:underline font-semibold flex items-center gap-1">
            Ver Términos y Condiciones &rarr;
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-600">
        MenuQR Pro Ecuador • Operado conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.
      </footer>
    </div>
  );
}
