"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/login/actions";
import ThemeToggle from "@/components/theme-toggle";

type Props = {
    fullName: string;
    isAdmin: boolean;
    mobileOpen: boolean;
    onToggleMobile: () => void;
};

function getPage(pathname: string) {
    if (pathname === "/dashboard") {
        return { title: "Invoices", parent: null };
    }

    if (pathname === "/dashboard/invoices/new") {
        return {
            title: "New invoice",
            parent: { label: "Invoices", href: "/dashboard" },
        };
    }

    const details = pathname.match(
        /^\/dashboard\/invoices\/([^/]+)\/details$/,
    );

    if (details) {
        return {
            title: "Edit invoice details",
            parent: {
                label: "Invoice process",
                href: `/dashboard/invoices/${details[1]}`,
            },
        };
    }

    if (pathname.startsWith("/dashboard/invoices/")) {
        return {
            title: "Invoice process",
            parent: { label: "Invoices", href: "/dashboard" },
        };
    }

    if (pathname.startsWith("/dashboard/users")) {
        return { title: "User management", parent: null };
    }

    if (pathname.startsWith("/dashboard/activity")) {
        return { title: "Activity log", parent: null };
    }

    if (pathname.startsWith("/dashboard/settings")) {
        return { title: "Account settings", parent: null };
    }

    return { title: "Workspace", parent: null };
}

function SignOutButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            aria-label={pending ? "Signing out…" : "Sign out"}
            title="Sign out"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="hidden xl:inline">
                {pending ? "Signing out…" : "Sign out"}
            </span>
        </button>
    );
}

export default function WorkspaceTopbar({
    fullName,
    isAdmin,
    mobileOpen,
    onToggleMobile,
}: Props) {
    const pathname = usePathname();
    const page = getPage(pathname);
    const name = fullName.trim() || "User";

    const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0])
        .join("")
        .toUpperCase();

    return (
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onToggleMobile}
                    aria-label={
                        mobileOpen ? "Close navigation" : "Open navigation"
                    }
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-workspace-navigation"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                >
                    {mobileOpen ? (
                        <X aria-hidden="true" className="size-5" />
                    ) : (
                        <Menu aria-hidden="true" className="size-5" />
                    )}
                </button>

                <nav
                    aria-label="Breadcrumb"
                    className="min-w-0 overflow-x-auto"
                >
                    <ol className="flex items-center gap-2 whitespace-nowrap text-sm">
                        {page.parent && page.parent.href !== "/dashboard" && (
                            <li className="flex shrink-0 items-center gap-2">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex min-h-11 items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Invoices
                                </Link>

                                <ChevronRight
                                    aria-hidden="true"
                                    className="size-4 text-muted-foreground"
                                />
                            </li>
                        )}

                        {page.parent && (
                            <li className="flex shrink-0 items-center gap-2">
                                <Link
                                    href={page.parent.href}
                                    className="inline-flex min-h-11 items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {page.parent.label}
                                </Link>

                                <ChevronRight
                                    aria-hidden="true"
                                    className="size-4 text-muted-foreground"
                                />
                            </li>
                        )}

                        <li
                            aria-current="page"
                            className="shrink-0 font-semibold text-foreground"
                        >
                            {page.title}
                        </li>
                    </ol>
                </nav>
            </div>

            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <ThemeToggle />


                <div className="hidden items-center gap-3 border-l border-border pl-4 sm:flex">
                    <div
                        aria-hidden="true"
                        className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-800 dark:bg-blue-400/10 dark:text-blue-300"
                    >
                        {initials}
                    </div>

                    <div className="hidden min-w-0 md:block">
                        <p
                            className="max-w-40 truncate text-sm font-medium text-foreground"
                            title={name}
                        >
                            {name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isAdmin ? "Administrator" : "User"}
                        </p>
                    </div>

                    <span className="sr-only md:hidden">
                        {name}, {isAdmin ? "Administrator" : "User"}
                    </span>
                </div>
                <form action={signOut} className="shrink-0">
                    <SignOutButton />
                </form>
            </div>
        </div>
    );
}