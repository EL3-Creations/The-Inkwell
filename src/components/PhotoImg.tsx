import { useData } from '../lib/data'
import { photoUrl } from '../lib/supabase'

/** Cover photo for a design, or a dotted placeholder. */
export default function PhotoImg({ designId, className = '' }: { designId: string; className?: string }) {
  const { coverPhoto } = useData()
  const p = coverPhoto(designId)
  if (!p) return <div className={`dots-light flex items-center justify-center text-neutral-400 ${className}`}>No photo</div>
  return <img src={photoUrl(p.storage_path)} alt="" loading="lazy" className={`object-cover ${className}`} />
}
