
"""
src/api/steam_auth.py
======================
Steam OpenID authentication + JWT sin dependencias externas.
"""
import base64
import hashlib
import hmac
import json
import logging
import re
import time
from typing import Optional

import httpx
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

STEAM_OPENID = "https://steamcommunity.com/openid/login"
STEAM_ID_RE  = re.compile(r"https://steamcommunity\.com/openid/id/(\d+)")


def get_openid_redirect_url(return_url: str) -> str:
    params = {
        "openid.ns":         "http://specs.openid.net/auth/2.0",
        "openid.mode":       "checkid_setup",
        "openid.return_to":  return_url,
        "openid.realm":      return_url.split("/auth")[0],
        "openid.identity":   "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    return STEAM_OPENID + "?" + "&".join(f"{k}={v}" for k, v in params.items())


async def verify_openid_response(params: dict) -> Optional[str]:
    check_params = {k: v for k, v in params.items()}
    check_params["openid.mode"] = "check_authentication"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(STEAM_OPENID, data=check_params)
        if "is_valid:true" not in r.text:
            logger.warning("Steam OpenID verification failed")
            return None
    claimed_id = params.get("openid.claimed_id", "")
    match = STEAM_ID_RE.search(claimed_id)
    return match.group(1) if match else None


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _sign(header_b64: str, payload_b64: str, secret: str) -> str:
    msg = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    return _b64(sig)


def create_jwt(steam_id: str, display_name: str, avatar_url: str) -> str:
    # Use separators=(',',':') to avoid spaces → deterministic output
    header_b64  = _b64(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(',',':')).encode())
    payload_b64 = _b64(json.dumps({
        "sub":    steam_id,
        "name":   display_name,
        "avatar": avatar_url,
        "iat":    int(time.time()),
        "exp":    int(time.time()) + 86400 * 30,
    }, separators=(',',':')).encode())
    secret = get_settings().jwt_secret
    sig_b64 = _sign(header_b64, payload_b64, secret)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # Verify signature with current secret
        secret = get_settings().jwt_secret
        expected = _sign(header_b64, payload_b64, secret)
        if not hmac.compare_digest(sig_b64, expected):
            logger.debug("JWT firma invalida")
            return None

        # Decode payload
        pad = 4 - len(payload_b64) % 4
        data = json.loads(base64.urlsafe_b64decode(payload_b64 + "=" * (pad % 4)))

        if data.get("exp", 0) < time.time():
            logger.debug("JWT expirado")
            return None

        return data
    except Exception as e:
        logger.debug(f"decode_jwt error: {e}")
        return None