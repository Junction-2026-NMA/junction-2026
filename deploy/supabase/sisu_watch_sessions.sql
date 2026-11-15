-- Sisu's scheduled watch check (lib/watch/cron.ts, GET /api/watch/cron): lists the visitor sessions that have at
-- least one active watch, so the daily run can review them. Added 15 Nov.
-- Run this once, AFTER sisu_sessions.sql (it uses sisu_store_allowed). It can be run again safely.
-- Until it is run, the cron route answers 503 and nothing else changes. Only then set CRON_SECRET in Vercel.
--
-- It answers session ids only, never a state, and like sisu_load it needs the server's store token.

create or replace function public.sisu_sessions_with_watches(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.sisu_store_allowed() then
    raise exception 'sisu: this call needs the server''s store token' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(t.id order by t.updated_at desc)
    from (
      select s.id, s.updated_at
      from public.sisu_sessions s
      where s.state @> '{"watches": [{"status": "active"}]}'::jsonb
      order by s.updated_at desc
      limit greatest(1, least(coalesce(p_limit, 20), 200))
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.sisu_sessions_with_watches(integer) from public, authenticated;
grant execute on function public.sisu_sessions_with_watches(integer) to anon, service_role;
