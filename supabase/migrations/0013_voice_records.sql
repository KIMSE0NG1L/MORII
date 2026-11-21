-- Voice-note diary entries: a recorded conversation (e.g. with a counselor)
-- plus its AI-generated transcript. The summary itself reuses `body`/`title`
-- (same columns as every other "record" entry) so the rest of the diary UI
-- (list, filters, exhibition rules) needs no new concept - only the raw
-- audio + full transcript are new.

alter table diary_entries
  add column if not exists audio_path text,
  add column if not exists transcript text;

-- Private bucket, same per-user-folder convention as diary-drawings.
insert into storage.buckets (id, name, public)
values ('diary-voice', 'diary-voice', false)
on conflict (id) do nothing;

drop policy if exists "diary voice notes are managed by owner" on storage.objects;
create policy "diary voice notes are managed by owner"
  on storage.objects for all
  using (bucket_id = 'diary-voice' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'diary-voice' and (storage.foldername(name))[1] = auth.uid()::text);
