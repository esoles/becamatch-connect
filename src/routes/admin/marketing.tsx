import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateMarketingPost,
  saveMarketingPost,
  updateMarketingPost,
  listMarketingPosts,
  type MarketingContent,
} from "@/lib/marketing.functions";
import { fmtDate } from "@/lib/profile";

const scholarshipsQuery = queryOptions({
  queryKey: ["admin", "verified-scholarships"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("scholarships")
      .select("id, name, entity, deadline")
      .eq("verified", true)
      .eq("archived", false)
      .order("deadline", { ascending: true });
    if (error) throw error;
    return data;
  },
});

const postsQuery = queryOptions({
  queryKey: ["admin", "marketing-posts"],
  queryFn: async () => {
    const res = await listMarketingPosts();
    if (!res.ok) throw new Error(res.error);
    return res.posts;
  },
});

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  aprobada: "Aprobada",
  publicada: "Publicada",
};

export const Route = createFileRoute("/admin/marketing")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(scholarshipsQuery),
      context.queryClient.ensureQueryData(postsQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Marketing — BecaMatch" },
      { name: "description", content: "Generación y seguimiento de publicaciones de becas." },
      { property: "og:title", content: "Marketing — BecaMatch" },
      { property: "og:description", content: "Generación y seguimiento de publicaciones de becas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingPage,
});

interface Draft {
  scholarshipId: string;
  channel: string;
  content: MarketingContent;
  utmUrl: string;
  scholarshipName: string;
}

function MarketingPage() {
  const { data: scholarships } = useSuspenseQuery(scholarshipsQuery);
  const { data: posts } = useSuspenseQuery(postsQuery);
  const qc = useQueryClient();

  const [scholarshipId, setScholarshipId] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "marketing-posts"] });

  const generate = async () => {
    if (!scholarshipId) return;
    setBusy(true); setMsg(null);
    const res = await generateMarketingPost({ data: { scholarshipId, channel } });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setDraft({ scholarshipId, channel, content: res.content, utmUrl: res.utmUrl, scholarshipName: res.scholarshipName });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true); setMsg(null);
    const res = await saveMarketingPost({
      data: {
        scholarshipId: draft.scholarshipId,
        channel: draft.channel,
        campaign: draft.content.campana,
        content: draft.content,
        utmUrl: draft.utmUrl,
      },
    });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    setDraft(null);
    setMsg("Publicación guardada como borrador.");
    refresh();
  };

  const setStatus = async (id: string, status: "aprobada" | "publicada") => {
    const res = await updateMarketingPost({ data: { id, status } });
    if (!res.ok) setMsg(res.error);
    refresh();
  };

  const saveEdit = async (id: string) => {
    const res = await updateMarketingPost({ data: { id, texto: editText } });
    if (!res.ok) setMsg(res.error);
    setEditingId(null);
    refresh();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setMsg("Contenido copiado al portapapeles.");
  };

  const campaigns = [...new Set(posts.map((p) => p.campaign))];

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-semibold">Marketing</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Genera publicaciones con IA a partir de becas verificadas. No hay integración de publicación automática
        configurada: copia el contenido y publícalo manualmente en la red social, luego márcalo como publicado.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border p-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Beca verificada</span>
          <select
            value={scholarshipId}
            onChange={(e) => setScholarshipId(e.target.value)}
            className="w-72 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecciona una beca…</option>
            {scholarships.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.entity}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Canal</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="correo">Correo</option>
          </select>
        </label>
        <button
          onClick={generate}
          disabled={busy || !scholarshipId}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Generando…" : "Generar publicación con IA"}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}

      {draft && (
        <div className="mt-4 rounded-2xl border border-accent/40 p-4">
          <h3 className="font-display font-semibold">Vista previa — {draft.scholarshipName}</h3>
          <textarea
            value={draft.content.texto}
            onChange={(e) => setDraft({ ...draft, content: { ...draft.content, texto: e.target.value } })}
            rows={5}
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Beneficios confirmados</dt><dd className="text-muted-foreground">{draft.content.beneficios.length ? draft.content.beneficios.join("; ") : "No especificados en la fuente"}</dd></div>
            <div><dt className="font-medium">Requisitos destacados</dt><dd className="text-muted-foreground">{draft.content.requisitos.length ? draft.content.requisitos.join("; ") : "No especificados en la fuente"}</dd></div>
            <div><dt className="font-medium">Fecha límite</dt><dd className="text-muted-foreground">{draft.content.deadline}</dd></div>
            <div><dt className="font-medium">Llamada a la acción</dt><dd className="text-muted-foreground">{draft.content.cta}</dd></div>
            <div><dt className="font-medium">Hashtags</dt><dd className="text-muted-foreground">{draft.content.hashtags.join(" ")}</dd></div>
            <div><dt className="font-medium">Campaña</dt><dd className="text-muted-foreground">{draft.content.campana}</dd></div>
          </dl>
          <p className="mt-3 break-all rounded-xl bg-secondary px-3 py-2 text-xs">{draft.utmUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={save} disabled={busy} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">Guardar borrador</button>
            <button onClick={generate} disabled={busy} className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">Regenerar</button>
            <button onClick={() => setDraft(null)} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground">Descartar</button>
          </div>
        </div>
      )}

      <h3 className="mt-8 font-display font-semibold">Publicaciones registradas</h3>
      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aún no hay publicaciones.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {posts.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{p.scholarshipName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.channel} · {p.campaign}</span>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{STATUS_LABEL[p.status] ?? p.status}</span>
              </div>
              {editingId === p.id ? (
                <div className="mt-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => saveEdit(p.id)} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">Guardar cambios</button>
                    <button onClick={() => setEditingId(null)} className="rounded-xl border border-border px-3 py-1.5 text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{p.content.texto}</p>
              )}
              <p className="mt-2 break-all text-xs text-muted-foreground">{p.utmUrl}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Creada: {fmtDate(p.createdAt.slice(0, 10))}
                {p.publishedAt ? ` · Publicada: ${fmtDate(p.publishedAt.slice(0, 10))}` : ""}
                {` · Veces que esta beca fue guardada: ${p.guardadas}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => copy(`${p.content.texto}\n\n${p.content.hashtags.join(" ")}\n${p.utmUrl}`)} className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium">Copiar contenido</button>
                {p.status === "borrador" && (
                  <>
                    <button onClick={() => { setEditingId(p.id); setEditText(p.content.texto); }} className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium">Editar</button>
                    <button onClick={() => setStatus(p.id, "aprobada")} className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium">Aprobar</button>
                  </>
                )}
                {p.status === "aprobada" && (
                  <button onClick={() => setStatus(p.id, "publicada")} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">Marcar como publicada</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <h3 className="mt-8 font-display font-semibold">Métricas por campaña</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Solo se muestran datos medibles: publicaciones registradas y veces que la beca promovida fue guardada.
        Los registros atribuidos por UTM no son medibles todavía (no hay seguimiento de UTM en el registro).
      </p>
      {campaigns.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin campañas todavía.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Campaña</th>
                <th className="px-4 py-2 font-medium">Publicaciones</th>
                <th className="px-4 py-2 font-medium">Publicadas</th>
                <th className="px-4 py-2 font-medium">Becas guardadas</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const list = posts.filter((p) => p.campaign === c);
                return (
                  <tr key={c} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{c}</td>
                    <td className="px-4 py-2">{list.length}</td>
                    <td className="px-4 py-2">{list.filter((p) => p.status === "publicada").length}</td>
                    <td className="px-4 py-2">{list.reduce((n, p) => n + p.guardadas, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
