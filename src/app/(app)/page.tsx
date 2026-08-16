import { redirect } from "next/navigation";

/**
 * The desk opens on the work, not on a summary.
 *
 * Signing in used to land on a page of figures that couldn't be acted on, and
 * every session started with the same click through to the queue. The numbers
 * still exist — they moved to /overview — but they are something you go and
 * look at, not something standing between you and the first review.
 */
export default function Home() {
  redirect("/inbox");
}
