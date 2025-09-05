import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useInvCategories, useInvSubcategories } from '../../hooks/useInventory'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import AddCircleOutline from '@mui/icons-material/AddCircleOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import {
  addCategory,
  addSubcategory,
  updateCategory,
  updateSubcategory,
  deleteCategory,
  deleteSubcategory,
} from '../../services/inventoryCategories'

export default function CategoryTree({ onSelect }: { onSelect: (ids: { categoryId?: string; subcategoryId?: string }) => void }) {
  const { data: categories, refetch: refetchCats } = useInvCategories()
  const [activeCat, setActiveCat] = useState<string | undefined>(undefined)
  const { data: subs, refetch: refetchSubs } = useInvSubcategories(activeCat)
  const [catDialog, setCatDialog] = useState(false)
  const [subDialog, setSubDialog] = useState(false)
  const [catName, setCatName] = useState('')
  const [subName, setSubName] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeSub, setActiveSub] = useState<string | undefined>(undefined)
  const [editCatDialog, setEditCatDialog] = useState(false)
  const [editCatName, setEditCatName] = useState('')
  const [editCatId, setEditCatId] = useState<string | undefined>(undefined)
  const [editSubDialog, setEditSubDialog] = useState(false)
  const [editSubName, setEditSubName] = useState('')
  const [editSubId, setEditSubId] = useState<string | undefined>(undefined)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Categories</div>
        <Dialog open={catDialog} onOpenChange={setCatDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><AddCircleOutline className="mr-1" fontSize="small" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="bg-white border rounded-md p-4 shadow-xl w-[400px]">
            <DialogTitle>Add Category</DialogTitle>
            <div className="mt-2 space-y-2">
              <label className="text-sm">Name</label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Electronics" />
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    const n = catName.trim(); if (!n) return toast.error('Name required')
                    try {
                      setSaving(true)
                      const data = await addCategory(n)
                      toast.success('Category added')
                      setCatDialog(false); setCatName('')
                      await refetchCats()
                      setActiveCat(data?.id)
                      onSelect({ categoryId: data?.id, subcategoryId: undefined })
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to add category')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                >{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.id}>
            <div
              className={`w-full px-2 py-1 rounded hover:bg-muted/50 flex items-center justify-between ${activeCat === c.id ? 'bg-primary/10 text-primary' : ''}`}
            >
              <button
                className="flex-1 text-left truncate"
                onClick={() => { setActiveCat(c.id); setActiveSub(undefined); onSelect({ categoryId: c.id, subcategoryId: undefined }) }}
              >
                {c.name}
              </button>
              <div className="flex items-center gap-1">
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeCat === c.id ? 'bg-primary/20 text-primary' : 'bg-muted/70 text-muted-foreground'}`}>{c.subCount}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setEditCatId(c.id); setEditCatName(c.name); setEditCatDialog(true) }}
                  aria-label="Edit category"
                >
                  <EditOutlined fontSize="small" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async (e) => {
                    e.stopPropagation()
                    const ok = window.confirm('Delete this category? Subcategories must be removed first.')
                    if (!ok) return
                    try {
                      await deleteCategory(c.id)
                      toast.success('Category deleted')
                      if (activeCat === c.id) { setActiveCat(undefined); setActiveSub(undefined); onSelect({ categoryId: undefined, subcategoryId: undefined }) }
                      await refetchCats()
                      await refetchSubs()
                    } catch (err: any) {
                      const msg = String(err.message || '')
                      if (/foreign key|violates/i.test(msg)) toast.error('Cannot delete: in use or has subcategories')
                      else toast.error(msg || 'Failed to delete category')
                    }
                  }}
                  aria-label="Delete category"
                >
                  <DeleteOutline fontSize="small" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t pt-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Subcategories</div>
          <Dialog open={subDialog} onOpenChange={setSubDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!activeCat}><AddCircleOutline className="mr-1" fontSize="small" /> Add</Button>
            </DialogTrigger>
            <DialogContent className="bg-white border rounded-md p-4 shadow-xl w-[400px]">
              <DialogTitle>Add Subcategory</DialogTitle>
              <div className="mt-2 space-y-2">
                <label className="text-sm">Name</label>
                <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Mobiles" />
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" onClick={() => setSubDialog(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    const n = subName.trim(); if (!n || !activeCat) return toast.error('Name required')
                    try {
                      setSaving(true)
                      const data = await addSubcategory(activeCat, n)
                      toast.success('Subcategory added')
                      setSubDialog(false); setSubName('')
                      await refetchSubs()
                      onSelect({ categoryId: activeCat, subcategoryId: data?.id })
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to add subcategory')
                    } finally {
                      setSaving(false)
                    }
                  }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {activeCat ? (
          <>
            <ul className="space-y-1">
              {subs.map((s) => (
                <li key={s.id}>
                  <div
                    className={`w-full px-2 py-1 rounded hover:bg-muted/50 flex items-center justify-between ${activeSub === s.id ? 'bg-secondary' : ''}`}
                  >
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => { setActiveSub(s.id); onSelect({ categoryId: activeCat, subcategoryId: s.id }) }}
                    >
                      {s.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground">{s.itemCount}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setEditSubId(s.id); setEditSubName(s.name); setEditSubDialog(true) }}
                        aria-label="Edit subcategory"
                      >
                        <EditOutlined fontSize="small" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const ok = window.confirm('Delete this subcategory? Items must be removed first.')
                          if (!ok) return
                          try {
                            await deleteSubcategory(s.id)
                            toast.success('Subcategory deleted')
                            if (activeSub === s.id) { setActiveSub(undefined); onSelect({ categoryId: activeCat, subcategoryId: undefined }) }
                            await refetchSubs()
                          } catch (err: any) {
                            const msg = String(err.message || '')
                            if (/foreign key|violates/i.test(msg)) toast.error('Cannot delete: in use by items')
                            else toast.error(msg || 'Failed to delete subcategory')
                          }
                        }}
                        aria-label="Delete subcategory"
                      >
                        <DeleteOutline fontSize="small" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {subs.length === 0 && <div className="text-sm text-muted-foreground">No subcategories yet</div>}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Select a category</div>
        )}
      </div>
      {/* Edit Category Dialog */}
      <Dialog open={editCatDialog} onOpenChange={setEditCatDialog}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl w-[400px]">
          <DialogTitle>Edit Category</DialogTitle>
          <div className="mt-2 space-y-2">
            <label className="text-sm">Name</label>
            <Input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setEditCatDialog(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!editCatId) return
                  const n = editCatName.trim(); if (!n) return toast.error('Name required')
                  try {
                    setSaving(true)
                    await updateCategory(editCatId, n)
                    toast.success('Category updated')
                    setEditCatDialog(false)
                    await refetchCats()
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to update category')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              >{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Subcategory Dialog */}
      <Dialog open={editSubDialog} onOpenChange={setEditSubDialog}>
        <DialogContent className="bg-white border rounded-md p-4 shadow-xl w-[400px]">
          <DialogTitle>Edit Subcategory</DialogTitle>
          <div className="mt-2 space-y-2">
            <label className="text-sm">Name</label>
            <Input value={editSubName} onChange={(e) => setEditSubName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setEditSubDialog(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!editSubId) return
                  const n = editSubName.trim(); if (!n) return toast.error('Name required')
                  try {
                    setSaving(true)
                    await updateSubcategory(editSubId, n)
                    toast.success('Subcategory updated')
                    setEditSubDialog(false)
                    await refetchSubs()
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to update subcategory')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              >{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
