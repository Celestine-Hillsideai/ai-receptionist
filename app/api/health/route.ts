import { NextResponse } from "next/server";

// Liveness check (spec §37, §39): the process is up and able to respond.
// Does not touch the database — see /api/health/ready for that.
export async function GET() {
  return NextResponse.json({ data: { status: "ok" }, error: null });
}
