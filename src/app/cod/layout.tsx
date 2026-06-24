/**
 * COD (operator verify queue) segment layout — scopes it to the plain system
 * font (.backend-ui). Internal tool, not the storefront.
 */
export default function CodFontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="backend-ui">{children}</div>;
}
