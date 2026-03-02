
"""
src/routes/user.py
==================
Endpoints del usuario autenticado: librería, wishlist, recomendaciones.

FIXES sobre el original:
  - Wishlist: detecta perfil privado y retorna sync_meta con feedback
  - Library sync background: genera predicciones post-sync
"""
import logging
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from src.api.steam_auth import decode_jwt
from src.api.steam_client import get_steam_client, _get_key
from src.db.connection import get_db
from src.db import user_queries
from src.services import sync_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/me", tags=["user"])


def _get_steam_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt(auth[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload["sub"]


def _check_steam_key():
    try:
        _get_key()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/library")
async def get_library(request: Request, sync: bool = False):
    steam_id = _get_steam_id(request)
    con = get_db()

    if sync:
        try:
            steam = get_steam_client()
            games = await steam.get_owned_games(steam_id)
            if games:
                n = user_queries.sync_user_library(con, steam_id, games)
                logger.info(f"Sync directo: {n} juegos para {steam_id}")
            else:
                logger.warning(f"get_owned_games retornó 0 juegos para {steam_id}")
        except Exception as e:
            logger.error(f"Error sync librería: {e}")

    library = user_queries.get_user_library(con, steam_id)
    stats   = user_queries.get_library_stats(con, steam_id)
    return {"steam_id": steam_id, "stats": stats, "games": library}


@router.post("/library/sync")
async def sync_library(request: Request, background_tasks: BackgroundTasks):
    steam_id = _get_steam_id(request)
    _check_steam_key()

    async def do_sync():
        try:
            con = get_db()
            steam = get_steam_client()
            games = await steam.get_owned_games(steam_id)
            if games:
                n = user_queries.sync_user_library(con, steam_id, games)
                logger.info(f"Background sync OK: {n} juegos para {steam_id}")
                # FIX: generar predicciones para juegos del usuario que ya tienen historial
                await _generate_predictions_for_user(con, steam_id)
            else:
                logger.warning(f"Background sync: 0 juegos — perfil privado o key inválida")
        except Exception as e:
            logger.error(f"Background sync falló: {e}")

    background_tasks.add_task(do_sync)
    return {"status": "syncing", "message": "Library sync started"}


async def _generate_predictions_for_user(con, steam_id: str):
    """Genera predicciones para los juegos del usuario que tengan historial en DB."""
    try:
        from src.services import predict_service
        library = user_queries.get_user_library(con, steam_id)
        ok = 0
        for g in library:
            if g.get("game_id") and g.get("total_records", 0) >= 3:
                try:
                    predict_service.get_prediction(g["game_id"], force_refresh=False)
                    ok += 1
                except Exception:
                    pass
        logger.info(f"Predicciones generadas para {ok} juegos de {steam_id}")
    except Exception as e:
        logger.warning(f"Error generando predicciones post-sync: {e}")


@router.get("/wishlist")
async def get_wishlist(request: Request, sync: bool = False):
    steam_id = _get_steam_id(request)
    con = get_db()

    # FIX: metadata de sync para informar al frontend qué pasó
    sync_meta = {
        "synced": False,
        "items_found": 0,
        "items_imported": 0,
        "private_profile": False,
        "error": None,
    }

    if sync:
        try:
            steam = get_steam_client()
            result = await steam.get_wishlist(steam_id)
            items = result.get("items", [])
            status = result.get("status", "error")

            if status == "private":
                # HTTP 403 — Steam blocked access, profile is private
                sync_meta["private_profile"] = True
                sync_meta["error"] = (
                    "Tu wishlist de Steam es privada. "
                    "Ve a Steam → Perfil → Editar → Privacidad y pon "
                    "'Detalles del juego' en Público."
                )
            elif status == "error":
                sync_meta["error"] = (
                    "No se pudo obtener tu wishlist. Revisa tu conexión o intenta más tarde."
                )
            elif len(items) == 0:
                # HTTP 200 + valid empty response — wishlist is truly empty
                sync_meta["synced"] = True
                sync_meta["items_found"] = 0
            else:
                sync_meta["items_found"] = len(items)
                n_imported = user_queries.sync_user_wishlist(con, steam_id, items)
                sync_meta["items_imported"] = n_imported
                sync_meta["synced"] = True
                logger.info(f"Wishlist Steam: {len(items)} items, {n_imported} importados para {steam_id}")

                # Sync precio + predicción para top 15 items
                synced = 0
                for item in items[:15]:
                    if item.get("appid"):
                        try:
                            result = await sync_service.sync_by_appid(item["appid"])
                            if result.get("inserted", 0) > 0:
                                synced += 1
                                from src.services import predict_service
                                if result.get("game_id"):
                                    try:
                                        predict_service.get_prediction(result["game_id"], force_refresh=True)
                                    except Exception:
                                        pass
                        except Exception as e:
                            logger.debug(f"Wishlist item sync error appid={item['appid']}: {e}")
                logger.info(f"Wishlist ITAD sync: {synced} juegos con datos nuevos")

        except Exception as e:
            logger.error(f"Error sync wishlist: {e}")
            sync_meta["error"] = f"Error inesperado: {str(e)[:100]}"

    wishlist = user_queries.get_user_wishlist_with_prices(con, steam_id)
    return {"steam_id": steam_id, "wishlist": wishlist, "sync_meta": sync_meta}


@router.get("/recommendations")
def get_recommendations(request: Request, limit: int = 12):
    steam_id = _get_steam_id(request)
    con = get_db()
    recs = user_queries.get_recommendations(con, steam_id, limit=limit)
    return {"steam_id": steam_id, "recommendations": recs}


@router.get("/owned/{appid}")
def check_owned(request: Request, appid: int):
    steam_id = _get_steam_id(request)
    con = get_db()
    owned = appid in user_queries.get_user_owned_appids(con, steam_id)
    return {"appid": appid, "owned": owned}