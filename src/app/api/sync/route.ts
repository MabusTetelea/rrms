import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

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
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const full = new URL(request.url).searchParams.get("full") === "1";

  try {
    const result = await runSync({ full });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
