"""
config.py  —  Configuración central. Todas las env vars se leen aquí.
"""
import os


class Settings:
    def __init__(self):
        # Carga .env si existe (solo desarrollo local)
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        os.environ.setdefault(key.strip(), val.strip())

        self.steam_api_key       = os.getenv("STEAM_API_KEY", "")
        self.jwt_secret          = os.getenv("JWT_SECRET", "steamsense-dev-secret-CHANGE-IN-PROD")
        self.itad_api_key        = os.getenv("ITAD_API_KEY", "")
        self.itad_base_url       = os.getenv("ITAD_BASE_URL", "https://api.isthereanydeal.com")
        self.itad_country        = os.getenv("ITAD_COUNTRY", "US")
        self.itad_history_since  = os.getenv("ITAD_HISTORY_SINCE", "2022-01-01T00:00:00Z")
        self.duckdb_path         = os.getenv("DUCKDB_PATH", "/app/data/steamsense.duckdb")
        self.duckdb_memory_limit = os.getenv("DUCKDB_MEMORY_LIMIT", "512MB")
        self.duckdb_threads      = int(os.getenv("DUCKDB_THREADS", "2"))
        self.api_host            = os.getenv("API_HOST", "0.0.0.0")
        self.api_port            = int(os.getenv("API_PORT", "8000"))
        self.cors_origins        = os.getenv("CORS_ORIGINS", "http://localhost:3000")
        # FIX: estas dos variables son críticas para Steam OAuth
        self.frontend_url        = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.backend_url         = os.getenv("BACKEND_URL", "http://localhost:8000")
        self.env                 = os.getenv("ENV", "development")
        self.top_n_games         = int(os.getenv("TOP_N_GAMES", "200"))
        self.request_batch_size  = int(os.getenv("REQUEST_BATCH_SIZE", "10"))
        self.request_delay       = float(os.getenv("REQUEST_DELAY", "0.5"))

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
