
"""
src/db/connection.py
====================
Conexión DuckDB thread-safe.

DuckDB no permite compartir una conexión entre threads (FastAPI usa un thread pool
para endpoints síncronos). Solución: una conexión por thread via threading.local(),
todas apuntando al mismo archivo .duckdb.
"""

import logging
import os
import threading
from typing import Optional

import duckdb

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Una conexión por thread
_local = threading.local()
_db_path: Optional[str] = None


def init_db():
    """
    Configura la ruta de la DB al arrancar la app.
    No abre conexión aquí — get_db() lo hace por thread.
    """
    global _db_path

    db_path = settings.duckdb_path
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    _db_path = db_path

    logger.info(f"DuckDB configurado en: {db_path}")


def _open_connection() -> duckdb.DuckDBPyConnection:
    """Abre una nueva conexión al archivo DuckDB."""
    con = duckdb.connect(
        _db_path,
        config={
            "memory_limit": settings.duckdb_memory_limit,
            "threads": settings.duckdb_threads,
        }
    )
    return con


def get_db() -> duckdb.DuckDBPyConnection:
    """
    Retorna la conexión DuckDB del thread actual.
    Si no existe todavía para este thread, la crea.
    """
    if _db_path is None:
        raise RuntimeError("DuckDB no inicializado. Llama a init_db() primero.")

    if not hasattr(_local, "connection") or _local.connection is None:
        _local.connection = _open_connection()
        logger.debug(f"Nueva conexión DuckDB para thread {threading.current_thread().name}")

    return _local.connection


def close_db():
    """Cierra la conexión del thread actual (llamado en shutdown)."""
    if hasattr(_local, "connection") and _local.connection is not None:
        try:
            _local.connection.close()
        except Exception:
            pass
        _local.connection = None
    logger.info("DuckDB desconectado")