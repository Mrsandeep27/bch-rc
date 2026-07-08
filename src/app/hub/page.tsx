import { redirect } from "next/navigation";

// The hub was promoted to the homepage ("/"). This old URL now permanently
// redirects there so any existing /hub links, bookmarks, or ad destinations
// land on the canonical single storefront. The hub sub-pages
// (/hub/shop/[category]) are separate routes and are unaffected.
export default function HubPage() {
  redirect("/");
}
