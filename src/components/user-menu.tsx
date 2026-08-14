"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/auth-actions";
import type { SessionUser } from "@/lib/auth/session";

export function UserMenu({
  user,
  signOutLabel,
  roleLabel,
}: {
  user: SessionUser;
  signOutLabel: string;
  roleLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-white/90">
          {user.name}
        </span>
        <span className="block font-mono text-[10px] tracking-[0.1em] text-white/40 uppercase">
          {roleLabel}
        </span>
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => logoutAction())}
        className="shrink-0 rounded-[2px] border border-white/15 px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-white/55 uppercase transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        {signOutLabel}
      </button>
    </div>
  );
}
