"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { isQuickLoginAccount, isQuickLoginEnabled } from "@/lib/auth/quick-login";

export type LoginResult = { ok: false; error: "invalid" | "throttled" | "unknown" };

/**
 * Crude per-address throttle. In-memory, so it resets on restart and doesn't
 * span instances — enough to make online guessing pointless, not a substitute
 * for a real rate limiter at the edge.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 10;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearThrottle(key: string) {
  attempts.delete(key);
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { ok: false, error: "invalid" };
  if (throttled(email)) return { ok: false, error: "throttled" };

  const [user] = await db.select().from(users).where(eq(users.email, email));

  // Same answer whether the address is unknown, the account is disabled, or
  // the password is wrong — none of that is a stranger's business.
  if (!user || !user.active) return { ok: false, error: "invalid" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: "invalid" };

  clearThrottle(email);
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id);

  redirect("/");
}

/** Beta one-click sign-in. See lib/auth/quick-login for the guards. */
export async function quickLoginAction(email: string): Promise<LoginResult> {
  if (!isQuickLoginEnabled() || !isQuickLoginAccount(email)) {
    return { ok: false, error: "invalid" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));

  if (!user || !user.active) return { ok: false, error: "unknown" };

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id);

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
