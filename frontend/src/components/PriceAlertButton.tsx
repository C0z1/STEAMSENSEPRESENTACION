
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, BellRing, Check } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface WishlistGame {
  appid: number
  game_title: string
  current_price: number
  discount_pct: number
  all_time_low: number
  signal?: string
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'steamsense_notified'

function getNotified(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function markNotified(appid: number) {
  const n = getNotified()
  n[appid] = Date.now()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(n))
}

function wasRecentlyNotified(appid: number, cooldownHours = 24): boolean {
  const n = getNotified()
  if (!n[appid]) return false
  return Date.now() - n[appid] < cooldownHours * 60 * 60 * 1000
}

// ── Notificación del navegador ────────────────────────────────────────────────

function sendNotification(title: string, body: string, icon?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `steamsense-${title}`, // evita duplicados
    })
  } catch (e) {
    console.warn('Notification error:', e)
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function usePriceAlerts(wishlist: WishlistGame[]) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [alertCount, setAlertCount] = useState(0)

  // Leer permiso actual al montar
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Revisar wishlist cada vez que cambia y disparar notificaciones
  useEffect(() => {
    if (permission !== 'granted' || !wishlist.length) return

    let triggered = 0
    for (const g of wishlist) {
      if (wasRecentlyNotified(g.appid)) continue

      const isAtLow   = g.all_time_low > 0 && g.current_price > 0
                        && g.current_price <= g.all_time_low * 1.05
      const isBigSale = g.discount_pct >= 50
      const isBuy     = g.signal === 'BUY'

      if (isAtLow) {
        sendNotification(
          `🔥 ${g.game_title} — All-Time Low!`,
          `${g.game_title} is at its lowest price ever: $${g.current_price.toFixed(2)}`,
        )
        markNotified(g.appid)
        triggered++
      } else if (isBuy && isBigSale) {
        sendNotification(
          `⚡ BUY Signal: ${g.game_title}`,
          `${g.discount_pct}% off — ML model says this is the right time to buy.`,
        )
        markNotified(g.appid)
        triggered++
      } else if (isBigSale) {
        sendNotification(
          `💰 ${g.game_title} — ${g.discount_pct}% off`,
          `Your wishlist game is on sale for $${g.current_price.toFixed(2)}`,
        )
        markNotified(g.appid)
        triggered++
      }
    }

    if (triggered > 0) setAlertCount(triggered)
  }, [wishlist, permission])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  return { permission, requestPermission, alertCount }
}

// ── Componente botón ──────────────────────────────────────────────────────────

interface Props {
  wishlist: WishlistGame[]
}

export default function PriceAlertButton({ wishlist }: Props) {
  const { permission, requestPermission, alertCount } = usePriceAlerts(wishlist)
  const [clicked, setClicked] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (permission === 'granted') return // ya activado, no hacer nada
    setLoading(true)
    const result = await requestPermission()
    setLoading(false)
    if (result === 'granted') setClicked(true)
  }

  // Notificaciones no soportadas
  if (typeof window !== 'undefined' && !('Notification' in window)) return null

  if (permission === 'denied') return (
    <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-steam-subtle text-xs font-mono opacity-60 cursor-not-allowed">
      <BellOff size={13} />
      Notifications blocked — enable in browser settings
    </div>
  )

  if (permission === 'granted') return (
    <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-steam-green text-xs font-mono border border-steam-green/20">
      <BellRing size={13} />
      Price alerts active
      {alertCount > 0 && (
        <span className="bg-steam-green/20 text-steam-green px-1.5 py-0.5 rounded-full text-xs">
          {alertCount} sent
        </span>
      )}
    </div>
  )

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm font-mono text-steam-subtle hover:text-steam-amber hover:border-steam-amber/30 transition-all disabled:opacity-50"
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border border-steam-subtle border-t-steam-amber rounded-full animate-spin" />
      ) : clicked ? (
        <Check size={13} className="text-steam-green" />
      ) : (
        <Bell size={13} />
      )}
      {clicked ? 'Alerts enabled!' : 'Enable price alerts'}
    </button>
  )
}