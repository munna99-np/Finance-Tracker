import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogPortal, DialogOverlay } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'
import { getCurrency, setCurrency, getLocale, setLocale, getTheme, setTheme, notifySettingsChanged } from '../../lib/settings'
import { IconSettings } from '../../components/icons'
import CloseOutlined from '@mui/icons-material/CloseOutlined'

export default function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [currency, setCur] = useState('INR')
  const [locale, setLoc] = useState('en-IN')
  const [theme, setTh] = useState<'light' | 'dark'>('light')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCur(getCurrency())
    setLoc(getLocale())
    setTh(getTheme())
  }, [open])

  const savePrefs = () => {
    setCurrency(currency.trim().toUpperCase())
    setLocale(locale.trim())
    setTheme(theme)
    notifySettingsChanged()
    toast.success('Preferences saved')
  }

  const updatePassword = async () => {
    if (!pw1 || pw1.length < 6) return toast.error('Password must be at least 6 chars')
    if (pw1 !== pw2) return toast.error('Passwords do not match')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    setPw1(''); setPw2('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <IconSettings size={18} />
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
        <DialogContent className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card text-card-foreground border rounded-md p-4 shadow-xl w-[520px]">
          <div className="flex items-center justify-between">
            <DialogTitle>Settings</DialogTitle>
            <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted/50" aria-label="Close" onClick={() => setOpen(false)}>
              <CloseOutlined fontSize="small" />
            </button>
          </div>
        <div className="space-y-4 mt-2">
          <section className="space-y-2">
            <div className="font-medium">Preferences</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Currency</label>
                <select className="h-9 w-full border rounded-md px-2" value={currency} onChange={(e) => setCur(e.target.value)}>
                  {['INR','USD','EUR','NPR','GBP','AUD','CAD'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Locale</label>
                <select className="h-9 w-full border rounded-md px-2" value={locale} onChange={(e) => setLoc(e.target.value)}>
                  {['en-IN','en-US','en-GB','ne-NP','hi-IN'].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Theme</label>
                <select className="h-9 w-full border rounded-md px-2" value={theme} onChange={(e) => setTh((e.target.value as any))}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={savePrefs}>Save Preferences</Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="font-medium">Update Password</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">New Password</label>
                <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Confirm Password</label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={updatePassword} disabled={saving}>{saving ? 'Updating…' : 'Update Password'}</Button>
            </div>
          </section>
        </div>
          </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
