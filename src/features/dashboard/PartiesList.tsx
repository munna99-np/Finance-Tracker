import { useMemo } from 'react'
import { useParties } from '../../hooks/useParties'

const COLORS = ['#06B6D4', '#6366F1', '#10B981', '#3B82F6', '#F59E0B', '#EF4444']

function Avatar({ name, color }: { name: string; color: string }) {
  const letter = (name || '?').charAt(0).toUpperCase()
  return (
    <div className="h-12 w-12 rounded-full grid place-items-center text-white font-semibold shadow" style={{ background: color }}>
      {letter}
    </div>
  )
}

export default function PartiesList() {
  const { data: parties, loading, error } = useParties()
  const items = useMemo(() => parties.slice(0, 4), [parties])

  if (loading) return <div className="text-sm text-muted-foreground">Loading parties…</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (items.length === 0) return <div className="text-sm text-muted-foreground">No parties yet</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((p, i) => (
        <div key={p.id} className="rounded-xl border bg-card/90 backdrop-blur-sm p-4 flex items-center gap-3">
          <Avatar name={p.name} color={COLORS[i % COLORS.length]} />
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            {p.phone && <div className="text-xs text-muted-foreground truncate">{p.phone}</div>}
            <div className="text-xs mt-1">
              <span className="px-2 py-0.5 rounded-full bg-muted text-foreground/80">Party</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

