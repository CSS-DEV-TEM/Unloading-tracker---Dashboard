import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
    ArrowUpRight,
    CheckCircle2,
    Clock3,
    FileText,
    XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function SummarySkeleton() {
    return (
        <div
            role="status"
            aria-label="Loading invoice summary"
            className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="h-40 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none"
                />
            ))}
        </div>
    );
}

async function SummaryContent() {
    await connection();

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return (
            <p role="status" className="mb-6 text-sm text-muted-foreground">
                Invoice summary is currently unavailable.
            </p>
        );
    }

    if (
        !profile?.is_active ||
        !["ADMIN", "USER"].includes(profile.role)
    ) {
        return null;
    }

    const results = await Promise.all([
        supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("status", "Pending"),

        supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("status", "Complete"),

        supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("status", "Reject"),
    ]);

    if (results.some((result) => result.error || result.count === null)) {
        return (
            <div
                role="status"
                className="mb-8 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
            >
                Unable to load the invoice summary. Refresh the page to try
                again.
            </div>
        );
    }

    const pending = results[0].count ?? 0;
    const completed = results[1].count ?? 0;
    const rejected = results[2].count ?? 0;
    const total = pending + completed + rejected;

    const cards = [
        {
            label: "Total Invoices",
            value: total,
            description: "All invoice records",
            href: "/dashboard",
            icon: FileText,
            primary: true,
        },
        {
            label: "Pending",
            value: pending,
            description: "Awaiting completion",
            href: "/dashboard?status=Pending",
            icon: Clock3,
            primary: false,
        },
        {
            label: "Completed",
            value: completed,
            description: "Marked as complete",
            href: "/dashboard?status=Complete",
            icon: CheckCircle2,
            primary: false,
        },
        {
            label: "Rejected",
            value: rejected,
            description: "Marked as rejected",
            href: "/dashboard?status=Reject",
            icon: XCircle,
            primary: false,
        },
    ];

    return (
        <section aria-label="Invoice summary" className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                    Overall invoice status
                </h2>

                <p className="text-xs text-muted-foreground">
                    All invoices · Independent of list filters
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;

                    return (
                        <Link
                            key={card.label}
                            href={card.href}
                            className={`group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${card.primary
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-border bg-card text-foreground"
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div
                                    className={`rounded-xl p-2.5 ${card.primary
                                            ? "bg-white/15 text-white"
                                            : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                        }`}
                                >
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </div>

                                <ArrowUpRight
                                    className={`h-4 w-4 ${card.primary
                                            ? "text-blue-100"
                                            : "text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                        }`}
                                    aria-hidden="true"
                                />
                            </div>

                            <p
                                className={`mt-4 text-sm font-medium ${card.primary ? "text-blue-100" : "text-muted-foreground"
                                    }`}
                            >
                                {card.label}
                            </p>

                            <p className="mt-1 text-3xl font-bold tracking-tight">
                                {card.value.toLocaleString("en-US")}
                            </p>

                            <p
                                className={`mt-2 text-xs ${card.primary ? "text-blue-100" : "text-muted-foreground"
                                    }`}
                            >
                                {card.description}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

export default function InvoiceSummary() {
    return (
        <Suspense fallback={<SummarySkeleton />}>
            <SummaryContent />
        </Suspense>
    );
}