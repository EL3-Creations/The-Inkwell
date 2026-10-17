/**
 * Every write to the database goes through this file.
 * Pages call these functions; the DataProvider reloads the changed table
 * straight away (announceChange) and again when realtime echoes it.
 */
import { supabase } from './supabase'
import { announceChange } from './bus'
import type { Channel, Design, DesignPhoto, LiveSession, Sale, SaleStatus, Settings } from './types'
import type { ImportRow } from './csv'
import { compressPhoto, deletePhotoFile, uploadPhoto } from './photos'

function unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error))
  return res.data as T
}

/** Turn database error text into something a person can act on. */
function friendly(e: { message: string; code?: string }): string {
  if (e.code === '23505' || /duplicate key|unique/i.test(e.message)) {
    if (/live_sessions_one_open/.test(e.message)) return 'A Live is already running (probably started on the other phone).'
    if (/designs_active_number/.test(e.message)) return 'That pegboard number is already used by an active design.'
    return 'That already exists.'
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) return 'No connection. Check your signal and try again.'
  return e.message
}

const STALE = 'That sale was already changed on the other phone. The list has been refreshed.'

// ---------- Settings ----------
export async function saveSettings(patch: Partial<Omit<Settings, 'id' | 'updated_at'>>) {
  const row = unwrap(await supabase.from('settings').update(patch).eq('id', 1).select().single<Settings>())
  announceChange('settings')
  return row
}

// ---------- Designs ----------
export type DesignInput = Omit<Design, 'id' | 'created_at' | 'updated_at' | 'archived'>

export async function createDesign(input: DesignInput) {
  const row = unwrap(await supabase.from('designs').insert(input).select().single<Design>())
  announceChange('designs')
  return row
}

export async function updateDesign(id: string, patch: Partial<DesignInput & { archived: boolean }>) {
  const row = unwrap(await supabase.from('designs').update(patch).eq('id', id).select().single<Design>())
  announceChange('designs')
  return row
}

export async function setArchived(id: string, archived: boolean) {
  return updateDesign(id, { archived })
}

export async function deleteDesign(id: string) {
  const { error } = await supabase.from('designs').delete().eq('id', id)
  if (error) throw new Error(friendly(error))
  announceChange('designs')
}

/**
 * Bulk import. Rows whose number matches an active design update it; others are inserted.
 * A blank quantity cell leaves an existing design's stock alone (and gives a new design 1).
 */
export async function importDesigns(rows: ImportRow[], existingActive: Design[]) {
  const byNumber = new Map(existingActive.map((d) => [d.number, d]))
  const inserts: DesignInput[] = []
  let updated = 0
  for (const r of rows) {
    const existing = byNumber.get(r.number)
    if (existing) {
      const { quantity, ...rest } = r
      await updateDesign(existing.id, quantity == null ? rest : { ...rest, quantity })
      updated++
    } else {
      inserts.push({ ...r, quantity: r.quantity ?? 1 })
    }
  }
  let inserted = 0
  // Insert in chunks of 100 to keep each request small.
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100)
    const { error } = await supabase.from('designs').insert(chunk)
    if (error) throw new Error(`${friendly(error)} (${inserted} rows were added before this happened)`)
    inserted += chunk.length
    announceChange('designs')
  }
  return { inserted, updated }
}

// ---------- Photos ----------
export async function addPhoto(design: Design, file: File, sortOrder: number): Promise<DesignPhoto> {
  const small = await compressPhoto(file)
  const path = await uploadPhoto(design.id, small)
  const row = unwrap(
    await supabase
      .from('design_photos')
      .insert({ design_id: design.id, storage_path: path, sort_order: sortOrder })
      .select()
      .single<DesignPhoto>(),
  )
  announceChange('design_photos')
  return row
}

export async function removePhoto(photo: DesignPhoto) {
  const { error } = await supabase.from('design_photos').delete().eq('id', photo.id)
  if (error) throw new Error(friendly(error))
  announceChange('design_photos')
  try { await deletePhotoFile(photo.storage_path) } catch { /* file already gone; ignore */ }
}

/** Make this photo the cover (sort_order 0) and shift the others after it. */
export async function setCoverPhoto(photos: DesignPhoto[], coverId: string) {
  const ordered = [photos.find((p) => p.id === coverId)!, ...photos.filter((p) => p.id !== coverId)]
  await Promise.all(
    ordered.map((p, i) => supabase.from('design_photos').update({ sort_order: i }).eq('id', p.id)),
  )
  announceChange('design_photos')
}

// ---------- Live sessions ----------
export async function startLive(label?: string) {
  const row = unwrap(await supabase.from('live_sessions').insert({ label: label || null, started_at: new Date().toISOString() }).select().single<LiveSession>())
  announceChange('live_sessions')
  return row
}

export async function endLive(id: string) {
  const row = unwrap(
    await supabase.from('live_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id).select().single<LiveSession>(),
  )
  announceChange('live_sessions')
  return row
}

// ---------- Sales ----------
export interface ClaimInput {
  designId: string
  quantity: number
  buyerHandle: string
  channel: Channel
  unitPrice: number
  liveSessionId?: string | null
  status?: Exclude<SaleStatus, 'cancelled'>
  notes?: string
  claimedAt?: Date
}

/** Records a sale and lowers stock in one database step. Throws "Only N left in stock" when short. */
export async function claim(input: ClaimInput): Promise<Sale> {
  const row = unwrap(
    await supabase.rpc('claim_design', {
      p_design_id: input.designId,
      p_quantity: input.quantity,
      p_buyer_handle: input.buyerHandle,
      p_channel: input.channel,
      p_unit_price: input.unitPrice,
      p_live_session_id: input.liveSessionId ?? null,
      p_status: input.status ?? 'claimed',
      p_notes: input.notes ?? '',
      p_claimed_at: (input.claimedAt ?? new Date()).toISOString(),
    }),
  ) as Sale
  announceChange('designs'); announceChange('sales')
  return row
}

/** Cancel a sale and put the pieces back in stock. */
export async function cancelSale(saleId: string): Promise<Sale> {
  const row = unwrap(await supabase.rpc('cancel_sale', { p_sale_id: saleId })) as Sale
  announceChange('designs'); announceChange('sales')
  return row
}

/**
 * Status moves only go forward from the status we expect. If the other phone
 * already released or changed the sale, zero rows match and we say so instead
 * of resurrecting a cancelled sale.
 */
async function moveStatus(saleId: string, from: SaleStatus, patch: Partial<Sale>): Promise<Sale> {
  const row = unwrap(await supabase.from('sales').update(patch).eq('id', saleId).eq('status', from).select().maybeSingle<Sale>())
  announceChange('sales')
  if (!row) throw new Error(STALE)
  return row
}

export async function markPaid(saleId: string) {
  return moveStatus(saleId, 'claimed', { status: 'paid', paid_at: new Date().toISOString() })
}

export async function markShipped(saleId: string) {
  return moveStatus(saleId, 'paid', { status: 'shipped', shipped_at: new Date().toISOString() })
}

/** Undo "paid": back to claimed. Undo "shipped": back to paid. */
export async function stepBack(sale: Sale) {
  if (sale.status === 'shipped') return moveStatus(sale.id, 'shipped', { status: 'paid', shipped_at: null })
  if (sale.status === 'paid') return moveStatus(sale.id, 'paid', { status: 'claimed', paid_at: null })
  return sale
}

export async function updateSaleDetails(saleId: string, patch: Partial<Pick<Sale, 'buyer_handle' | 'channel' | 'unit_price' | 'notes' | 'claimed_at'>>) {
  const row = unwrap(await supabase.from('sales').update(patch).eq('id', saleId).select().single<Sale>())
  announceChange('sales')
  return row
}

export async function setSaleQuantity(saleId: string, quantity: number): Promise<Sale> {
  const row = unwrap(await supabase.rpc('set_sale_quantity', { p_sale_id: saleId, p_quantity: quantity })) as Sale
  announceChange('designs'); announceChange('sales')
  return row
}

// ---------- Auth ----------
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(friendly(error))
}

export async function signOut() {
  await supabase.auth.signOut()
}

/** Emails a "set a new password" link that opens this app. */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' })
  if (error) throw new Error(friendly(error))
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(friendly(error))
}
