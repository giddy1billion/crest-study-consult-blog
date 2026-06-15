import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Legacy /market-intelligence route.
 * The research surface is now the canonical /study-intelligence hub.
 * Permanent redirect preserves any existing inbound links and SEO equity.
 */
export async function loader({}: LoaderFunctionArgs) {
  return redirect("/study-intelligence", 301);
}
