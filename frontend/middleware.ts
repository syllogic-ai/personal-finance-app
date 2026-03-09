import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const truthyValues = new Set(["1", "true", "yes", "on"]);

function isDisabled(val: string | undefined) {
  return !!val && truthyValues.has(val.trim().toLowerCase());
}

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/register" &&
    isDisabled(process.env.DISABLE_SIGN_UPS)
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/register"],
};
