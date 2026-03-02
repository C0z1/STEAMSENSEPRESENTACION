
"""
src/services/price_service.py
"""
import logging
import math
from datetime import datetime
from typing import Optional

from src.db import queries
from src.db.connection import get_db

logger = logging.getLogger(__name__)


def _clean(d: dict) -> dict:
    return {k: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
            for k, v in d.items()}


def get_game_history(game_id: str, since: Optional[datetime] = None,
                     until: Optional[datetime] = None) -> dict:
    con = get_db()
    game = queries.get_game(con, game_id)
    if not game:
        raise ValueError(f"Juego no encontrado: {game_id}")

    history = queries.get_price_history(con, game_id, since=since, until=until)

    cleaned = []
    for record in history:
        r = _clean(record)
        ts = r.get("timestamp")
        if isinstance(ts, datetime):
            r["timestamp"] = ts.isoformat()
        cleaned.append(r)

    # Return empty history without raising — game page handles it gracefully
    return {
        "game_id": game_id,
        "title":   game.get("title"),
        "appid":   game.get("appid"),
        "count":   len(cleaned),
        "history": cleaned,
    }


def get_game_stats(game_id: str) -> dict:
    con = get_db()
    game = queries.get_game(con, game_id)
    if not game:
        raise ValueError(f"Juego no encontrado: {game_id}")

    stats    = queries.get_price_stats(con, game_id)
    seasonal = queries.get_seasonal_patterns(con, game_id)

    return {
        "game_id":          game_id,
        "title":            game.get("title"),
        "appid":            game.get("appid"),
        "stats":            _clean(stats) if stats else None,
        "seasonal_patterns": [_clean(s) for s in seasonal],
    }