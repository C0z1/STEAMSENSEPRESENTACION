
"""
src/db/models.py
================
Definición y creación de tablas en DuckDB.
Ejecutar create_all_tables() una vez al iniciar la app.
"""

import logging

import duckdb

logger = logging.getLogger(__name__)


def create_all_tables(con: duckdb.DuckDBPyConnection):
    """Crea todas las tablas si no existen. Idempotente."""

    # ── games ─────────────────────────────────────────────────────────────────
    # NOTA: appid NO tiene UNIQUE constraint en la tabla para permitir DO UPDATE.
    # La unicidad se garantiza a nivel de lógica en upsert_game.
    con.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id         VARCHAR PRIMARY KEY,
            slug       VARCHAR,
            title      VARCHAR NOT NULL,
            appid      INTEGER,               -- Steam App ID (sin UNIQUE, manejado en upsert)
            created_at TIMESTAMP DEFAULT now()
        )
    """)
    # Índice regular para appid — DuckDB no soporta partial indexes
    con.execute("""
        CREATE INDEX IF NOT EXISTS idx_games_appid ON games (appid)
    """)

    # ── price_history ─────────────────────────────────────────────────────────
    # Usamos SEQUENCE para el id autoincremental — DuckDB lo soporta nativamente.
    con.execute("CREATE SEQUENCE IF NOT EXISTS seq_price_history_id START 1")
    con.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id          BIGINT PRIMARY KEY DEFAULT nextval('seq_price_history_id'),
            game_id     VARCHAR NOT NULL,
            appid       INTEGER,
            timestamp   TIMESTAMP NOT NULL,
            price_usd   DECIMAL(10, 2) NOT NULL,
            regular_usd DECIMAL(10, 2),
            cut_pct     INTEGER DEFAULT 0,
            shop_id     INTEGER,
            shop_name   VARCHAR DEFAULT 'Steam',
            UNIQUE (game_id, timestamp, shop_id)
        )
    """)

    # ── predictions_cache ─────────────────────────────────────────────────────
    con.execute("""
        CREATE TABLE IF NOT EXISTS predictions_cache (
            game_id     VARCHAR PRIMARY KEY,
            score       DECIMAL(5, 2),
            signal      VARCHAR,
            reason      VARCHAR,
            features    JSON,
            computed_at TIMESTAMP DEFAULT now()
        )
    """)

    logger.info("Tablas DuckDB verificadas/creadas: games, price_history, predictions_cache")


def create_user_tables(con):
    """Tablas para usuarios autenticados con Steam."""

    con.execute("""
        CREATE TABLE IF NOT EXISTS users (
            steam_id      VARCHAR PRIMARY KEY,
            display_name  VARCHAR,
            avatar_url    VARCHAR,
            profile_url   VARCHAR,
            last_login    TIMESTAMP DEFAULT now(),
            created_at    TIMESTAMP DEFAULT now()
        )
    """)

    # Juegos que el usuario ya posee en Steam
    con.execute("""
        CREATE TABLE IF NOT EXISTS user_games (
            steam_id      VARCHAR NOT NULL,
            appid         INTEGER NOT NULL,
            game_title    VARCHAR,
            playtime_mins INTEGER DEFAULT 0,
            last_played   TIMESTAMP,
            synced_at     TIMESTAMP DEFAULT now(),
            PRIMARY KEY (steam_id, appid)
        )
    """)

    # Wishlist del usuario
    con.execute("""
        CREATE TABLE IF NOT EXISTS user_wishlist (
            steam_id    VARCHAR NOT NULL,
            appid       INTEGER NOT NULL,
            game_title  VARCHAR,
            added_at    TIMESTAMP DEFAULT now(),
            PRIMARY KEY (steam_id, appid)
        )
    """)

    logger.info("Tablas de usuario verificadas/creadas")