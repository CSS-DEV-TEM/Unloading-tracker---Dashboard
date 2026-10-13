import { Truck } from "lucide-react";

export default function VehicleLabel({
    value,
    receivedDate,
}: {
    value: string | null | undefined;
    receivedDate?: string | null;
}) {
    const number = value?.trim();

    if (!number) return null;

    const date = receivedDate?.slice(0, 10);
    const parts = date?.split("-");

    const dateLabel =
        parts?.length === 3
            ? `${parts[2]}/${parts[1]}/${parts[0]}`
            : null;

    return (
        <span className="mt-2 inline-flex max-w-full flex-col items-start gap-0.5">
            <span
                title={`Vehicle: ${number}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-normal text-foreground"
            >
                <Truck
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                />

                <span className="sr-only">Vehicle: </span>

                <span className="min-w-0 [overflow-wrap:anywhere]">
                    {number}
                </span>
            </span>

            {dateLabel && (
                <span
                    title={`Received date: ${dateLabel}`}
                    className="max-w-full text-[10px] font-normal leading-3.5 text-muted-foreground"
                >
                    Received{" "}
                    <time dateTime={date} className="tabular-nums">
                        {dateLabel}
                    </time>
                </span>
            )}
        </span>
    );
}