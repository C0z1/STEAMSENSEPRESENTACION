
import type {
  Game, SearchResult, PriceHistoryResponse, GameStatsResponse,
  PredictionResponse, CurrentPricesResponse, TopDeal, BuySignal, OverviewStats
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, revalidate = 60, fallback?: T): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } })
  if (!res.ok) {
    if (fallback !== undefined) return fallback
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Health
export const getHealth = () => apiFetch<{ status: string; db: string; model: string }>('/health')

// Stats
export const getOverviewStats = () => apiFetch<OverviewStats>('/stats/overview', 30)

// Games
export const searchGames = (q: string) =>
  apiFetch<SearchResult[]>(`/games/search?q=${encodeURIComponent(q)}`, 0)

export const listGames = async (limit = 50, offset = 0): Promise<Game[]> => {
  const data = await apiFetch<any>(`/games?limit=${limit}&offset=${offset}`, 30)
  return Array.isArray(data) ? data : (data?.games ?? data?.list ?? [])
}

export const getGameStats = (gameId: string) =>
  apiFetch<GameStatsResponse>(`/games/${gameId}`, 60)

export const getTopDeals = async (limit = 24): Promise<TopDeal[]> => {
  const data = await apiFetch<any>(`/games/top/deals?limit=${limit}`, 30)
  return Array.isArray(data) ? data : (data?.deals ?? data?.list ?? [])
}

export const getTopBuySignals = async (limit = 24): Promise<BuySignal[]> => {
  const data = await apiFetch<any>(`/games/top/buy?limit=${limit}`, 30)
  return Array.isArray(data) ? data : (data?.signals ?? data?.list ?? [])
}

export const getCurrentPrices = (gameId: string) =>
  apiFetch<CurrentPricesResponse>(`/games/${gameId}/current-prices`, 10)

// Prices
export const getPriceHistory = (gameId: string, since?: string) =>
  apiFetch<PriceHistoryResponse>(
    `/prices/${gameId}/history${since ? `?since=${since}` : ''}`, 60,
    { game_id: gameId, title: '', count: 0, history: [] } as PriceHistoryResponse
  )

// Predictions
export const getPrediction = (gameId: string, forceRefresh = false) =>
  apiFetch<PredictionResponse>(`/predict/${gameId}${forceRefresh ? '?force_refresh=true' : ''}`, 0)

// Sync
export const syncByGameId = async (gameId: string) => {
  const res = await fetch(`${BASE}/sync/id/${encodeURIComponent(gameId)}`, { method: 'POST' })
  if (!res.ok) throw new Error('Sync failed')
  return res.json()
}

export const syncByAppid = async (appid: number) => {
  const res = await fetch(`${BASE}/sync/game/${appid}`, { method: 'POST' })
  if (!res.ok) throw new Error('Sync failed')
  return res.json()
}

// ── User / Auth ───────────────────────────────────────────────────────────────

async function userFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const getMe = (token: string) =>
  userFetch<{ steam_id: string; display_name: string; avatar_url: string }>('/auth/me', token)

export const getLibrary = (token: string, sync = false) =>
  userFetch<any>(`/me/library${sync ? '?sync=true' : ''}`, token)

export const getWishlist = (token: string, sync = false) =>
  userFetch<any>(`/me/wishlist${sync ? '?sync=true' : ''}`, token)

export const getRecommendations = (token: string, limit = 12) =>
  userFetch<any>(`/me/recommendations?limit=${limit}`, token)

export const syncLibrary = (token: string) =>
  fetch(`${BASE}/me/library/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())

export const checkOwned = (token: string, appid: number) =>
  userFetch<{ owned: boolean }>(`/me/owned/${appid}`, token)

export const steamLoginUrl = `${BASE}/auth/steam`