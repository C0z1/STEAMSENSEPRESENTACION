
"""
src/services/sync_service.py
"""
import asyncio
import logging
from typing import Optional
import httpx
from config import get_settings
from src.api.client import ITADClient
from src.db import queries
from src.db.connection import get_db

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_top_appids(client: httpx.AsyncClient, top_n: int) -> list[int]:
    try:
        r = await client.get("https://steamspy.com/api.php",
                             params={"request": "top100forever"}, timeout=30)
        if r.status_code == 200:
            appids = [int(k) for k in r.json().keys()][:top_n]
            logger.info(f"SteamSpy: {len(appids)} appids obtenidos")
            return appids
    except Exception as e:
        logger.error(f"Error en SteamSpy: {e}")
    return []


async def sync_by_appid(appid: int) -> dict:
    """Sincroniza un juego por Steam appid. Usado por POST /sync/game/{appid}."""
    con = get_db()
    async with ITADClient(settings.itad_api_key) as client:
        lookup = await client.lookup_game(appid)
        if not lookup:
            return {"appid": appid, "status": "not_found", "inserted": 0}
        game_id, slug, title = lookup
        try:
            queries.upsert_game(con, game_id=game_id, slug=slug, title=title, appid=appid)
        except Exception as e:
            logger.debug(f"upsert_game skip appid={appid}: {e}")
        records = await client.get_price_history(game_id, appid=appid)
        if not records:
            return {"game_id": game_id, "title": title, "appid": appid,
                    "status": "no_history", "inserted": 0}
        inserted = queries.upsert_price_records(con, [r.model_dump() for r in records])
        logger.info(f"✓ {title} ({appid}): {inserted} registros")
        return {"game_id": game_id, "title": title, "appid": appid,
                "status": "ok", "inserted": inserted}


async def sync_by_game_id(game_id: str) -> dict:
    """
    Sincroniza un juego por ITAD game_id.
    Usado cuando el usuario hace click en un resultado de búsqueda.

    FIX: después de obtener el historial, hace get_game_info para resolver
    el título real y el appid — antes el juego quedaba con title=game_id y appid=None.
    """
    con = get_db()

    # Insertar placeholder si no existe
    existing = queries.get_game(con, game_id)
    if not existing:
        try:
            queries.upsert_game(con, game_id=game_id, slug=game_id,
                                title=game_id, appid=None)
        except Exception:
            pass

    async with ITADClient(settings.itad_api_key) as client:
        # FIX: resolver título y appid via get_game_info antes de insertar historial
        try:
            info = await client.get_game_info(game_id)
            if info:
                _, slug, title = info
                # Intentar obtener appid via lookup inverso si no lo tenemos
                appid = None
                existing_now = queries.get_game(con, game_id)
                if existing_now:
                    appid = existing_now.get("appid")

                # Si aún no tenemos appid, intentar extraerlo del slug o del historial
                if not appid:
                    try:
                        # ITAD a veces incluye el appid en la respuesta de info
                        appid = info[0] if len(info) > 3 and isinstance(info[3], int) else None
                    except Exception:
                        pass

                queries.upsert_game(con, game_id=game_id, slug=slug,
                                    title=title, appid=appid)
                logger.info(f"Resolved title for {game_id}: '{title}' appid={appid}")
        except Exception as e:
            logger.warning(f"get_game_info failed for {game_id}: {e}")

        # Obtener historial de precios
        records = await client.get_price_history(game_id)
        if not records:
            return {"game_id": game_id, "status": "no_history", "inserted": 0}

        # FIX: intentar extraer appid del primer registro del historial
        try:
            first_appid = records[0].appid if hasattr(records[0], 'appid') else None
            if first_appid:
                queries.upsert_game(con, game_id=game_id, slug=game_id,
                                    title=game_id, appid=first_appid)
        except Exception:
            pass

        inserted = queries.upsert_price_records(con, [r.model_dump() for r in records])
        logger.info(f"✓ game_id={game_id}: {inserted} registros")

        # Devolver título resuelto si lo tenemos
        final = queries.get_game(con, game_id)
        title = final.get("title", game_id) if final else game_id
        appid = final.get("appid") if final else None

        return {"game_id": game_id, "title": title, "appid": appid,
                "status": "ok", "inserted": inserted}


async def repair_orphaned_games(batch_size: int = 10) -> dict:
    """
    Busca juegos en la DB cuyo título es igual a su game_id (huérfanos) o
    que no tienen appid, e intenta resolver su información real vía ITAD.

    Estrategia:
    1. Primero intenta leer el appid desde price_history (ya está guardado ahí).
    2. Si lo encuentra, hace lookup_game(appid) para obtener título y slug.
    3. Si no hay appid en price_history, llama get_game_info(game_id) como fallback.
    """
    con = get_db()

    # Encontrar huérfanos: título == id O appid IS NULL
    rows = con.execute("""
        SELECT id, title, appid FROM games
        WHERE title = id
           OR appid IS NULL
        ORDER BY id
        LIMIT 200
    """).fetchdf()

    if rows.empty:
        return {"status": "ok", "repaired": 0, "failed": 0, "message": "No orphaned games found"}

    orphans = rows.to_dict(orient="records")
    logger.info(f"Found {len(orphans)} orphaned games to repair")

    repaired = 0
    failed   = 0

    async with ITADClient(settings.itad_api_key) as client:
        for i in range(0, len(orphans), batch_size):
            batch = orphans[i:i + batch_size]

            for game in batch:
                game_id = game["id"]
                try:
                    resolved_title = None
                    resolved_slug  = None
                    resolved_appid = game.get("appid")

                    # ── Paso 1: leer appid desde price_history ────────────────
                    if not resolved_appid:
                        ph_row = con.execute("""
                            SELECT appid FROM price_history
                            WHERE game_id = ? AND appid IS NOT NULL
                            LIMIT 1
                        """, [game_id]).fetchone()
                        if ph_row:
                            resolved_appid = int(ph_row[0])
                            logger.info(f"Found appid={resolved_appid} in price_history for {game_id}")

                    # ── Paso 2: lookup por appid → título y slug ──────────────
                    if resolved_appid:
                        lookup = await client.lookup_game(resolved_appid)
                        if lookup:
                            _, resolved_slug, resolved_title = lookup

                    # ── Paso 3: fallback a get_game_info por game_id ──────────
                    if not resolved_title:
                        info = await client.get_game_info(game_id)
                        if info:
                            _, resolved_slug, resolved_title = info

                    # Si aún no tenemos título real, saltar
                    if not resolved_title or resolved_title == game_id:
                        failed += 1
                        continue

                    # ── Aplicar fix en DB ─────────────────────────────────────
                    con.execute(
                        "UPDATE games SET title=?, slug=? WHERE id=?",
                        [resolved_title, resolved_slug or game_id, game_id]
                    )
                    if resolved_appid:
                        con.execute(
                            "UPDATE games SET appid=? WHERE id=? AND appid IS NULL",
                            [resolved_appid, game_id]
                        )

                    repaired += 1
                    logger.info(f"Repaired: {game_id} → '{resolved_title}' appid={resolved_appid}")

                except Exception as e:
                    logger.warning(f"Failed to repair {game_id}: {e}")
                    failed += 1

            await asyncio.sleep(settings.request_delay)

    return {
        "status": "ok",
        "repaired": repaired,
        "failed": failed,
        "total_found": len(orphans),
        "message": f"Repaired {repaired}/{len(orphans)} orphaned games",
    }


async def sync_top_games(top_n: int = 100) -> dict:
    if not settings.itad_api_key:
        raise ValueError("ITAD_API_KEY no configurada")
    summary = {"total_games": 0, "total_inserted": 0, "errors": 0, "synced": []}
    async with httpx.AsyncClient(timeout=30) as http_client:
        appids = await get_top_appids(http_client, top_n)
    if not appids:
        return summary
    logger.info(f"Iniciando sync de {len(appids)} juegos...")
    con = get_db()
    async with ITADClient(settings.itad_api_key) as itad:
        batch_size = settings.request_batch_size
        for i in range(0, len(appids), batch_size):
            batch = appids[i:i + batch_size]
            lookup_results = await asyncio.gather(
                *[itad.lookup_game(appid) for appid in batch],
                return_exceptions=True
            )
            for appid, lookup in zip(batch, lookup_results):
                if isinstance(lookup, Exception) or not lookup:
                    summary["errors"] += 1
                    continue
                game_id, slug, title = lookup
                try:
                    try:
                        queries.upsert_game(con, game_id=game_id, slug=slug,
                                            title=title, appid=appid)
                    except Exception as e:
                        logger.debug(f"upsert_game skip {appid}: {e}")
                    records = await itad.get_price_history(game_id, appid=appid)
                    if records:
                        inserted = queries.upsert_price_records(
                            con, [r.model_dump() for r in records])
                        summary["total_inserted"] += inserted
                        summary["total_games"] += 1
                        summary["synced"].append(appid)
                        logger.info(f"  ✓ {title} ({appid}): {inserted} registros")
                    else:
                        summary["errors"] += 1
                except Exception as e:
                    logger.warning(f"Error appid={appid}: {e}")
                    summary["errors"] += 1
            await asyncio.sleep(settings.request_delay)
            logger.info(f"Progreso: {min(i+batch_size,len(appids))}/{len(appids)} | "
                        f"Insertados: {summary['total_inserted']}")
    logger.info(f"Sync completado: {summary}")
    return summary