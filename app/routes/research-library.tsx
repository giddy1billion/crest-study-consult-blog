import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Legacy /research route.
 * The research library is now the canonical /study-intelligence hub.
 * Permanent redirect preserves existing inbound links and SEO equity.
 */
export async function loader({}: LoaderFunctionArgs) {
  return redirect("/study-intelligence", 301);
}
