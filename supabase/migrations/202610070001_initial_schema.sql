begin;

-- 1. Application profiles.
-- Passwords and login identities are managed by Supabase Auth.
-- Accounts will be deactivated rather than deleted.

create table public.profiles (
    id uuid primary key references auth.users(id) on delete restrict,
    full_name text not null
        check (length(trim(full_name)) between 1 and 150),
    role text not null default 'USER'
        check (role in ('ADMIN', 'USER')),
    is_active boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Shared invoice record.
-- Invoice numbers are text to preserve formatting.
-- Duplicate-invoice rules will be confirmed before adding uniqueness.

create table public.invoices (
    id uuid primary key default gen_random_uuid(),

    invoice_number text not null
        check (length(trim(invoice_number)) between 1 and 100),

    supplier text not null
        check (length(trim(supplier)) between 1 and 250),

    roll_quantity integer
        check (roll_quantity >= 0),

    system_type text not null
        check (system_type in ('AX', 'D365', 'AX/D365')),

    document_share_date date not null
        default ((now() at time zone 'Asia/Colombo')::date),

    shipment_type text not null
        check (shipment_type in ('LOCAL', 'IMPORT')),

    pending_reason text,
    remark text,

    status text not null default 'Pending'
        check (status in ('Pending', 'Complete', 'Reject')),

    completed_at timestamptz,

    version integer not null default 1
        check (version >= 1),

    created_by uuid not null
        references public.profiles(id) on delete restrict,

    updated_by uuid not null
        references public.profiles(id) on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint invoice_completion_consistency check (
        (status = 'Complete' and completed_at is not null)
        or
        (status <> 'Complete' and completed_at is null)
    )
);

-- 3. One independent processing stage per invoice and system.
-- AX/D365 invoices will have two stage records.

create table public.pre_grn_stages (
    id uuid primary key default gen_random_uuid(),

    invoice_id uuid not null
        references public.invoices(id) on delete restrict,

    system_name text not null
        check (system_name in ('AX', 'D365')),

    started_at timestamptz,
    ended_at timestamptz,
    is_done boolean not null default false,

    assigned_user_id uuid
        references public.profiles(id) on delete restrict,

    -- Stores a manually entered name or a snapshot of a selected user's name.
    assigned_user_name text
        check (
            assigned_user_name is null
            or length(trim(assigned_user_name)) between 1 and 150
        ),

    constraint selected_stage_user_has_name check (
        assigned_user_id is null
        or assigned_user_name is not null
    ),

    constraint one_stage_per_system
        unique (invoice_id, system_name),

    constraint valid_stage_dates check (
        ended_at is null
        or (
            started_at is not null
            and ended_at >= started_at
        )
    )
);

-- 4. One ASN record per invoice.

create table public.asn_updates (
    invoice_id uuid primary key
        references public.invoices(id) on delete restrict,

    share_date date,
    is_shared boolean not null default false,

    assigned_user_id uuid
        references public.profiles(id) on delete restrict,

    assigned_user_name text
        check (
            assigned_user_name is null
            or length(trim(assigned_user_name)) between 1 and 150
        ),

    constraint selected_asn_user_has_name check (
        assigned_user_id is null
        or assigned_user_name is not null
    )
);

-- 5. Audit events.
-- Database save functions will write these records.
-- Application users will not directly insert, edit or delete logs.

create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),

    invoice_id uuid
        references public.invoices(id) on delete restrict,

    actor_id uuid not null
        references public.profiles(id) on delete restrict,

    actor_name text not null,
    action text not null,

    entity_type text not null,
    entity_id uuid,

    -- Example:
    -- {"status": {"old": "Pending", "new": "Complete"}}
    changes jsonb not null default '{}'::jsonb
        check (jsonb_typeof(changes) = 'object'),

    occurred_at timestamptz not null default now()
);

-- Useful indexes for dashboard queries and activity history.

create index invoices_number_idx
    on public.invoices(invoice_number);

create index invoices_status_created_idx
    on public.invoices(status, created_at desc);

create index invoices_created_idx
    on public.invoices(created_at desc);

create index activity_invoice_time_idx
    on public.activity_logs(invoice_id, occurred_at desc);

create index activity_actor_time_idx
    on public.activity_logs(actor_id, occurred_at desc);

-- Enable RLS before allowing any application access.

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.pre_grn_stages enable row level security;
alter table public.asn_updates enable row level security;
alter table public.activity_logs enable row level security;

-- Start with no direct table access for visitors or signed-in users.
-- The next migration will add controlled reads and audited write functions.

revoke all privileges on table
    public.profiles,
    public.invoices,
    public.pre_grn_stages,
    public.asn_updates,
    public.activity_logs
from public, anon, authenticated;

commit;