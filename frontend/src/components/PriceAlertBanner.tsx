
import { AlertTriangle, TrendingDown, Flame } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface Props {
  currentPrice: number
  minPrice: number
  discountPct: number
  avgPrice: number
}

export default function PriceAlertBanner({ currentPrice, minPrice, discountPct, avgPrice }: Props) {
  const isAtLow = currentPrice <= minPrice * 1.02
  const isNearLow = !isAtLow && currentPrice <= minPrice * 1.1
  const isBigDeal = discountPct >= 75
  const isBelowAvg = currentPrice < avgPrice * 0.7

  if (!isAtLow && !isNearLow && !isBigDeal && !isBelowAvg) return null

  if (isAtLow) return (
    <div className="rounded-xl px-5 py-3.5 border border-steam-green/40 bg-steam-green/10 animate-pulse-glow">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-steam-green/20 flex items-center justify-center flex-shrink-0">
          <TrendingDown size={16} className="text-steam-green" />
        </div>
        <div>
          <p className="text-steam-green font-semibold text-sm">All-Time Low Price!</p>
          <p className="text-steam-green/70 text-xs font-mono">
            {formatPrice(currentPrice)} — the lowest this game has ever been
          </p>
        </div>
      </div>
    </div>
  )

  if (isBigDeal) return (
    <div className="rounded-xl px-5 py-3.5 border border-steam-amber/40 bg-steam-amber/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-steam-amber/20 flex items-center justify-center flex-shrink-0">
          <Flame size={16} className="text-steam-amber" />
        </div>
        <div>
          <p className="text-steam-amber font-semibold text-sm">Massive {discountPct}% Discount</p>
          <p className="text-steam-amber/70 text-xs font-mono">
            All-time low was {formatPrice(minPrice)} · You're saving {formatPrice((avgPrice || 0) - currentPrice)}
          </p>
        </div>
      </div>
    </div>
  )

  if (isNearLow) return (
    <div className="rounded-xl px-5 py-3.5 border border-steam-cyan/30 bg-steam-cyan/5">
      <div className="flex items-center gap-3">
        <AlertTriangle size={16} className="text-steam-cyan flex-shrink-0" />
        <p className="text-steam-cyan text-sm">
          Near all-time low — just {formatPrice(currentPrice - minPrice)} above the record
        </p>
      </div>
    </div>
  )

  return null
}