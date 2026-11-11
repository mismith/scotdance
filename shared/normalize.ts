// Canonical name normalization for aggregate identity keys (functions' aggregators, web's entity lookups).
export function normalizeName(name: string): string {
  // Coerced for legacy records with a number (or nothing) where text belongs.
  // Accents are folded ("Geneviève" = "Genevieve") so one person typed two
  // ways stays one profile.
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
