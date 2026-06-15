import type { Route } from "./+types/admin-login";
import { data, redirect, Form, useNavigation, useSearchParams, useActionData } from "react-router";
import { getAdminUserId, verifyLogin, createAdminSession } from "~/utils/session.server";
import { BRAND } from "~/utils/constants";
import { useState } from "react";
import { 
  checkLoginRateLimit, 
  recordFailedLogin, 
  recordSuccessfulLogin,
  formatRetryTime,
  logSecurityEvent,
  getClientIP,
} from "~/utils/rate-limit.server";

/**
 * Action data type for login form
 */
type ActionData = {
  error: string;
  isLocked?: boolean;
  retryAfter?: number;
};

/**
 * Meta tags for admin login
 */
export function meta() {
  return [
    { title: `Admin Login — ${BRAND.name}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Redirect to dashboard if already logged in
 */
export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getAdminUserId(request);
  if (userId) {
    throw redirect("/admin");
  }
  return data({});
}

/**
 * Handle login form submission with rate limiting
 */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/admin";

  // Validate input types first
  if (typeof email !== "string" || typeof password !== "string") {
    return data({ error: "Invalid form submission" }, { status: 400 });
  }

  if (!email.includes("@")) {
    return data({ error: "Invalid email address" }, { status: 400 });
  }

  if (password.length < 8) {
    return data({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check rate limit BEFORE credential verification
  const rateLimit = checkLoginRateLimit(request, email);
  
  if (!rateLimit.allowed) {
    const ip = getClientIP(request);
    
    // Log security event
    logSecurityEvent({
      type: rateLimit.reason === "lockout" ? "lockout" : "rate_limited",
      ip,
      email,
      timestamp: new Date(),
      details: { reason: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs },
    });
    
    const retryTime = rateLimit.retryAfterMs ? formatRetryTime(rateLimit.retryAfterMs) : "later";
    
    if (rateLimit.reason === "lockout") {
      return data(
        { 
          error: `Account temporarily locked due to too many failed attempts. Try again in ${retryTime}.`,
          isLocked: true,
          retryAfter: rateLimit.retryAfterMs,
        }, 
        { 
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.retryAfterMs || 0) / 1000)),
          },
        }
      );
    }
    
    return data(
      { 
        error: `Too many login attempts. Please try again in ${retryTime}.`,
        retryAfter: rateLimit.retryAfterMs,
      }, 
      { 
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.retryAfterMs || 0) / 1000)),
        },
      }
    );
  }

  // Verify credentials
  const user = await verifyLogin(email, password);
  
  if (!user) {
    // Record failed attempt
    recordFailedLogin(request, email);
    
    logSecurityEvent({
      type: "failed_login",
      ip: getClientIP(request),
      email,
      timestamp: new Date(),
    });
    
    // Generic error message (don't reveal if email exists)
    const remainingHint = rateLimit.remainingAttempts !== undefined && rateLimit.remainingAttempts <= 3
      ? ` (${rateLimit.remainingAttempts} attempts remaining)`
      : "";
    
    return data({ error: `Invalid email or password${remainingHint}` }, { status: 401 });
  }

  // Successful login - reset rate limit counters
  recordSuccessfulLogin(request, email);
  
  logSecurityEvent({
    type: "successful_login",
    ip: getClientIP(request),
    email,
    timestamp: new Date(),
  });

  // Create session and redirect (cache user data to avoid DB lookups)
  return createAdminSession({
    request,
    userId: user.id,
    userData: user,
    redirectTo: typeof redirectTo === "string" ? redirectTo : "/admin",
  });
}

/**
 * Modern Admin Login Page with Split Screen Design
 */
export default function AdminLogin() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  
  // Check if rate limited or locked
  const isRateLimited = actionData?.retryAfter !== undefined;
  
  const redirectTo = searchParams.get("redirectTo") || "/admin";

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-700 via-navy-700 to-navy-800 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/10 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt={BRAND.name} className="h-10 w-auto brightness-0 invert" />
            <span className="text-white font-semibold text-xl">Crest Study Consult</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Welcome to the<br />Editorial Dashboard
          </h1>
          <p className="text-teal-100 text-lg max-w-md">
            Manage your content, track performance, and publish articles that build trust in Nigerian real estate.
          </p>
          
          {/* Feature highlights */}
          <div className="space-y-4 pt-6">
            {[
              { icon: "📝", text: "Create and manage articles" },
              { icon: "📊", text: "Track content performance" },
              { icon: "🔍", text: "SEO optimization tools" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/90">
                <span className="text-xl">{feature.icon}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-teal-100 text-sm">
          © {new Date().getFullYear()} {BRAND.legalName}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <img src="/logo.png" alt={BRAND.name} className="h-10 w-auto" />
              <span className="font-semibold text-xl text-gray-900">Crest Study Consult</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-gray-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-gray-500">
              Access the editorial dashboard
            </p>
          </div>

          {/* Login Form */}
          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            
            {/* Error Message - Different styling for rate limits vs auth errors */}
            {actionData?.error && (
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                actionData.isLocked 
                  ? "bg-amber-50 border-amber-200" 
                  : actionData.retryAfter 
                    ? "bg-orange-50 border-orange-200"
                    : "bg-red-50 border-red-100"
              }`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  actionData.isLocked 
                    ? "bg-amber-100" 
                    : actionData.retryAfter 
                      ? "bg-orange-100"
                      : "bg-red-100"
                }`}>
                  {actionData.isLocked ? (
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : actionData.retryAfter ? (
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    actionData.isLocked 
                      ? "text-amber-800" 
                      : actionData.retryAfter 
                        ? "text-orange-800"
                        : "text-red-800"
                  }`}>
                    {actionData.isLocked ? "Account locked" : actionData.retryAfter ? "Too many attempts" : "Authentication failed"}
                  </p>
                  <p className={`text-sm ${
                    actionData.isLocked 
                      ? "text-amber-600" 
                      : actionData.retryAfter 
                        ? "text-orange-600"
                        : "text-red-600"
                  }`}>{actionData.error}</p>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border-0 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    className="block w-full pl-12 pr-12 py-3.5 bg-gray-50 border-0 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isRateLimited}
              className="relative w-full flex justify-center items-center gap-2 py-3.5 px-4 bg-navy-700 text-white text-sm font-semibold rounded-xl hover:bg-navy-800 hover:shadow-lg hover:shadow-navy-700/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : isRateLimited ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Please wait...
                </>
              ) : (
                <>
                  Sign in
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </Form>

          {/* Help text */}
          <p className="text-center text-sm text-gray-500">
            Need help? Contact{" "}
            <a href="mailto:tech@propx.africa" className="font-medium text-teal-600 hover:text-teal-500">
              tech@propx.africa
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
