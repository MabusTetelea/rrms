/**
 * Fixed-window counter, held in memory.
 *
 * In memory means it resets when the server restarts and isn't shared between
 * instances. That's fine for what it's used for here — stopping one signed-in
 * operator from draining a daily API allowance in a minute, and making online
 * password guessing pointless. It is not a substitute for a real rate limiter
 * at the edge if this ever runs behind more than one process.
 */

type Window = { count: number; startedAt: number };

const windows = new Map<string, Window>();

export type Limit = {
  /** How many hits are allowed inside one window. */
  max: number;
  windowMs: number;
};

export type LimitResult = {
  ok: boolean;
  /** Hits left in this window, floored at zero. */
  remaining: number;
  /** When the current window expires. */
  resetAt: Date;
};

/**
 * Count one hit against `key`.
 *
 * The hit is counted whether or not it is allowed, so hammering a limit that
 * has already tripped keeps it tripped for the rest of the window rather than
 * letting a caller retry their way through.
 */
export function hit(key: string, limit: Limit, now = Date.now()): LimitResult {
  const existing = windows.get(key);
  const window: Window =
    !existing || now - existing.startedAt >= limit.windowMs
      ? { count: 0, startedAt: now }
      : existing;

  window.count += 1;
  windows.set(key, window);

  // Opportunistic sweep. The map is keyed by user or email, so it stays small,
  // but a long-running process shouldn't hold entries for people who left.
  if (windows.size > 5_000) {
    for (const [k, w] of windows) {
      if (now - w.startedAt >= limit.windowMs) windows.delete(k);
    }
  }

  return {
    ok: window.count <= limit.max,
    remaining: Math.max(0, limit.max - window.count),
    resetAt: new Date(window.startedAt + limit.windowMs),
  };
}

/** Forget a key's window — used after a success makes the count meaningless. */
export function reset(key: string): void {
  windows.delete(key);
}

/** Test seam. */
export function clearAll(): void {
  windows.clear();
}
