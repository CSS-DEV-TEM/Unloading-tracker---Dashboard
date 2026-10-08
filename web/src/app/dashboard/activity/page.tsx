
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClearActivityButton from "./clear-activity-button";

type SearchParams = {
    invoice?: string | string[];
    user?: string | string[];
    from?: string | string[];
    to?: string | string[];
    action?: string | string[];
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
    invoices: {
        invoice_number: string;
    } | null;
};

type Filters = {
    invoice: string;
    user: string;
    from: string;
    to: string;
    action: string;
};

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, string> = {
    INVOICE_CREATED: "Invoice created",
    INVOICE_UPDATED: "Invoice process updated",
    INVOICE_DETAILS_UPDATED: "Invoice details updated",
    INVOICE_EXPORT_REQUESTED: "Invoice Excel export requested",
    USER_CREATED: "User created",
    USER_ACTIVATED: "User activated",
    USER_DEACTIVATED: "User deactivated",
    USER_PROFILE_RECOVERED: "User profile recovered",
    ADMIN_BOOTSTRAPPED: "Initial admin created",
    ACTIVITY_LOGS_CLEARED: "Activity history cleared",
};

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

function validDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function sriLankaDayStart(value: string) {
    return new Date(`${value}T00:00:00+05:30`).toISOString();
}

function afterSriLankaDay(value: string) {
    const start = new Date(`${value}T00:00:00+05:30`).getTime();

    return new Date(start + 24 * 60 * 60 * 1000).toISOString();
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
        invoice_number: "Invoice number",
        supplier: "Supplier",
        roll_quantity: "Roll quantity",
        document_share_date: "Document share date",
        shipment_type: "Local / Import",
        status: "Final status",
        pending_reason: "Pending reason",
        remark: "Remark",
        completed_at: "Completion date / time",
        user_name: "User name",
        role: "Role",
        is_active: "Account active",
        scope: "Export scope",
        invoice_count: "Invoice count",
        recovery_context: "Recovery details",
        "asn.share_date": "ASN share date",
        "asn.is_shared": "ASN shared",
        "asn.assigned_user_name": "ASN user",
    };

    return (
        labels[field] ??
        field.replaceAll(".", " · ").replaceAll("_", " ")
    );
}

function activityUrl(filters: Filters, page: number) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
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
            <p className="mt-4 text-sm text-slate-400">
                No field details recorded.
            </p>
        );
    }

    return (
        <details className="mt-4 rounded-xl border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-400">
                View recorded changes
            </summary>

            <div className="space-y-4 border-t border-border p-4">
                {Object.entries(changes).map(([field, change]) => {
                    const hasOldAndNew =
                        isObject(change) &&
                        "old" in change &&
                        "new" in change;

                    return (
                        <div key={field}>
                            <p className="mb-2 text-sm font-semibold text-foreground">
                                {fieldLabel(field)}
                            </p>

                            {hasOldAndNew ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="min-w-0 rounded-lg bg-muted p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                                            Previous value
                                        </p>

                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.old)}
                                        </pre>
                                    </div>

                                    <div className="min-w-0 rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
                                        <p className="mb-2 text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">
                                            New value
                                        </p>

                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.new)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-sans text-sm">
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
    const requestedAction = first(params.action);

    const filters: Filters = {
        invoice: first(params.invoice).trim().slice(0, 100),
        user: first(params.user).trim().slice(0, 150),
        from: first(params.from).trim(),
        to: first(params.to).trim(),
        action: Object.prototype.hasOwnProperty.call(
            ACTION_LABELS,
            requestedAction,
        )
            ? requestedAction
            : "",
    };

    let filterError = "";

    if (
        (filters.from && !validDate(filters.from)) ||
        (filters.to && !validDate(filters.to))
    ) {
        filterError = "Select valid From and To dates.";
    } else if (
        filters.from &&
        filters.to &&
        filters.from > filters.to
    ) {
        filterError = "The To date must be on or after the From date.";
    }

    const requestedPage = Number(first(params.page) || "1");

    const page =
        Number.isSafeInteger(requestedPage) &&
            requestedPage >= 1 &&
            requestedPage <= 100000
            ? requestedPage
            : 1;

    let rows: ActivityRow[] = [];
    let total = 0;
    let loadError = false;

    if (!filterError) {
        const fields =
            "id, invoice_id, actor_name, action, entity_type, changes, occurred_at";

        // Keep account/export activities when no invoice filter is applied.
        // Use an inner join when filtering by invoice number.
        const selection = filters.invoice
            ? `${fields}, invoices!inner(invoice_number)`
            : `${fields}, invoices(invoice_number)`;

        let query = supabase
            .from("activity_logs")
            .select(selection, { count: "exact" });

        if (filters.invoice) {
            query = query.eq(
                "invoices.invoice_number",
                filters.invoice,
            );
        }

        if (filters.user) {
            const escapedName = filters.user.replace(
                /[\\%_*]/g,
                "\\$&",
            );

            query = query.ilike("actor_name", `%${escapedName}%`);
        }

        if (filters.action) {
            query = query.eq("action", filters.action);
        }

        if (filters.from) {
            query = query.gte(
                "occurred_at",
                sriLankaDayStart(filters.from),
            );
        }

        if (filters.to) {
            // Exclusive start of the following day includes the full To day.
            query = query.lt(
                "occurred_at",
                afterSriLankaDay(filters.to),
            );
        }

        const from = (page - 1) * PAGE_SIZE;

        const { data, error, count } = await query
            .order("occurred_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        loadError = Boolean(error);

        if (!error) {
            rows = (data ?? []) as unknown as ActivityRow[];
            total = count ?? 0;
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (!filterError && !loadError && page > totalPages) {
        redirect(activityUrl(filters, totalPages));
    }

    const inputClass =
        "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-ring/25";

    const labelClass =
        "mb-2 block text-sm font-medium text-foreground";

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-5 flex justify-end"></div>
                <header className="mb-7">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                        Administrator
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                        User Activity
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Search recorded changes by invoice, user, activity type,
                        or date. Dates and times use Sri Lanka time.
                    </p>
                </header>

                <ClearActivityButton />

                <form
                    key={JSON.stringify(filters)}
                    action="/dashboard/activity"
                    method="get"
                    className="mb-6 rounded-2xl border border-border bg-card p-5"
                >
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <div>
                            <label htmlFor="invoice-filter" className={labelClass}>
                                Invoice number
                            </label>
                            <input
                                id="invoice-filter"
                                name="invoice"
                                defaultValue={filters.invoice}
                                placeholder="Full current invoice number"
                                maxLength={100}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label htmlFor="user-filter" className={labelClass}>
                                User name
                            </label>
                            <input
                                id="user-filter"
                                name="user"
                                defaultValue={filters.user}
                                placeholder="Name or part of a name"
                                maxLength={150}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label htmlFor="action-filter" className={labelClass}>
                                Activity type
                            </label>
                            <select
                                id="action-filter"
                                name="action"
                                defaultValue={filters.action}
                                className={inputClass}
                            >
                                <option value="">All activity types</option>

                                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="from-filter" className={labelClass}>
                                From date
                            </label>
                            <input
                                id="from-filter"
                                name="from"
                                type="date"
                                defaultValue={
                                    validDate(filters.from) ? filters.from : ""
                                }
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label htmlFor="to-filter" className={labelClass}>
                                To date
                            </label>
                            <input
                                id="to-filter"
                                name="to"
                                type="date"
                                defaultValue={validDate(filters.to) ? filters.to : ""}
                                className={inputClass}
                            />
                        </div>

                        <div className="flex items-end gap-3">
                            <button
                                type="submit"
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Apply filters
                            </button>

                            <Link
                                href="/dashboard/activity"
                                className="rounded-xl border border-input px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-background"
                            >
                                Reset
                            </Link>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground">
                        User name searches the person who performed the action,
                        not the assigned AX/D365 or ASN user.
                    </p>
                </form>

                {filterError || loadError ? (
                    <p
                        role="alert"
                        className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400"
                    >
                        {filterError ||
                            "Unable to load activity. Refresh the page and try again."}
                    </p>
                ) : (
                    <>
                        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                            <p>{total} matching activity records</p>
                            <p>Newest first</p>
                        </div>

                        {rows.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-input bg-card px-6 py-14 text-center">
                                <h2 className="font-semibold text-foreground">
                                    No matching activity
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Adjust the filters or reset to view all recorded activity.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {rows.map((row) => (
                                    <article
                                        key={row.id}
                                        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                                    {ACTION_LABELS[row.action] ??
                                                        row.action.replaceAll("_", " ")}
                                                </p>

                                                <h2 className="mt-2 font-semibold text-foreground">
                                                    {row.actor_name}
                                                </h2>

                                                <div className="mt-1 text-sm text-muted-foreground">
                                                    {row.invoice_id ? (
                                                        <Link
                                                            href={`/dashboard/invoices/${row.invoice_id}`}
                                                            className="font-medium text-blue-700 dark:text-blue-400 hover:underline"
                                                        >
                                                            Invoice:{" "}
                                                            {row.invoices?.invoice_number ??
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
                                                className="text-xs text-muted-foreground"
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
                            <p className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </p>

                            <div className="flex gap-3">
                                {page > 1 && (
                                    <Link
                                        href={activityUrl(filters, page - 1)}
                                        className="rounded-lg border border-input bg-card px-4 py-2 text-sm hover:bg-muted"
                                    >
                                        Previous
                                    </Link>
                                )}

                                {page < totalPages && (
                                    <Link
                                        href={activityUrl(filters, page + 1)}
                                        className="rounded-lg border border-input bg-card px-4 py-2 text-sm hover:bg-muted"
                                    >
                                        Next
                                    </Link>
                                )}
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </main>
    );
}

export default function ActivityPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-muted-foreground">
                    Loading user activity...
                </div>
            }
        >
            <ActivityContent {...props} />
        </Suspense>
    );
}