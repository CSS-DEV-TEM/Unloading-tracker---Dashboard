"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ArrowRight, ChevronDown, ClipboardList } from "lucide-react";

export type ActivityRow = {
    id: string;
    invoice_id: string | null;
    actor_name: string | null;
    invoice_number_snapshot: string | null;
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
    VEHICLE_CREATED: "Vehicle created",
    VEHICLE_ARCHIVED: "Vehicle archived",
    VEHICLE_RESTORED: "Vehicle restored",
    VEHICLE_DELETED: "Vehicle deleted",
    VEHICLE_RENAMED: "Vehicle renamed",
    INVOICE_VEHICLE_UPDATED: "Vehicle assignment updated",
    INVOICE_DETAILS_UPDATED: "Invoice details updated",
    INVOICE_EXPORT_REQUESTED: "Invoice Excel export requested",
    USER_CREATED: "User created",
    USER_ACTIVATED: "User activated",
    USER_DEACTIVATED: "User deactivated",
    USER_PROFILE_RECOVERED: "User profile recovered",
    ADMIN_BOOTSTRAPPED: "Initial admin created",
    ACTIVITY_LOGS_CLEARED: "Activity history cleared",
    INVOICE_DELETED: "Invoice deleted",
};

const FIELD_LABELS: Record<string, string> = {
    is_archived: "Archived",
    vehicle_number: "Vehicle number",
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

const TONES = {
    create:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    caution:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    danger:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    update:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
};

function actionClass(action: string) {
    if (
        action === "INVOICE_DELETED" ||
        action === "VEHICLE_DELETED" ||
        action === "ACTIVITY_LOGS_CLEARED"
    ) {
        return TONES.danger;
    }

    if (
        action === "USER_DEACTIVATED" ||
        action === "VEHICLE_ARCHIVED"
    ) {
        return TONES.caution;
    }

    if (
        action === "INVOICE_CREATED" ||
        action === "VEHICLE_CREATED" ||
        action === "VEHICLE_RESTORED" ||
        action === "USER_CREATED" ||
        action === "USER_ACTIVATED" ||
        action === "ADMIN_BOOTSTRAPPED"
    ) {
        return TONES.create;
    }

    return TONES.update;
}

function initials(name: string | null) {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return "?";

    return parts
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function ChangeDetails({ changes }: { changes: unknown }) {
    if (!isObject(changes) || Object.keys(changes).length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No field details were recorded for this activity.
            </p>
        );
    }

    return (
        <div className="divide-y divide-border">
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
                        className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[11rem_minmax(0,1fr)]"
                    >
                        <h3 className="break-words text-sm font-semibold text-foreground">
                            {label}
                        </h3>

                        <div className="min-w-0">
                            {hasComparison ? (
                                <div className="grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                                    <div className="min-w-0 rounded-md border border-border bg-card p-3">
                                        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                                            Before
                                        </p>
                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.old)}
                                        </pre>
                                    </div>

                                    <ArrowRight
                                        aria-hidden="true"
                                        className="hidden size-4 self-center text-muted-foreground sm:block"
                                    />

                                    <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                                        <p className="mb-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                            After
                                        </p>
                                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                                            {formatValue(change.new)}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-card p-3 font-sans text-sm text-foreground">
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
            <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <ClipboardList className="size-6" aria-hidden="true" />
                </span>

                <h3 className="font-semibold text-foreground">
                    No matching activity
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Try a different invoice, user or date range, or reset
                    the filters to see every record.
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
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                <caption className="sr-only">
                    Workspace activity, newest first. Times use Asia/Colombo.
                </caption>

                <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className="w-44 px-5 py-3 text-xs font-semibold">
                            Date and time
                        </th>
                        <th scope="col" className="w-[22%] px-4 py-3 text-xs font-semibold">
                            Performed by
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                            Activity
                        </th>
                        <th scope="col" className="w-48 px-4 py-3 text-xs font-semibold">
                            Related to
                        </th>
                        <th scope="col" className="w-36 px-4 py-3 text-right text-xs font-semibold">
                            <span className="sr-only">Details</span>
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
                                            ? "bg-primary/[0.05]"
                                            : "transition-colors hover:bg-primary/[0.03]"
                                    }
                                >
                                    <td className="px-5 py-3.5 align-middle">
                                        <time dateTime={row.occurred_at}>
                                            <span className="block whitespace-nowrap font-medium text-foreground">
                                                {formatDateTime(row.occurred_at)}
                                            </span>
                                            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                                                {formatDateTime(row.occurred_at, true)} · SLST
                                            </span>
                                        </time>
                                    </td>

                                    <td className="px-4 py-3.5 align-middle">
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                aria-hidden="true"
                                                className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${row.actor_name
                                                    ? "bg-primary/10 text-primary"
                                                    : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {initials(row.actor_name)}
                                            </span>

                                            <span
                                                className={`min-w-0 break-words font-medium ${row.actor_name
                                                    ? "text-foreground"
                                                    : "text-muted-foreground"
                                                    }`}
                                            >
                                                {row.actor_name || "Not recorded"}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3.5 align-middle">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current before:content-[''] ${actionClass(row.action)}`}
                                        >
                                            {actionLabel}
                                        </span>
                                    </td>

                                    <td className="break-words px-4 py-3.5 align-middle">
                                        {row.invoice_id ? (
                                            <Link
                                                href={`/dashboard/invoices/${row.invoice_id}`}
                                                className="ref rounded font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-300"
                                            >
                                                {row.invoices?.invoice_number ??
                                                    row.invoice_number_snapshot ??
                                                    "View invoice"}
                                            </Link>
                                        ) : row.invoice_number_snapshot ? (
                                            <div>
                                                <span className="ref break-words font-medium text-foreground">
                                                    {row.invoice_number_snapshot}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    Invoice deleted
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                {row.action === "ACTIVITY_LOGS_CLEARED"
                                                    ? "Activity history"
                                                    : row.entity_type === "invoice_export"
                                                        ? "Invoice export"
                                                        : row.entity_type === "vehicle"
                                                            ? "Vehicle management"
                                                            : "User accounts"}
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-4 py-2 text-right align-middle">
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
                                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {expanded ? "Hide" : "Details"}
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""
                                                    }`}
                                            />
                                        </button>
                                    </td>
                                </tr>

                                <tr id={detailsId} hidden={!expanded}>
                                    <td
                                        colSpan={5}
                                        className="border-l-[3px] border-l-primary bg-muted/30 px-5 py-5"
                                    >
                                        {expanded && (
                                            <div className="max-w-5xl">
                                                <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
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