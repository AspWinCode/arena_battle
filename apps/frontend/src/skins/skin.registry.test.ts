import { describe, expect, it } from 'vitest'
import { ALL_SKIN_IDS } from '@robocode/shared'
import {
  buildDefaultSkinId,
  getDefaultSkin,
  getSkinById,
  getSkinsForCharacter,
  SKIN_REGISTRY,
} from './skin.registry'
import {
  createInitialSkinInventory,
  isSkinOwned,
  setActiveSkin,
  unlockSkin,
} from './skin.store'

describe('skin registry', () => {
  it('registers a default skin for every gameplay character', () => {
    expect(SKIN_REGISTRY.length).toBeGreaterThanOrEqual(ALL_SKIN_IDS.length)

    for (const characterId of ALL_SKIN_IDS) {
      const skin = getDefaultSkin(characterId)
      expect(skin.id).toBe(buildDefaultSkinId(characterId))
      expect(skin.characterId).toBe(characterId)
      expect(skin.price).toBe(0)
    }
  })

  it('returns cosmetic variants for a character', () => {
    const boxerSkins = getSkinsForCharacter('boxer')
    expect(boxerSkins.map((skin) => skin.id)).toContain('boxer_default')
    expect(boxerSkins.map((skin) => skin.id)).toContain('boxer_golden')
    expect(getSkinById('boxer_golden')?.characterId).toBe('boxer')
  })
})

describe('skin inventory helpers', () => {
  it('creates default ownership and active skin for every character', () => {
    const inventory = createInitialSkinInventory()

    for (const characterId of ALL_SKIN_IDS) {
      const entry = inventory[characterId]
      expect(entry?.ownedSkins).toEqual([buildDefaultSkinId(characterId)])
      expect(entry?.activeSkin).toBe(buildDefaultSkinId(characterId))
    }
  })

  it('unlocks skins and allows activating only owned skins of the same character', () => {
    const inventory = createInitialSkinInventory()
    const unlocked = unlockSkin(inventory, 'boxer', 'boxer_golden')

    expect(isSkinOwned(unlocked, 'boxer', 'boxer_golden')).toBe(true)

    const activated = setActiveSkin(unlocked, 'boxer', 'boxer_golden')
    expect(activated.boxer?.activeSkin).toBe('boxer_golden')

    const wrongCharacter = setActiveSkin(activated, 'gladiator', 'boxer_golden')
    expect(wrongCharacter.gladiator?.activeSkin).toBe('gladiator_default')

    const notOwned = setActiveSkin(activated, 'boxer', 'boxer_shadow')
    expect(notOwned.boxer?.activeSkin).toBe('boxer_golden')
  })
})
