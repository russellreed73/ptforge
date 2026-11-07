/**
 * Neon connection strings end in `sslmode=require`. node-postgres already
 * treats that as full certificate checking and prints a warning about a future
 * change; asking for `verify-full` explicitly keeps today's (secure) behaviour
 * and silences the warning. Neon's certificates are publicly trusted.
 */
export function normalizeDatabaseUrl(url: string): string {
  return url.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/, "$1sslmode=verify-full");
}
