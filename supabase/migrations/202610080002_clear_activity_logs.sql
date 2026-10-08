begin;

create or replace function public.clear_activity_logs(
  p_confirmation text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_deleted bigint;
begin
  if p_confirmation is distinct from 'CLEAR' then
    raise exception 'Type CLEAR to confirm.'
      using errcode = '22023';
  end if;

  select p.full_name
  into v_actor_name
  from public.profiles p
  where p.id = v_actor_id
    and p.role = 'ADMIN'
    and p.is_active = true
  for share;

  if not found then
    raise exception 'Active administrator access required.'
      using errcode = '42501';
  end if;

  -- Serialize clearing with other log writes.
  -- New writes can continue after this transaction finishes.
  lock table public.activity_logs in share row exclusive mode;

  delete from public.activity_logs
  where id is not null;
  get diagnostics v_deleted = row_count;

  insert into public.activity_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    changes
  )
  values (
    v_actor_id,
    v_actor_name,
    'ACTIVITY_LOGS_CLEARED',
    'activity_logs',
    jsonb_build_object(
      'deleted_count', v_deleted,
      'scope', 'All activity records'
    )
  );

  return v_deleted;
end;
$$;

revoke all on function public.clear_activity_logs(text)
from public, anon, authenticated;

grant execute on function public.clear_activity_logs(text)
to authenticated;

commit;