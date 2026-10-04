import { useEffect, useState } from 'react'
import { useData } from '../lib/data'
import { saveSettings, signOut } from '../lib/api'
import { errMsg, useToast } from '../lib/toast'
import { Button, Card, Field, PageHeader, Spinner } from '../components/ui'

export default function Settings({ email }: { email: string }) {
  const { settings, loading, designs } = useData()
  const toast = useToast()
  const [shop, setShop] = useState('')
  const [std, setStd] = useState('')
  const [prem, setPrem] = useState('')
  const [week, setWeek] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!settings) return
    setShop(settings.shop_name)
    setStd(Number(settings.standard_price).toFixed(2))
    setPrem(Number(settings.premium_price).toFixed(2))
    setWeek(settings.week_starts_on)
  }, [settings])

  const usingStd = designs.filter((d) => !d.archived && d.tier === 'standard' && d.price_override == null).length
  const usingPrem = designs.filter((d) => !d.archived && d.tier === 'premium' && d.price_override == null).length

  async function save() {
    setBusy(true)
    try {
      await saveSettings({ shop_name: shop.trim() || 'The Inkwell', standard_price: Number(std) || 0, premium_price: Number(prem) || 0, week_starts_on: week })
      toast('Settings saved')
    } catch (e) { toast(errMsg(e), 'error') } finally { setBusy(false) }
  }

  if (loading || !settings) return <Spinner />
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Settings" />
      <Card className="space-y-4">
        <h2 className="font-brand text-xl font-bold">Prices</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Standard" hint={`${usingStd} designs use this`}>
            <input className="field text-xl font-bold" inputMode="decimal" value={std} onChange={(e) => setStd(e.target.value)} />
          </Field>
          <Field label="Premium" hint={`${usingPrem} designs use this`}>
            <input className="field text-xl font-bold" inputMode="decimal" value={prem} onChange={(e) => setPrem(e.target.value)} />
          </Field>
        </div>
        <p className="text-sm text-neutral-600">Changing a tier price updates every design on that tier that doesn't have its own price. Past sales keep the price they sold at.</p>
        <Field label="Shop name"><input className="field" value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
        <Field label="Week starts on">
          <select className="field" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            <option value={0}>Sunday</option><option value={1}>Monday</option>
          </select>
        </Field>
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
      </Card>

      <Card>
        <h2 className="font-brand text-xl font-bold">Account</h2>
        <p className="mt-1 text-neutral-700">Signed in as <b>{email}</b></p>
        <p className="mt-1 text-sm text-neutral-600">To add or change users, or reset a password, use the Supabase dashboard (see SETUP.md).</p>
        <Button variant="secondary" className="mt-3" onClick={() => signOut()}>Sign out</Button>
      </Card>

      <Card>
        <h2 className="font-brand text-xl font-bold">Add to your phone</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li><b>iPhone (Safari):</b> tap Share, then “Add to Home Screen”.</li>
          <li><b>Android (Chrome):</b> tap the ⋮ menu, then “Add to Home screen” or “Install app”.</li>
        </ul>
      </Card>
    </div>
  )
}
