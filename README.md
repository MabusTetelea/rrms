<div align="center">

# RRMS

**Retail Review Management System**

Answer every Google review across a retail chain — in the language the customer wrote in, without leaving one screen.

[![CI](https://github.com/MabusTetelea/rrms/actions/workflows/ci.yml/badge.svg)](https://github.com/MabusTetelea/rrms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org)

</div>

---

A shop with a thousand reviews has a problem no dashboard solves: someone still
has to write the replies. RRMS pulls every review into one queue, puts the ones
that actually need answering at the top, drafts options in the customer's own
language, and gets out of the way.

**Nothing is published without a human.** The model drafts. A person reads it,
edits it, and clicks. Publishing straight to Google can be switched on, and even
then it takes an explicit click and a confirmation for every single reply.

## Why it's built this way

- **Only 3-star-and-below reviews count as work.** Two thirds of what customers
  write is praise, and answering all of it buries what actually costs you
  something. One constant changes the cutoff.
- **The reply language is enforced in code, not asked for in a prompt.** A draft
  that comes back in the wrong language is thrown away. A Russian customer
  receiving an English reply under your brand is worse than no reply at all.
- **Language detection and topic tagging use no LLM.** Every review needs them,
  including the thousands nobody will ever answer. Paying per token for that
  would be silly, so it's deterministic pattern matching.
- **Built for the keyboard.** Someone clearing eighty reviews a day shouldn't
  touch a mouse. Every shortcut is printed on the control it drives.
- **Brand-neutral.** The chain it answers for is configuration, not code.
- **Sessions are server-side rows, not tokens.** Disabling an account ends its
  access on the next request, not whenever a token happens to expire.

## Quick start

```bash
npm install
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev -- -p 3010
```

Open **http://localhost:3010**. Postgres runs on port 5442.

No keys needed to try it — the default `mock` source generates 12 stores and
~480 Romanian/Russian reviews, deterministically.

## Configuration

**Copy `.env.example` to `.env.local` and edit that.** It's git-ignored, so keys
never leave the machine. Restart after changing it.

### The AI key

Get one at **[openrouter.ai/keys](https://openrouter.ai/keys)**, then:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

The **Draft replies** button appears once it's set; until then the manual
composer still works.

The default model is free, capped at **50 requests/day** — one click is one
request whether it returns one option or three. Any slug from
[openrouter.ai/models](https://openrouter.ai/models) works;
`anthropic/claude-sonnet-5` (~0.5¢/reply) is the quality option.

### Everything else

| Setting | What it does |
| --- | --- |
| `COMPANY_NAME` | The chain's name. Reaches the prompt and the store search. |
| `COMPANY_DESCRIPTION` | e.g. "a supermarket chain in Moldova" — shapes how replies read. |
| `DATABASE_URL` | Postgres connection. Default matches `docker-compose.yml`. |
| `REVIEW_SOURCE` | `mock` (default), `gbp`, `outscraper`, `serpapi`. Comma-separated. |
| `SYNC_SECRET` | Required for the cron sync endpoint. Unset = endpoint disabled. |
| `PUBLISH_REPLIES` | `true` adds the Publish-to-Google button. Off by default. |
| `ENABLE_QUICK_LOGIN` | Demo sign-in buttons. **Turn off before real data.** |

## Signing in

No self-signup. Accounts are made from the command line:

```bash
npm run user -- add anna@example.com "Anna Rusu" admin
```

The password is generated, printed once, and never stored in the clear. Other
commands: `list`, `passwd`, `disable`, `enable`.

**Operators** answer reviews. **Admins** also edit the brand voice, trigger
syncs, connect Google, and see who has access.

For a demo, `npm run user -- demo` creates two accounts and — with
`ENABLE_QUICK_LOGIN=true` — puts one-click sign-in buttons on the login page.
Turn it off and delete those accounts before real customer data.

## Day to day

Signing in lands you **in the queue**, first review already open.

| Tab | What's in it |
| --- | --- |
| **To answer** | Reviews rated 3 and below, angriest first |
| **Done** | Answered or skipped, newest first, each showing the reply that was sent and by whom |
| **Everything** | The full archive |

| Key | Does |
| --- | --- |
| `↑` `↓` or `J` `K` | Move through the queue |
| `G` | Draft replies for the open review |
| `1` `2` `3` | Load that draft into the composer |
| `Ctrl`/`Cmd` + `Enter` | Copy the reply and mark it answered |

`REPLY_THRESHOLD` in `src/lib/queries.ts` changes the cutoff — set it to 5 to
answer everything.

## Getting reviews in

| Source | Needs | Notes |
| --- | --- | --- |
| `mock` | nothing | Default. Invented but realistic. **The only tested path.** |
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

Read these before it touches real customers.

- **The free model's Romanian is poor.** It produces words that aren't words.
  Test a dozen replies in both languages, or pay for a better model.
- **Only `mock` has actually been run.** The three live adapters are written
  against each provider's documented responses but have never met a real API
  key. Expect to adjust field names on first contact.
- **Free models may train on what you send.** OpenRouter has a privacy toggle.
  The prompt never sends the reviewer's name, but it does send the review text.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev -- -p 3010` | Dev server |
| `npm test` | Tests |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Pull reviews from the configured source |
| `npm run user` | Manage accounts |
| `npm run lint` | ESLint |

## Built with

Next.js 16 · TypeScript · Postgres · Drizzle · Tailwind · OpenRouter

---

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Security notes and known gaps are in [SECURITY.md](SECURITY.md).
Licensed [MIT](LICENSE).
