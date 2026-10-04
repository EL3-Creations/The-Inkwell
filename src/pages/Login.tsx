import { useState, type FormEvent } from 'react'
import { signIn } from '../lib/api'
import { errMsg } from '../lib/toast'
import { Button, Field, Logo } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(errMsg(err) === 'Invalid login credentials' ? 'Wrong email or password.' : errMsg(err))
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
          <Field label="Email">
            <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <p className="text-center text-xs text-neutral-500">Owners only. Accounts are created in the Supabase dashboard.</p>
        </form>
      </div>
      <div className="dots h-6" />
    </div>
  )
}
