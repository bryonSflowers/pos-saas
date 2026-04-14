from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class TimestampSchema(BaseModel):
    created_at: datetime
    updated_at: datetime


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list
