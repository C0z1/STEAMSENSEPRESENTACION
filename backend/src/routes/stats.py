
"""src/routes/stats.py — Dashboard stats"""
from fastapi import APIRouter
from src.db.connection import get_db
from src.db import queries

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def overview():
    """Stats globales: total juegos, registros, señales."""
    con = get_db()
    return queries.get_overview_stats(con)