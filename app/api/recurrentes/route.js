import { NextResponse } from "next/server";
import { readRecurrentes, replaceRecurrentes } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recurrentes = await readRecurrentes();
    return NextResponse.json({ recurrentes });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const recurrentes = body?.recurrentes ?? body;
    const res = await replaceRecurrentes(recurrentes);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
