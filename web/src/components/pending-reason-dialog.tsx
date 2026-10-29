"use client";

import { useId, useRef } from "react";
import { MessageSquareText, X } from "lucide-react";

type Props = {
    invoiceNumber: string;
    supplier: string;
    reason: string;
    kind?: "pending" | "remark";
    compact?: boolean;
};

export default function PendingReasonDialog({
    invoiceNumber,
    supplier,
    reason,
    kind = "pending",
    compact = false,
}: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const isRemark = kind === "remark";
    const title = isRemark ? "Remark" : "Pending reason";
    const tone = isRemark
        ? "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-400/10"
        : "text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-400/10";

    function closeDialog() {
        dialogRef.current?.close();
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-label={`View ${title.toLowerCase()} for invoice ${invoiceNumber}`}
                onClick={() => dialogRef.current?.showModal()}
                className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-md font-medium
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                    ${compact ? "min-h-7 px-1 text-[11px] leading-4" : "min-h-9 px-2 text-xs"} ${tone}`}
            >
                <MessageSquareText className="size-3.5 shrink-0" aria-hidden="true" />
                {isRemark ? "Remark" : "View reason"}
            </button>

            <dialog
                ref={dialogRef}
                aria-labelledby={titleId}
                onClose={() => triggerRef.current?.focus()}
                style={{
                    position: "fixed",
                    inset: 0,
                    margin: "auto",
                    width: "calc(100vw - 2rem)",
                    maxWidth: "30rem",
                    maxHeight: "calc(100dvh - 2rem)",
                    overflowY: "auto",
                }}
                className="rounded-2xl border border-border bg-card p-0
          text-left text-card-foreground shadow-2xl
          backdrop:bg-black/60"
            >
                <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isRemark ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300" : "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"}`}
                        >
                            <MessageSquareText className="size-5" aria-hidden="true" />
                        </div>

                        <div>
                            <h2 id={titleId} className="text-base font-semibold">
                                {title}
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {isRemark ? "Invoice note" : "Invoice processing update"}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeDialog}
                        aria-label={`Close ${title.toLowerCase()}`}
                        className="inline-flex size-10 shrink-0 items-center
              justify-center rounded-lg text-muted-foreground
              hover:bg-muted hover:text-foreground
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-5 p-5">
                    <dl className="grid gap-3 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">Invoice</dt>
                            <dd className="mt-1 font-semibold [overflow-wrap:anywhere]">
                                {invoiceNumber}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-xs text-muted-foreground">Supplier</dt>
                            <dd className="mt-1 [overflow-wrap:anywhere]">{supplier}</dd>
                        </div>
                    </dl>

                    <div
                        style={{
                            backgroundColor: "var(--background)",
                            color: "var(--foreground)",
                            borderColor: "var(--border)",
                            borderLeft: `3px solid ${isRemark ? "#2563eb" : "#f59e0b"}`,
                        }}
                        className="rounded-xl border p-4"
                    >
                        <p
                            style={{ color: "var(--muted-foreground)" }}
                            className="text-xs font-semibold"
                        >
                            {isRemark ? "Remark" : "Reason for pending status"}
                        </p>

                        <p
                            style={{ color: "var(--foreground)" }}
                            className="mt-2 whitespace-pre-wrap text-sm leading-6
                               [overflow-wrap:anywhere]"
                        >
                            {reason}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end border-t border-border px-5 py-4">
                    <button
                        autoFocus
                        type="button"
                        onClick={closeDialog}
                        className="inline-flex min-h-11 items-center justify-center
              rounded-lg border border-input bg-card px-5 text-sm
              font-medium hover:bg-muted focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Close
                    </button>
                </div>
            </dialog>
        </>
    );
}