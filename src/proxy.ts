import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isCronRoute = req.nextUrl.pathname.startsWith("/api/cron");

  // Cron routes authenticate themselves via CRON_SECRET (no user session).
  if (isApiAuthRoute || isCronRoute) return NextResponse.next();

  if (isAuthRoute) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
