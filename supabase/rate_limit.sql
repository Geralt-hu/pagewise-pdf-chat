-- Per-user rate limiting. Run once in Supabase Dashboard -> SQL Editor.

create table if not exists rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, bucket, window_start)
);

-- RLS on with no policies: clients can't touch this table directly.
-- It is only reachable through the security-definer function below.
alter table rate_limits enable row level security;

create or replace function check_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w timestamptz;
  c int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (user_id, bucket, window_start, count)
  values (uid, p_bucket, w, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rate_limits.count + 1
  returning rate_limits.count into c;

  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;

  allowed := c <= p_limit;
  remaining := greatest(p_limit - c, 0);
  retry_after := case
    when c <= p_limit then 0
    else ceil(extract(epoch from (w + make_interval(secs => p_window_seconds) - now())))::int
  end;
  return next;
end;
$$;

revoke all on function check_rate_limit(text, int, int) from public;
revoke all on function check_rate_limit(text, int, int) from anon;
grant execute on function check_rate_limit(text, int, int) to authenticated;
