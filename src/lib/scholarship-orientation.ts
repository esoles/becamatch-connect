import { z } from "zod";

export interface OrientationFields {
  es_demo?: boolean;
  requisitos_detallados?: unknown;
  documentos_requeridos?: unknown;
  proceso_postulacion?: unknown;
  restricciones?: unknown;
  preguntas_frecuentes?: unknown;
  fuente_requisitos?: string | null;
  ultima_verificacion?: string | null;
  estado_datos?: string;
  aviso_datos?: string | null;
}

const strings = z.array(z.string().min(1));
const documents = z.array(z.object({ nombre: z.string().min(1), obligatorio: z.boolean() }));
const faqs = z.array(z.object({ pregunta: z.string().min(1), respuesta: z.string().min(1) }));

export function orientationData(s: OrientationFields) {
  const illustrative = s.es_demo === true || s.estado_datos === "propuesta_ficticia_no_verificada";
  const verified = !illustrative && s.estado_datos === "verificada";
  return {
    illustrative,
    verified,
    status: illustrative ? "Datos ficticios · no verificados" : verified ? "Datos verificados" : "Pendiente de verificación",
    warning: illustrative
      ? `Beca ficticia de práctica; no representa un programa real. ${s.aviso_datos || "Los requisitos, documentos y pasos son ilustrativos, no oficiales."}`
      : verified ? s.aviso_datos : s.aviso_datos || "Información pendiente de verificación; confirma los requisitos en la fuente oficial.",
    requirements: strings.safeParse(s.requisitos_detallados).data ?? [],
    documents: documents.safeParse(s.documentos_requeridos).data ?? [],
    steps: strings.safeParse(s.proceso_postulacion).data ?? [],
    restrictions: strings.safeParse(s.restricciones).data ?? [],
    faqs: faqs.safeParse(s.preguntas_frecuentes).data ?? [],
    source: s.fuente_requisitos ?? null,
    checkedAt: s.ultima_verificacion ?? null,
  };
}

export function withOrientationWarning(reply: string, s: OrientationFields) {
  const data = orientationData(s);
  return data.warning ? `${data.warning}\n\n${reply}` : reply;
}