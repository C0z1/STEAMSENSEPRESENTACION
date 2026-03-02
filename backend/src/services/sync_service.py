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


STEAMSPY_ENDPOINTS = [
    {"request": "top100forever"},
    {"request": "top100in2weeks"},
    {"request": "top100owned"},
    {"request": "genre", "genre": "Action"},
    {"request": "genre", "genre": "Adventure"},
    {"request": "genre", "genre": "RPG"},
    {"request": "genre", "genre": "Strategy"},
    {"request": "genre", "genre": "Simulation"},
    {"request": "genre", "genre": "Sports"},
    {"request": "genre", "genre": "Racing"},
    {"request": "genre", "genre": "Indie"},
    {"request": "genre", "genre": "Casual"},
    {"request": "genre", "genre": "Puzzle"},
    {"request": "genre", "genre": "Horror"},
    {"request": "genre", "genre": "Shooter"},
    {"request": "genre", "genre": "Fighting"},
    {"request": "genre", "genre": "Platformer"},
    {"request": "genre", "genre": "Stealth"},
    {"request": "genre", "genre": "Survival"},
    {"request": "genre", "genre": "Open World"},
    {"request": "tag", "tag": "Multiplayer"},
    {"request": "tag", "tag": "Co-op"},
    {"request": "tag", "tag": "Singleplayer"},
    {"request": "tag", "tag": "Story Rich"},
    {"request": "tag", "tag": "Early Access"},
]


async def get_appids_from_steamspy(client: httpx.AsyncClient, target: int) -> list[int]:
    """Recolecta appids de SteamSpy combinando múltiples endpoints de géneros y tags."""
    seen = set()
    appids = []

    for params in STEAMSPY_ENDPOINTS:
        if len(appids) >= target:
            break
        try:
            r = await client.get("https://steamspy.com/api.php",
                                 params=params, timeout=30)
            if r.status_code == 200:
                new_ids = [int(k) for k in r.json().keys() if int(k) not in seen]
                seen.update(new_ids)
                appids.extend(new_ids)
                label = params.get("genre") or params.get("tag") or params["request"]
                logger.info(f"SteamSpy [{label}]: +{len(new_ids)} nuevos (total: {len(appids)})")
            await asyncio.sleep(1.5)  # respetar rate limit de SteamSpy
        except Exception as e:
            logger.error(f"Error SteamSpy {params}: {e}")

    logger.info(f"SteamSpy total: {len(appids)} appids únicos recolectados")
    return appids[:target]


async def get_appids_from_itad(target: int, existing_ids: set) -> list[str]:
    """
    Obtiene game_ids directamente desde ITAD usando su endpoint de lista paginada.
    Retorna game_ids nuevos que no existen aún en la DB.
    """
    game_ids = []
    offset = 0
    limit = 500  # máximo por request en ITAD

    async with ITADClient(settings.itad_api_key) as client:
        while len(game_ids) < target:
            try:
                r = await client.http.get(
                    f"{settings.itad_base_url}/games/list/v2",
                    params={
                        "key": settings.itad_api_key,
                        "offset": offset,
                        "limit": limit,
                        "region": "us",
                        "country": settings.itad_country,
                    },
                    timeout=30,
                )
                if r.status_code != 200:
                    logger.warning(f"ITAD list error: {r.status_code} offset={offset}")
                    break

                data = r.json()
                items = data.get("list", [])
                if not items:
                    logger.info("ITAD list: no more items")
                    break

                for item in items:
                    gid = item.get("id") or item.get("game_id")
                    if gid and gid not in existing_ids:
                        game_ids.append(gid)
                        existing_ids.add(gid)

                logger.info(f"ITAD list offset={offset}: +{len(items)} items "
                            f"(nuevos acumulados: {len(game_ids)})")
                offset += limit

                if len(items) < limit:
                    break  # no hay más páginas

                await asyncio.sleep(1.0)

            except Exception as e:
                logger.error(f"Error ITAD list offset={offset}: {e}")
                break

    logger.info(f"ITAD total: {len(game_ids)} game_ids nuevos")
    return game_ids[:target]


# ─── Funciones individuales (sin cambios) ────────────────────────────────────

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
    """
    con = get_db()

    existing = queries.get_game(con, game_id)
    if not existing:
        try:
            queries.upsert_game(con, game_id=game_id, slug=game_id,
                                title=game_id, appid=None)
        except Exception:
            pass

    async with ITADClient(settings.itad_api_key) as client:
        try:
            info = await client.get_game_info(game_id)
            if info:
                _, slug, title = info
                appid = None
                existing_now = queries.get_game(con, game_id)
                if existing_now:
                    appid = existing_now.get("appid")
                if not appid:
                    try:
                        appid = info[0] if len(info) > 3 and isinstance(info[3], int) else None
                    except Exception:
                        pass
                queries.upsert_game(con, game_id=game_id, slug=slug,
                                    title=title, appid=appid)
                logger.info(f"Resolved title for {game_id}: '{title}' appid={appid}")
        except Exception as e:
            logger.warning(f"get_game_info failed for {game_id}: {e}")

        records = await client.get_price_history(game_id)
        if not records:
            return {"game_id": game_id, "status": "no_history", "inserted": 0}

        try:
            first_appid = records[0].appid if hasattr(records[0], 'appid') else None
            if first_appid:
                queries.upsert_game(con, game_id=game_id, slug=game_id,
                                    title=game_id, appid=first_appid)
        except Exception:
            pass

        inserted = queries.upsert_price_records(con, [r.model_dump() for r in records])
        logger.info(f"✓ game_id={game_id}: {inserted} registros")

        final = queries.get_game(con, game_id)
        title = final.get("title", game_id) if final else game_id
        appid = final.get("appid") if final else None

        return {"game_id": game_id, "title": title, "appid": appid,
                "status": "ok", "inserted": inserted}


async def repair_orphaned_games(batch_size: int = 10) -> dict:
    """
    Busca juegos en la DB cuyo título es igual a su game_id (huérfanos) o
    que no tienen appid, e intenta resolver su información real vía ITAD.
    """
    con = get_db()

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

                    if not resolved_appid:
                        ph_row = con.execute("""
                            SELECT appid FROM price_history
                            WHERE game_id = ? AND appid IS NOT NULL
                            LIMIT 1
                        """, [game_id]).fetchone()
                        if ph_row:
                            resolved_appid = int(ph_row[0])
                            logger.info(f"Found appid={resolved_appid} in price_history for {game_id}")

                    if resolved_appid:
                        lookup = await client.lookup_game(resolved_appid)
                        if lookup:
                            _, resolved_slug, resolved_title = lookup

                    if not resolved_title:
                        info = await client.get_game_info(game_id)
                        if info:
                            _, resolved_slug, resolved_title = info

                    if not resolved_title or resolved_title == game_id:
                        failed += 1
                        continue

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


# ─── Sync principal ───────────────────────────────────────────────────────────

async def sync_top_games(top_n: int = 100) -> dict:
    """
    Sincroniza hasta top_n juegos combinando SteamSpy (géneros/tags) + ITAD list.

    Fases:
      1. Recolectar appids de SteamSpy (~2000 únicos con todos los endpoints)
      2. Sincronizar esos juegos vía ITAD (lookup + historial)
      3. Si aún faltan juegos, completar con ITAD list paginado
    """
    if not settings.itad_api_key:
        raise ValueError("ITAD_API_KEY no configurada")

    summary = {
        "total_games": 0,
        "total_inserted": 0,
        "errors": 0,
        "sources": {"steamspy": 0, "itad": 0},
    }

    con = get_db()
    batch_size = settings.request_batch_size

    # ── FASE 1: Recolectar appids de SteamSpy ────────────────────────────────
    logger.info(f"=== FASE 1: Recolectando appids de SteamSpy (target: {top_n}) ===")
    async with httpx.AsyncClient(timeout=30) as http_client:
        appids = await get_appids_from_steamspy(http_client, top_n)

    # ── FASE 2: Sincronizar juegos de SteamSpy vía ITAD ──────────────────────
    logger.info(f"=== FASE 2: Sincronizando {len(appids)} juegos de SteamSpy ===")
    async with ITADClient(settings.itad_api_key) as itad:
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
                        summary["sources"]["steamspy"] += 1
                        logger.info(f"  ✓ {title} ({appid}): {inserted} registros")
                    else:
                        summary["errors"] += 1
                except Exception as e:
                    logger.warning(f"Error appid={appid}: {e}")
                    summary["errors"] += 1

            await asyncio.sleep(settings.request_delay)
            logger.info(f"[SteamSpy] Progreso: {min(i + batch_size, len(appids))}/{len(appids)} | "
                        f"OK: {summary['total_games']} | Errores: {summary['errors']}")

    # ── FASE 3: Completar con ITAD list si aún faltan juegos ─────────────────
    remaining = top_n - summary["total_games"]
    if remaining > 0:
        logger.info(f"=== FASE 3: Completando con ITAD list ({remaining} juegos faltantes) ===")

        existing_ids = set(
            row[0] for row in con.execute("SELECT id FROM games").fetchall()
        )

        itad_game_ids = await get_appids_from_itad(remaining, existing_ids)
        logger.info(f"ITAD list: {len(itad_game_ids)} game_ids nuevos a sincronizar")

        for i in range(0, len(itad_game_ids), batch_size):
            batch = itad_game_ids[i:i + batch_size]
            for game_id in batch:
                try:
                    result = await sync_by_game_id(game_id)
                    if result["status"] == "ok":
                        summary["total_games"] += 1
                        summary["total_inserted"] += result.get("inserted", 0)
                        summary["sources"]["itad"] += 1
                    else:
                        summary["errors"] += 1
                except Exception as e:
                    logger.warning(f"Error game_id={game_id}: {e}")
                    summary["errors"] += 1

            await asyncio.sleep(settings.request_delay)
            logger.info(f"[ITAD] Progreso: {min(i + batch_size, len(itad_game_ids))}/{len(itad_game_ids)} | "
                        f"OK: {summary['total_games']} | Errores: {summary['errors']}")

    logger.info(f"=== Sync completado: {summary} ===")
    return summary