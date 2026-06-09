import { TRUST } from "@/lib/config";

export default function TrustStrip() {
  return (
    <div className="bg-brand-cream py-4 sm:py-5 border-y border-brand-line">
      <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
        <p className="whitespace-nowrap text-center text-sm sm:text-base text-brand-ink-soft font-medium px-4">
          <span className="text-gold">★★★★★</span>
          {" · "}
          {TRUST.rating}
          {" · "}
          {TRUST.ordersShipped.toLocaleString("en-IN")}+ orders shipped pan-India
          {" · "}
          Featured in @daddydrones · @youcliq · @highgear
        </p>
      </div>
    </div>
  );
}
