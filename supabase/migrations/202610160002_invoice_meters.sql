begin;

alter table public.invoices
add column meter_quantity numeric;

alter table public.invoices
add constraint invoices_meter_quantity_valid
check (
    meter_quantity is null
    or (
        meter_quantity >= 0
        and meter_quantity <= 999999999.999
        and meter_quantity = trunc(meter_quantity, 3)
    )
);

create or replace function public.save_invoice_with_meters(
    p_invoice_id uuid,
    p_expected_version integer,
    p_invoice_number text,
    p_supplier text,
    p_roll_quantity integer,
    p_system_type text,
    p_document_share_date date,
    p_shipment_type text,
    p_vehicle_number text,
    p_received_date date,
    p_expected_received_date date,
    p_meter_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor public.profiles%rowtype;
    v_id uuid;
    v_old numeric;
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

    if p_meter_quantity is not null and not (
        p_meter_quantity >= 0
        and p_meter_quantity <= 999999999.999
        and p_meter_quantity = trunc(p_meter_quantity, 3)
    ) then
        raise exception 'Invalid meters quantity.'
            using errcode = '22023';
    end if;

    if p_invoice_id is not null then
        select meter_quantity
        into v_old
        from public.invoices
        where id = p_invoice_id
        for update;

        if not found then
            raise exception 'Invoice not found.'
                using errcode = 'P0002';
        end if;
    end if;

    -- Reuse existing permission, version, vehicle and audit checks.
    v_id := public.save_invoice_with_received_date(
        p_invoice_id,
        p_expected_version,
        p_invoice_number,
        p_supplier,
        p_roll_quantity,
        p_system_type,
        p_document_share_date,
        p_shipment_type,
        p_vehicle_number,
        p_received_date,
        p_expected_received_date
    );

    if v_old is distinct from p_meter_quantity then
        update public.invoices
        set meter_quantity = p_meter_quantity,
            version = version + 1,
            updated_by = v_actor.id,
            updated_at = now()
        where id = v_id;

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
            v_id,
            v_actor.id,
            v_actor.full_name,
            'INVOICE_METERS_UPDATED',
            'invoice',
            v_id,
            jsonb_build_object(
                'meter_quantity',
                jsonb_build_object(
                    'old', v_old,
                    'new', p_meter_quantity
                )
            )
        );
    end if;

    return v_id;
end;
$$;

revoke all on function public.save_invoice_with_meters(
    uuid, integer, text, text, integer, text,
    date, text, text, date, date, numeric
) from public, anon, authenticated;

grant execute on function public.save_invoice_with_meters(
    uuid, integer, text, text, integer, text,
    date, text, text, date, date, numeric
) to authenticated;

create or replace function public.get_public_invoice_overview_v4(
    p_search text default '',
    p_status text default '',
    p_page integer default 1,
    p_system text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
    v_items jsonb;
begin
    v_result := public.get_public_invoice_overview_v3(
        p_search, p_status, p_page, p_system
    );

    select coalesce(
        jsonb_agg(
            entry.item || jsonb_build_object(
                'meter_quantity', i.meter_quantity
            )
            order by entry.position
        ),
        '[]'::jsonb
    )
    into v_items
    from jsonb_array_elements(
        coalesce(v_result -> 'items', '[]'::jsonb)
    ) with ordinality as entry(item, position)
    join public.invoices i
      on i.id = (entry.item ->> 'id')::uuid;

    return jsonb_set(v_result, '{items}', v_items);
end;
$$;

revoke all on function public.get_public_invoice_overview_v4(
    text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.get_public_invoice_overview_v4(
    text, text, integer, text
) to anon, authenticated;

notify pgrst, 'reload schema';

commit; 