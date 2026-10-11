create table public.whatsapp_sessions (
  phone text primary key,
  user_id uuid,
  current_scholarship_id uuid references public.scholarships(id) on delete set null,
  pending_action text check (pending_action in ('guardar')),
  pending_scholarship_id uuid references public.scholarships(id) on delete set null,
  link_token text unique,
  link_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  direction text not null check (direction in ('entrante','saliente','sistema')),
  body text not null,
  scholarship_id uuid references public.scholarships(id) on delete set null,
  action text,
  result text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index whatsapp_messages_phone_idx on public.whatsapp_messages(phone, created_at);
alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_messages enable row level security;
grant select on public.whatsapp_sessions, public.whatsapp_messages to authenticated;
grant all on public.whatsapp_sessions, public.whatsapp_messages to service_role;
create policy "admins read wa sessions" on public.whatsapp_sessions for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins read wa messages" on public.whatsapp_messages for select to authenticated using (public.has_role(auth.uid(), 'admin'));