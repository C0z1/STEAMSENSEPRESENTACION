
"""
src/ml/train.py
===============
Script standalone para entrenar/reentrenar el modelo ML.

Uso:
  python -m src.ml.train --db ./data/steamsense.duckdb

Lee datos de DuckDB, construye features para todos los juegos,
entrena un modelo de regresión y serializa en artifacts/model.joblib.

Requiere scikit-learn y joblib (incluidos en requirements.txt).
"""

import argparse
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("train")


def train(db_path: str, output_path: str):
    import duckdb
    import numpy as np
    import joblib
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, r2_score

    from src.ml.features import build_features, features_to_vector
    from src.db import queries

    logger.info(f"Conectando a DuckDB: {db_path}")
    con = duckdb.connect(db_path)

    # Obtener todos los game_ids que tienen historial
    games = con.execute("""
        SELECT DISTINCT game_id FROM price_history
        GROUP BY game_id HAVING COUNT(*) >= 10
    """).fetchdf()

    logger.info(f"Juegos con historial suficiente: {len(games)}")

    X_rows = []
    y_rows = []

    for game_id in games["game_id"]:
        try:
            stats = queries.get_price_stats(con, game_id)
            history = queries.get_price_history(con, game_id)
            seasonal = queries.get_seasonal_patterns(con, game_id)

            if not stats or not history:
                continue

            # El "label" es el descuento máximo que tuvo el juego
            # (proxy de qué tan bien le fue comprando en ese momento)
            max_cut = float(stats.get("max_discount") or 0)

            # Simular features en diferentes puntos del tiempo (data augmentation)
            for i in range(len(history) - 1, max(len(history) - 10, 0), -2):
                partial_history = history[:i+1]
                feats = build_features(stats, partial_history, seasonal)
                if feats:
                    X_rows.append(features_to_vector(feats))
                    y_rows.append(max_cut)

        except Exception as e:
            logger.warning(f"Error procesando {game_id}: {e}")
            continue

    if len(X_rows) < 20:
        logger.error(f"Datos insuficientes para entrenar ({len(X_rows)} muestras). Necesitas más datos en DuckDB.")
        sys.exit(1)

    X = np.array(X_rows)
    y = np.array(y_rows)

    logger.info(f"Dataset: {X.shape[0]} muestras, {X.shape[1]} features")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    logger.info("Entrenando GradientBoostingRegressor...")
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        random_state=42,
    )
    model.fit(X_train_scaled, y_train)

    preds = model.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)

    logger.info(f"MAE: {mae:.2f}  |  R²: {r2:.4f}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    joblib.dump({"model": model, "scaler": scaler}, output_path)
    logger.info(f"Modelo guardado en: {output_path}")

    con.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="./data/steamsense.duckdb")
    parser.add_argument("--output", default=os.path.join(
        os.path.dirname(__file__), "artifacts", "model.joblib"
    ))
    args = parser.parse_args()
    train(args.db, args.output)