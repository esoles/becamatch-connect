CREATE TABLE public.postulation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  request_text text NOT NULL,
  ai_analysis jsonb,
  recommended_scholarship_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'recibida',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.postulation_requests TO authenticated;
GRANT ALL ON public.postulation_requests TO service_role;
ALTER TABLE public.postulation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read postulation requests" ON public.postulation_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));