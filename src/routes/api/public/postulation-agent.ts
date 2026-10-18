import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, validateUIMessages, tool, isStepCount } from "ai";
import { agentProfileSchema } from "@/lib/postulation-agent";
import { createResponsesCall } from "@/lib/ai/responses.server";
import { buildSystemPrompt } from "@/lib/assistant.server";

export const Route = createFileRoute("/api/public/postulation-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (!origin || origin !== new URL(request.url).origin)
          return new Response("Solicitud no autorizada.", { status: 403 });
        const raw = await request.text();
        if (raw.length > 100000)
          return new Response("La conversación es demasiado extensa.", { status: 400 });
        try {
          const input = JSON.parse(raw);
          if (!Array.isArray(input.messages) || input.messages.length > 100)
            return new Response("Conversación no válida.", { status: 400 });
          const tools = {
            prepare_profile: tool({
              description:
                "Presenta el resumen del perfil para que el visitante lo revise; no genera planes ni envía correos. Usa solo respuestas proporcionadas; campos desconocidos vacíos o null.",
              inputSchema: agentProfileSchema,
              execute: async (profile) => ({ profile, requiresConfirmation: true }),
            }),
          };
          const messages = await validateUIMessages({ messages: input.messages, tools });
          const key = process.env["LOVABLE_API_KEY"];
          if (!key) return new Response("El servicio de IA no está configurado.", { status: 401 });
          const prompt = `${buildSystemPrompt({ scholarship: null, channel: "web" })}
Eres el orientador de planes de postulación. Mantén una sola conversación en español. Haz UNA pregunta por turno. Recopila progresivamente residencia/nacionalidad, nivel actual/deseado, área, promedio y escala, idiomas y nivel, países, año de inicio y financiamiento. No repitas datos ya recibidos. Acepta correcciones y omisiones; no inventes respuestas. No pidas correo ni nombre completo hasta que hagan falta para enviar; el correo se recoge fuera del chat. Usa códigos de idioma es/en/de/fr/pt. Cuando tengas la información o el visitante pida revisar, llama prepare_profile y explica que debe revisar el resumen y pulsar Confirmar y generar plan. No generes planes ni recomiendes becas desde memoria: la aplicación consultará el catálogo y calculará compatibilidad después de confirmar. Si cambian datos, llama prepare_profile con el resumen corregido. No digas que has enviado correo ni que has postulado.`;
          const call = createResponsesCall(
            request,
            {
              baseURL: "https://ai.gateway.lovable.dev/v1",
              apiKey: key,
              model: "openai/gpt-6-astra",
            },
            await convertToModelMessages(messages),
            prompt,
            { tools, stopWhen: isStepCount(50), maxRetries: 0 },
          );
          return call.response(messages);
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("Postulation agent request failed", error);
          return new Response(
            "No se pudo iniciar la conversación. Revisa el mensaje e inténtalo de nuevo.",
            { status: 400 },
          );
        }
      },
    },
  },
});
