
import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return '—'
  if (usd === 0) return 'FREE'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(usd)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function steamImageUrl(appid: number | undefined | null, type: 'header' | 'capsule' = 'header'): string | null {
  if (!appid) return null
  if (type === 'header') return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`
}

export function discountColor(pct: number): string {
  if (pct >= 75) return 'text-steam-green'
  if (pct >= 50) return 'text-emerald-400'
  if (pct >= 25) return 'text-steam-amber'
  return 'text-steam-subtle'
}

export function discountBg(pct: number): string {
  if (pct >= 75) return 'bg-steam-green/10 border-steam-green/30 text-steam-green'
  if (pct >= 50) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
  if (pct >= 25) return 'bg-steam-amber/10 border-steam-amber/30 text-steam-amber'
  return 'bg-steam-muted border-steam-border text-steam-subtle'
}