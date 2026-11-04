-- ============================================================
-- Přílohy k procesům — úložiště souborů (Supabase Storage)
-- Spusťte v Supabase → SQL Editor → New query → Run (jednou).
-- Skript nic nemaže; lze jej spustit opakovaně.
-- ============================================================

-- 1) Soukromý bucket. Velikost jednoho souboru: 50 MB (52428800 B).
--    Číslo nemůže být větší než globální limit projektu
--    (Settings → Storage → "Upload file size limit"; zdarma 50 MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('pm-attachments', 'pm-attachments', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

-- 2) Přístup: soubory čtou i nahrávají jen PŘIHLÁŠENÍ uživatelé.
drop policy if exists pm_att_read   on storage.objects;
drop policy if exists pm_att_insert on storage.objects;
drop policy if exists pm_att_update on storage.objects;
drop policy if exists pm_att_delete on storage.objects;

create policy pm_att_read on storage.objects
  for select to authenticated using (bucket_id = 'pm-attachments');
create policy pm_att_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'pm-attachments');
create policy pm_att_update on storage.objects
  for update to authenticated using (bucket_id = 'pm-attachments')
  with check (bucket_id = 'pm-attachments');
create policy pm_att_delete on storage.objects
  for delete to authenticated using (bucket_id = 'pm-attachments');

-- Varianta: aby soubory mohli otevírat i nepřihlášení (jen čtení),
-- nahraďte politiku pm_att_read tímto:
-- create policy pm_att_read on storage.objects
--   for select to anon, authenticated using (bucket_id = 'pm-attachments');
