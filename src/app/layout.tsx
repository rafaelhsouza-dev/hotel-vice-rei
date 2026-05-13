import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL("https://www.hotelvicerei.com"),
  title: {
    default: "Hotel Vice-Rei · Porto",
    template: "%s · Hotel Vice-Rei",
  },
  description:
    "Boutique hotel in Porto. Elegant rooms, warm hospitality and a prime location on Rua Júlio Dinis.",
  openGraph: {
    type: "website",
    siteName: "Hotel Vice-Rei",
    locale: "pt_PT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
