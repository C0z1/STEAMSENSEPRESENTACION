
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Gamepad2, RefreshCw } from 'lucide-react'
import { searchGames, syncByGameId } from '@/lib/api'
import { steamImageUrl } from '@/lib/utils'
import type { SearchResult } from '@/lib/types'

export default function GameSearch() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [open, setOpen]       = useState(false)
  const [error, setError]     = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router     = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (!query.trim() || query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await searchGames(query)
        setResults(data.slice(0, 8))
        setOpen(data.length > 0)
      } catch {
        setError('Backend not connected. Start the FastAPI server.')
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [query])

  const handleSelect = async (game: SearchResult) => {
    setOpen(false)
    setQuery('')
    setSyncing(game.id)
    try {
      await syncByGameId(game.id)
    } catch {
      // Even if sync fails, try navigating — maybe it's already in DB
    } finally {
      setSyncing(null)
    }
    router.push(`/game/${game.id}`)
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto">
      {/* Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-steam-subtle">
          {loading
            ? <Loader2 size={18} className="animate-spin text-steam-cyan" />
            : <Search size={18} />
          }
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search any Steam game..."
          className="
            w-full pl-12 pr-4 py-4
            bg-steam-card border border-steam-border
            rounded-xl text-steam-text placeholder-steam-subtle
            font-body text-base
            focus:outline-none focus:border-steam-cyan focus:ring-1 focus:ring-steam-cyan/30
            transition-all duration-200
          "
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-steam-subtle hover:text-steam-text transition-colors"
          >✕</button>
        )}
      </div>

      {/* Syncing overlay */}
      {syncing && (
        <div className="mt-2 px-4 py-2.5 bg-steam-cyan/10 border border-steam-cyan/20 rounded-lg flex items-center gap-2 text-steam-cyan text-sm">
          <RefreshCw size={13} className="animate-spin" />
          Loading price data...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 px-4 py-2 bg-steam-red/10 border border-steam-red/20 rounded-lg text-steam-red text-sm">
          {error}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && !syncing && (
        <div className="
          absolute z-50 w-full mt-4
          bg-steam-card border border-steam-border
          rounded-xl overflow-y-auto max-h-72
          shadow-2xl shadow-black/50
          animate-fade-in
        ">
          {results.map((game) => {
            // ITAD search results no traen appid directamente,
            // pero el slug a veces contiene el nombre que podemos usar para el fallback.
            // Si en el futuro el backend devuelve appid en search, esto lo tomará automáticamente.
            const appid = (game as any).appid ?? null
            const img   = steamImageUrl(appid, 'capsule')

            return (
              <button
                key={game.id}
                onClick={() => handleSelect(game)}
                className="
                  w-full flex items-center gap-3 px-3 py-2.5
                  hover:bg-steam-muted
                  border-b border-steam-border last:border-0
                  transition-colors text-left group
                "
              >
                {/* Thumbnail */}
                <div className="w-16 h-9 rounded-lg overflow-hidden bg-steam-muted flex-shrink-0 flex items-center justify-center">
                  {img ? (
                    <img
                      src={img}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Gamepad2 size={14} className="text-steam-subtle group-hover:text-steam-cyan transition-colors" />
                  )}
                </div>

                {/* Title + type */}
                <div className="flex-1 min-w-0">
                  <div className="text-steam-text text-sm font-medium truncate group-hover:text-steam-cyan transition-colors">
                    {game.title}
                  </div>
                  {game.type && (
                    <div className="text-steam-subtle text-xs capitalize">{game.type}</div>
                  )}
                </div>

                <div className="text-steam-subtle text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  →
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}