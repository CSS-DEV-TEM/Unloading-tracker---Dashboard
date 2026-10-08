import ThemeToggle from "@/components/theme-toggle";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
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

    // Calculate today's date in Sri Lanka, regardless of server timezone.
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
        <main className="min-h-screen bg-background px-5 py-10 text-foreground">
            <div className="mx-auto max-w-3xl">
                <div className="mb-5 flex justify-end"><ThemeToggle /></div>
                <Link
                    href="/dashboard"
                    className="text-sm text-blue-700 dark:text-blue-400 hover:underline"
                >
                    ← Back to dashboard
                </Link>

                <p className="mt-8 text-xs font-semibold tracking-widest text-blue-700 dark:text-blue-400">
                    EFL · 3PL
                </p>

                <h1 className="mt-2 text-3xl font-semibold">
                    New invoice
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Enter the invoice details to begin tracking.
                    Fields marked * are required.
                </p>

                <section
                    aria-label="New invoice form"
                    className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8"
                >
                    <InvoiceForm today={today} />
                </section>
            </div>
        </main>
    );
}

export default function NewInvoicePage() {
    return (
        <Suspense
            fallback={
                <p className="p-10" role="status">
                    Loading form...
                </p>
            }
        >
            <NewInvoiceContent />
        </Suspense>
    );
}