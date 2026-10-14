-- TATTOO PRICE · Барахолка · полностью бесплатно
create table if not exists public.tp_market_listings (
  id uuid primary key default gen_random_uuid(),
  public_no bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','published','sold','hidden','rejected')),
  title text not null,
  category text not null check (category in ('machine','power','furniture','printer','equipment','accessories','books','other')),
  item_condition text not null check (item_condition in ('new','used')),
  price integer not null check (price >= 0),
  city text not null,
  delivery_mode text not null default 'both' check (delivery_mode in ('pickup','shipping','both')),
  description text,
  completeness text,
  photos jsonb not null default '[]'::jsonb,
  contact_name text,
  contact_phone text,
  contact_telegram text,
  contact_vk text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tp_market_listings enable row level security;

drop policy if exists market_public_read on public.tp_market_listings;
create policy market_public_read on public.tp_market_listings
for select to anon, authenticated using (status='published' or user_id=auth.uid());

drop policy if exists market_owner_insert on public.tp_market_listings;
create policy market_owner_insert on public.tp_market_listings
for insert to authenticated with check (user_id=auth.uid() and status='pending');

grant select, insert on public.tp_market_listings to anon, authenticated;
grant usage, select on sequence public.tp_market_listings_public_no_seq to authenticated;

create or replace function public.tp_get_market_feed(
  p_city text default null,
  p_category text default null,
  p_condition text default null,
  p_max_price integer default null
) returns setof public.tp_market_listings
language sql security definer set search_path=public,pg_temp
as $$
  select *
  from public.tp_market_listings
  where status='published'
    and (p_city is null or p_city='' or city ilike '%'||p_city||'%')
    and (p_category is null or p_category='' or category=p_category)
    and (p_condition is null or p_condition='' or item_condition=p_condition)
    and (p_max_price is null or price<=p_max_price)
  order by created_at desc;
$$;

create or replace function public.tp_get_market_listing(p_public_no bigint)
returns setof public.tp_market_listings
language sql security definer set search_path=public,pg_temp
as $$
  select * from public.tp_market_listings
  where public_no=p_public_no and status='published'
  limit 1;
$$;

create or replace function public.tp_get_my_market_listings()
returns setof public.tp_market_listings
language sql security definer set search_path=public,pg_temp
as $$
  select * from public.tp_market_listings
  where user_id=auth.uid()
  order by created_at desc;
$$;

create or replace function public.tp_market_set_photos(p_public_no bigint,p_photos jsonb)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  update public.tp_market_listings
  set photos=coalesce(p_photos,'[]'::jsonb),updated_at=now()
  where public_no=p_public_no and user_id=auth.uid();
  if not found then raise exception 'Объявление не найдено'; end if;
end $$;

create or replace function public.tp_update_my_market_listing(
  p_public_no bigint,
  p_title text,
  p_category text,
  p_condition text,
  p_price integer,
  p_city text,
  p_delivery_mode text,
  p_description text,
  p_completeness text,
  p_contact_name text,
  p_contact_phone text,
  p_contact_telegram text,
  p_contact_vk text,
  p_photos jsonb
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  update public.tp_market_listings set
    title=trim(p_title),
    category=p_category,
    item_condition=p_condition,
    price=greatest(coalesce(p_price,0),0),
    city=trim(p_city),
    delivery_mode=p_delivery_mode,
    description=nullif(trim(coalesce(p_description,'')),''),
    completeness=nullif(trim(coalesce(p_completeness,'')),''),
    contact_name=nullif(trim(coalesce(p_contact_name,'')),''),
    contact_phone=nullif(trim(coalesce(p_contact_phone,'')),''),
    contact_telegram=nullif(trim(coalesce(p_contact_telegram,'')),''),
    contact_vk=nullif(trim(coalesce(p_contact_vk,'')),''),
    photos=coalesce(p_photos,'[]'::jsonb),
    status='pending',
    updated_at=now()
  where public_no=p_public_no and user_id=auth.uid();
  if not found then raise exception 'Объявление не найдено'; end if;
end $$;

create or replace function public.tp_market_mark_sold(p_public_no bigint,p_sold boolean default true)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  update public.tp_market_listings
  set status=case when p_sold then 'sold' else 'pending' end,updated_at=now()
  where public_no=p_public_no and user_id=auth.uid();
  if not found then raise exception 'Объявление не найдено'; end if;
end $$;

create or replace function public.tp_delete_my_market_listing(p_public_no bigint)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  delete from public.tp_market_listings where public_no=p_public_no and user_id=auth.uid();
  if not found then raise exception 'Объявление не найдено'; end if;
end $$;

create or replace function public.tp_market_admin_list(p_status text default null)
returns setof public.tp_market_listings
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.tp_admins where user_id=auth.uid()) then
    raise exception 'Недостаточно прав';
  end if;
  return query select * from public.tp_market_listings
    where p_status is null or p_status='' or status=p_status
    order by created_at desc;
end $$;

create or replace function public.tp_market_admin_set_status(p_id uuid,p_status text)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.tp_admins where user_id=auth.uid()) then raise exception 'Недостаточно прав'; end if;
  if p_status not in ('pending','published','sold','hidden','rejected') then raise exception 'Неверный статус'; end if;
  update public.tp_market_listings set status=p_status,updated_at=now() where id=p_id;
end $$;

create or replace function public.tp_market_admin_delete(p_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.tp_admins where user_id=auth.uid()) then raise exception 'Недостаточно прав'; end if;
  delete from public.tp_market_listings where id=p_id;
end $$;

grant execute on function public.tp_get_market_feed(text,text,text,integer) to anon,authenticated;
grant execute on function public.tp_get_market_listing(bigint) to anon,authenticated;
grant execute on function public.tp_get_my_market_listings() to authenticated;
grant execute on function public.tp_market_set_photos(bigint,jsonb) to authenticated;
grant execute on function public.tp_update_my_market_listing(bigint,text,text,text,integer,text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.tp_market_mark_sold(bigint,boolean) to authenticated;
grant execute on function public.tp_delete_my_market_listing(bigint) to authenticated;
grant execute on function public.tp_market_admin_list(text) to authenticated;
grant execute on function public.tp_market_admin_set_status(uuid,text) to authenticated;
grant execute on function public.tp_market_admin_delete(uuid) to authenticated;

-- Используем существующий публичный бакет listing-photos.
drop policy if exists market_storage_insert on storage.objects;
create policy market_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='listing-photos'
  and (storage.foldername(name))[1]='market'
  and (storage.foldername(name))[2]=auth.uid()::text
);

drop policy if exists market_storage_update on storage.objects;
create policy market_storage_update on storage.objects
for update to authenticated
using (
  bucket_id='listing-photos'
  and (storage.foldername(name))[1]='market'
  and (storage.foldername(name))[2]=auth.uid()::text
)
with check (
  bucket_id='listing-photos'
  and (storage.foldername(name))[1]='market'
  and (storage.foldername(name))[2]=auth.uid()::text
);

drop policy if exists market_storage_delete on storage.objects;
create policy market_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id='listing-photos'
  and (storage.foldername(name))[1]='market'
  and (storage.foldername(name))[2]=auth.uid()::text
);
