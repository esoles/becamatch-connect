import { z } from "zod";

export const PRIVACY_VERSION = "demo-1.0-2026-10-24";
export const emptyConsent = { legal: false, emailPromotions: false, whatsappPromotions: false };
export type ConsentChoice = typeof emptyConsent;
export const consentSchema = z.object({
  policyVersion: z.literal(PRIVACY_VERSION),
  legal: z.literal(true, { errorMap: () => ({ message: "Debes autorizar el tratamiento indicado en la Política de Privacidad." }) }),
  emailPromotions: z.boolean().default(false),
  whatsappPromotions: z.boolean().default(false),
});
export function consentPayload(choice: ConsentChoice) {
  return consentSchema.parse({ ...choice, policyVersion: PRIVACY_VERSION });
}