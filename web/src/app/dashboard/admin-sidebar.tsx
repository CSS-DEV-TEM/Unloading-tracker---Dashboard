"use client";
import WorkspaceTopbar from "@/components/workspace-topbar";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
    Truck,
    Activity,
    ArrowUpRight,
    LayoutDashboard,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Settings2,
    Users,
    X,
} from "lucide-react";

type Props = {
    children: ReactNode;
    isAdmin: boolean;
    fullName: string;
};

export default function AdminSidebar({
    children,
    isAdmin,
    fullName,
}: Props) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const groups = [
        {
            label: "Operations",
            links: [
                {
                    href: "/dashboard",
                    label: "Invoices",
                    icon: LayoutDashboard,
                    active:
                        pathname === "/dashboard" ||
                        pathname.startsWith("/dashboard/invoices/"),
                },
                {
                    href: "/dashboard/vehicles",
                    label: "Vehicle management",
                    icon: Truck,
                    active: pathname.startsWith("/dashboard/vehicles"),
                },
            ],
        },
        ...(isAdmin
            ? [
                {
                    label: "Administration",
                    links: [
                        {
                            href: "/dashboard/users",
                            label: "User management",
                            icon: Users,
                            active: pathname.startsWith("/dashboard/users"),
                        },
                        {
                            href: "/dashboard/activity",
                            label: "Activity log",
                            icon: Activity,
                            active: pathname.startsWith("/dashboard/activity"),
                        },
                    ],
                },
            ]
            : []),
        {
            label: "Account",
            links: [
                {
                    href: "/dashboard/settings",
                    label: "Account settings",
                    icon: Settings2,
                    active: pathname.startsWith("/dashboard/settings"),
                },
            ],
        },
    ];

    function navigation(compact = false, onDark = true) {
        return (
            <nav aria-label="Workspace navigation" className="space-y-5">
                {groups.map((group) => (
                    <div key={group.label} className="space-y-1">
                        {!compact && (
                            <p
                                className={[
                                    "px-3 pb-1 text-xs font-medium",
                                    onDark
                                        ? "text-sidebar-foreground/60"
                                        : "text-muted-foreground",
                                ].join(" ")}
                            >
                                {group.label}
                            </p>
                        )}

                        {group.links.map(({ href, label, icon: Icon, active }) => (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? "page" : undefined}
                                aria-label={compact ? label : undefined}
                                title={compact ? label : undefined}
                                onClick={() => setMobileOpen(false)}
                                className={[
                                    "relative flex min-h-11 items-center rounded-md text-sm font-medium",
                                    "transition-colors motion-reduce:transition-none",
                                    "focus-visible:outline-none focus-visible:ring-2",
                                    "focus-visible:ring-sidebar-ring focus-visible:ring-inset",
                                    compact ? "justify-center px-2" : "gap-3 px-3",
                                    active
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                                ].join(" ")}
                            >
                                {active && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary"
                                    />
                                )}
                                <Icon
                                    className={[
                                        "size-[18px] shrink-0",
                                        active ? "text-sidebar-primary" : "",
                                    ].join(" ")}
                                    aria-hidden="true"
                                />
                                {!compact && <span>{label}</span>}
                            </Link>
                        ))}
                    </div>
                ))}
            </nav>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <a
                href="#workspace-content"
                className="sr-only fixed left-4 top-4 z-[100] rounded-md
          bg-primary px-4 py-3 text-primary-foreground
          focus:not-sr-only"
            >
                Skip to workspace content
            </a>

            <aside
                aria-label="Workspace sidebar"
                className={[
                    "fixed inset-y-0 left-0 z-40 hidden flex-col",
                    "border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex",
                    collapsed ? "w-[76px]" : "w-64",
                ].join(" ")}
            >
                <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
                    <Link
                        href="/dashboard"
                        aria-label="EFL 3PL Unloading Tracker"
                        title={collapsed ? "EFL 3PL Unloading Tracker" : undefined}
                        className="flex min-w-0 items-center gap-3 rounded-md"
                    >
                        <Image
                            src="/efl-logo.png"
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="size-10 shrink-0 rounded-lg bg-white object-contain p-1"
                        />

                        {!collapsed && (
                            <span className="min-w-0">
                                <span className="block font-heading text-base font-semibold leading-tight tracking-tight text-white">
                                    Unloading Tracker
                                </span>
                                <span className="mt-0.5 block text-xs text-sidebar-foreground/70">
                                    EFL 3PL · CSS Division
                                </span>
                            </span>
                        )}
                    </Link>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
                    {navigation(collapsed)}
                </div>

                <div className="space-y-1 border-t border-sidebar-border p-3">
                    <Link
                        href="/"
                        title={collapsed ? "Overview" : undefined}
                        aria-label={collapsed ? "Overview" : undefined}
                        className={[
                            "flex min-h-11 items-center rounded-md text-sm",
                            "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                            collapsed ? "justify-center" : "gap-3 px-3",
                        ].join(" ")}
                    >
                        <ArrowUpRight className="size-[18px]" aria-hidden="true" />
                        {!collapsed && <span>Overview</span>}
                    </Link>

                    <button
                        type="button"
                        onClick={() => setCollapsed((value) => !value)}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!collapsed}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={[
                            "flex min-h-11 w-full items-center rounded-md text-sm",
                            "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                            collapsed ? "justify-center" : "gap-3 px-3",
                        ].join(" ")}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
                        ) : (
                            <>
                                <PanelLeftClose
                                    className="size-[18px]"
                                    aria-hidden="true"
                                />
                                <span>Collapse sidebar</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            <div className={collapsed ? "lg:pl-[76px]" : "lg:pl-64"}>
                <header
                    className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
                    onKeyDown={(event) => {
                        if (event.key === "Escape" && mobileOpen) {
                            setMobileOpen(false);

                            const toggle =
                                event.currentTarget.querySelector<HTMLButtonElement>(
                                    'button[aria-controls="mobile-workspace-navigation"]',
                                );

                            toggle?.focus();
                        }
                    }}
                >
                    <WorkspaceTopbar
                        fullName={fullName}
                        isAdmin={isAdmin}
                        mobileOpen={mobileOpen}
                        onToggleMobile={() => setMobileOpen((value) => !value)}
                    />

                    <div
                        id="mobile-workspace-navigation"
                        hidden={!mobileOpen}
                        className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-sidebar-border bg-sidebar p-3 text-sidebar-foreground lg:hidden"
                    >
                        {navigation()}

                        <Link
                            href="/"
                            onClick={() => setMobileOpen(false)}
                            className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                        >
                            <ArrowUpRight
                                className="size-[18px]"
                                aria-hidden="true"
                            />
                            Overview
                        </Link>
                    </div>
                </header>

                <div
                    id="workspace-content"
                    tabIndex={-1}
                    className="min-w-0 scroll-mt-20 outline-none"
                >
                    {children}
                </div>
            </div>
        </div>
    );
}