"use client";

import { useRef, useState, type FormEvent } from "react";
import { CalendarDays, Download, Loader2 } from "lucide-react";

export default function ExportButton() {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const requestInProgress = useRef(false);

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function openDialog() {
        setError("");
        setSuccess("");
        dialogRef.current?.showModal();
    }

    async function downloadExcel(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (requestInProgress.current) return;

        setError("");
        setSuccess("");

        if (!fromDate || !toDate || fromDate > toDate) {
            setError("Select a valid From date and To date.");
            return;
        }

        requestInProgress.current = true;
        setPending(true);

        try {
            const response = await fetch("/dashboard/export", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fromDate,
                    toDate,
                }),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => null);

                throw new Error(
                    result?.error ?? "Unable to download the Excel file.",
                );
            }

            const contentType =
                response.headers.get("content-type") ?? "";

            if (!contentType.includes("spreadsheetml.sheet")) {
                throw new Error(
                    "The export response was invalid. Please sign in again.",
                );
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download =
                `Unloading-Tracker_${fromDate}_to_${toDate}.xlsx`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(url), 1000);

            setSuccess("Excel file prepared. Check your browser downloads.");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to download the Excel file.",
            );
        } finally {
            requestInProgress.current = false;
            setPending(false);
        }
    }

    const inputClass =
        "block h-11 w-full min-w-0 rounded-lg border border-input " +
        "bg-background px-3 text-sm text-foreground outline-none " +
        "focus-visible:ring-2 focus-visible:ring-ring";

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Download className="size-4" aria-hidden="true" />
                Export Excel
            </button>

            <dialog
                ref={dialogRef}
                aria-labelledby="export-title"
                aria-describedby="export-description"
                onCancel={(event) => {
                    if (pending) event.preventDefault();
                }}
                style={{
                    position: "fixed",
                    inset: 0,
                    margin: "auto",
                    width: "calc(100vw - 2rem)",
                    maxWidth: "32rem",
                    maxHeight: "calc(100dvh - 2rem)",
                    overflowY: "auto",
                }}
                className="rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60"
            >
                <form onSubmit={downloadExcel} aria-busy={pending}>
                    <div className="border-b border-border p-5">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                                <CalendarDays
                                    className="size-5"
                                    aria-hidden="true"
                                />
                            </span>

                            <div>
                                <h2
                                    id="export-title"
                                    className="text-base font-semibold"
                                >
                                    Export invoices
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Select a Document date range
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 p-5">
                        <p
                            id="export-description"
                            className="text-sm leading-6 text-muted-foreground"
                        >
                            Includes all invoices within the selected document
                            dates, including both dates. Dashboard search and
                            status filters do not limit this export.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="min-w-0">
                                <label
                                    htmlFor="export-from"
                                    className="mb-2 block text-sm font-medium"
                                >
                                    From date
                                </label>
                                <input
                                    id="export-from"
                                    type="date"
                                    required
                                    autoFocus
                                    min="0001-01-01"
                                    max={toDate || "9999-12-31"}
                                    value={fromDate}
                                    onChange={(event) => {
                                        setFromDate(event.target.value);
                                        setError("");
                                        setSuccess("");
                                    }}
                                    disabled={pending}
                                    className={inputClass}
                                />
                            </div>

                            <div className="min-w-0">
                                <label
                                    htmlFor="export-to"
                                    className="mb-2 block text-sm font-medium"
                                >
                                    To date
                                </label>
                                <input
                                    id="export-to"
                                    type="date"
                                    required
                                    min={fromDate || "0001-01-01"}
                                    max="9999-12-31"
                                    value={toDate}
                                    onChange={(event) => {
                                        setToDate(event.target.value);
                                        setError("");
                                        setSuccess("");
                                    }}
                                    disabled={pending}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <p className="text-xs leading-5 text-muted-foreground">
                            Up to 10,000 invoices per file. For larger exports,
                            download smaller date ranges.
                        </p>

                        {error && (
                            <p
                                role="alert"
                                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            >
                                {error}
                            </p>
                        )}

                        {success && (
                            <p
                                role="status"
                                className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                                {success}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => dialogRef.current?.close()}
                            className="min-h-11 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
                        >
                            Close
                        </button>

                        <button
                            type="submit"
                            disabled={pending || !fromDate || !toDate}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {pending ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Download
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            )}

                            {pending ? "Preparing…" : "Download Excel"}
                        </button>
                    </div>
                </form>
            </dialog>
        </>
    );
}