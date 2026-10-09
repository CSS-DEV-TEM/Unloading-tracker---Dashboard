"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
    href: string;
    className?: string;
    children: ReactNode;
};

export default function SummaryFilterLink({
    href,
    className = "",
    children,
}: Props) {
    const searchParams = useSearchParams();

    const targetQuery = href.split("?")[1] ?? "";
    const targetStatus =
        new URLSearchParams(targetQuery).get("status") ?? "";

    const currentStatus = searchParams.get("status") ?? "";

    const selected = currentStatus === targetStatus;

    // Preserve the current search and other filters.
    const nextParams = new URLSearchParams(searchParams.toString());

    // A new status selection starts at the first results page.
    nextParams.delete("page");

    if (targetStatus) {
        nextParams.set("status", targetStatus);
    } else {
        nextParams.delete("status");
    }

    const query = nextParams.toString();
    const nextHref = query ? `/dashboard?${query}` : "/dashboard";

    return (
        <Link
            href={nextHref}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={`${className} ${selected
                    ? "!border-blue-500 !bg-blue-50/70 ring-1 ring-blue-500/20 dark:!border-blue-400 dark:!bg-blue-400/10 dark:ring-blue-400/20"
                    : ""
                }`}
        >
            {children}
        </Link>
    );
}