
'use client'

import { useMemo } from 'react'
import { Calendar, TrendingDown, AlertCircle } from 'lucide-react'
import type { PricePoint, SeasonalPattern } from '@/lib/types'
import { MONTH_NAMES } from '@/lib/utils'

interface Props {
  history: PricePoint[]
  seasonal: SeasonalPattern[]
}

const SALE_SEASONS = [
  { months: [11, 12], name: 'Winter Sale',        icon: '❄️' },
  { months: [6, 7],   name: 'Summer Sale',         icon: '☀️' },
  { months: [2],      name: 'Lunar New Year Sale', icon: '🧧' },
  { months: [10, 11], name: 'Autumn / Halloween',  icon: '🎃' },
  { months: [5, 6],   name: 'Spring Sale',         icon: '🌸' },
]

export default function NextSalePredictor({ history, seasonal }: Props) {
  const analysis = useMemo(() => {
    if (!history.length) return null

    const now       = new Date()
    const curMonth  = now.getMonth() + 1

    // Average gap between sale events in days
    const saleDates = history
      .filter(h => h.cut_pct > 0)
      .map(h => new Date(h.timestamp))
      .sort((a, b) => a.getTime() - b.getTime())

    if (saleDates.length < 2) return null

    const gaps: number[] = []
    for (let i = 1; i < saleDates.length; i++) {
      gaps.push((saleDates[i].getTime() - saleDates[i-1].getTime()) / 86400000)
    }
    const avgGap   = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const lastSale = saleDates[saleDates.length - 1]
    const daysSinceLast = (now.getTime() - lastSale.getTime()) / 86400000
    const daysUntilNext = Math.max(0, Math.round(avgGap - daysSinceLast))

    // Which upcoming steam season has the best historical discount for this game?
    const seasonalMap = Object.fromEntries(seasonal.map(s => [s.month, s.avg_discount]))
    const upcomingSeasons = SALE_SEASONS
      .map(s => ({
        ...s,
        avgDiscount: Math.round(
          s.months.reduce((sum, m) => sum + (seasonalMap[m] || 0), 0) / s.months.length
        ),
        monthsUntil: Math.min(...s.months.map(m => {
          let diff = m - curMonth
          if (diff < 0) diff += 12
          return diff
        }))
      }))
      .filter(s => s.avgDiscount > 0)
      .sort((a, b) => b.avgDiscount - a.avgDiscount)

    const bestSeason = upcomingSeasons[0] || null

    return { avgGap: Math.round(avgGap), daysSinceLast: Math.round(daysSinceLast), daysUntilNext, bestSeason, saleDates, upcomingSeasons }
  }, [history, seasonal])

  if (!analysis) return null

  const { avgGap, daysSinceLast, daysUntilNext, bestSeason, upcomingSeasons } = analysis
  const urgency = daysUntilNext <= 7 ? 'high' : daysUntilNext <= 30 ? 'medium' : 'low'

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-steam-cyan" />
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest">Sale Predictor</p>
      </div>

      {/* Next sale estimate */}
      <div className={`rounded-xl px-4 py-3 border ${
        urgency === 'high'   ? 'bg-steam-green/10 border-steam-green/30' :
        urgency === 'medium' ? 'bg-steam-amber/10 border-steam-amber/30' :
                               'bg-steam-muted border-steam-border'
      }`}>
        <p className="text-steam-subtle text-xs font-mono mb-1">Estimated next sale</p>
        <p className={`font-display font-bold text-lg ${
          urgency === 'high' ? 'text-steam-green' : urgency === 'medium' ? 'text-steam-amber' : 'text-steam-text'
        }`}>
          {daysUntilNext === 0 ? '🎯 Might be on sale now!' :
           daysUntilNext <= 7  ? `In ~${daysUntilNext} days` :
           daysUntilNext <= 30 ? `In ~${daysUntilNext} days` :
           `In ~${Math.round(daysUntilNext / 30)} months`}
        </p>
        <p className="text-steam-subtle text-xs font-mono mt-1">
          Last sale was {Math.round(daysSinceLast)}d ago · avg gap {avgGap}d
        </p>
      </div>

      {/* Seasonal breakdown */}
      {upcomingSeasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-steam-subtle text-xs font-mono">Historically best seasons</p>
          {upcomingSeasons.slice(0, 3).map(s => (
            <div key={s.name} className="flex items-center gap-3">
              <span className="text-base w-6 text-center">{s.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-steam-text">{s.name}</span>
                  <span className="text-steam-green font-mono">avg −{s.avgDiscount}%</span>
                </div>
                <div className="h-1 bg-steam-muted rounded-full">
                  <div
                    className="h-full bg-gradient-to-r from-steam-cyan to-steam-green rounded-full"
                    style={{ width: `${Math.min(100, s.avgDiscount * 2)}%` }}
                  />
                </div>
              </div>
              <span className="text-steam-subtle text-xs font-mono w-14 text-right">
                {s.monthsUntil === 0 ? 'now' : `${s.monthsUntil}mo`}
              </span>
            </div>
          ))}
        </div>
      )}

      {bestSeason && (
        <div className="flex items-start gap-2 text-xs text-steam-subtle font-mono border-t border-steam-border/50 pt-3">
          <AlertCircle size={11} className="text-steam-amber mt-0.5 flex-shrink-0" />
          <span>
            Best historical discount during <span className="text-steam-amber">{bestSeason.name}</span> —
            avg {bestSeason.avgDiscount}% off.
            {bestSeason.monthsUntil === 0 ? ' That\'s right now!' : ` ${bestSeason.monthsUntil} month(s) away.`}
          </span>
        </div>
      )}
    </div>
  )
}