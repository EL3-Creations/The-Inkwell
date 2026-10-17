import Papa from 'papaparse'
import type { Design, DesignType, Tier } from './types'
import { localDate } from './format'

export interface ImportRow {
  number: number
  name: string
  type: DesignType
  tier: Tier
  price_override: number | null
  /** null = the quantity cell was blank: new designs get 1, existing designs keep their count. */
  quantity: number | null
  shop_safe: boolean
  notes: string
}

export interface ImportResult {
  rows: ImportRow[]
  errors: string[]
}

const YES = new Set(['yes', 'y', 'true', '1', 'x'])
const NO = new Set(['no', 'n', 'false', '0', ''])

function parseBool(v: string, fallback: boolean): boolean | null {
  const t = v.trim().toLowerCase()
  if (t === '') return fallback
  if (YES.has(t)) return true
  if (NO.has(t)) return false
  return null
}

function wholeNumber(v: string): number | null {
  return /^\d+$/.test(v) ? Number(v) : null
}

/** Parse a designs CSV. Header names are case-insensitive; see sample-import.csv. */
export function parseDesignsCsv(text: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase().replace(/[\s-]+/g, '_'),
  })
  const errors: string[] = parsed.errors.map((e) => `Line ${(e.row ?? 0) + 2}: ${e.message}`)
  const rows: ImportRow[] = []
  const seen = new Set<number>()

  if (parsed.data.length === 0) errors.push('No rows found. Is the first line the header row (number, name, type, ...)?')
  else if (!('number' in parsed.data[0])) errors.push('No "number" column found. Download the sample CSV to see the expected header row.')

  parsed.data.forEach((r, i) => {
    const line = i + 2
    const get = (k: string) => (r[k] ?? '').trim()

    const number = wholeNumber(get('number'))
    if (number === null || number <= 0) { errors.push(`Line ${line}: "number" must be a whole number above 0 (got "${get('number')}")`); return }
    if (seen.has(number)) { errors.push(`Line ${line}: number ${number} appears twice in the file`); return }
    seen.add(number)

    const typeRaw = get('type').toLowerCase()
    const type: DesignType | null = typeRaw.startsWith('pen') ? 'pen' : typeRaw.startsWith('key') ? 'keychain' : null
    if (!type) { errors.push(`Line ${line}: "type" must be pen or keychain`); return }

    const tierRaw = get('tier').toLowerCase()
    const tier: Tier | null = tierRaw.startsWith('prem') ? 'premium' : tierRaw.startsWith('stan') || tierRaw === '' ? 'standard' : null
    if (!tier) { errors.push(`Line ${line}: "tier" must be standard or premium`); return }

    const priceRaw = get('price').replace(/[$,]/g, '')
    let price_override: number | null = null
    if (priceRaw !== '') {
      const p = Number(priceRaw)
      if (!Number.isFinite(p) || p < 0) { errors.push(`Line ${line}: "price" is not a valid amount`); return }
      price_override = p
    }

    const qtyRaw = get('quantity')
    const quantity = qtyRaw === '' ? null : wholeNumber(qtyRaw)
    if (qtyRaw !== '' && quantity === null) { errors.push(`Line ${line}: "quantity" must be a whole number, 0 or more (got "${qtyRaw}")`); return }

    const shop_safe = parseBool(get('shop_safe'), true)
    if (shop_safe === null) { errors.push(`Line ${line}: "shop_safe" must be yes or no`); return }

    rows.push({ number, name: get('name'), type, tier, price_override, quantity, shop_safe, notes: get('notes') })
  })

  return { rows, errors }
}

/** CSV text for download. escapeFormulae keeps notes like "=1+1" or "-small bubble" as text in Excel. */
export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows, { escapeFormulae: true })
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function designsToCsvRows(designs: Design[], price: (d: Design) => number, photoCount: (d: Design) => number) {
  return designs.map((d) => ({
    number: d.number,
    name: d.name,
    type: d.type,
    tier: d.tier,
    price: price(d).toFixed(2),
    price_is_override: d.price_override != null ? 'yes' : 'no',
    quantity: d.quantity,
    shop_safe: d.shop_safe ? 'yes' : 'no',
    notes: d.notes,
    archived: d.archived ? 'yes' : 'no',
    photos: photoCount(d),
    created: localDate(d.created_at),
  }))
}
