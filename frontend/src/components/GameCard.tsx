
import Link from 'next/link'
import Image from 'next/image'
import { TrendingDown, Clock, ChevronRight } from 'lucide-react'
import { formatPrice, steamImageUrl, discountBg, timeAgo } from '@/lib/utils'

interface Props {
  id: string
  title: string
  appid?: number | null
  currentPrice?: number | null
  regularPrice?: number | null
  discountPct?: number | null
  minPrice?: number | null
  score?: number | null
  signal?: string | null
  reason?: string | null
  lastSeen?: string | null
  index?: number
}

export default function GameCard({
  id, title, appid, currentPrice, regularPrice, discountPct,
  minPrice, score, signal, reason, lastSeen, index = 0
}: Props) {
  const img = steamImageUrl(appid)
  const hasDeal = (discountPct ?? 0) > 0
  const isNearLow = minPrice != null && currentPrice != null && currentPrice <= minPrice * 1.05

  return (
    <Link
      href={`/game/${id}`}
      className="glass glass-hover rounded-2xl overflow-hidden group block animate-slide-up"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
    >
      {/* Game image */}
      <div className="relative h-32 bg-steam-muted overflow-hidden">
        {img ? (
          <Image
            src={img} alt={title}
            fill className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-steam-muted to-steam-card flex items-center justify-center">
            <span className="text-steam-subtle/40 text-4xl font-display font-bold">
              {title.charAt(0)}
            </span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-steam-card/90 via-transparent to-transparent" />

        {/* Discount badge */}
        {hasDeal && discountPct != null && (
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${discountBg(discountPct)}`}>
            −{discountPct}%
          </div>
        )}

        {/* Near all-time low badge */}
        {isNearLow && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-mono bg-steam-green/20 border border-steam-green/40 text-steam-green flex items-center gap-1">
            <TrendingDown size={10} /> ATL
          </div>
        )}

        {/* Signal badge */}
        {signal && (
          <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
            signal === 'BUY'
              ? 'bg-steam-green/20 border border-steam-green/40 text-steam-green'
              : 'bg-steam-amber/20 border border-steam-amber/40 text-steam-amber'
          }`}>
            {signal}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-steam-text text-sm font-semibold leading-snug line-clamp-2 group-hover:text-steam-cyan transition-colors flex-1">
            {title}
          </h3>
          <ChevronRight size={14} className="text-steam-subtle group-hover:text-steam-cyan transition-colors flex-shrink-0 mt-0.5" />
        </div>

        {/* Price row */}
        {currentPrice !== undefined && currentPrice !== null && (
          <div className="flex items-center gap-2">
            <span className={`font-mono font-bold text-sm ${hasDeal ? 'text-steam-green' : 'text-steam-text'}`}>
              {formatPrice(currentPrice)}
            </span>
            {hasDeal && regularPrice != null && regularPrice !== currentPrice && (
              <span className="text-steam-subtle/60 text-xs font-mono line-through">
                {formatPrice(regularPrice)}
              </span>
            )}
          </div>
        )}

        {/* Score bar */}
        {score != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-steam-subtle font-mono">ML Score</span>
              <span className={`font-mono font-semibold ${score >= 70 ? 'text-steam-green' : score >= 50 ? 'text-steam-amber' : 'text-steam-red'}`}>
                {Math.round(score)}
              </span>
            </div>
            <div className="h-1 bg-steam-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  score >= 70 ? 'bg-steam-green' : score >= 50 ? 'bg-steam-amber' : 'bg-steam-red'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        )}

        {lastSeen && (
          <div className="flex items-center gap-1 text-steam-subtle/60 text-xs font-mono">
            <Clock size={9} />
            {timeAgo(lastSeen)}
          </div>
        )}
      </div>
    </Link>
  )
}