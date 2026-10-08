"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { clearActivityLogs } from "./actions";

function ConfirmationForm({ onClose }: { onClose: () => void }) {
    const [confirmation, setConfirmation] = useState("");
    const [state, formAction, pending] = useActionState(
        clearActivityLogs,
        { error: "", success: "" },
    );

    if (state.success) {
        return (
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
                <p role="status" className="text-sm text-foreground">
                    {state.success}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 rounded-lg border border-input px-4 py-2
            text-sm font-medium hover:bg-muted"
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
            className="mt-3 rounded-xl border border-red-300 bg-card
        p-4 dark:border-red-900"
        >
            <h2 className="text-sm font-semibold text-foreground">
                Clear all activity history?
            </h2>

            <p
                id="clear-activity-description"
                className="mt-2 text-sm text-muted-foreground"
            >
                This permanently deletes all activity records, including records
                outside the current filters. Invoice and user data remain.
                A new record will identify who cleared the history and how many
                records were deleted.
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
                className="h-10 w-full max-w-xs rounded-lg border
          border-input bg-card px-3 text-sm"
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
                    className="min-h-10 rounded-lg bg-red-700 px-4 py-2
            text-sm font-medium text-white hover:bg-red-800
            disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {pending ? "Clearing…" : "Permanently clear logs"}
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="min-h-10 rounded-lg border border-input px-4
            py-2 text-sm font-medium hover:bg-muted
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
                className="inline-flex min-h-10 items-center gap-2 rounded-lg
          border border-red-300 px-4 py-2 text-sm font-medium
          text-red-700 hover:bg-red-50 disabled:opacity-50
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