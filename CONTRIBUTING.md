# Contributing

Thanks for looking. Issues and pull requests are welcome.

## Getting it running

```bash
npm install
docker compose up -d
npm run db:migrate && npm run db:seed
npm run dev -- -p 3010
```

No keys are needed. The default `mock` source generates 12 stores and ~480
Romanian/Russian reviews, deterministically — the same data every time, so
screenshots and numbers stay stable between runs.

## Before opening a pull request

```bash
npm test          # unit tests
npx tsc --noEmit  # types
npx eslint .      # lint
```

CI runs all three. There is no database in CI, so tests must stay free of it —
which is also why the test suite covers the pure logic (language detection,
topic tagging, zone resolution, the rate limiter, JSON salvage) rather than the
query layer.

## What the code expects of you

**Comments explain why, not what.** The code says what it does. A comment earns
its place by recording the reasoning that isn't visible — a constraint, a
trade-off, or a bug that shaped the design. Several of the comments here exist
because something subtle broke once.

**Server-only code stays server-only.** `src/lib/queries.ts` imports the
Postgres driver and must never reach a client component. Presentation helpers
belong in `src/lib/format.ts`, which is safe to import anywhere.

**Every server action authenticates itself.** They are individually addressable
POST endpoints; the check in the layout does not cover them. Hiding a button is
courtesy, not a boundary.

**Nothing is published without a human.** The model drafts. A person clicks. If
you are adding anything that reaches the public, keep that property.

**No brand names.** The chain a deployment answers for comes from
`COMPANY_NAME` and `COMPANY_DESCRIPTION`. Nothing in the source should assume a
particular company, country or language.

## Layout

```
src/
  app/                 routes and server actions
  components/          UI
  db/                  Drizzle schema and connection
  lib/
    ai/                OpenRouter client, prompt, suggestion storage
    sources/           mock | gbp | outscraper | serpapi adapters
    queries.ts         every read query (server only)
    text.ts            language detection and topic tagging, no LLM
    zones.ts           grouping stores by area
    format.ts          pure helpers, safe in the browser
```

## Adding a review source

Implement the interface in `src/lib/sources/types.ts` and register it in
`src/lib/sources/index.ts`. The rest of the app doesn't know which sources are
live. If it can also post replies, implement `ReplyCapableSource` — and keep
publishing behind its own switch, separate from reading.
