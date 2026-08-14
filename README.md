# Linella — Review desk

An operator console for Google reviews across every Linella store. It pulls
reviews in, ranks the stores by what customers actually say, drafts three reply
options with an LLM through OpenRouter, and hands the operator a reply to copy
into Google Business Profile.

**The app never posts to Google.** Copying is the terminal action; publishing
stays a human step in Google's own interface. That means no write access, no
API approval process, and no chance of the model publishing something nobody
read.

---

## Running it

```bash
npm install
```

```bash
docker compose up -d
```

```bash
npm run db:migrate && npm run db:seed
```

```bash
npm run dev
```

Then open http://localhost:3000. Postgres runs on port **5442** to stay out of
the way of anything already on 5432.

Copy `.env.example` to `.env.local` and fill in what you need. Nothing is
required to start — the default `mock` source seeds 12 stores and ~480
Romanian/Russian reviews.

## Turning on the AI drafts

Get a key at https://openrouter.ai/keys, then in `.env.local`:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
```

Restart the dev server. The **Draft replies** button appears in the inbox; until
then the panel says so plainly and the manual composer still works.

Each click produces three registers — `standard`, `warmer`, `short` — always in
the language the customer wrote in. The prompt carries hard rules the brand-voice
settings cannot override: no invented facts, no promised refunds or vouchers, no
made-up phone numbers or links, and a sentence cap.

## Review sources

`REVIEW_SOURCE` selects the adapter. All four implement the same interface in
`src/lib/sources/types.ts`, so the rest of the app doesn't know which one is live.

| Source | Coverage | Needs | Notes |
| --- | --- | --- | --- |
| `mock` | 12 seeded stores | nothing | Default. Deterministic, so re-syncing never duplicates or shuffles data. |
| `outscraper` | Full history, any location | `OUTSCRAPER_API_KEY` | Paid. Discovers stores by Maps search, or pin them with `OUTSCRAPER_PLACE_IDS`. |
| `serpapi` | Recent reviews, any location | `SERPAPI_API_KEY` | Paid, paginated. Better for keeping up than backfilling. |
| `gbp` | Full history | OAuth refresh token + Google approval | Free, but only if the account manages the Linella listings. |

**`mock` is the tested path.** The three live adapters are written against each
provider's documented response shape but have not been run against a real key —
expect to adjust field names on first contact.

Sync from the dashboard button, the CLI, or a cron job:

```bash
curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer $SYNC_SECRET"
```

Add `?full=1` to re-scan every review instead of stopping at the newest one
already stored — needed after changing topic keywords or language detection.

Syncs are idempotent. Rows are keyed on `(source, external_id)`, and an update
only touches fields the provider owns; review status, drafts and saved replies
are never overwritten.

## What's in it

- **Overview** — headline numbers, then **zones ranked by unanswered backlog**:
  which area is falling behind, how much of that queue is 1–2 star, and its
  weakest store. Below it, the individual shops carrying the biggest queues, and
  a keyword breakdown of what customers bring up.
- **Inbox** — filterable queue (to answer / negative / replied / skipped), sorted
  angriest-first. Review, AI drafts, editable composer, copy, done.
- **Stores** — searchable by name, city or street; grouped by zone, worst rated
  first inside each. Per-store page has rating, star distribution, six-month
  trend and recent reviews.
- **Settings** — brand voice, source and model status, sync history.

### Zones

Stores are grouped into zones so the overview can point at an area rather than a
list of individual shops. Chișinău is split by sector; everything outside the
capital falls into North / Centre-districts / South.

Zones are derived from a store's city and address by `src/lib/zones.ts` and
recomputed on every sync — nothing is entered by hand. To re-cut the map, edit
`CHISINAU_SECTORS` and `REGION_BY_CITY` in that file and run a sync. A store in
an unmapped town lands in **Unassigned** rather than being filed wrongly, so it
shows up as needing attention.

Operator UI is Romanian by default, with Russian and English in the switcher.
That's separate from the reply language, which always follows the customer.

## How it's put together

```
src/
  app/                 routes + server actions
  components/          UI
  db/                  Drizzle schema and pool
  lib/
    ai/                OpenRouter client, prompt, suggestion persistence
    sources/           mock | outscraper | serpapi | gbp adapters
    text.ts            language detection + topic tagging (no LLM)
    queries.ts         all read queries (server only)
    format.ts          pure helpers safe for client components
```

Language detection and topic tagging are deterministic regex, not model calls —
every review needs them including the thousands nobody will ever reply to, and
paying per token for that would be silly. The model is only involved when an
operator asks for a draft.

`src/lib/queries.ts` imports the Postgres driver, so it must never be pulled into
a client component. Presentation helpers live in `src/lib/format.ts` for that
reason.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:generate` | New migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Full sync from the configured source |
| `npm run db:studio` | Drizzle Studio |
| `npm run lint` | ESLint |
