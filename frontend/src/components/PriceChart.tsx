
'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Brush
} from 'recharts'
import type { PricePoint, PriceStats } from '@/lib/types'
import { formatDate, formatPrice } from '@/lib/utils'

interface Props {
  history: PricePoint[]
  stats?: PriceStats
}

const RANGES = [
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'ALL', days: 0   },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as PricePoint
  return (
    <div className="glass rounded-xl px-4 py-3 text-sm space-y-1.5 min-w-[180px] border border-steam-cyan/20">
      <p className="text-steam-subtle text-xs font-mono">{formatDate(label)}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-steam-cyan font-mono font-bold text-base">{formatPrice(d.price_usd)}</p>
        {d.regular_usd > 0 && d.regular_usd !== d.price_usd && (
          <p className="text-steam-subtle text-xs font-mono line-through">{formatPrice(d.regular_usd)}</p>
        )}
      </div>
      {d.cut_pct > 0 && (
        <div className="inline-block bg-steam-green/15 text-steam-green text-xs font-mono px-2 py-0.5 rounded">
          −{d.cut_pct}% off
        </div>
      )}
      <p className="text-steam-subtle text-xs">{d.shop_name}</p>
    </div>
  )
}

export default function PriceChart({ history, stats }: Props) {
  const [activeRange, setActiveRange] = useState('ALL')
  const [showDiscounts, setShowDiscounts] = useState(true)

  const filtered = useMemo(() => {
    const range = RANGES.find(r => r.label === activeRange)
    if (!range || range.days === 0) return history
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range.days)
    return history.filter(p => new Date(p.timestamp) >= cutoff)
  }, [history, activeRange])

  // Downsample for perf if too many points
  const data = useMemo(() => {
    if (filtered.length <= 300) return filtered
    const step = Math.ceil(filtered.length / 300)
    return filtered.filter((_, i) => i % step === 0)
  }, [filtered])

  const minPrice = stats?.min_price ?? Math.min(...data.map(d => d.price_usd))
  const maxPrice = stats?.max_price ?? Math.max(...data.map(d => d.price_usd))

  // Compute discount periods for highlighting
  const discountDots = useMemo(() =>
    data.filter(d => d.cut_pct > 0).map(d => d.timestamp),
    [data]
  )

  if (!history.length) return (
    <div className="glass rounded-2xl p-8 text-center text-steam-subtle">
      No price history available.
    </div>
  )

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest mb-1">Price History</p>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-steam-subtle text-xs">
              ATL <span className="text-steam-green font-mono font-semibold">{formatPrice(minPrice)}</span>
            </span>
            <span className="text-steam-subtle text-xs">
              Peak <span className="text-steam-text font-mono">{formatPrice(maxPrice)}</span>
            </span>
            <span className="text-steam-subtle/60 text-xs font-mono">{data.length} pts</span>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDiscounts(v => !v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all mr-2 ${
              showDiscounts
                ? 'bg-steam-green/15 text-steam-green border border-steam-green/30'
                : 'text-steam-subtle hover:text-steam-text glass'
            }`}
          >
            Sales
          </button>
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setActiveRange(r.label)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                activeRange === r.label
                  ? 'bg-steam-cyan/15 text-steam-cyan border border-steam-cyan/30'
                  : 'text-steam-subtle hover:text-steam-text glass'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="discountGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00ff87" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ff87" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={v => {
              const d = new Date(v)
              return `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
            }}
            tick={{ fill: '#5c7a9e', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
            tickLine={false} axisLine={{ stroke: '#1f2d45' }}
            interval="preserveStartEnd" minTickGap={60}
          />
          <YAxis
            tickFormatter={v => `$${v}`}
            tick={{ fill: '#5c7a9e', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
            tickLine={false} axisLine={false} width={42}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          {minPrice > 0 && (
            <ReferenceLine
              y={minPrice}
              stroke="#00ff87" strokeDasharray="5 3" strokeOpacity={0.5}
              label={{ value: 'ATL', position: 'insideTopRight', fill: '#00ff87', fontSize: 9, fontFamily: 'DM Mono, monospace' }}
            />
          )}
          {/* Discount periods overlay */}
          {showDiscounts && (
            <Area
              type="stepAfter"
              dataKey={(d: PricePoint) => d.cut_pct > 0 ? d.price_usd : null}
              stroke="#00ff87"
              strokeWidth={2}
              fill="url(#discountGrad)"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, fill: '#00ff87', strokeWidth: 0 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="price_usd"
            stroke="#00d4ff"
            strokeWidth={1.5}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#00d4ff', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats row */}
      {data.length > 0 && (() => {
        const salePts = data.filter(d => d.cut_pct > 0)
        const avgDisc = salePts.length
          ? Math.round(salePts.reduce((s, d) => s + d.cut_pct, 0) / salePts.length)
          : 0
        const maxDisc = salePts.length ? Math.max(...salePts.map(d => d.cut_pct)) : 0
        return (
          <div className="flex gap-4 pt-2 border-t border-steam-border flex-wrap text-xs font-mono">
            <span className="text-steam-subtle">
              Sale events: <span className="text-steam-text">{salePts.length}</span>
            </span>
            {avgDisc > 0 && (
              <span className="text-steam-subtle">
                Avg discount: <span className="text-steam-amber">{avgDisc}%</span>
              </span>
            )}
            {maxDisc > 0 && (
              <span className="text-steam-subtle">
                Best discount: <span className="text-steam-green">{maxDisc}%</span>
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}