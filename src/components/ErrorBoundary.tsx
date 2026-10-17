import { Component, type ReactNode } from 'react'

/** If something unexpected breaks, show a reload button instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="font-brand text-4xl">Something went wrong</h1>
        <p className="mt-2 text-neutral-600">Your data is safe in the database. Reload to carry on.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-neutral-100 p-3 text-left text-xs text-neutral-700">{this.state.error.message}</pre>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-14 w-full rounded-xl border-2 border-black bg-black px-5 text-lg font-semibold text-white">Reload</button>
      </div>
    )
  }
}
