
"""
src/api/steam_client.py
========================
Cliente para Steam Web API.
"""
import logging
import os
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

STEAM_API   = "https://api.steampowered.com"
STEAM_STORE = "https://store.steampowered.com/api"


def _get_key() -> str:
    """Lee la Steam API key en el momento de usarla — nunca en el import."""
    from config import get_settings
    key = get_settings().steam_api_key or os.getenv("STEAM_API_KEY", "")
    if not key:
        raise ValueError(
            "STEAM_API_KEY no configurada. "
            "Agrégala a tu archivo .env:\n  STEAM_API_KEY=tu_key_aqui"
        )
    return key


class SteamClient:
    def __init__(self):
        pass  # key se lee en cada llamada para que .env reloads funcionen

    async def get_player_summary(self, steam_id: str) -> Optional[dict]:
        try:
            key = _get_key()
        except ValueError as e:
            logger.error(str(e))
            return None
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{STEAM_API}/ISteamUser/GetPlayerSummaries/v2/",
                params={"key": key, "steamids": steam_id}
            )
            if r.status_code != 200:
                logger.warning(f"Steam GetPlayerSummaries HTTP {r.status_code}")
                return None
            players = r.json().get("response", {}).get("players", [])
            p = players[0] if players else None
            if p:
                logger.info(f"Perfil Steam obtenido: {p.get('personaname')} ({steam_id})")
            return p

    async def get_owned_games(self, steam_id: str) -> list[dict]:
        try:
            key = _get_key()
        except ValueError as e:
            logger.error(str(e))
            return []
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{STEAM_API}/IPlayerService/GetOwnedGames/v1/",
                params={
                    "key": key,
                    "steamid": steam_id,
                    "include_appinfo": 1,
                    "include_played_free_games": 1,
                }
            )
            if r.status_code != 200:
                logger.error(f"GetOwnedGames HTTP {r.status_code}: {r.text[:200]}")
                return []
            data = r.json().get("response", {})
            games = data.get("games", [])
            logger.info(f"Steam librería: {len(games)} juegos para {steam_id}")
            return [{
                "appid":         g.get("appid"),
                "title":         g.get("name", f"App {g.get('appid')}"),
                "playtime_mins": g.get("playtime_forever", 0),
                "last_played":   g.get("rtime_last_played"),
            } for g in games if g.get("appid")]

    async def get_recently_played(self, steam_id: str, count: int = 10) -> list[dict]:
        try:
            key = _get_key()
        except ValueError as e:
            logger.error(str(e))
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{STEAM_API}/IPlayerService/GetRecentlyPlayedGames/v1/",
                params={"key": key, "steamid": steam_id, "count": count}
            )
            if r.status_code != 200:
                return []
            return r.json().get("response", {}).get("games", [])

    async def get_wishlist(self, steam_id: str) -> dict:
        """
        Wishlist pública — no requiere API key.
        Returns: {"items": [...], "status": "ok"|"private"|"error"}
        - status "private" only when HTTP 403 (Steam blocks access for private profiles)
        - status "error" when network/parse issues — do NOT assume private
        - status "ok" when we got valid JSON (items may be empty)
        """
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(
                f"https://store.steampowered.com/wishlist/profiles/{steam_id}/wishlistdata/",
                params={"p": 0},
                headers={"Accept": "application/json"},
            )
            if r.status_code == 403:
                logger.warning(f"Wishlist HTTP 403 para {steam_id} — perfil privado")
                return {"items": [], "status": "private"}
            if r.status_code != 200:
                logger.warning(f"Wishlist HTTP {r.status_code} para {steam_id} — error de red/servidor")
                return {"items": [], "status": "error"}
            try:
                data = r.json()
            except Exception:
                logger.warning(f"Wishlist respuesta no es JSON para {steam_id}")
                return {"items": [], "status": "error"}
            if isinstance(data, list):
                logger.info(f"Wishlist vacía (lista) para {steam_id}")
                return {"items": [], "status": "ok"}
            if not isinstance(data, dict):
                logger.warning(f"Wishlist formato inesperado para {steam_id}: {type(data)}")
                return {"items": [], "status": "error"}
            items = [{"appid": int(k), "title": v.get("name", f"App {k}")}
                     for k, v in data.items() if isinstance(v, dict)]
            logger.info(f"Wishlist: {len(items)} items para {steam_id}")
            return {"items": items, "status": "ok"}


_steam_client: Optional[SteamClient] = None

def get_steam_client() -> SteamClient:
    global _steam_client
    if _steam_client is None:
        _steam_client = SteamClient()
    return _steam_client