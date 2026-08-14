import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";

/**
 * Everything in this group is behind sign-in. The check here covers page
 * renders; server actions each guard themselves, because they're separately
 * addressable endpoints that never pass through this layout.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return <Shell user={user}>{children}</Shell>;
}
