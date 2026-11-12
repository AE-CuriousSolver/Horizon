import type { Metadata, Viewport } from "next";
import "./globals.css";
import { names } from "@/lib/copy/en-GB";

export const metadata: Metadata = {
  title: names.product,
  description: "A calm, personal list of what's in front of you now.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#171816" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
