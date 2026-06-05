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
};

export default nextConfig;
