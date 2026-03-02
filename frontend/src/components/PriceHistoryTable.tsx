
'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, Filter } from 'lucide-react'
import type { PricePoint } from '@/lib/types'
import { formatDate, formatPrice } from '@/lib/utils'

interface Props { history: PricePoint[] }

type SortKey = 'timestamp' | 'price_usd' | 'cut_pct'
type SortDir = 'asc' | 'desc'

export default function PriceHistoryTable({ history }: Props) {
  const [search, setSearch]   = useState('')
  const [onlySales, setOnlySales] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage]       = useState(0)
  const PER_PAGE = 20

  const sorted = useMemo(() => {
    let rows = [...history]
    if (onlySales) rows = rows.filter(r => r.cut_pct > 0)
    if (search)    rows = rows.filter(r => r.shop_name.toLowerCase().includes(search.toLowerCase()))
    rows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (typeof va === 'string') va = new Date(va).getTime(), vb = new Date(vb as string).getTime()
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return rows
  }, [history, search, onlySales, sortKey, sortDir])

  const pages  = Math.ceil(sorted.length / PER_PAGE)
  const slice  = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp size={12} className="text-steam-cyan" /> : <ChevronDown size={12} className="text-steam-cyan" />)
      : <ChevronDown size={12} className="opacity-30" />

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-steam-border flex-wrap">
        <p className="text-steam-subtle text-xs font-mono uppercase tracking-widest flex-1">
          Price Records <span className="text-steam-text ml-1">{sorted.length}</span>
        </p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steam-subtle" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Filter store..."
            className="bg-steam-muted border border-steam-border rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-steam-text placeholder:text-steam-subtle/50 focus:outline-none focus:border-steam-cyan/40 w-36"
          />
        </div>
        <button
          onClick={() => { setOnlySales(v => !v); setPage(0) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            onlySales
              ? 'bg-steam-green/15 text-steam-green border border-steam-green/30'
              : 'glass text-steam-subtle hover:text-steam-text'
          }`}
        >
          <Filter size={10} /> Sales only
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-steam-border/50">
              {([['timestamp','Date'],['price_usd','Price'],['','Regular'],['cut_pct','Discount'],['','Store']] as const).map(([key, label]) => (
                <th
                  key={label}
                  onClick={() => key ? toggleSort(key as SortKey) : null}
                  className={`text-left px-4 py-2.5 text-steam-subtle font-normal select-none ${key ? 'cursor-pointer hover:text-steam-text' : ''}`}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    {key && <SortIcon k={key as SortKey} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => {
              const hasSale = row.cut_pct > 0
              return (
                <tr
                  key={i}
                  className={`border-b border-steam-border/30 transition-colors hover:bg-steam-muted/30 ${
                    hasSale ? 'bg-steam-green/[0.03]' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-steam-subtle">{formatDate(row.timestamp)}</td>
                  <td className={`px-4 py-2 font-semibold ${hasSale ? 'text-steam-green' : 'text-steam-text'}`}>
                    {formatPrice(row.price_usd)}
                  </td>
                  <td className="px-4 py-2 text-steam-subtle/60 line-through">
                    {row.regular_usd !== row.price_usd ? formatPrice(row.regular_usd) : ''}
                  </td>
                  <td className="px-4 py-2">
                    {hasSale
                      ? <span className="bg-steam-green/15 text-steam-green px-2 py-0.5 rounded text-xs">−{row.cut_pct}%</span>
                      : <span className="text-steam-subtle/40">—</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-steam-subtle">{row.shop_name}</td>
                </tr>
              )
            })}
            {!slice.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-steam-subtle">No records match</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-steam-border/50">
          <span className="text-steam-subtle text-xs font-mono">
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 rounded glass text-steam-subtle text-xs disabled:opacity-30 hover:text-steam-text transition-colors">
              ←
            </button>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              className="px-3 py-1 rounded glass text-steam-subtle text-xs disabled:opacity-30 hover:text-steam-text transition-colors">
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}