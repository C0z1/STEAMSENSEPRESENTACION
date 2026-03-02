
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ExternalLink, BarChart3, Clock } from 'lucide-react'
import Navbar from '@/components/Navbar'
import PredictionBadge from '@/components/PredictionBadge'
import PriceChart from '@/components/PriceChart'
import SeasonalChart from '@/components/SeasonalChart'
import { getGameStats, getPriceHistory, getPrediction } from '@/lib/api'
import { formatDate, formatPrice } from '@/lib/utils'

interface Props { params: { id: string } }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-steam-text font-mono font-semibold text-base">{value}</div>
      <div className="text-steam-subtle text-xs mt-0.5">{label}</div>
      {sub && <div className="text-steam-subtle/60 text-xs mt-0.5 font-mono">{sub}</div>}
    </div>
  )
}

export default async function GamePage({ params }: Props) {
  const { id } = params

  const [statsResult, historyResult, predictionResult] = await Promise.allSettled([
    getGameStats(id),
    getPriceHistory(id),
    getPrediction(id),
  ])

  // If game doesn't exist at all in DB → 404
  if (statsResult.status === 'rejected') {
    const msg = (statsResult.reason as Error)?.message || ''
    // Show friendly page if it's a "not found" vs a server error
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return (
        <div className="min-h-screen bg-steam-bg flex items-center justify-center px-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-steam-card border border-steam-border flex items-center justify-center">
              <Clock size={36} className="text-steam-cyan animate-pulse-slow" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-steam-text">Loading price data...</h1>
              <p className="text-steam-subtle mt-2 text-sm leading-relaxed">
                This game is being synced from IsThereAnyDeal.
                It might take a few seconds. Refresh in a moment.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-steam-cyan/10 border border-steam-cyan/20 text-steam-cyan rounded-xl text-sm font-mono hover:bg-steam-cyan/20 transition-colors"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 glass border border-steam-border text-steam-subtle rounded-xl text-sm font-mono hover:text-steam-text transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </Link>
            </div>
          </div>
        </div>
      )
    }
    notFound()
  }

  const stats = statsResult.value
  const history = historyResult.status === 'fulfilled' ? historyResult.value : null
  const prediction = predictionResult.status === 'fulfilled' ? predictionResult.value : null
  const steamUrl = stats.appid ? `https://store.steampowered.com/app/${stats.appid}` : null

  return (
    <div className="min-h-screen bg-steam-bg">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-20">

        <Link href="/" className="inline-flex items-center gap-2 text-steam-subtle text-sm hover:text-steam-text transition-colors mt-6 mb-8 font-mono">
          <ArrowLeft size={14} /> Back to search
        </Link>

        {/* Title */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-steam-text leading-tight">
              {stats.title}
            </h1>
            {stats.appid && (
              <p className="text-steam-subtle text-sm font-mono mt-1">Steam App ID: {stats.appid}</p>
            )}
          </div>
          {steamUrl && (
            <a href={steamUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 glass rounded-lg text-steam-subtle hover:text-steam-text text-xs font-mono transition-colors flex-shrink-0">
              <ExternalLink size={12} /> Steam
            </a>
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: prediction + stats */}
          <div className="lg:col-span-1 space-y-6">
            {prediction
              ? <PredictionBadge data={prediction} />
              : (
                <div className="glass rounded-2xl p-6 text-center space-y-3">
                  <BarChart3 size={32} className="text-steam-subtle mx-auto" />
                  <p className="text-steam-subtle text-sm">
                    {predictionResult.status === 'rejected'
                      ? 'Need more price history for a prediction.'
                      : 'Generating prediction...'}
                  </p>
                </div>
              )
            }

            {stats.stats && (
              <div className="space-y-3">
                <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest">Price Stats</p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="All-time low"  value={formatPrice(stats.stats.min_price)} />
                  <StatCard label="All-time high" value={formatPrice(stats.stats.max_price)} />
                  <StatCard label="Average price" value={formatPrice(stats.stats.avg_price)} />
                  <StatCard label="Max discount"  value={`${stats.stats.max_discount ?? 0}%`} />
                  <StatCard label="Avg on-sale"   value={`${stats.stats.avg_discount_when_on_sale?.toFixed(1) ?? '—'}%`} />
                  <StatCard label="Data points"   value={stats.stats.total_records?.toLocaleString() ?? '—'} />
                </div>
                {stats.stats.first_seen && (
                  <div className="glass rounded-xl px-4 py-3 text-xs text-steam-subtle font-mono">
                    Tracked since <span className="text-steam-text">{formatDate(stats.stats.first_seen)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: charts */}
          <div className="lg:col-span-2 space-y-6">
            {history
              ? <PriceChart history={history.history} stats={stats.stats} />
              : (
                <div className="glass rounded-2xl p-8 text-center text-steam-subtle">
                  <p className="text-sm">No price history available yet.</p>
                </div>
              )
            }
            {stats.seasonal_patterns?.length > 0 && (
              <SeasonalChart patterns={stats.seasonal_patterns} />
            )}
            <div className="glass rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-steam-text text-sm font-semibold">Refresh price data</p>
                <p className="text-steam-subtle text-xs font-mono mt-0.5">
                  Last updated: {stats.stats?.last_seen ? formatDate(stats.stats.last_seen) : '—'}
                </p>
              </div>
              {stats.appid && (
                <code className="text-steam-subtle/60 text-xs font-mono">
                  POST /sync/game/{stats.appid}
                </code>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}