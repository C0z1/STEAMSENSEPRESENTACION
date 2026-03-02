
export interface Game {
  id: string
  slug: string
  title: string
  appid?: number
  total_records?: number
  min_price?: number
  max_discount?: number
}

export interface SearchResult {
  id: string
  slug: string
  title: string
  type?: string
}

export interface PricePoint {
  timestamp: string
  price_usd: number
  regular_usd: number
  cut_pct: number
  shop_name: string
}

export interface PriceHistoryResponse {
  game_id: string
  title: string
  appid?: number
  count: number
  history: PricePoint[]
}

export interface PriceStats {
  total_records: number
  first_seen: string
  last_seen: string
  min_price: number
  max_price: number
  avg_price: number
  max_discount: number
  avg_discount_when_on_sale: number
  avg_cut_q4: number
  avg_cut_summer: number
  days_since_min_price: number
}

export interface SeasonalPattern {
  month: number
  avg_discount: number
  sample_count: number
}

export interface GameStatsResponse {
  game_id: string
  title: string
  appid?: number
  stats: PriceStats
  seasonal_patterns: SeasonalPattern[]
}

export interface Prediction {
  score: number
  signal: 'BUY' | 'WAIT'
  reason: string
  confidence: number
}

export interface PriceContext {
  current_price: number
  min_price_ever: number
  avg_price: number
  current_discount_pct: number
}

export interface PredictionResponse {
  game_id: string
  title: string
  appid?: number
  prediction: Prediction
  price_context: PriceContext
  from_cache: boolean
}

export interface StoreDeal {
  shop_id?: number
  shop_name: string
  price_usd: number
  regular_usd: number
  cut_pct: number
  url?: string
}

export interface CurrentPricesResponse {
  game_id: string
  deals: StoreDeal[]
}

export interface TopDeal {
  id: string
  title: string
  appid?: number
  current_price: number
  regular_price: number
  discount_pct: number
  last_seen: string
  min_price: number
}

export interface BuySignal {
  id: string
  title: string
  appid?: number
  score: number
  signal: string
  reason: string
  current_price: number
  discount_pct: number
}

export interface OverviewStats {
  total_games: number
  total_records: number
  buy_signals: number
  wait_signals: number
}