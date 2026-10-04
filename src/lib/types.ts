export type DesignType = 'pen' | 'keychain'
export type Tier = 'standard' | 'premium'
export type Channel = 'shop' | 'live' | 'market' | 'other'
export type SaleStatus = 'claimed' | 'paid' | 'shipped' | 'cancelled'

export interface Settings {
  id: number
  shop_name: string
  standard_price: number
  premium_price: number
  week_starts_on: number
  updated_at: string
}

export interface Design {
  id: string
  number: number
  name: string
  type: DesignType
  tier: Tier
  price_override: number | null
  quantity: number
  shop_safe: boolean
  notes: string
  archived: boolean
  created_at: string
  updated_at: string
}

export interface DesignPhoto {
  id: string
  design_id: string
  storage_path: string
  sort_order: number
  created_at: string
}

export interface LiveSession {
  id: string
  label: string | null
  started_at: string
  ended_at: string | null
}

export interface Sale {
  id: string
  design_id: string
  quantity: number
  buyer_handle: string
  channel: Channel
  unit_price: number
  status: SaleStatus
  claimed_at: string
  paid_at: string | null
  shipped_at: string | null
  cancelled_at: string | null
  live_session_id: string | null
  notes: string
  created_at: string
  updated_at: string
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  shop: 'TikTok Shop',
  live: 'TikTok Live',
  market: 'Market',
  other: 'Other',
}

export const STATUS_LABEL: Record<SaleStatus, string> = {
  claimed: 'Claimed',
  paid: 'Paid',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

export const TIER_LABEL: Record<Tier, string> = { standard: 'Standard', premium: 'Premium' }
export const TYPE_LABEL: Record<DesignType, string> = { pen: 'Pen', keychain: 'Keychain' }

/** The price a design actually sells for: its override, or the tier price from Settings. */
export function effectivePrice(design: Pick<Design, 'tier' | 'price_override'>, settings: Settings | null): number {
  if (design.price_override != null) return Number(design.price_override)
  if (!settings) return 0
  return Number(design.tier === 'premium' ? settings.premium_price : settings.standard_price)
}
