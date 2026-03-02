
'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, ShoppingCart, Loader2, Store } from 'lucide-react'
import { getCurrentPrices } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import type { StoreDeal } from '@/lib/types'

interface Props { gameId: string }

const STORE_ICONS: Record<string, string> = {
  'Steam': '🎮', 'GOG': '🪐', 'Epic Games Store': '⚡', 'Humble Store': '🙏',
  'Fanatical': '🎯', 'GreenManGaming': '🟢', 'GamersGate': '🎲',
  'Gamesplanet': '🌍', 'WinGameStore': '🏆',
}

export default function StoreDeals({ gameId }: Props) {
  const [deals, setDeals] = useState<StoreDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getCurrentPrices(gameId)
      .then(data => setDeals(data.deals))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) return (
    <div className="glass rounded-2xl p-6 flex items-center gap-3 text-steam-subtle">
      <Loader2 size={16} className="animate-spin text-steam-cyan" />
      <span className="text-sm">Loading current prices...</span>
    </div>
  )

  if (error || !deals.length) return (
    <div className="glass rounded-2xl p-5 text-center text-steam-subtle text-sm">
      <Store size={20} className="mx-auto mb-2 opacity-40" />
      No current deals found across stores.
    </div>
  )

  const cheapest = deals[0]

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-steam-border">
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest mb-0.5">Buy Now</p>
        <div className="flex items-center justify-between">
          <p className="text-steam-text text-sm font-semibold">Best price: <span className="text-steam-green font-mono">{formatPrice(cheapest.price_usd)}</span></p>
          <span className="text-steam-subtle text-xs">{deals.length} stores</span>
        </div>
      </div>

      <div className="divide-y divide-steam-border/50">
        {deals.map((deal, i) => {
          const isBest = i === 0
          const icon = STORE_ICONS[deal.shop_name] || '🛒'
          return (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                isBest ? 'bg-steam-green/5' : 'hover:bg-steam-muted/50'
              }`}
            >
              <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isBest ? 'text-steam-green' : 'text-steam-text'}`}>
                  {deal.shop_name}
                  {isBest && <span className="ml-2 text-xs font-mono text-steam-green/70">BEST</span>}
                </p>
                {deal.cut_pct > 0 && (
                  <p className="text-steam-subtle text-xs font-mono">
                    Was {formatPrice(deal.regular_usd)} · <span className="text-steam-amber">−{deal.cut_pct}%</span>
                  </p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-mono font-bold text-sm ${isBest ? 'text-steam-green' : 'text-steam-text'}`}>
                  {formatPrice(deal.price_usd)}
                </p>
              </div>

              {deal.url && (
                <a
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-1.5 rounded-lg text-steam-subtle hover:text-steam-cyan hover:bg-steam-cyan/10 transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}