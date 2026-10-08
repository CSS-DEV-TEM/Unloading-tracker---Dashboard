"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const messages: Record<string, string> = {
    "invoice-created": "Invoice created successfully.",
    "invoice-updated": "Invoice details saved successfully.",
    "process-updated": "Invoice progress saved successfully.",
};

export default function InvoiceSuccessNotice() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const code = searchParams.get("notice");
    const message =
        code && Object.prototype.hasOwnProperty.call(messages, code)
            ? messages[code]
            : null;

    function dismiss() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("notice");

        const query = params.toString();
        const hash = window.location.hash;

        router.replace(
            `${pathname}${query ? `?${query}` : ""}${hash}`,
            { scroll: false },
        );
    }

    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none fixed inset-x-4 top-4 z-50 sm:left-auto sm:right-6 sm:top-6 sm:w-96"
        >
            {message && (
                <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
                    <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-blue-700 dark:text-blue-400"
                    />

                    <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium">
                        {message}
                    </p>

                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Dismiss notification"
                        className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X aria-hidden="true" className="size-4" />
                    </button>
                </div>
            )}
        </div>
    );
}