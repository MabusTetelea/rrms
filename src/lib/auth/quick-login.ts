/**
 * Beta convenience: one-click sign-in as a demo account, so the desk can be
 * shown and tested without handing passwords around.
 *
 * This bypasses password verification, so it is fenced in three ways:
 *   1. off unless ENABLE_QUICK_LOGIN is explicitly "true";
 *   2. refuses to switch on in production unless ALLOW_QUICK_LOGIN_IN_PROD is
 *      also set, so shipping the flag by accident fails safe;
 *   3. only ever matches the two hardcoded demo addresses below — it can never
 *      be pointed at a real operator's account.
 *
 * Turn it off before this is in front of real customer data.
 */

export const QUICK_LOGIN_ACCOUNTS = [
  { email: "admin@linella.md", role: "admin" as const },
  { email: "operator@linella.md", role: "operator" as const },
];

export function isQuickLoginEnabled(): boolean {
  if (process.env.ENABLE_QUICK_LOGIN !== "true") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_QUICK_LOGIN_IN_PROD !== "true"
  ) {
    return false;
  }
  return true;
}

export function isQuickLoginAccount(email: string): boolean {
  return QUICK_LOGIN_ACCOUNTS.some(
    (account) => account.email === email.trim().toLowerCase(),
  );
}
