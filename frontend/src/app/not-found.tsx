
import Link from 'next/link'
import { ArrowLeft, Gamepad2 } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-steam-bg flex items-center justify-center px-6">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-steam-card border border-steam-border flex items-center justify-center">
          <Gamepad2 size={36} className="text-steam-subtle" />
        </div>
        <div>
          <h1 className="font-display font-bold text-4xl text-steam-text">404</h1>
          <p className="text-steam-subtle mt-2">Game not found or not synced yet.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-steam-cyan/10 border border-steam-cyan/20 text-steam-cyan rounded-xl text-sm font-mono hover:bg-steam-cyan/20 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to search
        </Link>
      </div>
    </div>
  )
}