import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { upsertDay } from "@/lib/db";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const date = form.get("date") as string | null;
  if (!file || !date) return NextResponse.json({ error: "file and date required" }, { status: 400 });

  const blob = await put(`checkins/${date}.jpg`, file, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await upsertDay(date, { morning_photo_url: blob.url });

  return NextResponse.json({ url: blob.url });
}
