/** Force la saisie en majuscules pour les identifiants/codes. */
export function upperCaseInput<T extends HTMLInputElement>(
  e: React.ChangeEvent<T>,
): string {
  return e.target.value.toUpperCase();
}

/** Normalise un code pour comparaison tolérante (anciennes étiquettes en minuscules). */
export function normalizeCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}
