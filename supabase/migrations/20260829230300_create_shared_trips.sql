-- 공유 여행 일정 저장소.
--
-- 테이블에는 RLS를 켜고 정책을 하나도 두지 않는다. 따라서 anon 키로는 테이블을
-- 직접 읽거나 쓸 수 없고, 아래 security definer 함수를 통해서만 접근한다.
-- 읽기는 id(uuid)를 알아야만 가능하므로 목록을 훑어갈 수 없고,
-- 쓰기는 edit_token까지 맞아야 한다.

create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  edit_token  uuid not null default gen_random_uuid(),
  title       text not null default '여행 일정',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.trips enable row level security;
revoke all on table public.trips from anon, authenticated;

comment on table public.trips is
  '공유 링크로 열람하는 여행 일정. 접근은 public.trip_* 함수로만 한다.';

-- 생성 남용을 막기 위한 가벼운 전역 카운터
create table public.trip_create_log (
  created_at timestamptz not null default now()
);
create index trip_create_log_created_at_idx on public.trip_create_log (created_at desc);
alter table public.trip_create_log enable row level security;
revoke all on table public.trip_create_log from anon, authenticated;

-- 저장 용량 상한 (1MiB)
create or replace function public.assert_payload_size(p_data jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if pg_catalog.pg_column_size(p_data) > 1048576 then
    raise exception 'payload_too_large' using errcode = '22001';
  end if;
end;
$$;

-- 변경 여부만 싸게 확인한다 (폴링용)
create or replace function public.trip_head(p_id uuid)
returns timestamptz
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select t.updated_at from public.trips t where t.id = p_id;
$$;

-- 일정 읽기. edit_token은 절대 돌려주지 않는다.
create or replace function public.trip_get(p_id uuid)
returns table (id uuid, title text, data jsonb, updated_at timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select t.id, t.title, t.data, t.updated_at from public.trips t where t.id = p_id;
$$;

-- 공유 링크 만들기. 만든 사람만 edit_token을 받는다.
create or replace function public.trip_create(p_title text, p_data jsonb)
returns table (id uuid, edit_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  perform public.assert_payload_size(p_data);

  select count(*) into v_recent
    from public.trip_create_log
   where created_at > now() - interval '1 hour';
  if v_recent >= 100 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  insert into public.trip_create_log default values;
  delete from public.trip_create_log where created_at < now() - interval '1 day';

  return query
    insert into public.trips (title, data)
    values (coalesce(nullif(btrim(p_title), ''), '여행 일정'), p_data)
    returning trips.id, trips.edit_token;
end;
$$;

-- 일정 저장. edit_token이 맞을 때만 갱신된다.
create or replace function public.trip_save(p_id uuid, p_token uuid, p_title text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated timestamptz;
begin
  perform public.assert_payload_size(p_data);

  update public.trips t
     set data = p_data,
         title = coalesce(nullif(btrim(p_title), ''), t.title),
         updated_at = now()
   where t.id = p_id
     and t.edit_token = p_token
  returning t.updated_at into v_updated;

  if v_updated is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v_updated;
end;
$$;

revoke all on function public.assert_payload_size(jsonb) from public;
revoke all on function public.trip_head(uuid) from public;
revoke all on function public.trip_get(uuid) from public;
revoke all on function public.trip_create(text, jsonb) from public;
revoke all on function public.trip_save(uuid, uuid, text, jsonb) from public;

grant execute on function public.trip_head(uuid) to anon, authenticated;
grant execute on function public.trip_get(uuid) to anon, authenticated;
grant execute on function public.trip_create(text, jsonb) to anon, authenticated;
grant execute on function public.trip_save(uuid, uuid, text, jsonb) to anon, authenticated;
