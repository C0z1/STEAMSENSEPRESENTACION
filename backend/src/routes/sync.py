
"""
src/routes/sync.py
==================
Endpoints para sincronizar datos de precios desde ITAD y SteamSpy.
"""
import logging
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from src.services import sync_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/game/{appid}")
async def sync_game_by_appid(appid: int):
    """Sincroniza un juego por Steam appid. Usado por EmptyStateWithSeed."""
    result = await sync_service.sync_by_appid(appid)
    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail=f"appid {appid} no encontrado en ITAD")
    return result


@router.post("/id/{game_id:path}")
async def sync_game_by_id(game_id: str):
    """Sincroniza un juego por ITAD game_id. Llamado desde GameSearch."""
    result = await sync_service.sync_by_game_id(game_id)
    return result


@router.post("/top")
async def sync_top_games(
    background_tasks: BackgroundTasks,
    top_n: int = Query(100, ge=10, le=500),
):
    """Sincroniza los top N juegos de SteamSpy en segundo plano."""
    background_tasks.add_task(sync_service.sync_top_games, top_n)
    return {"status": "started", "message": f"Sincronizando top {top_n} juegos en segundo plano"}


@router.post("/repair")
async def repair_orphaned_games(background_tasks: BackgroundTasks):
    """
    Busca juegos sin título real o sin appid y los arregla consultando ITAD.
    Corre en background — puede tardar varios minutos dependiendo del número de huérfanos.
    """
    background_tasks.add_task(sync_service.repair_orphaned_games)
    return {
        "status": "started",
        "message": "Repairing orphaned games in background. Check logs for progress.",
    }


@router.post("/predictions")
async def generate_all_predictions(
    background_tasks: BackgroundTasks,
    limit: int = Query(200, ge=1, le=2000),
):
    """Genera predicciones ML para todos los juegos con historial suficiente."""
    async def do_batch():
        from src.db.connection import get_db
        from src.db import queries
        from src.services import predict_service
        con = get_db()
        games = queries.list_games(con, limit=limit, offset=0)
        ok = skipped = errors = 0
        for game in games:
            if not game.get("total_records") or game["total_records"] < 3:
                skipped += 1
                continue
            try:
                predict_service.get_prediction(game["id"], force_refresh=False)
                ok += 1
            except Exception:
                errors += 1
        logger.info(f"Batch predictions done: {ok} ok / {skipped} skipped / {errors} errors")

    background_tasks.add_task(do_batch)
    return {"status": "started", "message": f"Generating predictions for up to {limit} games"}