begin;

create or replace function public.set_user_active(
  p_user_id uuid,
  p_expected_active boolean,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  -- Serialize access-management changes.
  perform pg_catalog.pg_advisory_xact_lock(731005001::bigint);

  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and role = 'ADMIN'
    and is_active = true
  for share;

  if not found then
    raise exception 'Active administrator access required.'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or p_expected_active is null
     or p_is_active is null then
    raise exception 'Invalid access update.'
      using errcode = '22023';
  end if;

  if p_user_id = v_actor.id then
    raise exception 'You cannot change your own account access.'
      using errcode = '22023';
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found.'
      using errcode = 'P0002';
  end if;

  if v_target.is_active is distinct from p_expected_active then
    raise exception 'This account was updated by another administrator.'
      using errcode = '40001';
  end if;

  if v_target.is_active = p_is_active then
    return;
  end if;

  update public.profiles
  set
    is_active = p_is_active,
    updated_at = now()
  where id = p_user_id;

  insert into public.activity_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    changes
  )
  values (
    v_actor.id,
    v_actor.full_name,
    case
      when p_is_active then 'USER_ACTIVATED'
      else 'USER_DEACTIVATED'
    end,
    'profile',
    v_target.id,
    jsonb_build_object(
      'user_name', jsonb_build_object(
        'old', v_target.full_name,
        'new', v_target.full_name
      ),
      'is_active', jsonb_build_object(
        'old', v_target.is_active,
        'new', p_is_active
      )
    )
  );
end;
$$;

revoke all on function public.set_user_active(uuid, boolean, boolean)
from public, anon, authenticated;

grant execute on function public.set_user_active(uuid, boolean, boolean)
to authenticated;

commit;