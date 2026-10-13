alter table public.user_roles add constraint user_roles_user_role_key unique (user_id, role);
create or replace function public.assign_default_student_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end $$;
revoke execute on function public.assign_default_student_role() from public, anon, authenticated;
create trigger on_auth_user_created_student after insert on auth.users
for each row execute function public.assign_default_student_role();
insert into public.user_roles (user_id, role)
select u.id, 'student' from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id)
on conflict do nothing;