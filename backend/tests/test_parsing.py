import io

import docx
import pytest

from app.parsing import ParseError, extract_resume_text

RESUME_LINE = "Srikanth - Python, SQL, scikit-learn, Flask, OpenCV. Built a face mask detector. "


def make_docx(text: str) -> bytes:
    document = docx.Document()
    document.add_paragraph(text)
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Skills"
    table.rows[0].cells[1].text = "Pandas"
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_pdf(text: str) -> bytes:
    """Build a tiny valid one-page PDF containing `text` (no extra library needed)."""
    stream = f"BT /F1 10 Tf 20 700 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % number + body + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1))
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1))
    out.write(b"startxref\n%d\n%%%%EOF\n" % xref)
    return out.getvalue()


def test_reads_docx_including_tables():
    text = extract_resume_text("cv.docx", make_docx(RESUME_LINE * 2))
    assert "face mask detector" in text
    assert "Skills | Pandas" in text


def test_reads_pdf():
    text = extract_resume_text("CV.PDF", make_pdf(RESUME_LINE * 2))
    assert "scikit-learn" in text


def test_rejects_other_file_types():
    with pytest.raises(ParseError, match="PDF or DOCX"):
        extract_resume_text("cv.txt", b"hello")


def test_rejects_nearly_empty_files():
    with pytest.raises(ParseError, match="scanned"):
        extract_resume_text("cv.docx", make_docx("Hi"))


def test_rejects_corrupt_files():
    with pytest.raises(ParseError, match="Couldn't read"):
        extract_resume_text("cv.pdf", b"not really a pdf")


def test_rejects_large_files():
    with pytest.raises(ParseError, match="5 MB"):
        extract_resume_text("cv.pdf", b"0" * (5 * 1024 * 1024 + 1))
