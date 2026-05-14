import { useEffect, useState } from 'react'

export type ThumbMap = Record<string, string>  // charId → first idle frame URL

interface SkinRender {
  characterId: string
  actions?: Record<string, { fps: number; frames: string[] }>
  imgIdle?: string
}

let cached: ThumbMap | null = null
let promise: Promise<ThumbMap> | null = null

function fetchThumbs(): Promise<ThumbMap> {
  if (promise) return promise
  promise = fetch('/api/v1/skins/list')
    .then(r => r.ok ? r.json() : [])
    .then((skins: SkinRender[]) => {
      const map: ThumbMap = {}
      for (const skin of skins) {
        if (map[skin.characterId]) continue
        if (skin.actions) {
          for (const key of ['idle', 'ready']) {
            const def = skin.actions[key]
            if (def?.frames?.[0]) { map[skin.characterId] = def.frames[0]; break }
          }
        }
        if (!map[skin.characterId] && skin.imgIdle) {
          map[skin.characterId] = skin.imgIdle
        }
      }
      cached = map
      return map
    })
    .catch(() => {
      promise = null
      return {}
    })
  return promise
}

export function useCharacterThumbs(): ThumbMap {
  const [thumbs, setThumbs] = useState<ThumbMap>(cached ?? {})

  useEffect(() => {
    if (cached) { setThumbs(cached); return }
    fetchThumbs().then(setThumbs)
  }, [])

  return thumbs
}
