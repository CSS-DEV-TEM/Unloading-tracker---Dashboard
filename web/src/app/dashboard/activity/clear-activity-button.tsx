"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Trash2, TriangleAlert } from "lucide-react";
import { clearActivityLogs } from "./actions";

function ConfirmationForm({ onClose }: { onClose: () => void }) {
    const [confirmation, setConfirmation] = useState("");
    const [state, formAction, pending] = useActionState(
        clearActivityLogs,
        { error: "", success: "" },
    );

    if (state.success) {
        return (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p
                    role="status"
                    className="flex items-start gap-2.5 text-sm font-medium text-emerald-800 dark:text-emerald-200"
                >
                    <CheckCircle2
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {state.success}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 min-h-10 rounded-md border border-input bg-card px-4
            text-sm font-medium shadow-sm hover:bg-muted"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <form
            action={formAction}
            aria-label="Confirm clearing activity history"
            className="mt-3 rounded-xl border border-red-300 bg-red-50/40
        p-4 dark:border-red-900 dark:bg-red-950/10"
        >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                <TriangleAlert
                    className="size-4 shrink-0"
                    aria-hidden="true"
                />
                Clear all activity history?
            </h2>

            <p
                id="clear-activity-description"
                className="mt-2 text-sm text-muted-foreground"
            >
                This permanently deletes every activity record, including those
                hidden by the current filters. Invoices and users are not
                affected. A new entry will record who cleared the history and
                how many records were removed.
            </p>

            <label
                htmlFor="clear-activity-confirmation"
                className="mb-2 mt-4 block text-sm font-medium"
            >
                Type CLEAR to confirm
            </label>

            <input
                id="clear-activity-confirmation"
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                aria-describedby="clear-activity-description"
                autoComplete="off"
                spellCheck={false}
                required
                pattern="CLEAR"
                maxLength={5}
                disabled={pending}
                className="h-10 w-full max-w-xs rounded-md border
          border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
            />

            {state.error && (
                <p
                    role="alert"
                    className="mt-3 text-sm text-red-700 dark:text-red-300"
                >
                    {state.error}
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
                <button
                    type="submit"
                    disabled={confirmation !== "CLEAR" || pending}
                    className="min-h-10 rounded-md bg-red-700 px-4 py-2
            text-sm font-semibold text-white shadow-sm hover:bg-red-800
            disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {pending ? "Clearing…" : "Permanently clear logs"}
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="min-h-10 rounded-md border border-input bg-card px-4
            py-2 text-sm font-medium shadow-sm hover:bg-muted
            disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}

export default function ClearActivityButton() {
    const [open, setOpen] = useState(false);

    return (
        <section className="mb-6">
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={open}
                aria-expanded={open}
                aria-controls="clear-activity-panel"
                className="inline-flex min-h-10 items-center gap-2 rounded-md
          border border-red-300 bg-card px-4 py-2 text-sm font-medium
          text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50
          dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
            >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear activity log
            </button>

            <div id="clear-activity-panel">
                {open && (
                    <ConfirmationForm onClose={() => setOpen(false)} />
                )}
            </div>
        </section>
    );
}