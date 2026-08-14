// Server-side only. Importing this from a client component pulls the pg driver
// into the browser bundle and fails on `dns` — import from lib/format instead
// if you only need presentation helpers. (No `server-only` guard here: the
// package throws outside a bundler, which would break scripts/seed.ts.)
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://reviews:reviews@localhost:5442/linella_reviews";

// Next.js dev server hot-reloads modules; reuse one pool so we don't leak
// connections on every edit.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? new Pool({ connectionString, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
