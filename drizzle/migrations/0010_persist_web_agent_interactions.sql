ALTER TABLE public.postulation_requests ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.postulation_requests ADD COLUMN IF NOT EXISTS attention_status text NOT NULL DEFAULT 'recibida';
ALTER TABLE public.postulation_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.web_agent_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resume_token_hash text NOT NULL,
 user_id uuid, status text NOT NULL DEFAULT 'recibida', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.web_agent_conversations TO authenticated;
GRANT ALL ON public.web_agent_conversations TO service_role;
ALTER TABLE public.web_agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read web conversations" ON public.web_agent_conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update web conversations" ON public.web_agent_conversations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.web_agent_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.web_agent_conversations(id) ON DELETE CASCADE,
 sdk_message_id text NOT NULL, message jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(conversation_id,sdk_message_id)
);
GRANT SELECT ON public.web_agent_messages TO authenticated;
GRANT ALL ON public.web_agent_messages TO service_role;
ALTER TABLE public.web_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read web messages" ON public.web_agent_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.web_agent_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.web_agent_conversations(id) ON DELETE CASCADE,
 plan jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.web_agent_plans TO authenticated;
GRANT ALL ON public.web_agent_plans TO service_role;
ALTER TABLE public.web_agent_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read web plans" ON public.web_agent_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX web_messages_order ON public.web_agent_messages(conversation_id,created_at);
GRANT UPDATE ON public.postulation_requests TO authenticated;
CREATE POLICY "admins update requests" ON public.postulation_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));