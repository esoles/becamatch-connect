import { orientationData, type OrientationFields } from "@/lib/scholarship-orientation";
import { fmtDate } from "@/lib/profile";

export function ScholarshipOrientation({ scholarship }: { scholarship: OrientationFields }) {
  const data = orientationData(scholarship);
  const suffix = data.illustrative ? " (ilustrativos)" : data.verified ? "" : " (sin verificar)";
  return (
    <section className="mt-6 space-y-5">
      <div className="border-l-2 border-primary pl-4 text-sm">
        <h2 className="font-semibold">{data.status}</h2>
        {data.warning && <p className="mt-1 text-muted-foreground">{data.warning}</p>}
        <p className="mt-2 text-muted-foreground">Última verificación: {data.checkedAt ? fmtDate(data.checkedAt) : "Sin comprobación registrada"}</p>
        {data.source && <a href={data.source} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-primary underline">{data.illustrative ? "Enlace de ejemplo" : "Fuente de requisitos"}: {data.source}</a>}
      </div>
      {[
        { title: "Requisitos detallados", items: data.requirements },
        { title: "Restricciones", items: data.restrictions },
      ].map(({ title, items }) => <div key={title}>
        <h2 className="text-lg font-semibold">{title}{suffix}</h2>
        {items.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((text, i) => <li key={i}>{text}</li>)}</ul> : <p className="text-sm text-muted-foreground">No registrado.</p>}
      </div>)}
      <div>
        <h2 className="text-lg font-semibold">Documentos requeridos{suffix}</h2>
        {data.documents.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{data.documents.map((doc, i) => <li key={i}>{doc.nombre} — {doc.obligatorio ? "Obligatorio" : "Opcional"}{data.illustrative ? " en el ejemplo" : ""}</li>)}</ul> : <p className="text-sm text-muted-foreground">No registrado.</p>}
      </div>
      <div>
        <h2 className="text-lg font-semibold">Proceso de postulación{suffix}</h2>
        {data.steps.length ? <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{data.steps.map((text, i) => <li key={i}>{text}</li>)}</ol> : <p className="text-sm text-muted-foreground">No registrado.</p>}
        <p className="mt-2 text-sm text-muted-foreground">La postulación se realiza fuera de BecaMatch.</p>
      </div>
      {data.faqs.length > 0 && <div>
        <h2 className="text-lg font-semibold">Preguntas frecuentes{suffix}</h2>
        {data.faqs.map((faq, i) => <details key={i} className="border-b border-border py-2 text-sm"><summary className="cursor-pointer font-medium">{faq.pregunta}</summary><p className="mt-2 text-muted-foreground">{faq.respuesta}</p></details>)}
      </div>}
    </section>
  );
}