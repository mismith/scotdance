// Canonical name normalization for aggregate identity keys.
//
// Used by both the trigger side (judges/pipers/venues/dancers aggregators)
// and the read side (frontend `entityIndex.ts`). If the algorithm here ever
// changes, the frontend mirror needs the same change — otherwise lookups
// silently miss.

export function normalizeName(name: string): string {
  // Coerced for legacy records with a number (or nothing) where text belongs.
  // Accents are folded ("Geneviève" = "Genevieve") so one person typed two
  // ways stays one profile.
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
