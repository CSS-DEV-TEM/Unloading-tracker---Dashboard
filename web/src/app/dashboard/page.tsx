import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PackageOpen, Plus, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import InvoiceSummary from "./invoice-summary";
import ExportButton from "./export-button";
import OverviewRefresh from "@/components/overview-refresh";

type SearchParams = Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
}>;

type Invoice = {
    id: string;
    invoice_number: string;
    supplier: string;
    system_type: string;
    shipment_type: string;
    document_share_date: string;
    roll_quantity: number | null;
    status: "Pending" | "Complete" | "Reject";
    remark: string | null;
    completed_at: string | null;
    pre_grn_stages: {
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
    "Remark",
];

const statusStyles = {
    Pending: "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
    Complete: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
    Reject: "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300",
};

function single(value: string | string[] | undefined) {
    return typeof value === "string" ? value : "";
}

function formatDate(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
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
        return <span className="text-slate-400">—</span>;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return <span className="text-slate-400">—</span>;
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
            <span className="text-foreground dark:text-slate-200">{dateLabel}</span>
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

                <p className="mt-3 text-muted-foreground dark:text-slate-300">
                    Your account access could not be verified. Contact an
                    administrator.
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

    const status = ["Pending", "Complete", "Reject"].includes(
        requestedStatus,
    )
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
      invoice_number,
      supplier,
      system_type,
      shipment_type,
      document_share_date,
      roll_quantity,
      status,
      remark,
      completed_at,
      pre_grn_stages (
        started_at
      )
    `,
        { count: "exact" },
    );

    if (status) {
        query = query.eq("status", status);
    }

    if (q) {
        // Escape wildcard characters and quote the PostgREST filter value.
        const escaped = q.replace(/[\\%_*]/g, "\\$&");
        const pattern = JSON.stringify(`%${escaped}%`);

        query = query.or(
            `invoice_number.ilike.${pattern},supplier.ilike.${pattern}`,
        );
    }

    const from = (page - 1) * PAGE_SIZE;

    const { data, count, error: invoiceError } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

    const invoices = (data ?? []) as Invoice[];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (!invoiceError && page > totalPages) {
        redirect(dashboardUrl(q, status, totalPages));
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
                            <PackageOpen className="size-6" aria-hidden="true" />
                        </div>

                        <div>
                            <p className="text-sm font-bold">EFL · 3PL</p>
                            <p className="text-xs text-muted-foreground">
                                Unloading Tracker Dashboard
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-medium">
                                {profile.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {profile.role === "ADMIN"
                                    ? "Administrator"
                                    : "Team member"}
                            </p>
                        </div>

                        <ThemeToggle />

                        <Link
                            href="/dashboard/settings"
                            className="inline-flex items-center justify-center rounded-xl border border-input bg-card px-4 py-2 text-sm font-medium text-foreground dark:text-slate-200 hover:bg-muted"
                        >
                            Account Settings
                        </Link>

                        <form action={signOut}>
                            <button className="rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted">
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8">
                <section className="flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <p className="text-xs font-semibold tracking-widest text-blue-700 dark:text-blue-400">
                            OPERATIONS WORKSPACE
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                            Invoice dashboard
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            View invoices created by everyone on your team.
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

                <section className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="border-b border-border px-6 py-5">
                        <h2 className="font-semibold">Invoice records</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Search by invoice number or supplier.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Start Date shows the earliest AX/D365 start.
                            Completion Date shows when the invoice was marked
                            Complete. All times are in Sri Lanka time.
                        </p>
                    </div>

                    <form
                        action="/dashboard"
                        method="get"
                        className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end"
                    >
                        <div className="flex-1">
                            <label
                                htmlFor="search"
                                className="mb-2 block text-xs font-medium text-muted-foreground dark:text-slate-300"
                            >
                                Invoice / Supplier
                            </label>

                            <div className="relative">
                                <Search
                                    className="absolute left-3 top-3 size-4 text-slate-400"
                                    aria-hidden="true"
                                />
                                <input
                                    key={`search-${q}`}
                                    id="search"
                                    name="q"
                                    type="search"
                                    defaultValue={q}
                                    maxLength={100}
                                    placeholder="Search invoices..."
                                    className="h-10 w-full rounded-lg border border-input pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-ring/25"
                                />
                            </div>
                        </div>

                        <div className="sm:w-44">
                            <label
                                htmlFor="status"
                                className="mb-2 block text-xs font-medium text-muted-foreground dark:text-slate-300"
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
                    </form>

                    {invoiceError ? (
                        <div
                            role="alert"
                            className="mx-6 mb-6 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400"
                        >
                            Unable to load invoices. Refresh the page and try again.
                        </div>
                    ) : (
                        <>
                            <div
                                role="region"
                                aria-label="Invoice records"
                                tabIndex={0}
                                className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600"
                            >
                                <table className="w-full min-w-[1300px] text-left text-sm">
                                    <caption className="sr-only">
                                        Invoice records with start and completion dates
                                        in Sri Lanka time
                                    </caption>

                                    <thead className="border-y border-border bg-background text-xs text-muted-foreground">
                                        <tr>
                                            {HEADINGS.map((heading) => (
                                                <th
                                                    key={heading}
                                                    scope="col"
                                                    className="whitespace-nowrap px-5 py-3.5 font-medium"
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-border">
                                        {invoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-muted">
                                                <th
                                                    scope="row"
                                                    className="px-5 py-4 font-semibold text-blue-700 dark:text-blue-400"
                                                >
                                                    <div className="flex flex-col items-start gap-2">
                                                        <Link
                                                            href={`/dashboard/invoices/${invoice.id}`}
                                                            className="inline-flex flex-col gap-1 rounded focus-visible:outline-2 focus-visible:outline-blue-600"
                                                        >
                                                            <span className="hover:underline">
                                                                {invoice.invoice_number}
                                                            </span>

                                                            <span className="text-xs font-normal text-muted-foreground">
                                                                Open / Update →
                                                            </span>
                                                        </Link>

                                                        <Link
                                                            href={`/dashboard/invoices/${invoice.id}/details`}
                                                            className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                                                        >
                                                            Edit details
                                                        </Link>
                                                    </div>
                                                </th>

                                                <td className="px-5 py-4">
                                                    {invoice.supplier}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {invoice.system_type}
                                                </td>

                                                <td className="px-5 py-4">
                                                    {invoice.shipment_type}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {formatDate(invoice.document_share_date)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    {invoice.roll_quantity ?? "—"}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <DateTimeCell
                                                        value={earliestStart(
                                                            invoice.pre_grn_stages ?? [],
                                                        )}
                                                    />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <DateTimeCell
                                                        value={
                                                            invoice.status === "Complete"
                                                                ? invoice.completed_at
                                                                : null
                                                        }
                                                    />
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[invoice.status]}`}
                                                    >
                                                        {invoice.status}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    {invoice.remark?.trim() ? (
                                                        <details className="min-w-40 max-w-64 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-2 text-blue-900 dark:text-blue-200">
                                                            <summary className="cursor-pointer text-xs font-semibold">
                                                                View remark
                                                            </summary>
                                                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">
                                                                {invoice.remark}
                                                            </p>
                                                        </details>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
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
                                    {Math.min(from + invoices.length, total)} of {total} invoices
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
                    <Link href="/" className="text-blue-700 dark:text-blue-400 hover:underline">
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
                    Loading invoices...
                </p>
            }
        >
            <DashboardContent searchParams={searchParams} />
        </Suspense>
    );
}