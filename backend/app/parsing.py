"""Turn an uploaded resume (PDF or DOCX) into plain text. Files are read in memory, never saved."""

import io
import re

import docx
from pypdf import PdfReader

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_TEXT_CHARS = 20_000


class ParseError(ValueError):
    """A problem with the file, with a message that's safe to show the user."""


def extract_resume_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_FILE_BYTES:
        raise ParseError("File is larger than 5 MB.")

    name = filename.lower()
    try:
        if name.endswith(".pdf"):
            text = _pdf_text(data)
        elif name.endswith(".docx"):
            text = _docx_text(data)
        else:
            raise ParseError("Please upload a PDF or DOCX file.")
    except ParseError:
        raise
    except Exception as exc:  # corrupt or password-protected files
        raise ParseError("Couldn't read that file. Try another file or paste the text.") from exc

    text = _clean(text)
    if len(text) < 100:
        raise ParseError(
            "Found almost no text. If this is a scanned PDF, please paste your resume text instead."
        )
    return text[:MAX_TEXT_CHARS]


def _pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _docx_text(data: bytes) -> str:
    document = docx.Document(io.BytesIO(data))
    lines = [p.text for p in document.paragraphs]
    # Many resumes use tables for layout, so read table cells too.
    for table in document.tables:
        for row in table.rows:
            lines.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(lines)


def _clean(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)  # collapse runs of spaces
    text = re.sub(r"\n\s*\n+", "\n\n", text)  # at most one blank line
    return text.strip()
