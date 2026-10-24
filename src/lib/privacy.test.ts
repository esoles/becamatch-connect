import { describe, expect, it } from "vitest";
import { consentSchema, consentPayload, emptyConsent, PRIVACY_VERSION } from "./privacy";

describe("informed consent", () => {
  it("starts without any authorizations", () => {
    expect(emptyConsent).toEqual({ legal: false, emailPromotions: false, whatsappPromotions: false });
  });
  it("rejects missing or negative required consent", () => {
    expect(consentSchema.safeParse({ policyVersion: PRIVACY_VERSION }).success).toBe(false);
    expect(consentSchema.safeParse({ policyVersion: PRIVACY_VERSION, legal: false }).success).toBe(false);
  });
  it("does not require promotional consent for the service", () => {
    expect(consentPayload({ ...emptyConsent, legal: true })).toEqual({ policyVersion: PRIVACY_VERSION, legal: true, emailPromotions: false, whatsappPromotions: false });
  });
  it("keeps email and WhatsApp authorizations independent", () => {
    expect(consentPayload({ legal: true, emailPromotions: true, whatsappPromotions: false }).whatsappPromotions).toBe(false);
  });
  it("rejects a different policy version", () => {
    expect(consentSchema.safeParse({ policyVersion: "old", legal: true }).success).toBe(false);
  });
});