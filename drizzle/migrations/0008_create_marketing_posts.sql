CREATE TABLE public.marketing_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id),
  channel text NOT NULL DEFAULT 'generico',
  campaign text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm_url text NOT NULL,
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','aprobada','publicada')),
  published_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_posts TO authenticated;
GRANT ALL ON public.marketing_posts TO service_role;
ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read marketing posts" ON public.marketing_posts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins insert marketing posts" ON public.marketing_posts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins update marketing posts" ON public.marketing_posts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));