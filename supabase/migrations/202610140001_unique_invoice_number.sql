begin;

-- Prevent writes while checking and adding the unique index.
lock table public.invoices in share mode;

do $$
begin
    if exists (
        select 1
        from public.invoices
        group by lower(btrim(invoice_number))
        having count(*) > 1
    ) then
        raise exception
            'Duplicate invoice numbers already exist. Review them before adding invoice uniqueness.';
    end if;
end
$$;

create unique index invoices_invoice_number_normalized_uidx
    on public.invoices (lower(btrim(invoice_number)));

commit;