/** Returns URL for a character portrait if /portraits/{id}.png exists, else null. */

const PORTRAIT_IDS = new Set([
  'boxer',
  'ninja',
  'cosmonaut',
  'scorpion',
  'plague',
])

export function getPortraitUrl(charId: string): string | null {
  return PORTRAIT_IDS.has(charId) ? `/portraits/${charId}.png` : null
}
