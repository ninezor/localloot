-- StreetFinds schema — paste this whole file into the Supabase SQL editor and run it.

create table if not exists finds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  category text not null default 'other',
  emoji text,
  lat double precision not null,
  lng double precision not null,
  area text,
  status text not null default 'available' check (status in ('available', 'gone')),
  photo_url text,
  created_at timestamptz not null default now()
);

alter table finds enable row level security;

-- Anyone can browse finds
create policy "public read finds"
  on finds for select using (true);

-- Anyone can post a find (no accounts yet — see README for hardening notes)
create policy "public insert finds"
  on finds for insert with check (true);

-- Anyone can flip available/gone
create policy "public update finds"
  on finds for update using (true) with check (true);

-- Public bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public upload photos"
  on storage.objects for insert
  with check (bucket_id = 'photos');

create policy "public read photos"
  on storage.objects for select
  using (bucket_id = 'photos');
