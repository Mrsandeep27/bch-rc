import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "503 — Service Temporarily Unavailable",
  description:
    "The server is temporarily unreachable. Please try again in a few minutes.",
  robots: { index: false, follow: false },
};

// Static error page rendered inside the existing root layout. No DB calls,
// no client JS. Looks like a generic infra outage rather than a deliberate
// pause — no "paused" / "maintenance" / "scheduled" wording.
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
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
            marginBottom: 18,
          }}
        >
          Error 503 · upstream
        </div>
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 88,
            lineHeight: 1,
            fontWeight: 700,
            color: "#FAFAFA",
            margin: "0 0 12px 0",
            letterSpacing: "-0.04em",
          }}
        >
          503
        </div>
        <h1
          style={{
            fontSize: 22,
            lineHeight: 1.25,
            margin: "0 0 12px 0",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Service temporarily unavailable
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 28px 0",
          }}
        >
          The server is unreachable right now. We&rsquo;re looking into it.
          Please try again in a few minutes.
        </p>
        <a
          href="https://wa.me/916362346498"
          style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
            textDecoration: "none",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 500,
            fontSize: 13,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          Urgent? WhatsApp support
        </a>
        <p
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)",
            marginTop: 40,
          }}
        >
          Ref: 503-upstream-gateway-timeout
        </p>
      </div>
    </main>
  );
}
