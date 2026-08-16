import { asc } from "drizzle-orm";
import { BrandVoiceForm } from "@/components/brand-voice-form";
import { GoogleAccount } from "@/components/google-account";
import { PageHeader } from "@/components/shell";
import { db } from "@/db";
import { users } from "@/db/schema";
import { activeModel, isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { requireUser } from "@/lib/auth/session";
import { isQuickLoginEnabled } from "@/lib/auth/quick-login";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getRecentSyncs } from "@/lib/queries";
import { getBrandVoice } from "@/lib/settings";
import { googleSetup } from "@/lib/google-setup";
import { getPublishingSource, getReviewSources, SOURCE_NAMES } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const [voice, syncs] = await Promise.all([getBrandVoice(), getRecentSyncs()]);

  // Who else has access is an admin's business only.
  const accounts = isAdmin
    ? await db
        .select({
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .orderBy(asc(users.email))
    : [];

  const sources = getReviewSources().map((source) => ({
    name: source.name,
    ready: source.isConfigured(),
    hint: source.configHint,
  }));
  const aiReady = isOpenRouterConfigured();
  const publisher = getPublishingSource();
  const google = googleSetup();

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <PageHeader title={t.settings.title} />

      <div className="grid gap-10 px-5 py-6 md:px-8 md:py-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <div className="space-y-10">
          <section>
            <h2 className="text-[15px] font-semibold">{t.settings.voiceTitle}</h2>
            <p className="mt-0.5 mb-5 max-w-lg text-xs text-ink-faint">
              {t.settings.voiceHint}
            </p>
            {isAdmin ? (
              <div className="max-w-lg">
                <BrandVoiceForm voice={voice} t={t} />
              </div>
            ) : (
              /* Operators see the voice they're writing under, but can't move it. */
              <div className="max-w-lg space-y-3">
                <p className="border-l-2 border-mid bg-mid-soft px-3 py-2 text-xs text-ink-soft">
                  {t.login.adminOnly}
                </p>
                <ReadOnly label={t.settings.guidelines} value={voice.guidelines} />
                <ReadOnly
                  label={t.settings.signature}
                  value={voice.signature || "—"}
                />
              </div>
            )}
          </section>

          {/* Everyone sees the connection state — an operator copying replies
              by hand deserves to know why, and whether that's about to change.
              Only an admin gets the button that talks to Google. */}
          <GoogleAccount setup={google} isAdmin={isAdmin} t={t} />

          {isAdmin ? (
            <section>
              <h2 className="text-[15px] font-semibold">{t.settings.accessTitle}</h2>
              <p className="mt-0.5 mb-3 max-w-lg text-xs text-ink-faint">
                {t.settings.accessHint}
              </p>

              <div className="max-w-lg overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="section-rule">
                      <th className="eyebrow py-1.5 text-left">
                        {t.settings.accountName}
                      </th>
                      <th className="eyebrow py-1.5 text-left">
                        {t.settings.accountRole}
                      </th>
                      <th className="eyebrow py-1.5 text-right">
                        {t.settings.accountLastLogin}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.email} className="border-b border-rule">
                        <td className="py-2">
                          <span
                            className={account.active ? "" : "text-ink-faint line-through"}
                          >
                            {account.name}
                          </span>
                          <span className="block font-mono text-[10px] text-ink-faint">
                            {account.email}
                          </span>
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase ${
                              account.role === "admin"
                                ? "bg-ink text-white"
                                : "bg-rule-soft text-ink-soft"
                            }`}
                          >
                            {account.role === "admin"
                              ? t.login.roleAdmin
                              : t.login.roleOperator}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono text-[11px] text-ink-faint">
                          {account.lastLoginAt
                            ? dateFormat.format(account.lastLoginAt)
                            : t.dashboard.never}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 max-w-lg text-xs text-ink-faint">
                {t.settings.accessCli}
              </p>
              <code className="mt-1.5 block max-w-lg overflow-x-auto rounded-[2px] border border-rule bg-surface px-3 py-2 font-mono text-[11px]">
                npm run user -- add anna@linella.md &quot;Anna Rusu&quot; operator
              </code>

              {isQuickLoginEnabled() ? (
                <p className="mt-3 max-w-lg border-l-2 border-mid bg-mid-soft px-3 py-2 text-xs text-ink-soft">
                  <strong className="font-semibold">{t.login.betaTag}:</strong>{" "}
                  {t.settings.quickLoginOn}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="space-y-8">
          <section>
            <h2 className="text-[15px] font-semibold">{t.settings.sourceTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-faint">{t.settings.sourceHint}</p>
            <dl className="mt-3 border-t border-rule">
              {/* REVIEW_SOURCE is a list, so more than one can be live. */}
              {sources.map((source) => (
                <Row key={source.name} label={source.name}>
                  <StatusPill
                    ok={source.ready}
                    okLabel={t.settings.configured}
                    offLabel={t.settings.notConfigured}
                  />
                </Row>
              ))}
              <Row label={t.settings.publishing}>
                <StatusPill
                  ok={Boolean(publisher)}
                  okLabel={publisher ? publisher.name : t.settings.configured}
                  offLabel={t.settings.publishingOff}
                />
              </Row>
              <Row label={t.settings.sourceAvailable}>
                <span className="font-mono text-[11px] text-ink-faint">
                  {SOURCE_NAMES.join(" · ")}
                </span>
              </Row>
            </dl>
            {sources.some((source) => !source.ready) ? (
              <p className="mt-2 border-l-2 border-brand bg-brand-soft px-3 py-2 text-xs text-brand">
                {sources.find((source) => !source.ready)?.hint}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="text-[15px] font-semibold">{t.settings.aiTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-faint">{t.settings.aiHint}</p>
            <dl className="mt-3 border-t border-rule">
              <Row label={t.settings.model}>
                <code className="font-mono text-[13px]">{activeModel()}</code>
              </Row>
              <Row label="Status">
                <StatusPill
                  ok={aiReady}
                  okLabel={t.settings.configured}
                  offLabel={t.settings.notConfigured}
                />
              </Row>
            </dl>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold">{t.settings.syncHistory}</h2>
            {syncs.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">{t.settings.noSyncs}</p>
            ) : (
              <ul className="mt-3 border-t border-rule">
                {syncs.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center justify-between gap-3 border-b border-rule py-2"
                  >
                    <span className="font-mono text-[11px] text-ink-faint">
                      {dateFormat.format(run.finishedAt ?? run.startedAt)}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="tabular text-ink-soft">
                        +{run.reviewsNew} / {run.reviewsUpserted}
                      </span>
                      <span
                        className={
                          run.status === "ok"
                            ? "text-good"
                            : run.status === "error"
                              ? "text-brand"
                              : "text-ink-faint"
                        }
                      >
                        {run.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink-soft">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule py-2">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function StatusPill({
  ok,
  okLabel,
  offLabel,
}: {
  ok: boolean;
  okLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase ${
        ok ? "bg-good-soft text-good" : "bg-brand-soft text-brand"
      }`}
    >
      {ok ? okLabel : offLabel}
    </span>
  );
}
