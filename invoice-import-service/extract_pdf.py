import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import pdfplumber


REQUIRED_COLUMNS = {
    "date",
    "po",
    "qty",
    "invoice no",
    "supplier",
}


def clean(value):
    return " ".join(str(value or "").split())


def parse_quantity(value):
    value = clean(value)

    if not re.fullmatch(r"(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)", value):
        return None

    quantity = int(value.replace(",", ""))

    if quantity > 2147483647:
        return None

    return quantity


def systems_from_po(value):
    value = re.sub(r"\s+", "", clean(value)).upper()

    # Check the combined prefix before SL.
    if value.startswith("SL/KP"):
        return {"AX", "D365"}

    if value.startswith("SL"):
        return {"D365"}

    if value.startswith("KP"):
        return {"AX"}

    return set()


def parse_date(value, date_format):
    try:
        return datetime.strptime(clean(value), date_format).date().isoformat()
    except ValueError:
        return None


def extract_invoices(pdf_path, date_format):
    groups = {}
    document_issues = []
    matched_tables = 0
    source_rows = 0

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            for table_number, table in enumerate(
                page.extract_tables(),
                start=1,
            ):
                if not table:
                    continue

                headers = [clean(cell).lower() for cell in table[0]]

                if not REQUIRED_COLUMNS.issubset(set(headers)):
                    continue

                matched_tables += 1

                for row_number, cells in enumerate(table[1:], start=2):
                    if not any(clean(cell) for cell in cells):
                        continue

                    if [clean(cell).lower() for cell in cells] == headers:
                        continue

                    row = dict(zip(headers, cells))
                    source = {
                        "page": page_number,
                        "table": table_number,
                        "row": row_number,
                    }

                    number = clean(row.get("invoice no"))

                    if not number:
                        document_issues.append({
                            "message": "A table row has no invoice number.",
                            "source": source,
                        })
                        continue

                    source_rows += 1
                    key = number.casefold()

                    group = groups.setdefault(key, {
                        "invoice_number": number,
                        "rows": [],
                    })

                    group["rows"].append({
                        "supplier": clean(row.get("supplier")),
                        "quantity": parse_quantity(row.get("qty")),
                        "date": parse_date(row.get("date"), date_format),
                        "po": clean(row.get("po")),
                        "raw_quantity": clean(row.get("qty")),
                        "raw_date": clean(row.get("date")),
                        "source": source,
                    })

    invoices = []

    for group in groups.values():
        rows = group["rows"]
        issues = []

        suppliers = {
            row["supplier"].casefold(): row["supplier"]
            for row in rows
            if row["supplier"]
        }

        supplier = (
            next(iter(suppliers.values()))
            if len(suppliers) == 1
            and all(row["supplier"] for row in rows)
            else None
        )

        if supplier is None:
            issues.append("Supplier is missing or differs between rows.")

        dates = {row["date"] for row in rows if row["date"]}

        document_date = (
            next(iter(dates))
            if len(dates) == 1
            and all(row["date"] for row in rows)
            else None
        )

        if document_date is None:
            issues.append("Document date is invalid or differs between rows.")

        systems = set()
        unknown_po = False

        for row in rows:
            detected = systems_from_po(row["po"])
            if not detected:
                unknown_po = True
            systems.update(detected)

        if unknown_po or not systems:
            system_type = None
            issues.append("An unknown PO prefix needs review.")
        elif systems == {"AX", "D365"}:
            system_type = "AX/D365"
        else:
            system_type = next(iter(systems))

        if any(row["quantity"] is None for row in rows):
            quantity = None
            issues.append("Roll quantity left blank: some values are unreadable.")
        else:
            quantity = sum(row["quantity"] for row in rows)
            if quantity > 2147483647:
                quantity = None
                issues.append("Roll quantity exceeds the supported limit.")

        local_suppliers = {
            "south asia",
            "ocean lanka",
            "teejay",
            "hayleys",
        }

        supplier_key = " ".join((supplier or "").split()).casefold()

        if not supplier_key:
            shipment_type = None
            issues.append(
                "Supplier is missing or inconsistent. "
                "Review the supplier and select Local or Import."
            )
        elif supplier_key in local_suppliers:
            shipment_type = "LOCAL"
        else:
            shipment_type = "IMPORT"

        if len(group["invoice_number"]) > 100:
            issues.append("Invoice number exceeds 100 characters.")

        if supplier and len(supplier) > 250:
            issues.append("Supplier exceeds 250 characters.")

        invoices.append({
            "invoice_number": group["invoice_number"],
            "supplier": supplier,
            "roll_quantity": quantity,
            "system_type": system_type,
            "document_share_date": document_date,
            "shipment_type": shipment_type,
            "vehicle_number": None,
            "received_date": None,
            "source_row_count": len(rows),
            "review_notes": issues,
            "source_rows": rows,
        })

    if matched_tables == 0:
        document_issues.append({
            "message": "No supported invoice tables found. No invoices extracted.",
        })

    return {
        "source_file": Path(pdf_path).name,
        "matched_tables": matched_tables,
        "source_rows": source_rows,
        "invoice_count": len(invoices),
        "document_issues": document_issues,
        "invoices": invoices,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Extract invoice drafts from a supported email PDF."
    )
    parser.add_argument("pdf")
    parser.add_argument(
        "--date-format",
        required=True,
        choices=["mdy", "dmy"],
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf)

    if not pdf_path.is_file():
        parser.error(f"PDF not found: {pdf_path}")

    date_format = (
        "%m/%d/%Y"
        if args.date_format == "mdy"
        else "%d/%m/%Y"
    )

    result = extract_invoices(pdf_path, date_format)

    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    output_path = output_dir / "extracted-invoices.json"
    output_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Matched tables: {result['matched_tables']}")
    print(f"Source rows: {result['source_rows']}")
    print(f"Invoice drafts: {result['invoice_count']}")

    for invoice in result["invoices"]:
        quantity = invoice["roll_quantity"]
        print(
            f"{invoice['invoice_number']} | "
            f"{invoice['system_type']} | "
            f"Qty: {quantity if quantity is not None else 'blank'} | "
            f"{invoice['supplier']}"
        )

    for issue in result["document_issues"]:
        print(f"REVIEW: {issue['message']}")

    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()