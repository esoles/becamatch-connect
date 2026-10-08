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
- Parental status is set by a DB trigger from birth_date so users cannot self-approve.
- Signed-in pages live under src/routes/_authenticated/ and read data via the browser client with RLS.
