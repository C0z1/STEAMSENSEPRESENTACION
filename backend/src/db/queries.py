
"""
src/db/queries.py — única fuente de SQL del proyecto.

NOTAS DuckDB importantes:
  - NOW() no existe → usar datetime de Python como parámetro
  - CURRENT_TIMESTAMP en VALUES junto a '?' lanza BinderException
    → pasar datetime.now() como parámetro explícito
  - INTERVAL literal: solo funciona en WHERE, no en VALUES
  - INSERT OR IGNORE no existe → ON CONFLICT ... DO NOTHING
  - shop_id NULL en UNIQUE → normalizar a -1
"""
import json
import logging
import math
import datetime as dt
from typing import Optional

logger = logging.getLogger(__name__)


def _now() -> dt.datetime:
    """Timestamp UTC actual, naive."""
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


# ── helpers ───────────────────────────────────────────────────────────────────

def _f(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except (TypeError, ValueError):
        return None


def _san(d: dict) -> dict:
    out = {}
    for k, v in d.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            out[k] = None
        else:
            out[k] = v
    return out


# ── games ─────────────────────────────────────────────────────────────────────

def upsert_game(con, game_id: str, slug: str, title: str, appid: Optional[int] = None):
    con.execute("""
        INSERT INTO games (id, slug, title, appid)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING
    """, [game_id, slug, title, appid])
    con.execute("UPDATE games SET slug=?, title=? WHERE id=?", [slug, title, game_id])
    if appid:
        con.execute("UPDATE games SET appid=? WHERE id=? AND appid IS NULL", [appid, game_id])


def get_game(con, game_id: str) -> Optional[dict]:
    row = con.execute("SELECT * FROM games WHERE id=?", [game_id]).fetchdf()
    return _san(row.iloc[0].to_dict()) if not row.empty else None


def get_game_by_appid(con, appid: int) -> Optional[dict]:
    row = con.execute("SELECT * FROM games WHERE appid=?", [appid]).fetchdf()
    return _san(row.iloc[0].to_dict()) if not row.empty else None


def list_games(con, limit: int = 50, offset: int = 0) -> list[dict]:
    rows = con.execute("""
        SELECT g.id, g.title, g.appid, g.slug,
               COUNT(ph.id)                   AS total_records,
               COALESCE(MIN(ph.price_usd), 0) AS min_price,
               COALESCE(MAX(ph.cut_pct), 0)   AS max_discount
        FROM games g
        LEFT JOIN price_history ph ON g.id = ph.game_id
        WHERE g.appid IS NOT NULL
          AND g.title IS NOT NULL
          AND LENGTH(g.title) > 0
          AND g.title != g.id
        GROUP BY g.id, g.title, g.appid, g.slug
        ORDER BY total_records DESC
        LIMIT ? OFFSET ?
    """, [limit, offset]).fetchdf()
    return [_san(r) for r in rows.to_dict(orient="records")]


# ── price_history ─────────────────────────────────────────────────────────────

def upsert_price_records(con, records: list[dict]) -> int:
    """
    Inserta registros de precio sin duplicados.
    - Nunca pasar 'id' (autoincrement SEQUENCE)
    - shop_id NULL → -1 (DuckDB trata cada NULL como distinto en UNIQUE)
    """
    if not records:
        return 0

    import pandas as pd

    df = pd.DataFrame(records)
    df = df.drop(columns=["id"], errors="ignore")

    if "shop_id" in df.columns:
        df["shop_id"] = df["shop_id"].fillna(-1).astype(int)

    valid_cols = ["game_id", "appid", "timestamp", "price_usd",
                  "regular_usd", "cut_pct", "shop_id", "shop_name"]
    df = df[[c for c in valid_cols if c in df.columns]]
    df = df.dropna(subset=["game_id", "timestamp"])

    if df.empty:
        return 0

    before = con.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]

    try:
        con.register("_price_batch", df)
        cols = ", ".join(df.columns)
        con.execute(f"""
            INSERT INTO price_history ({cols})
            SELECT {cols} FROM _price_batch
            ON CONFLICT (game_id, timestamp, shop_id) DO NOTHING
        """)
    except Exception as e:
        logger.error(f"upsert_price_records batch error: {e}")
        cols = ", ".join(df.columns)
        placeholders = ", ".join(["?"] * len(df.columns))
        for _, row in df.iterrows():
            try:
                con.execute(
                    f"INSERT INTO price_history ({cols}) VALUES ({placeholders})"
                    " ON CONFLICT (game_id, timestamp, shop_id) DO NOTHING",
                    list(row)
                )
            except Exception:
                pass
    finally:
        try:
            con.unregister("_price_batch")
        except Exception:
            pass

    after = con.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]
    inserted = after - before
    logger.debug(f"upsert_price_records: {inserted}/{len(df)} insertados")
    return inserted


def get_price_history(con, game_id: str,
                      since: Optional[dt.datetime] = None,
                      until: Optional[dt.datetime] = None) -> list[dict]:
    filters = ["game_id = ?"]
    params  = [game_id]
    if since:
        filters.append("timestamp >= ?")
        params.append(since)
    if until:
        filters.append("timestamp <= ?")
        params.append(until)
    rows = con.execute(f"""
        SELECT timestamp, price_usd, regular_usd, cut_pct, shop_name
        FROM price_history
        WHERE {" AND ".join(filters)}
        ORDER BY timestamp ASC
    """, params).fetchdf()
    return rows.to_dict(orient="records")


def get_price_stats(con, game_id: str) -> Optional[dict]:
    row = con.execute("""
        SELECT
            COALESCE(MIN(price_usd), 0)                              AS min_price,
            COALESCE(MAX(price_usd), 0)                              AS max_price,
            COALESCE(AVG(price_usd), 0)                              AS avg_price,
            COALESCE(MAX(cut_pct), 0)                                AS max_discount,
            COALESCE(AVG(CASE WHEN cut_pct > 0 THEN cut_pct END), 0) AS avg_discount_when_on_sale,
            COUNT(*)                                                  AS total_records,
            MIN(timestamp)                                            AS first_seen,
            MAX(timestamp)                                            AS last_seen,
            COALESCE(AVG(CASE WHEN MONTH(timestamp) IN (10,11,12) AND cut_pct > 0 THEN cut_pct END), 0) AS avg_cut_q4,
            COALESCE(AVG(CASE WHEN MONTH(timestamp) IN (6,7,8)    AND cut_pct > 0 THEN cut_pct END), 0) AS avg_cut_summer
        FROM price_history
        WHERE game_id = ?
    """, [game_id]).fetchone()

    if not row or int(row[5] or 0) == 0:
        return None

    days_since_min = 365
    try:
        min_ts_row = con.execute("""
            SELECT timestamp FROM price_history
            WHERE game_id = ?
              AND price_usd = (SELECT MIN(price_usd) FROM price_history WHERE game_id = ?)
            ORDER BY timestamp DESC LIMIT 1
        """, [game_id, game_id]).fetchone()
        if min_ts_row and min_ts_row[0]:
            ts = min_ts_row[0]
            if hasattr(ts, "replace"):
                ts = ts.replace(tzinfo=None)
                days_since_min = max(0, (dt.datetime.now() - ts).days)
    except Exception:
        pass

    return {
        "min_price":                 _f(row[0]),
        "max_price":                 _f(row[1]),
        "avg_price":                 _f(row[2]),
        "max_discount":              int(row[3] or 0),
        "avg_discount_when_on_sale": _f(row[4]),
        "total_records":             int(row[5]),
        "first_seen":                str(row[6]) if row[6] else None,
        "last_seen":                 str(row[7]) if row[7] else None,
        "avg_cut_q4":                _f(row[8]),
        "avg_cut_summer":            _f(row[9]),
        "days_since_min_price":      days_since_min,
    }


def get_seasonal_patterns(con, game_id: str) -> list[dict]:
    rows = con.execute("""
        SELECT
            MONTH(timestamp) AS month,
            AVG(cut_pct)     AS avg_discount,
            COUNT(*)         AS sample_size,
            MIN(price_usd)   AS min_price
        FROM price_history
        WHERE game_id = ? AND cut_pct > 0
        GROUP BY MONTH(timestamp)
        ORDER BY month
    """, [game_id]).fetchdf()
    return [_san(r) for r in rows.to_dict(orient="records")]


# ── predictions_cache ─────────────────────────────────────────────────────────

def get_cached_prediction(con, game_id: str, max_age_hours: int = 6) -> Optional[dict]:
    cutoff = _now() - dt.timedelta(hours=max_age_hours)
    row = con.execute("""
        SELECT score, signal, reason, features, computed_at
        FROM predictions_cache
        WHERE game_id = ?
          AND computed_at > ?
    """, [game_id, cutoff]).fetchdf()
    return _san(row.iloc[0].to_dict()) if not row.empty else None


def upsert_prediction(con, game_id: str, score: float, signal: str,
                      reason: str, features: dict):
    now = _now()
    con.execute("""
        INSERT INTO predictions_cache (game_id, score, signal, reason, features, computed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (game_id) DO UPDATE SET
            score       = excluded.score,
            signal      = excluded.signal,
            reason      = excluded.reason,
            features    = excluded.features,
            computed_at = excluded.computed_at
    """, [game_id, score, signal, reason, json.dumps(features), now])


# ── Overview ──────────────────────────────────────────────────────────────────

def get_overview_stats(con) -> dict:
    row = con.execute("""
        SELECT
            (SELECT COUNT(*) FROM games)         AS total_games,
            (SELECT COUNT(*) FROM price_history) AS total_records,
            (SELECT COUNT(DISTINCT game_id) FROM predictions_cache WHERE signal = 'BUY')  AS buy_signals,
            (SELECT COUNT(DISTINCT game_id) FROM predictions_cache WHERE signal = 'WAIT') AS wait_signals
    """).fetchone()
    return {
        "total_games":   int(row[0] or 0),
        "total_records": int(row[1] or 0),
        "buy_signals":   int(row[2] or 0),
        "wait_signals":  int(row[3] or 0),
    }


def get_top_deals(con, limit: int = 24) -> list[dict]:
    rows = con.execute("""
        WITH latest AS (
            SELECT game_id, price_usd, regular_usd, cut_pct, timestamp,
                   ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY timestamp DESC) AS rn
            FROM price_history
        ),
        mins AS (
            SELECT game_id, MIN(price_usd) AS min_price
            FROM price_history GROUP BY game_id
        )
        SELECT
            g.id, g.title, g.appid,
            l.price_usd                        AS current_price,
            l.regular_usd                      AS regular_price,
            l.cut_pct                          AS discount_pct,
            CAST(l.timestamp AS VARCHAR)       AS last_seen,
            COALESCE(m.min_price, l.price_usd) AS min_price
        FROM latest l
        JOIN games g ON g.id = l.game_id
        JOIN mins  m ON m.game_id = l.game_id
        WHERE l.rn = 1
          AND l.cut_pct > 0
          AND g.appid IS NOT NULL
          AND g.title IS NOT NULL
          AND LENGTH(g.title) > 0
          AND g.title != g.id
        ORDER BY l.cut_pct DESC, l.price_usd ASC
        LIMIT ?
    """, [limit]).fetchdf()
    return [_san(r) for r in rows.to_dict(orient="records")]


def get_best_predictions(con, signal: str = "BUY", limit: int = 24) -> list[dict]:
    rows = con.execute("""
        WITH latest AS (
            SELECT game_id, price_usd, cut_pct,
                   ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY timestamp DESC) AS rn
            FROM price_history
        )
        SELECT
            g.id, g.title, g.appid,
            pc.score, pc.signal, pc.reason,
            COALESCE(lp.price_usd, 0) AS current_price,
            COALESCE(lp.cut_pct, 0)   AS discount_pct
        FROM predictions_cache pc
        JOIN games g ON g.id = pc.game_id
        LEFT JOIN (SELECT * FROM latest WHERE rn = 1) lp ON lp.game_id = pc.game_id
        WHERE pc.signal = ?
          AND g.appid IS NOT NULL
          AND g.title IS NOT NULL
          AND LENGTH(g.title) > 0
          AND g.title != g.id
        ORDER BY pc.score DESC
        LIMIT ?
    """, [signal, limit]).fetchdf()
    return [_san(r) for r in rows.to_dict(orient="records")]