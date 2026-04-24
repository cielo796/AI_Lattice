import { NextResponse } from "next/server";
import { checkDatabaseSetup } from "@/server/db/setup-health";

export async function GET() {
  const health = await checkDatabaseSetup();

  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
