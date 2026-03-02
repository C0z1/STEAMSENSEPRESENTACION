
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Zap, TrendingDown, RefreshCw } from 'lucide-react'

// Popular Steam games to suggest when DB is empty
const SEED_GAMES = [
  { title: 'Elden Ring',           appid: 1245620, hint: 'Usually 20-40% off during sales' },
  { title: 'Cyberpunk 2077',       appid: 1091500, hint: 'Frequent deep discounts up to 75%' },
  { title: 'Stardew Valley',       appid: 413150,  hint: 'Rarely goes above 50% off, but worth it' },
  { title: 'Red Dead Redemption 2',appid: 1174180, hint: 'Historically 60-75% off in major sales' },
  { title: 'Hades',                appid: 1145360, hint: 'Regularly 50% off during Steam sales' },
  { title: 'Baldur\'s Gate 3',     appid: 1086940, hint: 'Still relatively new, small discounts' },
  { title: 'Deep Rock Galactic',   appid: 548430,  hint: 'Hits 75% off during seasonal sales' },
  { title: 'Monster Hunter: World',appid: 582010,  hint: 'Extremely cheap during sales (-80%)' },
]

interface Props {
  onSearch?: (query: string) => void
}

export default function EmptyStateWithSeed({ onSearch }: Props) {
  const [syncing, setSyncing] = useState<string | null>(null)

  const handleSync = async (appid: number, title: string) => {
    setSyncing(title)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const res = await fetch(`${BASE}/sync/game/${appid}`, { method: 'POST' })
      const data = await res.json()
      if (data.game_id) {
        window.location.href = `/game/${data.game_id}`
      }
    } catch (e) {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-6 py-4">
      {/* CTA row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-steam-amber/20 text-steam-amber text-xs font-mono">
          <Zap size={12} />
          Sync games to see deals & predictions
        </div>
        <code className="text-steam-subtle/50 text-xs font-mono hidden sm:block">
          POST /sync/top?top_n=50
        </code>
      </div>

      {/* Suggested games grid */}
      <div>
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest mb-3">
          Popular Games · Click to Load
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SEED_GAMES.map(g => (
            <button
              key={g.appid}
              onClick={() => handleSync(g.appid, g.title)}
              disabled={syncing !== null}
              className="glass glass-hover rounded-xl overflow-hidden text-left group disabled:opacity-60 transition-all"
            >
              {/* Steam header image */}
              <div className="relative h-16 overflow-hidden bg-steam-muted">
                <img
                  src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                  alt={g.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {syncing === g.title && (
                  <div className="absolute inset-0 bg-steam-bg/80 flex items-center justify-center">
                    <RefreshCw size={16} className="text-steam-cyan animate-spin" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-steam-text text-xs font-semibold leading-tight">{g.title}</p>
                <p className="text-steam-subtle/60 text-xs font-mono mt-1 leading-tight">{g.hint}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Or search */}
      <div className="text-center">
        <p className="text-steam-subtle/50 text-xs font-mono">
          or use the search bar above to find any Steam game
        </p>
      </div>
    </div>
  )
}