import { describe, it, expect } from "vitest";
import {
  evaluatePriority,
  groupApplicants,
  overdue,
  responseState,
  type Followup,
} from "./applicant-followup";
import type { InboxInteraction } from "./interaction-inbox";
const f: Followup = {
  person_key: "form:a",
  stage: "nuevo",
  next_action: "",
  followup_at: null,
  assigned_to: null,
  objective: "",
  response_resolved_at: null,
};
const form: InboxInteraction = {
  key: "form:a",
  id: "a",
  title: "Ana",
  userId: null,
  channel: "Formulario",
  lastActivity: "2026-10-14T09:00:00Z",
  status: "recibida",
  preview: "Quiero orientación",
  messages: [],
  plans: [],
};
const now = Date.parse("2026-10-18T09:00:00Z");
describe("applicant follow-up rules", () => {
  it("flags only strictly more than three days without response", () => {
    expect(overdue({ response: "pending", pendingSince: "2026-10-15T09:00:00Z" }, now)).toBe(false);
    expect(overdue({ response: "pending", pendingSince: "2026-10-15T08:59:59Z" }, now)).toBe(true);
  });
  it("does not flag attended consultations", () =>
    expect(responseState([{ ...form, status: "atendida" }], [], f)).toEqual({
      response: "answered",
      pendingSince: null,
    }));
  it("form attention edits do not reset the incoming timestamp", () =>
    expect(
      responseState(
        [{ ...form, incomingAt: "2026-10-10T09:00:00Z", lastActivity: "2026-10-18T08:00:00Z" }],
        [],
        f,
      ).pendingSince,
    ).toBe("2026-10-10T09:00:00Z"));
  it("an answered channel cannot hide another unknown channel", () =>
    expect(
      responseState(
        [
          { ...form, status: "atendida" },
          { ...form, key: "form:b", processStatus: "correo_enviado" },
        ],
        [],
        f,
      ).response,
    ).toBe("unknown"));
  it("closed stages suppress pending response", () => {
    for (const stage of ["ganado", "perdido"] as const)
      expect(responseState([form], [], { ...f, stage }).pendingSince).toBeNull();
  });
  it("confirmation resolves old messages but not new incoming messages", () => {
    const confirmed = { ...f, response_resolved_at: "2026-10-15T00:00:00Z" };
    expect(responseState([form], [], confirmed).response).toBe("answered");
    expect(
      responseState([{ ...form, lastActivity: "2026-10-16T00:00:00Z" }], [], confirmed).response,
    ).toBe("pending");
  });
  it("WhatsApp outgoing log without receipt remains unknown", () =>
    expect(
      responseState(
        [
          {
            ...form,
            channel: "WhatsApp",
            messages: [
              { id: "in", date: form.lastActivity, direction: "entrante" },
              { id: "out", date: "2026-10-14T09:01:00Z", direction: "saliente" },
            ],
          },
        ],
        [],
        f,
      ).response,
    ).toBe("unknown"));
  it("web assistant text resolves an incoming message", () =>
    expect(
      responseState(
        [
          {
            ...form,
            channel: "Agente web",
            messages: [
              { id: "in", date: form.lastActivity, direction: "user" },
              {
                id: "out",
                date: "2026-10-14T09:01:00Z",
                direction: "assistant",
                message: {
                  id: "out",
                  role: "assistant",
                  parts: [{ type: "text", text: "Respuesta" }],
                },
              },
            ],
          },
        ],
        [],
        f,
      ).response,
    ).toBe("answered"));
  it("without conversation evidence priority is unevaluated", () =>
    expect(
      evaluatePriority(
        {
          interactions: [],
          calls: [],
          saved: [],
          lastActivity: form.lastActivity,
          followup: f,
          pendingSince: null,
        },
        now,
      ).priority,
    ).toBeNull());
  it("documented maximum priority is exactly 100", () =>
    expect(
      evaluatePriority(
        {
          interactions: [
            { ...form, plans: [{ date: form.lastActivity, plan: { opportunities: [] } as never }] },
          ],
          calls: [],
          saved: [{ id: "s", name: "Beca", deadline: "2026-11-01" }],
          lastActivity: form.lastActivity,
          followup: { ...f, stage: "preparando" },
          pendingSince: form.lastActivity,
        },
        now,
      ).priority,
    ).toBe(100));
  it("closed process receives zero, not success inferred from saved scholarships", () =>
    expect(
      evaluatePriority(
        {
          interactions: [form],
          calls: [],
          saved: [],
          lastActivity: form.lastActivity,
          followup: { ...f, stage: "ganado", objective: "Servicio completado" },
          pendingSince: form.lastActivity,
        },
        now,
      ).priority,
    ).toBe(0));
  it("same verified user unifies channels without altering histories", () => {
    const web = { ...form, key: "web:b", channel: "Agente web" as const, userId: "u" };
    const data = {
      profiles: [],
      calls: [],
      followups: [],
      links: [],
      saved: [],
      interactions: [{ ...form, userId: "u" }, web],
    };
    const people = groupApplicants(data, now);
    expect(people).toHaveLength(1);
    expect(people[0]?.channels).toEqual(["Formulario", "Agente web"]);
    expect(people[0]?.interactions).toHaveLength(2);
  });
  it("matching names and unverified emails stay separate", () =>
    expect(
      groupApplicants(
        {
          profiles: [],
          calls: [],
          followups: [],
          links: [],
          saved: [],
          interactions: [form, { ...form, key: "web:b", channel: "Agente web" }],
        },
        now,
      ),
    ).toHaveLength(2));
  it("manual reviewed links preserve both original records", () => {
    const data = {
      profiles: [],
      calls: [],
      followups: [],
      links: [{ source_key: "form:a", target_key: "web:b" }],
      saved: [],
      interactions: [form, { ...form, key: "web:b", channel: "Agente web" as const }],
    };
    expect(groupApplicants(data, now)[0]?.interactions.map((r) => r.key)).toEqual([
      "form:a",
      "web:b",
    ]);
  });
});
