
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Trophy, TrendingDown, Gamepad2, DollarSign } from 'lucide-react'
import { steamImageUrl, formatPrice } from '@/lib/utils'

// ── Clasificador de géneros por nombre de juego ───────────────────────────────
// Heurística simple: detecta géneros a partir de palabras clave en el título.
// Es una aproximación suficiente sin necesitar la Steam API de géneros.
const GENRE_KEYWORDS: Record<string, string[]> = {
  'RPG':         ['rpg', 'role', 'quest', 'legend', 'fantasy', 'dragon', 'souls', 'elden', 'witcher', 'baldur', 'divinity'],
  'FPS':         ['shooter', 'warfare', 'combat', 'battlefield', 'counter', 'doom', 'halo', 'overwatch', 'valorant', 'cs2', 'csgo'],
  'Strategy':    ['civilization', 'civ', 'total war', 'crusader', 'europa', 'stellaris', 'xcom', 'command', 'age of'],
  'Action':      ['batman', 'spider', 'assassin', 'devil may', 'sekiro', 'dark souls', 'bloodborne', 'god of war', 'hack'],
  'Survival':    ['survival', 'minecraft', 'terraria', 'rust', 'ark', 'valheim', 'forest', 'stranded', 'subnautica'],
  'Racing':      ['racing', 'forza', 'gran turismo', 'need for speed', 'f1', 'mario kart', 'rocket league'],
  'Simulation':  ['simulator', 'cities', 'farming', 'stardew', 'sims', 'flight', 'euro truck', 'planet'],
  'Horror':      ['horror', 'resident evil', 'silent hill', 'outlast', 'amnesia', 'dead space', 'visage'],
  'Sports':      ['fifa', 'nba', 'nhl', 'nfl', 'pes', 'football', 'basketball', 'tennis', 'golf'],
  'Indie':       ['hollow knight', 'celeste', 'hades', 'dead cells', 'ori', 'cuphead', 'shovel knight'],
  'Adventure':   ['adventure', 'journey', 'telltale', 'life is strange', 'walking dead', 'monkey island'],
  'MOBA/Online': ['dota', 'league of legends', 'smite', 'heroes of the storm', 'paladins'],
}

function detectGenre(title: string): string {
  const lower = title.toLowerCase()
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return genre
  }
  return 'Other'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface LibraryGame {
  appid: number
  game_title: string
  playtime_mins: number
  last_played?: string
  game_id?: string
  min_price?: number
  avg_price?: number
  max_discount?: number
  total_records?: number
}

interface Props {
  games: LibraryGame[]
}

export default function ProfileInsights({ games }: Props) {
  const insights = useMemo(() => {
    if (!games.length) return null

    // ── Top 3 juegos por horas jugadas ────────────────────────────────────────
    const top3 = [...games]
      .filter(g => g.playtime_mins > 0)
      .sort((a, b) => b.playtime_mins - a.playtime_mins)
      .slice(0, 3)

    // ── Géneros favoritos por horas jugadas ───────────────────────────────────
    const genreHours: Record<string, number> = {}
    for (const g of games) {
      if (g.playtime_mins <= 0) continue
      const genre = detectGenre(g.game_title)
      genreHours[genre] = (genreHours[genre] || 0) + g.playtime_mins
    }
    const totalPlaytime = Object.values(genreHours).reduce((a, b) => a + b, 0)
    const topGenres = Object.entries(genreHours)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([genre, mins]) => ({
        genre,
        hours: Math.round(mins / 60),
        pct:   totalPlaytime > 0 ? Math.round((mins / totalPlaytime) * 100) : 0,
      }))

    // ── Precio ahorrado estimado ───────────────────────────────────────────────
    // Para cada juego trackeado: (avg_price - min_price) * probabilidad de haberlo comprado en sale
    // Es una estimación — no sabemos el precio de compra real.
    let savedEstimate = 0
    let gamesOnSale   = 0
    for (const g of games) {
      if (g.avg_price && g.min_price && g.avg_price > g.min_price && g.max_discount && g.max_discount > 0) {
        savedEstimate += (g.avg_price - g.min_price)
        gamesOnSale++
      }
    }

    return { top3, topGenres, savedEstimate, gamesOnSale, totalHours: Math.round(totalPlaytime / 60) }
  }, [games])

  if (!insights || !games.length) return null

  const genreColors = [
    'bg-steam-cyan',
    'bg-steam-green',
    'bg-steam-amber',
    'bg-purple-400',
    'bg-steam-red',
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-steam-text text-sm font-semibold flex items-center gap-2">
        <Gamepad2 size={14} className="text-steam-cyan" />
        Your Gaming Profile
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* ── Top 3 juegos ─────────────────────────────────────────────────── */}
        <div className="glass rounded-xl p-4 space-y-3 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={13} className="text-steam-amber" />
            <p className="text-steam-subtle text-xs font-mono uppercase tracking-wider">Most Played</p>
          </div>
          {insights.top3.length === 0 ? (
            <p className="text-steam-subtle text-xs">No playtime data yet</p>
          ) : (
            insights.top3.map((g, i) => (
              <div key={g.appid} className="flex items-center gap-3 group">
                {/* Rank */}
                <span className={`text-xs font-mono font-bold w-4 flex-shrink-0 ${
                  i === 0 ? 'text-steam-amber' : i === 1 ? 'text-steam-subtle' : 'text-steam-subtle/60'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </span>

                {/* Thumbnail */}
                <div className="w-12 h-7 rounded bg-steam-muted overflow-hidden flex-shrink-0">
                  {steamImageUrl(g.appid) ? (
                    <img src={steamImageUrl(g.appid)!} alt={g.game_title}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-steam-muted" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {g.game_id ? (
                    <Link href={`/game/${g.game_id}`}
                      className="text-steam-text text-xs font-semibold truncate block group-hover:text-steam-cyan transition-colors">
                      {g.game_title}
                    </Link>
                  ) : (
                    <p className="text-steam-text text-xs font-semibold truncate">{g.game_title}</p>
                  )}
                  <p className="text-steam-subtle text-xs font-mono">
                    {Math.round(g.playtime_mins / 60)}h played
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Géneros favoritos ─────────────────────────────────────────────── */}
        <div className="glass rounded-xl p-4 space-y-3 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 size={13} className="text-steam-cyan" />
            <p className="text-steam-subtle text-xs font-mono uppercase tracking-wider">Favorite Genres</p>
          </div>
          {insights.topGenres.length === 0 ? (
            <p className="text-steam-subtle text-xs">No genre data yet</p>
          ) : (
            <div className="space-y-2.5">
              {insights.topGenres.map(({ genre, hours, pct }, i) => (
                <div key={genre} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-steam-text text-xs font-medium">{genre}</span>
                    <span className="text-steam-subtle text-xs font-mono">{hours}h · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-steam-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${genreColors[i] || 'bg-steam-cyan'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Precio ahorrado estimado ──────────────────────────────────────── */}
        <div className="glass rounded-xl p-4 space-y-3 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={13} className="text-steam-green" />
            <p className="text-steam-subtle text-xs font-mono uppercase tracking-wider">Savings Estimate</p>
          </div>

          <div className="text-center py-2">
            <p className="font-display font-bold text-2xl text-steam-green">
              {formatPrice(insights.savedEstimate)}
            </p>
            <p className="text-steam-subtle text-xs mt-1 leading-relaxed">
              Estimated saved vs. avg price across{' '}
              <span className="text-steam-text">{insights.gamesOnSale}</span> tracked games
            </p>
          </div>

          <div className="border-t border-steam-border pt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-steam-subtle font-mono">Total library</span>
              <span className="text-steam-text font-mono font-semibold">{games.length} games</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-steam-subtle font-mono">Total hours</span>
              <span className="text-steam-text font-mono font-semibold">{insights.totalHours}h</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-steam-subtle font-mono">Tracked in DB</span>
              <span className="text-steam-text font-mono font-semibold">
                {games.filter(g => g.game_id).length} games
              </span>
            </div>
          </div>

          <p className="text-steam-subtle/50 text-xs italic leading-relaxed">
            * Estimate based on historical price data. Actual savings may vary.
          </p>
        </div>

      </div>
    </div>
  )
}