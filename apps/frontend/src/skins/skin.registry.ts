import type { CharacterSkin } from '@robocode/shared'
import { ALL_SKIN_IDS } from '@robocode/shared'
import type { SkinId } from '@robocode/shared'

export function buildDefaultSkinId(characterId: SkinId): string {
  return `${characterId}_default`
}

function buildDefaultSkin(characterId: SkinId): CharacterSkin {
  return {
    id: buildDefaultSkinId(characterId),
    name: `${characterId} Default`,
    characterId,
    price: 0,
    rarity: 'common',
    layers: {},
    vfx: {},
  }
}

export const SKIN_REGISTRY: CharacterSkin[] = [
  ...ALL_SKIN_IDS.map((characterId) => buildDefaultSkin(characterId)),
  {
    id: 'boxer_golden',
    name: 'Golden Champion',
    characterId: 'boxer',
    price: 1200,
    rarity: 'epic',
    layers: {
      weapon: 'boxer/golden/gloves.png',
      legs:   'boxer/golden/shorts.png',
      shoes:  'boxer/golden/shoes.png',
      aura:   'boxer/golden/aura.png',
    },
    vfx: {
      hit: 'hit_lightning',
      special: 'special_aura',
      victory: 'golden_confetti',
    },
    colorOverride: {
      primary: '#f5c542',
      secondary: '#9f6a00',
      accent: '#fff2b3',
    },
  },
  {
    id: 'gladiator_onyx',
    name: 'Onyx Arena',
    characterId: 'gladiator',
    price: 900,
    rarity: 'rare',
    layers: {
      weapon: 'gladiator/onyx/weapon.png',
      accessory: 'gladiator/onyx/helmet.png',
    },
    vfx: {
      hit: 'hit_normal',
      special: 'special_aura',
    },
    colorOverride: {
      primary: '#3a3a3a',
      secondary: '#6b7280',
      accent: '#d1d5db',
    },
  },
]

export function getSkinsForCharacter(characterId: SkinId): CharacterSkin[] {
  return SKIN_REGISTRY.filter((skin) => skin.characterId === characterId)
}

export function getSkinById(skinId: string): CharacterSkin | undefined {
  return SKIN_REGISTRY.find((skin) => skin.id === skinId)
}

export function getDefaultSkin(characterId: SkinId): CharacterSkin {
  const defaultSkin = getSkinById(buildDefaultSkinId(characterId))
  if (!defaultSkin) {
    throw new Error(`Default skin is not registered for ${characterId}`)
  }
  return defaultSkin
}
