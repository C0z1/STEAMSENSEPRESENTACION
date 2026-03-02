
"""
src/services/predict_service.py
"""
import logging
import math
from typing import Optional

from src.db import queries
from src.db.connection import get_db
from src.ml.features import build_features
from src.ml.model import get_model, PredictionResult

logger = logging.getLogger(__name__)
CACHE_MAX_AGE_HOURS = 6


def _san(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def get_prediction(game_id: str, force_refresh: bool = False) -> dict:
    con = get_db()

    game = queries.get_game(con, game_id)
    if not game:
        raise ValueError(f"Juego no encontrado: {game_id}")

    # Try cache first
    if not force_refresh:
        cached = queries.get_cached_prediction(con, game_id, CACHE_MAX_AGE_HOURS)
        if cached:
            logger.debug(f"Cache hit para game_id={game_id}")
            # Still need price context — fetch it fresh
            stats = queries.get_price_stats(con, game_id)
            history = queries.get_price_history(con, game_id)
            last = history[-1] if history else {}
            return _format_from_cache(game, cached, stats, last)

    # Full recalculation
    stats    = queries.get_price_stats(con, game_id)
    history  = queries.get_price_history(con, game_id)
    seasonal = queries.get_seasonal_patterns(con, game_id)

    if not history or len(history) < 3:
        raise ValueError(f"Historial insuficiente ({len(history or [])} registros). Mínimo 3.")

    features = build_features(stats, history, seasonal)
    if not features:
        raise ValueError("No se pudieron construir features de predicción")

    model  = get_model()
    result: PredictionResult = model.predict(features)

    queries.upsert_prediction(
        con, game_id=game_id, score=result.score, signal=result.signal,
        reason=result.reason,
        features={k: v for k, v in features.items() if not k.startswith("_")},
    )

    return _format_response(game, result.score, result.signal, result.reason,
                            result.confidence, features, from_cache=False)


def _format_from_cache(game: dict, cached: dict, stats: Optional[dict], last_record: dict) -> dict:
    current_price = _san(float(last_record.get("price_usd", 0) or 0)) or 0
    cut_pct       = int(last_record.get("cut_pct", 0) or 0)
    min_price     = _san(stats.get("min_price", 0) if stats else 0) or 0
    avg_price     = _san(stats.get("avg_price", 0) if stats else 0) or 0
    return {
        "game_id": game["id"],
        "title":   game["title"],
        "appid":   game.get("appid"),
        "prediction": {
            "score":      _san(float(cached.get("score") or 0)) or 0,
            "signal":     cached.get("signal", "WAIT"),
            "reason":     cached.get("reason", ""),
            "confidence": 0.0,
        },
        "price_context": {
            "current_price":        current_price,
            "min_price_ever":       min_price,
            "avg_price":            avg_price,
            "current_discount_pct": cut_pct,
        },
        "from_cache": True,
    }


def _format_response(game: dict, score: float, signal: str, reason: str,
                     confidence: float, features: dict, from_cache: bool) -> dict:
    return {
        "game_id": game["id"],
        "title":   game["title"],
        "appid":   game.get("appid"),
        "prediction": {
            "score":      _san(score) or 0,
            "signal":     signal,
            "reason":     reason,
            "confidence": round(_san(confidence) or 0, 2),
        },
        "price_context": {
            "current_price":        _san(features.get("_current_price", 0)) or 0,
            "min_price_ever":       _san(features.get("_min_price", 0)) or 0,
            "avg_price":            _san(features.get("_avg_price", 0)) or 0,
            "current_discount_pct": _san(features.get("current_discount_pct", 0)) or 0,
        },
        "from_cache": from_cache,
    }