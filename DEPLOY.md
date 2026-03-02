# 🚀 SteamSense — Guía de Deploy en Render.com

## Antes de subir a GitHub

**⚠️ Revoca y regenera tus API keys antes de hacer cualquier `git push`.**

1. Steam API Key → https://steamcommunity.com/dev/apikey
2. ITAD API Key → https://isthereanydeal.com/dev/
3. JWT Secret nuevo: `openssl rand -hex 32`

## Estructura del repo

```
steamsense/
├── backend/          ← FastAPI (Python)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.py
│   ├── main.py
│   └── src/
├── frontend/         ← Next.js (TypeScript)
│   ├── package.json
│   └── src/
├── render.yaml       ← Configuración de Render
├── .gitignore
└── .env.example      ← Plantilla (sin secretos)
```

## Paso 1 — Subir a GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/TU_USUARIO/steamsense.git
git push -u origin main
```

## Paso 2 — Deploy Backend en Render

1. Ve a https://dashboard.render.com → **New** → **Web Service**
2. Conecta tu repo de GitHub
3. Render detectará `render.yaml` automáticamente
4. En **Environment Variables**, agrega manualmente (los que tienen `sync: false`):

| Variable | Valor |
|---|---|
| `STEAM_API_KEY` | Tu nueva Steam API key |
| `ITAD_API_KEY` | Tu nueva ITAD API key |
| `JWT_SECRET` | Output de `openssl rand -hex 32` |
| `FRONTEND_URL` | `https://steamsense.vercel.app` (tu URL de Vercel) |
| `BACKEND_URL` | `https://steamsense-backend.onrender.com` (URL que Render te asigna) |
| `CORS_ORIGINS` | Igual que `FRONTEND_URL` |

5. El **Disk** se configura automáticamente desde `render.yaml` (montado en `/data`)
6. El `DUCKDB_PATH` ya apunta a `/data/steamsense.duckdb` — los datos persisten entre deploys ✅

## Paso 3 — Deploy Frontend en Vercel

1. Ve a https://vercel.com → **New Project** → importa el mismo repo
2. **Root Directory**: `frontend`
3. En **Environment Variables**:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://steamsense-backend.onrender.com` |

4. Deploy ✅

## Paso 4 — Actualizar BACKEND_URL en Render

Cuando Vercel te dé la URL del frontend, vuelve al dashboard de Render y actualiza:
- `FRONTEND_URL` = URL real de Vercel
- `CORS_ORIGINS` = URL real de Vercel

Luego haz **Manual Deploy** para aplicar los cambios.

## Paso 5 — Poblar la base de datos (primera vez)

1. Abre `https://tu-frontend.vercel.app`
2. Inicia sesión con Steam
3. Ve al **Dashboard** → **Setup Guide**
4. Click **Run Sync** (descarga historial de 100 juegos, ~2 min en background)
5. Click **Generate** (crea predicciones ML)
6. Recarga la página después de 2-3 minutos

## Steam OAuth — Registro del callback

En https://steamcommunity.com/dev/apikey, el campo **Domain** debe ser el dominio
de tu backend en Render (ej: `steamsense-backend.onrender.com`).

## Notas del Disk

- El disco persistente en Render Starter cuesta ~$1/mes adicional por GB
- Todos los datos de `price_history`, `games` y `predictions_cache` sobreviven a redeploys ✅
- Si necesitas resetear la DB: elimina el archivo desde la consola de Render o borra y recrea el disk
