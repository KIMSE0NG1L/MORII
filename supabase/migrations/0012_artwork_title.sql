-- Optional title for a diary record's artwork, shown in the exhibition hall.
alter table public.diary_entries
  add column if not exists title text;

alter table public.diary_entries
  add constraint diary_entries_title_length check (title is null or char_length(title) <= 60);
