import type { Route } from "./+types/unsubscribe";
import { data, Form, Link, useLoaderData, useActionData, useNavigation } from "react-router";
import { Header, Footer } from "~/components/layout";
import { BRAND, SEO_DEFAULTS } from "~/utils/constants";
import {
  getSubscriberStatusByEmail,
  unsubscribeByEmail,
  resubscribeByEmail,
  type EmailSubscriptionState,
} from "~/utils/email.server";
import {
  verifyUnsubscribeToken,
  generateUnsubscribeToken,
} from "~/utils/unsubscribe-token.server";

/**
 * Public Unsubscribe Page — /unsubscribe?email=…&t=…
 *
 * Caution-first design:
 * - The GET loader NEVER mutates subscription state, so email-scanner prefetch
 *   or accidental link clicks can't remove a reader.
 * - Every email link carries a signed HMAC token (`t`) tied to the address.
 *   A tampered/forged token is rejected server-side, preventing a third party
 *   from forging unsubscribe requests for arbitrary addresses.
 * - Manual self-service (typing your own email, no token) remains available as
 *   a fallback; the mutation still requires an explicit POST confirmation.
 */

export function meta(): Route.MetaDescriptors {
  return [
    { title: `Unsubscribe${SEO_DEFAULTS.titleSuffix}` },
    { name: "robots", content: "noindex, nofollow" },
    {
      name: "description",
      content: `Manage your ${BRAND.name} newsletter subscription.`,
    },
  ];
}

type LoaderData = {
  email: string;
  emailValid: boolean;
  state: EmailSubscriptionState | "missing" | "invalid-token";
  firstName: string | null;
  /** Whether a valid signed token accompanied the request */
  verified: boolean;
  /** A valid signed token to carry through POST forms (empty when unverified) */
  token: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const rawEmail = (url.searchParams.get("email") || "").trim();
  const token = url.searchParams.get("t") || "";

  // No email provided — show the manual lookup form (no mutation).
  if (!rawEmail) {
    return data<LoaderData>(
      { email: "", emailValid: false, state: "missing", firstName: null, verified: false, token: "" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailValid = emailRegex.test(rawEmail.toLowerCase());

  if (!emailValid) {
    return data<LoaderData>(
      { email: rawEmail, emailValid: false, state: "not-found", firstName: null, verified: false, token: "" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // If a token is present, it MUST be valid for this email. A present-but-wrong
  // token is treated as a tampering attempt and rejected.
  if (token && !verifyUnsubscribeToken(rawEmail, token)) {
    return data<LoaderData>(
      {
        email: rawEmail.toLowerCase(),
        emailValid: true,
        state: "invalid-token",
        firstName: null,
        verified: false,
        token: "",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const verified = Boolean(token) && verifyUnsubscribeToken(rawEmail, token);
  const { state, firstName } = await getSubscriberStatusByEmail(rawEmail);

  return data<LoaderData>(
    {
      email: rawEmail.toLowerCase(),
      emailValid: true,
      state,
      firstName,
      verified,
      // Re-issue a fresh valid token so the POST forms remain one-click eligible.
      token: verified ? generateUnsubscribeToken(rawEmail) : "",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

type ActionData =
  | { ok: true; intent: "unsubscribe" | "resubscribe"; email: string; message: string }
  | { ok: false; message: string };

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const email = String(formData.get("email") || "");
  const token = String(formData.get("token") || "");
  const reason = formData.get("reason") ? String(formData.get("reason")) : null;

  // If a token is supplied it must verify. (Manual flow supplies no token.)
  if (token && !verifyUnsubscribeToken(email, token)) {
    return data<ActionData>(
      { ok: false, message: "This link is invalid or has been tampered with. Please use the unsubscribe link from your email." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (intent === "unsubscribe") {
    const result = await unsubscribeByEmail(email, reason);
    if (!result.success) {
      return data<ActionData>(
        { ok: false, message: result.error || "We couldn't process your request." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    return data<ActionData>(
      {
        ok: true,
        intent: "unsubscribe",
        email: email.toLowerCase(),
        message: "You've been unsubscribed.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (intent === "resubscribe") {
    const result = await resubscribeByEmail(email);
    if (!result.success) {
      return data<ActionData>(
        { ok: false, message: result.error || "We couldn't process your request." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    return data<ActionData>(
      {
        ok: true,
        intent: "resubscribe",
        email: email.toLowerCase(),
        message: "You're subscribed again.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return data<ActionData>(
    { ok: false, message: "Unknown action." },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

const UNSUB_REASONS = [
  "Too many emails",
  "Content not relevant to me",
  "I no longer need study-abroad guidance",
  "I never signed up",
  "Other",
];

export default function Unsubscribe() {
  const { email, state, firstName, verified, token } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  // After a successful POST, show the resolved confirmation screen.
  if (actionData?.ok && actionData.intent === "unsubscribe") {
    return (
      <Shell>
        <Card
          tone="success"
          icon="check"
          title="You've been unsubscribed"
          body={
            <>
              <p className="text-gray-600">
                <span className="font-medium text-gray-900">{actionData.email}</span> will no longer
                receive newsletters from {BRAND.name}. We're sorry to see you go.
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Changed your mind? You can re-subscribe in one click below.
              </p>
            </>
          }
        >
          <Form method="post" className="mt-6">
            <input type="hidden" name="intent" value="resubscribe" />
            <input type="hidden" name="email" value={actionData.email} />
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 disabled:opacity-50"
            >
              Re-subscribe
            </button>
          </Form>
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  if (actionData?.ok && actionData.intent === "resubscribe") {
    return (
      <Shell>
        <Card
          tone="success"
          icon="check"
          title="Welcome back"
          body={
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{actionData.email}</span> is subscribed
              again. Look out for our next study-abroad briefing.
            </p>
          }
        >
          <HomeLink primary />
        </Card>
      </Shell>
    );
  }

  // Error from a POST attempt
  if (actionData && actionData.ok === false) {
    return (
      <Shell>
        <Card
          tone="error"
          icon="warn"
          title="Something went wrong"
          body={<p className="text-gray-600">{actionData.message}</p>}
        >
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  // ---- GET states (no mutation has happened) ----

  if (state === "missing") {
    return (
      <Shell>
        <Card
          tone="neutral"
          icon="mail"
          title="Manage your subscription"
          body={
            <p className="text-gray-600">
              Enter the email address you'd like to unsubscribe from the {BRAND.name} newsletter.
            </p>
          }
        >
          <Form method="get" className="mt-6 space-y-3 text-left">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <button
              type="submit"
              className="w-full px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
            >
              Continue
            </button>
          </Form>
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  if (state === "not-found") {
    return (
      <Shell>
        <Card
          tone="neutral"
          icon="mail"
          title="Email not found"
          body={
            <>
              <p className="text-gray-600">
                {email ? (
                  <>
                    We couldn't find{" "}
                    <span className="font-medium text-gray-900">{email}</span> on our newsletter
                    list. You may already be unsubscribed, or used a different address.
                  </>
                ) : (
                  "That email address doesn't look valid."
                )}
              </p>
            </>
          }
        >
          <Form method="get" className="mt-6 space-y-3 text-left">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Try another email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              defaultValue={email}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <button
              type="submit"
              className="w-full px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
            >
              Continue
            </button>
          </Form>
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  if (state === "invalid-token") {
    return (
      <Shell>
        <Card
          tone="error"
          icon="warn"
          title="This link isn't valid"
          body={
            <p className="text-gray-600">
              The security signature on this unsubscribe link doesn't match{" "}
              <span className="font-medium text-gray-900">{email}</span>. It may have been altered or
              copied incorrectly. Please use the most recent link from your email, or look up your
              address below.
            </p>
          }
        >
          <Form method="get" className="mt-6 space-y-3 text-left">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Look up your email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              defaultValue={email}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <button
              type="submit"
              className="w-full px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
            >
              Continue
            </button>
          </Form>
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  if (state === "unsubscribed") {
    return (
      <Shell>
        <Card
          tone="neutral"
          icon="info"
          title="You're already unsubscribed"
          body={
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">{email}</span> is not receiving our
              newsletter. No further action is needed.
            </p>
          }
        >
          <Form method="post" className="mt-6">
            <input type="hidden" name="intent" value="resubscribe" />
            <input type="hidden" name="email" value={email} />
            {token && <input type="hidden" name="token" value={token} />}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 disabled:opacity-50"
            >
              Re-subscribe
            </button>
          </Form>
          <HomeLink />
        </Card>
      </Shell>
    );
  }

  // state === "active" — confirmation screen (the main flow)
  return (
    <Shell>
      <Card
        tone="neutral"
        icon="mail"
        title="Unsubscribe from our newsletter"
        body={
          <p className="text-gray-600">
            {firstName ? `${firstName}, you're` : "You're"} about to stop receiving the {BRAND.name}{" "}
            newsletter at <span className="font-medium text-gray-900">{email}</span>. You can
            re-subscribe at any time.
          </p>
        }
      >
        <Form method="post" className="mt-6 space-y-4 text-left">
          <input type="hidden" name="intent" value="unsubscribe" />
          <input type="hidden" name="email" value={email} />
          {token && <input type="hidden" name="token" value={token} />}

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <select
              id="reason"
              name="reason"
              defaultValue=""
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
            >
              <option value="">Prefer not to say</option>
              {UNSUB_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Confirm unsubscribe"}
            </button>
            <Link
              to="/"
              className="flex-1 text-center px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Keep me subscribed
            </Link>
          </div>
        </Form>
        {verified && (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verified secure link
          </p>
        )}
      </Card>
    </Shell>
  );
}

/* ----------------------------- UI primitives ----------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Card({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "success" | "error" | "neutral";
  icon: "check" | "warn" | "mail" | "info";
  title: string;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  const toneStyles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-600",
    error: "bg-red-50 text-red-600",
    neutral: "bg-teal-50 text-teal-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${toneStyles[tone]}`}
      >
        <Icon name={icon} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <div className="mt-3">{body}</div>
      {children}
    </div>
  );
}

function HomeLink({ primary = false }: { primary?: boolean }) {
  return (
    <div className="mt-6">
      <Link
        to="/"
        className={
          primary
            ? "inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
            : "text-sm text-gray-500 hover:text-teal-600"
        }
      >
        {primary ? "Back to the blog" : "Return to the blog"}
      </Link>
    </div>
  );
}

function Icon({ name }: { name: "check" | "warn" | "mail" | "info" }) {
  const common = "w-7 h-7";
  switch (name) {
    case "check":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "warn":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      );
    case "info":
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "mail":
    default:
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
  }
}
