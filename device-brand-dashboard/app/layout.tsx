import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMAV Device by Brand Dashboard",
  description: "Interactive infographic dashboard for Device by Brand performance in BMA V - Central.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "BMAV Device by Brand • August 2026",
    description: "Target, Actual, Brand, Shop and Daily Trend performance dashboard.",
    images: ["https://bmav-device-brand-aug26.amnattyy.chatgpt.site/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
