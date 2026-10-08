import Link from "next/link";
import { FileSearch, ArrowLeft } from "lucide-react";

export default function InvoiceNotFound() {
    return (
        <main className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-12">
            <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                    <FileSearch className="h-8 w-8" aria-hidden="true" />
                </div>

                <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                    Invoice unavailable
                </p>

                <h1 className="mt-3 text-2xl font-semibold text-foreground">
                    Invoice not found
                </h1>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This invoice could not be found or is not available to
                    your account. Return to the dashboard and search for
                    the invoice again.
                </p>

                <Link
                    href="/dashboard"
                    className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to dashboard
                </Link>
            </section>
        </main>
    );
}