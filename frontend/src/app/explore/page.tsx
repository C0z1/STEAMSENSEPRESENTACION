
'use client'

import { useState, useEffect, useTransition } from 'react'
import { Compass, Zap, TrendingDown, Database, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import GameCard from '@/components/GameCard'
import { getTopDeals, getTopBuySignals, listGames } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Tab = 'deals' | 'buy' | 'all'

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
          <div className="h-28 bg-steam-muted" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-steam-muted rounded w-3/4" />
            <div className="h-2 bg-steam-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyTabState({ tab, onGenerate }: { tab: Tab; onGenerate: () => void }) {
  const msgs = {
    deals: 'No deals yet — games need price history with discounts.',
    buy:   'No BUY signals yet — predictions are generated from price history.',
    all:   'No games synced yet.',
  }
  const tips = {
    deals: 'Run a sync first, then come back here.',
    buy:   'Try "Generate Predictions" to run ML on all synced games.',
    all:   'Use the search bar to find and sync individual games.',
  }
  return (
    <div className="py-20 text-center space-y-4">
      <Database size={36} className="text-steam-subtle/30 mx-auto" />
      <div>
        <p className="text-steam-text text-sm">{msgs[tab]}</p>
        <p className="text-steam-subtle text-xs mt-1">{tips[tab]}</p>
      </div>
      {tab === 'buy' && (
        <button onClick={onGenerate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-steam-green/10 border border-steam-green/30 rounded-xl text-steam-green text-sm font-mono hover:bg-steam-green/20 transition-all">
          <Zap size={13} /> Generate Predictions
        </button>
      )}
      {tab === 'deals' && (
        <Link href="/"
          className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl text-steam-cyan text-sm font-mono hover:bg-steam-muted transition-all">
          Go to Home & Sync Games
        </Link>
      )}
    </div>
  )
}

export default function ExplorePage() {
  const [tab, setTab]         = useState<Tab>('deals')
  const [deals, setDeals]     = useState<any[]>([])
  const [signals, setSignals] = useState<any[]>([])
  const [games, setGames]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [genMsg, setGenMsg]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // FIX: contadores precargados para todos los tabs, no solo el activo
  const [counts, setCounts] = useState<Record<Tab, number | null>>({
    deals: null,
    buy:   null,
    all:   null,
  })

  // Carga el tab activo con datos completos
  const loadTab = async (t: Tab) => {
    setLoading(true)
    try {
      if (t === 'deals') {
        const data = await getTopDeals(60)
        setDeals(data)
        setCounts(c => ({ ...c, deals: data.length }))
      } else if (t === 'buy') {
        const data = await getTopBuySignals(60)
        setSignals(data)
        setCounts(c => ({ ...c, buy: data.length }))
      } else {
        const data = await listGames(200)
        setGames(data)
        setCounts(c => ({ ...c, all: data.length }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Al montar: carga el tab activo + prefetch de contadores de los otros dos en paralelo
  useEffect(() => {
    loadTab('deals')

    // Prefetch contadores en background — requests ligeras con limit pequeño
    Promise.allSettled([
      getTopBuySignals(60).then(d => setCounts(c => ({ ...c, buy:   d.length }))),
      listGames(200).then(d      => setCounts(c => ({ ...c, all:   d.length }))),
    ])
  }, [])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    loadTab(t)
  }

  const handleGeneratePredictions = async () => {
    setGenMsg('Generating predictions...')
    try {
      await fetch(`${BASE}/sync/predictions`, { method: 'POST' })
      setGenMsg('Running in background. Refresh in ~30 seconds.')
      setTimeout(async () => {
        const data = await getTopBuySignals(60)
        setSignals(data)
        setCounts(c => ({ ...c, buy: data.length }))
        setGenMsg(null)
      }, 8000)
    } catch {
      setGenMsg('Error starting prediction batch.')
      setTimeout(() => setGenMsg(null), 3000)
    }
  }

  const handleRefresh = () => {
    startTransition(() => { loadTab(tab) })
  }

  const currentData = tab === 'deals' ? deals : tab === 'buy' ? signals : games
  const isEmpty     = !loading && currentData.length === 0

  const tabs: { key: Tab; label: string; icon: typeof Zap; color?: string }[] = [
    { key: 'deals', label: 'Hot Deals',   icon: TrendingDown },
    { key: 'buy',   label: 'BUY Signals', icon: Zap,         color: 'text-steam-green' },
    { key: 'all',   label: 'All Games',   icon: Database },
  ]

  return (
    <div className="min-h-screen bg-steam-bg">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-steam-cyan/10 border border-steam-cyan/20 flex items-center justify-center">
                <Compass size={16} className="text-steam-cyan" />
              </div>
              <h1 className="font-display font-bold text-2xl text-steam-text">Explore</h1>
            </div>
            <p className="text-steam-subtle text-sm">Browse all tracked games and find the best deals</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {tab === 'buy' && (
              <button onClick={handleGeneratePredictions}
                className="flex items-center gap-2 px-3 py-2 glass rounded-xl text-xs font-mono text-steam-green hover:bg-steam-green/10 transition-all">
                <Zap size={12} /> Generate
              </button>
            )}
            <button onClick={handleRefresh} disabled={loading || isPending}
              className="flex items-center gap-2 px-3 py-2 glass rounded-xl text-xs font-mono text-steam-subtle hover:text-steam-text transition-all disabled:opacity-40">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Gen message */}
        {genMsg && (
          <div className="flex items-center gap-2 px-4 py-3 glass rounded-xl border border-steam-green/20 text-steam-green text-sm font-mono mb-6">
            <AlertCircle size={14} /> {genMsg}
          </div>
        )}

        {/* Tabs — FIX: contador visible en TODOS los tabs, no solo el activo */}
        <div className="flex items-center gap-2 mb-8">
          {tabs.map(({ key, label, icon: Icon, color }) => {
            const isActive = tab === key
            const count    = counts[key]
            return (
              <button key={key} onClick={() => handleTabChange(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono transition-all ${
                  isActive
                    ? 'bg-steam-cyan/10 border border-steam-cyan/30 text-steam-cyan'
                    : 'glass text-steam-subtle hover:text-steam-text'
                }`}>
                <Icon size={14} className={!isActive && color ? color : undefined} />
                {label}
                {/* Contador siempre visible si hay datos, con opacidad reducida si no es el tab activo */}
                {count !== null && count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono transition-all ${
                    isActive
                      ? 'bg-steam-cyan/20 text-steam-cyan'
                      : 'bg-steam-muted text-steam-subtle'
                  }`}>
                    {count}
                  </span>
                )}
                {/* Spinner mini mientras carga ese tab en bg */}
                {count === null && !isActive && (
                  <span className="w-3 h-3 rounded-full border border-steam-subtle/30 border-t-steam-subtle animate-spin inline-block" />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <GridSkeleton />
        ) : isEmpty ? (
          <EmptyTabState tab={tab} onGenerate={handleGeneratePredictions} />
        ) : tab === 'deals' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {deals.map((d: any, i: number) => (
              <GameCard key={d.id} id={d.id} title={d.title} appid={d.appid}
                currentPrice={d.current_price} regularPrice={d.regular_price}
                discountPct={d.discount_pct} minPrice={d.min_price}
                lastSeen={d.last_seen} index={i} />
            ))}
          </div>
        ) : tab === 'buy' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {signals.map((s: any, i: number) => (
              <GameCard key={s.id} id={s.id} title={s.title} appid={s.appid}
                currentPrice={s.current_price} discountPct={s.discount_pct}
                score={s.score} signal={s.signal} index={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {games.map((g: any, i: number) => (
              <GameCard key={g.id} id={g.id} title={g.title} appid={g.appid}
                minPrice={g.min_price} discountPct={g.max_discount} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}