"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
    Activity,
    ArrowUpRight,
    LayoutDashboard,
    Menu,
    PackageOpen,
    PanelLeftClose,
    PanelLeftOpen,
    Settings2,
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
    const mobileButtonRef = useRef<HTMLButtonElement>(null);

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
        {
            href: "/dashboard/settings",
            label: "Account Settings",
            icon: Settings2,
            active: pathname.startsWith("/dashboard/settings"),
        },
    ];

    function closeMobileMenu() {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
    }

    function renderNavigation(compact: boolean) {
        return (
            <nav
                aria-label="Administrator navigation"
                className="space-y-1.5 px-3 py-5"
            >
                {!compact && (
                    <p className="mb-4 px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Workspace
                    </p>
                )}

                {links.map(({ href, label, icon: Icon, active }) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => {
                            if (mobileOpen) closeMobileMenu();
                        }}
                        aria-current={active ? "page" : undefined}
                        aria-label={label}
                        title={compact ? label : undefined}
                        className={`group relative flex min-h-12 items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${compact ? "justify-center px-3" : "gap-3 px-4"
                            } ${active
                                ? "bg-blue-600 text-white shadow-md shadow-blue-950/30"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                    >
                        <Icon
                            className={`h-[18px] w-[18px] shrink-0 ${active
                                ? "text-white"
                                : "text-slate-400 group-hover:text-blue-300"
                                }`}
                            aria-hidden="true"
                        />

                        {!compact && <span>{label}</span>}

                        {!compact && active && (
                            <span
                                aria-hidden="true"
                                className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-200"
                            />
                        )}
                    </Link>
                ))}
            </nav>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <aside
                aria-label="Administrator sidebar"
                className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-800 bg-[#0b1224] text-white transition-[width] duration-200 motion-reduce:transition-none lg:flex ${collapsed ? "w-20" : "w-64"
                    }`}
            >
                <div
                    className={`flex h-24 shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center px-3" : "gap-3 px-5"
                        }`}
                >
                    <Link
                        href="/dashboard"
                        aria-label="Unloading Tracker dashboard"
                        title={collapsed ? "Unloading Tracker" : undefined}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/30"
                    >
                        <PackageOpen className="h-6 w-6" aria-hidden="true" />
                    </Link>

                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">
                                EFL · 3PL
                            </p>
                            <p className="mt-1 whitespace-nowrap text-sm font-semibold tracking-tight">
                                Unloading Tracker
                            </p>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {renderNavigation(collapsed)}
                </div>

                <div className="shrink-0 border-t border-white/10 p-3">
                    {!collapsed && (
                        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                                <ShieldCheck
                                    className="h-4 w-4 text-blue-300"
                                    aria-hidden="true"
                                />
                                Administrator
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-400">
                                CSS Division · Operations
                            </p>
                        </div>
                    )}

                    <Link
                        href="/"
                        title={collapsed ? "Public overview" : undefined}
                        aria-label="Public overview"
                        className={`mb-1 flex min-h-11 items-center rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white ${collapsed ? "justify-center" : "gap-3 px-4"
                            }`}
                    >
                        <ArrowUpRight
                            className="h-[18px] w-[18px] shrink-0"
                            aria-hidden="true"
                        />
                        {!collapsed && <span>Public overview</span>}
                    </Link>

                    <button
                        type="button"
                        onClick={() => setCollapsed((previous) => !previous)}
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                        aria-expanded={!collapsed}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={`flex min-h-11 w-full items-center rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${collapsed ? "justify-center" : "gap-3 px-4"
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

            <header className="border-b border-slate-800 bg-[#0b1224] text-white lg:hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <Link
                        href="/dashboard"
                        onClick={() => {
                            if (mobileOpen) closeMobileMenu();
                        }}
                        className="flex items-center gap-3"
                    >
                        <div className="rounded-xl bg-blue-600 p-2.5">
                            <PackageOpen className="h-5 w-5" aria-hidden="true" />
                        </div>

                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-300">
                                EFL · 3PL
                            </p>
                            <p className="mt-0.5 text-sm font-semibold">
                                Unloading Tracker
                            </p>
                        </div>
                    </Link>

                    <button
                        ref={mobileButtonRef}
                        type="button"
                        onClick={() => setMobileOpen((previous) => !previous)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") closeMobileMenu();
                        }}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-admin-navigation"
                        aria-label={mobileOpen ? "Close menu" : "Open menu"}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-slate-200 hover:bg-white/5"
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
                        if (event.key === "Escape") closeMobileMenu();
                    }}
                    className="border-t border-white/10"
                >
                    {renderNavigation(false)}

                    <Link
                        href="/"
                        onClick={closeMobileMenu}
                        className="mx-3 mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
                    >
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        Public overview
                    </Link>
                </div>
            </header>

            <div
                className={`min-w-0 transition-[padding-left] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-20" : "lg:pl-64"
                    }`}
            >
                {children}
            </div>
        </div>
    );
}