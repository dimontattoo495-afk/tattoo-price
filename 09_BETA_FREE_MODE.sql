-- TATTOO PRICE — BETA 50 FREE PLACEMENTS / 15 DAYS — V4
-- First 50 NEW placements are free for 15 days.
-- After the quota is exhausted, new listings automatically use the normal paid flow.
-- This is a limit of PLACEMENTS, not verified unique masters.

begin;

alter table public.tp_listings
  add column if not exists is_beta_free boolean not null default false;

create table if not exists public.tp_site_settings (
  id integer primary key check (id = 1),
  beta_free_enabled boolean not null default true,
  beta_free_days integer not null default 15,
  beta_free_limit integer not null default 50,
  beta_free_used integer not null default 0,
  beta_message text not null default 'Первые 50 размещений бесплатно на 15 дней.',
  updated_at timestamptz not null default now()
);

alter table public.tp_site_settings
  add column if not exists beta_free_limit integer not null default 50;

alter table public.tp_site_settings
  add column if not exists beta_free_used integer not null default 0;

insert into public.tp_site_settings (
  id,
  beta_free_enabled,
  beta_free_days,
  beta_free_limit,
  beta_free_used,
  beta_message
)
values (
  1,
  true,
  15,
  50,
  0,
  'Первые 50 размещений бесплатно на 15 дней.'
)
on conflict (id) do nothing;

-- Keep already consumed beta places if V3 was used before V4.
update public.tp_site_settings
set
  beta_free_enabled = true,
  beta_free_days = 15,
  beta_free_limit = 50,
  beta_free_used = greatest(
    coalesce(beta_free_used, 0),
    (select count(*)::integer from public.tp_listings where is_beta_free = true)
  ),
  beta_message = 'Первые 50 размещений бесплатно на 15 дней.',
  updated_at = now()
where id = 1;

alter table public.tp_site_settings enable row level security;
revoke all on table public.tp_site_settings from anon, authenticated;

create or replace function public.tp_get_public_settings()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'beta_free_enabled', s.beta_free_enabled,
    'beta_free_active',
      (s.beta_free_enabled and s.beta_free_used < s.beta_free_limit),
    'beta_free_days', s.beta_free_days,
    'beta_free_limit', s.beta_free_limit,
    'beta_free_used', s.beta_free_used,
    'beta_free_remaining',
      greatest(s.beta_free_limit - s.beta_free_used, 0),
    'beta_message', s.beta_message
  )
  from public.tp_site_settings s
  where s.id = 1;
$$;

grant execute on function public.tp_get_public_settings()
to anon, authenticated;

-- Atomic quota reservation:
-- UPDATE ... WHERE used < limit prevents two simultaneous visitors
-- from both taking the last free place.
create or replace function public.tp_beta_before_listing_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  v_days := null;

  update public.tp_site_settings
     set beta_free_used = beta_free_used + 1,
         updated_at = now()
   where id = 1
     and beta_free_enabled = true
     and beta_free_used < beta_free_limit
  returning beta_free_days
       into v_days;

  if v_days is not null then
    new.plan := 'basic';
    new.placement_price := 199;

    -- Existing payment code interprets "paid" as "do not create initial payment".
    -- is_beta_free distinguishes the free beta placement from a real payment.
    new.payment_status := 'paid';
    new.status := 'published';
    new.expires_at := now() + make_interval(
      days => greatest(1, least(coalesce(v_days, 15), 90))
    );
    new.is_beta_free := true;
  else
    -- Quota is exhausted: leave the listing in the normal paid state
    -- produced by create-listing.
    new.is_beta_free := false;
  end if;

  return new;
end;
$$;

drop trigger if exists tp_beta_before_listing_insert on public.tp_listings;

create trigger tp_beta_before_listing_insert
before insert on public.tp_listings
for each row
execute function public.tp_beta_before_listing_insert();

-- Owner status includes beta flag.
drop function if exists public.tp_get_owner_status(bigint, text);

create function public.tp_get_owner_status(
  p_public_no bigint,
  p_owner_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_result jsonb;
begin
  if p_owner_key is null
     or length(trim(p_owner_key)) < 32
     or length(p_owner_key) > 256 then
    return null;
  end if;

  v_hash := encode(
    extensions.digest(p_owner_key, 'sha256'),
    'hex'
  );

  update public.tp_listings
     set status = 'expired'
   where public_no = p_public_no
     and owner_hash = v_hash
     and status = 'published'
     and expires_at is not null
     and expires_at <= now();

  select jsonb_build_object(
    'public_no', l.public_no,
    'status', l.status,
    'payment_status', l.payment_status,
    'is_beta_free', l.is_beta_free,
    'plan', l.plan,
    'placement_price', l.placement_price,
    'title', l.title,
    'master_name', l.master_name,
    'city', l.city,
    'style', l.style,
    'expires_at', l.expires_at,
    'views', l.views,
    'renewal_available',
      (
        l.payment_status = 'paid'
        and l.status in ('published','expired')
        and not l.is_beta_free
      ),
    'days_left',
      case
        when l.expires_at is null then null
        else greatest(
          0,
          ceil(extract(epoch from (l.expires_at - now())) / 86400.0)
        )::integer
      end
  )
  into v_result
  from public.tp_listings l
  where l.public_no = p_public_no
    and l.owner_hash = v_hash;

  return v_result;
end;
$$;

grant execute on function public.tp_get_owner_status(bigint, text)
to anon, authenticated;

commit;

select public.tp_get_public_settings() as beta_settings;
