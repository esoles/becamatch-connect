import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type UIMessage, type ToolSet, isStepCount } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server.ts";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string },
  messages: ModelMessage[],
  instructions?: string,
  options?: { tools: ToolSet; stopWhen: ReturnType<typeof isStepCount>; maxRetries: number },
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  let upstreamFailure: Response | null = null;
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const response = await runIdFetch.fetch(input, init);
      if (!response.ok) upstreamFailure = response.clone();
      return response;
    },
  });
  const reasoning = config.model !== "openai/chat-latest";
  const result = streamText({
    model: provider.responses(config.model),
    // AI SDK 6 lacks `instructions`: rename this key to `system` there.
    ...(instructions ? { instructions } : {}),
    messages,
    ...options,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  return {
    result,
    response: async (originalMessages: UIMessage[]) => {
      const response = await withLovableAiGatewayRunIdHeader(
        result.toUIMessageStreamResponse({
          originalMessages,
          sendReasoning: true,
          onFinish: () => {},
          onError: (error) =>
            error instanceof Error ? error.message : "No se pudo completar la respuesta.",
        }),
        runIdFetch,
      );
      const failure = upstreamFailure as Response | null;
      if (failure) {
        await response.body?.cancel();
        const body = (await failure.json().catch(() => null)) as {
          message?: string;
          error?: { message?: string };
        } | null;
        return new Response(
          body?.message ?? body?.error?.message ?? "Le service de IA no está disponible.",
          { status: failure.status },
        );
      }
      return response;
    },
  };
}
