import logging
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated, Literal

import pdfplumber
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from extract_pdf import extract_invoices


app = FastAPI(
    title="Invoice PDF Import",
    version="0.1.0",
)

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PAGES = 30


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract")
def extract(
    file: Annotated[UploadFile, File()],
    date_format: Annotated[Literal["mdy", "dmy"], Form()],
):
    filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]

    try:
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Upload a PDF file.",
            )

        # Read at most the allowed size plus one byte.
        content = file.file.read(MAX_FILE_BYTES + 1)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="PDF must be 10 MB or smaller.",
            )

        if b"%PDF-" not in content[:1024]:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid PDF.",
            )

        with TemporaryDirectory(prefix="invoice-import-") as folder:
            pdf_path = Path(folder) / "upload.pdf"
            pdf_path.write_bytes(content)

            with pdfplumber.open(pdf_path) as pdf:
                page_count = len(pdf.pages)

                if page_count == 0:
                    raise HTTPException(
                        status_code=422,
                        detail="The PDF contains no pages.",
                    )

                if page_count > MAX_PAGES:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Upload a PDF with {MAX_PAGES} pages or fewer.",
                    )

            selected_format = (
                "%m/%d/%Y"
                if date_format == "mdy"
                else "%d/%m/%Y"
            )

            result = extract_invoices(
                pdf_path,
                selected_format,
            )

            if result["matched_tables"] == 0:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "No supported invoice tables were found. "
                        "Upload a text-based email PDF containing Date, "
                        "PO, Qty, Invoice No and Supplier columns."
                    ),
                )

            result["source_file"] = filename
            result["page_count"] = page_count

            return result

    except HTTPException:
        raise

    except Exception:
        logger.exception("PDF extraction failed.")

        raise HTTPException(
            status_code=422,
            detail=(
                "Unable to read this PDF. Check whether it is damaged "
                "or password-protected."
            ),
        ) from None

    finally:
        file.file.close()