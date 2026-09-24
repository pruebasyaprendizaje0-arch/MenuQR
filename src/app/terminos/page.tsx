import Link from "next/link";
import { UtensilsCrossed, ArrowLeft, FileText, Scale, ShieldCheck, AlertCircle, CreditCard } from "lucide-react";

export const metadata = {
  title: "Términos y Condiciones de Uso | MenuQR Pro Ecuador",
  description: "Términos y Condiciones de Uso del servicio SaaS menuqr.ubicame.cc bajo el marco legal de la República del Ecuador.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background glow effects */}
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

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto px-6 py-12 relative z-10 space-y-10 text-slate-300 leading-relaxed text-sm">
        {/* Document Title & Badge */}
        <div className="space-y-3 border-b border-slate-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-amber-500/30 text-[11px] uppercase font-bold text-amber-400 tracking-wider">
            <Scale className="h-3.5 w-3.5" /> Marco Legal: República del Ecuador
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Términos y Condiciones de Uso del Servicio
          </h1>
          <p className="text-slate-400 text-xs">
            <strong>Plataforma SaaS:</strong> menuqr.ubicame.cc | <strong>Última actualización:</strong> Septiembre 2026.
          </p>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2 mt-4">
            <p className="font-medium text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              Contrato de Adhesión Electrónico Vinculante
            </p>
            <p>
              El presente instrumento rige la relación contractual entre <strong>menuqr.ubicame.cc</strong> (en adelante, la &quot;<strong>PLATAFORMA</strong>&quot;) y el <strong>USUARIO / RESTAURANTE</strong>, de conformidad con la <strong>Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos</strong>, el <strong>Código Orgánico de la Economía Social de los Conocimientos (Código INGENIOS)</strong> y la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> de la República del Ecuador.
            </p>
          </div>
        </div>

        {/* 1. Glosario */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">1</span>
            Glosario y Definiciones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Plataforma SaaS:</strong>
              Software alojado en la nube accesible en <code className="text-amber-400">menuqr.ubicame.cc</code>, diseñado para la creación, visualización y gestión de menús digitales interactivos.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Usuario / Restaurante:</strong>
              Persona natural o jurídica (propietario o administrador) debidamente registrada que utiliza la plataforma para digitalizar su oferta gastronómica.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Consumidor Final:</strong>
              Comensal o cliente que escanea el código QR del establecimiento para consultar el menú digital desde su dispositivo móvil.
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <strong className="text-white block mb-1">Contenido del Restaurante:</strong>
              Fotografías, nombres de platos, listas de precios, descripciones de ingredientes, alérgenos y logotipos cargados por el Usuario.
            </div>
          </div>
        </section>

        {/* 2. Objeto del Servicio y Licencia */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">2</span>
            Objeto del Servicio y Licencia de Uso (SaaS)
          </h2>
          <p>
            La PLATAFORMA otorga al USUARIO una <strong>licencia de uso de software limitada, no exclusiva, revocable e intransferible</strong>, bajo modalidad de Software como Servicio (SaaS), con el único fin de crear catálogos digitales interactivos, generar códigos QR asociados y recibir pedidos directos a su canal de atención (WhatsApp).
          </p>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs space-y-2 text-amber-200/90">
            <p className="font-semibold text-amber-300">Naturaleza del Servicio:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>La PLATAFORMA opera como herramienta tecnológica de visualización y comunicación directa entre el Restaurante y sus comensales.</li>
              <li>Salvo módulos de pago expresamente contratados con pasarelas certificadas, la PLATAFORMA no procesa, no retiene ni intermedia fondos monetarios derivados del consumo en los establecimientos.</li>
            </ul>
          </div>
        </section>

        {/* 3. Registro y Custodia de Cuentas */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">3</span>
            Registro de Cuentas, Veracidad y Custodia de Contraseñas
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Veracidad de la Información:</strong> El Usuario declara que los datos provistos (Nombre, Correo, Cédula/RUC, Ubicación territorial y WhatsApp) son verídicos, exactos y vigentes ante las autoridades ecuatorianas.
            </li>
            <li>
              <strong className="text-slate-200">Custodia de Credenciales:</strong> El Usuario es el único responsable de la confidencialidad de su contraseña. Cualquier operación efectuada bajo sus credenciales se presumirá realizada legítimamente por el titular de la cuenta.
            </li>
            <li>
              <strong className="text-slate-200">Deber de Notificación:</strong> Ante cualquier indicio de vulneración de seguridad o acceso no autorizado, el Usuario deberá notificar inmediatamente a la administración de la plataforma.
            </li>
          </ul>
        </section>

        {/* 4. Precios, Facturación y Métodos de Pago */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">4</span>
            Precios, Facturación y Métodos de Pago (Ecuador)
          </h2>
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <CreditCard className="h-4 w-4" /> Modalidad de Suscripción y Monetización
            </div>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>Prueba Gratuita y Modificación de Tarifas:</strong> La PLATAFORMA ofrece un período de prueba gratuito o promocional. La PLATAFORMA se reserva el derecho de estructurar, implementar o ajustar planes de suscripción de pago en el futuro, notificando cualquier modificación tarifaria con al menos quince (15) días de anticipación mediante correo electrónico o notificación en el panel administrativo.
              </li>
              <li>
                <strong>Método de Pago Autorizado:</strong> El medio principal para la contratación y renovación de planes comerciales es mediante <strong>Transferencia Bancaria Directa</strong> o depósito a las cuentas bancarias institucionales en el Ecuador expresamente autorizadas e indicadas en la plataforma.
              </li>
              <li>
                <strong>Obligación de Envío del Comprobante:</strong> Es responsabilidad y obligación exclusiva del USUARIO enviar el <strong>comprobante o váucher de transferencia bancaria legítimo</strong> y legible a través de los canales oficiales de soporte (WhatsApp o correo administrativo). La activación, acreditación o renovación del servicio quedará supeditada a la verificación efectiva de la acreditación de los fondos.
              </li>
              <li>
                <strong>Emisión de Factura Electrónica (SRI):</strong> Una vez confirmada la acreditación de los valores, la PLATAFORMA emitirá la respectiva <strong>Factura Electrónica autorizada por el Servicio de Rentas Internas (SRI)</strong> de la República del Ecuador, la cual será remitida al correo electrónico registrado por el Usuario con los datos tributarios (RUC/Cédula, Razón Social y Dirección) suministrados.
              </li>
              <li>
                <strong>Política de Suspensión por Falta de Pago:</strong> En caso de vencimiento del período de prueba o falta de acreditación oportuna del pago de la renovación de la suscripción, la PLATAFORMA se reserva el derecho de suspender temporalmente el acceso al panel de administración y la disponibilidad pública del menú digital. La información del restaurante se conservará en estado de gracia por un período de hasta treinta (30) días calendario para su reactivación tras el pago correspondiente.
              </li>
            </ul>
          </div>
        </section>

        {/* 5. Propiedad Intelectual */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">5</span>
            Propiedad Intelectual (Código INGENIOS)
          </h2>
          <p>
            Conforme a lo dispuesto en el <strong>Código Orgánico de la Economía Social de los Conocimientos, Creatividad e Innovación (Código INGENIOS)</strong> del Ecuador:
          </p>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">Propiedad del Software y Marca &quot;Ubicame&quot;:</strong>
              El código fuente, arquitectura web, bases de datos, algoritmos, interfaz gráfica, logotipos, marcas comerciales e isotipos de <strong>MenuQR Pro</strong> y <strong>Ubicame</strong> son de propiedad exclusiva de EL PROVEEDOR. Queda terminantemente prohibida su copia, ingeniería inversa o descompilación.
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <strong className="text-white block mb-1">Propiedad del Contenido del Restaurante:</strong>
              Las fotografías de platos, marcas comerciales registradas y descripciones cargadas por el Usuario son y seguirán siendo propiedad exclusiva del Restaurante. El Usuario otorga a la PLATAFORMA únicamente una licencia técnica de hospedaje y despliegue público para prestar el servicio contratado.
            </div>
          </div>
        </section>

        {/* 6. Limitación de Responsabilidad */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">6</span>
            Limitación de Responsabilidad e Indemnidad
          </h2>
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-xs space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <AlertCircle className="h-4 w-4" /> Deslinde de Responsabilidad Gastronómica y Comercial
            </div>
            <p className="text-slate-300">
              La PLATAFORMA es un proveedor tecnológico y no interviene en la preparación, fijación de precios, cobro ni entrega de alimentos. En consecuencia:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Salubridad y Alérgenos:</strong> El Restaurante es el único y exclusivo responsable por la calidad de los alimentos, estado de conservación, advertencias sobre alérgenos, intoxicaciones alimentarias y daños a la salud que pudieran sufrir los consumidores.
              </li>
              <li>
                <strong>Precios e Impuestos:</strong> El Restaurante responderá ante el Consumidor Final y el Servicio de Rentas Internas (SRI) por la exactitud de precios, aplicación del IVA, tasas de servicio y emisión de comprobantes autorizados (Ley Orgánica de Defensa del Consumidor).
              </li>
              <li>
                <strong>Disponibilidad Técnica:</strong> La PLATAFORMA no responde por pérdidas comerciales derivadas de interrupciones temporales del servicio debidas a caídas de telecomunicaciones, servidores cloud o eventos fortuitos de fuerza mayor.
              </li>
            </ul>
          </div>
        </section>

        {/* 7. Privacidad y Datos Personales */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">7</span>
            Tratamiento de Datos Personales (Art. 12 LOPDP)
          </h2>
          <p>
            El tratamiento de datos personales de los representantes de restaurantes y usuarios se rige estrictamente por la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong>. Para conocer en detalle las finalidades, plazos de conservación y el ejercicio de los <strong>Derechos ARCO+</strong> (Acceso, Rectificación, Eliminación, Oposición y Portabilidad), consulte nuestra:
          </p>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="text-white font-semibold text-xs">Política de Privacidad Integral</div>
                <div className="text-[11px] text-slate-400">Canal formal de ejercicio de derechos: privacidad@ubicame.cc</div>
              </div>
            </div>
            <Link 
              href="/privacidad" 
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs transition"
            >
              Leer Política &rarr;
            </Link>
          </div>
        </section>

        {/* 8. Modificaciones y Solución de Disputas */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-500/10 text-amber-400 text-xs font-mono">8</span>
            Modificaciones del Servicio y Solución de Controversias
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Modificaciones:</strong> La PLATAFORMA podrá actualizar estos términos con previo aviso de 15 días en la interfaz o vía correo electrónico.
            </li>
            <li>
              <strong className="text-slate-200">Mediación Previa:</strong> Las partes acuerdan que cualquier controversia sobre este contrato será sometida en primera instancia a un <strong>Centro de Mediación calificado por el Consejo de la Judicatura del Ecuador</strong>.
            </li>
            <li>
              <strong className="text-slate-200">Jurisdicción Ordinaria:</strong> De no alcanzarse un acuerdo en mediación, las partes se someten a la competencia de los <strong>Jueces de la Unidad Judicial de lo Civil</strong> del Ecuador.
            </li>
          </ul>
        </section>

        {/* Bottom navigation */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© 2026 MenuQR Pro Ecuador (menuqr.ubicame.cc). Cumplimiento legal garantizado.</p>
          <Link href="/privacidad" className="text-amber-400 hover:underline font-semibold flex items-center gap-1">
            Ver Política de Privacidad LOPDP &rarr;
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-600">
        MenuQR Pro Ecuador • Operado bajo legislación de la República del Ecuador.
      </footer>
    </div>
  );
}
