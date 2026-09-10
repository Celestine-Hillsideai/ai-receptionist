"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import {
  DASHBOARD_SESSION_COOKIE,
  createDashboardSessionCookie,
  verifyDashboardPassword,
} from "@/lib/services/dashboardSession";

export async function login(formData: FormData): Promise<void> {
  const { dashboardPassword } = getConfig();
  // Gate is off (no password configured) — nothing to check, straight through.
  if (!dashboardPassword) redirect("/dashboard");

  const candidate = String(formData.get("password") ?? "");
  if (!verifyDashboardPassword(candidate, dashboardPassword)) {
    redirect("/login?error=1");
  }

  const { value, maxAgeSeconds } = createDashboardSessionCookie(dashboardPassword);
  (await cookies()).set(DASHBOARD_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(DASHBOARD_SESSION_COOKIE);
  redirect("/login");
}
