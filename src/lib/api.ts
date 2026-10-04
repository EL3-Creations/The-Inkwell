/**
 * Every write to the database goes through this file.
 * Pages call these functions; the DataProvider picks up the change via realtime.
 */
import { supabase } from './supabase'
import type { Channel, Design, DesignPhoto, LiveSession, Sale, SaleStatus, Settings } from './types'
import type { ImportRow } from './csv'
import { compressPhoto, deletePhotoFile, uploadPhoto } from './photos'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ---------- Settings ----------
export async function saveSettings(patch: Partial<Omit<Settings, 'id' | 'updated_at'>>) {
  return unwrap(await supabase.from('settings').update(patch).eq('id', 1).select().single<Settings>())
}

// ---------- Designs ----------
export type DesignInput = Omit<Design, 'id' | 'created_at' | 'updated_at' | 'archived'>

export async function createDesign(input: DesignInput) {
  return unwrap(await supabase.from('designs').insert(input).select().single<Design>())
}

export async function updateDesign(id: string, patch: Partial<DesignInput & { archived: boolean }>) {
  return unwrap(await supabase.from('designs').update(patch).eq('id', id).select().single<Design>())
}

export async function setArchived(id: string, archived: boolean) {
  return updateDesign(id, { archived })
}

export async function deleteDesign(id: string) {
  const { error } = await supabase.from('designs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Bulk import: rows whose number matches an active design update it; others are inserted. */
export async function importDesigns(rows: ImportRow[], existingActive: Design[]) {
  const byNumber = new Map(existingActive.map((d) => [d.number, d]))
  const inserts: ImportRow[] = []
  let updated = 0
  for (const r of rows) {
    const existing = byNumber.get(r.number)
    if (existing) {
      await updateDesign(existing.id, r)
      updated++
    } else {
      inserts.push(r)
    }
  }
  let inserted = 0
  // Insert in chunks of 100 to keep each request small.
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100)
    const { error } = await supabase.from('designs').insert(chunk)
    if (error) throw new Error(error.message)
    inserted += chunk.length
  }
  return { inserted, updated }
}

// ---------- Photos ----------
export async function addPhoto(design: Design, file: File, existingCount: number): Promise<DesignPhoto> {
  const small = await compressPhoto(file)
  const path = await uploadPhoto(design.id, small)
  return unwrap(
    await supabase
      .from('design_photos')
      .insert({ design_id: design.id, storage_path: path, sort_order: existingCount })
      .select()
      .single<DesignPhoto>(),
  )
}

export async function removePhoto(photo: DesignPhoto) {
  const { error } = await supabase.from('design_photos').delete().eq('id', photo.id)
  if (error) throw new Error(error.message)
  try { await deletePhotoFile(photo.storage_path) } catch { /* file already gone; ignore */ }
}

/** Make this photo the cover (sort_order 0) and shift the others after it. */
export async function setCoverPhoto(photos: DesignPhoto[], coverId: string) {
  const ordered = [photos.find((p) => p.id === coverId)!, ...photos.filter((p) => p.id !== coverId)]
  await Promise.all(
    ordered.map((p, i) => supabase.from('design_photos').update({ sort_order: i }).eq('id', p.id)),
  )
}

// ---------- Live sessions ----------
export async function startLive(label?: string) {
  return unwrap(await supabase.from('live_sessions').insert({ label: label || null, started_at: new Date().toISOString() }).select().single<LiveSession>())
}

export async function endLive(id: string) {
  return unwrap(
    await supabase.from('live_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id).select().single<LiveSession>(),
  )
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
  return unwrap(
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
}

/** Cancel a sale and put the pieces back in stock. */
export async function cancelSale(saleId: string): Promise<Sale> {
  return unwrap(await supabase.rpc('cancel_sale', { p_sale_id: saleId })) as Sale
}

export async function markPaid(saleId: string) {
  return unwrap(
    await supabase.from('sales').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', saleId).select().single<Sale>(),
  )
}

export async function markShipped(saleId: string) {
  return unwrap(
    await supabase.from('sales').update({ status: 'shipped', shipped_at: new Date().toISOString() }).eq('id', saleId).select().single<Sale>(),
  )
}

/** Undo "paid": back to claimed. Undo "shipped": back to paid. */
export async function stepBack(sale: Sale) {
  const patch =
    sale.status === 'shipped' ? { status: 'paid', shipped_at: null }
    : sale.status === 'paid' ? { status: 'claimed', paid_at: null }
    : null
  if (!patch) return sale
  return unwrap(await supabase.from('sales').update(patch).eq('id', sale.id).select().single<Sale>())
}

export async function updateSaleDetails(saleId: string, patch: Partial<Pick<Sale, 'buyer_handle' | 'channel' | 'unit_price' | 'notes' | 'claimed_at'>>) {
  return unwrap(await supabase.from('sales').update(patch).eq('id', saleId).select().single<Sale>())
}

export async function setSaleQuantity(saleId: string, quantity: number): Promise<Sale> {
  return unwrap(await supabase.rpc('set_sale_quantity', { p_sale_id: saleId, p_quantity: quantity })) as Sale
}

// ---------- Auth ----------
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}
