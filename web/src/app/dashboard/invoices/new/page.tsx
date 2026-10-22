import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardPaste } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import InvoiceForm from "./invoice-form";

async function NewInvoiceContent() {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/login");
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        error ||
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        redirect("/dashboard");
    }

    const parts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const part = (type: string) =>
        parts.find((item) => item.type === type)?.value ?? "";

    const today = `${part("year")}-${part("month")}-${part("day")}`;

    return (
        <main className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-4 text-foreground sm:px-6">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Link
                        href="/dashboard"
                        aria-label="Back to invoices"
                        title="Back to invoices"
                        className="inline-flex size-10 shrink-0 items-center
                        justify-center rounded-md border border-input
                        bg-card text-muted-foreground transition-colors
                        hover:bg-muted hover:text-foreground
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-ring"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                    </Link>

                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                            New invoice
                        </h1>

                        <p className="mt-1 text-xs text-muted-foreground">
                            Enter the details below. Fields marked * are required.
                        </p>
                    </div>
                </div>

                <Link
                    href="/dashboard/invoices/import"
                    className="inline-flex min-h-10 items-center justify-center
                    gap-2 rounded-md border border-input bg-card px-4
                    text-sm font-medium shadow-sm transition-colors
                    hover:bg-muted focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ClipboardPaste className="size-4" aria-hidden="true" />
                    Import from email
                </Link>
            </header>

            <InvoiceForm today={today} />
        </main>
    );
}

function FormSkeleton() {
    return (
        <div
            role="status"
            aria-label="Loading invoice form"
            className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6"
        >
            <span className="sr-only">Loading invoice form…</span>

            <div
                aria-hidden="true"
                className="animate-pulse space-y-5 motion-reduce:animate-none"
            >
                <div className="h-6 w-32 rounded bg-muted" />
                <div className="h-10 w-56 rounded bg-muted" />

                {[1, 2, 3].map((item) => (
                    <div
                        key={item}
                        className="h-48 rounded-xl border border-border bg-muted/50"
                    />
                ))}
            </div>
        </div>
    );
}

export default function NewInvoicePage() {
    return (
        <Suspense fallback={<FormSkeleton />}>
            <NewInvoiceContent />
        </Suspense>
    );
}