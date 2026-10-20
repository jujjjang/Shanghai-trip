-- 상하이 여행 앱 · 친구랑 같이 쓰기용 저장소
-- Supabase 대시보드 → SQL Editor → 이 파일 내용을 통째로 붙여넣고 Run 한 번.
--
-- 한 여행 = 여행 코드 하나. 데이터는 "항목 하나 = 한 줄"로 저장해서
-- 둘이 동시에 다른 걸 고쳐도 서로 덮어쓰지 않아요.
-- 표(table)는 공개 키로 직접 읽거나 쓸 수 없고, 아래 두 함수로만,
-- 그것도 여행 코드를 아는 사람만 그 여행 데이터에 닿을 수 있어요.

create table if not exists public.trip_kv (
  code       text        not null,
  key        text        not null,
  value      jsonb,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text,
  primary key (code, key)
);
create index if not exists trip_kv_code_time on public.trip_kv (code, updated_at);

alter table public.trip_kv enable row level security;
revoke all on public.trip_kv from anon, authenticated;

-- 바뀐 것 가져오기: p_since 이후에 바뀐 줄만
create or replace function public.trip_pull(p_code text, p_since timestamptz default null)
returns table (k text, v jsonb, ts timestamptz, by_name text)
language sql
security definer
set search_path = public
as $$
  select t.key, t.value, t.updated_at, t.updated_by
  from public.trip_kv t
  where t.code = p_code
    and length(p_code) >= 10
    and (p_since is null or t.updated_at > p_since)
  order by t.updated_at asc
  limit 5000;
$$;

-- 바뀐 것 올리기: p_rows = [{"k": "...", "v": ...}, ...]  (v가 null이면 지운 것)
create or replace function public.trip_push(p_code text, p_rows jsonb, p_by text default null)
returns table (k text, ts timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code is null or length(p_code) < 10 then
    raise exception 'bad trip code';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'bad rows';
  end if;
  return query
    insert into public.trip_kv as t (code, key, value, updated_at, updated_by)
    select p_code, r->>'k', r->'v', clock_timestamp(), left(p_by, 40)
    from jsonb_array_elements(p_rows) as r
    where coalesce(r->>'k', '') <> ''
    on conflict on constraint trip_kv_pkey do update
      set value = excluded.value, updated_at = clock_timestamp(), updated_by = excluded.updated_by
    returning t.key, t.updated_at;
end;
$$;

revoke all on function public.trip_pull(text, timestamptz) from public;
revoke all on function public.trip_push(text, jsonb, text) from public;
grant execute on function public.trip_pull(text, timestamptz) to anon, authenticated;
grant execute on function public.trip_push(text, jsonb, text) to anon, authenticated;
