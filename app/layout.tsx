import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-slip", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Parakh — a second opinion on your jewellery estimate",
  description: "Upload a jeweller's estimate. See what you're paying for, what doesn't add up, and what to ask before you pay.",
};
// The meta tag cannot read CSS tokens; this is the hex of --color-paper.
export const viewport: Viewport = { themeColor: "#faf7f1" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${instrument.variable} ${fraunces.variable} ${caveat.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
