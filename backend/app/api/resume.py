from fastapi import APIRouter, HTTPException, UploadFile

from app.api.deps import CurrentVisitor
from app.parsing import MAX_FILE_BYTES, ParseError, extract_resume_text
from app.schemas import ResumeParseOut

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/parse")
async def parse_resume(file: UploadFile, _visitor: CurrentVisitor) -> ResumeParseOut:
    """Extract text from an uploaded resume. The file itself is never stored."""
    data = await file.read(MAX_FILE_BYTES + 1)
    try:
        text = extract_resume_text(file.filename or "", data)
    except ParseError as exc:
        raise HTTPException(422, str(exc)) from exc
    return ResumeParseOut(filename=file.filename or "resume", text=text, chars=len(text))
