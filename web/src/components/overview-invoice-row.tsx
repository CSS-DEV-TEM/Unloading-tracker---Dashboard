"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
    invoiceNumber: string;
    supplier: string;
    systemType: string;
    columnCount: number;
    children: ReactNode;
    details: ReactNode;
};

export default function OverviewInvoiceRow({
    invoiceNumber,
    supplier,
    systemType,
    columnCount,
    children,
    details,
}: Props) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const titleId = useId();
    const trigger = useRef<HTMLButtonElement>(null);

    function close() {
        setOpen(false);
        trigger.current?.focus();
    }

    return (
        <>
            <tr className="group hover:bg-muted focus-within:bg-muted [&>td]:border-b [&>td]:border-border">
                {children}

                <td className="px-1.5 py-2.5 align-top">
                    <button
                        ref={trigger}
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={`${open ? "Hide" : "View"
                            } progress for invoice ${invoiceNumber}`}
                        onClick={() => setOpen((value) => !value)}
                        className="inline-flex items-center gap-1 rounded-lg
                            px-1 py-2 text-[11px] font-medium
                            text-blue-700 hover:bg-muted
                            focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-ring
                            dark:text-blue-400"
                    >
                        {open ? (
                            <ChevronDown
                                className="size-3 shrink-0"
                                aria-hidden="true"
                            />
                        ) : (
                            <ChevronRight
                                className="size-3 shrink-0"
                                aria-hidden="true"
                            />
                        )}

                        {open ? "Hide progress" : "View progress"}
                    </button>
                </td>
            </tr>

            <tr hidden={!open}>
                <td
                    colSpan={columnCount}
                    className="border-b border-border bg-background p-3"
                >
                    <section
                        id={panelId}
                        aria-labelledby={titleId}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                close();
                            }
                        }}
                        className="rounded-xl border border-border
                            bg-card p-4 text-[11px] leading-4"
                    >
                        <div className="mb-3 flex items-start justify-between
                            gap-3 border-b border-border pb-3">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h2
                                    id={titleId}
                                    className="min-w-0 break-words font-semibold"
                                >
                                    Processing progress · {invoiceNumber}
                                </h2>

                                <p className="min-w-0 break-words text-muted-foreground">
                                    {supplier} · {systemType}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={close}
                                className="shrink-0 rounded px-2 py-1
                                    text-muted-foreground hover:bg-muted
                                    hover:text-foreground
                                    focus-visible:outline-none
                                    focus-visible:ring-2
                                    focus-visible:ring-ring"
                            >
                                Close
                            </button>
                        </div>

                        {details}
                    </section>
                </td>
            </tr>
        </>
    );
}