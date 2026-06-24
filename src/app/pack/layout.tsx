/**
 * Pack (warehouse) segment layout — scopes the operator pack console to the
 * plain system font (.backend-ui). Internal tool, not the storefront.
 */
export default function PackFontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="backend-ui">{children}</div>;
}
