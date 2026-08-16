"use client";

import { useState, useTransition } from "react";
import { testGoogleConnectionAction } from "@/app/actions";
import type { GoogleSetup } from "@/lib/google-setup";
import type { Dict } from "@/lib/i18n";

/**
 * The Google connection, stated plainly: what is in place, what is missing, and
 * a button that asks Google rather than guessing.
 *
 * There is no field here to paste a secret into. Credentials live in
 * .env.local on the server; this screen only ever reports whether each one is
 * present. See lib/google-setup for why.
 */
export function GoogleAccount({
  setup,
  isAdmin,
  t,
}: {
  setup: GoogleSetup;
  isAdmin: boolean;
  t: Dict;
}) {
  const [pending, startTest] = useTransition();
  const [result, setResult] = useState<
    { ok: true; locations: number } | { ok: false; error: string } | null
  >(null);

  const g = t.settings.google;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{g.title}</h2>
        <span
          className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase ${
            setup.connected ? "bg-good-soft text-good" : "bg-brand-soft text-brand"
          }`}
        >
          {setup.connected ? g.connected : g.notConnected}
        </span>
      </div>
      <p className="mt-0.5 mb-3 max-w-lg text-xs text-ink-faint">{g.hint}</p>

      <dl className="max-w-lg border-t border-rule">
        {setup.requirements.map((req) => (
          <Row
            key={req.env}
            label={g.req[req.key]}
            env={req.env}
            present={req.present}
            yes={g.present}
            no={g.missing}
          />
        ))}
        <Row
          label={g.readingGoogle}
          env="REVIEW_SOURCE"
          present={setup.readingGoogle}
          yes={g.on}
          no={g.off}
        />
        <Row
          label={g.publishing}
          env="PUBLISH_REPLIES"
          present={setup.publishingOn}
          yes={g.on}
          no={g.off}
        />
      </dl>

      {isAdmin ? (
        <div className="mt-3 max-w-lg">
          <button
            type="button"
            disabled={pending || !setup.credentialsReady}
            onClick={() =>
              startTest(async () => {
                setResult(null);
                setResult(await testGoogleConnectionAction());
              })
            }
            className="rounded-[2px] border border-rule bg-surface px-3 py-1.5 text-[13px] transition-colors hover:bg-rule-soft disabled:opacity-40"
            // Nothing to test until all four values are in place; the button
            // says why rather than failing with a message from Google.
            title={setup.credentialsReady ? undefined : g.testNeedsCredentials}
          >
            {pending ? g.testing : g.test}
          </button>

          {result ? (
            <p
              role="status"
              className={`mt-2 border-l-2 px-3 py-2 text-xs ${
                result.ok
                  ? "border-good bg-good-soft text-good"
                  : "border-brand bg-brand-soft text-brand"
              }`}
            >
              {result.ok
                ? `${g.testOk} ${result.locations}`
                : `${g.testFailed}: ${result.error}`}
            </p>
          ) : null}
        </div>
      ) : null}

      {!setup.connected ? (
        <div className="mt-4 max-w-lg border border-rule bg-surface px-4 py-3">
          <p className="eyebrow">{g.howTo}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-ink-soft">
            <li>{g.step1}</li>
            <li>{g.step2}</li>
            <li>{g.step3}</li>
            <li>{g.step4}</li>
          </ol>
          <p className="mt-3 text-xs text-ink-faint">{g.secretsNote}</p>
        </div>
      ) : null}
    </section>
  );
}

function Row({
  label,
  env,
  present,
  yes,
  no,
}: {
  label: string;
  env: string;
  present: boolean;
  yes: string;
  no: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-2">
      <dt className="min-w-0">
        <span className="block text-sm">{label}</span>
        <code className="font-mono text-[10px] text-ink-faint">{env}</code>
      </dt>
      <dd
        className={`shrink-0 font-mono text-[11px] ${
          present ? "text-good" : "text-ink-faint"
        }`}
      >
        {present ? `✓ ${yes}` : `✗ ${no}`}
      </dd>
    </div>
  );
}
