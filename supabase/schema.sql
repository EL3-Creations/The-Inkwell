-- ============================================================
--  The Inkwell: database schema
--  Paste this whole file into Supabase -> SQL Editor -> Run.
--  Safe to run once on a brand-new project.
-- ============================================================


-- ---------- Settings (exactly one row) ----------
create table public.settings (
  id              int primary key default 1 check (id = 1),
  shop_name       text not null default 'The Inkwell',
  standard_price  numeric(10,2) not null default 25.00,
  premium_price   numeric(10,2) not null default 40.00,
  week_starts_on  int not null default 0 check (week_starts_on between 0 and 6), -- 0 = Sunday
  updated_at      timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------- Designs (one row per pegboard number) ----------
create table public.designs (
  id              uuid primary key default gen_random_uuid(),
  number          int not null check (number > 0),
  name            text not null default '',
  type            text not null check (type in ('pen','keychain')),
  tier            text not null check (tier in ('standard','premium')),
  price_override  numeric(10,2) check (price_override is null or price_override >= 0),
  quantity        int not null default 1 check (quantity >= 0),
  shop_safe       boolean not null default true,
  notes           text not null default '',
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- A number must be unique among active (non-archived) designs.
create unique index designs_active_number_idx on public.designs (number) where archived = false;
create index designs_archived_idx on public.designs (archived);

-- ---------- Photos ----------
create table public.design_photos (
  id            uuid primary key default gen_random_uuid(),
  design_id     uuid not null references public.designs(id) on delete cascade,
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index design_photos_design_idx on public.design_photos (design_id);

-- ---------- Live sessions ----------
create table public.live_sessions (
  id          uuid primary key default gen_random_uuid(),
  label       text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- ---------- Sales ----------
create table public.sales (
  id               uuid primary key default gen_random_uuid(),
  design_id        uuid not null references public.designs(id) on delete restrict,
  quantity         int not null default 1 check (quantity > 0),
  buyer_handle     text not null default '',
  channel          text not null check (channel in ('shop','live','market','other')),
  unit_price       numeric(10,2) not null check (unit_price >= 0),
  status           text not null check (status in ('claimed','paid','shipped','cancelled')),
  claimed_at       timestamptz not null default now(),
  paid_at          timestamptz,
  shipped_at       timestamptz,
  cancelled_at     timestamptz,
  live_session_id  uuid references public.live_sessions(id) on delete set null,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index sales_design_idx on public.sales (design_id);
create index sales_status_idx on public.sales (status);
create index sales_session_idx on public.sales (live_session_id);
create index sales_claimed_idx on public.sales (claimed_at desc);

-- ---------- updated_at bookkeeping ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
create trigger designs_touch before update on public.designs
  for each row execute function public.touch_updated_at();
create trigger sales_touch before update on public.sales
  for each row execute function public.touch_updated_at();

-- ============================================================
--  Stock-safe operations.
--  These run inside one transaction so two phones cannot
--  oversell the same piece.
-- ============================================================

-- Record a sale and lower stock in one step.
-- p_status is normally 'claimed' (Live) or 'paid' (TikTok Shop / market).
create or replace function public.claim_design(
  p_design_id       uuid,
  p_quantity        int,
  p_buyer_handle    text,
  p_channel         text,
  p_unit_price      numeric,
  p_live_session_id uuid default null,
  p_status          text default 'claimed',
  p_notes           text default '',
  p_claimed_at      timestamptz default now()
) returns public.sales
language plpgsql security invoker as $$
declare
  v_qty  int;
  v_sale public.sales;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;
  if p_status not in ('claimed','paid','shipped') then
    raise exception 'Invalid status %', p_status;
  end if;

  -- Lock the design row so concurrent claims line up.
  select quantity into v_qty from public.designs
   where id = p_design_id and archived = false
   for update;

  if v_qty is null then
    raise exception 'Design not found';
  end if;
  if v_qty < p_quantity then
    raise exception 'Only % left in stock', v_qty;
  end if;

  update public.designs set quantity = quantity - p_quantity where id = p_design_id;

  insert into public.sales (
    design_id, quantity, buyer_handle, channel, unit_price, status,
    claimed_at, paid_at, shipped_at, live_session_id, notes
  ) values (
    p_design_id, p_quantity, coalesce(p_buyer_handle,''), p_channel, p_unit_price, p_status,
    p_claimed_at,
    case when p_status in ('paid','shipped') then p_claimed_at end,
    case when p_status = 'shipped' then p_claimed_at end,
    p_live_session_id, coalesce(p_notes,'')
  ) returning * into v_sale;

  return v_sale;
end $$;

-- Cancel a sale and put the pieces back in stock.
create or replace function public.cancel_sale(p_sale_id uuid)
returns public.sales
language plpgsql security invoker as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;
  if v_sale.status = 'cancelled' then
    return v_sale;  -- already cancelled, nothing to do
  end if;

  update public.designs set quantity = quantity + v_sale.quantity where id = v_sale.design_id;

  update public.sales
     set status = 'cancelled', cancelled_at = now()
   where id = p_sale_id
   returning * into v_sale;

  return v_sale;
end $$;

-- Change a sale's quantity safely (adjusts stock by the difference).
create or replace function public.set_sale_quantity(p_sale_id uuid, p_quantity int)
returns public.sales
language plpgsql security invoker as $$
declare
  v_sale public.sales;
  v_diff int;
  v_qty  int;
begin
  if p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then raise exception 'Sale not found'; end if;
  if v_sale.status = 'cancelled' then raise exception 'Sale is cancelled'; end if;

  v_diff := p_quantity - v_sale.quantity;
  if v_diff = 0 then return v_sale; end if;

  select quantity into v_qty from public.designs where id = v_sale.design_id for update;
  if v_qty - v_diff < 0 then
    raise exception 'Only % left in stock', v_qty;
  end if;
  update public.designs set quantity = quantity - v_diff where id = v_sale.design_id;
  update public.sales set quantity = p_quantity where id = p_sale_id returning * into v_sale;
  return v_sale;
end $$;

-- ============================================================
--  Security: only signed-in users can see or change anything.
--  Public sign-ups are disabled in the Supabase dashboard, so
--  "signed-in" means you or your wife.
-- ============================================================
alter table public.settings       enable row level security;
alter table public.designs        enable row level security;
alter table public.design_photos  enable row level security;
alter table public.live_sessions  enable row level security;
alter table public.sales          enable row level security;

create policy "owners all" on public.settings      for all to authenticated using (true) with check (true);
create policy "owners all" on public.designs       for all to authenticated using (true) with check (true);
create policy "owners all" on public.design_photos for all to authenticated using (true) with check (true);
create policy "owners all" on public.live_sessions for all to authenticated using (true) with check (true);
create policy "owners all" on public.sales         for all to authenticated using (true) with check (true);

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ============================================================
--  Photo storage bucket.
--  Files are readable by URL (the URLs are random and unguessable)
--  but only signed-in users can upload, replace or delete.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "photos read"   on storage.objects for select using (bucket_id = 'photos');
create policy "photos insert" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "photos update" on storage.objects for update to authenticated using (bucket_id = 'photos');
create policy "photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos');

-- ============================================================
--  Realtime: both phones see changes instantly.
-- ============================================================
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.designs;
alter publication supabase_realtime add table public.design_photos;
alter publication supabase_realtime add table public.live_sessions;
alter publication supabase_realtime add table public.sales;
