import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Clock3, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import ClearActivityButton from "./clear-activity-button";
import ActivityTable, { type ActivityRow } from "./activity-table";
import Form from "next/form";

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

const inputClass =
    "block h-10 w-full min-w-0 rounded-lg border border-input " +
    "bg-background px-3 text-sm text-foreground outline-none " +
    "placeholder:text-muted-foreground focus-visible:border-ring " +
    "focus-visible:ring-2 focus-visible:ring-ring/25";

const labelClass =
    "mb-1.5 block text-xs font-medium text-muted-foreground";

const secondaryButton =
    "inline-flex min-h-11 items-center justify-center rounded-lg " +
    "border border-input bg-card px-4 text-sm font-medium " +
    "text-foreground hover:bg-muted focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring";

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function validDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

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

function activityUrl(filters: Filters, page: number) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
    }

    if (page > 1) params.set("page", String(page));

    const query = params.toString();

    return query
        ? `/dashboard/activity?${query}`
        : "/dashboard/activity";
}

async function ActivityContent({ searchParams }: PageProps) {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

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
        filterError =
            "The To date must be on or after the From date.";
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

    const activeFilters = Object.values(filters).filter(Boolean).length;
    const firstRecord = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const lastRecord = Math.min(page * PAGE_SIZE, total);

    return (
        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">
                            Activity log
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Track workspace changes and review recorded details.
                        </p>
                    </div>

                    <details className="group w-full sm:w-auto sm:max-w-md">
                        <summary className="ml-auto flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                            Log management

                            <span
                                aria-hidden="true"
                                className="text-base leading-none group-open:hidden"
                            >
                                +
                            </span>

                            <span
                                aria-hidden="true"
                                className="hidden text-base leading-none group-open:inline"
                            >
                                −
                            </span>
                        </summary>

                        <div className="mt-2 rounded-xl border border-border bg-card p-4 [&_section]:mb-0">
                            <p className="mb-3 text-xs leading-5 text-muted-foreground">
                                Manage stored activity history. Clearing logs requires
                                confirmation.
                            </p>

                            <ClearActivityButton />
                        </div>
                    </details>
                </header>

                <section
                    aria-label="Activity filters"
                    className="overflow-hidden rounded-xl border border-border bg-card"
                >
                    <Form
                        key={JSON.stringify(filters)}
                        action="/dashboard/activity"
                        scroll={false}
                    >
                        <div
                            className="grid gap-3 p-4"
                            style={{
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                            }}
                        >
                            <div className="min-w-0">
                                <label
                                    htmlFor="invoice-filter"
                                    className={labelClass}
                                >
                                    Invoice number
                                </label>

                                <input
                                    id="invoice-filter"
                                    name="invoice"
                                    defaultValue={filters.invoice}
                                    placeholder="Exact invoice number"
                                    maxLength={100}
                                    className={inputClass}
                                />
                            </div>

                            <div className="min-w-0">
                                <label
                                    htmlFor="user-filter"
                                    className={labelClass}
                                >
                                    Performed by
                                </label>

                                <input
                                    id="user-filter"
                                    name="user"
                                    defaultValue={filters.user}
                                    placeholder="Search user name"
                                    maxLength={150}
                                    className={inputClass}
                                />
                            </div>

                            <div className="min-w-0">
                                <label
                                    htmlFor="action-filter"
                                    className={labelClass}
                                >
                                    Activity type
                                </label>

                                <select
                                    id="action-filter"
                                    name="action"
                                    defaultValue={filters.action}
                                    className={inputClass}
                                >
                                    <option value="">All activities</option>

                                    {Object.entries(ACTION_LABELS).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>

                            <div className="min-w-0">
                                <label
                                    htmlFor="from-filter"
                                    className={labelClass}
                                >
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

                            <div className="min-w-0">
                                <label
                                    htmlFor="to-filter"
                                    className={labelClass}
                                >
                                    To date
                                </label>

                                <input
                                    id="to-filter"
                                    name="to"
                                    type="date"
                                    defaultValue={
                                        validDate(filters.to) ? filters.to : ""
                                    }
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock3
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    Sri Lanka time
                                </p>

                                {activeFilters > 0 && (
                                    <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                        {activeFilters} active{" "}
                                        {activeFilters === 1 ? "filter" : "filters"}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href="/dashboard/activity"
                                    className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Reset
                                </Link>

                                <button
                                    type="submit"
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Search
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Apply filters
                                </button>
                            </div>
                        </div>
                    </Form>
                </section>
                {filterError || loadError ? (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                    >
                        {filterError ||
                            "Unable to load activity. Refresh the page and try again."}
                    </div>
                ) : (
                    <section
                        aria-labelledby="records-heading"
                        className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                            <div className="flex items-center gap-2">
                                <h2
                                    id="records-heading"
                                    className="text-sm font-semibold text-foreground"
                                >
                                    Activity records
                                </h2>

                                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                                    {total.toLocaleString("en-US")}
                                </span>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Newest first
                            </p>
                        </div>

                        <ActivityTable
                            key={activityUrl(filters, page)}
                            rows={rows}
                        />

                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {total === 0
                                    ? "0 records"
                                    : `${firstRecord.toLocaleString("en-US")}–${lastRecord.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} records`}
                            </p>

                            <nav
                                aria-label="Activity pagination"
                                className="flex flex-wrap items-center gap-2"
                            >
                                <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                                    Page {page} of {totalPages}
                                </span>

                                {page > 1 ? (
                                    <Link
                                        href={activityUrl(filters, page - 1)}
                                        className={secondaryButton}
                                    >
                                        Previous
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className={`${secondaryButton} opacity-40`}
                                    >
                                        Previous
                                    </button>
                                )}

                                {page < totalPages ? (
                                    <Link
                                        href={activityUrl(filters, page + 1)}
                                        className={secondaryButton}
                                    >
                                        Next
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        className={`${secondaryButton} opacity-40`}
                                    >
                                        Next
                                    </button>
                                )}
                            </nav>
                        </footer>
                    </section>
                )}
            </div>
        </main>
    );
}

export default function ActivityPage(props: PageProps) {
    return (
        <Suspense
            fallback={
                <div
                    role="status"
                    className="px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8"
                >
                    Loading activity log…
                </div>
            }
        >
            <ActivityContent {...props} />
        </Suspense>
    );
}