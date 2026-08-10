import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "@/app/globals.css";

/** Root layout for the backoffice — never indexed, always Portuguese. */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Backoffice · Hotel Vice-Rei",
  icons: { icon: "/icon-192.png" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#14110f",
  colorScheme: "light",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--color-bg)]">{children}</body>
    </html>
  );
}
