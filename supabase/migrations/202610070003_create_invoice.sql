begin;

create or replace function public.create_invoice(
    p_invoice_number text,
    p_supplier text,
    p_roll_quantity integer,
    p_system_type text,
    p_document_share_date date,
    p_shipment_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor public.profiles%rowtype;
    v_invoice public.invoices%rowtype;
begin
    -- Use the authenticated user's identity, not a browser-supplied ID.
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

    if p_invoice_number is null
       or length(trim(p_invoice_number)) not between 1 and 100 then
        raise exception 'A valid invoice number is required.';
    end if;

    if p_supplier is null
       or length(trim(p_supplier)) not between 1 and 250 then
        raise exception 'A valid supplier is required.';
    end if;

    if p_system_type is null
       or p_system_type not in ('AX', 'D365', 'AX/D365') then
        raise exception 'Select a valid system.';
    end if;

    if p_shipment_type is null
       or p_shipment_type not in ('LOCAL', 'IMPORT') then
        raise exception 'Select LOCAL or IMPORT.';
    end if;

    if p_document_share_date is null
       or not isfinite(p_document_share_date) then
        raise exception 'A valid document share date is required.';
    end if;

    if p_roll_quantity is not null and p_roll_quantity < 0 then
        raise exception 'Roll quantity cannot be negative.';
    end if;

    -- Create the invoice. Status defaults to Pending.
    insert into public.invoices (
        invoice_number,
        supplier,
        roll_quantity,
        system_type,
        document_share_date,
        shipment_type,
        created_by,
        updated_by
    )
    values (
        trim(p_invoice_number),
        trim(p_supplier),
        p_roll_quantity,
        p_system_type,
        p_document_share_date,
        p_shipment_type,
        v_actor.id,
        v_actor.id
    )
    returning * into v_invoice;

    -- Create the applicable processing stages.
    if p_system_type in ('AX', 'AX/D365') then
        insert into public.pre_grn_stages (
            invoice_id,
            system_name
        )
        values (v_invoice.id, 'AX');
    end if;

    if p_system_type in ('D365', 'AX/D365') then
        insert into public.pre_grn_stages (
            invoice_id,
            system_name
        )
        values (v_invoice.id, 'D365');
    end if;

    -- Create an initially empty ASN record.
    insert into public.asn_updates (invoice_id)
    values (v_invoice.id);

    -- Record who created the invoice and its initial values.
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
        v_invoice.id,
        v_actor.id,
        v_actor.full_name,
        'INVOICE_CREATED',
        'invoice',
        v_invoice.id,
        jsonb_build_object(
            'invoice',
            jsonb_build_object(
                'old', null,
                'new', to_jsonb(v_invoice)
            )
        )
    );

    return v_invoice.id;
end;
$$;

-- Visitors cannot call this function.
revoke all on function public.create_invoice(
    text, text, integer, text, date, text
) from public, anon, authenticated;

-- Signed-in callers are still checked for active access inside the function.
grant execute on function public.create_invoice(
    text, text, integer, text, date, text
) to authenticated;

commit;