-- Storage bucket for the diary's drawing entries. Private bucket - each
-- user's files live under a `${user_id}/...` prefix and are only readable
-- via short-lived signed URLs generated server-side (see diary/page.tsx).

insert into storage.buckets (id, name, public)
values ('diary-drawings', 'diary-drawings', false)
on conflict (id) do nothing;

drop policy if exists "diary drawings are managed by owner" on storage.objects;
create policy "diary drawings are managed by owner"
  on storage.objects for all
  using (bucket_id = 'diary-drawings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'diary-drawings' and (storage.foldername(name))[1] = auth.uid()::text);
