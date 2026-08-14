import type { Metadata } from "next";
import { Golos_Text, IBM_Plex_Mono, PT_Serif } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { getLocale } from "@/lib/locale-server";

/*
 * Three voices, never mixed: Golos Text for the interface, PT Serif for the
 * customer's own words, IBM Plex Mono for codes, dates and figures. All three
 * carry full Cyrillic and Romanian coverage, which rules out most of the
 * usual suspects.
 */
const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Linella — Review desk",
  description:
    "Read every Google review across Linella stores and publish a reply that sounds like a person.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${golos.variable} ${ptSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
