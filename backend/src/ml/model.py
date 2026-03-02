
"""
src/ml/model.py
===============
Carga el modelo ML serializado y expone predict().
Si no hay modelo entrenado, usa una heurística de fallback
para que la app funcione desde el día 1.

El modelo entrenado se guarda en src/ml/artifacts/model.joblib
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "model.joblib")


@dataclass
class PredictionResult:
    score: float          # 0–100. Mayor = mejor momento para comprar
    signal: str           # "BUY" | "WAIT"
    reason: str           # Explicación legible
    confidence: float     # 0–1. Confianza del modelo
    features_used: dict   # Features que alimentaron la predicción


class SteamPriceModel:
    """
    Wrapper del modelo ML.
    Primero intenta cargar el joblib; si no existe, usa la heurística.
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._load()

    def _load(self):
        if not os.path.exists(ARTIFACT_PATH):
            logger.warning(
                f"Modelo no encontrado en {ARTIFACT_PATH}. "
                "Usando heurística de fallback. Ejecuta train.py para entrenar."
            )
            return
        try:
            import joblib
            artifact = joblib.load(ARTIFACT_PATH)
            self._model = artifact.get("model")
            self._scaler = artifact.get("scaler")
            logger.info("Modelo ML cargado correctamente desde artifacts/")
        except Exception as e:
            logger.error(f"Error cargando modelo: {e}. Usando heurística.")

    def predict(self, features: dict) -> PredictionResult:
        """
        Genera una predicción dado el dict de features.
        Intenta usar el modelo; si falla, usa heurística.
        """
        from src.ml.features import features_to_vector

        vector = features_to_vector(features)

        if self._model is not None:
            return self._predict_with_model(vector, features)
        else:
            return self._heuristic(features)

    def _predict_with_model(self, vector: np.ndarray, features: dict) -> PredictionResult:
        try:
            X = vector.reshape(1, -1)
            if self._scaler:
                X = self._scaler.transform(X)

            score_raw = float(self._model.predict(X)[0])
            score = max(0.0, min(100.0, score_raw))
            confidence = 0.85  # TODO: calibration

            signal, reason = self._interpret(score, features)
            return PredictionResult(
                score=round(score, 1),
                signal=signal,
                reason=reason,
                confidence=confidence,
                features_used=features,
            )
        except Exception as e:
            logger.error(f"Error en predicción con modelo: {e}. Fallback a heurística.")
            return self._heuristic(features)

    def _heuristic(self, features: dict) -> PredictionResult:
        """
        Heurística basada en reglas cuando no hay modelo entrenado.
        Sirve como baseline y como fallback de producción.
        """
        score = 50.0  # base neutral

        cut = features.get("current_discount_pct", 0)
        max_cut = features.get("max_historical_discount", 0)
        price_ratio = features.get("price_vs_avg_ratio", 1.0)
        days_since_min = features.get("days_since_min_price", 365)
        days_since_sale = features.get("days_since_last_sale", 9999)
        sale_freq = features.get("sale_frequency", 0)
        month = features.get("current_month", 6)
        trend = features.get("price_trend_slope", 0)

        # Descuento actual
        if cut >= 75:
            score += 35
        elif cut >= 50:
            score += 25
        elif cut >= 25:
            score += 12
        elif cut > 0:
            score += 5

        # Precio actual vs promedio
        if price_ratio < 0.6:
            score += 15
        elif price_ratio < 0.8:
            score += 8
        elif price_ratio > 1.1:
            score -= 8

        # Proximidad al mínimo histórico
        if days_since_min < 30:
            score += 20
        elif days_since_min < 90:
            score += 10

        # Hace cuánto fue la última sale (si es inminente, esperar)
        if days_since_sale < 14:
            score -= 5   # acaba de estar en sale
        elif days_since_sale > 300 and sale_freq > 0.2:
            score += 10  # lleva mucho sin sale, pronto habrá una

        # Temporadas de ventas
        if month in (11, 12):  # Q4 / Black Friday / Winter Sale
            score += 8
        elif month in (6, 7):  # Steam Summer Sale
            score += 6

        # Tendencia bajista
        if trend < -0.01:
            score += 5
        elif trend > 0.01:
            score -= 5

        score = max(0.0, min(100.0, score))
        signal, reason = self._interpret(score, features)

        return PredictionResult(
            score=round(score, 1),
            signal=signal,
            reason=reason,
            confidence=0.6,  # heurística = menor confianza
            features_used=features,
        )

    @staticmethod
    def _interpret(score: float, features: dict) -> tuple[str, str]:
        """Convierte el score numérico a señal + razón legible."""
        cut = features.get("current_discount_pct", 0)
        month = features.get("current_month", 6)

        if score >= 75:
            signal = "BUY"
            if cut >= 50:
                reason = f"Descuento del {cut}% — precio cercano a su mínimo histórico."
            else:
                reason = "Múltiples indicadores sugieren este es un buen momento de compra."
        elif score >= 55:
            signal = "BUY"
            reason = "Las condiciones son favorables. Probablemente no habrá un mejor precio pronto."
        elif score >= 40:
            signal = "WAIT"
            if month in (10, 11):
                reason = "Espera unos días — la temporada de rebajas de fin de año está cerca."
            else:
                reason = "El precio está cerca del promedio. Podrías obtenerlo más barato."
        else:
            signal = "WAIT"
            if cut == 0:
                reason = "El juego no está en rebaja. Históricamente suele tener mejores descuentos."
            else:
                reason = "Este descuento es menor que los descuentos históricos típicos."

        return signal, reason


# ── Singleton ─────────────────────────────────────────────────────────────────

_model_instance: Optional[SteamPriceModel] = None


def get_model() -> SteamPriceModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = SteamPriceModel()
    return _model_instance