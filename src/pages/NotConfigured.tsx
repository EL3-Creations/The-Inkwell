import { Logo } from '../components/ui'

/** Shown until the two Supabase values are set (in .env locally, or in Vercel's Environment Variables). */
export default function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Logo size="lg" />
      <h1 className="mt-6 text-2xl font-bold">One more setup step</h1>
      <p className="mt-2">The app can't find its database settings yet. Follow <b>SETUP.md</b> in the project folder:</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>In Supabase, open <b>Project Settings → API Keys</b>.</li>
        <li>Copy the <b>Project URL</b> and the <b>Publishable key</b> (or, on older dashboards, the <b>anon public</b> key).</li>
        <li>On your computer: put them in a file named <code>.env</code> (copy <code>.env.example</code>).</li>
        <li>On Vercel: add them under <b>Settings → Environment Variables</b> as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then redeploy.</li>
      </ol>
    </div>
  )
}
