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

## Accounts

There is no self-signup. Accounts are created from the command line:

```bash
npm run user -- add anna@linella.md "Anna Rusu" admin
```

The password is generated, printed once, and never stored in the clear. Other
commands: `list`, `passwd <email>`, `disable <email>`, `enable <email>`.

**Roles.** Operators answer reviews. Admins additionally edit the brand voice,
trigger syncs, and see who has access. Every server action checks the role
itself — hiding a button is courtesy, not a boundary.

**Sessions** are server-side rows, not self-contained tokens, so signing out or
disabling an account ends access on the next request. Only the SHA-256 of the
cookie is stored. Passwords are scrypt (N=32768, r=8) via Node's built-in
crypto — no native dependency.

### Quick sign-in (beta)

```bash
npm run user -- demo
```

Creates `admin@linella.md` and `operator@linella.md` and prints their passwords.
With `ENABLE_QUICK_LOGIN=true` the login page shows one-click buttons for them,
so the desk can be demoed without passing credentials around.

This bypasses password checks, so it has three latches: it's off unless the flag
is explicitly `true`; it refuses to run in a production build unless
`ALLOW_QUICK_LOGIN_IN_PROD=true` as well; and it only ever matches those two
hardcoded demo addresses, so it can never be pointed at a real account.

**Turn it off and delete the demo accounts before this sees real customer data.**
While it's on, the Settings page says so in a warning banner.

## Turning on the AI drafts

Get a key at https://openrouter.ai/keys, then in `.env.local`:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

The default is a **free** model. Trade-offs worth knowing before it goes near
real customers:

- **50 requests/day** on the free tier (1000/day once you've bought $10 of
  credits at any point — the allowance is permanent, the credits aren't spent
  on free models). One draft click is one request.
- **Free models can route to providers that may train on your prompts.**
  OpenRouter keeps a separate privacy toggle for free models under Settings →
  Privacy. Reviews contain whatever customers wrote, sometimes including staff
  names — decide deliberately. The prompt never sends the *reviewer's* name;
  only store, rating, date, language, topic tags and the review body.
- **Quality is unmeasured for Romanian.** Romanian is a mid-resource language
  and free models vary a lot on it. Draft a dozen reviews in both languages and
  read them before trusting the output.

Swap the slug for anything on https://openrouter.ai/models — nothing else
changes. `anthropic/claude-sonnet-5` (~0.5 c/review) is the quality option;
`google/gemma-4-31b-it:free` is worth A/B testing against the default.

Note: `nvidia/nemotron-3-ultra-550b-a55b:free` is the largest free model but
**does not support JSON mode**. The client retries without `response_format`
when a provider rejects it, so it still works — just less reliably.

Restart the dev server. The **Draft replies** button appears in the inbox; until
then the panel says so plainly and the manual composer still works.

Each click produces three registers — `standard`, `warmer`, `short` — always in
the language the customer wrote in. The prompt carries hard rules the brand-voice
settings cannot override: no invented facts, no promised refunds or vouchers, no
made-up phone numbers or links, and a sentence cap.

## Review sources

`REVIEW_SOURCE` is a **comma-separated list** — every source named there runs on
each sync, because Google and Yandex are different audiences rather than
alternatives:

```
REVIEW_SOURCE=gbp,yandex
```

All adapters implement the same interface in `src/lib/sources/types.ts`, so the
rest of the app doesn't know which ones are live. Each source gets its own
`sync_runs` row, and one failing source doesn't stop the others.

| Source | Platform | Needs | Notes |
| --- | --- | --- | --- |
| `mock` | — | nothing | Default. Deterministic, so re-syncing never duplicates or shuffles data. |
| `gbp` | Google | OAuth refresh token + Google approval | Free, but only if the account manages the Linella listings. |
| `outscraper` | Google | `OUTSCRAPER_API_KEY` | Paid. Discovers stores by Maps search, or pin them with `OUTSCRAPER_PLACE_IDS`. |
| `serpapi` | Google | `SERPAPI_API_KEY` | Paid, paginated. Better for keeping up than backfilling. |
| `yandex` | Yandex Maps | `APIFY_TOKEN` + `YANDEX_START_URLS` | See below. |

**`mock` is the tested path.** The live adapters are written against each
provider's documented response shape but have not been run against a real key —
expect to adjust field names on first contact.

### About the Yandex adapter

**Yandex publishes no reviews API.** Yandex Business shows reviews to a verified
owner in its own dashboard and offers an embeddable widget, but there is no
public read endpoint. So this adapter goes through Apify's maintained scraper
actor (`zen-studio/yandex-maps-reviews-scraper`, ~$2.99 per 1000 reviews), which
does return review IDs, ratings, dates, author names and owner replies.

One actor run covers every configured business and both interface methods are
served from that single result — running the scraper per store would mean one
paid run per location.

### The same store on two platforms

Locations are keyed on `(source, external_id)`, so one shop fetched from both
Google and Yandex arrives as two rows. An admin folds them together from the
store's page: **Listings → pick the other listing → Merge in**.

Merging points one row's `merged_into` at the other. The target becomes
canonical and absorbs everything: ratings, star spread, backlog, trend, and the
inbox when filtered by that store. The merged row disappears from the stores
list, so nothing is counted twice. **Separate** reverses it.

Auto-matching is deliberately not attempted — the same shop is "Linella —
Ciocana" on Google and "Линелла" on Yandex, with addresses in different
languages and no coordinates from the Yandex scraper. Guessing wrong here
silently corrupts every rating on the dashboard, so pairing is a human decision.

Searching the stores list still matches on a merged listing's name, so typing
the Russian name finds the store it belongs to.

Merging is one level deep: you cannot merge into a store that is itself merged
into another. Anything already attached to a row follows it when that row is
merged onward.

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
  angriest-first. Review, AI drafts, editable composer, copy, done. Built to be
  worked from the keyboard:

  | Key | Does |
  | --- | --- |
  | `J` / `K` | Next / previous review in the queue |
  | `G` | Draft replies for the open review |
  | `1` `2` `3` | Load that draft into the composer |
  | `Ctrl`/`Cmd` + `Enter` | Copy the reply and mark it answered |

  Every shortcut is printed on the control it drives — an invisible shortcut is
  no shortcut.
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
