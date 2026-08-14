"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * J / K walk the queue without touching the mouse. Renders nothing — it only
 * exists because the queue is a list of server-rendered links and the keyboard
 * handler needs the ordering.
 */
export function QueueKeys({
  hrefs,
  currentIndex,
}: {
  hrefs: string[];
  currentIndex: number;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k") return;

      // Nothing open yet: J starts at the top of the queue.
      const from = currentIndex === -1 ? (key === "j" ? -1 : 0) : currentIndex;
      const next = key === "j" ? from + 1 : from - 1;
      if (next < 0 || next >= hrefs.length) return;

      event.preventDefault();
      router.push(hrefs[next]);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hrefs, currentIndex, router]);

  return null;
}
