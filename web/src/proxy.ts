import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "crm_user_email";
const ALLOWED_DOMAIN = "rebuilt.com";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login flow + Next.js internals bypass auth.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const email = req.cookies.get(AUTH_COOKIE)?.value;
  const ok =
    !!email &&
    /^[^@\s]+@[^@\s]+$/.test(email) &&
    email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN);

  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon).*)"],
};
