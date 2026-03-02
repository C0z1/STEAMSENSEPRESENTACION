
"""
src/api/schemas.py
==================
Modelos Pydantic que validan y tipan las respuestas de la API de IsThereAnyDeal.
Si la API cambia su estructura, este es el único archivo a editar.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Lookup (appid → ITAD game ID) ────────────────────────────────────────────

class ITADGame(BaseModel):
    id: str
    slug: str
    title: str


class ITADLookupResponse(BaseModel):
    found: bool
    game: Optional[ITADGame] = None


# ── Price History ─────────────────────────────────────────────────────────────

class ITADPrice(BaseModel):
    amount: float
    amountInt: int
    currency: str = "USD"


class ITADShop(BaseModel):
    id: int
    name: str


class ITADHistoryEntry(BaseModel):
    timestamp: datetime
    deal: Optional[dict] = None  # raw — procesado en client.py

    # Extraídos del deal
    price_usd: float = 0.0
    regular_usd: float = 0.0
    cut_pct: int = 0
    shop_id: Optional[int] = None
    shop_name: str = "Steam"


# ── Search ───────────────────────────────────────────────────────────────────

class ITADSearchResult(BaseModel):
    id: str
    slug: str
    title: str
    type: Optional[str] = None
    mature: bool = False


# ── Internos (lo que guardamos en DuckDB) ────────────────────────────────────

class PriceRecord(BaseModel):
    """Fila normalizada lista para insertar en DuckDB."""
    game_id: str
    appid: Optional[int] = None
    timestamp: datetime
    price_usd: float
    regular_usd: float
    cut_pct: int
    shop_id: Optional[int] = None
    shop_name: str