"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { StarRow } from "@/components/rating";
import {
  generateDraftsAction,
  saveReplyAction,
  setReviewStatusAction,
} from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import type { ReviewDetail } from "@/lib/queries";

type Draft = { id: string; tone: string; text: string; model: string };

/**
 * The working surface: the customer's review at the top, three machine drafts
 * below it, and one editable box the operator actually copies from. Copying is
 * the terminal action — publishing happens in Google Business Profile.
 */
export function ReplyPanel({
  review,
  t,
  locale,
  aiEnabled,
}: {
  review: ReviewDetail;
  t: Dict;
  locale: string;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(review.suggestions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState(review.reply?.text ?? "");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, startGenerating] = useTransition();
  const [saving, startSaving] = useTransition();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const selectedDraft = drafts.find((d) => d.id === selectedId) ?? null;

  function generate() {
    startGenerating(async () => {
      setError(null);
      const result = await generateDraftsAction(review.id, instruction);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDrafts(result.suggestions);
      // Load the standard register straight into the box — that's the one an
      // operator publishes most of the time.
      const preferred =
        result.suggestions.find((s) => s.tone === "standard") ?? result.suggestions[0];
      if (preferred) {
        setSelectedId(preferred.id);
        setText(preferred.text);
      }
    });
  }

  async function copyToClipboard(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard API needs a secure context; fall back for plain-http hosts.
      const scratch = document.createElement("textarea");
      scratch.value = value;
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(scratch);
      return ok;
    }
  }

  function copyOnly() {
    void copyToClipboard(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function copyAndSave() {
    if (!text.trim()) {
      setError(t.inbox.emptyReply);
      return;
    }
    startSaving(async () => {
      setError(null);
      const copiedOk = await copyToClipboard(text);
      const result = await saveReplyAction(
        review.id,
        text,
        selectedDraft?.id ?? null,
        selectedDraft?.text ?? null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (copiedOk) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
      router.refresh();
    });
  }

  function setStatus(status: "new" | "skipped") {
    startSaving(async () => {
      setError(null);
      const result = await setReviewStatusAction(review.id, status);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const statusLabel: Record<string, string> = {
    new: t.inbox.statusNew,
    in_progress: t.inbox.statusInProgress,
    replied: t.inbox.statusReplied,
    skipped: t.inbox.statusSkipped,
  };

  const pickDraft = useCallback(
    (index: number) => {
      const draft = drafts[index];
      if (!draft) return;
      setSelectedId(draft.id);
      setText(draft.text);
    },
    [drafts],
  );

  /**
   * Keyboard operation. Someone clearing eighty reviews a day shouldn't have to
   * hit three separate mouse targets per review, so: G drafts, 1–3 pick one,
   * Ctrl/Cmd+Enter copies and files it. Every shortcut is printed on the
   * control it drives — an invisible shortcut is no shortcut.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      const inComposer = target === composerRef.current;

      // Ctrl/Cmd+Enter works from inside the composer too — that's the point.
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        copyAndSave();
        return;
      }

      if (typing || inComposer || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key >= "1" && event.key <= "9") {
        const index = Number(event.key) - 1;
        if (index < drafts.length) {
          event.preventDefault();
          pickDraft(index);
        }
        return;
      }

      if (event.key.toLowerCase() === "g" && aiEnabled && !generating) {
        event.preventDefault();
        generate();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, aiEnabled, generating, text, selectedId, instruction]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The review ------------------------------------------------------ */}
      <div className="border-b border-rule px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StarRow rating={review.rating} size={15} />
            <span className="font-mono text-[11px] tracking-[0.08em] text-ink-faint uppercase">
              {review.store.code} · {review.store.name}
            </span>
          </div>
          <span className="eyebrow">{statusLabel[review.status] ?? review.status}</span>
        </div>

        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          {review.authorName ?? "—"} · {dateFormat.format(new Date(review.publishedAt))}
          {review.language ? ` · ${review.language.toUpperCase()}` : ""}
        </p>

        {review.text ? (
          <blockquote className="mt-4 border-l-2 border-ink/15 pl-4 font-serif text-[17px] leading-[1.6] text-ink">
            {review.text}
          </blockquote>
        ) : (
          <p className="mt-4 text-sm text-ink-faint italic">{t.inbox.noText}</p>
        )}

        {review.topics?.length ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {review.topics.map((topic) => (
              <li
                key={topic}
                className="rounded-[2px] border border-rule bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] text-ink-soft uppercase"
              >
                {t.topics[topic as keyof Dict["topics"]] ?? topic}
              </li>
            ))}
          </ul>
        ) : null}

        {review.existingReplyText ? (
          <div className="mt-4 border-l-2 border-good/40 bg-good-soft/50 py-2 pl-4 pr-3">
            <p className="eyebrow text-good">{t.inbox.repliedOnGoogle}</p>
            <p className="mt-1 font-serif text-sm leading-relaxed">
              {review.existingReplyText}
            </p>
          </div>
        ) : null}

        {review.store.googleUrl ? (
          <a
            href={review.store.googleUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            {t.inbox.openInGoogle} ↗
          </a>
        ) : null}
      </div>

      {/* Drafts ---------------------------------------------------------- */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{t.inbox.drafts}</h2>
            <p className="mt-0.5 text-xs text-ink-faint">{t.inbox.draftsHint}</p>
          </div>
          {aiEnabled ? (
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-[2px] border border-machine-rule bg-machine px-3 py-2 text-sm font-medium text-machine-ink transition-colors hover:brightness-97 disabled:opacity-55"
            >
              {generating ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-machine-ink/25 border-t-machine-ink"
                />
              ) : null}
              {generating
                ? t.inbox.generating
                : drafts.length
                  ? t.inbox.regenerate
                  : t.inbox.generate}
              {!generating ? <kbd className="kbd ml-0.5">G</kbd> : null}
            </button>
          ) : null}
        </div>

        {!aiEnabled ? (
          <div className="mt-4 border border-rule bg-surface px-4 py-4">
            <p className="text-sm font-medium">{t.inbox.aiOff}</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">{t.inbox.aiOffBody}</p>
          </div>
        ) : null}

        {aiEnabled ? (
          <label className="mt-4 block">
            <span className="eyebrow">{t.inbox.extraInstruction}</span>
            <input
              type="text"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={t.inbox.extraPlaceholder}
              className="mt-1.5 w-full rounded-[2px] border border-rule bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
            />
          </label>
        ) : null}

        {error ? (
          <p className="mt-4 border-l-2 border-brand bg-brand-soft px-3 py-2 text-sm text-brand">
            {t.inbox.genFailed}: {error}
          </p>
        ) : null}

        {/* Placeholders keep the layout still while the model writes. */}
        {generating ? (
          <ul className="mt-4 grid gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-[2px] border border-machine-rule bg-machine/45 px-4 py-3"
                style={{ animationDelay: `${i * 140}ms` }}
              >
                <span className="block h-2 w-16 rounded-[1px] bg-machine-rule" />
                <span className="mt-3 block h-2.5 w-full rounded-[1px] bg-machine-rule/70" />
                <span className="mt-1.5 block h-2.5 w-11/12 rounded-[1px] bg-machine-rule/70" />
                <span className="mt-1.5 block h-2.5 w-2/3 rounded-[1px] bg-machine-rule/70" />
              </li>
            ))}
          </ul>
        ) : null}

        {!generating && drafts.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {drafts.map((draft, index) => {
              const isSelected = draft.id === selectedId;
              return (
                <li
                  key={draft.id}
                  className="draft-in"
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => pickDraft(index)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-[2px] border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-machine-ink bg-machine ring-1 ring-machine-ink"
                        : "border-machine-rule bg-machine/45 hover:bg-machine"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <kbd className="kbd">{index + 1}</kbd>
                        <span className="font-mono text-[10px] tracking-[0.14em] text-machine-ink uppercase">
                          {t.tone[draft.tone as keyof Dict["tone"]] ?? draft.tone}
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          isSelected ? "font-semibold text-machine-ink" : "text-ink-faint"
                        }`}
                      >
                        {isSelected ? `✓ ${t.inbox.selected}` : t.inbox.useDraft}
                      </span>
                    </span>
                    <span className="mt-2 block font-serif text-[15px] leading-[1.55] text-ink">
                      {draft.text}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="mt-1 font-mono text-[10px] text-ink-faint">
              {drafts[0]?.model}
            </li>
          </ul>
        ) : null}
      </div>

      {/* Composer -------------------------------------------------------- */}
      <div className="border-t border-rule bg-surface px-5 py-4 md:px-7">
        <label className="block">
          <span className="eyebrow">{t.inbox.yourReply}</span>
          <textarea
            ref={composerRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t.inbox.replyPlaceholder}
            rows={4}
            className="mt-1.5 w-full resize-y rounded-[2px] border border-rule bg-paper px-3 py-2.5 font-serif text-[15px] leading-[1.55] placeholder:font-sans placeholder:text-sm placeholder:text-ink-faint"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAndSave}
            disabled={saving || !text.trim()}
            className="inline-flex items-center gap-2 rounded-[2px] bg-ink px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {copied ? t.inbox.copied : t.inbox.copyReply}
            <kbd className="kbd kbd-invert">Ctrl ⏎</kbd>
          </button>
          <button
            type="button"
            onClick={copyOnly}
            disabled={!text.trim()}
            className="rounded-[2px] border border-rule px-3 py-2 text-sm transition-colors hover:bg-rule-soft disabled:opacity-40"
          >
            {t.inbox.copyOnly}
          </button>

          <span className="ml-auto flex items-center gap-2">
            {review.status === "skipped" || review.status === "replied" ? (
              <button
                type="button"
                onClick={() => setStatus("new")}
                disabled={saving}
                className="rounded-[2px] border border-rule px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-rule-soft"
              >
                {t.inbox.reopen}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatus("skipped")}
                disabled={saving}
                className="rounded-[2px] border border-rule px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-rule-soft"
              >
                {t.inbox.skip}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
