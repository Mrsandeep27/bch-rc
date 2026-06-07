import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Down for maintenance — Pocket RC Cars",
  description:
    "Pocket RC Cars is offline for scheduled maintenance. WhatsApp +91 63623 46498 for orders.",
  robots: { index: false, follow: false },
};

// Static page rendered inside the existing root layout. No DB calls, no
// client JS, no Header/Footer — Header pulls from auth/session helpers that
// may be intentionally cut while the site is paused.
export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0F0F10",
        color: "#FAFAFA",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#E63946",
            marginBottom: 16,
          }}
        >
          PRC Cars · paused
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 6vw, 44px)",
            lineHeight: 1.1,
            margin: "0 0 16px 0",
            fontWeight: 700,
          }}
        >
          We&rsquo;ll be back shortly.
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.75)",
            margin: "0 0 28px 0",
          }}
        >
          The PRC Cars store is offline for scheduled maintenance. Existing
          orders are unaffected and ship as scheduled from Bangalore.
        </p>
        <a
          href="https://wa.me/916362346498"
          style={{
            display: "inline-block",
            background: "#25D366",
            color: "#fff",
            textDecoration: "none",
            padding: "12px 22px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          WhatsApp +91 63623 46498
        </a>
        <p
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            marginTop: 32,
          }}
        >
          For order status · track via Shiprocket SMS
        </p>
      </div>
    </main>
  );
}
