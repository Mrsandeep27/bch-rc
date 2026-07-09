import Link from "next/link";
import { ArrowLeft, Hammer, type LucideIcon } from "lucide-react";

/**
 * Placeholder for admin sections that are designed but not yet built. Keeps the
 * sidebar fully navigable (no 404s) while the real module is implemented, and
 * is honest about status rather than showing fake data.
 */
export function ComingSoon({
  title,
  icon: Icon = Hammer,
  description,
  planned,
}: {
  title: string;
  icon?: LucideIcon;
  description: string;
  planned?: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">{title}</h1>
        <p className="text-sm text-brand-ink-soft mt-1">{description}</p>
      </div>

      <div className="bg-white rounded-2xl border border-brand-line p-8 sm:p-10 text-center">
        <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-brand-cream text-brand-red">
          <Icon size={26} />
        </div>
        <h2 className="mt-4 font-semibold text-brand-ink text-lg">Designed — build in progress</h2>
        <p className="mt-1.5 text-sm text-brand-ink-soft max-w-md mx-auto">
          The layout for this section is approved in the design preview. It&apos;s next in the
          build queue and will replace this placeholder with the real, data-backed screen.
        </p>

        {planned && planned.length > 0 && (
          <ul className="mt-6 inline-flex flex-col gap-2 text-left text-sm text-brand-ink-soft">
            {planned.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-red shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:text-brand-red transition-colors"
          >
            <ArrowLeft size={15} /> Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
