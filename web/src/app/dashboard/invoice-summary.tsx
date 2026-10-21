import Link from "./summary-filter-link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
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
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="h-24 animate-pulse rounded-xl border
            border-border bg-card motion-reduce:animate-none"
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

    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
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
            <p
                role="status"
                className="rounded-xl border border-border bg-card p-4
          text-sm text-muted-foreground"
            >
                Unable to load the invoice summary. Refresh to try again.
            </p>
        );
    }

    const pending = results[0].count ?? 0;
    const completed = results[1].count ?? 0;
    const rejected = results[2].count ?? 0;

    const cards = [
        {
            label: "Total invoices",
            value: pending + completed + rejected,
            href: "/dashboard",
            icon: FileText,
            iconClass:
                "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
            bar: "bg-primary",
        },
        {
            label: "Pending",
            value: pending,
            href: "/dashboard?status=Pending",
            icon: Clock3,
            iconClass:
                "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
            bar: "bg-amber-500",
        },
        {
            label: "Completed",
            value: completed,
            href: "/dashboard?status=Complete",
            icon: CheckCircle2,
            iconClass:
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
            bar: "bg-emerald-500",
        },
        {
            label: "Rejected",
            value: rejected,
            href: "/dashboard?status=Reject",
            icon: XCircle,
            iconClass:
                "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
            bar: "bg-rose-500",
        },
    ];

    return (
        <section aria-label="Invoice summary" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-foreground">
                    Invoice summary
                </h2>
                <p className="text-xs text-muted-foreground">
                    All time · Independent of table filters
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {cards.map(({ label, value, href, icon: Icon, iconClass, bar }) => (
                    <Link
                        key={label}
                        href={href}
                        className="group relative flex min-h-24 items-center justify-between
              gap-3 overflow-hidden rounded-xl border border-border bg-card py-4 pl-5 pr-4
              shadow-card transition-shadow hover:shadow-raised
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring motion-reduce:transition-none"
                    >
                        <span
                            aria-hidden="true"
                            className={`absolute inset-y-0 left-0 w-1 ${bar}`}
                        />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                                {label}
                            </p>
                            <p className="mt-1 font-heading text-3xl font-semibold tracking-tight tabular-nums">
                                {value.toLocaleString("en-US")}
                            </p>
                        </div>

                        <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                        >
                            <Icon className="size-[18px]" aria-hidden="true" />
                        </span>
                    </Link>
                ))}
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