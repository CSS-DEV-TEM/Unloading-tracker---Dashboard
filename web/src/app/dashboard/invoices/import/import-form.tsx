"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { saveImportedInvoice } from "../new/actions";
import { createClient as createStorageClient } from "@supabase/supabase-js";

type ExtractedInvoice = {
    invoice_number: string;
    supplier: string | null;
    roll_quantity: number | null;
    system_type: string | null;
    document_share_date: string | null;
    shipment_type: string | null;
    source_row_count: number;
    review_notes: string[];
};

type PdfItem = {
    id: string;
    file: File;
    dateFormat: string;
    status: "queued" | "extracting" | "done" | "failed";
    message: string;
    issues: string[];
};

type SourcePart = {
    fileId: string;
    fileName: string;
    data: ExtractedInvoice;
};

type Draft = {
    id: string;
    parts: SourcePart[];
    invoice: string;
    supplier: string;
    quantity: string;
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
    | "system"
    | "date"
    | "shipment";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_QUANTITY = 2147483647;

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

// Always calculate from original source values.
// Manually edited totals are never added together.
function buildDraft(
    parts: SourcePart[],
    id = crypto.randomUUID(),
    invoice = parts[0]?.data.invoice_number ?? "",
): Draft {
    const notes = parts.flatMap((part) =>
        (part.data.review_notes ?? []).map(
            (note) => `${part.fileName}: ${note}`,
        ),
    );

    function consistent(
        values: (string | null)[],
        label: string,
    ): string {
        const cleaned = values.map((value) => (value ?? "").trim());

        if (
            cleaned.every(Boolean) &&
            new Set(cleaned.map(normalize)).size === 1
        ) {
            return cleaned[0];
        }

        notes.push(`${label} is missing or differs. Select the correct value.`);
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
        sourceSystems.every(
            (value) =>
                value === "AX" ||
                value === "D365" ||
                value === "AX/D365",
        )
    ) {
        const systems = new Set(
            sourceSystems.flatMap((value) => value!.split("/")),
        );

        system = systems.size === 2 ? "AX/D365" : [...systems][0];
    } else {
        notes.push("System needs review.");
    }

    const quantities = parts.map((part) => part.data.roll_quantity);
    let quantity = "";

    if (
        quantities.every(
            (value) =>
                typeof value === "number" &&
                Number.isSafeInteger(value) &&
                value >= 0,
        )
    ) {
        const total = quantities.reduce<number>(
            (sum, value) => sum + (value ?? 0),
            0,
        );

        if (Number.isSafeInteger(total) && total <= MAX_QUANTITY) {
            quantity = String(total);
        } else {
            notes.push("Total quantity exceeds the supported limit.");
        }
    } else {
        notes.push("Total left blank because a source quantity is unreadable.");
    }

    return {
        id,
        parts,
        invoice,
        supplier,
        quantity,
        system,
        date,
        shipment,
        notes: [...new Set(notes)],
        status: "draft",
        message: "",
    };
}

async function extractStoredPdf(file: File, dateFormat: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
        throw new Error("PDF storage is not configured.");
    }

    const storageClient = createStorageClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    const preparation = await fetch("/api/invoices/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "upload",
            filename: file.name,
            size: file.size,
        }),
    });

    const prepared = await preparation.json();

    if (!preparation.ok) {
        throw new Error(
            typeof prepared.error === "string"
                ? prepared.error
                : "Unable to prepare the PDF upload.",
        );
    }

    if (
        typeof prepared.path !== "string" ||
        typeof prepared.token !== "string"
    ) {
        throw new Error("Invalid upload response.");
    }

    try {
        const { error } = await storageClient.storage
            .from("invoice-imports")
            .uploadToSignedUrl(
                prepared.path,
                prepared.token,
                file,
                { contentType: "application/pdf" },
            );

        if (error) {
            throw new Error("PDF upload failed. Check your connection and retry.");
        }

        const response = await fetch("/api/invoices/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "extract",
                path: prepared.path,
                filename: file.name,
                date_format: dateFormat,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                typeof result.error === "string"
                    ? result.error
                    : "Extraction failed.",
            );
        }

        return result;
    } finally {
        // Also attempt cleanup after upload/network failures.
        try {
            await fetch("/api/invoices/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "cleanup",
                    path: prepared.path,
                }),
            });
        } catch {
            // Preserve the original extraction result/error.
        }
    }
}

export default function ImportForm() {
    const [files, setFiles] = useState<PdfItem[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [dateFormat, setDateFormat] = useState("mdy");
    const [busy, setBusy] = useState<"extract" | "save" | null>(null);
    const [message, setMessage] = useState("");
    const operation = useRef(false);

    const hasUnknown = drafts.some((row) => row.status === "unknown");
    const hasSaved = drafts.some((row) => row.status === "saved");
    const hasUnsaved = drafts.some((row) => row.status !== "saved");

    const pendingFiles = files.filter(
        (file) => file.status === "queued" || file.status === "failed",
    );

    const remaining = drafts.filter(
        (row) => !isProtected(row),
    ).length;

    const savedCount = drafts.filter(
        (row) => row.status === "saved",
    ).length;

    const counts = new Map<string, number>();

    for (const row of drafts) {
        const key = invoiceKey(row.invoice);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const hasDuplicates = [...counts.values()].some((count) => count > 1);
    const hasWork =
        hasUnsaved ||
        files.some(
            (file) =>
                file.status === "queued" ||
                file.status === "extracting" ||
                file.status === "failed",
        );

    useEffect(() => {
        if (!hasWork && !busy) return;

        function warn(event: BeforeUnloadEvent) {
            event.preventDefault();
            event.returnValue = "";
        }

        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [hasWork, busy]);

    function patchFile(id: string, patch: Partial<PdfItem>) {
        setFiles((current) =>
            current.map((file) =>
                file.id === id ? { ...file, ...patch } : file,
            ),
        );
    }

    function patchRow(id: string, patch: Partial<Draft>) {
        setDrafts((current) =>
            current.map((row) =>
                row.id === id ? { ...row, ...patch } : row,
            ),
        );
    }

    function edit(id: string, field: EditableField, value: string) {
        patchRow(id, {
            [field]: value,
            status: "draft",
            message: "",
        });
    }

    function addFiles(selected: FileList | null) {
        if (!selected || operation.current || hasSaved || hasUnknown) return;

        const additions: PdfItem[] = [];
        const notices: string[] = [];

        for (const file of Array.from(selected)) {
            if (
                !file.name.toLowerCase().endsWith(".pdf") ||
                file.size === 0 ||
                file.size > MAX_BYTES
            ) {
                notices.push(`${file.name}: select a non-empty PDF up to 10 MB.`);
                continue;
            }

            // Catch accidental reselection of the same file.
            // This is not content-based duplicate detection.
            const alreadySelected = [...files, ...additions].some(
                (item) =>
                    item.file.name === file.name &&
                    item.file.size === file.size &&
                    item.file.lastModified === file.lastModified,
            );

            if (alreadySelected) {
                notices.push(`${file.name}: already selected.`);
                continue;
            }

            additions.push({
                id: crypto.randomUUID(),
                file,
                dateFormat,
                status: "queued",
                message: "Ready to extract",
                issues: [],
            });
        }

        setFiles((current) => [...current, ...additions]);
        setMessage(notices.join(" "));
    }

    async function extract(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            operation.current ||
            hasSaved ||
            hasUnknown ||
            pendingFiles.length === 0
        ) {
            return;
        }

        operation.current = true;
        setBusy("extract");
        setMessage("");

        let failed = 0;

        try {
            for (const item of pendingFiles) {
                patchFile(item.id, {
                    status: "extracting",
                    message: "Extracting…",
                    issues: [],
                });

                try {
                    const result = await extractStoredPdf(
                        item.file,
                        item.dateFormat,
                    );

                    if (!Array.isArray(result.invoices)) {
                        throw new Error("Invalid extraction response.");
                    }

                    const invoices = result.invoices as ExtractedInvoice[];

                    const rows = invoices.map((data) =>
                        buildDraft([
                            {
                                fileId: item.id,
                                fileName: item.file.name,
                                data,
                            },
                        ]),
                    );

                    const issues = Array.isArray(result.document_issues)
                        ? result.document_issues.map(
                            (issue: { message: string }) => issue.message,
                        )
                        : [];

                    setDrafts((current) => [...current, ...rows]);

                    patchFile(item.id, {
                        status: "done",
                        message:
                            `${invoices.length} invoices · ` +
                            `${result.source_rows ?? 0} source rows`,
                        issues:
                            invoices.length === 0
                                ? [...issues, "No invoice drafts extracted."]
                                : issues,
                    });
                } catch (cause) {
                    failed += 1;

                    patchFile(item.id, {
                        status: "failed",
                        message:
                            cause instanceof Error
                                ? cause.message
                                : "Extraction failed. Try again.",
                    });
                }
            }

            setMessage(
                failed
                    ? `${failed} PDF(s) failed. Retry extraction or remove them. Successful results are retained.`
                    : "Extraction complete. Review invoice details before saving.",
            );
        } finally {
            operation.current = false;
            setBusy(null);
        }
    }

    function removeFile(id: string) {
        if (operation.current || hasUnknown) return;

        const affected = drafts.filter(
            (row) =>
                !isProtected(row) &&
                row.parts.some((part) => part.fileId === id),
        );

        if (
            affected.length > 0 &&
            !window.confirm(
                "Remove this PDF? Its unsaved data will be removed. " +
                "Affected combined rows will be recalculated from remaining PDFs, " +
                "resetting their manual edits except the invoice number. " +
                "Saved invoices will remain unchanged.",
            )
        ) {
            return;
        }

        setFiles((current) => current.filter((file) => file.id !== id));

        setDrafts((current) =>
            current.flatMap((row) => {
                if (
                    isProtected(row) ||
                    !row.parts.some((part) => part.fileId === id)
                ) {
                    return [row];
                }

                const parts = row.parts.filter((part) => part.fileId !== id);

                return parts.length
                    ? [buildDraft(parts, row.id, row.invoice)]
                    : [];
            }),
        );

        setMessage("PDF removed from this batch. Saved invoices are unchanged.");
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
                "The total will use original extracted quantities. " +
                "Manual edits in these drafts will be reset except the invoice number.",
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
                if (item.id === matches[0].id) return [merged];
                return ids.has(item.id) ? [] : [item];
            }),
        );

        setMessage("Drafts combined. Review the quantity and required fields.");
    }

    function removeDraft(row: Draft) {
        if (operation.current || isProtected(row) || hasUnknown) return;

        if (!window.confirm(`Remove draft "${row.invoice}" from this preview?`)) {
            return;
        }

        setDrafts((current) => current.filter((item) => item.id !== row.id));
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (operation.current || hasUnknown) return;

        if (pendingFiles.length > 0) {
            setMessage("Extract or remove the queued/failed PDFs before saving.");
            return;
        }

        if (hasDuplicates) {
            setMessage(
                "Resolve duplicate invoice numbers first: combine separate quantities, " +
                "remove repeated copies, or correct an invoice number.",
            );
            return;
        }

        const pending = drafts.filter((row) => !isProtected(row));
        if (pending.length === 0) return;

        operation.current = true;
        setBusy("save");
        setMessage("");

        let failed = 0;

        try {
            for (const row of pending) {
                patchRow(row.id, { status: "saving", message: "Saving…" });

                const form = new FormData();
                form.set("invoice", row.invoice);
                form.set("supplier", row.supplier);
                form.set("rollQuantity", row.quantity);
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

                    if (result.error) {
                        failed += 1;
                        patchRow(row.id, {
                            status: "error",
                            message: result.error,
                        });
                    } else {
                        patchRow(row.id, {
                            status: "saved",
                            message: "Saved",
                        });
                    }
                } catch {
                    patchRow(row.id, {
                        status: "unknown",
                        message:
                            "Save result unconfirmed. Check this invoice in the dashboard.",
                    });

                    setMessage(
                        "Saving stopped after a connection error. Check the dashboard " +
                        "before clearing this batch or importing again.",
                    );
                    return;
                }
            }

            setMessage(
                failed
                    ? `${failed} invoice(s) failed. Correct or remove those drafts and retry. Saved rows will not be resubmitted.`
                    : "All remaining invoices saved.",
            );
        } finally {
            operation.current = false;
            setBusy(null);
        }
    }

    function clearBatch() {
        if (operation.current) return;

        if (
            hasWork &&
            !window.confirm(
                hasUnknown
                    ? "Check the unconfirmed invoice in the dashboard first. " +
                    "Clear this batch now? Saved invoices will remain."
                    : "Clear selected PDFs and unsaved drafts? Saved invoices will remain.",
            )
        ) {
            return;
        }

        setFiles([]);
        setDrafts([]);
        setMessage("");
    }

    return (
        <div className="mt-6 space-y-5">
            <form
                onSubmit={extract}
                className="rounded-xl border border-border bg-card p-5"
            >
                <fieldset
                    disabled={busy !== null || hasSaved || hasUnknown}
                    className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end"
                >
                    <div>
                        <label
                            htmlFor="invoice-pdfs"
                            className="mb-2 block text-sm font-medium"
                        >
                            Add invoice PDFs
                        </label>

                        <input
                            id="invoice-pdfs"
                            type="file"
                            multiple
                            accept=".pdf,application/pdf"
                            onChange={(event) => {
                                addFiles(event.target.files);
                                event.target.value = "";
                            }}
                            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="default-date-format"
                            className="mb-2 block text-sm font-medium"
                        >
                            Default date format
                        </label>

                        <select
                            id="default-date-format"
                            value={dateFormat}
                            onChange={(event) => setDateFormat(event.target.value)}
                            className={inputClass}
                        >
                            <option value="mdy">Month / Day / Year</option>
                            <option value="dmy">Day / Month / Year</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={pendingFiles.length === 0}
                        className={buttonClass}
                    >
                        {busy === "extract"
                            ? "Extracting…"
                            : `Extract / retry (${pendingFiles.length})`}
                    </button>
                </fieldset>

                <p className="mt-3 text-xs text-muted-foreground">
                    Maximum 10 MB and 50 pages per PDF. Files are extracted one
                    at a time. You can add more PDFs before saving.
                </p>

                {hasSaved && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        This batch has saved invoices. Finish the remaining
                        drafts, then clear the batch to add new PDFs.
                    </p>
                )}
            </form>

            {files.length > 0 && (
                <section className="rounded-xl border border-border bg-card p-4">
                    <h2 className="font-semibold">
                        Selected PDFs ({files.length})
                    </h2>

                    <ul className="mt-3 divide-y divide-border">
                        {files.map((item) => (
                            <li key={item.id} className="py-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="break-all text-sm font-medium">
                                            {item.file.name}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                            {" · "}
                                            {item.message}
                                        </p>
                                    </div>

                                    <select
                                        aria-label={`Date format for ${item.file.name}`}
                                        value={item.dateFormat}
                                        disabled={
                                            busy !== null ||
                                            item.status === "done" ||
                                            hasSaved ||
                                            hasUnknown
                                        }
                                        onChange={(event) =>
                                            patchFile(item.id, {
                                                dateFormat: event.target.value,
                                            })
                                        }
                                        className={`${inputClass} max-w-[190px]`}
                                    >
                                        <option value="mdy">Month / Day / Year</option>
                                        <option value="dmy">Day / Month / Year</option>
                                    </select>

                                    <button
                                        type="button"
                                        disabled={busy !== null || hasUnknown}
                                        onClick={() => removeFile(item.id)}
                                        className={secondaryClass}
                                    >
                                        Remove PDF
                                    </button>
                                </div>

                                {item.issues.length > 0 && (
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                        {item.issues.map((issue, index) => (
                                            <li key={index}>{issue}</li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {message && (
                <p
                    role="status"
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                >
                    {message}
                </p>
            )}

            {hasDuplicates && (
                <p className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-4 text-sm">
                    Duplicate invoice numbers found. Use “Combine quantities”
                    only for separate quantities. Remove repeated copies.
                </p>
            )}

            {drafts.length > 0 && (
                <form onSubmit={save} className="space-y-4">
                    <h2 className="font-semibold">
                        Review invoices ({drafts.length})
                    </h2>

                    <div className="overflow-x-auto rounded-xl border border-border bg-card">
                        <table className="w-full min-w-[1250px] text-left text-sm">
                            <caption className="sr-only">
                                Editable invoices extracted from selected PDFs
                            </caption>

                            <thead className="bg-muted">
                                <tr>
                                    {[
                                        "Invoice *",
                                        "Supplier *",
                                        "Roll qty",
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

                            <tbody>
                                {drafts.map((row) => {
                                    const locked =
                                        busy !== null ||
                                        isProtected(row) ||
                                        hasUnknown;

                                    const duplicate =
                                        (counts.get(invoiceKey(row.invoice)) ?? 0) > 1;

                                    const matchingRows = drafts.filter(
                                        (item) =>
                                            invoiceKey(item.invoice) ===
                                            invoiceKey(row.invoice),
                                    );

                                    function textInput(
                                        field: EditableField,
                                        label: string,
                                        options: {
                                            type?: string;
                                            required?: boolean;
                                            maxLength?: number;
                                            min?: string | number;
                                            max?: string | number;
                                            step?: number;
                                        } = {},
                                    ) {
                                        return (
                                            <input
                                                {...options}
                                                aria-label={`${label}: ${row.invoice}`}
                                                value={row[field]}
                                                disabled={locked}
                                                onChange={(event) =>
                                                    edit(row.id, field, event.target.value)
                                                }
                                                className={inputClass}
                                            />
                                        );
                                    }

                                    return (
                                        <tr
                                            key={row.id}
                                            className="border-t border-border align-top"
                                        >
                                            <td className="w-[260px] p-3">
                                                {textInput("invoice", "Invoice number", {
                                                    required: true,
                                                    maxLength: 100,
                                                })}

                                                <details className="mt-2 text-xs">
                                                    <summary className="cursor-pointer text-blue-700 dark:text-blue-400">
                                                        Sources ({row.parts.length})
                                                    </summary>

                                                    <ul className="mt-2 space-y-2 text-muted-foreground">
                                                        {row.parts.map((part, index) => (
                                                            <li key={index} className="break-all">
                                                                {part.fileName}
                                                                {" · Qty: "}
                                                                {part.data.roll_quantity ?? "blank"}
                                                                {" · "}
                                                                {part.data.source_row_count} row(s)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </details>

                                                {row.notes.length > 0 && (
                                                    <details className="mt-2 text-xs">
                                                        <summary className="cursor-pointer">
                                                            Source / review notes
                                                        </summary>
                                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                                                            {row.notes.map((note, index) => (
                                                                <li key={index}>{note}</li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                )}
                                            </td>

                                            <td className="min-w-[180px] p-3">
                                                {textInput("supplier", "Supplier", {
                                                    required: true,
                                                    maxLength: 250,
                                                })}
                                            </td>

                                            <td className="w-[125px] p-3">
                                                {textInput("quantity", "Roll quantity", {
                                                    type: "number",
                                                    min: 0,
                                                    max: MAX_QUANTITY,
                                                    step: 1,
                                                })}
                                            </td>

                                            <td className="w-[150px] p-3">
                                                <select
                                                    aria-label={`System: ${row.invoice}`}
                                                    required
                                                    value={row.system}
                                                    disabled={locked}
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

                                            <td className="w-[180px] p-3">
                                                {textInput("date", "Document date", {
                                                    type: "date",
                                                    required: true,
                                                    min: "0001-01-01",
                                                    max: "9999-12-31",
                                                })}
                                            </td>

                                            <td className="w-[155px] p-3">
                                                <select
                                                    aria-label={`Shipment: ${row.invoice}`}
                                                    required
                                                    value={row.shipment}
                                                    disabled={locked}
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

                                            <td className="min-w-[210px] p-3">
                                                <p className="font-medium">
                                                    {row.status === "unknown"
                                                        ? "Check dashboard"
                                                        : row.status === "saved"
                                                            ? "Saved"
                                                            : row.status === "saving"
                                                                ? "Saving…"
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
                                                            matchingRows.some(isProtected)
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
                        <p className="text-sm text-muted-foreground" role="status">
                            {savedCount} saved · {remaining} remaining
                        </p>

                        <button
                            type="submit"
                            disabled={
                                busy !== null ||
                                hasUnknown ||
                                hasDuplicates ||
                                pendingFiles.length > 0 ||
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

                {(files.length > 0 || drafts.length > 0) && (
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