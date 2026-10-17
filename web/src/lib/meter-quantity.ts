export const MAX_METERS = 999999999.999;
const MAX_UNITS = 999999999999;

// One unit here equals 0.001 meter.
export function meterUnits(value: string): number | null {
    const text = value.trim();

    if (
        !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(text)
    ) {
        return null;
    }

    const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
    const units =
        Number(whole) * 1000 +
        Number(fraction.padEnd(3, "0"));

    return Number.isSafeInteger(units) &&
        units >= 0 &&
        units <= MAX_UNITS
        ? units
        : null;
}

export function meterText(units: number): string {
    const whole = Math.floor(units / 1000);
    const fraction = String(units % 1000)
        .padStart(3, "0")
        .replace(/0+$/, "");

    return fraction ? `${whole}.${fraction}` : String(whole);
}

export function sumMeters(
    values: (number | null)[],
): string {
    let total = 0;
    let found = false;

    for (const value of values) {
        if (value === null) continue;

        const units = meterUnits(String(value));
        if (units === null) return "";

        found = true;
        total += units;

        if (!Number.isSafeInteger(total) || total > MAX_UNITS) {
            return "";
        }
    }

    return found ? meterText(total) : "";
}