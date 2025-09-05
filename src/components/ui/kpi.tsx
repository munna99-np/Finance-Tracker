import { cn } from '../../lib/utils'

export function KPICard({ title, value, delta, positive = true, icon }: { title: string; value: string; delta?: string; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border bg-card/90 backdrop-blur-sm p-4 flex items-start gap-3 shadow-sm')}>
      {icon && <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight truncate">{value}</div>
        {delta && (
          <div className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            <span>{delta}</span>
          </div>
        )}
      </div>
    </div>
  )
}

