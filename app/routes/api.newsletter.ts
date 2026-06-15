/**
 * Newsletter API Route
 * 
 * POST /api/newsletter - Subscribe to newsletter
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { subscribeToNewsletter } from "~/utils/email.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== "POST") {
    return data({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const firstName = formData.get("firstName") as string | null;
  const source = formData.get("source") as string | null;

  if (!email) {
    return data({ success: false, error: "Email is required" }, { status: 400 });
  }

  const result = await subscribeToNewsletter(
    email, 
    firstName || undefined,
    source || "newsletter_form"
  );

  return data(result, { 
    status: result.success ? 200 : 400,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Prevent GET requests
export function loader({}: LoaderFunctionArgs) {
  return data({ error: "Method not allowed" }, { status: 405 });
}
