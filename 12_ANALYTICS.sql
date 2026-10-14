-- TATTOO PRICE: внутренняя аналитика посещений и действий
create table if not exists public.tp_analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_token text not null,
  event_type text not null check (event_type in ('page_view','contact_click','share','publish_click')),
  section text not null default 'other',
  path text not null,
  entity_no bigint,
  referrer text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists tp_analytics_events_created_idx on public.tp_analytics_events(created_at desc);
create index if not exists tp_analytics_events_event_idx on public.tp_analytics_events(event_type,created_at desc);
create index if not exists tp_analytics_events_section_idx on public.tp_analytics_events(section,created_at desc);
create index if not exists tp_analytics_events_visitor_idx on public.tp_analytics_events(visitor_token,created_at desc);

alter table public.tp_analytics_events enable row level security;
revoke all on public.tp_analytics_events from anon,authenticated;

create or replace function public.tp_track_event(
  p_visitor_token text,
  p_event_type text,
  p_section text,
  p_path text,
  p_entity_no bigint default null,
  p_referrer text default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if p_event_type not in ('page_view','contact_click','share','publish_click') then
    raise exception 'Неверный тип события';
  end if;
  if length(coalesce(p_visitor_token,'')) < 12 then return; end if;

  insert into public.tp_analytics_events(visitor_token,event_type,section,path,entity_no,referrer,meta)
  values(
    left(p_visitor_token,80),
    p_event_type,
    left(coalesce(nullif(trim(p_section),''),'other'),40),
    left(coalesce(nullif(trim(p_path),''),'/'),500),
    p_entity_no,
    nullif(left(trim(coalesce(p_referrer,'')),500),''),
    coalesce(p_meta,'{}'::jsonb)
  );
end $$;

create or replace function public.tp_admin_analytics(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_days integer:=least(greatest(coalesce(p_days,7),1),365);
  v_from timestamptz;
  v_result jsonb;
begin
  if not exists(select 1 from public.tp_admins where user_id=auth.uid()) then
    raise exception 'Недостаточно прав';
  end if;

  if v_days=1 then
    v_from:=date_trunc('day',now());
  else
    v_from:=now()-make_interval(days=>v_days);
  end if;

  select jsonb_build_object(
    'days',v_days,
    'from',v_from,
    'visitors',count(distinct visitor_token),
    'pageviews',count(*) filter(where event_type='page_view'),
    'contact_clicks',count(*) filter(where event_type='contact_click'),
    'shares',count(*) filter(where event_type='share'),
    'publish_clicks',count(*) filter(where event_type='publish_click')
  )
  into v_result
  from public.tp_analytics_events
  where created_at>=v_from;

  v_result:=v_result || jsonb_build_object(
    'sections',coalesce((
      select jsonb_object_agg(section,cnt)
      from (
        select section,count(*) filter(where event_type='page_view') cnt
        from public.tp_analytics_events
        where created_at>=v_from
        group by section
        order by cnt desc
      ) s
    ),'{}'::jsonb),
    'top_pages',coalesce((
      select jsonb_agg(jsonb_build_object('path',path,'views',cnt))
      from (
        select path,count(*) cnt
        from public.tp_analytics_events
        where created_at>=v_from and event_type='page_view'
        group by path
        order by cnt desc
        limit 8
      ) p
    ),'[]'::jsonb)
  );

  return v_result;
end $$;

grant execute on function public.tp_track_event(text,text,text,text,bigint,text,jsonb) to anon,authenticated;
grant execute on function public.tp_admin_analytics(integer) to authenticated;
