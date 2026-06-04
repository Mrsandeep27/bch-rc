import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import NavigationLoader from "@/components/NavigationLoader";

export const metadata: Metadata = {
  metadataBase: new URL("https://pocketrccars.com"),
  title: {
    default: "Mini RC Drift Cars from ₹1,299 | PRC Cars",
    template: "%s | PRC Cars",
  },
  alternates: {
    canonical: "/",
  },
  description:
    "India's most-gifted mini RC drift cars. LED headlights, swappable drift wheels, 1:64 scale. From ₹1,299. Pan-India COD. Ships in 24 hrs from Bangalore.",
  keywords: [
    "RC car India",
    "mini RC drift car",
    "RC car gift",
    "drift car remote control",
    "pocket RC cars",
    "PRC Cars",
  ],
  openGraph: {
    title: "Mini RC Drift Cars from ₹1,299 | PRC Cars",
    description:
      "LED · drift wheels · gift-ready box. Delivered pan-India in 24 hrs from Bangalore.",
    url: "https://pocketrccars.com",
    siteName: "PRC Cars",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "PRC Cars — Drift. Race. Pocket. Mini RC drift cars from ₹1,299.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mini RC Drift Cars from ₹1,299 | PRC Cars",
    description:
      "LED · drift wheels · gift-ready box. From ₹1,299 · COD pan-India.",
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
