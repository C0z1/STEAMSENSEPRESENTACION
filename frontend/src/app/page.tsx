
import { Suspense } from 'react'
import { TrendingUp, Database, Zap, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import GameSearch from '@/components/GameSearch'
import GameCard from '@/components/GameCard'
import EmptyStateWithSeed from '@/components/EmptyStateWithSeed'
import { getTopDeals, getTopBuySignals, getOverviewStats } from '@/lib/api'
import type { TopDeal, BuySignal } from '@/lib/types'

function CardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-32 bg-steam-muted" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-steam-muted rounded w-3/4" />
        <div className="h-3 bg-steam-muted rounded w-1/2" />
        <div className="h-2 bg-steam-muted rounded" />
      </div>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}

async function OverviewBar() {
  let stats = { total_games: 0, total_records: 0, buy_signals: 0, wait_signals: 0 }
  try { stats = await getOverviewStats() } catch {}

  const fmt = (n: number) => n > 0 ? n.toLocaleString() : '—'

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 py-6">
      {[
        { label: 'Games tracked',  value: fmt(stats.total_games),   icon: Database, color: '' },
        { label: 'Price records',  value: fmt(stats.total_records),  icon: TrendingUp, color: '' },
        { label: 'BUY signals',   value: fmt(stats.buy_signals),    icon: Zap,  color: 'text-steam-green' },
        { label: 'WAIT signals',  value: fmt(stats.wait_signals),   icon: Clock, color: '' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-steam-subtle text-xs font-mono mb-1">
            <Icon size={11} className={color} />
            {label}
          </div>
          <div className={`font-display font-bold text-xl ${color || 'text-steam-text'}`}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

async function TopDealsSection() {
  let deals: TopDeal[] = []
  try { deals = await getTopDeals(8) } catch {}

  if (!deals.length) return <EmptyStateWithSeed />

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {deals.map((d, i) => (
        <GameCard
          key={d.id} id={d.id} title={d.title} appid={d.appid}
          currentPrice={d.current_price} regularPrice={d.regular_price}
          discountPct={d.discount_pct} minPrice={d.min_price}
          lastSeen={d.last_seen} index={i}
        />
      ))}
    </div>
  )
}

async function BuySignalsSection() {
  let signals: BuySignal[] = []
  try { signals = await getTopBuySignals(8) } catch {}

  if (!signals.length) return (
    <div className="text-center py-10 space-y-3">
      <p className="text-steam-subtle text-sm">No BUY signals yet.</p>
      <a href="/explore?tab=buy"
        className="inline-flex items-center gap-2 px-4 py-2 bg-steam-green/10 border border-steam-green/30 rounded-xl text-steam-green text-xs font-mono hover:bg-steam-green/20 transition-all">
        Generate Predictions →
      </a>
    </div>
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {signals.map((s, i) => (
        <GameCard
          key={s.id} id={s.id} title={s.title} appid={s.appid}
          currentPrice={s.current_price} discountPct={s.discount_pct}
          score={s.score} signal={s.signal} index={i}
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-steam-bg">
      <Navbar />

      {/* Hero */}
      <div className="relative pt-28 pb-12 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-25 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-steam-cyan/4 blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center space-y-7">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-steam-cyan/10 border border-steam-cyan/20 rounded-full text-steam-cyan text-xs font-mono">
            <Zap size={11} /> ML-powered · updated live
          </div>
          <div className="space-y-3">
            <h1 className="font-display font-bold text-5xl sm:text-6xl leading-none tracking-tight">
              <span className="text-steam-text">Buy or</span><br />
              <span className="text-gradient-cyan">Wait?</span>
            </h1>
            <p className="text-steam-subtle text-lg max-w-lg mx-auto leading-relaxed">
              Machine learning analyzes years of Steam price history to tell you exactly when to buy.
            </p>
          </div>
          <GameSearch />
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="glass rounded-2xl">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-steam-muted" />}>
            <OverviewBar />
          </Suspense>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-xl text-steam-text">🔥 Hot Deals</h2>
              <p className="text-steam-subtle text-sm mt-0.5">Games currently on sale, sorted by biggest discount</p>
            </div>
            <Link href="/explore?tab=deals" className="flex items-center gap-1 text-steam-subtle text-xs font-mono hover:text-steam-cyan transition-colors">
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <Suspense fallback={<GridSkeleton />}>
            <TopDealsSection />
          </Suspense>
        </section>

        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-xl text-steam-text">
                <span className="text-steam-green">⚡</span> ML Buy Signals
              </h2>
              <p className="text-steam-subtle text-sm mt-0.5">Games our model says are worth buying right now</p>
            </div>
            <Link href="/explore?tab=buy" className="flex items-center gap-1 text-steam-subtle text-xs font-mono hover:text-steam-cyan transition-colors">
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <Suspense fallback={<GridSkeleton />}>
            <BuySignalsSection />
          </Suspense>
        </section>
      </div>
    </div>
  )
}