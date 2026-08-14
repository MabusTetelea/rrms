import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

/** Constant-time compare that tolerates differing lengths. */
function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron entry point.
 *
 *   curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_SECRET"
 *
 * Pass ?full=1 to re-scan every review instead of stopping at the newest one
 * already stored — needed after changing topic keywords or language rules.
 */
export async function POST(request: Request) {
  // Fail closed. An unset secret used to mean "no check at all", which left the
  // endpoint open to anyone who could reach the host.
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SYNC_SECRET is not configured; this endpoint is disabled." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (!timingSafeEquals(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const full = new URL(request.url).searchParams.get("full") === "1";

  try {
    const results = await runSync({ full });
    return NextResponse.json({ runs: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
