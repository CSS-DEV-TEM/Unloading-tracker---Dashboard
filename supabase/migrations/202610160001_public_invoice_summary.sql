begin;

create or replace function public.get_public_invoice_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select pg_catalog.jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (
            where status = 'Pending'
        ),
        'completed', count(*) filter (
            where status = 'Complete'
        ),
        'rejected', count(*) filter (
            where status = 'Reject'
        )
    )
    from public.invoices;
$$;

revoke all
on function public.get_public_invoice_summary()
from public;

grant execute
on function public.get_public_invoice_summary()
to anon, authenticated;

notify pgrst, 'reload schema';

commit;