import { meterUnits } from "@/lib/meter-quantity";

export const MAX_PASTE_LENGTH = 1_000_000;

export type QuantityUnit = "ROLLS" | "MTR";

export class QuantityUnitRequiredError extends Error {
    constructor() {
        super(
            'The "Qty" header does not specify a unit. ' +
            "Select Rolls or MTR, then extract again.",
        );
        this.name = "QuantityUnitRequiredError";
    }
}

export type ExtractedInvoice = {
    invoice_number: string;
    is_foc: boolean;
    supplier: string | null;
    roll_quantity: number | null;
    meter_quantity: number | null;
    roll_quantity_invalid: boolean;
    meter_quantity_invalid: boolean;
    system_type: string | null;
    document_share_date: string | null;
    shipment_type: string | null;
    source_row_count: number;
    review_notes: string[];
};

const BASE_HEADERS = [
    "date",
    "po",
    "invoice no",
    "supplier",
];

const QUANTITY_HEADERS = ["qty", "rolls", "meters"];
const MAX_ROLLS = 2147483647;

function clean(value: string) {
    return value
        .replace(/&(?:nbsp|#160|#xA0);/gi, " ")
        .replace(/&#x20;/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function header(value: string) {
    const text = clean(value)
        .replace(/\*\*/g, "")
        .toLowerCase();

    if (
        /^(?:qty|quantity)\s*\(\s*(?:mtr|mtrs|meter|meters|metre|metres)\s*\)$/.test(text) ||
        /^(?:mtr|mtrs|meters?|metres?)(?:\s+(?:qty|quantity))?$/.test(text)
    ) {
        return "meters";
    }

    if (
        /^(?:qty|quantity)\s*\(\s*rolls?\s*\)$/.test(text) ||
        /^rolls?(?:\s+(?:qty|quantity))?$/.test(text)
    ) {
        return "rolls";
    }

    if (text === "qty" || text === "quantity") {
        return "qty";
    }

    if (/^sales\s+order(?:\s+(?:no|number)\.?)?$/.test(text)) {
        return "sales order";
    }

    if (/^invoice\s+(?:no\.?|number)$/.test(text)) {
        return "invoice no";
    }

    return text;
}

function isHeader(cells: string[]) {
    const names = cells.map(header);

    return (
        BASE_HEADERS.every((name) => names.includes(name)) &&
        QUANTITY_HEADERS.some((name) => names.includes(name))
    );
}

function looksLikeDate(value: string) {
    const text = clean(value);

    return (
        /^\d{1,2}([./-])\d{1,2}\1\d{4}$/.test(text) ||
        /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)
    );
}

function parseDate(value: string, format: string): string | null {
    const text = clean(value);

    let year: number;
    let month: number;
    let day: number;

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);

    if (iso) {
        year = Number(iso[1]);
        month = Number(iso[2]);
        day = Number(iso[3]);
    } else {
        const match =
            /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/.exec(text);

        if (!match) return null;

        const first = Number(match[1]);
        const second = Number(match[3]);
        year = Number(match[4]);

        if (first > 12 && second <= 12) {
            // 15.10.2026 can only mean day/month/year.
            day = first;
            month = second;
        } else if (second > 12 && first <= 12) {
            // 10/15/2026 can only mean month/day/year.
            month = first;
            day = second;
        } else if (format === "dmy") {
            day = first;
            month = second;
        } else {
            month = first;
            day = second;
        }
    }

    const leap =
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0);

    const days = [
        31,
        leap ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    if (
        year < 1 ||
        year > 9999 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > days[month - 1]
    ) {
        return null;
    }

    return (
        `${String(year).padStart(4, "0")}-` +
        `${String(month).padStart(2, "0")}-` +
        String(day).padStart(2, "0")
    );
}

function parseRolls(value: string): number | null {
    const text = clean(value);

    // Accept whole numbers such as 100, 1,000 and 100.00.
    // Never round a fractional roll quantity.
    if (
        !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.0{1,3})?$/.test(text)
    ) {
        return null;
    }

    const number = Number(text.replace(/,/g, ""));

    return (
        Number.isSafeInteger(number) &&
        number >= 0 &&
        number <= MAX_ROLLS
    )
        ? number
        : null;
}

// Used only to validate copied totals, which may exceed one invoice's limit.
function totalUnits(value: string): number | null {
    const text = clean(value);

    if (
        !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(text)
    ) {
        return null;
    }

    const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
    const units =
        Number(whole) * 1000 +
        Number(fraction.padEnd(3, "0"));

    return Number.isSafeInteger(units) && units >= 0
        ? units
        : null;
}

function readTabs(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;

    const source = text.replace(/\r\n?/g, "\n");

    for (let index = 0; index < source.length; index++) {
        const char = source[index];

        if (char === '"') {
            if (quoted && source[index + 1] === '"') {
                cell += '"';
                index++;
            } else if (quoted) {
                quoted = false;
            } else if (cell === "") {
                quoted = true;
            } else {
                cell += char;
            }
        } else if (!quoted && (char === "\t" || char === "\n")) {
            row.push(cell);
            cell = "";

            if (char === "\n") {
                rows.push(row);
                row = [];
            }
        } else {
            cell += char;
        }
    }

    if (quoted) {
        throw new Error(
            "Incomplete quoted cell. Copy the complete table.",
        );
    }

    row.push(cell);
    rows.push(row);

    return rows;
}

function markdownCells(line: string) {
    let value = line.trim();

    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);

    return value.split(/(?<!\\)\|/).map((cell) =>
        clean(cell.replace(/\\\|/g, "|")),
    );
}

function readRows(text: string): string[][] {
    if (text.includes("\t")) return readTabs(text);

    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const markdown = lines.map(markdownCells);

    if (markdown.some(isHeader)) return markdown;

    // Plain email copies can put each cell on a separate line.
    const tokens = lines
        .filter((line) => {
            if (!line.trim().startsWith("|")) return true;

            return !markdownCells(line).every(
                (cell) => cell === "" || /^:?-+:?$/.test(cell),
            );
        })
        .map((line) =>
            clean(line).replace(/^\*\*(.*?)\*\*$/, "$1"),
        )
        .filter(Boolean);

    const start = tokens.findIndex(
        (value) => header(value) === "date",
    );

    const firstData = tokens.findIndex(
        (value, index) => index > start && looksLikeDate(value),
    );

    if (start < 0 || firstData < 0) {
        throw new Error(
            "Copy the invoice table with its complete headers and rows.",
        );
    }

    const headings = tokens.slice(start, firstData);

    if (!isHeader(headings) || headings.length > 40) {
        throw new Error(
            "Unable to identify the flattened table columns.",
        );
    }

    const rows: string[][] = [headings];
    const dateIndex = headings.map(header).indexOf("date");

    let index = firstData;

    while (index < tokens.length) {
        const remainingCount = tokens.length - index;

        const finalNumber = remainingCount === 1 &&
            totalUnits(tokens[index]) !== null;

        const finalLabeledTotal = remainingCount === 2 &&
            /^(grand\s+)?total:?$/i.test(tokens[index]) &&
            totalUnits(tokens[index + 1]) !== null;

        if (finalNumber || finalLabeledTotal) {
            rows.push(tokens.slice(index));
            break;
        }

        const row = tokens.slice(index, index + headings.length);

        if (isHeader(row)) {
            rows.push(row);
            index += headings.length;
            continue;
        }

        if (
            row.length !== headings.length ||
            !looksLikeDate(row[dateIndex] ?? "")
        ) {
            throw new Error(
                `Source row ${rows.length} is incomplete or shifted. ` +
                "Copy the full table, including the last column. " +
                "No rows from this paste were added.",
            );
        }

        rows.push(row);
        index += headings.length;

        if (rows.length > 10001) {
            throw new Error("The copied table contains too many rows.");
        }
    }

    return rows;
}

export function emailClipboardText(
    html: string,
    plain: string,
): string {
    if (
        html.length > 4_000_000 ||
        plain.length > MAX_PASTE_LENGTH
    ) {
        throw new Error("Too much text. Paste a smaller table.");
    }

    if (!html) return plain;

    const document = new DOMParser().parseFromString(
        html,
        "text/html",
    );

    const tables = Array.from(document.querySelectorAll("table"))
        .filter((table) =>
            Array.from(table.rows).some((row) =>
                row.closest("table") === table &&
                isHeader(
                    Array.from(row.cells).map(
                        (cell) => cell.textContent ?? "",
                    ),
                ),
            ),
        );

    if (tables.length === 0) return plain;

    const lines: string[] = [];

    for (const table of tables) {
        for (const row of Array.from(table.rows)) {
            if (row.closest("table") !== table) continue;

            const cells = Array.from(row.cells);

            if (cells.some((cell) => cell.rowSpan !== 1)) {
                throw new Error(
                    "Rows contain merged cells. Copy an unmerged table.",
                );
            }

            const values: string[] = [];

            for (const cell of cells) {
                if (cell.colSpan > 40) {
                    throw new Error("Unsupported merged table layout.");
                }

                values.push(clean(cell.textContent ?? ""));

                for (let index = 1; index < cell.colSpan; index++) {
                    values.push("");
                }
            }

            lines.push(
                values.map((value) =>
                    `"${value.replace(/"/g, '""')}"`,
                ).join("\t"),
            );
        }
    }

    const result = lines.join("\n");

    if (result.length > MAX_PASTE_LENGTH) {
        throw new Error("Too much text. Paste a smaller table.");
    }

    return result;
}

export function parseEmailTable(
    text: string,
    dateFormat: string,
    genericUnit?: QuantityUnit,
): ExtractedInvoice[] {
    if (!text.trim()) {
        throw new Error("Paste an invoice table first.");
    }

    if (text.length > MAX_PASTE_LENGTH) {
        throw new Error("Table is too large.");
    }

    if (!["mdy", "dmy"].includes(dateFormat)) {
        throw new Error("Select the date format.");
    }

    if (
        genericUnit !== undefined &&
        genericUnit !== "ROLLS" &&
        genericUnit !== "MTR"
    ) {
        throw new Error("Select Rolls or MTR.");
    }

    const rows = readRows(text);

    const needsUnit = rows.some(
        (cells) =>
            isHeader(cells) &&
            cells.map(header).includes("qty"),
    );

    if (needsUnit && !genericUnit) {
        throw new QuantityUnitRequiredError();
    }

    let headings: string[] | null = null;
    let sectionTotal = 0;
    let sectionValid = true;
    let sectionRows = 0;
    let totalSeen = false;

    const result: ExtractedInvoice[] = [];

    for (let index = 0; index < rows.length; index++) {
        const cells = rows[index].map(clean);

        if (cells.every((cell) => !cell)) continue;

        if (
            cells.some(Boolean) &&
            cells.every((cell) => !cell || /^:?-+:?$/.test(cell))
        ) {
            continue;
        }

        if (isHeader(cells)) {
            const next = cells.map((cell) => {
                const name = header(cell);

                if (name !== "qty") return name;

                return genericUnit === "MTR" ? "meters" : "rolls";
            });

            const required = [...BASE_HEADERS, "rolls", "meters"];

            if (
                required.some(
                    (name) =>
                        next.filter((value) => value === name).length > 1,
                )
            ) {
                throw new Error(
                    "Duplicate quantity or required headers found. " +
                    "Import tables with different quantity layouts separately.",
                );
            }

            if (!headings || totalSeen) {
                sectionTotal = 0;
                sectionValid = true;
                sectionRows = 0;
            } else if (next.join("|") !== headings.join("|")) {
                throw new Error(
                    "Different table layouts found. Import them separately.",
                );
            }

            headings = next;
            totalSeen = false;
            continue;
        }

        if (!headings) continue;

        const nonEmpty = cells.filter(Boolean);
        const numbers = nonEmpty.filter(
            (value) => totalUnits(value) !== null,
        );

        const isTotal =
            numbers.length === 1 &&
            nonEmpty.every(
                (value) =>
                    value === numbers[0] ||
                    /^(grand\s+)?total:?$/i.test(value),
            );

        if (isTotal) {
            if (totalSeen || sectionRows === 0) {
                throw new Error(
                    "Unexpected total row. Review the copied table.",
                );
            }

            if (
                headings.includes("rolls") &&
                headings.includes("meters")
            ) {
                throw new Error(
                    "A total covering both rolls and meters needs manual review.",
                );
            }

            const supplied = totalUnits(numbers[0]);

            if (!sectionValid || supplied !== sectionTotal) {
                throw new Error(
                    "The total does not match the copied rows, or a " +
                    "quantity is invalid. Check the selected unit and " +
                    "confirm that all rows were copied.",
                );
            }

            totalSeen = true;
            continue;
        }

        if (totalSeen) {
            throw new Error(
                "Unexpected content after the total. Copy only the table.",
            );
        }

        if (cells.length !== headings.length) {
            throw new Error(
                `Row ${index + 1}: column count differs. ` +
                "Copy the complete row, including empty cells.",
            );
        }

        const get = (name: string) => {
            const position = headings!.indexOf(name);
            return position < 0 ? "" : cells[position];
        };

        const invoice = get("invoice no");
        const supplier = get("supplier");
        const po = get("po")
            .replace(/\s+/g, "")
            .toUpperCase();

        const date = parseDate(get("date"), dateFormat);

        const hasRolls = headings.includes("rolls");
        const hasMeters = headings.includes("meters");

        const rolls = hasRolls ? parseRolls(get("rolls")) : null;
        const units = hasMeters ? meterUnits(get("meters")) : null;

        const invalidRolls = hasRolls && rolls === null;
        const invalidMeters = hasMeters && units === null;

        const notes: string[] = [];

        if (!invoice) {
            throw new Error(
                `Row ${index + 1}: invoice number is missing.`,
            );
        }

        const system = po.startsWith("SL/KP")
            ? "AX/D365"
            : po.startsWith("SL")
                ? "D365"
                : po.startsWith("KP")
                    ? "AX"
                    : null;

        if (invalidRolls) {
            notes.push(
                `Roll quantity "${get("rolls")}" is invalid. ` +
                "Rolls require a whole number. Check the selected unit.",
            );
        }

        if (invalidMeters) {
            notes.push(
                `Meters quantity "${get("meters")}" is invalid. ` +
                "Use up to 3 decimal places.",
            );
        }

        if (!date) {
            notes.push(`Document date "${get("date")}" needs review.`);
        }

        if (!supplier) notes.push("Supplier is missing.");
        if (po === "FOC") {
            notes.push(
                "FOC PO row found. Its quantity is included. " +
                "System is determined from the other PO rows of this invoice.",
            );
        } else if (!system) {
            notes.push("Unknown PO prefix. Select the system.");
        }

        if (invoice.length > 100) {
            notes.push("Invoice number exceeds 100 characters.");
        }

        if (supplier.length > 250) {
            notes.push("Supplier exceeds 250 characters.");
        }

        const quantityUnits = hasMeters
            ? units
            : rolls === null
                ? null
                : rolls * 1000;

        if (quantityUnits === null) {
            sectionValid = false;
        } else {
            sectionTotal += quantityUnits;
        }

        if (!Number.isSafeInteger(sectionTotal)) {
            sectionValid = false;
        }

        sectionRows++;

        const isLocal = [
            "south asia",
            "ocean lanka",
            "teejay",
            "hayleys",
        ].includes(supplier.toLowerCase());

        result.push({
            invoice_number: invoice,
            is_foc: po === "FOC",
            supplier: supplier || null,
            roll_quantity: rolls,
            meter_quantity: units === null ? null : units / 1000,
            roll_quantity_invalid: invalidRolls,
            meter_quantity_invalid: invalidMeters,
            system_type: system,
            document_share_date: date,
            shipment_type: supplier
                ? isLocal ? "LOCAL" : "IMPORT"
                : null,
            source_row_count: 1,
            review_notes: notes,
        });

        if (result.length > 5000) {
            throw new Error(
                "Import a maximum of 5,000 rows at a time.",
            );
        }
    }

    if (result.length === 0) {
        throw new Error(
            "Include Date, PO, Qty or Qty(MTR), Invoice No and Supplier.",
        );
    }

    return result;
}