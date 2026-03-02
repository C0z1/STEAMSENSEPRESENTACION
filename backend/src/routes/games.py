
"""
src/routes/games.py
"""
import logging
from fastapi import APIRouter, HTTPException, Query
from src.db.connection import get_db
from src.db import queries
from src.api.client import ITADClient
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/games", tags=["games"])


@router.get("/search")
async def search_games(q: str, limit: int = Query(20, ge=1, le=50)):
    """Busca juegos por nombre en ITAD. Enriquece con appid desde DB local si existe."""
    if not q or len(q.strip()) < 2:
        return []
    try:
        async with ITADClient(settings.itad_api_key) as client:
            results = await client.search_games(q.strip(), limit=limit)

        # FIX: enriquecer resultados con appid desde nuestra DB local.
        # Así el frontend puede mostrar la imagen de Steam en el dropdown.
        con = get_db()
        enriched = []
        for r in results:
            appid = None
            try:
                game = queries.get_game(con, r.id)
                if game:
                    appid = game.get("appid")
            except Exception:
                pass
            enriched.append({
                "id":    r.id,
                "slug":  r.slug,
                "title": r.title,
                "type":  r.type,
                "appid": appid,
            })
        return enriched

    except Exception as e:
        logger.error(f"Search error: {e}")
        return []


@router.get("")
def list_games(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    con = get_db()
    return {"games": queries.list_games(con, limit=limit, offset=offset)}


@router.get("/{game_id}")
def get_game(game_id: str):
    con = get_db()
    game = queries.get_game(con, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    stats    = queries.get_price_stats(con, game_id)
    seasonal = queries.get_seasonal_patterns(con, game_id)
    return {
        "id":                game["id"],
        "title":             game["title"],
        "appid":             game.get("appid"),
        "slug":              game.get("slug"),
        "stats":             stats,
        "seasonal_patterns": seasonal,
    }


@router.get("/{game_id}/current-prices")
async def get_current_prices(game_id: str):
    """Precios actuales de todas las tiendas vía ITAD."""
    try:
        async with ITADClient(settings.itad_api_key) as client:
            import httpx
            async with httpx.AsyncClient(timeout=15) as http:
                r = await http.post(
                    f"{settings.itad_base_url}/games/prices/v3",
                    params={"country": settings.itad_country},
                    json=[game_id],
                    headers={
                        "Authorization": f"Bearer {settings.itad_api_key}",
                        "Content-Type": "application/json",
                    }
                )
                if r.status_code != 200:
                    logger.warning(f"ITAD prices/v3 HTTP {r.status_code}: {r.text[:200]}")
                    return {"game_id": game_id, "prices": []}
                data = r.json()

            prices = []
            items = data if isinstance(data, list) else data.get("list", [])
            for item in items:
                for deal in item.get("deals", []):
                    shop        = deal.get("shop", {})
                    price_obj   = deal.get("price", {})
                    regular_obj = deal.get("regular", {})
                    prices.append({
                        "shop_name":   shop.get("name", "Unknown"),
                        "shop_id":     shop.get("id"),
                        "price_usd":   price_obj.get("amount", 0),
                        "regular_usd": regular_obj.get("amount", 0),
                        "cut_pct":     deal.get("cut", 0),
                        "url":         deal.get("url", ""),
                        "drm":         deal.get("drm", []),
                    })
            prices.sort(key=lambda x: x["price_usd"])
            return {"game_id": game_id, "prices": prices}

    except Exception as e:
        logger.error(f"current-prices error para {game_id}: {e}")
        return {"game_id": game_id, "prices": []}


@router.get("/top/deals")
def top_deals(limit: int = Query(12, ge=1, le=100)):  # FIX: le=50 → le=100
    con = get_db()
    return {"deals": queries.get_top_deals(con, limit=limit)}


@router.get("/top/buy")
def top_buy_signals(limit: int = Query(12, ge=1, le=100)):  # FIX: le=50 → le=100
    con = get_db()
    return {"signals": queries.get_best_predictions(con, signal="BUY", limit=limit)}