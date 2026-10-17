import { useState, type FormEvent } from 'react'
import { setNewPassword } from '../lib/api'
import { errMsg } from '../lib/toast'
import { Button, Field, Logo } from '../components/ui'

/** Shown after opening a "reset password" email link: pick a new password, then carry on into the app. */
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setError('Use at least 8 characters.'); return }
    if (pw !== pw2) { setError('The two passwords do not match.'); return }
    setBusy(true); setError(null)
    try {
      await setNewPassword(pw)
      onDone()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="dots h-6" />
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="flex justify-center"><Logo size="lg" /></div>
          <h1 className="text-center font-brand text-4xl">Set a new password</h1>
          <Field label="New password">
            <input id="new-password" className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          </Field>
          <Field label="Type it again">
            <input id="new-password-2" className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </Field>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button>
          <button type="button" onClick={onDone} className="block w-full min-h-10 text-center text-sm font-semibold underline">Skip for now</button>
        </form>
      </div>
      <div className="dots h-6" />
    </div>
  )
}
