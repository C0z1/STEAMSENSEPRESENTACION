
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Gamepad2, Activity, LogOut, User, Library, Heart, Sparkles, Sun, Moon } from 'lucide-react'
import { getUserFromStorage, clearToken, type SteamUser } from '@/lib/auth'
import { steamLoginUrl } from '@/lib/api'

// ── Theme hook ────────────────────────────────────────────────────────────────

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Leer preferencia guardada o usar dark por defecto
    const saved = localStorage.getItem('steamsense_theme') as 'dark' | 'light' | null
    const initial = saved ?? 'dark'
    setTheme(initial)
    document.documentElement.classList.toggle('light', initial === 'light')
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    localStorage.setItem('steamsense_theme', next)
  }

  return { theme, toggle }
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, toggle } = useTheme()
  const [user, setUser]     = useState<SteamUser | null>(null)
  const [menuOpen, setMenu] = useState(false)

  useEffect(() => {
    setUser(getUserFromStorage())
  }, [pathname])

  const logout = () => {
    clearToken()
    setUser(null)
    router.push('/')
  }

  const navLinks = [
    { href: '/',        label: 'Search'    },
    { href: '/explore', label: 'Explore'   },
    ...(user ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-steam-border/50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-steam-cyan/10 border border-steam-cyan/20 flex items-center justify-center group-hover:bg-steam-cyan/20 transition-colors">
            <Gamepad2 size={14} className="text-steam-cyan" />
          </div>
          <span className="font-display font-bold text-steam-text text-sm tracking-wide">
            Steam<span className="text-steam-cyan">Sense</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  active
                    ? 'bg-steam-cyan/10 text-steam-cyan'
                    : 'text-steam-subtle hover:text-steam-text hover:bg-steam-muted'
                }`}>
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right: status + theme toggle + auth */}
        <div className="flex items-center gap-3">

          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-steam-subtle text-xs font-mono">
            <Activity size={10} className="text-steam-green" />
            <span className="text-steam-green">Live</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 flex items-center justify-center rounded-lg glass hover:border-steam-cyan/30 transition-all group"
          >
            {theme === 'dark' ? (
              <Sun size={14} className="text-steam-subtle group-hover:text-steam-amber transition-colors" />
            ) : (
              <Moon size={14} className="text-steam-subtle group-hover:text-steam-cyan transition-colors" />
            )}
          </button>

          {/* Auth */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenu(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 glass rounded-xl hover:border-steam-cyan/30 transition-all"
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.display_name} width={24} height={24}
                    className="rounded-full" unoptimized />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-steam-muted flex items-center justify-center">
                    <User size={12} className="text-steam-subtle" />
                  </div>
                )}
                <span className="text-steam-text text-xs font-mono max-w-[100px] truncate hidden sm:block">
                  {user.display_name}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 glass rounded-xl border border-steam-border overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-steam-border">
                    <p className="text-steam-text text-xs font-semibold">{user.display_name}</p>
                    <p className="text-steam-subtle text-xs font-mono mt-0.5">Steam ID: {user.steam_id.slice(-8)}</p>
                  </div>
                  {[
                    { href: '/dashboard',              icon: Library,  label: 'My Dashboard'    },
                    { href: '/dashboard?tab=wishlist', icon: Heart,    label: 'Wishlist'         },
                    { href: '/dashboard?tab=recs',     icon: Sparkles, label: 'Recommendations' },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href} onClick={() => setMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-steam-subtle text-xs font-mono hover:text-steam-text hover:bg-steam-muted transition-colors">
                      <Icon size={13} /> {label}
                    </Link>
                  ))}
                  <button onClick={logout}
                    className="flex items-center gap-3 px-4 py-2.5 text-steam-red text-xs font-mono hover:bg-steam-red/10 transition-colors w-full border-t border-steam-border">
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href={steamLoginUrl}
              className="flex items-center gap-2 px-3 py-1.5 bg-steam-cyan/10 border border-steam-cyan/20 rounded-xl text-steam-cyan text-xs font-mono hover:bg-steam-cyan/20 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
              </svg>
              Sign in with Steam
            </a>
          )}
        </div>
      </div>

      {/* Close menu on outside click */}
      {menuOpen && <div className="fixed inset-0 z-[-1]" onClick={() => setMenu(false)} />}
    </nav>
  )
}