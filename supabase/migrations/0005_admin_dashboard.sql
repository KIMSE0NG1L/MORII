-- Admin role + a way for admins to read every member's profile and diary
-- entries (today only the owner, or group mates of an exhibited entry, can
-- read diary_entries - see 0001/0004). Promote an account by hand:
--   update public.profiles set role = 'admin' where id = '<user uuid>';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('participant', 'therapist', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles are readable by admin" on public.profiles;
create policy "profiles are readable by admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "diary entries are readable by admin" on public.diary_entries;
create policy "diary entries are readable by admin"
  on public.diary_entries for select
  using (public.is_admin());

-- Admin needs signed URLs for any member's drawing, not just their own.
drop policy if exists "diary drawings are readable by admin" on storage.objects;
create policy "diary drawings are readable by admin"
  on storage.objects for select
  using (bucket_id = 'diary-drawings' and public.is_admin());
