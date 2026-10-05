-- Core features: therapist role, group invite codes, per-group sessions with
-- uploaded materials, mood checks, combined drawing+text diary records and a
-- shared group exhibition.
-- Run in the Supabase SQL editor, or via `supabase db push` once the CLI is linked.
-- After running, promote therapists by hand:
--   update public.profiles set role = 'therapist' where id = '<user uuid>';

-- ---------------------------------------------------------------------------
-- profiles.role - only changeable from the dashboard / service role
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'participant'
  check (role in ('participant', 'therapist'));

-- Users can insert/update their own profile row through the API, so pin the
-- role there; the SQL editor (postgres) and service role are unaffected.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.role := 'participant';
    else
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Group membership helpers. security definer so policies on groups and
-- group_members can use them without recursing into each other's RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_facilitator(gid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.groups where id = gid and facilitator_id = auth.uid()
  );
$$;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_group_facilitator(gid)
    or exists (
      select 1 from public.group_members
      where group_id = gid and user_id = auth.uid() and status = 'accepted'
    );
$$;

-- Storage paths start with the group id as text; compare as text so a
-- non-uuid folder name can never raise a cast error inside a policy.
create or replace function public.can_access_group_folder(folder text, need_facilitator boolean)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id::text = folder
      and (
        case when need_facilitator then public.is_group_facilitator(g.id)
        else public.is_group_member(g.id) end
      )
  );
$$;

-- True when the current user and `other` belong to a common group, so group
-- mates can see each other's nickname/avatar even with a private profile.
create or replace function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where public.is_group_member(g.id)
      and (
        g.facilitator_id = other
        or exists (
          select 1 from public.group_members m
          where m.group_id = g.id and m.user_id = other and m.status = 'accepted'
        )
      )
  );
$$;

drop policy if exists "profiles are readable by group mates" on public.profiles;
create policy "profiles are readable by group mates"
  on public.profiles for select
  using (public.shares_group_with(id));

-- ---------------------------------------------------------------------------
-- groups: invite codes + non-recursive policies
-- ---------------------------------------------------------------------------
alter table public.groups
  add column if not exists invite_code text unique
  default upper(substr(md5(gen_random_uuid()::text), 1, 6));

update public.groups
  set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 6))
  where invite_code is null;

alter table public.groups alter column invite_code set not null;

drop policy if exists "groups are readable by members" on public.groups;
drop policy if exists "groups are created/updated by facilitator" on public.groups;

create policy "groups are readable by members"
  on public.groups for select
  using (public.is_group_member(id));

create policy "groups are created by therapists"
  on public.groups for insert
  with check (
    facilitator_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'therapist')
  );

create policy "groups are updated by facilitator"
  on public.groups for update
  using (facilitator_id = auth.uid())
  with check (facilitator_id = auth.uid());

create policy "groups are deleted by facilitator"
  on public.groups for delete
  using (facilitator_id = auth.uid());

drop policy if exists "group members can view their own memberships" on public.group_members;
drop policy if exists "group members can manage their own status" on public.group_members;
drop policy if exists "facilitator can manage members" on public.group_members;

create policy "group members are visible to the group"
  on public.group_members for select
  using (user_id = auth.uid() or public.is_group_member(group_id));

create policy "members can leave, facilitator can remove"
  on public.group_members for delete
  using (user_id = auth.uid() or public.is_group_facilitator(group_id));

create policy "facilitator manages members"
  on public.group_members for update
  using (public.is_group_facilitator(group_id))
  with check (public.is_group_facilitator(group_id));

-- Joining only happens through the invite code.
create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id into gid from public.groups
  where invite_code = upper(trim(p_code)) and status = 'active';

  if gid is null then
    raise exception 'invalid_code';
  end if;

  insert into public.group_members (group_id, user_id, status, joined_at)
  values (gid, auth.uid(), 'accepted', now())
  on conflict (group_id, user_id)
  do update set status = 'accepted', joined_at = coalesce(group_members.joined_at, now());

  return gid;
end;
$$;

-- ---------------------------------------------------------------------------
-- program_sessions / session_materials
-- ---------------------------------------------------------------------------
create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  session_no smallint not null check (session_no > 0),
  title text not null,
  description text not null default '',
  scheduled_at timestamptz,
  zoom_url text,
  created_at timestamptz not null default now()
);

create index if not exists program_sessions_group_idx
  on public.program_sessions (group_id, session_no);

alter table public.program_sessions enable row level security;

create policy "sessions are readable by group members"
  on public.program_sessions for select
  using (public.is_group_member(group_id));

create policy "sessions are managed by facilitator"
  on public.program_sessions for all
  using (public.is_group_facilitator(group_id))
  with check (public.is_group_facilitator(group_id));

create table if not exists public.session_materials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.program_sessions (id) on delete cascade,
  kind text not null default 'etc'
    check (kind in ('mind_card', 'masterpiece', 'mandala', 'activity', 'etc')),
  title text not null,
  file_path text not null,
  mime_type text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists session_materials_session_idx
  on public.session_materials (session_id);

alter table public.session_materials enable row level security;

create policy "materials are readable by group members"
  on public.session_materials for select
  using (
    exists (
      select 1 from public.program_sessions s
      where s.id = session_id and public.is_group_member(s.group_id)
    )
  );

create policy "materials are managed by facilitator"
  on public.session_materials for all
  using (
    exists (
      select 1 from public.program_sessions s
      where s.id = session_id and public.is_group_facilitator(s.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.program_sessions s
      where s.id = session_id and public.is_group_facilitator(s.group_id)
    )
  );

-- Files live at `{group_id}/{session_id}/{uuid}.{ext}`.
insert into storage.buckets (id, name, public)
values ('program-materials', 'program-materials', false)
on conflict (id) do nothing;

drop policy if exists "program materials are readable by group members" on storage.objects;
create policy "program materials are readable by group members"
  on storage.objects for select
  using (
    bucket_id = 'program-materials'
    and public.can_access_group_folder((storage.foldername(name))[1], false)
  );

drop policy if exists "program materials are uploaded by facilitator" on storage.objects;
create policy "program materials are uploaded by facilitator"
  on storage.objects for insert
  with check (
    bucket_id = 'program-materials'
    and public.can_access_group_folder((storage.foldername(name))[1], true)
  );

drop policy if exists "program materials are deleted by facilitator" on storage.objects;
create policy "program materials are deleted by facilitator"
  on storage.objects for delete
  using (
    bucket_id = 'program-materials'
    and public.can_access_group_folder((storage.foldername(name))[1], true)
  );

-- ---------------------------------------------------------------------------
-- mood_checks
-- ---------------------------------------------------------------------------
create table if not exists public.mood_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  answers smallint[] not null,
  score numeric(4, 1) not null check (score between 1 and 10),
  recommended text not null default '',
  created_at timestamptz not null default now()
);

alter table public.mood_checks enable row level security;

create policy "mood checks are managed by owner"
  on public.mood_checks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- diary_entries: one record = image + text, optionally hung in a group show
-- ---------------------------------------------------------------------------
alter table public.diary_entries
  add column if not exists image_path text,
  add column if not exists body text not null default '',
  add column if not exists image_source text check (image_source in ('drawn', 'uploaded')),
  add column if not exists exhibit_group_id uuid references public.groups (id) on delete set null;

alter table public.diary_entries drop constraint if exists diary_entries_entry_type_check;
alter table public.diary_entries
  add constraint diary_entries_entry_type_check
  check (entry_type in ('text', 'drawing', 'voice', 'record'));

create index if not exists diary_entries_exhibit_idx
  on public.diary_entries (exhibit_group_id, created_at desc)
  where exhibit_group_id is not null;

drop policy if exists "exhibited entries are readable by group members" on public.diary_entries;
create policy "exhibited entries are readable by group members"
  on public.diary_entries for select
  using (exhibit_group_id is not null and public.is_group_member(exhibit_group_id));

-- An entry can only be hung in a group the author belongs to.
drop policy if exists "entries exhibit only to own groups (insert)" on public.diary_entries;
create policy "entries exhibit only to own groups (insert)"
  on public.diary_entries as restrictive for insert
  with check (exhibit_group_id is null or public.is_group_member(exhibit_group_id));

drop policy if exists "entries exhibit only to own groups (update)" on public.diary_entries;
create policy "entries exhibit only to own groups (update)"
  on public.diary_entries as restrictive for update
  with check (exhibit_group_id is null or public.is_group_member(exhibit_group_id));

-- Group mates may read (sign URLs for) images of exhibited entries.
drop policy if exists "exhibited drawings are readable by group members" on storage.objects;
create policy "exhibited drawings are readable by group members"
  on storage.objects for select
  using (
    bucket_id = 'diary-drawings'
    and exists (
      select 1 from public.diary_entries e
      where e.image_path = objects.name
        and e.exhibit_group_id is not null
        and public.is_group_member(e.exhibit_group_id)
    )
  );
