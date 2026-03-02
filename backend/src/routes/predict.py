
"""
src/routes/predict.py
=====================
Endpoints de predicción ML.
"""

from fastapi import APIRouter, HTTPException, Query

from src.services import predict_service

router = APIRouter(prefix="/predict", tags=["predict"])


@router.get("/{game_id}")
def predict(
    game_id: str,
    force_refresh: bool = Query(False, description="Ignorar cache y recalcular"),
):
    """
    Predicción ML: ¿Es buen momento para comprar este juego?

    Retorna:
    - score (0–100): mayor = mejor momento
    - signal: "BUY" | "WAIT"
    - reason: explicación legible
    - price_context: precio actual vs histórico
    """
    try:
        return predict_service.get_prediction(game_id, force_refresh=force_refresh)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/batch")
def predict_batch(limit: int = Query(100, ge=1, le=500)):
    """
    Genera predicciones para todos los juegos que tienen historial suficiente.
    Necesario para poblar Hot Deals y BUY Signals.
    """
    from src.db.connection import get_db
    from src.db import queries as q

    con = get_db()
    games = q.list_games(con, limit=limit, offset=0)
    results = {"ok": 0, "skipped": 0, "errors": 0}

    for game in games:
        game_id = game["id"]
        if not game.get("total_records") or game["total_records"] < 3:
            results["skipped"] += 1
            continue
        try:
            predict_service.get_prediction(game_id, force_refresh=False)
            results["ok"] += 1
        except Exception as e:
            results["errors"] += 1

    return {"status": "done", **results}