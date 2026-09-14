-- TATTOO PRICE — BETA FREE MODE v1
-- Goal:
-- 1) During beta: no T-Bank charge for NEW listings.
-- 2) New listings are published immediately for 30 days.
-- 3) Admin can still hide/reject/delete afterwards (post-moderation).
-- 4) Turn beta off later with ONE SQL command:
--    update public.tp_site_settings set beta_free_enabled = false where id = 1;

begin;

alter table public.tp_listings
  add column if not exists is_beta_free boolean not null default false;

create table if not exists public.tp_site_settings (
  id integer primary key check (id = 1),
  beta_free_enabled boolean not null default true,
  beta_free_days integer not null default 15
    check (beta_free_days between 1 and 90),
  beta_message text not null default 'БЕТА-ЗАПУСК: размещение бесплатно на 15 дней. Публикация сразу.',
  updated_at timestamptz not null default now()
);

insert into public.tp_site_settings (
  id, beta_free_enabled, beta_free_days, beta_message
)
values (
  1, true, 15,
  'БЕТА-ЗАПУСК: размещение бесплатно на 15 дней. Публикация сразу.'
)
on conflict (id) do update set
  beta_free_enabled = true,
  beta_free_days = 30,
  beta_message = excluded.beta_message,
  updated_at = now();

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
    'beta_free_days', s.beta_free_days,
    'beta_message', s.beta_message
  )
  from public.tp_site_settings s
  where s.id = 1;
$$;

grant execute on function public.tp_get_public_settings()
to anon, authenticated;

create or replace function public.tp_beta_before_listing_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
  v_days integer := 30;
begin
  select beta_free_enabled, beta_free_days
    into v_enabled, v_days
  from public.tp_site_settings
  where id = 1;

  if coalesce(v_enabled, false) then
    -- Keep the normal price in placement_price so the paid system can be
    -- restored later without rewriting old listings.
    new.plan := 'basic';
    new.placement_price := 199;

    -- Compatibility: existing payment code treats "paid" as "do not charge again".
    -- is_beta_free distinguishes this from a real payment.
    new.payment_status := 'paid';
    new.status := 'published';
    new.expires_at := now() + make_interval(days => greatest(1, least(coalesce(v_days, 15), 90)));
    new.is_beta_free := true;
  end if;

  return new;
end;
$$;

drop trigger if exists tp_beta_before_listing_insert on public.tp_listings;

create trigger tp_beta_before_listing_insert
before insert on public.tp_listings
for each row
execute function public.tp_beta_before_listing_insert();

-- Owner status: expose the beta flag so the UI can say "free beta",
-- not "paid".
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
