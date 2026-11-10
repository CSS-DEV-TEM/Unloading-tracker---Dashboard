"use client";

import type { PointerEvent, ReactNode } from "react";

type Props = {
    children: ReactNode;
    className?: string;
};

export default function SummarySpotlights({
    children,
    className = "",
}: Props) {
    function moveSpotlight(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType === "touch") return;

        if (
            window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches
        ) {
            return;
        }

        const target = event.target;

        if (!(target instanceof Element)) return;

        const card = target.closest<HTMLAnchorElement>("a");

        if (!card || card.parentElement !== event.currentTarget) {
            return;
        }

        const bounds = card.getBoundingClientRect();

        card.style.setProperty(
            "--spot-x",
            `${event.clientX - bounds.left}px`,
        );

        card.style.setProperty(
            "--spot-y",
            `${event.clientY - bounds.top}px`,
        );
    }

    return (
        <div
            className={`summary-spotlights ${className}`}
            onPointerMove={moveSpotlight}
            onPointerLeave={(event) => {
                for (const child of event.currentTarget.children) {
                    if (child instanceof HTMLAnchorElement) {
                        child.style.removeProperty("--spot-x");
                        child.style.removeProperty("--spot-y");
                    }
                }
            }}
            onFocusCapture={(event) => {
                if (event.target instanceof HTMLAnchorElement) {
                    event.target.style.removeProperty("--spot-x");
                    event.target.style.removeProperty("--spot-y");
                }
            }}
        >
            {children}
        </div>
    );
}