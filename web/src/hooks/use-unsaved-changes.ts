"use client";

import { useEffect, useRef } from "react";

export function useUnsavedChanges(
    dirty: boolean,
    saving: boolean,
) {
    const allowLeave = useRef(false);

    useEffect(() => {
        if (!dirty && !saving) return;

        let resetTimer: number | undefined;

        function beforeUnload(event: BeforeUnloadEvent) {
            if (allowLeave.current) return;

            event.preventDefault();
            event.returnValue = "";
        }

        function handleClick(event: MouseEvent) {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const target = event.target;

            if (!(target instanceof Element)) return;

            const link = target.closest<HTMLAnchorElement>("a[href]");

            if (
                !link ||
                link.hasAttribute("download") ||
                (link.target && link.target !== "_self")
            ) {
                return;
            }

            const destination = new URL(link.href, window.location.href);
            const current = new URL(window.location.href);

            if (!["http:", "https:"].includes(destination.protocol)) {
                return;
            }

            // Same-page anchors do not discard the form.
            if (
                destination.origin === current.origin &&
                destination.pathname === current.pathname &&
                destination.search === current.search
            ) {
                return;
            }

            if (saving) {
                event.preventDefault();
                event.stopImmediatePropagation();

                window.alert("Your changes are being saved. Please wait.");
                return;
            }

            const confirmed = window.confirm(
                "You have unsaved changes. Leave this page and discard them?",
            );

            if (!confirmed) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            // Avoid a second browser warning for this approved navigation.
            allowLeave.current = true;

            window.clearTimeout(resetTimer);
            resetTimer = window.setTimeout(() => {
                allowLeave.current = false;
            }, 1000);
        }

        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("click", handleClick, true);

        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", handleClick, true);
            window.clearTimeout(resetTimer);
            allowLeave.current = false;
        };
    }, [dirty, saving]);

    function reloadWithoutWarning() {
        allowLeave.current = true;
        window.location.reload();
    }

    return { reloadWithoutWarning };
}