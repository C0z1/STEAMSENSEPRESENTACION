
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { SeasonalPattern } from '@/lib/types'
import { MONTH_NAMES } from '@/lib/utils'

interface Props {
  patterns: SeasonalPattern[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass rounded-xl px-4 py-3 text-sm">
      <p className="text-steam-text font-semibold">{MONTH_NAMES[d.month]}</p>
      <p className="text-steam-cyan font-mono">{d.avg_discount.toFixed(1)}% avg discount</p>
      <p className="text-steam-subtle text-xs">{d.sample_count} data points</p>
    </div>
  )
}

export default function SeasonalChart({ patterns }: Props) {
  if (!patterns.length) return null

  // Fill missing months with 0
  const full = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const found = patterns.find(p => p.month === month)
    return { month, avg_discount: found?.avg_discount ?? 0, sample_count: found?.sample_count ?? 0 }
  })

  const maxDiscount = Math.max(...full.map(d => d.avg_discount))

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest mb-1">Seasonal Patterns</p>
        <p className="text-steam-text text-sm">Average discount by month</p>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={full} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d45" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={m => MONTH_NAMES[m]}
            tick={{ fill: '#5c7a9e', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={{ stroke: '#1f2d45' }}
          />
          <YAxis
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#5c7a9e', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="avg_discount" radius={[3, 3, 0, 0]}>
            {full.map(entry => {
              const intensity = maxDiscount > 0 ? entry.avg_discount / maxDiscount : 0
              const isHigh = entry.month === 11 || entry.month === 12 || entry.month === 6 || entry.month === 7
              return (
                <Cell
                  key={entry.month}
                  fill={isHigh
                    ? `rgba(0, 255, 135, ${0.3 + intensity * 0.6})`
                    : `rgba(0, 212, 255, ${0.2 + intensity * 0.5})`
                  }
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-4 text-xs text-steam-subtle font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-steam-green/60 inline-block" />
          Peak sale months
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-steam-cyan/40 inline-block" />
          Other months
        </span>
      </div>
    </div>
  )
}