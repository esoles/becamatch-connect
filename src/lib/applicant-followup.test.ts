import { describe, it, expect } from "vitest";
import {
  evaluatePriority,
  recentApplicantsFirst,
  groupApplicants,
  overdue,
  postulationDates,
  postulationDay,
  inPostulationRange,
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
  it("orders most recent applicants before older and undated records", () => {
    const rows = [
      { key: "old", lastActivity: "2026-10-18T16:30:00Z" },
      { key: "missing", lastActivity: null },
      { key: "new", lastActivity: "2026-10-18T16:38:00Z" },
    ];
    expect(rows.sort(recentApplicantsFirst).map((p) => p.key)).toEqual(["new", "old", "missing"]);
  });
  it("submitted test case keeps its stage, next action and explained 30-point priority", () => {
    const action = "Revisar el resultado en el portal oficial (caso ficticio de prueba)";
    const people = groupApplicants({
      profiles: [], calls: [], links: [], saved: [],
      interactions: [{ ...form, title: "Ana · CASO DE PRUEBA", status: "atendida" }],
      followups: [{ ...f, stage: "postulado", next_action: action }],
    }, now);
    expect(people[0]?.followup.stage).toBe("postulado");
    expect(people[0]?.followup.next_action).toBe(action);
    expect(people[0]?.priority).toBe(30);
    expect(people[0]?.factors).toContain("Etapa confirmada: 10/10");
    expect(people[0]?.response).toBe("answered");
  });
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
  it("postulation dates come only from submitted forms and saved plans", () => {
    const plan = { date: "2026-10-12T09:00:00Z", plan: { opportunities: [] } as never };
    expect(
      postulationDates({
        interactions: [
          { ...form, incomingAt: "2026-10-18T09:00:00Z" },
          { ...form, key: "web:b", channel: "Agente web" as const, plans: [plan] },
          { ...form, key: "wa:c", channel: "WhatsApp" as const },
        ],
      }),
    ).toEqual(["2026-10-12T09:00:00Z", "2026-10-18T09:00:00Z"]);
  });
  it("date range is inclusive and compared on Lima calendar days", () => {
    const dates = postulationDates({
      interactions: [{ ...form, incomingAt: "2026-10-19T02:00:00Z" }],
    });
    expect(postulationDay("2026-10-19T02:00:00Z")).toBe("2026-10-18");
    expect(inPostulationRange(dates, "2026-10-18", "2026-10-18")).toBe(true);
    expect(inPostulationRange(dates, "2026-10-19", "2026-10-19")).toBe(false);
    expect(inPostulationRange(dates, "", "")).toBe(true);
    expect(inPostulationRange(dates, "2026-10-19", "")).toBe(false);
  });
  it("a person without form or plan evidence has no postulation date", () =>
    expect(
      postulationDates({
        interactions: [{ ...form, channel: "Agente web" as const, incomingAt: undefined }],
      }),
    ).toEqual([]));
});
