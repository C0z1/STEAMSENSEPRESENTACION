
'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { PricePoint } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

interface Props {
  history: PricePoint[]
  minPrice?: number
  avgPrice?: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs font-mono border border-steam-cyan/20">
      <p className="text-steam-subtle">{d.label}</p>
      <p className="text-steam-cyan font-bold">{d.count} records</p>
      <p className="text-steam-subtle">{d.pct}% of history</p>
    </div>
  )
}

export default function PriceHistogram({ history, minPrice, avgPrice }: Props) {
  const bins = useMemo(() => {
    if (!history.length) return []

    const prices = history.map(h => h.price_usd).filter(p => p >= 0)
    if (!prices.length) return []

    const max = Math.max(...prices)
    const min = Math.min(...prices)
    if (max === min) return []

    // Create 10 bins
    const BIN_COUNT = 10
    const binSize = (max - min) / BIN_COUNT
    const buckets = Array.from({ length: BIN_COUNT }, (_, i) => ({
      start: min + i * binSize,
      end:   min + (i + 1) * binSize,
      count: 0,
    }))

    prices.forEach(p => {
      const idx = Math.min(Math.floor((p - min) / binSize), BIN_COUNT - 1)
      buckets[idx].count++
    })

    return buckets.map(b => ({
      label: `${formatPrice(b.start)}–${formatPrice(b.end)}`,
      midpoint: (b.start + b.end) / 2,
      count: b.count,
      pct: Math.round(b.count / prices.length * 100),
      start: b.start,
      end: b.end,
    }))
  }, [history])

  if (!bins.length) return null

  const maxCount = Math.max(...bins.map(b => b.count))

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest">
          Price Distribution
        </p>
        <p className="text-steam-subtle/60 text-xs font-mono">
          {history.length} records
        </p>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={bins} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} barCategoryGap="10%">
          <XAxis
            dataKey="label"
            tick={false}
            axisLine={{ stroke: '#1f2d45' }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,212,255,0.05)' }} />

          {/* ATL reference */}
          {minPrice != null && minPrice > 0 && (
            <ReferenceLine
              x={bins.find(b => b.start <= minPrice && minPrice <= b.end)?.label}
              stroke="#00ff87" strokeDasharray="3 3" strokeOpacity={0.7}
              label={{ value: 'ATL', position: 'insideTopLeft', fill: '#00ff87', fontSize: 9, fontFamily: 'DM Mono, monospace' }}
            />
          )}

          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {bins.map((b, i) => {
              // Color: green if at/near ATL, cyan otherwise, with intensity by frequency
              const isLow   = minPrice != null && b.end <= (minPrice * 1.2)
              const opacity = 0.3 + (b.count / maxCount) * 0.7
              return (
                <Cell
                  key={i}
                  fill={isLow ? `rgba(0,255,135,${opacity})` : `rgba(0,212,255,${opacity})`}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Price range labels */}
      <div className="flex justify-between text-xs font-mono text-steam-subtle/50">
        <span>{formatPrice(bins[0].start)}</span>
        {avgPrice && avgPrice > 0 && (
          <span className="text-steam-amber/70">avg {formatPrice(avgPrice)}</span>
        )}
        <span>{formatPrice(bins[bins.length - 1].end)}</span>
      </div>
    </div>
  )
}