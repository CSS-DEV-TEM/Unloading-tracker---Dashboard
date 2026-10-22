import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import {
    ArrowLeft,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    FileText,
    Lock,
    Search,
    Truck,
    X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import OverviewRefresh from "@/components/overview-refresh";
import {
    VehicleNotice,
    AssignDialog,
    RemoveAssignment,
    VehicleEditor,
    VehicleLifecycle,
} from "./vehicle-controls";
import type { InvoiceChoice, VehicleRow } from "./actions";

type Params = {
    q?: string;
    page?: string;
    vehicle?: string;
    invoicePage?: string;
    state?: string;
    notice?: string;
};

const secondaryButton =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-card px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const invoiceStatusStyle: Record<string, string> = {
    Complete:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    Reject:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    Pending:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
};

function pageNumber(value?: string) {
    const number = Number(value || 1);

    return Number.isSafeInteger(number) &&
        number > 0 &&
        number <= 100000
        ? number
        : 1;
}

function url(
    q: string,
    page: number,
    vehicle?: string,
    invoicePage = 1,
    state = "active",
) {
    const params = new URLSearchParams();

    if (state !== "active") params.set("state", state);
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    if (vehicle) params.set("vehicle", vehicle);
    if (invoicePage > 1) {
        params.set("invoicePage", String(invoicePage));
    }

    return `/dashboard/vehicles${params.size ? `?${params}` : ""}`;
}

function formatDate(value: string | null | undefined) {
    if (!value) return null;

    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

async function Content({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    await connection();

    const db = await createClient();

    const {
        data: { user },
    } = await db.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        throw new Error("Unable to load permissions.");
    }

    if (
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        redirect("/dashboard");
    }

    const params = await searchParams;

    const state =
        params.state === "archived" ? "archived" : "active";

    const q =
        typeof params.q === "string"
            ? params.q.trim().slice(0, 100)
            : "";

    const page = pageNumber(params.page);
    const invoicePage = pageNumber(params.invoicePage);

    const selectedId =
        typeof params.vehicle === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                params.vehicle,
            )
            ? params.vehicle
            : undefined;

    const notice =
        params.notice === "saved"
            ? "Vehicle saved successfully."
            : params.notice === "archive"
                ? "Vehicle archived. Existing invoice assignments are preserved."
                : params.notice === "restore"
                    ? "Vehicle restored."
                    : params.notice === "delete"
                        ? "Vehicle deleted. Invoice records are unchanged."
                        : "";

    const link = (
        search: string,
        currentPage: number,
        vehicleId?: string,
        currentInvoicePage = 1,
    ) =>
        url(
            search,
            currentPage,
            vehicleId,
            currentInvoicePage,
            state,
        );

    let query = db
        .from("vehicles")
        .select(
            "id,vehicle_number,version,is_archived,received_date,invoices(count)",
            { count: "exact" },
        )
        .eq("is_archived", state === "archived")
        .order("vehicle_number")
        .order("id");

    if (q) {
        const searchKey = q
            .replace(/[\s-]+/g, "")
            .toUpperCase()
            .replace(/[\\%_]/g, "\\$&");

        query = query.ilike("number_key", `%${searchKey}%`);
    }

    const { data, count, error } = await query.range(
        (page - 1) * 20,
        page * 20 - 1,
    );

    if (error) {
        throw new Error("Unable to load vehicles.");
    }

    const total = count ?? 0;
    const pages = Math.max(1, Math.ceil(total / 20));

    if (page > pages) {
        redirect(link(q, pages, selectedId, invoicePage));
    }

    let vehicle: VehicleRow | null = null;
    let invoices: InvoiceChoice[] = [];
    let invoiceCount = 0;

    if (selectedId) {
        const result = await db
            .from("vehicles")
            .select(
                "id,vehicle_number,version,is_archived,received_date",
            )
            .eq("id", selectedId)
            .maybeSingle();

        if (result.error) {
            throw new Error("Unable to load vehicle.");
        }

        vehicle = result.data;

        if (vehicle) {
            const assigned = await db
                .from("invoices")
                .select(
                    "id,invoice_number,supplier,vehicle_number,vehicle_id,version,status",
                    { count: "exact" },
                )
                .eq("vehicle_id", vehicle.id)
                .order("created_at", { ascending: false })
                .order("id")
                .range(
                    (invoicePage - 1) * 20,
                    invoicePage * 20 - 1,
                );

            if (assigned.error) {
                throw new Error("Unable to load assigned invoices.");
            }

            invoices = assigned.data ?? [];
            invoiceCount = assigned.count ?? 0;

            const lastInvoicePage = Math.max(
                1,
                Math.ceil(invoiceCount / 20),
            );

            if (invoicePage > lastInvoicePage) {
                redirect(
                    link(q, page, vehicle.id, lastInvoicePage),
                );
            }
        }
    }

    const invoicePages = Math.max(
        1,
        Math.ceil(invoiceCount / 20),
    );

    const receivedDateLabel = formatDate(vehicle?.received_date);

    return (
        <main className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 text-foreground sm:px-6">
            <header className="dock-rise flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
                <div className="flex items-start gap-3.5">
                    <span
                        aria-hidden="true"
                        className="mt-1 h-8 w-1 shrink-0 rounded-full bg-signal"
                    />

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            Vehicle management
                        </h1>

                        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {vehicle
                                ? "Review this vehicle, then assign or remove the invoices it carried."
                                : "Find a vehicle, then open it to assign or remove invoices."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <OverviewRefresh />
                    {!vehicle && <VehicleEditor />}
                </div>
            </header>

            <VehicleNotice />

            {notice && (
                <p
                    role="status"
                    className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                    <CheckCircle2
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {notice}
                </p>
            )}

            {selectedId && !vehicle && (
                <p
                    role="status"
                    className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
                >
                    Vehicle not found. Select another vehicle from the list.
                </p>
            )}

            {!vehicle ? (
                <section
                    aria-label="Vehicle records"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                        <Form
                            action="/dashboard/vehicles"
                            scroll={false}
                            role="search"
                            className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:max-w-xl"
                        >
                            <input
                                type="hidden"
                                name="state"
                                value={state}
                            />

                            <label
                                htmlFor="vehicle-search"
                                className="sr-only"
                            >
                                Search by vehicle number
                            </label>

                            <div className="relative min-w-[160px] flex-1">
                                <Search
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />

                                <input
                                    id="vehicle-search"
                                    name="q"
                                    key={q}
                                    defaultValue={q}
                                    maxLength={100}
                                    placeholder="Search by vehicle number, e.g. KP-10101"
                                    className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
                                />
                            </div>

                            <button
                                type="submit"
                                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                            >
                                Search
                            </button>

                            {q && (
                                <Link
                                    href={link("", 1)}
                                    scroll={false}
                                    className={secondaryButton}
                                >
                                    <X
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Clear
                                </Link>
                            )}
                        </Form>

                        <nav
                            aria-label="Vehicle status"
                            className="inline-flex rounded-md border border-border bg-muted/50 p-1"
                        >
                            {(["active", "archived"] as const).map(
                                (tab) => (
                                    <Link
                                        key={tab}
                                        href={url(
                                            q,
                                            1,
                                            undefined,
                                            1,
                                            tab,
                                        )}
                                        scroll={false}
                                        aria-current={
                                            state === tab
                                                ? "page"
                                                : undefined
                                        }
                                        className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${state === tab
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        {tab === "active"
                                            ? "Active"
                                            : "Archived"}
                                    </Link>
                                ),
                            )}
                        </nav>
                    </div>

                    <div className="overflow-x-auto">
                        <table role="table" className="block w-full text-left text-sm md:table md:min-w-[720px] md:border-separate md:border-spacing-0">
                            <caption className="sr-only">
                                Vehicle numbers, received dates and assigned
                                invoice counts
                            </caption>

                            <thead role="rowgroup" className="sr-only bg-muted/60 text-xs text-muted-foreground md:not-sr-only md:table-header-group">
                                <tr>
                                    <th
                                        scope="col"
                                        className="border-b border-border px-5 py-3 text-xs font-semibold"
                                    >
                                        Vehicle number
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-5 py-3 text-xs font-semibold"
                                    >
                                        Received date
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-5 py-3 text-center text-xs font-semibold"
                                    >
                                        Assigned invoices
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-5 py-3 text-right text-xs font-semibold"
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody role="rowgroup" className="block space-y-3 bg-muted/20 p-3 md:table-row-group md:space-y-0 md:bg-transparent md:p-0">
                                {(data ?? []).map((row) => {
                                    const dateLabel = formatDate(
                                        row.received_date,
                                    );

                                    const assignedCount =
                                        row.invoices?.[0]?.count ?? 0;

                                    return (
                                        <tr role="row"
                                            key={row.id}
                                            className="block rounded-lg border border-border bg-card p-2 transition-colors hover:bg-primary/[0.04] md:table-row md:rounded-none md:border-0 md:p-0 md:[&>td]:border-b md:[&>td]:border-border md:last:[&>td]:border-b-0"
                                        >
                                            <td role="cell" className="block px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Vehicle number</span>
                                                <Link
                                                    href={link(
                                                        q,
                                                        page,
                                                        row.id,
                                                    )}
                                                    className="inline-flex items-center gap-3 rounded font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"
                                                >
                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                                        <Truck
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                    </span>

                                                    {row.vehicle_number}
                                                </Link>
                                            </td>

                                            <td role="cell" className="block px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Received date</span>
                                                {dateLabel ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <CalendarDays
                                                            className="size-4 text-muted-foreground"
                                                            aria-hidden="true"
                                                        />

                                                        <time
                                                            dateTime={
                                                                row.received_date?.slice(
                                                                    0,
                                                                    10,
                                                                )
                                                            }
                                                            className="whitespace-nowrap tabular-nums"
                                                        >
                                                            {dateLabel}
                                                        </time>
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Not set
                                                    </span>
                                                )}
                                            </td>

                                            <td role="cell" className="block px-5 py-3.5 md:text-center md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Assigned invoices</span>
                                                <span
                                                    className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums ${assignedCount > 0
                                                        ? "bg-primary/10 text-primary"
                                                        : "bg-muted text-muted-foreground"
                                                        }`}
                                                >
                                                    {assignedCount > 0
                                                        ? `${assignedCount} ${assignedCount === 1 ? "invoice" : "invoices"}`
                                                        : "No invoices"}
                                                </span>
                                            </td>

                                            <td role="cell" className="block px-5 py-3.5 md:text-right md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Actions</span>
                                                <Link
                                                    href={link(
                                                        q,
                                                        page,
                                                        row.id,
                                                    )}
                                                    className={secondaryButton}
                                                >
                                                    Open
                                                    <ChevronRight
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="sr-only">
                                                        {" "}for{" "}
                                                        {row.vehicle_number}
                                                    </span>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {!data?.length && (
                        <div className="px-6 py-16 text-center">
                            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Truck
                                    className="size-6"
                                    aria-hidden="true"
                                />
                            </span>

                            <p className="font-semibold">
                                {q
                                    ? "No matching vehicles"
                                    : state === "archived"
                                        ? "No archived vehicles"
                                        : "No vehicles added yet"}
                            </p>

                            <p className="mt-2 text-sm text-muted-foreground">
                                {q
                                    ? "Try another vehicle number or clear your search."
                                    : state === "archived"
                                        ? "Vehicles you archive will appear here."
                                        : "Use Add vehicle to create your first record."}
                            </p>
                        </div>
                    )}

                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/30 px-5 py-3.5">
                        <p className="text-sm text-muted-foreground">
                            {total > 0
                                ? `Showing ${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total} vehicles`
                                : "0 vehicles"}
                        </p>

                        <div className="flex items-center gap-3">
                            {page > 1 && (
                                <Link
                                    href={link(q, page - 1)}
                                    scroll={false}
                                    className={secondaryButton}
                                >
                                    Previous
                                </Link>
                            )}

                            <span className="text-xs tabular-nums text-muted-foreground">
                                Page {page} of {pages}
                            </span>

                            {page < pages && (
                                <Link
                                    href={link(q, page + 1)}
                                    scroll={false}
                                    className={secondaryButton}
                                >
                                    Next
                                </Link>
                            )}
                        </div>
                    </footer>
                </section>
            ) : (
                <div className="space-y-5">
                    <nav
                        aria-label="Breadcrumb"
                        className="flex flex-wrap items-center gap-2 text-sm"
                    >
                        <Link
                            href={link(q, page)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-md pr-2 font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft
                                className="size-4"
                                aria-hidden="true"
                            />
                            Back to vehicles
                        </Link>

                        <ChevronRight
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                        />

                        <span className="font-semibold">
                            {vehicle.vehicle_number}
                        </span>
                    </nav>

                    <section
                        aria-label={`Vehicle ${vehicle.vehicle_number}`}
                        className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5">
                            <div className="flex min-w-0 max-w-full items-center gap-4">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                    <Truck
                                        className="size-6"
                                        aria-hidden="true"
                                    />
                                </span>

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                                            {vehicle.vehicle_number}
                                        </h2>

                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${vehicle.is_archived
                                                ? "border-border bg-muted text-muted-foreground"
                                                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                }`}
                                        >
                                            {vehicle.is_archived
                                                ? "Archived"
                                                : "Active"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {profile.role === "ADMIN" && (
                                    <VehicleEditor
                                        key={`edit-${vehicle.id}-${vehicle.version}`}
                                        vehicle={vehicle}
                                    />
                                )}

                                {profile.role === "ADMIN" && (
                                    <VehicleLifecycle
                                        key={`lifecycle-${vehicle.id}-${vehicle.version}`}
                                        vehicle={vehicle}
                                        invoiceCount={invoiceCount}
                                    />
                                )}
                            </div>
                        </div>

                        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2 [&>div]:bg-muted/30 [&>div]:px-5 [&>div]:py-4">
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Received date
                                </dt>

                                <dd className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                                    <CalendarDays
                                        className="size-4 text-muted-foreground"
                                        aria-hidden="true"
                                    />

                                    {receivedDateLabel ? (
                                        <time
                                            dateTime={
                                                vehicle.received_date?.slice(
                                                    0,
                                                    10,
                                                )
                                            }
                                        >
                                            {receivedDateLabel}
                                        </time>
                                    ) : (
                                        <span className="font-normal text-muted-foreground">
                                            Not set
                                        </span>
                                    )}
                                </dd>
                            </div>

                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Assigned invoices
                                </dt>

                                <dd className="mt-1.5 flex items-center gap-2 text-lg font-semibold">
                                    <FileText
                                        className="size-4 text-muted-foreground"
                                        aria-hidden="true"
                                    />

                                    <span className="tabular-nums">
                                        {invoiceCount}
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section
                        id="vehicle-invoices"
                        aria-label="Assigned invoices"
                        className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-semibold">
                                        Assigned invoices
                                    </h2>

                                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                        {invoiceCount}
                                    </span>
                                </div>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    {vehicle.is_archived
                                        ? `Invoices linked to ${vehicle.vehicle_number}. Restore the vehicle to change assignments.`
                                        : `Invoices linked to ${vehicle.vehicle_number}. Completed invoices are locked; others can be unassigned.`}
                                </p>
                            </div>

                            {!vehicle.is_archived && (
                                <AssignDialog
                                    key={`assign-${vehicle.id}`}
                                    vehicle={vehicle}
                                />
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table role="table" className="block w-full text-left text-sm md:table md:min-w-[800px] md:border-separate md:border-spacing-0">
                                <caption className="sr-only">
                                    Invoices assigned to{" "}
                                    {vehicle.vehicle_number}
                                </caption>

                                <thead role="rowgroup" className="sr-only bg-muted/60 text-xs text-muted-foreground md:not-sr-only md:table-header-group">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="border-b border-border px-5 py-3 text-xs font-semibold"
                                        >
                                            Invoice number
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-5 py-3 text-xs font-semibold"
                                        >
                                            Supplier
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-5 py-3 text-xs font-semibold"
                                        >
                                            Status
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-5 py-3 text-right text-xs font-semibold"
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody role="rowgroup" className="block space-y-3 bg-muted/20 p-3 md:table-row-group md:space-y-0 md:bg-transparent md:p-0">
                                    {invoices.map((invoice) => (
                                        <tr role="row"
                                            key={`${invoice.id}-${invoice.version}`}
                                            className="block rounded-lg border border-border bg-card p-2 transition-colors hover:bg-primary/[0.04] md:table-row md:rounded-none md:border-0 md:p-0 md:[&>td]:border-b md:[&>td]:border-border md:last:[&>td]:border-b-0"
                                        >
                                            <td role="cell" className="block px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Invoice number</span>
                                                <Link
                                                    href={`/dashboard/invoices/${invoice.id}`}
                                                    className="inline-flex items-center gap-2 rounded font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"
                                                >
                                                    <FileText
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />

                                                    <span className="ref break-words">
                                                        {invoice.invoice_number}
                                                    </span>
                                                </Link>
                                            </td>

                                            <td role="cell" className="block max-w-md px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Supplier</span>
                                                <span className="break-words">
                                                    {invoice.supplier}
                                                </span>
                                            </td>

                                            <td role="cell" className="block px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Status</span>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${invoiceStatusStyle[invoice.status] ?? invoiceStatusStyle.Pending}`}
                                                >
                                                    {invoice.status}
                                                </span>
                                            </td>

                                            <td role="cell" className="block px-5 py-3.5 md:table-cell"><span aria-hidden="true" className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">Actions</span>
                                                <div className="flex flex-wrap items-center justify-start gap-3 md:justify-end">
                                                    <Link
                                                        href={`/dashboard/invoices/${invoice.id}`}
                                                        className={secondaryButton}
                                                    >
                                                        Open
                                                        <ArrowUpRight
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        <span className="sr-only">
                                                            {" "}invoice{" "}
                                                            {invoice.invoice_number}
                                                        </span>
                                                    </Link>

                                                    {(vehicle.is_archived || invoice.status ===
                                                        "Complete") ? (
                                                        <span
                                                            title={vehicle.is_archived ? "Restore this vehicle before changing assignments" : "Completed invoices cannot be unassigned"}
                                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                                                        >
                                                            <Lock
                                                                className="size-3.5"
                                                                aria-hidden="true"
                                                            />
                                                            {vehicle.is_archived ? "Restore vehicle first" : "Locked"}
                                                        </span>
                                                    ) : (
                                                        <RemoveAssignment
                                                            invoice={invoice}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {!invoices.length && (
                            <div className="px-6 py-16 text-center">
                                <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                    <FileText
                                        className="size-6"
                                        aria-hidden="true"
                                    />
                                </span>

                                <p className="font-semibold">
                                    No invoices assigned
                                </p>

                                <p className="mt-2 text-sm text-muted-foreground">
                                    {vehicle.is_archived
                                        ? "Restore this vehicle before assigning invoices."
                                        : "Use Assign invoices to link existing invoices to this vehicle."}
                                </p>
                            </div>
                        )}

                        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/30 px-5 py-3.5">
                            <p className="text-xs text-muted-foreground">
                                {invoiceCount > 0
                                    ? `Showing ${(invoicePage - 1) * 20 + 1}–${Math.min(invoicePage * 20, invoiceCount)} of ${invoiceCount} invoices`
                                    : "0 invoices"}
                            </p>

                            <div className="flex items-center gap-3">
                                {invoicePage > 1 && (
                                    <Link
                                        href={link(
                                            q,
                                            page,
                                            vehicle.id,
                                            invoicePage - 1,
                                        )}
                                        scroll={false}
                                        className={secondaryButton}
                                    >
                                        Previous
                                    </Link>
                                )}

                                <span className="text-xs tabular-nums text-muted-foreground">
                                    Page {invoicePage} of {invoicePages}
                                </span>

                                {invoicePage < invoicePages && (
                                    <Link
                                        href={link(
                                            q,
                                            page,
                                            vehicle.id,
                                            invoicePage + 1,
                                        )}
                                        scroll={false}
                                        className={secondaryButton}
                                    >
                                        Next
                                    </Link>
                                )}
                            </div>
                        </footer>
                    </section>
                </div>
            )}
        </main>
    );
}

export default function VehiclePage(props: {
    searchParams: Promise<Params>;
}) {
    return (
        <Suspense
            fallback={
                <div role="status" aria-label="Loading vehicles" className="mx-auto max-w-[1600px] space-y-5 p-6">
                    <span className="sr-only">Loading vehicles…</span>
                    <div aria-hidden="true" className="space-y-5 animate-pulse motion-reduce:animate-none">
                        <div className="h-9 w-56 rounded bg-muted" />
                        <div className="h-14 rounded-lg bg-muted" />
                        {[1, 2, 3, 4].map(item => <div key={item} className="h-20 rounded-lg border border-border bg-muted/60" />)}
                    </div>
                </div>
            }
        >
            <Content {...props} />
        </Suspense>
    );
}