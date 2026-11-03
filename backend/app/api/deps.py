"""Shared FastAPI dependencies."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Visitor

DbSession = Annotated[Session, Depends(get_db)]


def get_visitor(db: DbSession, x_visitor_id: Annotated[str, Header()]) -> Visitor:
    """Identify the anonymous visitor from the X-Visitor-Id header (created on first visit)."""
    try:
        visitor_id = str(uuid.UUID(x_visitor_id))
    except ValueError as exc:
        raise HTTPException(400, "Invalid visitor ID.") from exc

    visitor = db.get(Visitor, visitor_id)
    if visitor is None:
        visitor = Visitor(id=visitor_id)
        db.add(visitor)
    visitor.last_seen = datetime.now(UTC)
    db.commit()
    return visitor


CurrentVisitor = Annotated[Visitor, Depends(get_visitor)]
