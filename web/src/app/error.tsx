"use client";

import { AlertCircle, RefreshCw, House } from "lucide-react";

type Props = {
    error: Error & { digest?: string };
};

export default function AppError({ error }: Props) {
    return (
        <main className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-12">
            <section
                role="alert"
                className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
            >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                    <AlertCircle className="h-8 w-8" aria-hidden="true" />
                </div>

                <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                    Unloading Tracker
                </p>

                <h1 className="mt-3 text-2xl font-semibold text-foreground">
                    We couldn’t load this page
                </h1>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Please reload the page to try again. If the problem
                    continues, contact your administrator.
                </p>

                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    If this happened after saving, check the record before
                    submitting the same change again.
                </p>

                {error.digest && (
                    <p className="mt-5 break-all rounded-lg bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
                        Reference: {error.digest}
                    </p>
                )}

                <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Reload page
                    </button>

                    <a
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-input px-5 py-3 text-sm font-medium text-foreground hover:bg-background"
                    >
                        <House className="h-4 w-4" aria-hidden="true" />
                        Public overview
                    </a>
                </div>
            </section>
        </main>
    );
}