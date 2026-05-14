import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SkinId, UserSkinInventory } from '@robocode/shared'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { buildDefaultSkinId, getSkinById } from './skin.registry'

export interface SkinStoreState {
  inventory: UserSkinInventory
  unlockSkin: (characterId: SkinId, skinId: string) => void
  setActiveSkin: (characterId: SkinId, skinId: string) => void
  reset: () => void
}

function getInventoryEntry(inventory: UserSkinInventory, characterId: SkinId) {
  return inventory[characterId] ?? {
    ownedSkins: [buildDefaultSkinId(characterId)],
    activeSkin: buildDefaultSkinId(characterId),
  }
}

export function createInitialSkinInventory(): UserSkinInventory {
  return Object.fromEntries(
    ALL_SKIN_IDS.map((characterId) => [
      characterId,
      {
        ownedSkins: [buildDefaultSkinId(characterId)],
        activeSkin: buildDefaultSkinId(characterId),
      },
    ]),
  ) as UserSkinInventory
}

export function isSkinOwned(inventory: UserSkinInventory, characterId: SkinId, skinId: string): boolean {
  return getInventoryEntry(inventory, characterId).ownedSkins.includes(skinId)
}

export function unlockSkin(inventory: UserSkinInventory, characterId: SkinId, skinId: string): UserSkinInventory {
  const skin = getSkinById(skinId)
  if (!skin || skin.characterId !== characterId || isSkinOwned(inventory, characterId, skinId)) {
    return inventory
  }

  return {
    ...inventory,
    [characterId]: {
      ...getInventoryEntry(inventory, characterId),
      ownedSkins: [...getInventoryEntry(inventory, characterId).ownedSkins, skinId],
    },
  }
}

export function setActiveSkin(inventory: UserSkinInventory, characterId: SkinId, skinId: string): UserSkinInventory {
  const skin = getSkinById(skinId)
  if (!skin || skin.characterId !== characterId || !isSkinOwned(inventory, characterId, skinId)) {
    return inventory
  }

  return {
    ...inventory,
    [characterId]: {
      ...getInventoryEntry(inventory, characterId),
      activeSkin: skinId,
    },
  }
}

const initialInventory = createInitialSkinInventory()

export const useSkinStore = create<SkinStoreState>()(
  persist(
    (set) => ({
      inventory: initialInventory,
      unlockSkin: (characterId, skinId) =>
        set((state) => ({
          inventory: unlockSkin(state.inventory, characterId, skinId),
        })),
      setActiveSkin: (characterId, skinId) =>
        set((state) => ({
          inventory: setActiveSkin(state.inventory, characterId, skinId),
        })),
      reset: () => set({ inventory: createInitialSkinInventory() }),
    }),
    { name: 'robocode-skins' },
  ),
)
