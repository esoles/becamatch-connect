CREATE TABLE public.scholarship_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('guardada','descartada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scholarship_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarship_decisions TO authenticated;
GRANT ALL ON public.scholarship_decisions TO service_role;
ALTER TABLE public.scholarship_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decisions select" ON public.scholarship_decisions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own decisions insert" ON public.scholarship_decisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own decisions update" ON public.scholarship_decisions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own decisions delete" ON public.scholarship_decisions FOR DELETE TO authenticated USING (auth.uid() = user_id);