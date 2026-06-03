import { ImageResponse } from "next/og";
import { PRODUCTS } from "@/lib/products";

export const runtime = "edge";
export const alt = "PRC Cars product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = "https://pocketrccars.com";

export default async function OG({ params }: { params: { slug: string } }) {
  const sku = PRODUCTS.find((p) => p.slug === params.slug);
  if (!sku) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0b0b0c",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          PRC Cars
        </div>
      ),
      size
    );
  }

  const heroAbs = `${BASE}${sku.heroImage}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #fff 0%, #fff 55%, #f6f3ec 100%)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 64,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              background: "#e11d2a",
              color: "white",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 2,
              padding: "8px 16px",
              borderRadius: 999,
              marginBottom: 28,
            }}
          >
            PRC CARS · {sku.scale}
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1,
              color: "#0b0b0c",
              letterSpacing: -2,
            }}
          >
            {sku.name}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#444",
              marginTop: 24,
              maxWidth: 540,
              lineHeight: 1.25,
            }}
          >
            {sku.tagline}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              marginTop: 36,
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 900, color: "#0b0b0c" }}>
              ₹{sku.retailINR.toLocaleString("en-IN")}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "#6b7280",
                textDecoration: "line-through",
              }}
            >
              ₹{sku.mrpINR.toLocaleString("en-IN")}
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#0b0b0c",
              marginTop: 28,
              fontWeight: 600,
            }}
          >
            Pan-India COD · ships 24 hrs from Bangalore
          </div>
        </div>
        <div
          style={{
            width: 520,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 36,
          }}
        >
          <img
            src={heroAbs}
            width={460}
            height={460}
            alt={sku.name}
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    ),
    size
  );
}
