-- Public read-only aggregate for the footer visitor counter.
-- Exposes only two counts; raw analytics rows remain private.
create index if not exists tp_analytics_page_view_visitor_idx
  on public.tp_analytics_events(visitor_token)
  where event_type = 'page_view';

create or replace function public.tp_public_visitor_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
  v_counts jsonb;
begin
  select jsonb_build_object(
    'today', count(distinct visitor_token) filter (where created_at >= v_today_start),
    'total', count(distinct visitor_token)
  )
  into v_counts
  from public.tp_analytics_events
  where event_type = 'page_view';

  return coalesce(v_counts, '{"today":0,"total":0}'::jsonb);
end;
$$;

revoke all on function public.tp_public_visitor_counts() from public;
grant execute on function public.tp_public_visitor_counts() to anon, authenticated;
