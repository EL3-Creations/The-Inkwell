import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { Button } from './ui'
import { copyText } from '../lib/clipboard'
import { useToast } from '../lib/toast'

/**
 * Copies `text()` to the clipboard and says so. If the phone refuses (some
 * browsers do until the page is served over https), it shows the text in a
 * box so it can be selected and copied by hand.
 */
export default function CopyButton({ label, text, done = 'Copied. Paste it into a TikTok message.' }: { label: string; text: () => string; done?: string }) {
  const toast = useToast()
  const [fallback, setFallback] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (fallback) ref.current?.select() }, [fallback])

  async function go() {
    const t = text()
    if (await copyText(t)) toast(done)
    else setFallback(t)
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={go}>{label}</Button>
      {fallback !== null && (
        <Modal open onClose={() => setFallback(null)} title="Copy by hand">
          <p className="mb-2 text-sm text-neutral-600">This phone would not copy automatically. Press and hold the text, choose Select all, then Copy.</p>
          <textarea ref={ref} readOnly rows={8} className="field py-3 text-sm" value={fallback} onFocus={(e) => e.target.select()} />
          <Button className="mt-3 w-full" onClick={() => setFallback(null)}>Done</Button>
        </Modal>
      )}
    </>
  )
}
