-- ============================================================
--  Launch fixes, 17 Oct 2026.
--  If your database was created BEFORE this date, paste this whole
--  file into Supabase -> SQL Editor -> Run (once). schema.sql already
--  includes all of it for brand-new projects.
-- ============================================================

-- 1. A cancelled sale can never be flipped back to claimed / paid / shipped.
--    (Its stock was already returned; a stale phone must not undo that.)
create or replace function public.sales_guard_cancelled() returns trigger
language plpgsql as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'This sale was already cancelled and its stock returned. Record a new sale instead.';
  end if;
  return new;
end $$;
drop trigger if exists sales_guard_cancelled on public.sales;
create trigger sales_guard_cancelled before update on public.sales
  for each row execute function public.sales_guard_cancelled();

-- 2. Only one Live can be open at a time, even if both phones tap Start together.
create unique index if not exists live_sessions_one_open_idx
  on public.live_sessions ((true)) where ended_at is null;

-- 3. Only signed-in users can list the photo bucket. Photo links keep working
--    because the bucket is public for direct downloads.
drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated using (bucket_id = 'photos');
