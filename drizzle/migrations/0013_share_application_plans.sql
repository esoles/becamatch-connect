ALTER TABLE public.web_agent_plans ADD COLUMN request_id uuid REFERENCES public.postulation_requests(id), ADD COLUMN whatsapp_message_id uuid REFERENCES public.whatsapp_messages(id), ADD COLUMN user_id uuid, ADD COLUMN plan_number text UNIQUE, ADD COLUMN share_id uuid NOT NULL DEFAULT gen_random_uuid(), ADD COLUMN shared_content jsonb, ADD COLUMN delivery_status text NOT NULL DEFAULT 'no_solicitado';
ALTER TABLE public.web_agent_plans ALTER COLUMN conversation_id DROP NOT NULL;
CREATE UNIQUE INDEX web_agent_plan_share_unique ON public.web_agent_plans(share_id);
CREATE TABLE public.plan_year_counters (year integer PRIMARY KEY, last_number bigint NOT NULL DEFAULT 0);
GRANT ALL ON public.plan_year_counters TO service_role;
ALTER TABLE public.plan_year_counters ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.assign_plan_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE y integer; n bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.plan_number IS DISTINCT FROM OLD.plan_number OR NEW.share_id IS DISTINCT FROM OLD.share_id OR NEW.shared_content IS DISTINCT FROM OLD.shared_content OR NEW.plan IS DISTINCT FROM OLD.plan THEN RAISE EXCEPTION 'Plan content and identifiers are immutable'; END IF;
  RETURN NEW;
 END IF;
 y:=extract(year FROM NEW.created_at AT TIME ZONE 'UTC');
 INSERT INTO public.plan_year_counters(year,last_number) VALUES(y,1) ON CONFLICT(year) DO UPDATE SET last_number=public.plan_year_counters.last_number+1 RETURNING last_number INTO n;
 NEW.plan_number:='BM-'||y::text||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
 RETURN NEW;
END; $$;
CREATE TRIGGER assign_application_plan_number BEFORE INSERT OR UPDATE ON public.web_agent_plans FOR EACH ROW EXECUTE FUNCTION public.assign_plan_number();
COMMENT ON COLUMN public.web_agent_plans.shared_content IS 'Allowlisted scholarship facts only, no private applicant profile or transcript. Share UUID is an unpredictable capability.';