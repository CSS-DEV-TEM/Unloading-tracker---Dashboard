"use client";

import {
    useEffect,
    useState,
    useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Radio, RefreshCw } from "lucide-react";

type ConnectionStatus =
    | "connecting"
    | "live"
    | "disconnected"
    | "configuration-error";

export default function OverviewRefresh() {
    const router = useRouter();
    const pathname = usePathname();

    const [status, setStatus] =
        useState<ConnectionStatus>("connecting");

    const [attempt, setAttempt] = useState(0);
    const [pending, startTransition] = useTransition();

    const isOverview =
        pathname === "/" || pathname === "/dashboard";

    useEffect(() => {
        if (!isOverview) return;

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key =
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
            // Schedule the status update outside the effect setup.
            const timer = window.setTimeout(() => {
                setStatus("configuration-error");
            }, 0);

            return () => window.clearTimeout(timer);
        }

        // This connection receives only public change signals.
        // Actual invoice data still comes from the server.
        const supabase = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        });

        let disposed = false;
        let dirty = false;
        let refreshTimer: number | undefined;

        function isEditingFilter() {
            const element = document.activeElement;

            return (
                element instanceof HTMLElement &&
                (element.matches("input, textarea, select") ||
                    element.isContentEditable)
            );
        }

        function flushRefresh() {
            refreshTimer = undefined;

            if (
                disposed ||
                !dirty ||
                !navigator.onLine ||
                document.visibilityState !== "visible" ||
                isEditingFilter()
            ) {
                return;
            }

            dirty = false;

            startTransition(() => {
                router.refresh();
            });
        }

        function queueRefresh() {
            if (disposed) return;

            dirty = true;

            if (refreshTimer !== undefined) return;

            // Combine signals from invoice, stage and ASN updates.
            // This is event batching, not recurring polling.
            refreshTimer = window.setTimeout(flushRefresh, 350);
        }

        const channel = supabase
            .channel("unloading-overview-v1", {
                config: {
                    private: false,
                },
            })
            .on(
                "broadcast",
                { event: "overview_changed" },
                queueRefresh,
            )
            .subscribe((channelStatus) => {
                if (disposed) return;

                if (channelStatus === "SUBSCRIBED") {
                    setStatus("live");

                    // Catch changes missed before connecting or reconnecting.
                    queueRefresh();
                    return;
                }

                if (
                    channelStatus === "CHANNEL_ERROR" ||
                    channelStatus === "TIMED_OUT" ||
                    channelStatus === "CLOSED"
                ) {
                    setStatus("disconnected");
                }
            });

        function handleVisibilityChange() {
            if (document.visibilityState === "visible") {
                queueRefresh();
            }
        }

        function handleOnline() {
            queueRefresh();
        }

        function handleOffline() {
            setStatus("disconnected");
        }

        function handleFocusOut() {
            // Apply queued changes after the user leaves a filter.
            if (dirty) queueRefresh();
        }

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );
        document.addEventListener("focusout", handleFocusOut);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            disposed = true;

            if (refreshTimer !== undefined) {
                window.clearTimeout(refreshTimer);
            }

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
            document.removeEventListener("focusout", handleFocusOut);
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);

            void supabase.removeChannel(channel);
        };
    }, [isOverview, pathname, router, attempt]);

    if (!isOverview) return null;

    const label =
        status === "configuration-error"
            ? "Live updates are not configured"
            : status === "disconnected"
                ? "Live connection interrupted"
                : status === "connecting"
                    ? "Connecting to live updates..."
                    : pending
                        ? "Updating dashboard..."
                        : "Live updates connected";

    return (
        <div className="flex min-h-7 flex-wrap items-center justify-end gap-3">
            <div
                role="status"
                className="flex items-center gap-2 text-xs text-muted-foreground"
            >
                <Radio
                    aria-hidden="true"
                    className={`size-4 ${status === "live"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                        }`}
                />

                <span>{label}</span>
            </div>

            {status === "disconnected" && (
                <button
                    type="button"
                    onClick={() => {
                        setStatus("connecting");
                        setAttempt((previous) => previous + 1);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Reconnect
                </button>
            )}
        </div>
    );
}