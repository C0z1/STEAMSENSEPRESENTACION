
"""
src/routes/prices.py
====================
Endpoints de historial y estadísticas de precios.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.services import price_service

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/{game_id}/history")
def price_history(
    game_id: str,
    since: Optional[datetime] = Query(None, description="Fecha inicio (ISO 8601)"),
    until: Optional[datetime] = Query(None, description="Fecha fin (ISO 8601)"),
):
    """Historial completo de precios de un juego."""
    try:
        return price_service.get_game_history(game_id, since=since, until=until)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{game_id}/stats")
def price_stats(game_id: str):
    """Estadísticas agregadas: mínimo histórico, descuentos por temporada, etc."""
    try:
        return price_service.get_game_stats(game_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))