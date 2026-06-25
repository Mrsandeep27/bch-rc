import type { Metadata } from "next";
import CartDrawer16 from "@/components/store16/CartDrawer16";

export const metadata: Metadata = {
  title: "PRC Cars — bigger RC drift cars | Send it sideways",
  description:
    "Proper 1:16 RC drift cars — full proportional steering, 4WD, rubber tyres. From ₹2,899. COD pan-India, ships from Bangalore.",
};

// Fonts are intentionally the SAME as the 1:64 store (Nippo display + General
// Sans body, inherited from the root layout). Only the colour palette differs,
// via the `.store-16` scope in globals.css.
export default function Store16Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="store-16 relative flex min-h-screen flex-col">
      {children}
      <CartDrawer16 />
    </div>
  );
}
