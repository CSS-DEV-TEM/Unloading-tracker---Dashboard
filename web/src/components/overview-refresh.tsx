"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pause, Play, RefreshCw } from "lucide-react";

const INTERVAL_MS = 30_000;

export default function OverviewRefresh() {
    const router = useRouter();
    const pathname = usePathname();

    const [enabled, setEnabled] = useState(true);
    const [pending, startTransition] = useTransition();

    const isOverview =
        pathname === "/" || pathname === "/dashboard";

    const refresh = useCallback(() => {
        if (pending || !isOverview) return;

        startTransition(() => {
            router.refresh();
        });
    }, [pending, isOverview, router]);

    useEffect(() => {
        if (!enabled || !isOverview) return;

        function automaticRefresh() {
            if (
                document.visibilityState !== "visible" ||
                !navigator.onLine
            ) {
                return;
            }

            const focusedElement = document.activeElement;

            // Avoid interrupting search/filter input.
            if (
                focusedElement instanceof HTMLElement &&
                (focusedElement.matches("input, textarea, select") ||
                    focusedElement.isContentEditable)
            ) {
                return;
            }

            refresh();
        }

        const timer = window.setInterval(
            automaticRefresh,
            INTERVAL_MS,
        );

        function handleVisibilityChange() {
            if (document.visibilityState === "visible") {
                automaticRefresh();
            }
        }

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );

        window.addEventListener("online", automaticRefresh);

        return () => {
            window.clearInterval(timer);

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );

            window.removeEventListener("online", automaticRefresh);
        };
    }, [enabled, isOverview, refresh]);

    if (!isOverview) return null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${enabled ? "bg-blue-600" : "bg-slate-400"
                        }`}
                />

                <p className="text-xs text-slate-500">
                    {enabled
                        ? "Auto-refresh every 30 seconds"
                        : "Auto-refresh paused"}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setEnabled((previous) => !previous)}
                    aria-label={
                        enabled ? "Pause auto-refresh" : "Resume auto-refresh"
                    }
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                    {enabled ? (
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    )}

                    {enabled ? "Pause" : "Resume"}
                </button>

                <button
                    type="button"
                    onClick={refresh}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${pending ? "animate-spin motion-reduce:animate-none" : ""
                            }`}
                        aria-hidden="true"
                    />

                    {pending ? "Refreshing..." : "Refresh now"}
                </button>
            </div>
        </div>
    );
}