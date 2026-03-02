# SteamSense 🎮

**ML-powered Steam price predictor** — Buy or Wait?

Analiza años de historial de precios en Steam usando Machine Learning para decirte exactamente cuándo comprar.

## Stack

- **Backend**: FastAPI + DuckDB + scikit-learn (Python 3.11)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Auth**: Steam OpenID + JWT
- **Deploy**: Render.com (backend) + Vercel (frontend)

## Setup local

```bash
# Backend
cd backend
cp ../.env.example .env   # editar con tus API keys
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
cp .env.example .env.local  # editar NEXT_PUBLIC_API_URL
npm install
npm run dev
```

## Deploy en producción

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones paso a paso.
