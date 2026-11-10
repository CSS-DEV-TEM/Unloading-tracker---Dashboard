type Props = {
    value: number | null | undefined;
    total: number | null | undefined;
};

export default function SummaryShareBar({ value, total }: Props) {
    const available =
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        typeof total === "number" &&
        Number.isFinite(total) &&
        total >= 0;

    if (!available) return null;

    const percentage =
        total > 0
            ? Math.min(100, Math.max(0, (value / total) * 100))
            : 0;

    const percentageLabel = percentage.toLocaleString("en-GB", {
        maximumFractionDigits: 1,
    });

    return (
        <>
            <span className="sr-only">
                {percentageLabel}% of all invoices.
            </span>

            <span
                aria-hidden="true"
                className="summary-share-track"
            >
                <span
                    className="summary-share-fill"
                    style={{ width: `${percentage}%` }}
                />
            </span>
        </>
    );
}