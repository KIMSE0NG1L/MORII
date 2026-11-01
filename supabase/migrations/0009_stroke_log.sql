-- Optional stroke-level recording of how a drawing was made (vector events
-- for brush/shape/text/sticker + small bitmap snapshots for rarer ops, see
-- src/lib/strokeRenderer.ts). Nullable because recording is opt-in - most
-- entries never set this and keep saving exactly as before.
alter table public.diary_entries
  add column if not exists stroke_log_path text;
