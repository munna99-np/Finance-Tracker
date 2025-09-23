import { formatCurrency } from '../../lib/format'
import type { Account } from '../../types/accounts'

export default function BankCard({ account, onOpen }: { account: Account; onOpen: (a: Account) => void }) {
  const palette = pickPalette(account)
  return (
    <button
      type="button"
      onClick={() => onOpen(account)}
      className="relative overflow-hidden rounded-2xl border shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
      style={{ background: palette.bg }}
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: palette.texture }} />
      <div className="relative p-5 text-white/95">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide opacity-90">{account.kind}</div>
          <div className="text-[10px] px-2 py-0.5 rounded-full bg-white/20">Tap to view</div>
        </div>
        <div className="mt-3 text-xl font-semibold tracking-tight">{account.name}</div>
        <div className="mt-6 flex items-center justify-between text-sm opacity-95">
          <div>
            <div className="opacity-80">Opening</div>
            <div className="font-semibold">{formatCurrency(account.opening_balance)}</div>
          </div>
          <div className="text-right">
            <div className="opacity-80">Status</div>
            <div className="font-semibold">{account.is_active ? 'Active' : 'Inactive'}</div>
          </div>
        </div>
      </div>
    </button>
  )
}

function pickPalette(account: Account) {
  // simple deterministic palette based on name
  const seeds = ['#0ea5e9', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
  const i = Math.abs(hash(account.name)) % seeds.length
  const c = seeds[i]
  return {
    bg: `linear-gradient(135deg, ${shade(c, -10)} 0%, ${shade(c, 15)} 100%)`,
    texture: 'radial-gradient(circle at 20% 0%, rgba(255,255,255,.15) 0 40%, transparent 41%), radial-gradient(circle at 90% 120%, rgba(0,0,0,.15) 0 40%, transparent 41%)',
  }
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return h }
function shade(hex: string, percent: number) {
  const f = parseInt(hex.slice(1), 16)
  const t = percent < 0 ? 0 : 255
  const p = Math.abs(percent) / 100
  const R = f >> 16
  const G = (f >> 8) & 0x00ff
  const B = f & 0x0000ff
  const nr = Math.round((t - R) * p) + R
  const ng = Math.round((t - G) * p) + G
  const nb = Math.round((t - B) * p) + B
  return `#${(0x1000000 + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`
}

