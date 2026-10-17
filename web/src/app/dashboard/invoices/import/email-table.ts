import { meterUnits } from "@/lib/meter-quantity";

export const MAX_PASTE_LENGTH = 1_000_000;

const BASE_HEADERS = ["date", "sales order", "invoice no", "supplier"];
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
    const text = clean(value).replace(/\*\*/g, "").toLowerCase();

    if (/^qty\s*\(\s*(mtr|mtrs|meter|meters|metre|metres)\s*\)$/.test(text)) {
        return "meters";
    }

    if (["qty", "roll qty", "roll quantity", "qty(rolls)"].includes(text)) {
        return "rolls";
    }

    return text;
}

function isHeader(cells: string[]) {
    const names = cells.map(header);

    return BASE_HEADERS.every((name) => names.includes(name)) &&
        (names.includes("rolls") || names.includes("meters"));
}

function parseDate(value: string, format: string): string | null {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean(value));
    if (!match) return null;

    const year = Number(match[3]);
    const month = Number(format === "mdy" ? match[1] : match[2]);
    const day = Number(format === "mdy" ? match[2] : match[1]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (
        year < 1 || month < 1 || month > 12 ||
        day < 1 || day > days[month - 1]
    ) {
        return null;
    }

    return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRolls(value: string): number | null {
    const text = clean(value);

    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;

    const number = Number(text.replace(/,/g, ""));

    return Number.isSafeInteger(number) && number <= MAX_ROLLS
        ? number
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

    if (quoted) throw new Error("Incomplete quoted cell. Copy the complete table.");

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

    const lines = text.split(/\r?\n/);
    const markdown = lines.map(markdownCells);

    if (markdown.some(isHeader)) return markdown;

    // Flattened copy: each table cell is on its own line.
    const tokens = lines
        .filter((line) => {
            if (!line.trim().startsWith("|")) return true;

            return !markdownCells(line).every((cell) =>
                cell === "" || /^:?-+:?$/.test(cell),
            );
        })
        .map((line) => clean(line).replace(/^\*\*(.*?)\*\*$/, "$1"))
        .filter(Boolean);

    const start = tokens.findIndex((value) => header(value) === "date");
    const firstData = tokens.findIndex((value, index) =>
        index > start && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value),
    );

    if (start < 0 || firstData < 0) {
        throw new Error("Copy the invoice table with its complete headers.");
    }

    const headings = tokens.slice(start, firstData);

    if (!isHeader(headings) || headings.length > 40) {
        throw new Error("Unable to identify the flattened table columns.");
    }

    const rows = [headings];
    let index = firstData;

    while (index < tokens.length) {
        const remaining = tokens.slice(index);

        // A final total is verified later, never imported as an invoice.
        if (
            remaining.length === 1 ||
            (remaining.length === 2 && /^total$/i.test(remaining[0]))
        ) {
            rows.push(remaining);
            break;
        }

        const row = tokens.slice(index, index + headings.length);

        if (isHeader(row)) {
            rows.push(row);
            index += headings.length;
            continue;
        }

        const dateIndex = headings.map(header).indexOf("date");

        if (
            row.length !== headings.length ||
            !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row[dateIndex])
        ) {
            throw new Error(
                "A flattened row is incomplete or shifted. Copy only the full table.",
            );
        }

        rows.push(row);
        index += headings.length;
    }

    return rows;
}

export function emailClipboardText(html: string, plain: string): string {
    if (html.length > 4_000_000 || plain.length > MAX_PASTE_LENGTH) {
        throw new Error("Too much text. Paste a smaller table.");
    }

    if (!html) return plain;

    const document = new DOMParser().parseFromString(html, "text/html");
    const tables = Array.from(document.querySelectorAll("table"))
        .filter((table) =>
            Array.from(table.rows).some((row) =>
                isHeader(
                    Array.from(row.cells).map((cell) => cell.textContent ?? ""),
                ),
            ),
        );

    if (!tables.length) return plain;

    const lines: string[] = [];

    for (const table of tables) {
        for (const row of Array.from(table.rows)) {
            if (row.closest("table") !== table) continue;

            const cells = Array.from(row.cells);

            if (cells.some((cell) => cell.rowSpan !== 1)) {
                throw new Error("Rows contain merged cells. Copy an unmerged table.");
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

            lines.push(values.map((value) =>
                `"${value.replace(/"/g, '""')}"`,
            ).join("\t"));
        }
    }

    const result = lines.join("\n");

    if (result.length > MAX_PASTE_LENGTH) {
        throw new Error("Too much text. Paste a smaller table.");
    }

    return result;
}

export function parseEmailTable(text: string, dateFormat: string) {
    if (!text.trim()) throw new Error("Paste an invoice table first.");
    if (text.length > MAX_PASTE_LENGTH) throw new Error("Table is too large.");
    if (!["mdy", "dmy"].includes(dateFormat)) {
        throw new Error("Select the date format.");
    }

    const rows = readRows(text);
    let headings: string[] | null = null;
    let sectionTotal = 0;
    let sectionValid = true;
    let sectionRows = 0;
    let totalSeen = false;
    const result = [];

    for (let index = 0; index < rows.length; index++) {
        const cells = rows[index].map(clean);
        if (cells.every((cell) => !cell)) continue;
        if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;

        if (isHeader(cells)) {
            const next = cells.map(header);
            const required = [...BASE_HEADERS, "rolls", "meters"];

            if (required.some((name) =>
                next.filter((value) => value === name).length > 1
            )) {
                throw new Error("Duplicate column headers found.");
            }

            if (!headings || totalSeen) {
                sectionTotal = 0;
                sectionValid = true;
                sectionRows = 0;
            } else if (next.join("|") !== headings.join("|")) {
                throw new Error("Different table layouts found. Import them separately.");
            }

            headings = next;
            totalSeen = false;
            continue;
        }

        if (!headings) continue;

        const nonEmpty = cells.filter(Boolean);
        const numbers = nonEmpty.filter((value) => meterUnits(value) !== null);
        const isTotal =
            numbers.length === 1 &&
            nonEmpty.every((value) =>
                value === numbers[0] || /^(grand\s+)?total:?$/i.test(value),
            );

        if (isTotal) {
            if (totalSeen || sectionRows === 0) {
                throw new Error("Unexpected total row. Review the copied table.");
            }

            if (
                headings.includes("rolls") &&
                headings.includes("meters")
            ) {
                throw new Error("A total with two quantity units needs manual review.");
            }

            const supplied = meterUnits(numbers[0]);

            if (!sectionValid || supplied !== sectionTotal) {
                throw new Error(
                    "The total does not match the copied rows, or a quantity is invalid. " +
                    "Check that all rows were copied.",
                );
            }

            totalSeen = true;
            continue;
        }

        if (totalSeen) {
            throw new Error("Unexpected content after the total. Copy only the table.");
        }

        if (cells.length !== headings.length) {
            throw new Error(`Row ${index + 1}: column count differs.`);
        }

        const get = (name: string) => {
            const position = headings!.indexOf(name);
            return position < 0 ? "" : cells[position];
        };

        const invoice = get("invoice no");
        const supplier = get("supplier");
        const order = get("sales order").replace(/\s+/g, "").toUpperCase();
        const date = parseDate(get("date"), dateFormat);
        const hasRolls = headings.includes("rolls");
        const hasMeters = headings.includes("meters");
        const rolls = hasRolls ? parseRolls(get("rolls")) : null;
        const units = hasMeters ? meterUnits(get("meters")) : null;
        const notes: string[] = [];

        if (!invoice) throw new Error(`Row ${index + 1}: invoice number missing.`);

        const system = order.startsWith("SL")
            ? "D365"
            : order.startsWith("KP") ? "AX" : null;

        const invalidRolls = hasRolls && rolls === null;
        const invalidMeters = hasMeters && units === null;

        if (invalidRolls) notes.push("Roll quantity is invalid. Review it.");
        if (invalidMeters) notes.push("Meters quantity is invalid. Use up to 3 decimal places.");
        if (!date) notes.push("Document date needs review.");
        if (!supplier) notes.push("Supplier is missing.");
        if (!system) notes.push("Unknown Sales order prefix.");
        if (invoice.length > 100) notes.push("Invoice number exceeds 100 characters.");
        if (supplier.length > 250) notes.push("Supplier exceeds 250 characters.");

        const quantityUnits = hasMeters
            ? units
            : rolls === null ? null : rolls * 1000;

        if (quantityUnits === null) sectionValid = false;
        else sectionTotal += quantityUnits;

        if (!Number.isSafeInteger(sectionTotal)) sectionValid = false;
        sectionRows++;

        result.push({
            invoice_number: invoice,
            supplier: supplier || null,
            roll_quantity: rolls,
            meter_quantity: units === null ? null : units / 1000,
            roll_quantity_invalid: invalidRolls,
            meter_quantity_invalid: invalidMeters,
            system_type: system,
            document_share_date: date,
            shipment_type: supplier
                ? ["south asia", "ocean lanka", "teejay", "hayleys"]
                    .includes(supplier.toLowerCase()) ? "LOCAL" : "IMPORT"
                : null,
            source_row_count: 1,
            review_notes: notes,
        });

        if (result.length > 5000) {
            throw new Error("Import a maximum of 5,000 rows at a time.");
        }
    }

    if (!result.length) {
        throw new Error(
            "Include Date, Sales order, Qty or Qty(MTR), Invoice No and Supplier.",
        );
    }

    return result;
}