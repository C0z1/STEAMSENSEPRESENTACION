"""
src/routes/auth.py  —  Steam OpenID auth endpoints.
FIX: URLs leídas de env vars (FRONTEND_URL, BACKEND_URL), no hardcodeadas.
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from config import get_settings
from src.api.steam_auth import get_openid_redirect_url, verify_openid_response, create_jwt
from src.api.steam_client import get_steam_client
from src.db.connection import get_db
from src.db import user_queries

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/steam")
def login_with_steam():
    """Inicia el flujo OpenID → redirige al usuario a Steam."""
    settings = get_settings()
    callback = f"{settings.backend_url}/auth/steam/callback"
    redirect_url = get_openid_redirect_url(callback)
    return RedirectResponse(redirect_url)


@router.get("/steam/callback")
async def steam_callback(request: Request):
    """Steam redirige aquí. Verificamos, creamos JWT y redirigimos al frontend."""
    settings = get_settings()
    params   = dict(request.query_params)
    steam_id = await verify_openid_response(params)

    if not steam_id:
        raise HTTPException(status_code=401, detail="Steam authentication failed")

    steam   = get_steam_client()
    profile = await steam.get_player_summary(steam_id)

    display_name = profile.get("personaname", f"User {steam_id}") if profile else f"User {steam_id}"
    avatar_url   = profile.get("avatarfull", "") if profile else ""
    profile_url  = profile.get("profileurl", "") if profile else ""

    con = get_db()
    user_queries.upsert_user(con, steam_id, display_name, avatar_url, profile_url)

    token = create_jwt(steam_id, display_name, avatar_url)
    return RedirectResponse(f"{settings.frontend_url}/dashboard?token={token}")


@router.get("/me")
async def get_me(request: Request):
    """Retorna el usuario actual desde el JWT."""
    from src.api.steam_auth import decode_jwt
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_jwt(auth[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {
        "steam_id":     payload["sub"],
        "display_name": payload["name"],
        "avatar_url":   payload.get("avatar", ""),
    }
