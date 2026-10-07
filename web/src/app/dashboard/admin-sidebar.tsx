"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
    Activity,
    LayoutDashboard,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    ShieldCheck,
    Users,
    X,
} from "lucide-react";

export default function AdminSidebar({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const links = [
        {
            href: "/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            active:
                pathname === "/dashboard" ||
                pathname.startsWith("/dashboard/invoices/"),
        },
        {
            href: "/dashboard/users",
            label: "User Management",
            icon: Users,
            active: pathname.startsWith("/dashboard/users"),
        },
        {
            href: "/dashboard/activity",
            label: "User Activity",
            icon: Activity,
            active: pathname.startsWith("/dashboard/activity"),
        },
    ];

    function renderNavigation(compact: boolean) {
        return (
            <nav
                aria-label="Admin navigation"
                className="space-y-2 px-3 py-4"
            >
                {links.map(({ href, label, icon: Icon, active }) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        aria-label={label}
                        title={compact ? label : undefined}
                        className={`flex min-h-12 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${compact
                            ? "justify-center px-3"
                            : "gap-3 px-4"
                            } ${active
                                ? "bg-blue-600 text-white"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            }`}
                    >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />

                        {!compact && <span>{label}</span>}
                    </Link>
                ))}


            </nav>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Desktop sidebar */}
            <aside
                aria-label="Administrator sidebar"
                className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-800 bg-slate-950 text-white transition-[width] duration-200 motion-reduce:transition-none lg:flex ${collapsed ? "w-20" : "w-64"
                    }`}
            >
                <div
                    className={`flex h-24 shrink-0 items-center border-b border-slate-800 ${collapsed ? "justify-center px-3" : "gap-3 px-5"
                        }`}
                >
                    <div className="shrink-0 rounded-xl bg-blue-500/15 p-3 text-blue-400">
                        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                    </div>

                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="whitespace-nowrap text-sm font-semibold">
                                Unloading Tracker
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Administrator workspace
                            </p>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {renderNavigation(collapsed)}
                </div>

                <div className="shrink-0 border-t border-slate-800 p-3">
                    <button
                        type="button"
                        onClick={() => setCollapsed((previous) => !previous)}
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                        aria-expanded={!collapsed}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={`flex min-h-11 w-full items-center rounded-xl text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${collapsed ? "justify-center" : "gap-3 px-4"
                            }`}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
                        ) : (
                            <>
                                <PanelLeftClose
                                    className="h-5 w-5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>Collapse sidebar</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* Mobile navigation */}
            <header className="border-b border-slate-800 bg-slate-950 text-white lg:hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <ShieldCheck
                            className="h-6 w-6 text-blue-400"
                            aria-hidden="true"
                        />
                        <span className="text-sm font-semibold">
                            Unloading Tracker
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMobileOpen((previous) => !previous)}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-admin-navigation"
                        aria-label={mobileOpen ? "Close menu" : "Open menu"}
                        className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                        {mobileOpen ? (
                            <X className="h-5 w-5" aria-hidden="true" />
                        ) : (
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        )}
                    </button>
                </div>

                <div
                    id="mobile-admin-navigation"
                    hidden={!mobileOpen}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setMobileOpen(false);
                            document
                                .querySelector<HTMLButtonElement>(
                                    '[aria-controls="mobile-admin-navigation"]',
                                )
                                ?.focus();
                        }
                    }}
                    className="border-t border-slate-800"
                >
                    {renderNavigation(false)}
                </div>
            </header>

            {/* Content follows the sidebar width */}
            <div
                className={`min-w-0 transition-[padding-left] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-20" : "lg:pl-64"
                    }`}
            >
                {children}
            </div>
        </div>
    );
}