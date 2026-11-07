import { createHash } from "node:crypto";

/**
 * True when the password appears in a known data breach, using Have I Been
 * Pwned's range API: only the first 5 characters of the password's SHA-1 hash
 * leave the server, never the password. Used where Better Auth's own check
 * doesn't run (accounts created from an invitation). Fails open if the service
 * is unreachable, and is skipped when DISABLE_PWNED_CHECK=true.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  if (process.env.DISABLE_PWNED_CHECK === "true") return false;
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
