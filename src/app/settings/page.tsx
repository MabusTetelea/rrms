import { BrandVoiceForm } from "@/components/brand-voice-form";
import { PageHeader } from "@/components/shell";
import { activeModel, isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getRecentSyncs } from "@/lib/queries";
import { getBrandVoice } from "@/lib/settings";
import { getReviewSource, SOURCE_NAMES } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getDict(locale);

  const [voice, syncs] = await Promise.all([getBrandVoice(), getRecentSyncs()]);

  const source = getReviewSource();
  const sourceReady = source.isConfigured();
  const aiReady = isOpenRouterConfigured();

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <PageHeader title={t.settings.title} />

      <div className="grid gap-10 px-5 py-6 md:px-8 md:py-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <section>
          <h2 className="text-[15px] font-semibold">{t.settings.voiceTitle}</h2>
          <p className="mt-0.5 mb-5 max-w-lg text-xs text-ink-faint">
            {t.settings.voiceHint}
          </p>
          <div className="max-w-lg">
            <BrandVoiceForm voice={voice} t={t} />
          </div>
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="text-[15px] font-semibold">{t.settings.sourceTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-faint">{t.settings.sourceHint}</p>
            <dl className="mt-3 border-t border-rule">
              <Row label={t.settings.sourceActive}>
                <code className="font-mono text-[13px]">{source.name}</code>
              </Row>
              <Row label="Status">
                <StatusPill
                  ok={sourceReady}
                  okLabel={t.settings.configured}
                  offLabel={t.settings.notConfigured}
                />
              </Row>
              <Row label="REVIEW_SOURCE">
                <span className="font-mono text-[11px] text-ink-faint">
                  {SOURCE_NAMES.join(" · ")}
                </span>
              </Row>
            </dl>
            {!sourceReady ? (
              <p className="mt-2 border-l-2 border-brand bg-brand-soft px-3 py-2 text-xs text-brand">
                {source.configHint}
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
