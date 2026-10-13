begin;

-- Create a separate arrival for an existing or new vehicle.
create or replace function public.add_vehicle_arrival(
  p_number text,
  p_received_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle_id uuid;
  v_arrival_id uuid;
  v_actor public.profiles%rowtype;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access is required.'
      using errcode = '42501';
  end if;

  if p_received_date is null
     or not isfinite(p_received_date) then
    raise exception 'Select a valid received date.'
      using errcode = '22023';
  end if;

  v_vehicle_id := private.resolve_vehicle(p_number);

  if v_vehicle_id is null then
    raise exception 'Enter a vehicle number.'
      using errcode = '22023';
  end if;

  insert into public.vehicle_arrivals (
    vehicle_id,
    received_date
  )
  values (
    v_vehicle_id,
    p_received_date
  )
  returning id into v_arrival_id;

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
    'VEHICLE_ARRIVAL_CREATED',
    'vehicle_arrival',
    v_arrival_id,
    jsonb_build_object(
      'vehicle_id',
      jsonb_build_object('old', null, 'new', v_vehicle_id),
      'received_date',
      jsonb_build_object('old', null, 'new', p_received_date)
    )
  );

  return v_arrival_id;
end;
$$;

-- Extend the existing completed-invoice lock to arrival changes.
create or replace function private.guard_completed_invoice_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle_id uuid;
  v_archived boolean;
begin
  -- An older vehicle-only action must not retain an arrival
  -- belonging to the previous vehicle.
  if new.vehicle_id is distinct from old.vehicle_id
     and new.vehicle_arrival_id
       is not distinct from old.vehicle_arrival_id then
    new.vehicle_arrival_id := null;
  end if;

  if new.vehicle_id is distinct from old.vehicle_id
     or new.vehicle_arrival_id
       is distinct from old.vehicle_arrival_id then

    if old.status = 'Complete'
       or new.status = 'Complete'
       or exists (
         select 1
         from public.asn_updates
         where invoice_id = old.id
           and is_shared
       ) then
      raise exception
        'Reopen the invoice as Pending before changing its vehicle or arrival.'
        using errcode = 'PVC01';
    end if;
  end if;

  if new.vehicle_arrival_id
       is distinct from old.vehicle_arrival_id then

    if new.vehicle_arrival_id is not null then
      select a.vehicle_id, v.is_archived
      into v_vehicle_id, v_archived
      from public.vehicle_arrivals a
      join public.vehicles v on v.id = a.vehicle_id
      where a.id = new.vehicle_arrival_id
      for share of a, v;

      if not found then
        raise exception 'Arrival not found.'
          using errcode = 'P0002';
      end if;

      if v_vehicle_id is distinct from new.vehicle_id then
        raise exception 'Arrival belongs to a different vehicle.'
          using errcode = '22023';
      end if;

      if v_archived then
        raise exception 'Restore the archived vehicle first.'
          using errcode = 'PVA01';
      end if;
    end if;

    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists zz_completed_invoice_vehicle_guard
  on public.invoices;

create trigger zz_completed_invoice_vehicle_guard
before update of vehicle_id, vehicle_number, vehicle_arrival_id
on public.invoices
for each row
execute function private.guard_completed_invoice_vehicle();

-- Record arrival assignment changes in the activity log.
create or replace function private.audit_invoice_arrival()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.vehicle_arrival_id
       is distinct from old.vehicle_arrival_id then

    select full_name into v_name
    from public.profiles
    where id = auth.uid();

    insert into public.activity_logs (
      invoice_id,
      actor_id,
      actor_name,
      action,
      entity_type,
      entity_id,
      changes
    )
    values (
      new.id,
      auth.uid(),
      v_name,
      'INVOICE_ARRIVAL_UPDATED',
      'invoice',
      new.id,
      jsonb_build_object(
        'vehicle_arrival_id',
        jsonb_build_object(
          'old', old.vehicle_arrival_id,
          'new', new.vehicle_arrival_id
        )
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists invoice_arrival_audit
  on public.invoices;

create trigger invoice_arrival_audit
after update of vehicle_id, vehicle_number, vehicle_arrival_id
on public.invoices
for each row
execute function private.audit_invoice_arrival();

-- Assign a batch of invoices to a selected arrival.
create or replace function public.assign_arrival_invoices(
  p_arrival_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle_id uuid;
  v_count integer;
begin
  perform 1
  from public.profiles
  where id = auth.uid()
    and is_active
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access is required.'
      using errcode = '42501';
  end if;

  select vehicle_id
  into v_vehicle_id
  from public.vehicle_arrivals
  where id = p_arrival_id
  for share;

  if not found then
    raise exception 'Select an existing arrival.'
      using errcode = 'P0002';
  end if;

  -- Existing function validates the batch, checks versions,
  -- checks the vehicle and locks every selected invoice.
  perform public.assign_vehicle_invoices(
    v_vehicle_id,
    p_items
  );

  update public.invoices i
  set vehicle_arrival_id = p_arrival_id
  where i.id in (
    select x.id
    from jsonb_to_recordset(p_items)
      as x(id uuid, version integer)
  )
  and i.vehicle_arrival_id is distinct from p_arrival_id;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function private.guard_completed_invoice_vehicle()
  from public, anon, authenticated;

revoke all on function private.audit_invoice_arrival()
  from public, anon, authenticated;

revoke all on function public.add_vehicle_arrival(text, date)
  from public, anon, authenticated;

grant execute on function public.add_vehicle_arrival(text, date)
  to authenticated;

revoke all on function public.assign_arrival_invoices(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.assign_arrival_invoices(uuid, jsonb)
  to authenticated;

commit;