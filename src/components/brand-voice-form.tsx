"use client";

import { useState, useTransition } from "react";
import { saveBrandVoiceAction } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import type { BrandVoice } from "@/lib/settings";

export function BrandVoiceForm({ voice, t }: { voice: BrandVoice; t: Dict }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setStatus("idle");
          const result = await saveBrandVoiceAction(formData);
          if (result.ok) {
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 2200);
          } else {
            setStatus("error");
            setError(result.error);
          }
        })
      }
      className="grid gap-5"
    >
      <Field label={t.settings.companyName}>
        <input
          name="companyName"
          defaultValue={voice.companyName}
          className="input"
        />
      </Field>

      <Field label={t.settings.guidelines}>
        <textarea
          name="guidelines"
          defaultValue={voice.guidelines}
          rows={5}
          className="input resize-y leading-relaxed"
        />
      </Field>

      <Field label={t.settings.contactChannel} hint={t.settings.contactHint}>
        <input
          name="contactChannel"
          defaultValue={voice.contactChannel}
          placeholder="feedback@linella.md"
          className="input"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.settings.signature} hint={t.settings.signatureHint}>
          <input
            name="signature"
            defaultValue={voice.signature}
            placeholder="Echipa Linella"
            className="input"
          />
        </Field>

        <Field label={t.settings.maxSentences}>
          <input
            name="maxSentences"
            type="number"
            min={1}
            max={8}
            defaultValue={voice.maxSentences}
            className="input tabular w-24"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[2px] bg-ink px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {t.common.save}
        </button>
        {status === "saved" ? (
          <span className="text-sm text-good">{t.common.saved}</span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm text-brand">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}
