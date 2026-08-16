# RRMS — Retail Review Management System

An operator console for a retail chain's Google reviews. It pulls reviews in,
puts the ones that need answering in a queue worst-first, drafts reply options
with an LLM, and hands the operator a reply to copy into Google Business
Profile.

**Nothing is published without a human.** By default the app only drafts and
copies. Publishing straight to Google can be switched on, and even then it takes
an explicit click plus a confirmation for every reply.

The chain it answers for is configuration, not code — nothing here is specific
to one brand.

---

## Quick start

```bash
npm install
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev -- -p 3010
```

Open **http://localhost:3010**. Postgres runs on port 5442.

Nothing needs configuring to try it: the default `mock` source seeds 12 stores
and ~480 Romanian/Russian reviews.

## Configuration

**Copy `.env.example` to `.env.local` and edit that file.** It is git-ignored, so
your keys never leave the machine. Restart the server after changing it.

### The AI key

Get one at **https://openrouter.ai/keys**, then in `.env.local`:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

The **Draft replies** button appears once it's set. Until then the manual
composer still works.

The default model is free, capped at **50 requests a day** — one click on Draft
is one request, whether it returns one option or three. Any slug from
https://openrouter.ai/models works; `anthropic/claude-sonnet-5` (~0.5¢/reply) is
the quality option.

### Everything else worth setting

| Setting | What it does |
| --- | --- |
| `COMPANY_NAME` | The chain's name. Reaches the AI prompt and the store search. |
| `COMPANY_DESCRIPTION` | e.g. "a supermarket chain in Moldova" — shapes how replies read. |
| `DATABASE_URL` | Postgres connection. Default matches `docker-compose.yml`. |
| `REVIEW_SOURCE` | Where reviews come from. `mock` (default), `gbp`, `outscraper`, `serpapi`. |
| `SYNC_SECRET` | Required for the cron sync endpoint. Unset = endpoint disabled. |
| `PUBLISH_REPLIES` | `true` adds the Publish-to-Google button. Off by default. |
| `ENABLE_QUICK_LOGIN` | Demo sign-in buttons. **Turn off before real data.** |

## Signing in

There is no self-signup. Accounts are made from the command line:

```bash
npm run user -- add anna@example.com "Anna Rusu" admin
```

The password is generated, printed once, and never stored in the clear. Other
commands: `list`, `passwd`, `disable`, `enable`.

**Roles.** Operators answer reviews. Admins also edit the brand voice, trigger
syncs, connect Google, and see who has access.

For a demo, `npm run user -- demo` creates two accounts and, with
`ENABLE_QUICK_LOGIN=true`, puts one-click sign-in buttons on the login page.
Turn that off and delete the accounts before real customer data.

## How it works day to day

Signing in lands you **in the queue**, with the first review already open.

- **To answer** — only reviews rated **3 stars and below**. Most of what
  customers write is praise, and answering all of it buries what matters.
  `REPLY_THRESHOLD` in `src/lib/queries.ts` changes the cutoff; set it to 5 to
  answer everything.
- **Done** — what's been answered or skipped, newest first, each showing the
  reply that was sent and who sent it.
- **Everything** — the full archive.

Built for the keyboard, and every shortcut is printed on the control it drives:

| Key | Does |
| --- | --- |
| `↑` `↓` or `J` `K` | Move through the queue |
| `G` | Draft replies for the open review |
| `1` `2` `3` | Load that draft into the composer |
| `Ctrl`/`Cmd` + `Enter` | Copy the reply and mark it answered |

Replies are always written in the language the customer used. That's enforced in
code, not just asked for in the prompt — a draft that comes back in the wrong
language is thrown away.

## Getting reviews in

| Source | Needs | Notes |
| --- | --- | --- |
| `mock` | nothing | Default. Fake but realistic data. **The only tested path.** |
| `gbp` | Google OAuth + approval | Free. The only source that can also publish replies. |
| `outscraper` | `OUTSCRAPER_API_KEY` | Paid. Full review history for any location. |
| `serpapi` | `SERPAPI_API_KEY` | Paid. Better at keeping up than backfilling. |

Sync from the dashboard button, or on a schedule:

```bash
curl -X POST http://localhost:3010/api/sync -H "Authorization: Bearer $SYNC_SECRET"
```

Re-syncing is safe: it never overwrites a reply, a draft, or a review's status.

To connect Google, open **Settings → Google account**. It lists exactly what's
missing and has a button that tests the connection.

## Known limits

Read these before this touches real customers.

- **The free model's Romanian is poor.** It produces words that aren't words.
  Test a dozen replies in both languages before trusting it, or pay for a better
  model.
- **Only the `mock` source has actually been run.** The three live adapters are
  written against each provider's documented responses but have never met a real
  API key. Expect to adjust field names on first contact.
- **Free models may train on what you send them.** OpenRouter has a privacy
  toggle for this. Reviews contain whatever customers wrote. The prompt never
  sends the reviewer's name, but it does send the review text.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev -- -p 3010` | Dev server |
| `npm test` | Run the tests |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Pull reviews from the configured source |
| `npm run user` | Manage accounts |
| `npm run lint` | ESLint |
