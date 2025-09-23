type Member = { name: string; email: string; role: string; color: string }

const MEMBERS: Member[] = [
  { name: 'Chadengle', email: 'coder@theme.com', role: 'Admin', color: '#06B6D4' },
  { name: 'Michael Zenaty', email: 'coder@theme.com', role: 'Support Lead', color: '#6366F1' },
  { name: 'Stillnotdavid', email: 'coder@theme.com', role: 'Designer', color: '#10B981' },
  { name: 'Tomaslau', email: 'coder@theme.com', role: 'Developer', color: '#3B82F6' },
]

function Avatar({ name, color }: { name: string; color: string }) {
  const letter = name.charAt(0).toUpperCase()
  return (
    <div className="h-12 w-12 rounded-full grid place-items-center text-white font-semibold shadow" style={{ background: color }}>
      {letter}
    </div>
  )
}

export default function TeamList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {MEMBERS.map((m) => (
        <div key={m.name} className="rounded-xl border bg-card/90 backdrop-blur-sm p-4 flex items-center gap-3">
          <Avatar name={m.name} color={m.color} />
          <div className="min-w-0">
            <div className="font-medium truncate">{m.name}</div>
            <div className="text-xs text-muted-foreground truncate">{m.email}</div>
            <div className="text-xs mt-1">
              <span className="px-2 py-0.5 rounded-full bg-muted text-foreground/80">{m.role}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
