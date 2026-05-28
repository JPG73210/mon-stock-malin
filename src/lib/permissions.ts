// Emails autorisés à accéder à la configuration / historique d'impression
export const PRINT_ADMIN_EMAILS = [
  "jpgrolla@outlook.fr",
  "jpgrolla@proton.me",
];

export function canManagePrint(email?: string | null) {
  if (!email) return false;
  return PRINT_ADMIN_EMAILS.includes(email.toLowerCase());
}
