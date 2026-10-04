import { Link } from 'react-router-dom'
import { useData } from '../lib/data'
import { signOut } from '../lib/api'
import { Button, PageHeader } from '../components/ui'

/** Mobile-only overflow menu for the screens that don't fit in the bottom tab bar. */
export default function More({ email }: { email: string }) {
  const { sales } = useData()
  const toShip = sales.filter((s) => s.status === 'paid').length
  const items = [
    { to: '/ship', label: 'To ship', sub: toShip ? `${toShip} waiting` : 'Nothing waiting' },
    { to: '/sales', label: 'Sales', sub: 'Full history, add a sale' },
    { to: '/import', label: 'Import / Export', sub: 'CSV in and out' },
    { to: '/settings', label: 'Settings', sub: 'Prices, account' },
  ]
  return (
    <div>
      <PageHeader title="More" />
      <div className="space-y-2">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="flex min-h-16 items-center justify-between rounded-2xl border-2 border-black px-4 hover:bg-neutral-50">
            <div><div className="text-lg font-bold">{i.label}</div><div className="text-sm text-neutral-600">{i.sub}</div></div>
            <span className="text-2xl">›</span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-neutral-500">Signed in as {email}</p>
      <Button variant="secondary" className="mt-2" onClick={() => signOut()}>Sign out</Button>
    </div>
  )
}
