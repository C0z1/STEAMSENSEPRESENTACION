
'use client'

import { TrendingDown, Clock, Zap, Shield } from 'lucide-react'
import type { PredictionResponse } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

interface Props {
  data: PredictionResponse
  loading?: boolean
}

export default function PredictionBadge({ data, loading }: Props) {
  const { prediction, price_context } = data
  const isBuy = prediction.signal === 'BUY'
  const score = prediction.score

  const scoreColor =
    score >= 70 ? 'text-steam-green' :
    score >= 45 ? 'text-steam-amber' :
    'text-steam-red'

  const ringColor =
    score >= 70 ? 'border-steam-green/40 glow-green' :
    score >= 45 ? 'border-steam-amber/40 glow-amber' :
    'border-steam-red/40'

  const fillDeg = Math.round((score / 100) * 360)

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest mb-1">ML Prediction</p>
          <h2 className="text-steam-text text-lg font-display font-semibold">Should you buy?</h2>
        </div>
        {data.from_cache && (
          <span className="text-steam-subtle text-xs font-mono bg-steam-muted px-2 py-1 rounded">
            cached
          </span>
        )}
      </div>

      {/* Score ring + signal */}
      <div className="flex items-center gap-6">
        {/* Circular score */}
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]">
            <circle cx="44" cy="44" r="36" fill="none" stroke="#1f2d45" strokeWidth="6" />
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              stroke={isBuy ? '#00ff87' : score >= 45 ? '#ffb800' : '#ff4757'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - score / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-display font-bold ${scoreColor}`}>{Math.round(score)}</span>
            <span className="text-steam-subtle text-xs">/ 100</span>
          </div>
        </div>

        {/* Signal */}
        <div className="flex-1">
          <div className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-2xl mb-2
            ${isBuy
              ? 'bg-steam-green/10 text-steam-green border border-steam-green/30'
              : 'bg-steam-amber/10 text-steam-amber border border-steam-amber/30'
            }
          `}>
            {isBuy ? <Zap size={20} /> : <Clock size={20} />}
            {prediction.signal}
          </div>
          <p className="text-steam-text text-sm leading-relaxed">
            {prediction.reason}
          </p>
        </div>
      </div>

      {/* Confidence */}
      {prediction.confidence > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-steam-subtle font-mono">
            <span className="flex items-center gap-1"><Shield size={10} /> Confidence</span>
            <span>{Math.round(prediction.confidence * 100)}%</span>
          </div>
          <div className="h-1.5 bg-steam-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-steam-cyan to-steam-green rounded-full transition-all duration-1000"
              style={{ width: `${prediction.confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Price context */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-steam-border">
        {[
          { label: 'Current', value: formatPrice(price_context.current_price), highlight: price_context.current_discount_pct > 0 },
          { label: 'All-time low', value: formatPrice(price_context.min_price_ever) },
          { label: 'Avg price', value: formatPrice(price_context.avg_price) },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="text-center">
            <div className={`text-base font-mono font-semibold ${highlight ? 'text-steam-green' : 'text-steam-text'}`}>
              {value}
            </div>
            <div className="text-steam-subtle text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {price_context.current_discount_pct > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-steam-green/10 border border-steam-green/20 rounded-lg">
          <TrendingDown size={14} className="text-steam-green" />
          <span className="text-steam-green text-sm font-semibold">
            {price_context.current_discount_pct}% OFF right now
          </span>
        </div>
      )}
    </div>
  )
}