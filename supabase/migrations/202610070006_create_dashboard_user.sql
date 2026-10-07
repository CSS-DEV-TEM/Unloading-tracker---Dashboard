begin;

create or replace function private.provision_dashboard_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor public.profiles%rowtype;
  v_full_name text;
begin
  -- Only provision users explicitly created by our admin workflow.
  if new.raw_app_meta_data ->> 'dashboard_provisioning'
       is distinct from 'v1' then
    return new;
  end if;

  v_actor_id :=
    (new.raw_app_meta_data ->> 'dashboard_created_by')::uuid;

  v_full_name :=
    nullif(
      btrim(new.raw_app_meta_data ->> 'dashboard_full_name'),
      ''
    );

  if v_full_name is null or char_length(v_full_name) > 150 then
    raise exception 'A valid full name is required.'
      using errcode = '22023';
  end if;

  -- Coordinate with account activation/deactivation changes.
  perform pg_catalog.pg_advisory_xact_lock(731005001::bigint);

  select *
  into v_actor
  from public.profiles
  where id = v_actor_id
    and role = 'ADMIN'
    and is_active = true
  for share;

  if not found then
    raise exception 'Active administrator access required.'
      using errcode = '42501';
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    is_active
  )
  values (
    new.id,
    v_full_name,
    'USER',
    true
  );

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
    'USER_CREATED',
    'profile',
    new.id,
    jsonb_build_object(
      'user_name', jsonb_build_object(
        'old', null,
        'new', v_full_name
      ),
      'role', jsonb_build_object(
        'old', null,
        'new', 'USER'
      ),
      'is_active', jsonb_build_object(
        'old', null,
        'new', true
      )
    )
  );

  return new;
end;
$$;

revoke all on function private.provision_dashboard_user()
from public, anon, authenticated;

drop trigger if exists on_dashboard_user_created on auth.users;

create trigger on_dashboard_user_created
after insert on auth.users
for each row
execute function private.provision_dashboard_user();

commit;