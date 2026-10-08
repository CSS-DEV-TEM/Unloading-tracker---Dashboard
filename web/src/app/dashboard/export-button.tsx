"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export default function ExportButton() {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function downloadExcel() {
        if (pending) return;

        setPending(true);
        setError("");

        try {
            const response = await fetch("/dashboard/export", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
            });

            if (!response.ok) {
                const result = await response.json().catch(() => null);

                throw new Error(
                    result?.error ?? "Unable to download the Excel file.",
                );
            }

            const contentType = response.headers.get("content-type") ?? "";

            if (!contentType.includes("spreadsheetml.sheet")) {
                throw new Error(
                    "The export response was invalid. Please sign in again.",
                );
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "Unloading-Tracker.xlsx";

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Unable to download the Excel file.",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={downloadExcel}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-card px-5 py-3 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:cursor-wait disabled:opacity-60"
            >
                {pending ? (
                    <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                    />
                ) : (
                    <Download className="size-4" aria-hidden="true" />
                )}

                {pending ? "Preparing Excel..." : "Export all Excel"}
            </button>

            {error && (
                <p role="alert" className="mt-2 max-w-sm text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}