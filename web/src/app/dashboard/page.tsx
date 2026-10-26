import QuickProgressCell from "./quick-progress-cell";
import PendingReasonDialog from "@/components/pending-reason-dialog";
import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import InvoiceSummary from "./invoice-summary";
import ExportButton from "./export-button";
import OverviewRefresh from "@/components/overview-refresh";
import VehicleLabel from "@/components/vehicle-label";

type SearchParams = Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
}>;

type Invoice = {
    id: string;
    version: number;
    asn_updates: { is_shared: boolean; share_at: string | null } | { is_shared: boolean; share_at: string | null }[] | null;
    invoice_number: string;
    vehicle_number: string | null;
    vehicle: {
        received_date: string | null;
    } | null;
    supplier: string;
    system_type: string;
    shipment_type: string;
    document_share_date: string;
    roll_quantity: number | null;
    meter_quantity: number | null;
    status: "Pending" | "Complete" | "Reject";
    pending_reason: string | null;
    completed_at: string | null;
    pre_grn_stages: {
        system_name: "AX" | "D365";
        is_done: boolean;
        started_at: string | null;
    }[];
};

const PAGE_SIZE = 20;

const HEADINGS = [
    "Invoice",
    "Supplier",
    "System",
    "Local / Import",
    "Document Date",
    "Roll Qty",
    "Start Date",
    "Completion Date",
    "Status",
    "Progress",
];

const statusStyles = {
    Pending:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    Complete:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    Reject:
        "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : "";
}

function formatDate(value: string | null) {
    if (!value) return "—";

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}


function earliestStart(stages: Invoice["pre_grn_stages"]) {
    let earliest: string | null = null;
    let earliestTime = Infinity;

    for (const stage of stages) {
        if (!stage.started_at) continue;

        const timestamp = new Date(stage.started_at).getTime();

        if (Number.isFinite(timestamp) && timestamp < earliestTime) {
            earliest = stage.started_at;
            earliestTime = timestamp;
        }
    }

    return earliest;
}

function DateTimeCell({ value }: { value: string | null }) {
    if (!value) {
        return <span className="text-muted-foreground">—</span>;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return <span className="text-muted-foreground">—</span>;
    }

    const dateLabel = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);

    const timeLabel = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).format(date);

    return (
        <time
            dateTime={date.toISOString()}
            title={`${dateLabel}, ${timeLabel} — Sri Lanka time`}
            className="inline-flex flex-col gap-1 whitespace-nowrap"
        >
            <span className="text-foreground">{dateLabel}</span>
            <span className="text-xs text-muted-foreground">
                {timeLabel} · SLST
            </span>
        </time>
    );
}

function dashboardUrl(q: string, status: string, page: number) {
    const params = new URLSearchParams();

    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));

    const query = params.toString();

    return query ? `/dashboard?${query}` : "/dashboard";
}

async function DashboardContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        profileError ||
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        return (
            <main className="mx-auto max-w-lg px-6 py-16">
                <h1 className="text-2xl font-semibold">
                    Dashboard access unavailable
                </h1>

                <p className="mt-3 text-muted-foreground">
                    Your account access could not be verified.
                    Contact an administrator.
                </p>

                <form action={signOut} className="mt-6">
                    <button className="rounded-lg bg-blue-700 px-4 py-2 text-white">
                        Sign Out
                    </button>
                </form>
            </main>
        );
    }

    const params = await searchParams;
    const q = single(params.q).trim().slice(0, 100);
    const requestedStatus = single(params.status);

    const status = ["Pending", "Complete", "Reject"].includes(requestedStatus)
        ? requestedStatus
        : "";

    const requestedPage = Number(single(params.page) || "1");

    const page =
        Number.isSafeInteger(requestedPage) &&
            requestedPage > 0 &&
            requestedPage <= 100000
            ? requestedPage
            : 1;

    let query = supabase.from("invoices").select(
        `
            id,
            version,
            asn_updates (is_shared, share_at),
            invoice_number,
            vehicle_number,
            vehicle:vehicles!invoices_vehicle_id_fkey (
                received_date
            ),
            supplier,
            system_type,
            shipment_type,
            document_share_date,
            roll_quantity,
            meter_quantity,
            status,
            pending_reason,
            completed_at,
            pre_grn_stages (
                system_name,
                is_done,
                started_at
            )
        `,
        { count: "exact" },
    );

    if (status) {
        query = query.eq("status", status);
    }

    if (q) {
        const escaped = q.replace(/[\\%_*]/g, "\\$&");
        const pattern = JSON.stringify(`%${escaped}%`);

        query = query.or(
            `invoice_number.ilike.${pattern},supplier.ilike.${pattern},vehicle_number.ilike.${pattern}`,
        );
    }

    const from = (page - 1) * PAGE_SIZE;

    const { data, count, error: invoiceError } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

    const invoices = (data ?? []).map((row) => ({
        ...row,
        vehicle: Array.isArray(row.vehicle)
            ? row.vehicle[0] ?? null
            : row.vehicle ?? null,
    })) as Invoice[];

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (!invoiceError && page > totalPages) {
        redirect(dashboardUrl(q, status, totalPages));
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-5 sm:px-6">
                <section className="flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Unloading tracker dashboard
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Track and update your team’s invoice processing.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-start gap-3">
                        {profile.role === "ADMIN" && <ExportButton />}

                        <Link
                            href="/dashboard/invoices/new"
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            New Invoice
                        </Link>
                    </div>
                </section>

                <InvoiceSummary />
                <OverviewRefresh />

                <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                    <div className="border-b border-border px-6 py-5">
                        <h2 className="font-semibold">Invoice records</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Search by invoice number, supplier or vehicle number.
                        </p>

                        <details className="mt-2 text-xs text-muted-foreground">
                            <summary className="w-fit cursor-pointer rounded hover:text-foreground">
                                About dates · Sri Lanka time
                            </summary>
                            <p className="mt-2 max-w-2xl leading-5">
                                Start Date shows the earliest AX/D365 start.
                                Completion Date shows when the invoice was
                                marked Complete. All times are in Sri Lanka time.
                            </p>
                        </details>
                    </div>

                    <Form
                        action="/dashboard"
                        scroll={false}
                        className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end"
                    >
                        <div className="flex-1">
                            <label
                                htmlFor="search"
                                className="mb-2 block text-xs font-medium text-muted-foreground"
                            >
                                Invoice / Supplier / Vehicle
                            </label>

                            <div className="relative">
                                <Search
                                    className="absolute left-3 top-3 size-4 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <input
                                    key={`search-${q}`}
                                    id="search"
                                    name="q"
                                    type="search"
                                    defaultValue={q}
                                    maxLength={100}
                                    placeholder="Search invoice, supplier or vehicle number"
                                    className="h-10 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25"
                                />
                            </div>
                        </div>

                        <div className="sm:w-44">
                            <label
                                htmlFor="status"
                                className="mb-2 block text-xs font-medium text-muted-foreground"
                            >
                                Status
                            </label>
                            <select
                                key={`status-${status}`}
                                id="status"
                                name="status"
                                defaultValue={status}
                                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                            >
                                <option value="">All statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Complete">Complete</option>
                                <option value="Reject">Reject</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            Apply
                        </button>

                        <Link
                            href="/dashboard"
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-input px-4 text-sm hover:bg-muted"
                        >
                            Reset
                        </Link>
                    </Form>

                    {invoiceError ? (
                        <div
                            role="alert"
                            className="mx-6 mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        >
                            Unable to load invoices. Refresh the page and try again.
                        </div>
                    ) : (
                        <>
                            <div
                                role="region"
                                aria-label="Invoice records — scroll to view more rows and columns"
                                tabIndex={0}
                                className="relative isolate max-h-[65vh] overflow-auto scroll-pt-14 scroll-pl-44 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                                <table className="w-full min-w-[1300px] border-separate border-spacing-0 text-left text-sm">
                                    <caption className="sr-only">
                                        Invoice records with quantities, start and
                                        completion dates in Sri Lanka time.
                                    </caption>

                                    <thead className="text-xs text-muted-foreground">
                                        <tr>
                                            {HEADINGS.map((heading, index) => (
                                                <th
                                                    key={heading}
                                                    scope="col"
                                                    className={[
                                                        "sticky top-0 whitespace-nowrap border-b border-border bg-background px-4 py-3 font-medium",
                                                        index === 0
                                                            ? "left-0 z-30 w-44 min-w-44 border-r"
                                                            : "z-20",
                                                    ].join(" ")}
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody className="[&>tr:not(:last-child)>td]:border-b [&>tr:not(:last-child)>th]:border-b [&>tr>td]:border-border [&>tr>th]:border-border">
                                        {invoices.map((invoice) => (
                                            <tr
                                                key={invoice.id}
                                                className="group hover:bg-muted focus-within:bg-muted"
                                            >
                                                <th
                                                    scope="row"
                                                    className="sticky left-0 z-10 w-44 min-w-44 max-w-44 border-r border-border bg-card px-4 py-3 font-semibold text-blue-700 group-hover:bg-muted group-focus-within:bg-muted dark:text-blue-400 [overflow-wrap:anywhere]"
                                                >
                                                    <div className="flex flex-col items-start gap-1">
                                                        <Link
                                                            href={`/dashboard/invoices/${invoice.id}`}
                                                            className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                                                        >
                                                            {invoice.invoice_number}
                                                        </Link>

                                                        <VehicleLabel
                                                            value={invoice.vehicle_number}
                                                            receivedDate={invoice.vehicle?.received_date}
                                                        />
                                                    </div>
                                                </th>

                                                <td className="px-4 py-3">
                                                    {invoice.supplier}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {invoice.system_type}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {invoice.shipment_type}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {formatDate(invoice.document_share_date)}
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums">
                                                    {invoice.roll_quantity == null ? "—" : Number(invoice.roll_quantity).toLocaleString("en-GB")}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <DateTimeCell
                                                        value={earliestStart(
                                                            invoice.pre_grn_stages ?? [],
                                                        )}
                                                    />
                                                </td>

                                                <td className="px-4 py-3">
                                                    <DateTimeCell
                                                        value={
                                                            (Array.isArray(invoice.asn_updates)
                                                                ? invoice.asn_updates[0]?.share_at
                                                                : invoice.asn_updates?.share_at) ?? null
                                                        }
                                                    />
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${statusStyles[invoice.status]}`}
                                                    >
                                                        {invoice.status}
                                                    </span>
                                                    {invoice.status === "Pending" && invoice.pending_reason?.trim() && (
                                                        <div>
                                                            <PendingReasonDialog
                                                                invoiceNumber={invoice.invoice_number}
                                                                supplier={invoice.supplier}
                                                                reason={invoice.pending_reason.trim()}
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <QuickProgressCell
                                                        key={`${invoice.id}-${invoice.version}`}
                                                        invoiceId={invoice.id}
                                                        invoiceNumber={invoice.invoice_number}
                                                        initial={{
                                                            version: invoice.version,
                                                            status: invoice.status,
                                                            asn_shared: (Array.isArray(invoice.asn_updates)
                                                                ? invoice.asn_updates[0]?.is_shared
                                                                : invoice.asn_updates?.is_shared) ?? false,
                                                            stages: invoice.pre_grn_stages ?? [],
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}

                                        {invoices.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={HEADINGS.length}
                                                    className="px-6 py-14 text-center text-muted-foreground"
                                                >
                                                    {q || status
                                                        ? "No invoices match these filters."
                                                        : "No invoices yet. Create your first invoice to begin."}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
                                <p className="text-xs text-muted-foreground">
                                    Showing {total === 0 ? 0 : from + 1}–
                                    {Math.min(from + invoices.length, total)}
                                    {" "}of {total} invoices
                                </p>

                                <nav
                                    aria-label="Invoice pagination"
                                    className="flex items-center gap-3 text-sm"
                                >
                                    {page > 1 && (
                                        <Link
                                            href={dashboardUrl(q, status, page - 1)}
                                            className="rounded-lg border border-input px-3 py-2 hover:bg-muted"
                                        >
                                            Previous
                                        </Link>
                                    )}

                                    <span className="text-xs text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </span>

                                    {page < totalPages && (
                                        <Link
                                            href={dashboardUrl(q, status, page + 1)}
                                            className="rounded-lg border border-input px-3 py-2 hover:bg-muted"
                                        >
                                            Next
                                        </Link>
                                    )}
                                </nav>
                            </div>
                        </>
                    )}
                </section>

                <footer className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
                    <p>EFL · 3PL — CSS Division</p>
                    <Link
                        href="/"
                        className="text-blue-700 hover:underline dark:text-blue-400"
                    >
                        View public overview →
                    </Link>
                </footer>
            </main>
        </div>
    );
}

export default function DashboardPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    return (
        <Suspense
            fallback={
                <p className="min-h-screen bg-background p-10" role="status">
                    Loading invoices…
                </p>
            }
        >
            <DashboardContent searchParams={searchParams} />
        </Suspense>
    );
}