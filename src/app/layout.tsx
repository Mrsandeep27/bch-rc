import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import NavigationLoader from "@/components/NavigationLoader";

export const metadata: Metadata = {
  metadataBase: new URL("https://pocketrccars.com"),
  title: {
    default: "Mini RC Cars from ₹999 — RC Drift Cars | PRC Cars",
    template: "%s | PRC Cars",
  },
  alternates: {
    canonical: "/",
  },
  description:
    "India's most-gifted mini RC cars — 1:64 die-cast RC drift cars with LED, drift wheels & USB-C. From ₹999. Pan-India COD, ships in 24 hrs from Bangalore.",
  keywords: [
    "RC car India",
    "mini RC drift car",
    "RC car gift",
    "drift car remote control",
    "pocket RC cars",
    "PRC Cars",
  ],
  openGraph: {
    title: "Mini RC Cars from ₹999 | PRC Cars",
    description:
      "1:64 RC drift cars · LED · drift wheels · gift-ready box. Mini RC cars delivered pan-India in 24 hrs from Bangalore.",
    url: "https://pocketrccars.com",
    siteName: "PRC Cars",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "PRC Cars — Drift. Race. Pocket. Mini RC drift cars from ₹999.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mini RC Cars from ₹999 | PRC Cars",
    description:
      "Mini RC cars · 1:64 RC drift cars · LED · drift wheels. From ₹999 · COD pan-India.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/logo/prc-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo/prc-favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo/prc-favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/logo/prc-favicon-192.png",
    shortcut: "/logo/prc-favicon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-white text-brand-ink">
        {/* Truck loader on every navigation — wrapped in Suspense because
            NavigationLoader uses useSearchParams() under the hood. */}
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
