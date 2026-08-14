"use client";

import { useState, useTransition } from "react";
import { syncAction } from "@/app/actions";

export function SyncButton({
  label,
  busyLabel,
  failedLabel,
}: {
  label: string;
  busyLabel: string;
  failedLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span className="max-w-xs truncate text-xs text-brand" title={error}>
          {failedLabel}: {error}
        </span>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await syncAction();
            if (!result.ok) setError(result.error);
          })
        }
        className="inline-flex items-center gap-2 rounded-[2px] border border-ink bg-ink px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white"
          />
        ) : null}
        {pending ? busyLabel : label}
      </button>
    </div>
  );
}
