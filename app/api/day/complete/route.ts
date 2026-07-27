import { NextRequest, NextResponse } from "next/server";
import { setCompletion } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { date, itemId, completed } = await req.json();
  if (!date || itemId === undefined) {
    return NextResponse.json({ error: "date and itemId required" }, { status: 400 });
  }
  await setCompletion(date, itemId, completed);
  return NextResponse.json({ ok: true });
}
