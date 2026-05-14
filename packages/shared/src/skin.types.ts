import type { SkinId } from './types'

// ── Rarity tiers ──────────────────────────────────────────────────────────────
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary'

// ── A single purchasable / equippable skin ────────────────────────────────────
export interface CharacterSkin {
  /** Unique skin id, e.g. 'boxer_default', 'boxer_golden' */
  id: string
  /** Display name shown in store / lobby */
  name: string
  /** Which character this skin belongs to */
  characterId: SkinId
  /** 0 = free */
  price: number
  rarity: SkinRarity
  /** Visual layer overrides — paths to PNGs or atlas keys */
  layers: {
    body?:      string
    head?:      string
    legs?:      string
    shoes?:     string
    weapon?:    string
    accessory?: string
    /** glow / particle aura around the character */
    aura?:      string
  }
  /** Per-event VFX overrides */
  vfx: {
    hit?:     string  // effect when dealing damage
    special?: string  // ultimate effect
    victory?: string  // victory screen effect
  }
  /** Optional palette override */
  colorOverride?: {
    primary:   string  // hex
    secondary: string
    accent:    string
  }
}

// ── User inventory ────────────────────────────────────────────────────────────
export interface UserSkinInventory {
  [characterId: string]: {
    /** All skin ids the user owns for this character */
    ownedSkins: string[]
    /** Currently equipped skin id */
    activeSkin: string
  }
}
