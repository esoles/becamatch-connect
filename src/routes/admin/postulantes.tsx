import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listApplicantFollowup } from "@/lib/applicant-followup.functions";
import { ApplicantFollowupView } from "@/components/applicant-followup";
const followupQuery = queryOptions({queryKey:["admin","applicant-followup"],queryFn:()=>listApplicantFollowup(),refetchInterval:60000});

export const Route = createFileRoute("/admin/postulantes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(followupQuery),
  head: () => ({
    meta: [
      { title: "Postulantes — BecaMatch" },
      { name: "description", content: "Seguimiento de postulantes registrados en BecaMatch." },
      { property: "og:title", content: "Postulantes — BecaMatch" },
      { property: "og:description", content: "Seguimiento de postulantes registrados en BecaMatch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostulantesPage,
});

function PostulantesPage() { const {data}=useSuspenseQuery(followupQuery); return <ApplicantFollowupView people={data.people} admins={data.admins}/>; }
