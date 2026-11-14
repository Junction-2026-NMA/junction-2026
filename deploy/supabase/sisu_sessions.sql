-- Sisu's hosted state: one row per visitor session (lib/store/supabase.ts).
-- Run this once in a Supabase project (SQL editor, or `supabase db query -f deploy/supabase/sisu_sessions.sql`).
-- It can be run again safely.
--
-- The table is closed: row level security is on and there is no policy, so the public key cannot read or write
-- it directly. The server reaches it only through the two functions below. A session id is long and random and
-- is the only thing that opens a session's row, so one visitor can never reach another visitor's state.

create table if not exists public.sisu_sessions (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,64}$'),
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sisu_sessions enable row level security;
revoke all on public.sisu_sessions from anon, authenticated;

-- The state and version of one session, or null for a visitor who has none yet.
create or replace function public.sisu_load(p_session text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('state', s.state, 'version', s.version)
  from public.sisu_sessions s
  where s.id = p_session;
$$;

-- Stores a session's state if it is still at the version the caller read (0 for a new session).
-- Answers {ok: true, version} when stored. When another server saved first it stores nothing and answers
-- {ok: false, state, version} with what is there now, so the caller can put its change on top and try again.
create or replace function public.sisu_save(p_session text, p_state jsonb, p_expected integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_state jsonb;
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'sisu_save: not a session id';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 524288 then
    raise exception 'sisu_save: state must be a JSON object of at most 512 kB';
  end if;

  update public.sisu_sessions
    set state = p_state, version = version + 1, updated_at = now()
    where id = p_session and version = p_expected
    returning version into v_version;

  if v_version is null then
    select s.state, s.version into v_state, v_version from public.sisu_sessions s where s.id = p_session;
    if v_version is not null then
      return jsonb_build_object('ok', false, 'state', v_state, 'version', v_version);
    end if;
    -- No row at all: a new session, or one that was cleared. Two servers creating it at once is settled by
    -- the primary key: the second one gets the first one's row back.
    insert into public.sisu_sessions (id, state) values (p_session, p_state)
      on conflict (id) do nothing
      returning version into v_version;
    if v_version is null then
      select s.state, s.version into v_state, v_version from public.sisu_sessions s where s.id = p_session;
      return jsonb_build_object('ok', false, 'state', v_state, 'version', v_version);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'version', v_version);
end;
$$;

-- Only the server's keys may call the functions. `anon` is the public (publishable) key; remove it from the
-- grants below if the server uses the secret key (SUPABASE_SECRET_KEY) instead.
revoke all on function public.sisu_load(text) from public, authenticated;
revoke all on function public.sisu_save(text, jsonb, integer) from public, authenticated;
grant execute on function public.sisu_load(text) to anon, service_role;
grant execute on function public.sisu_save(text, jsonb, integer) to anon, service_role;

-- Housekeeping, when wanted: delete from public.sisu_sessions where updated_at < now() - interval '7 days';
