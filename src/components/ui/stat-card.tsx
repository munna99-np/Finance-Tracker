import * as React from 'react'
import { cn } from '../../lib/utils'

type StatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  percent?: number
  icon?: React.ReactNode
  accent?: string // css color string
  className?: string
}

export function StatCard({ title, value, subtitle, percent, icon, accent, className }: StatCardProps) {
  const p = Math.max(0, Math.min(100, Math.round(percent ?? 0)))
  const color = accent || 'hsl(var(--primary))'
  return (
    <div className={cn('rounded-xl border bg-card/90 backdrop-blur-sm p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        {icon && <div className="opacity-90" style={{ color }}>{icon}</div>}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div
          className="relative grid place-items-center h-12 w-12 rounded-full bg-muted"
          aria-label={typeof p === 'number' ? `${p}%` : undefined}
          role="img"
        >
          {/* ring background */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `conic-gradient(${color} ${p * 3.6}deg, rgba(0,0,0,0.08) 0deg)`
          }} />
          <div className="absolute inset-1 rounded-full bg-card" />
          <span className="relative text-[11px] font-semibold text-foreground/80">{p}%</span>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight truncate">{value}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

export default StatCard
