import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Legacy /cities/:slug route (real-estate-era city pages, no longer used).
 * Redirects to the canonical /study-intelligence hub.
 */
export async function loader({}: LoaderFunctionArgs) {
  return redirect("/study-intelligence", 301);
}
