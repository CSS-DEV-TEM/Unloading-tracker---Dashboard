import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import {
    ArrowLeft,
    ArrowUpRight,
    CalendarDays,
    ChevronRight,
    FileText,
    Search,
    Truck,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import OverviewRefresh from "@/components/overview-refresh";
import {
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
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-blue-600";

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
        params.notice === "archive"
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
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Vehicle management
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage vehicle records, received dates and invoice
                        assignments.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <OverviewRefresh />
                    {!vehicle && <VehicleEditor />}
                </div>
            </header>

            {notice && (
                <p
                    role="status"
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
                >
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
                    className="overflow-hidden rounded-xl border border-border bg-card"
                >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold">
                                    Vehicle records
                                </h2>

                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                    {total}
                                </span>
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                                View received dates and manage invoices for
                                each vehicle.
                            </p>
                        </div>

                        <nav
                            aria-label="Vehicle status"
                            className="inline-flex rounded-lg border border-border bg-muted/30 p-1"
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
                                        className={`rounded-md px-4 py-2 text-xs font-medium transition-colors ${state === tab
                                                ? "bg-background text-foreground shadow-sm"
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

                    <Form
                        action="/dashboard/vehicles"
                        scroll={false}
                        className="flex flex-wrap items-end gap-3 px-6 py-5"
                    >
                        <input
                            type="hidden"
                            name="state"
                            value={state}
                        />

                        <div className="min-w-[200px] flex-1 sm:max-w-lg">
                            <label
                                htmlFor="vehicle-search"
                                className="mb-2 block text-xs font-medium text-muted-foreground"
                            >
                                Vehicle number
                            </label>

                            <div className="relative">
                                <Search
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                                />

                                <input
                                    id="vehicle-search"
                                    name="q"
                                    key={q}
                                    defaultValue={q}
                                    maxLength={100}
                                    placeholder="Search vehicle number..."
                                    className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            Search
                        </button>

                        {q && (
                            <Link
                                href={link("", 1)}
                                scroll={false}
                                className={secondaryButton}
                            >
                                Clear search
                            </Link>
                        )}
                    </Form>

                    <div className="overflow-x-auto border-t border-border">
                        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                            <caption className="sr-only">
                                Vehicle numbers, received dates and assigned
                                invoice counts
                            </caption>

                            <thead className="bg-muted/40 text-xs text-muted-foreground">
                                <tr>
                                    <th
                                        scope="col"
                                        className="border-b border-border px-6 py-3 font-medium"
                                    >
                                        Vehicle number
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-6 py-3 font-medium"
                                    >
                                        Received date
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-6 py-3 text-center font-medium"
                                    >
                                        Assigned invoices
                                    </th>

                                    <th
                                        scope="col"
                                        className="border-b border-border px-6 py-3 text-right font-medium"
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {(data ?? []).map((row) => {
                                    const dateLabel = formatDate(
                                        row.received_date,
                                    );

                                    const assignedCount =
                                        row.invoices?.[0]?.count ?? 0;

                                    return (
                                        <tr
                                            key={row.id}
                                            className="transition-colors hover:bg-muted/40 [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                                        >
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={link(
                                                        q,
                                                        page,
                                                        row.id,
                                                    )}
                                                    className="inline-flex items-center gap-3 rounded font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"
                                                >
                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                                                        <Truck
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                    </span>

                                                    {row.vehicle_number}
                                                </Link>
                                            </td>

                                            <td className="px-6 py-4">
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

                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex min-w-9 justify-center rounded-md bg-muted/50 px-2.5 py-1 font-medium tabular-nums">
                                                    {assignedCount}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={link(
                                                        q,
                                                        page,
                                                        row.id,
                                                    )}
                                                    className={secondaryButton}
                                                >
                                                    View invoices
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
                            <Truck
                                className="mx-auto mb-4 size-8 text-muted-foreground"
                                aria-hidden="true"
                            />

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

                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
                        <p className="text-xs text-muted-foreground">
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
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg pr-2 text-muted-foreground hover:text-foreground"
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

                        <span className="font-medium">
                            {vehicle.vehicle_number}
                        </span>
                    </nav>

                    <section
                        aria-label={`Vehicle ${vehicle.vehicle_number}`}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-5">
                            <div className="flex items-center gap-4">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                                    <Truck
                                        className="size-6"
                                        aria-hidden="true"
                                    />
                                </span>

                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Vehicle details
                                    </p>

                                    <div className="mt-1 flex flex-wrap items-center gap-3">
                                        <h2 className="text-2xl font-semibold tracking-tight">
                                            {vehicle.vehicle_number}
                                        </h2>

                                        <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
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

                        <dl className="grid gap-5 border-t border-border bg-muted/20 px-6 py-5 sm:grid-cols-2">
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Received date
                                </dt>

                                <dd className="mt-2 flex items-center gap-2 text-sm font-semibold">
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

                                <dd className="mt-2 flex items-center gap-2 text-sm font-semibold">
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
                        className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
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
                                    Invoices linked to{" "}
                                    {vehicle.vehicle_number}.
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
                            <table className="w-full min-w-[800px] border-separate border-spacing-0 text-left text-sm">
                                <caption className="sr-only">
                                    Invoices assigned to{" "}
                                    {vehicle.vehicle_number}
                                </caption>

                                <thead className="bg-muted/40 text-xs text-muted-foreground">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="border-b border-border px-6 py-3 font-medium"
                                        >
                                            Invoice number
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-6 py-3 font-medium"
                                        >
                                            Supplier
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-6 py-3 font-medium"
                                        >
                                            Status
                                        </th>

                                        <th
                                            scope="col"
                                            className="border-b border-border px-6 py-3 text-right font-medium"
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {invoices.map((invoice) => (
                                        <tr
                                            key={`${invoice.id}-${invoice.version}`}
                                            className="transition-colors hover:bg-muted/40 [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                                        >
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/dashboard/invoices/${invoice.id}`}
                                                    className="inline-flex items-center gap-2 rounded font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"
                                                >
                                                    <FileText
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />

                                                    <span className="break-words">
                                                        {invoice.invoice_number}
                                                    </span>
                                                </Link>
                                            </td>

                                            <td className="max-w-md px-6 py-4">
                                                <span className="break-words">
                                                    {invoice.supplier}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${invoice.status ===
                                                            "Complete"
                                                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                                                            : "border-border bg-muted/30 text-muted-foreground"
                                                        }`}
                                                >
                                                    <span
                                                        className="size-1.5 rounded-full bg-current"
                                                        aria-hidden="true"
                                                    />

                                                    {invoice.status}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap items-center justify-end gap-3">
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

                                                    {invoice.status ===
                                                        "Complete" ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            Assignment locked
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
                                <FileText
                                    className="mx-auto mb-4 size-8 text-muted-foreground"
                                    aria-hidden="true"
                                />

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

                        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
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
                <p
                    role="status"
                    className="min-h-screen bg-background p-8 text-sm text-muted-foreground"
                >
                    Loading vehicles…
                </p>
            }
        >
            <Content {...props} />
        </Suspense>
    );
}