import type { Metadata } from "next";
import { Newsreader, Work_Sans } from "next/font/google";
import "./globals.css";

function getMetadataBase() {
  const value =
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (!value) {
    return undefined;
  }

  return new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`);
}

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Re:Form Admin",
  description: "Premium mobile-first internal operations for the Re:Form Pilates studio.",
  metadataBase: getMetadataBase(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${newsreader.variable} ${workSans.variable} bg-canvas text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
