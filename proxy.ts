import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { DASHBOARD_SESSION_COOKIE, verifyDashboardSessionCookie } from "@/lib/services/dashboardSession";

// Gates /dashboard/* behind the shared-password session cookie
// (docs/DEPLOYMENT.md option 1). If DASHBOARD_PASSWORD isn't configured the
// dashboard stays open — same "optional secret degrades for local dev"
// convention as VAPI_WEBHOOK_SECRET/INTERNAL_API_SECRET (lib/config.ts) —
// so set it before any real deployment.
export function proxy(request: NextRequest) {
  const { dashboardPassword } = getConfig();
  if (!dashboardPassword) return NextResponse.next();

  const session = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (verifyDashboardSessionCookie(session, dashboardPassword)) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: "/dashboard/:path*",
};
