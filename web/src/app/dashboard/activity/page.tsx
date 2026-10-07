import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
    invoice?: string | string[];
    page?: string | string[];
};

type PageProps = {
    searchParams: Promise<SearchParams>;
};

type ActivityRow = {
    id: string;
    invoice_id: string | null;
    actor_name: string;
    action: string;
    entity_type: string;
    changes: unknown;
    occurred_at: string;
};

const PAGE_SIZE = 25;

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isObject(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function formatTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Colombo",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).format(date);
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (typeof value === "object") {
        return JSON.stringify(value, null, 2) ?? "—";
    }

    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(value)
    ) {
        return formatTime(value);
    }

    return String(value);
}

function fieldLabel(field: string) {
    const labels: Record<string, string> = {
        invoice: "Invoice created",
        status: "Final status",
        pending_reason: "Pending reason",
        remark: "Remark",
        completed_at: "Completion date / time",
        "asn.share_date": "ASN share date",
        "asn.is_shared": "ASN shared",
        "asn.assigned_user_name": "ASN user",
    };

    if (labels[field]) {
        return labels[field];
    }

    return field.replaceAll(".", " · ").replaceAll("_", " ");
}

function actionLabel(action: string) {
    const labels: Record<string, string> = {
        INVOICE_CREATED: "Invoice created",
        INVOICE_UPDATED: "Invoice updated",
        ADMIN_BOOTSTRAPPED: "Initial admin created",
        INVOICE_EXPORT_REQUESTED: "Invoice Excel export requested",
        INVOICE_DETAILS_UPDATED: "Invoice details updated",
    };

    return labels[action] ?? action.replaceAll("_", " ");
}

function activityUrl(invoice: string, page: number) {
    const params = new URLSearchParams();

    if (invoice) {
        params.set("invoice", invoice);
    }

    if (page > 1) {
        params.set("page", String(page));
    }

    const query = params.toString();

    return query
        ? `/dashboard/activity?${query}`
        : "/dashboard/activity";
}

function ChangeDetails({ changes }: { changes: unknown }) {
    if (!isObject(changes) || Object.keys(changes).length === 0) {
        return (
            <p className="text-sm text-slate-400">
                No field details recorded.
            </p>
        );
    }

    return (
        <details className="mt-4 rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-blue-700">
                View recorded changes
            </summary>

            <div className="space-y-4 border-t border-slate-200 p-4">
                {Object.entries(changes).map(([field, change]) => {
                    const hasOldAndNew =
                        isObject(change) &&
                        "old" in change &&
                        "new" in change;

                    return (
                        <div key={field}>
                            <p className="mb-2 text-sm font-semibold text-slate-800">
                                {fieldLabel(field)}
                            </p>

                            {hasOldAndNew ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="min-w-0 rounded-lg bg-slate-100 p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                            Previous value
                                        </p>

                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700">
                                            {formatValue(change.old)}
                                        </pre>
                                    </div>

                                    <div className="min-w-0 rounded-lg bg-blue-50 p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase text-blue-600">
                                            New value
                                        </p>

                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">
                                            {formatValue(change.new)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 font-sans text-sm">
                                    {formatValue(change)}
                                </pre>
                            )}
                        </div>
                    );
                })}
            </div>
        </details>
    );
}

async function ActivityContent({ searchParams }: PageProps) {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        throw new Error("Unable to verify administrator access.");
    }

    if (!profile?.is_active || profile.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const params = await searchParams;
    const invoiceSearch = first(params.invoice).trim().slice(0, 100);

    const requestedPage = Number(first(params.page) || "1");

    const page =
        Number.isSafeInteger(requestedPage) &&
            requestedPage >= 1 &&
            requestedPage <= 100000
            ? requestedPage
            : 1;

    let matchingInvoiceIds: string[] | null = null;

    if (invoiceSearch) {
        const { data: matchingInvoices, error } = await supabase
            .from("invoices")
            .select("id")
            .eq("invoice_number", invoiceSearch);

        if (error) {
            throw new Error("Unable to search invoices.");
        }

        matchingInvoiceIds = (matchingInvoices ?? []).map(
            (invoice) => invoice.id,
        );
    }

    let rows: ActivityRow[] = [];
    let total = 0;

    const hasMatches =
        matchingInvoiceIds === null || matchingInvoiceIds.length > 0;

    if (hasMatches) {
        let query = supabase
            .from("activity_logs")
            .select(
                "id, invoice_id, actor_name, action, entity_type, changes, occurred_at",
                { count: "exact" },
            );

        if (matchingInvoiceIds !== null) {
            query = query.in("invoice_id", matchingInvoiceIds);
        }

        const from = (page - 1) * PAGE_SIZE;

        const { data, error, count } = await query
            .order("occurred_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            throw new Error("Unable to load user activity.");
        }

        rows = (data ?? []) as ActivityRow[];
        total = count ?? 0;
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages) {
        redirect(activityUrl(invoiceSearch, totalPages));
    }

    const invoiceIds = [
        ...new Set(
            rows
                .map((row) => row.invoice_id)
                .filter((id): id is string => id !== null),
        ),
    ];

    const invoiceNumbers = new Map<string, string>();

    if (invoiceIds.length > 0) {
        const { data: invoices, error } = await supabase
            .from("invoices")
            .select("id, invoice_number")
            .in("id", invoiceIds);

        if (error) {
            throw new Error("Unable to load activity invoice details.");
        }

        for (const invoice of invoices ?? []) {
            invoiceNumbers.set(invoice.id, invoice.invoice_number);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-7">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                        Administrator
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        User Activity
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Track invoice creation and process updates. All times
                        are displayed in Sri Lanka time.
                    </p>
                </header>

                <form
                    action="/dashboard/activity"
                    method="get"
                    className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end"
                >
                    <div className="flex-1">
                        <label
                            htmlFor="invoice-search"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Invoice number
                        </label>

                        <input
                            id="invoice-search"
                            name="invoice"
                            defaultValue={invoiceSearch}
                            placeholder="Enter the full invoice number"
                            maxLength={100}
                            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <button
                        type="submit"
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Search activity
                    </button>

                    <Link
                        href="/dashboard/activity"
                        className="rounded-xl border border-slate-300 px-5 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        Reset
                    </Link>
                </form>

                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                    <p>{total} activity records</p>
                    <p>Newest first</p>
                </div>

                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <h2 className="font-semibold text-slate-800">
                            No activity found
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            {invoiceSearch
                                ? "Check the full invoice number, including uppercase and lowercase letters."
                                : "Recorded activities will appear here."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {rows.map((row) => (
                            <article
                                key={row.id}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                            {actionLabel(row.action)}
                                        </p>

                                        <h2 className="mt-2 font-semibold text-slate-900">
                                            {row.actor_name}
                                        </h2>

                                        <div className="mt-1 text-sm text-slate-500">
                                            {row.invoice_id ? (
                                                <Link
                                                    href={`/dashboard/invoices/${row.invoice_id}`}
                                                    className="font-medium text-blue-700 hover:underline"
                                                >
                                                    Invoice:{" "}
                                                    {invoiceNumbers.get(row.invoice_id) ??
                                                        row.invoice_id}
                                                </Link>
                                            ) : (
                                                <span>
                                                    {row.entity_type === "invoice_export"
                                                        ? "Invoice export"
                                                        : "Account activity"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <time
                                        dateTime={row.occurred_at}
                                        className="text-xs text-slate-500"
                                    >
                                        {formatTime(row.occurred_at)} · SLST
                                    </time>
                                </div>

                                <ChangeDetails changes={row.changes} />
                            </article>
                        ))}
                    </div>
                )}

                <footer className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Page {page} of {totalPages}
                    </p>

                    <div className="flex gap-3">
                        {page > 1 && (
                            <Link
                                href={activityUrl(invoiceSearch, page - 1)}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
                            >
                                Previous
                            </Link>
                        )}

                        {page < totalPages && (
                            <Link
                                href={activityUrl(invoiceSearch, page + 1)}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
                            >
                                Next
                            </Link>
                        )}
                    </div>
                </footer>
            </div>
        </main>
    );
}

export default function ActivityPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-slate-500">
                    Loading user activity...
                </div>
            }
        >
            <ActivityContent {...props} />
        </Suspense>
    );
}