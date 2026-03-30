"""AgenticFlow — Workspace Endpoints"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import Workspace

router = APIRouter()

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    model_config = {"from_attributes": True}

@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(payload: WorkspaceCreate, owner_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ws = Workspace(name=payload.name, slug=payload.name.lower().replace(" ", "-"), owner_id=owner_id)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws

@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(owner_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workspace).where(Workspace.owner_id == owner_id))
    return result.scalars().all()
