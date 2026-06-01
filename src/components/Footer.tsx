import Link from "next/link";
import { InstagramIcon, YoutubeIcon } from "@/components/BrandIcons";
import { waLink } from "@/lib/config";

const POLICY_LINKS: { label: string; href: string }[] = [
  { label: "Shipping policy", href: "/policies/shipping" },
  { label: "Replacement policy", href: "/policies/replacement" },
  { label: "Privacy policy", href: "/policies/privacy" },
  { label: "Terms of service", href: "/policies/terms" },
  { label: "Refund policy", href: "/policies/refund" },
];

export default function Footer() {
  return (
    <footer className="bg-brand-ink text-white py-10 sm:py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-white mb-3">Contact</h3>
            <ul className="text-sm text-neutral-400 space-y-1.5">
              <li>
                WhatsApp:{" "}
                <a
                  className="text-brand-red hover:underline"
                  href={waLink()}
                  target="_blank"
                  rel="noopener"
                >
                  +91 99999
                </a>{" "}
                (tap to chat)
              </li>
              <li>
                Email:{" "}
                <a
                  className="hover:text-white hover:underline"
                  href="mailto:hello@bch.in"
                >
                  hello@bch.in
                </a>
              </li>
              <li>Phone: +91 99999 (10am–7pm IST)</li>
              <li>Bangalore HQ: [address]</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Policies</h3>
            <div className="space-y-1.5">
              {POLICY_LINKS.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="block text-sm text-neutral-400 hover:text-white hover:underline"
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Trust</h3>
            <ul className="text-sm text-neutral-400 space-y-1.5">
              <li>CIN: [number]</li>
              <li>GSTIN: [number]</li>
              <li>BIS Cert: [number]</li>
              <li>🇮🇳 Assembled in India</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-3">Follow us</h3>
            <div className="space-y-1.5">
              <a
                href="https://instagram.com/bchrc"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white hover:underline"
              >
                <InstagramIcon size={16} />
                <span>@bchrc</span>
              </a>
              <a
                href="https://youtube.com/bchrc"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white hover:underline"
              >
                <YoutubeIcon size={16} />
                <span>@bchrc</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-neutral-500">
          © 2026 Bharath Cycle Hub · Built in Bangalore with ❤️
        </div>
      </div>
    </footer>
  );
}
