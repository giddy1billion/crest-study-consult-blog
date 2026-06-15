import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { OrganizationSchema, WebSiteSchema } from "~/components/seo";
import { ToastProvider } from "~/components/ui";
import { PlausibleScript } from "~/components/analytics";
import "./app.css";

export const links: Route.LinksFunction = () => [
  // Fonts - optimized with display=swap and preconnect
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  // Favicons - SVG preferred by Google, ICO for legacy support
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
  { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
  { rel: "icon", href: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
  // Apple Touch Icons
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-57x57.png", sizes: "57x57" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-60x60.png", sizes: "60x60" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-72x72.png", sizes: "72x72" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-76x76.png", sizes: "76x76" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-114x114.png", sizes: "114x114" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-120x120.png", sizes: "120x120" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-144x144.png", sizes: "144x144" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-152x152.png", sizes: "152x152" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png", sizes: "180x180" },
  // Web App Manifest
  { rel: "manifest", href: "/site.webmanifest" },
  // Microsoft
  { rel: "msapplication-TileImage", href: "/mstile-144x144.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#5CB031" />
        <meta name="msapplication-TileColor" content="#5CB031" />
        <meta name="apple-mobile-web-app-title" content="Crest Study Consult" />
        <meta name="application-name" content="Crest Study Consult" />
        <Meta />
        <Links />
        <OrganizationSchema />
        <WebSiteSchema />
        <PlausibleScript />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
