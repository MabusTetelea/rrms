"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Walking the queue without touching the mouse. Renders nothing — it only
 * exists because the queue is a list of server-rendered links and the keyboard
 * handler needs the ordering.
 *
 * Arrows and J/K both work. Arrows are what anyone reaches for without being
 * told; J/K are the fallback for keyboards with cramped or missing arrow keys,
 * and they keep the hand near G and Ctrl+Enter.
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

      const key = event.key;
      const forward = key === "ArrowDown" || key === "j" || key === "J";
      const back = key === "ArrowUp" || key === "k" || key === "K";
      if (!forward && !back) return;

      /*
       * Swallow the arrow key whether or not the move lands. Left alone it
       * scrolls the page, so at the last review a stray Down would jolt the
       * whole screen instead of doing nothing.
       */
      event.preventDefault();

      // Nothing open yet: forward starts at the top of the queue.
      const from = currentIndex === -1 ? (forward ? -1 : 0) : currentIndex;
      const next = forward ? from + 1 : from - 1;
      if (next < 0 || next >= hrefs.length) return;

      router.push(hrefs[next]);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hrefs, currentIndex, router]);

  return null;
}
