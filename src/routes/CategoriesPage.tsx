import { useMemo, useState } from 'react'
import { useCategories } from '../hooks/useCategories'
import ScopeSelect from '../components/fields/ScopeSelect'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import { IconCategories } from '../components/icons'

type EditState = { id: string; name: string; parent_id: string | null } | null

export default function CategoriesPage() {
  const [scope, setScope] = useState<'personal' | 'work'>('personal')
  const { data, error, refetch } = useCategories(scope)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EditState>(null)

  const parents = useMemo(() => data.filter((c) => c.scope === scope), [data, scope])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((c) => c.name.toLowerCase().includes(q))
  }, [data, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <IconCategories size={18} className="text-primary" /> Categories
        </h1>
        <div className="flex items-center gap-2">
          <Input className="h-9 w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="w-40">
            <ScopeSelect value={scope} onValueChange={(v) => { setScope(v); setParentId(''); }} />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              const defaults =
                scope === 'personal'
                  ? ['lodging/fooding', 'rent', 'utilities', 'daily expenses', 'bike', 'entertainment', 'subscriptions']
                  : ['loan', 'sapati', 'bills', 'salary']
              const rows = defaults.map((name) => ({ name, scope }))
              const { error } = await supabase
                .from('categories')
                .upsert(rows as any, { onConflict: 'owner,scope,name', ignoreDuplicates: true })
              if (error) return toast.error(error.message)
              toast.success('Default categories ensured')
              await refetch()
            }}
          >
            Seed Defaults
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="border rounded-md p-3 space-y-2">
        <div className="font-medium">Add Category</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="text-sm">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. groceries" />
          </div>
          <div>
            <label className="text-sm">Parent (optional)</label>
            <select className="h-9 w-full border rounded-md px-2" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">No parent</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                const n = name.trim()
                if (!n) return toast.error('Name is required')
                const payload: any = { name: n, scope }
                if (parentId) payload.parent_id = parentId
                const { error } = await supabase.from('categories').insert(payload)
                if (error) return toast.error(error.message)
                toast.success('Category added')
                setName('')
                setParentId('')
                await refetch()
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Parent</th>
              <th className="text-left p-2">Scope</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isEditing = editing?.id === c.id
              const parentName = c.parent_id ? data.find((x) => x.id === c.parent_id)?.name ?? '-' : '-'
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    {isEditing ? (
                      <Input
                        value={editing?.name ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <select
                        className="h-9 w-full border rounded-md px-2"
                        value={editing?.parent_id ?? ''}
                        onChange={(e) => setEditing((prev) => prev ? { ...prev, parent_id: e.target.value || null } : prev)}
                      >
                        <option value="">No parent</option>
                        {parents.filter((p) => p.id !== c.id).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      parentName
                    )}
                  </td>
                  <td className="p-2">{c.scope}</td>
                  <td className="p-2 text-right space-x-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const payload: any = { name: (editing?.name ?? '').trim() }
                            if (!payload.name) return toast.error('Name is required')
                            payload.parent_id = editing?.parent_id ?? null
                            const { error } = await supabase.from('categories').update(payload).eq('id', c.id)
                            if (error) return toast.error(error.message)
                            toast.success('Category updated')
                            setEditing(null)
                            await refetch()
                          }}
                        >
                          Save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditing({ id: c.id, name: c.name, parent_id: c.parent_id ?? null })}>Edit</Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            const { error } = await supabase.from('categories').delete().eq('id', c.id)
                            if (error) {
                              if (/foreign key|violates/.test(error.message)) {
                                toast.error('Cannot delete: in use by children or transactions')
                              } else {
                                toast.error(error.message)
                              }
                              return
                            }
                            toast.success('Category deleted')
                            await refetch()
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
