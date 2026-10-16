import logging
import os
import secrets
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated, Literal
from io import BytesIO
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener

from pydantic import BaseModel, Field

import pdfplumber
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
)

from extract_pdf import extract_invoices


app = FastAPI(
    title="Invoice PDF Import",
    version="0.1.0",
)

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PAGES = 50


@app.get("/health")
def health():
    return {"status": "ok"}

def require_api_key(
    x_api_key: Annotated[str | None, Header()] = None,
):
    expected_key = os.environ.get("INVOICE_IMPORT_API_KEY", "")
    received_key = x_api_key or ""

    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="Invoice import service is not configured.",
        )

    if not secrets.compare_digest(
        received_key.encode("utf-8"),
        expected_key.encode("utf-8"),
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid service credentials.",
        )


@app.post(
    "/extract",
    dependencies=[Depends(require_api_key)],
)
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

class StoredPdfRequest(BaseModel):
    download_url: str = Field(max_length=8192)
    filename: str = Field(min_length=1, max_length=255)
    date_format: Literal["mdy", "dmy"]


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@app.post(
    "/extract-stored",
    dependencies=[Depends(require_api_key)],
)
def extract_stored(payload: StoredPdfRequest):
    configured_url = os.environ.get("SUPABASE_URL", "").rstrip("/")

    if not configured_url:
        raise HTTPException(
            status_code=503,
            detail="PDF storage connection is not configured.",
        )

    expected = urlsplit(configured_url)
    supplied = urlsplit(payload.download_url)

    # Accept signed downloads only from our own Supabase bucket.
    if (
        expected.scheme != "https"
        or supplied.scheme != "https"
        or supplied.netloc != expected.netloc
        or supplied.username is not None
        or supplied.password is not None
        or supplied.fragment
        or not supplied.path.startswith(
            "/storage/v1/object/sign/invoice-imports/"
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF storage URL.",
        )

    try:
        opener = build_opener(NoRedirects())

        with opener.open(payload.download_url, timeout=30) as response:
            content = response.read(MAX_FILE_BYTES + 1)

    except Exception:
        # Do not log the signed URL/token.
        raise HTTPException(
            status_code=502,
            detail="Unable to download the uploaded PDF. Retry extraction.",
        ) from None

    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="PDF must be 10 MB or smaller.",
        )

    # Reuse existing PDF validation and extraction.
    uploaded_file = UploadFile(
        file=BytesIO(content),
        filename=payload.filename,
    )

    return extract(
        file=uploaded_file,
        date_format=payload.date_format,
    )