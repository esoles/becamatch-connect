import { createFileRoute, Link } from "@tanstack/react-router";
import demoPolicy from "@/lib/privacy-policy-demo.md?raw";
import { PRIVACY_VERSION } from "@/lib/privacy";

export const Route = createFileRoute("/privacidad")({
  head: () => ({ meta: [
    { title: "Política de Privacidad y consentimiento — BecaMatch" },
    { name: "description", content: "Política demostrativa de BecaMatch, finalidades del tratamiento, consentimientos y datos legales pendientes." },
    { property: "og:title", content: "Política de Privacidad — BecaMatch" },
    { property: "og:description", content: "Consulta cómo se usan tus datos y los límites de esta versión demostrativa." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <main className="mx-auto max-w-3xl px-4 py-10">
    <h1 className="font-display text-3xl font-bold">Política de Privacidad</h1>
    <p className="mt-2 text-sm text-muted-foreground">Versión {PRIVACY_VERSION} · 24 de octubre de 2026</p>
    <section className="my-6 space-y-3 border-l-4 border-warning bg-warning/10 p-4 text-sm">
      <h2 className="font-semibold">Documento de demostración: no acredita cumplimiento legal</h2>
      <p>El texto proporcionado no identifica a un responsable real ni un canal operativo para ejercer derechos. No introduzcas datos sensibles. Su aceptación no subsana estas omisiones.</p>
      <p>Antes de utilizar BecaMatch con datos reales deben completarse: identidad y domicilio del responsable, identificación y registro del banco de datos cuando corresponda, destinatarios y transferencias, plazos de conservación, canal y procedimiento de derechos y verificación del representante de menores.</p>
    </section>
    <section className="space-y-4 border-b border-border pb-8 text-sm leading-relaxed">
      <h2 className="text-xl font-semibold">Información de esta implementación</h2>
      <p><strong>Finalidades necesarias:</strong> administrar la cuenta y perfil, calcular compatibilidad reproducible, conservar becas y decisiones; atender solicitudes y conversaciones, analizar datos académicos con IA, preparar planes y enviar los correos solicitados. Los datos obligatorios están señalados en cada formulario: si no los proporcionas o no autorizas el tratamiento requerido, esa acción no se envía.</p>
      <p><strong>Promociones:</strong> correo y WhatsApp tienen autorizaciones independientes y opcionales. Rechazarlas no afecta al registro ni a los planes solicitados. No se habilitan campañas o envíos automáticos por aceptar. Puedes desmarcarlas y guardar en Mi perfil para retirar tu autorización, sin coste; los consentimientos anteriores se conservan como evidencia, no como permiso vigente.</p>
      <p><strong>Datos y proveedores:</strong> se guardan cuenta, fecha de nacimiento, perfil académico, preferencias, decisiones, solicitudes, historial de conversación y evidencia de consentimiento. Lovable Cloud aloja los datos y la autenticación; Lovable AI procesa las preguntas y datos académicos enviados al asistente, incluido el análisis del formulario; Resend procesa correos solicitados y Twilio interviene en WhatsApp cuando se utiliza la conexión real. Google interviene si eliges ese acceso. Las ubicaciones de tratamiento, destinatarios adicionales, contratos y garantías de transferencias internacionales no han sido auditados y deben confirmarse.</p>
      <p><strong>Compatibilidad y decisiones:</strong> la puntuación es un cálculo por reglas sobre tu perfil, no una probabilidad de selección ni una decisión de admisión. La IA puede equivocarse. Las convocatorias y postulaciones se tramitan fuera de BecaMatch.</p>
      <p><strong>Conservación:</strong> los registros e historiales permanecen almacenados; no se ha establecido ni automatizado un plazo de eliminación. El responsable debe definir y publicar plazos concretos por finalidad antes del uso real.</p>
      <p><strong>Derechos y revocación:</strong> puedes solicitar información, acceso, rectificación, cancelación/supresión y oposición y retirar tu consentimiento sin efecto retroactivo. El canal legal de solicitudes está pendiente: el correo .example del documento no funciona. No se presenta la eliminación de la cuenta ni una solicitud de derechos como ejecutada desde esta página.</p>
      <p><strong>Menores:</strong> la autorización parental existente es demostrativa y no verifica a un representante legal. No equivale a consentimiento parental válido; antes de admitir datos reales de menores debe implementarse la verificación y el procedimiento aplicable.</p>
      <p><strong>Marco de referencia:</strong> Ley N.º 29733 y Reglamento aprobado por D.S. N.º 016-2024-JUS, vigente desde el 31 de marzo de 2025; para comunicaciones comerciales también debe evaluarse la Ley N.º 32323. Esta implementación técnica no reemplaza una auditoría jurídica.</p>
      <div className="flex flex-wrap gap-4 text-primary underline"><a href="https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus" target="_blank" rel="noopener noreferrer">Reglamento vigente</a><a href="https://www.smv.gob.pe/Uploads/DS016_2024_JUS.pdf" target="_blank" rel="noopener noreferrer">Texto del reglamento</a></div>
    </section>
    <article className="mt-8 space-y-3 text-sm leading-relaxed" aria-label="Documento demo proporcionado">
      <h2 className="text-xl font-semibold">Documento de ejemplo proporcionado</h2>
      {demoPolicy.split("\n").filter((line) => line.trim()).map((line, i) => {
        const text = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");
        if (line.startsWith("#")) return <h3 key={i} className="pt-4 text-lg font-semibold">{text}</h3>;
        return <p key={i}>{text}</p>;
      })}
    </article>
    <Link to="/" className="mt-8 inline-block text-primary underline">Volver a BecaMatch</Link>
  </main>;
}