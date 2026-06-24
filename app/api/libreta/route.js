import { NextResponse } from "next/server";
import { readLibreta, replaceLibreta } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const libreta = await readLibreta();
    return NextResponse.json({ libreta });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const libreta = body?.libreta ?? body;
    const res = await replaceLibreta(libreta);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
