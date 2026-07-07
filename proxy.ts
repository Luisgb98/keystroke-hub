import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  SESSION_REFRESH_AFTER_MS,
  decryptSession,
  encryptSession,
  sessionCookieOptions,
} from "@/lib/auth/session";

/**
 * Optimistic auth gate (Next 16 Proxy — the artist formerly known as
 * Middleware). Real enforcement lives in `verifySession()` (lib/auth/session);
 * this layer only pre-filters unauthenticated requests and keeps the rolling
 * session fresh.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (pathname === "/login") {
    // Already signed in — the login screen has nothing to offer.
    return session
      ? NextResponse.redirect(new URL("/", request.nextUrl))
      : NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.nextUrl);
    const from = `${pathname}${search}`;
    if (from !== "/") loginUrl.searchParams.set("from", from);
    return NextResponse.redirect(loginUrl);
  }

  // Rolling expiry: any activity on a given day re-issues the session for a
  // fresh 30 days, so an actively used device never gets logged out. Refresh
  // at most once a day and never on prefetches — re-issuing on every request
  // lets an in-flight response resurrect the cookie right after sign-out.
  const response = NextResponse.next();
  const isPrefetch =
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch";
  const issuedAtMs = (session.iat ?? 0) * 1000;
  if (!isPrefetch && Date.now() - issuedAtMs >= SESSION_REFRESH_AFTER_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    response.cookies.set(
      SESSION_COOKIE,
      await encryptSession(expiresAt),
      sessionCookieOptions(expiresAt)
    );
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Gate everything except:
     * - /api/health (public uptime probe — leaks nothing, see issue #8)
     * - The three Google sync routes (issue #12), each hit by Google/Vercel
     *   directly with no session cookie and carrying its own auth instead:
     *   - api/google/oauth/callback — signed `state` JWT
     *   - api/google/webhook — per-channel `X-Goog-Channel-Token`
     *   - api/cron/calendar-sync — `CRON_SECRET` bearer token
     * - Next internals (_next/static, _next/image)
     * - static files (anything with an extension, e.g. favicon.ico, icons)
     */
    "/((?!api/health|api/google/oauth/callback|api/google/webhook|api/cron/calendar-sync|_next/static|_next/image|.*\\..*).*)",
  ],
};
