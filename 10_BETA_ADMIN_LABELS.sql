-- TATTOO PRICE — BETA ADMIN LABELS / SLOT NUMBERS — V5
-- Adds a permanent beta slot number to each free beta listing.
-- Existing beta listings are backfilled in creation order.
-- Future beta listings receive the next atomic slot number.

begin;

alter table public.tp_listings
  add column if not exists beta_slot_no integer;

-- Backfill existing beta-free listings deterministically.
with ranked as (
  select
    id,
    row_number() over (
      order by created_at asc, public_no asc, id asc
    )::integer as rn
  from public.tp_listings
  where is_beta_free = true
)
update public.tp_listings l
set beta_slot_no = r.rn
from ranked r
where l.id = r.id
  and l.beta_slot_no is null;

create unique index if not exists tp_listings_beta_slot_no_uidx
  on public.tp_listings(beta_slot_no)
  where beta_slot_no is not null;

-- Keep used counter consistent with already granted beta places.
update public.tp_site_settings
set
  beta_free_used = greatest(
    beta_free_used,
    coalesce((
      select max(beta_slot_no)
      from public.tp_listings
      where is_beta_free = true
    ), 0)
  ),
  updated_at = now()
where id = 1;

-- Replace quota trigger so future free listings keep their exact slot number.
create or replace function public.tp_beta_before_listing_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_slot integer;
begin
  v_days := null;
  v_slot := null;

  update public.tp_site_settings
     set beta_free_used = beta_free_used + 1,
         updated_at = now()
   where id = 1
     and beta_free_enabled = true
     and beta_free_used < beta_free_limit
  returning beta_free_days, beta_free_used
       into v_days, v_slot;

  if v_days is not null then
    new.plan := 'basic';
    new.placement_price := 199;
    new.payment_status := 'paid';
    new.status := 'published';
    new.expires_at := now() + make_interval(
      days => greatest(1, least(coalesce(v_days, 15), 90))
    );
    new.is_beta_free := true;
    new.beta_slot_no := v_slot;
  else
    new.is_beta_free := false;
    new.beta_slot_no := null;
  end if;

  return new;
end;
$$;

commit;

select
  public_no,
  is_beta_free,
  beta_slot_no,
  status,
  expires_at
from public.tp_listings
where is_beta_free = true
order by beta_slot_no;

select public.tp_get_public_settings() as beta_settings;
