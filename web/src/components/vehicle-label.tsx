import { Truck } from "lucide-react";

export default function VehicleLabel({
    value,
}: {
    value: string | null | undefined;
}) {
    const number = value?.trim();

    if (!number) return null;

    return (
        <span
            title={`Vehicle: ${number}`}
            style={{
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
            }}
            className="mt-2 inline-flex max-w-full items-center gap-1.5
        rounded-md border px-2 py-1 text-xs font-normal"
        >
            <Truck aria-hidden="true" className="size-3.5 shrink-0" />

            <span className="sr-only">Vehicle: </span>

            <span className="min-w-0 [overflow-wrap:anywhere]">
                {number}
            </span>
        </span>
    );
}