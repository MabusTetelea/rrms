"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { isQuickLoginAccount, isQuickLoginEnabled } from "@/lib/auth/quick-login";
import { hit, reset } from "@/lib/rate-limit";

export type LoginResult = { ok: false; error: "invalid" | "throttled" | "unknown" };

/** Enough to make online password guessing pointless. See lib/rate-limit. */
const LOGIN_LIMIT = { max: 10, windowMs: 10 * 60_000 };

function throttled(email: string): boolean {
  return !hit(`login:${email}`, LOGIN_LIMIT).ok;
}

function clearThrottle(email: string) {
  reset(`login:${email}`);
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
