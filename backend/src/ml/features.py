
"""
src/ml/features.py
==================
Feature engineering para el modelo ML de predicción de precios.
Toma los datos de precio de DuckDB y construye el vector de features.

Features extraídas:
  - current_discount_pct    → % de descuento actual
  - days_since_min_price    → días transcurridos desde el mínimo histórico
  - price_vs_avg_ratio      → precio actual / precio promedio histórico
  - max_historical_discount → mayor descuento registrado
  - avg_discount_q4         → descuento promedio en Q4 (temporada de rebajas)
  - avg_discount_summer     → descuento promedio en verano (Steam Summer Sale)
  - current_month           → mes actual (1–12) para detectar estacionalidad
  - days_since_last_sale    → días desde la última vez que hubo descuento
  - sale_frequency          → proporción de registros que tuvieron descuento
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


def build_features(stats: dict, history: list[dict], seasonal: list[dict]) -> Optional[dict]:
    """
    Construye el vector de features a partir de los datos de DuckDB.

    Args:
        stats:    Resultado de queries.get_price_stats()
        history:  Resultado de queries.get_price_history()
        seasonal: Resultado de queries.get_seasonal_patterns()

    Returns:
        Dict con features normalizadas, o None si no hay datos suficientes.
    """
    if not history or len(history) < 3:
        logger.debug("Historial insuficiente para construir features")
        return None

    now = datetime.now(timezone.utc)

    # ── Precio actual (último registro) ──────────────────────────────────────
    last = history[-1]
    current_price = float(last.get("price_usd", 0))
    current_cut = int(last.get("cut_pct", 0))

    # ── Stats básicas ─────────────────────────────────────────────────────────
    min_price = float(stats.get("min_price") or 0)
    max_price = float(stats.get("max_price") or current_price)
    avg_price = float(stats.get("avg_price") or current_price)
    max_discount = float(stats.get("max_discount") or 0)

    # ── Ratio precio actual vs promedio ──────────────────────────────────────
    price_vs_avg = (current_price / avg_price) if avg_price > 0 else 1.0

    # ── Días desde el mínimo histórico ───────────────────────────────────────
    days_since_min = float(stats.get("days_since_min_price") or 365)

    # ── Frecuencia de ventas ──────────────────────────────────────────────────
    total_records = len(history)
    on_sale_records = sum(1 for r in history if int(r.get("cut_pct", 0)) > 0)
    sale_frequency = on_sale_records / total_records if total_records > 0 else 0

    # ── Días desde la última venta ────────────────────────────────────────────
    days_since_last_sale = 9999
    for record in reversed(history):
        if int(record.get("cut_pct", 0)) > 0:
            ts = record.get("timestamp")
            if ts:
                if hasattr(ts, "tzinfo") and ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                days_since_last_sale = (now - ts).days
            break

    # ── Patrones estacionales ─────────────────────────────────────────────────
    seasonal_map = {int(s["month"]): float(s["avg_discount"]) for s in seasonal}
    avg_cut_q4 = float(stats.get("avg_cut_q4") or 0)
    avg_cut_summer = float(stats.get("avg_cut_summer") or 0)
    current_month = now.month

    # ── Tendencia de precio (pendiente de regresión lineal simple) ────────────
    prices = [float(r.get("price_usd", 0)) for r in history if float(r.get("price_usd", 0)) > 0]
    price_trend = 0.0
    if len(prices) >= 5:
        x = np.arange(len(prices))
        coeffs = np.polyfit(x, prices, 1)
        price_trend = float(coeffs[0])  # pendiente: negativa = bajando

    features = {
        "current_discount_pct":    current_cut,
        "days_since_min_price":    min(days_since_min, 730),   # cap 2 años
        "price_vs_avg_ratio":      round(price_vs_avg, 4),
        "max_historical_discount": max_discount,
        "avg_discount_q4":         avg_cut_q4,
        "avg_discount_summer":     avg_cut_summer,
        "current_month":           current_month,
        "days_since_last_sale":    min(days_since_last_sale, 730),
        "sale_frequency":          round(sale_frequency, 4),
        "price_trend_slope":       round(price_trend, 6),
        # Meta (no usados por el modelo, útiles para el frontend)
        "_current_price":          current_price,
        "_min_price":              min_price,
        "_max_price":              max_price,
        "_avg_price":              avg_price,
    }

    logger.debug(f"Features construidas: {features}")
    return features


def features_to_vector(features: dict) -> np.ndarray:
    """
    Convierte el dict de features al vector ordenado que espera el modelo.
    El orden debe coincidir exactamente con el que se usó en train.py.
    """
    FEATURE_ORDER = [
        "current_discount_pct",
        "days_since_min_price",
        "price_vs_avg_ratio",
        "max_historical_discount",
        "avg_discount_q4",
        "avg_discount_summer",
        "current_month",
        "days_since_last_sale",
        "sale_frequency",
        "price_trend_slope",
    ]
    return np.array([features.get(k, 0) for k in FEATURE_ORDER], dtype=float)