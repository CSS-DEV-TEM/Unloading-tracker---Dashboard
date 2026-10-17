"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { saveImportedInvoice } from "../new/actions";
import {
    emailClipboardText,
    MAX_PASTE_LENGTH,
    parseEmailTable,
} from "./email-table";
import { MAX_METERS, sumMeters } from "@/lib/meter-quantity";

type ExtractedInvoice = {
    invoice_number: string;
    supplier: string | null;
    roll_quantity: number | null;
    meter_quantity: number | null;
    roll_quantity_invalid: boolean;
    meter_quantity_invalid: boolean;
    system_type: string | null;
    document_share_date: string | null;
    shipment_type: string | null;
    source_row_count: number;
    review_notes: string[];
};

type SourcePart = {
    id: string;
    name: string;
    data: ExtractedInvoice;
};

type Draft = {
    id: string;
    parts: SourcePart[];
    invoice: string;
    supplier: string;
    quantity: string;
    meters: string;
    system: string;
    date: string;
    shipment: string;
    notes: string[];
    status: "draft" | "saving" | "saved" | "error" | "unknown";
    message: string;
};

type EditableField =
    | "invoice"
    | "supplier"
    | "quantity"
    | "meters"
    | "system"
    | "date"
    | "shipment";

const MAX_ROLLS = 2147483647;

const inputClass =
    "h-10 w-full rounded-lg border border-input bg-background px-3 " +
    "text-sm text-foreground outline-none focus:border-blue-600 " +
    "focus:ring-2 focus:ring-ring/25 disabled:opacity-60";

const buttonClass =
    "inline-flex min-h-10 items-center justify-center rounded-lg " +
    "bg-blue-700 px-4 py-2 text-sm font-semibold text-white " +
    "hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryClass =
    "rounded-lg border border-border px-3 py-2 text-sm " +
    "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

function invoiceKey(value: string) {
    return value.trim().toLowerCase();
}

function normalize(value: string) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isProtected(row: Draft) {
    return row.status === "saved" || row.status === "unknown";
}

function buildDraft(
    parts: SourcePart[],
    id: string = crypto.randomUUID(),
    invoice: string = parts[0]?.data.invoice_number ?? "",
): Draft {
    const notes = parts.flatMap((part) =>
        part.data.review_notes.map((note) => `${part.name}: ${note}`),
    );

    function consistent(
        values: (string | null)[],
        label: string,
    ): string {
        const cleaned = values.map((value) => (value ?? "").trim());

        if (
            cleaned.length > 0 &&
            cleaned.every(Boolean) &&
            new Set(cleaned.map(normalize)).size === 1
        ) {
            return cleaned[0];
        }

        notes.push(`${label} is missing or differs. Review this field.`);
        return "";
    }

    const supplier = consistent(
        parts.map((part) => part.data.supplier),
        "Supplier",
    );

    const date = consistent(
        parts.map((part) => part.data.document_share_date),
        "Document date",
    );

    const shipment = consistent(
        parts.map((part) => part.data.shipment_type),
        "Local / Import",
    );

    const sourceSystems = parts.map((part) => part.data.system_type);
    let system = "";

    if (
        sourceSystems.length > 0 &&
        sourceSystems.every(
            (value) =>
                value === "AX" ||
                value === "D365" ||
                value === "AX/D365",
        )
    ) {
        const systems = new Set(
            sourceSystems.flatMap((value) => (value ?? "").split("/")),
        );

        system = systems.size === 2
            ? "AX/D365"
            : [...systems][0] ?? "";
    } else {
        notes.push("An unknown Sales order prefix needs review.");
    }

    // Calculate rolls independently from meters.
    const rollValues = parts
        .map((part) => part.data.roll_quantity)
        .filter((value): value is number => value !== null);

    let quantity = "";

    if (parts.some((part) => part.data.roll_quantity_invalid)) {
        notes.push(
            "Roll total left blank because a source roll quantity is invalid.",
        );
    } else if (rollValues.length > 0) {
        const valid = rollValues.every(
            (value) => Number.isSafeInteger(value) && value >= 0,
        );

        const total = rollValues.reduce((sum, value) => sum + value, 0);

        if (
            valid &&
            Number.isSafeInteger(total) &&
            total <= MAX_ROLLS
        ) {
            quantity = String(total);
        } else {
            notes.push("Roll total is invalid or exceeds the supported limit.");
        }
    }

    const meterValues = parts.map((part) => part.data.meter_quantity);
    let meters = "";

    if (parts.some((part) => part.data.meter_quantity_invalid)) {
        notes.push(
            "Meter total left blank because a source meter quantity is invalid.",
        );
    } else {
        meters = sumMeters(meterValues);

        if (meterValues.some((value) => value !== null) && meters === "") {
            notes.push(
                "Meter total is invalid or exceeds the supported limit.",
            );
        }
    }

    return {
        id,
        parts,
        invoice,
        supplier,
        quantity,
        meters,
        system,
        date,
        shipment,
        notes: [...new Set(notes)],
        status: "draft",
        message: "",
    };
}

export default function ImportForm() {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [emailText, setEmailText] = useState("");
    const [dateFormat, setDateFormat] = useState("mdy");
    const [busy, setBusy] = useState<"extract" | "save" | null>(null);
    const [message, setMessage] = useState("");
    const operation = useRef(false);

    const hasUnknown = drafts.some((row) => row.status === "unknown");
    const hasSaved = drafts.some((row) => row.status === "saved");
    const hasUnsaved = drafts.some((row) => row.status !== "saved");
    const hasPastedText = emailText.trim().length > 0;
    const hasWork = hasPastedText || hasUnsaved;

    const savedCount = drafts.filter(
        (row) => row.status === "saved",
    ).length;

    const remaining = drafts.filter(
        (row) => !isProtected(row),
    ).length;

    const counts = new Map<string, number>();

    for (const row of drafts) {
        const key = invoiceKey(row.invoice);

        if (key) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }

    const hasDuplicates = [...counts.values()].some(
        (count) => count > 1,
    );

    useEffect(() => {
        if (!hasWork && !busy) return;

        function warn(event: BeforeUnloadEvent) {
            event.preventDefault();
            event.returnValue = "";
        }

        window.addEventListener("beforeunload", warn);

        return () => {
            window.removeEventListener("beforeunload", warn);
        };
    }, [hasWork, busy]);

    function patchRow(id: string, patch: Partial<Draft>) {
        setDrafts((current) =>
            current.map((row) =>
                row.id === id ? { ...row, ...patch } : row,
            ),
        );
    }

    function edit(id: string, field: EditableField, value: string) {
        if (operation.current || hasUnknown) return;

        setDrafts((current) =>
            current.map((row) =>
                row.id === id && !isProtected(row)
                    ? {
                        ...row,
                        [field]: value,
                        status: "draft",
                        message: "",
                    }
                    : row,
            ),
        );
    }

    function extractEmail(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (operation.current || hasSaved || hasUnknown) return;

        operation.current = true;
        setBusy("extract");
        setMessage("");

        try {
            const extracted: ExtractedInvoice[] = parseEmailTable(
                emailText,
                dateFormat,
            );

            const batchId = crypto.randomUUID().slice(0, 8);
            const grouped = new Map<string, SourcePart[]>();

            extracted.forEach((data, index) => {
                const key = invoiceKey(data.invoice_number);
                const parts = grouped.get(key) ?? [];

                parts.push({
                    id: crypto.randomUUID(),
                    name: `Email ${batchId} · row ${index + 1}`,
                    data,
                });

                grouped.set(key, parts);
            });

            const additions = [...grouped.values()].map(
                (parts) => buildDraft(parts),
            );

            setDrafts((current) => [...current, ...additions]);
            setEmailText("");

            setMessage(
                `${extracted.length} source rows extracted into ` +
                `${additions.length} invoice drafts. Review before saving.`,
            );
        } catch (cause) {
            setMessage(
                cause instanceof Error
                    ? cause.message
                    : "Unable to extract the email table.",
            );
        } finally {
            operation.current = false;
            setBusy(null);
        }
    }

    function combine(row: Draft) {
        if (operation.current || hasUnknown) return;

        const matches = drafts.filter(
            (item) => invoiceKey(item.invoice) === invoiceKey(row.invoice),
        );

        if (matches.length < 2 || matches.some(isProtected)) return;

        if (
            !window.confirm(
                `Combine ${matches.length} drafts for "${row.invoice}"? ` +
                "Only combine separate quantities, not repeated copies. " +
                "Rolls and meters will be recalculated from original rows. " +
                "Manual edits will reset except the invoice number.",
            )
        ) {
            return;
        }

        const merged = buildDraft(
            matches.flatMap((item) => item.parts),
            matches[0].id,
            row.invoice.trim(),
        );

        const ids = new Set(matches.map((item) => item.id));

        setDrafts((current) =>
            current.flatMap((item) => {
                if (item.id === merged.id) return [merged];
                return ids.has(item.id) ? [] : [item];
            }),
        );

        setMessage("Drafts combined. Review both quantities and required fields.");
    }

    function removeDraft(row: Draft) {
        if (operation.current || hasUnknown || isProtected(row)) return;

        if (!window.confirm(`Remove draft "${row.invoice}"?`)) return;

        setDrafts((current) =>
            current.filter((item) => item.id !== row.id),
        );
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (operation.current || hasUnknown) return;

        if (hasPastedText) {
            setMessage("Extract or clear the pasted text before saving.");
            return;
        }

        if (hasDuplicates) {
            setMessage(
                "Combine separate quantities or remove duplicate drafts first.",
            );
            return;
        }

        const pendingRows = drafts.filter((row) => !isProtected(row));

        if (pendingRows.length === 0) return;

        operation.current = true;
        setBusy("save");
        setMessage("");

        let saved = 0;
        let failed = 0;
        let uncertain = false;

        try {
            for (const row of pendingRows) {
                patchRow(row.id, {
                    status: "saving",
                    message: "",
                });

                const form = new FormData();
                form.set("invoice", row.invoice);
                form.set("supplier", row.supplier);
                form.set("rollQuantity", row.quantity);
                form.set("meterQuantity", row.meters);
                form.set("system", row.system);
                form.set("documentDate", row.date);
                form.set("shipment", row.shipment);
                form.set("vehicleNumber", "");
                form.set("receivedDate", "");

                try {
                    const result = await saveImportedInvoice(
                        { error: "" },
                        form,
                    );

                    if (!result || typeof result.error !== "string") {
                        throw new Error("Save confirmation was not received.");
                    }

                    if (result.error) {
                        failed += 1;

                        patchRow(row.id, {
                            status: "error",
                            message: result.error,
                        });
                    } else {
                        saved += 1;

                        patchRow(row.id, {
                            status: "saved",
                            message: "Saved successfully.",
                        });
                    }
                } catch {
                    uncertain = true;

                    patchRow(row.id, {
                        status: "unknown",
                        message:
                            "Save confirmation was not received. This invoice " +
                            "may already be saved. Check the dashboard before " +
                            "starting another batch.",
                    });

                    break;
                }
            }

            setMessage(
                uncertain
                    ? "Saving stopped because one result is unconfirmed. " +
                    "Check the dashboard before importing again."
                    : `${saved} saved in this attempt. ${failed} failed. ` +
                    (failed
                        ? "Correct the failed drafts and retry."
                        : "Import complete."),
            );
        } finally {
            operation.current = false;
            setBusy(null);
        }
    }

    function clearBatch() {
        if (operation.current) return;

        if (
            (hasWork || hasUnknown) &&
            !window.confirm(
                "Clear this preview and pasted text? Unsaved drafts will be " +
                "discarded. Saved invoices remain in the dashboard. " +
                "Check any unconfirmed invoice before importing it again.",
            )
        ) {
            return;
        }

        setDrafts([]);
        setEmailText("");
        setMessage("");
    }

    const pasteLocked = busy !== null || hasSaved || hasUnknown;

    return (
        <div className="space-y-6">
            <form
                onSubmit={extractEmail}
                className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6"
            >
                <div>
                    <h2 className="font-semibold">Paste email table</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Copy the complete table including its column headers.
                        Qty(MTR) is saved as meters. Roll quantities stay separate.
                    </p>
                </div>

                <label
                    htmlFor="email-table"
                    className="block text-sm font-medium"
                >
                    Email table
                </label>

                <textarea
                    id="email-table"
                    value={emailText}
                    disabled={pasteLocked}
                    maxLength={MAX_PASTE_LENGTH}
                    rows={10}
                    spellCheck={false}
                    placeholder={
                        "Paste the table here, including Date, Sales order, " +
                        "Qty or Qty(MTR), Invoice No and Supplier."
                    }
                    onChange={(event) => setEmailText(event.target.value)}
                    onPaste={(event) => {
                        if (pasteLocked) return;

                        event.preventDefault();

                        try {
                            const pasted = emailClipboardText(
                                event.clipboardData.getData("text/html"),
                                event.clipboardData.getData("text/plain"),
                            );

                            const target = event.currentTarget;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;

                            const next =
                                target.value.slice(0, start) +
                                pasted +
                                target.value.slice(end);

                            if (next.length > MAX_PASTE_LENGTH) {
                                throw new Error(
                                    "Too much text. Paste a smaller table.",
                                );
                            }

                            setEmailText(next);
                            setMessage("");
                        } catch (cause) {
                            setMessage(
                                cause instanceof Error
                                    ? cause.message
                                    : "Unable to read the clipboard.",
                            );
                        }
                    }}
                    className={
                        "w-full rounded-lg border border-input bg-background " +
                        "p-3 font-mono text-xs outline-none focus:ring-2 " +
                        "focus:ring-ring/25 disabled:opacity-60"
                    }
                />

                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label
                            htmlFor="email-date-format"
                            className="mb-2 block text-sm font-medium"
                        >
                            Date format in email
                        </label>

                        <select
                            id="email-date-format"
                            value={dateFormat}
                            disabled={pasteLocked}
                            onChange={(event) => setDateFormat(event.target.value)}
                            className={inputClass}
                        >
                            <option value="mdy">MM/DD/YYYY</option>
                            <option value="dmy">DD/MM/YYYY</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={pasteLocked || !hasPastedText}
                        className={buttonClass}
                    >
                        {busy === "extract" ? "Extracting…" : "Extract invoices"}
                    </button>

                    <button
                        type="button"
                        disabled={pasteLocked || !hasPastedText}
                        onClick={() => setEmailText("")}
                        className={secondaryClass}
                    >
                        Clear text
                    </button>
                </div>

                <p className="text-xs text-muted-foreground">
                    Sales order: SL → D365 · KP → AX · Both for the same
                    invoice → AX/D365. Matching invoice rows are grouped.
                </p>

                {(hasSaved || hasUnknown) && (
                    <p className="text-sm text-muted-foreground">
                        Clear this batch before extracting another email.
                        Check any unconfirmed save in the dashboard first.
                    </p>
                )}
            </form>

            {message && (
                <p
                    role="status"
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                >
                    {message}
                </p>
            )}

            {hasDuplicates && (
                <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
                    Duplicate invoice numbers exist in this preview. Combine
                    separate quantities, or remove repeated copies before saving.
                </p>
            )}

            {drafts.length > 0 && (
                <form onSubmit={save} className="space-y-4" aria-busy={busy === "save"}>
                    <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    {[
                                        "Invoice *",
                                        "Supplier *",
                                        "Roll quantity",
                                        "Meters",
                                        "System *",
                                        "Document date *",
                                        "Local / Import *",
                                        "Status / Actions",
                                    ].map((heading) => (
                                        <th key={heading} className="p-3 font-medium">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border bg-card">
                                {drafts.map((row) => {
                                    const locked =
                                        busy !== null ||
                                        hasUnknown ||
                                        isProtected(row);

                                    const matching = drafts.filter(
                                        (item) =>
                                            invoiceKey(item.invoice) ===
                                            invoiceKey(row.invoice),
                                    );

                                    const duplicate =
                                        Boolean(invoiceKey(row.invoice)) &&
                                        matching.length > 1;

                                    function field(
                                        name: EditableField,
                                        label: string,
                                        options: InputHTMLAttributes<HTMLInputElement> = {},
                                    ) {
                                        return (
                                            <input
                                                {...options}
                                                aria-label={`${label}: ${row.invoice}`}
                                                value={row[name]}
                                                disabled={locked}
                                                onChange={(event) =>
                                                    edit(row.id, name, event.target.value)
                                                }
                                                className={inputClass}
                                            />
                                        );
                                    }

                                    return (
                                        <tr key={row.id} className="align-top">
                                            <td className="min-w-[230px] p-3">
                                                {field("invoice", "Invoice number", {
                                                    required: true,
                                                    maxLength: 100,
                                                })}

                                                <details className="mt-2 text-xs">
                                                    <summary className="cursor-pointer text-muted-foreground">
                                                        {row.parts.reduce(
                                                            (sum, part) =>
                                                                sum + part.data.source_row_count,
                                                            0,
                                                        )} source rows
                                                    </summary>

                                                    <ul className="mt-2 space-y-2">
                                                        {row.parts.map((part) => (
                                                            <li key={part.id}>
                                                                {part.name}
                                                                <br />
                                                                Rolls: {part.data.roll_quantity ?? "—"}
                                                                {" · "}
                                                                Meters: {part.data.meter_quantity ?? "—"}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </details>

                                                {row.notes.length > 0 && (
                                                    <details className="mt-2 text-xs">
                                                        <summary className="cursor-pointer text-amber-700 dark:text-amber-300">
                                                            Review notes ({row.notes.length})
                                                        </summary>
                                                        <ul className="mt-2 list-disc space-y-1 pl-4">
                                                            {row.notes.map((note) => (
                                                                <li key={note}>{note}</li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                )}
                                            </td>

                                            <td className="min-w-[200px] p-3">
                                                {field("supplier", "Supplier", {
                                                    required: true,
                                                    maxLength: 250,
                                                })}
                                            </td>

                                            <td className="min-w-[145px] p-3">
                                                {field("quantity", "Roll quantity", {
                                                    type: "number",
                                                    min: 0,
                                                    max: MAX_ROLLS,
                                                    step: 1,
                                                    placeholder: "Optional",
                                                })}
                                            </td>

                                            <td className="min-w-[160px] p-3">
                                                {field("meters", "Meters", {
                                                    type: "number",
                                                    min: 0,
                                                    max: MAX_METERS,
                                                    step: 0.001,
                                                    placeholder: "Optional",
                                                })}
                                            </td>

                                            <td className="min-w-[140px] p-3">
                                                <select
                                                    aria-label={`System: ${row.invoice}`}
                                                    required
                                                    disabled={locked}
                                                    value={row.system}
                                                    onChange={(event) =>
                                                        edit(row.id, "system", event.target.value)
                                                    }
                                                    className={inputClass}
                                                >
                                                    <option value="">Select</option>
                                                    <option value="AX">AX</option>
                                                    <option value="D365">D365</option>
                                                    <option value="AX/D365">AX/D365</option>
                                                </select>
                                            </td>

                                            <td className="min-w-[170px] p-3">
                                                {field("date", "Document date", {
                                                    type: "date",
                                                    required: true,
                                                    min: "0001-01-01",
                                                    max: "9999-12-31",
                                                })}
                                            </td>

                                            <td className="min-w-[150px] p-3">
                                                <select
                                                    aria-label={`Local / Import: ${row.invoice}`}
                                                    required
                                                    disabled={locked}
                                                    value={row.shipment}
                                                    onChange={(event) =>
                                                        edit(row.id, "shipment", event.target.value)
                                                    }
                                                    className={inputClass}
                                                >
                                                    <option value="">Select</option>
                                                    <option value="LOCAL">Local</option>
                                                    <option value="IMPORT">Import</option>
                                                </select>
                                            </td>

                                            <td className="min-w-[230px] p-3">
                                                <p className="font-medium">
                                                    {row.status === "saved"
                                                        ? "Saved"
                                                        : row.status === "saving"
                                                            ? "Saving…"
                                                            : row.status === "unknown"
                                                                ? "Check dashboard"
                                                                : duplicate
                                                                    ? "Duplicate invoice"
                                                                    : row.status === "error"
                                                                        ? "Needs correction"
                                                                        : "Draft"}
                                                </p>

                                                {row.message && (
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        {row.message}
                                                    </p>
                                                )}

                                                {duplicate && !isProtected(row) && (
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            locked ||
                                                            matching.some(isProtected)
                                                        }
                                                        onClick={() => combine(row)}
                                                        className={`${secondaryClass} mt-3`}
                                                    >
                                                        Combine quantities
                                                    </button>
                                                )}

                                                {!isProtected(row) && (
                                                    <button
                                                        type="button"
                                                        disabled={locked}
                                                        onClick={() => removeDraft(row)}
                                                        className="mt-3 block text-xs underline disabled:opacity-50"
                                                    >
                                                        Remove draft
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p role="status" className="text-sm text-muted-foreground">
                            {savedCount} saved · {remaining} remaining
                        </p>

                        <button
                            type="submit"
                            disabled={
                                busy !== null ||
                                hasUnknown ||
                                hasDuplicates ||
                                hasPastedText ||
                                remaining === 0
                            }
                            className={buttonClass}
                        >
                            {busy === "save"
                                ? "Saving…"
                                : `Save ${remaining} invoices`}
                        </button>
                    </div>
                </form>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href="/dashboard"
                    onClick={(event) => {
                        if (operation.current) {
                            event.preventDefault();
                            return;
                        }

                        if (
                            hasWork &&
                            !window.confirm(
                                "Leave this batch? Unsaved drafts will be discarded. " +
                                "Saved invoices remain in the dashboard.",
                            )
                        ) {
                            event.preventDefault();
                        }
                    }}
                    className="text-sm text-blue-700 hover:underline dark:text-blue-400"
                >
                    Back to dashboard
                </Link>

                {(drafts.length > 0 || hasPastedText) && (
                    <button
                        type="button"
                        disabled={busy !== null}
                        onClick={clearBatch}
                        className={secondaryClass}
                    >
                        Clear batch
                    </button>
                )}
            </div>
        </div>
    );
}