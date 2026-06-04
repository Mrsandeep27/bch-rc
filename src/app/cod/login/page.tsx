import { CodLoginForm } from "../CodLoginForm";

/**
 * Standalone /cod/login URL. The same form is also rendered inline by /cod
 * when unauthenticated, so users who go to either URL get the same UX.
 */
export default function CodLoginPage() {
  return <CodLoginForm />;
}
