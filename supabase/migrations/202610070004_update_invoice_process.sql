begin;

-- Produce a flat snapshot for field-by-field audit comparison.
-- This helper is internal and cannot be called by application users.
create or replace function private.invoice_process_snapshot(
    p_invoice_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select
        jsonb_build_object(
            'status', i.status,
            'pending_reason', i.pending_reason,
            'remark', i.remark,
            'completed_at', i.completed_at,
            'asn.share_date', a.share_date,
            'asn.is_shared', a.is_shared,
            'asn.assigned_user_name', a.assigned_user_name
        )
        ||
        coalesce(
            (
                select jsonb_object_agg(
                    s.system_name || '.' || field.key,
                    field.value
                )
                from public.pre_grn_stages s
                cross join lateral jsonb_each(
                    jsonb_build_object(
                        'started_at', s.started_at,
                        'ended_at', s.ended_at,
                        'is_done', s.is_done,
                        'assigned_user_name', s.assigned_user_name
                    )
                ) as field
                where s.invoice_id = i.id
            ),
            '{}'::jsonb
        )
    from public.invoices i
    left join public.asn_updates a
        on a.invoice_id = i.id
    where i.id = p_invoice_id;
$$;

revoke all on function private.invoice_process_snapshot(uuid)
from public, anon, authenticated;


create or replace function public.update_invoice_process(
    p_invoice_id uuid,
    p_expected_version integer,
    p_stages jsonb,
    p_pending_reason text,
    p_asn_share_date date,
    p_asn_shared boolean,
    p_asn_user_name text,
    p_remark text,
    p_status text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor public.profiles%rowtype;
    v_invoice public.invoices%rowtype;

    v_systems text[];
    v_stage jsonb;
    v_system text;

    v_start timestamptz;
    v_end timestamptz;
    v_done boolean;
    v_name text;

    v_before jsonb;
    v_after jsonb;
    v_changes jsonb;
    v_new_version integer;
begin
    -- Check the real signed-in user.
    select *
    into v_actor
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('ADMIN', 'USER')
    for share;

    if not found then
        raise exception 'Active dashboard access is required.'
            using errcode = '42501';
    end if;

    -- Lock this invoice until the transaction finishes.
    select *
    into v_invoice
    from public.invoices
    where id = p_invoice_id
    for update;

    if not found then
        raise exception 'Invoice not found.'
            using errcode = 'P0002';
    end if;

    -- Do not overwrite changes saved by another user.
    if p_expected_version is null
       or p_expected_version <> v_invoice.version then
        raise exception
            'This invoice was updated by another user. Reload before saving.'
            using errcode = '40001';
    end if;

    if p_status is null
       or p_status not in ('Pending', 'Complete', 'Reject') then
        raise exception 'Select a valid final status.';
    end if;

    if p_asn_shared is null then
        raise exception 'ASN share status is required.';
    end if;

    if p_asn_share_date is not null
       and not isfinite(p_asn_share_date) then
        raise exception 'Invalid ASN share date.';
    end if;

    if length(coalesce(p_asn_user_name, '')) > 150 then
        raise exception 'ASN user name is too long.';
    end if;

    if length(coalesce(p_pending_reason, '')) > 5000
       or length(coalesce(p_remark, '')) > 5000 then
        raise exception 'Reason and remark must be within 5000 characters.';
    end if;

    v_systems := case v_invoice.system_type
        when 'AX' then array['AX']
        when 'D365' then array['D365']
        else array['AX', 'D365']
    end;

    if p_stages is null
       or jsonb_typeof(p_stages) <> 'array' then
        raise exception 'Processing stages must be an array.';
    end if;

    if jsonb_array_length(p_stages) <> cardinality(v_systems) then
        raise exception 'Incorrect number of processing stages.';
    end if;

    -- Each required system must appear exactly once.
    foreach v_system in array v_systems loop
        if (
            select count(*)
            from jsonb_array_elements(p_stages) as entry(value)
            where entry.value ->> 'system_name' = v_system
        ) <> 1 then
            raise exception 'Missing or duplicate stage: %', v_system;
        end if;
    end loop;

    v_before := private.invoice_process_snapshot(p_invoice_id);

    for v_stage in
        select value from jsonb_array_elements(p_stages)
    loop
        if jsonb_typeof(v_stage) <> 'object'
           or not (
               v_stage ?& array[
                   'system_name',
                   'started_at',
                   'ended_at',
                   'is_done',
                   'assigned_user_name'
               ]
           ) then
            raise exception 'Incomplete stage details.';
        end if;

        if jsonb_typeof(v_stage -> 'is_done') <> 'boolean' then
            raise exception 'Stage Done value must be true or false.';
        end if;

        v_system := v_stage ->> 'system_name';
        v_start := nullif(v_stage ->> 'started_at', '')::timestamptz;
        v_end := nullif(v_stage ->> 'ended_at', '')::timestamptz;
        v_done := (v_stage ->> 'is_done')::boolean;
        v_name := nullif(trim(v_stage ->> 'assigned_user_name'), '');

        if (v_start is not null and not isfinite(v_start))
           or (v_end is not null and not isfinite(v_end)) then
            raise exception 'Invalid date in % stage.', v_system;
        end if;

        if v_end is not null
           and (v_start is null or v_end < v_start) then
            raise exception
                '% end date must not be before its start date.',
                v_system;
        end if;

        if length(coalesce(v_name, '')) > 150 then
            raise exception '% user name is too long.', v_system;
        end if;

        update public.pre_grn_stages
        set
            started_at = v_start,
            ended_at = v_end,
            is_done = v_done,
            assigned_user_name = v_name,

            -- Preserve an existing linked user if its name is unchanged.
            -- New manual/suggested names are stored as operational labels.
            assigned_user_id = case
                when assigned_user_name is not distinct from v_name
                    then assigned_user_id
                else null
            end
        where invoice_id = p_invoice_id
          and system_name = v_system;

        if not found then
            raise exception 'Stored stage not found: %', v_system;
        end if;
    end loop;

    v_name := nullif(trim(p_asn_user_name), '');

    update public.asn_updates
    set
        share_date = p_asn_share_date,
        is_shared = p_asn_shared,
        assigned_user_name = v_name,
        assigned_user_id = case
            when assigned_user_name is not distinct from v_name
                then assigned_user_id
            else null
        end
    where invoice_id = p_invoice_id;

    if not found then
        raise exception 'ASN record not found.';
    end if;

    update public.invoices
    set
        pending_reason = nullif(trim(p_pending_reason), ''),
        remark = nullif(trim(p_remark), ''),
        status = p_status,
        completed_at = case
            when p_status = 'Complete' then
                coalesce(v_invoice.completed_at, now())
            else null
        end
    where id = p_invoice_id;

    v_after := private.invoice_process_snapshot(p_invoice_id);

    -- Keep only fields whose values actually changed.
    select coalesce(
        jsonb_object_agg(
            before_field.key,
            jsonb_build_object(
                'old', before_field.value,
                'new', after_field.value
            )
        ),
        '{}'::jsonb
    )
    into v_changes
    from jsonb_each(v_before) as before_field
    join jsonb_each(v_after) as after_field
        on after_field.key = before_field.key
    where before_field.value is distinct from after_field.value;

    -- Saving identical values does not create a false activity event.
    if v_changes = '{}'::jsonb then
        return v_invoice.version;
    end if;

    update public.invoices
    set
        version = version + 1,
        updated_by = v_actor.id,
        updated_at = now()
    where id = p_invoice_id
    returning version into v_new_version;

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
        p_invoice_id,
        v_actor.id,
        v_actor.full_name,
        'INVOICE_UPDATED',
        'invoice',
        p_invoice_id,
        v_changes
    );

    return v_new_version;
end;
$$;

revoke all on function public.update_invoice_process(
    uuid, integer, jsonb, text, date, boolean, text, text, text
) from public, anon, authenticated;

grant execute on function public.update_invoice_process(
    uuid, integer, jsonb, text, date, boolean, text, text, text
) to authenticated;

commit;