# Security

## Reporting something

Open a [private security advisory](https://github.com/MabusTetelea/rrms/security/advisories/new)
rather than a public issue. If that isn't available to you, open an issue saying
only that you've found something — no details — and a contact will follow.

## What this app holds

Running it means holding credentials that matter:

- **A Google refresh token**, if publishing is switched on. Anyone with it can
  post replies publicly as your business. It cannot read email or spend money,
  but it speaks with your name.
- **An OpenRouter API key**, which can spend money if a paid model is set.
- **Customer review text**, which is public on Google but is still other
  people's words, sometimes naming staff.

All of it belongs in `.env.local`, which is git-ignored. Nothing here reads
credentials from the database or displays them in the interface — the Settings
page reports only whether each value is *present*, never what it is.

## What the app does to protect itself

- **Passwords** are scrypt (N=32768, r=8) with per-user salts, and the cost
  parameters travel with the hash so they can be raised later.
- **Sessions** are server-side rows, not self-contained tokens. Signing out or
  disabling an account ends access on the next request. Only the SHA-256 of the
  cookie value is stored, so a database dump hands over no working sessions.
- **Every server action checks its own authentication and role.** Actions are
  individually addressable endpoints; a check in a layout does not cover them.
- **The sync endpoint fails closed.** With `SYNC_SECRET` unset it refuses every
  request rather than running unauthenticated, and the bearer token is compared
  in constant time.
- **Drafting is rate limited** per operator, so one account cannot drain a
  shared API allowance.
- **Publishing is never automatic.** It requires an explicit click and a
  confirmation showing the exact text, and Google is called before the database
  is written, so a failed publish never leaves a review marked as answered.

## Before you put real data in it

- Set `ENABLE_QUICK_LOGIN=false` and delete the demo accounts. Quick login
  bypasses password checks by design; it exists to demo the app.
- Set a real `SYNC_SECRET`.
- Decide deliberately about free AI models. Some providers may train on what
  they are sent. The prompt never sends the reviewer's name, but it does send
  the review text.

## Known gaps

Stated plainly rather than left to be discovered:

- Rate limiting is in memory, so it resets on restart and is per-process. It
  makes online guessing pointless; it is not a substitute for a rate limiter at
  the edge if you run more than one instance.
- Sign-in reveals whether an email exists through response timing: an unknown
  address returns immediately, a known one costs a password hash.
- The three live review sources have never been run against a real API key.
