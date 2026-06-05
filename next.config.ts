import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Our source assets cap at 1024px (rembg pipeline outputs 1024x1024
    // canvases). Default Next.js deviceSizes [640, 750, 828, 1080, 1200,
    // 1920, 2048, 3840] would request 3840w variants for any image with
    // sizes="100vw" - the optimizer can't upscale, but it still generates
    // the soft "1024 stretched to 3840" cache key and serves a fuzzy result.
    // Capping at 1920 reflects what we actually have and stops the wasted
    // cache entries.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    // B07 — long-immutable cache TTLs on the heaviest, never-versioned
    // static media. Vercel's default for files in /public is `public,
    // max-age=0, must-revalidate` (i.e. cache-busted on every request),
    // which means og-image.jpg and product MP4s get re-fetched against
    // origin under load. Pinning these to immutable / 1y stops a surge
    // from hammering the origin. Hashed bundles in /_next/static already
    // ship with `immutable` so they don't need a rule here.
    //
    // Trade-off: changing one of these files now requires renaming the
    // file (or busting via a query param) since browsers + CDN cache
    // it for a year. For og-image / hero / product MP4s this is the
    // correct trade — we change them rarely and we want them sticky.
    const immutableYear = "public, max-age=31536000, immutable";
    return [
      {
        source: "/og-image.jpg",
        headers: [{ key: "Cache-Control", value: immutableYear }],
      },
      {
        source: "/hero/:path*",
        headers: [{ key: "Cache-Control", value: immutableYear }],
      },
      {
        source: "/products/:path*",
        headers: [{ key: "Cache-Control", value: immutableYear }],
      },
      {
        source: "/logo/:path*",
        headers: [{ key: "Cache-Control", value: immutableYear }],
      },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: immutableYear }],
      },
    ];
  },
};

export default nextConfig;
