<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Compatibility scoring lives in pure functions in src/lib/compatibility.ts (tested); never compute it with AI or in the database — SPEC requires reproducibility.
- Structured scholarship facts and provenance are normalized in src/lib/scholarship-orientation.ts and shared by detail, web assistant and WhatsApp; this keeps verification labels consistent without changing compatibility inputs.
- The postulation agent uses AI SDK UI-message streaming and AI Elements with server-persisted append-only messages; anonymous resume credentials are hashed server-side, and optional authenticated identities are verified server-side. Confirmed plans use pure compatibility rules from a server-reloaded public catalog, separately from the legacy form. The central admin inbox relates records only by verified user IDs and never merges channel histories.
- Parental status is set by a DB trigger from birth_date so users cannot self-approve.
- Signed-in pages live under src/routes/_authenticated/ and read data via the browser client with RLS.
- Admin panel lives under src/routes/admin/ (own ssr:false guard checking has_role admin); new signups get 'student' via auth.users trigger and admins are only created by an admin server function — public signup can never grant admin.
- The admin shell owns sidebar navigation and excludes the public header; scholarship creation/editing/verification use role-checked server functions, while verification and overview labels share pure provenance rules so fictional demos never count as verified opportunities.
- Manual verification switches reuse the existing role-checked function and pure transition helper: real verification requires source confirmation, while demo toggles change only the existing verified flag for testing, retain provenance and dates, and remain excluded from real plans and metrics.
- Unified applicant follow-up reuses the shared server inbox reader and pure grouping/priority/response rules; additive admin-only follow-up, manual-call and reviewed-identity records preserve source histories, with trigger-based append-only audit. This avoids duplicated transcripts and non-reproducible priority scoring.
- Administrative submission stages reuse the existing followup stage field and deterministic progress factor; explicitly labeled fictional examples use existing request records without creating accounts or claiming real submissions.
- All application channels persist plans in web_agent_plans with optional source relationships; database-triggered annual counters assign immutable display numbers and transactional follow-up stages. An unpredictable share UUID grants access only to a schema-allowlisted private-free snapshot, so sequential numbers never authorize reads. Shared-plan helpers reuse deterministic compatibility and source provenance instead of a second answer system.
- Administrative metrics reuse the inbox identity grouping and priority rules, aggregate on the server after verifying the admin role, and return only anonymous totals; first audited submission transitions count processes rather than fabricated per-scholarship applications.
- Metrics test mode reuses persisted labeled requests and follow-ups with the same aggregation, but partitions identities from real mode before grouping; test records never simulate connected external channels.
