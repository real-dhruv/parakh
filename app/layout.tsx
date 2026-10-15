import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-slip", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Parakh — a second opinion on your jewellery estimate",
  description: "Upload a jeweller's estimate. See what you're paying for, what doesn't add up, and what to ask before you pay.",
};
export const viewport: Viewport = { themeColor: "#fbf8f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${fraunces.variable} ${caveat.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
