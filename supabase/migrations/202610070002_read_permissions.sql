begin;

-- Internal helpers. Do not expose this schema through the Data API.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Reads the current user's active role from the database.
-- Does not trust editable user metadata or a role sent by the browser.
create function private.current_active_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.is_active = true;
$$;

revoke all on function private.current_active_role()
from public, anon, authenticated;

grant execute on function private.current_active_role()
to authenticated;

-- Only read privileges are added here.
-- Direct insert, update and delete remain blocked.
grant usage on schema public to authenticated;

grant select on table
    public.profiles,
    public.invoices,
    public.pre_grn_stages,
    public.asn_updates,
    public.activity_logs
to authenticated;

-- Users can read their own profile, including their inactive state.
-- Active users can read active profiles for user suggestions.
-- Active admins can read all profiles for user management.
create policy profiles_read
on public.profiles
for select
to authenticated
using (
    id = (select auth.uid())
    or (select private.current_active_role()) = 'ADMIN'
    or (
        is_active = true
        and (select private.current_active_role()) = 'USER'
    )
);

-- Active users and admins can read every invoice.
create policy invoices_read
on public.invoices
for select
to authenticated
using (
    (select private.current_active_role()) in ('ADMIN', 'USER')
);

create policy pre_grn_stages_read
on public.pre_grn_stages
for select
to authenticated
using (
    (select private.current_active_role()) in ('ADMIN', 'USER')
);

create policy asn_updates_read
on public.asn_updates
for select
to authenticated
using (
    (select private.current_active_role()) in ('ADMIN', 'USER')
);

-- Only active admins can read audit history.
create policy activity_logs_admin_read
on public.activity_logs
for select
to authenticated
using (
    (select private.current_active_role()) = 'ADMIN'
);

commit;