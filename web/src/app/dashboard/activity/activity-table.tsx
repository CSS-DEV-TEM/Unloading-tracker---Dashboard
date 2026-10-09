"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";

export type ActivityRow = {
    id: string;
    invoice_id: string | null;
    actor_name: string | null;
    action: string;
    entity_type: string;
    changes: unknown;
    occurred_at: string;
    invoices: {
        invoice_number: string;
    } | null;
};

export const ACTION_LABELS: Record<string, string> = {
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

const FIELD_LABELS: Record<string, string> = {
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

function isObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function formatDateTime(value: string, timeOnly = false) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) return "—";

    return new Intl.DateTimeFormat(
        "en-GB",
        timeOnly
            ? {
                timeZone: "Asia/Colombo",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
            }
            : {
                timeZone: "Asia/Colombo",
                day: "2-digit",
                month: "short",
                year: "numeric",
            },
    ).format(date);
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
        const date = new Date(value);

        if (Number.isFinite(date.getTime())) {
            return `${formatDateTime(value)} · ${formatDateTime(value, true)} SLST`;
        }
    }

    return String(value);
}

function actionClass(action: string) {
    if (
        action === "USER_DEACTIVATED" ||
        action === "ACTIVITY_LOGS_CLEARED"
    ) {
        return "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300";
    }

    if (
        action === "INVOICE_CREATED" ||
        action === "USER_CREATED" ||
        action === "USER_ACTIVATED"
    ) {
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300";
    }

    return "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300";
}

function ChangeDetails({ changes }: { changes: unknown }) {
    if (!isObject(changes) || Object.keys(changes).length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No field details recorded for this activity.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {Object.entries(changes).map(([field, change]) => {
                const label =
                    FIELD_LABELS[field] ??
                    field.replaceAll(".", " · ").replaceAll("_", " ");

                const hasComparison =
                    isObject(change) &&
                    "old" in change &&
                    "new" in change;

                return (
                    <div
                        key={field}
                        className="grid gap-3 border-b border-border pb-4 last:border-0 last:pb-0 md:grid-cols-4"
                    >
                        <h3 className="break-words text-xs font-semibold text-foreground">
                            {label}
                        </h3>

                        <div className="min-w-0 md:col-span-3">
                            {hasComparison ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                                            Previous value
                                        </p>
                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.old)}
                                        </pre>
                                    </div>

                                    <div className="min-w-0 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-400/5">
                                        <p className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                                            New value
                                        </p>
                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.new)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-3 font-sans text-sm text-foreground">
                                    {formatValue(change)}
                                </pre>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function ActivityTable({
    rows,
}: {
    rows: ActivityRow[];
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <ClipboardList className="size-5" aria-hidden="true" />
                </span>

                <h3 className="text-sm font-semibold text-foreground">
                    No matching activity
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Try another invoice, user or date range, or reset
                    the filters to view all records.
                </p>
            </div>
        );
    }

    return (
        <div
            role="region"
            aria-label="Activity records"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
            <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                <caption className="sr-only">
                    Workspace activity, newest first. Times use Asia/Colombo.
                </caption>

                <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className="w-44 px-5 py-3 font-medium">
                            Date & time
                        </th>
                        <th scope="col" className="w-1/5 px-4 py-3 font-medium">
                            User
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                            Activity
                        </th>
                        <th scope="col" className="w-44 px-4 py-3 font-medium">
                            Invoice / scope
                        </th>
                        <th scope="col" className="w-28 px-4 py-3 text-right font-medium">
                            Details
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border">
                    {rows.map((row) => {
                        const expanded = expandedId === row.id;
                        const detailsId = `activity-details-${row.id}`;
                        const actionLabel =
                            ACTION_LABELS[row.action] ??
                            row.action.replaceAll("_", " ");

                        return (
                            <Fragment key={row.id}>
                                <tr
                                    className={
                                        expanded
                                            ? "bg-muted/40"
                                            : "hover:bg-muted/30"
                                    }
                                >
                                    <td className="px-5 py-4 align-top">
                                        <time dateTime={row.occurred_at}>
                                            <span className="block whitespace-nowrap font-medium text-foreground">
                                                {formatDateTime(row.occurred_at)}
                                            </span>
                                            <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                                                {formatDateTime(row.occurred_at, true)}
                                            </span>
                                        </time>
                                    </td>

                                    <td className="break-words px-4 py-4 align-top font-medium text-foreground">
                                        {row.actor_name || "Not recorded"}
                                    </td>

                                    <td className="px-4 py-4 align-top">
                                        <span
                                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium leading-5 ${actionClass(row.action)}`}
                                        >
                                            {actionLabel}
                                        </span>
                                    </td>

                                    <td className="break-words px-4 py-4 align-top">
                                        {row.invoice_id ? (
                                            <Link
                                                href={`/dashboard/invoices/${row.invoice_id}`}
                                                className="rounded font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-300"
                                            >
                                                {row.invoices?.invoice_number ??
                                                    "View invoice"}
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                {row.action === "ACTIVITY_LOGS_CLEARED"
                                                    ? "Activity history"
                                                    : row.entity_type === "invoice_export"
                                                        ? "Invoice export"
                                                        : "User accounts"}
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-3 py-2 text-right align-top">
                                        <button
                                            type="button"
                                            aria-expanded={expanded}
                                            aria-controls={detailsId}
                                            aria-label={`${expanded ? "Hide" : "View"} details: ${actionLabel}, ${row.actor_name || "user"}, ${formatDateTime(row.occurred_at)}`}
                                            onClick={() =>
                                                setExpandedId(
                                                    expanded ? null : row.id,
                                                )
                                            }
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {expanded ? "Hide" : "View"}
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""
                                                    }`}
                                            />
                                        </button>
                                    </td>
                                </tr>

                                <tr id={detailsId} hidden={!expanded}>
                                    <td
                                        colSpan={5}
                                        className="bg-muted/20 px-5 py-5"
                                    >
                                        {expanded && (
                                            <div className="max-w-5xl">
                                                <h2 className="mb-4 text-sm font-semibold text-foreground">
                                                    Recorded changes
                                                </h2>
                                                <ChangeDetails changes={row.changes} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}