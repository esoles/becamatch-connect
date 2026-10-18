import { describe, expect, it } from "vitest";
import {
  filterInteractions,
  relatedInteractions,
  sortInteractions,
  type InboxInteraction,
} from "./interaction-inbox";
const form: InboxInteraction = {
  key: "form:a",
  id: "a",
  channel: "Formulario",
  title: "Ana",
  userId: null,
  lastActivity: "2026-10-18T05:00:00Z",
  preview: "Solicitud",
  status: "recibida",
  email: "ana@example.com",
  messages: [],
  plans: [],
};
const web: InboxInteraction = {
  ...form,
  key: "web:b",
  id: "b",
  channel: "Agente web",
  lastActivity: "2026-10-18T05:30:00Z",
};
describe("central inbox rules", () => {
  it("opens most recent real activity regardless of channel", () =>
    expect(sortInteractions([form, web])[0]?.key).toBe("web:b"));
  it("separates form, web and WhatsApp filters", () => {
    const wa: InboxInteraction = { ...web, key: "wa:c", channel: "WhatsApp" };
    expect(filterInteractions([form, web, wa], "Formulario").map((r) => r.key)).toEqual(["form:a"]);
    expect(filterInteractions([form, web, wa], "Agente web").map((r) => r.key)).toEqual(["web:b"]);
    expect(filterInteractions([form, web, wa], "WhatsApp").map((r) => r.key)).toEqual(["wa:c"]);
  });
  it("does not relate matching names or unconfirmed emails", () =>
    expect(relatedInteractions([form, web], form)).toEqual([]));
  it("relates only the same verified user without merging histories", () => {
    const a = { ...form, userId: "verified-user" },
      b = { ...web, userId: "verified-user" };
    expect(
      relatedInteractions([a, b, { ...web, key: "other", userId: "other-user" }], a).map(
        (r) => r.key,
      ),
    ).toEqual(["web:b"]);
    expect(a.messages).toEqual([]);
  });
});
