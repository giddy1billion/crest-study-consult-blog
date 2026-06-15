import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Legacy /research/:slug report route.
 * Reports now live under the /study-intelligence category.
 * Permanent redirect preserves existing inbound links and SEO equity.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  return redirect(slug ? `/study-intelligence/${slug}` : "/study-intelligence", 301);
}
