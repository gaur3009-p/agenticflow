"""AgenticFlow — API v1 Router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, agents, training, eval, workspace

api_router = APIRouter()
api_router.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
api_router.include_router(workspace.router, prefix="/workspace", tags=["Workspace"])
api_router.include_router(agents.router,    prefix="/agents",    tags=["Agents"])
api_router.include_router(training.router,  prefix="/training",  tags=["Training"])
api_router.include_router(eval.router,      prefix="/eval",      tags=["Evaluation"])
