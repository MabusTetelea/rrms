import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "linella_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "operator" | "admin";
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a session and sets the cookie. Call only after verifying a password. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  // Opportunistic cleanup — this table is tiny and never worth a cron job.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Wrapped in React's `cache` so a page that checks
 * auth in the layout, the page and an action still hits the database once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  // A disabled account loses access on its next request, not at token expiry.
  if (!row || !row.active) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "operator",
  };
});

/**
 * Guard for pages and server actions.
 *
 * Every server action needs its own call: actions are individually addressable
 * POST endpoints, so a check in the layout does not protect them.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/?denied=1");
  return user;
}

/** Non-redirecting variant, for server actions that return an error instead. */
export async function currentUserOrNull(): Promise<SessionUser | null> {
  return getSessionUser();
}
