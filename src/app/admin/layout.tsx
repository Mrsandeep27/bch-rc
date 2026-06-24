/**
 * Admin segment layout — scopes the whole /admin area (login + authed) to the
 * plain system font (.backend-ui). It does NOT gate auth; the (authed) group
 * keeps its own requireAdmin() layout, and /admin/login stays public.
 */
export default function AdminFontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="backend-ui">{children}</div>;
}
