
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Library, Heart, Sparkles, RefreshCw, Clock, TrendingDown,
  Zap, ChevronRight, Star, Database, AlertTriangle,
  Lock, CheckCircle, ExternalLink
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import GameCard from '@/components/GameCard'
import ProfileInsights from '@/components/ProfileInsights'
import PriceAlertButton from '../../components/PriceAlertButton'
import { getToken, getUserFromStorage, type SteamUser } from '@/lib/auth'
import { getLibrary, getWishlist, getRecommendations, syncLibrary } from '@/lib/api'
import { formatPrice, formatDate, timeAgo, steamImageUrl } from '@/lib/utils'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Tab = 'library' | 'wishlist' | 'recs'

// ── Setup Guide ───────────────────────────────────────────────────────────────

function SetupGuide() {
  const [step1Loading, setStep1Loading] = useState(false)
  const [step2Loading, setStep2Loading] = useState(false)
  const [step1Done, setStep1Done]       = useState(false)
  const [step2Done, setStep2Done]       = useState(false)

  const handleSyncTop = async () => {
    setStep1Loading(true)
    try {
      await fetch(`${BASE}/sync/top?top_n=100`, { method: 'POST' })
      setStep1Done(true)
    } catch { } finally { setStep1Loading(false) }
  }

  const handleGenPredictions = async () => {
    setStep2Loading(true)
    try {
      await fetch(`${BASE}/sync/predictions?limit=200`, { method: 'POST' })
      setStep2Done(true)
    } catch { } finally { setStep2Loading(false) }
  }

  return (
    <div className="glass rounded-2xl p-6 border border-steam-amber/20 bg-steam-amber/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-steam-amber/20 flex items-center justify-center flex-shrink-0">
          <Zap size={15} className="text-steam-amber" />
        </div>
        <div>
          <p className="text-steam-text text-sm font-semibold">First-time setup — populate the database</p>
          <p className="text-steam-subtle text-xs mt-0.5">Run these steps once to get BUY signals and recommendations working.</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-4 glass rounded-xl">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${step1Done ? 'bg-steam-green/20 text-steam-green' : 'bg-steam-muted text-steam-subtle'}`}>
            {step1Done ? <CheckCircle size={14} /> : '1'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-steam-text text-sm font-semibold">Sync top 100 games</p>
            <p className="text-steam-subtle text-xs mt-0.5 leading-relaxed">
              Downloads price history from IsThereAnyDeal for the 100 most popular Steam games. Runs in background (~1–2 min).
            </p>
          </div>
          <button
            onClick={handleSyncTop}
            disabled={step1Loading || step1Done}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-60 ${step1Done ? 'bg-steam-green/10 text-steam-green border border-steam-green/20' : 'bg-steam-cyan/10 border border-steam-cyan/20 text-steam-cyan hover:bg-steam-cyan/20'}`}
          >
            {step1Loading && <RefreshCw size={11} className="animate-spin" />}
            {step1Done ? 'Started ✓' : 'Run Sync'}
          </button>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-4 glass rounded-xl">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${step2Done ? 'bg-steam-green/20 text-steam-green' : 'bg-steam-muted text-steam-subtle'}`}>
            {step2Done ? <CheckCircle size={14} /> : '2'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-steam-text text-sm font-semibold">Generate ML predictions</p>
            <p className="text-steam-subtle text-xs mt-0.5 leading-relaxed">
              Runs the BUY/WAIT model on all synced games. Do this after step 1 finishes.
            </p>
          </div>
          <button
            onClick={handleGenPredictions}
            disabled={step2Loading || step2Done}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-60 ${step2Done ? 'bg-steam-green/10 text-steam-green border border-steam-green/20' : 'bg-steam-cyan/10 border border-steam-cyan/20 text-steam-cyan hover:bg-steam-cyan/20'}`}
          >
            {step2Loading && <RefreshCw size={11} className="animate-spin" />}
            {step2Done ? 'Started ✓' : 'Generate'}
          </button>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-4 p-4 glass rounded-xl opacity-70">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 bg-steam-muted text-steam-subtle">3</div>
          <div className="flex-1 min-w-0">
            <p className="text-steam-text text-sm font-semibold">Refresh the page after ~2 min</p>
            <p className="text-steam-subtle text-xs mt-0.5 leading-relaxed">
              Come back after the background jobs finish. You'll see BUY signals, deals, and recommendations.
              You can also search any game manually — it auto-syncs price data on click.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Library tab ───────────────────────────────────────────────────────────────

function LibraryTab({ token }: { token: string }) {
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getLibrary(token)
      setData(d)
    } catch { } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncLibrary(token)
      await new Promise(r => setTimeout(r, 1500))
      const d = await getLibrary(token, true)
      setData(d)
    } catch { } finally { setSyncing(false) }
  }

  if (loading) return <LoadingSkeleton />

  const stats   = data?.stats || {}
  const games   = data?.games || []
  const tracked = games.filter((g: any) => g.game_id)

  return (
    <div className="space-y-6">

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Games',   value: stats.total_games   || 0,         icon: Library  },
          { label: 'Hours Played',  value: `${stats.total_hours || 0}h`,     icon: Clock    },
          { label: 'Tracked in DB', value: stats.tracked_games || 0,         icon: Database },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-4 text-center">
            <Icon size={18} className="text-steam-cyan mx-auto mb-2" />
            <p className="font-display font-bold text-xl text-steam-text">{value}</p>
            <p className="text-steam-subtle text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-mono text-steam-subtle hover:text-steam-text transition-all disabled:opacity-50">
          <RefreshCw size={14} className={syncing ? 'animate-spin text-steam-cyan' : ''} />
          {syncing ? 'Syncing...' : 'Sync with Steam'}
        </button>
        <button onClick={() => setShowSetup(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-mono transition-all ${showSetup ? 'text-steam-amber border-steam-amber/30' : 'text-steam-subtle hover:text-steam-text'}`}>
          <Zap size={14} />
          Setup Guide
        </button>
      </div>

      {showSetup && <SetupGuide />}

      {/* ── Warning: importado pero sin datos ────────────────────────────────── */}
      {games.length > 0 && tracked.length === 0 && (
        <div className="glass rounded-xl px-5 py-4 border border-steam-amber/20 bg-steam-amber/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={15} className="text-steam-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-steam-amber text-sm font-semibold">Library imported — no price data yet</p>
              <p className="text-steam-subtle text-xs mt-1 leading-relaxed">
                Your {games.length} games are saved, but none have price history in the database.
                Use the <button onClick={() => setShowSetup(true)} className="text-steam-cyan underline">Setup Guide</button> above to populate it, or search individual games.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Insights ─────────────────────────────────────────────────── */}
      {games.length > 0 && (
        <ProfileInsights games={games} />
      )}

      {/* ── Games list ───────────────────────────────────────────────────────── */}
      {games.length === 0 ? (
        <EmptyState msg="No library data yet. Click 'Sync with Steam' to import your games. Make sure your Steam profile is public." icon={Library} />
      ) : (
        <div className="space-y-2">
          <h3 className="text-steam-text text-sm font-semibold pt-2">All Games</h3>
          {games.map((g: any) => (
            <div key={g.appid}
              className="glass glass-hover rounded-xl flex items-center gap-4 px-4 py-3 group">

              {/* Image */}
              <div className="w-16 h-9 rounded-lg overflow-hidden bg-steam-muted flex-shrink-0">
                {steamImageUrl(g.appid) ? (
                  <img src={steamImageUrl(g.appid)!} alt={g.game_title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-steam-muted" />
                )}
              </div>

              {/* Title + playtime */}
              <div className="flex-1 min-w-0">
                <p className="text-steam-text text-sm font-semibold truncate">{g.game_title}</p>
                <p className="text-steam-subtle text-xs font-mono">
                  {g.playtime_mins > 0
                    ? `${Math.round(g.playtime_mins / 60)}h played`
                    : 'Never played'}
                  {g.last_played && ` · last ${timeAgo(g.last_played)}`}
                </p>
              </div>

              {/* Price info */}
              {g.game_id ? (
                <div className="text-right flex-shrink-0">
                  <p className="text-steam-subtle text-xs font-mono">avg price</p>
                  <p className="text-steam-text text-sm font-mono font-semibold">{formatPrice(g.avg_price)}</p>
                </div>
              ) : (
                <span className="text-steam-subtle/40 text-xs font-mono flex-shrink-0">no data</span>
              )}

              {/* Link */}
              {g.game_id && (
                <Link href={`/game/${g.game_id}`}
                  className="flex-shrink-0 text-steam-subtle hover:text-steam-cyan transition-colors opacity-0 group-hover:opacity-100">
                  <ChevronRight size={16} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Wishlist tab ──────────────────────────────────────────────────────────────

function WishlistTab({ token }: { token: string }) {
  const [data, setData]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [syncMeta, setSyncMeta] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      const d = await getWishlist(token)
      setData(d.wishlist || [])
    } catch { } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMeta(null)
    try {
      const d = await getWishlist(token, true)
      setData(d.wishlist || [])
      if (d.sync_meta) setSyncMeta(d.sync_meta)
    } catch { } finally { setSyncing(false) }
  }

  if (loading) return <LoadingSkeleton />

  const alerts = data.filter(g => g.discount_pct > 0 || g.signal === 'BUY')

  return (
    <div className="space-y-6">

      {/* Sync feedback */}
      {syncMeta && (
        <div className={`glass rounded-xl px-5 py-4 border ${
          syncMeta.private_profile
            ? 'border-red-500/30 bg-red-500/5'
            : syncMeta.error
            ? 'border-steam-amber/20 bg-steam-amber/5'
            : 'border-steam-green/20 bg-steam-green/5'
        }`}>
          <div className="flex items-start gap-3">
            {syncMeta.private_profile ? (
              <Lock size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            ) : syncMeta.error ? (
              <AlertTriangle size={15} className="text-steam-amber flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle size={15} className="text-steam-green flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {syncMeta.private_profile ? (
                <>
                  <p className="text-red-400 text-sm font-semibold">Wishlist is private</p>
                  <p className="text-steam-subtle text-xs mt-1 leading-relaxed">
                    Go to Steam → your Profile → Edit Profile → Privacy Settings
                    → set <span className="text-steam-text font-semibold">"Game details"</span> to <span className="text-steam-text font-semibold">Public</span>.
                  </p>
                  <a href="https://store.steampowered.com/account/communityoptions"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-mono text-steam-cyan hover:underline">
                    Open Steam Privacy Settings <ExternalLink size={10} />
                  </a>
                </>
              ) : syncMeta.error ? (
                <>
                  <p className="text-steam-amber text-sm font-semibold">Sync issue</p>
                  <p className="text-steam-subtle text-xs mt-1">{syncMeta.error}</p>
                </>
              ) : (
                <>
                  <p className="text-steam-green text-sm font-semibold">
                    Wishlist synced — {syncMeta.items_found} items found
                  </p>
                  <p className="text-steam-subtle text-xs mt-1">
                    {syncMeta.items_imported} items imported. Price data loading in background.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <div className="glass rounded-xl px-5 py-4 border border-steam-amber/20 bg-steam-amber/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-steam-amber" />
            <p className="text-steam-amber text-sm font-semibold">
              {alerts.length} wishlist item{alerts.length > 1 ? 's' : ''} worth checking
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(g => (
              <Link key={g.appid} href={g.game_id ? `/game/${g.game_id}` : '#'}
                className="text-xs font-mono bg-steam-muted px-3 py-1.5 rounded-lg text-steam-text hover:text-steam-cyan transition-colors">
                {g.game_title} {g.discount_pct > 0 && `−${g.discount_pct}%`}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-mono text-steam-subtle hover:text-steam-text disabled:opacity-50 transition-all">
          <RefreshCw size={14} className={syncing ? 'animate-spin text-steam-cyan' : ''} />
          {syncing ? 'Syncing...' : 'Sync wishlist'}
        </button>
        {/* Alertas de precio via Notifications API */}
        {data.length > 0 && <PriceAlertButton wishlist={data} />}
      </div>

      {data.length === 0 ? (
        <EmptyState msg="No wishlist data. Click 'Sync wishlist' to import from Steam. Make sure your Steam profile privacy is set to Public." icon={Heart} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map((g: any) => {
            const isOnSale = g.discount_pct > 0
            const isBuy    = g.signal === 'BUY'
            const isAtLow  = g.current_price > 0 && g.all_time_low > 0
                             && g.current_price <= g.all_time_low * 1.05
            return (
              <div key={g.appid} className={`glass glass-hover rounded-xl overflow-hidden group ${
                isBuy ? 'border-steam-green/20' : isOnSale ? 'border-steam-amber/20' : ''
              }`}>
                <div className="flex gap-3 p-4">
                  <div className="w-20 h-11 rounded-lg overflow-hidden bg-steam-muted flex-shrink-0">
                    {steamImageUrl(g.appid) && (
                      <img src={steamImageUrl(g.appid)!} alt={g.game_title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-steam-text text-sm font-semibold truncate">{g.game_title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {g.current_price > 0 && (
                        <span className={`font-mono text-sm font-bold ${isOnSale ? 'text-steam-green' : 'text-steam-text'}`}>
                          {formatPrice(g.current_price)}
                        </span>
                      )}
                      {isOnSale && (
                        <span className="text-xs font-mono bg-steam-green/15 text-steam-green px-1.5 py-0.5 rounded">
                          −{g.discount_pct}%
                        </span>
                      )}
                      {isAtLow && (
                        <span className="text-xs font-mono bg-steam-cyan/10 text-steam-cyan px-1.5 py-0.5 rounded">ATL</span>
                      )}
                      {isBuy && (
                        <span className="text-xs font-mono bg-steam-green/10 text-steam-green px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Zap size={9} /> BUY
                        </span>
                      )}
                    </div>
                    {g.all_time_low > 0 && (
                      <p className="text-steam-subtle text-xs font-mono mt-1">
                        ATL {formatPrice(g.all_time_low)}
                      </p>
                    )}
                  </div>
                  {g.game_id && (
                    <Link href={`/game/${g.game_id}`}
                      className="flex-shrink-0 text-steam-subtle hover:text-steam-cyan opacity-0 group-hover:opacity-100 transition-all self-center">
                      <ChevronRight size={16} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Recommendations tab ───────────────────────────────────────────────────────

function RecsTab({ token }: { token: string }) {
  const [recs, setRecs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecommendations(token, 24)
      .then(d => setRecs(d.recommendations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <LoadingSkeleton />

  if (!recs.length) return (
    <div className="space-y-4">
      <EmptyState
        msg="No recommendations yet. Sync your library and populate the database so the model can generate BUY signals."
        icon={Sparkles}
      />
      <div className="glass rounded-xl px-5 py-4 border border-steam-cyan/20">
        <p className="text-steam-cyan text-sm font-semibold flex items-center gap-2 mb-3">
          <Zap size={13} /> How to get recommendations
        </p>
        <ol className="text-steam-subtle text-xs space-y-2 list-decimal list-inside leading-relaxed">
          <li>Go to <span className="text-steam-text">Library</span> tab → click <span className="text-steam-text">"Setup Guide"</span></li>
          <li>Run <span className="text-steam-text">"Run Sync"</span> to download price history for 100 games</li>
          <li>Run <span className="text-steam-text">"Generate"</span> to create BUY/WAIT predictions</li>
          <li>Come back here after ~2 min — you'll see games you don't own worth buying</li>
        </ol>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="text-steam-subtle text-sm">
        Games you <span className="text-steam-text">don't own</span> that our ML model says are worth buying right now.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {recs.map((r: any, i: number) => (
          <GameCard key={r.id} id={r.id} title={r.title} appid={r.appid}
            currentPrice={r.current_price} discountPct={r.discount_pct}
            score={r.score} signal={r.signal} minPrice={r.min_price} index={i} />
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass rounded-xl h-16 animate-pulse shimmer" />
      ))}
    </div>
  )
}

function EmptyState({ msg, icon: Icon }: { msg: string; icon: any }) {
  return (
    <div className="text-center py-16 space-y-3">
      <Icon size={32} className="text-steam-subtle/40 mx-auto" />
      <p className="text-steam-subtle text-sm max-w-sm mx-auto">{msg}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [user, setUser]   = useState<SteamUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tab, setTab]     = useState<Tab>('library')

  useEffect(() => {
    // Handle token from Steam callback
    const urlToken = searchParams.get('token')
    if (urlToken) {
      localStorage.setItem('steamsense_token', urlToken)
      router.replace('/dashboard')
    }

    const t = getToken()
    const u = getUserFromStorage()
    setToken(t)
    setUser(u)

    // Tab from URL
    const tabParam = searchParams.get('tab') as Tab | null
    if (tabParam && ['library', 'wishlist', 'recs'].includes(tabParam)) {
      setTab(tabParam)
    }
  }, [searchParams, router])

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'library',  label: 'Library',         icon: Library  },
    { key: 'wishlist', label: 'Wishlist',         icon: Heart    },
    { key: 'recs',     label: 'Recommendations',  icon: Sparkles },
  ]

  return (
    <div className="min-h-screen bg-steam-bg">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8">
          {user && (
            <div className="flex items-center gap-4 mb-6">
              {user.avatar_url && (
                <Image src={user.avatar_url} alt={user.display_name}
                  width={48} height={48} className="rounded-full" unoptimized />
              )}
              <div>
                <h1 className="font-display font-bold text-2xl text-steam-text">{user.display_name}</h1>
                <p className="text-steam-subtle text-xs font-mono">Steam ID: {user.steam_id}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono transition-all ${
                  tab === key
                    ? 'bg-steam-cyan/10 border border-steam-cyan/30 text-steam-cyan'
                    : 'glass text-steam-subtle hover:text-steam-text'
                }`}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!token ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-steam-subtle">Please sign in with Steam to view your dashboard.</p>
            <a href={`${BASE}/auth/steam`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-steam-cyan/10 border border-steam-cyan/20 text-steam-cyan rounded-xl text-sm font-mono hover:bg-steam-cyan/20 transition-all">
              Sign in with Steam
            </a>
          </div>
        ) : (
          <>
            {tab === 'library'  && <LibraryTab  token={token} />}
            {tab === 'wishlist' && <WishlistTab token={token} />}
            {tab === 'recs'     && <RecsTab     token={token} />}
          </>
        )}
      </div>
    </div>
  )
}