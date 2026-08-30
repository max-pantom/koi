import type { Metadata, Viewport } from "next";
import { Agentation } from "agentation";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const openRunde = localFont({
  src: [
    { path: "../../src/assets/fonts/OpenRunde-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../src/assets/fonts/OpenRunde-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../src/assets/fonts/OpenRunde-Semibold.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-open-runde",
});

export const metadata: Metadata = {
  title: "Koi — Your visual reference library",
  description: "A fast, local-first home for images, videos, articles, and everything that inspires you.",
  metadataBase: new URL("https://github.com/max-pantom/koi"),
  openGraph: {
    title: "Koi — Your visual reference library",
    description: "Save what inspires you. Find it again in seconds.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={openRunde.variable}>
        {children}
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
