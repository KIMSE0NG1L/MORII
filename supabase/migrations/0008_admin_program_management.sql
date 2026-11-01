-- Admins get the same group/program management rights as a facilitator,
-- across every group (not just ones they personally created).
--
-- is_group_facilitator() is the single choke point nearly every group-
-- related policy (groups/group_members/program_sessions/session_materials/
-- group_notices/storage) is built on, including transitively through
-- is_group_member() (member = facilitator OR accepted member) - so adding
-- is_admin() there cascades admin read+manage access through all of them.
create or replace function public.is_group_facilitator(gid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    exists (select 1 from public.groups where id = gid and facilitator_id = auth.uid())
    or public.is_admin();
$$;

-- Groups can be created by any therapist OR an admin (who becomes the
-- facilitator of the group they create, same as a therapist would).
drop policy if exists "groups are created by therapists" on public.groups;
create policy "groups are created by therapists or admins"
  on public.groups for insert
  with check (
    facilitator_id = auth.uid()
    and (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'therapist')
      or public.is_admin()
    )
  );

-- update/delete check facilitator_id directly (not through
-- is_group_facilitator), so they need the admin bypass added explicitly too.
drop policy if exists "groups are updated by facilitator" on public.groups;
create policy "groups are updated by facilitator or admin"
  on public.groups for update
  using (facilitator_id = auth.uid() or public.is_admin())
  with check (facilitator_id = auth.uid() or public.is_admin());

drop policy if exists "groups are deleted by facilitator" on public.groups;
create policy "groups are deleted by facilitator or admin"
  on public.groups for delete
  using (facilitator_id = auth.uid() or public.is_admin());
