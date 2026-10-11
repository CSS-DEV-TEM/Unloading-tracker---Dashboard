"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteInvoice } from "./delete-action";

type Props = {
    invoiceId: string;
    invoiceNumber: string;
    supplier: string;
    version: number;
};

export default function DeleteInvoiceButton({
    invoiceId,
    invoiceNumber,
    supplier,
    version,
}: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [confirmation, setConfirmation] = useState("");

    const [state, formAction, pending] = useActionState(
        deleteInvoice,
        { error: "" },
    );

    function openDialog() {
        setConfirmation("");
        dialogRef.current?.showModal();
    }

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                aria-label={`Delete invoice ${invoiceNumber}`}
                title="Delete invoice"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            >
                <Trash2 className="size-4" aria-hidden="true" />
            </button>

            <dialog
                ref={dialogRef}
                aria-labelledby="delete-invoice-title"
                aria-describedby="delete-invoice-description"
                onCancel={(event) => {
                    if (pending) event.preventDefault();
                }}
                style={{
                    position: "fixed",
                    inset: 0,
                    margin: "auto",
                    width: "calc(100vw - 2rem)",
                    maxWidth: "28rem",
                    maxHeight: "calc(100dvh - 2rem)",
                    overflowY: "auto",
                }}
                className="rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60"
            >
                <form action={formAction} aria-busy={pending}>
                    <input
                        type="hidden"
                        name="invoiceId"
                        value={invoiceId}
                    />
                    <input
                        type="hidden"
                        name="version"
                        value={version}
                    />

                    <div className="space-y-4 p-6">
                        <h2
                            id="delete-invoice-title"
                            className="text-lg font-semibold"
                        >
                            Delete invoice?
                        </h2>

                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <p className="break-words text-sm font-semibold">
                                {invoiceNumber}
                            </p>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                                {supplier}
                            </p>
                        </div>

                        <p
                            id="delete-invoice-description"
                            className="text-sm leading-6 text-muted-foreground"
                        >
                            This permanently removes the invoice and its
                            processing and ASN records. Activity history is
                            retained. This action cannot be undone.
                        </p>

                        <div>
                            <label
                                htmlFor="delete-invoice-confirmation"
                                className="mb-2 block text-sm font-medium"
                            >
                                Type the invoice number to confirm
                            </label>

                            <input
                                id="delete-invoice-confirmation"
                                name="confirmation"
                                value={confirmation}
                                onChange={(event) =>
                                    setConfirmation(event.target.value)
                                }
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                maxLength={100}
                                required
                                readOnly={pending}
                                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </div>

                        {state.error && (
                            <p
                                role="alert"
                                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            >
                                {state.error}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                        <button
                            type="button"
                            autoFocus
                            disabled={pending}
                            onClick={() => dialogRef.current?.close()}
                            className="min-h-11 rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={
                                pending || confirmation !== invoiceNumber
                            }
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {pending ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Trash2
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            )}

                            {pending ? "Deleting…" : "Delete invoice"}
                        </button>
                    </div>
                </form>
            </dialog>
        </>
    );
}