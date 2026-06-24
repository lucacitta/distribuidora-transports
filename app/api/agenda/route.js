import { NextResponse } from "next/server";
import { readAgenda, replaceAgenda } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const paradas = await readAgenda();
    return NextResponse.json({ paradas });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const paradas = body?.paradas ?? body;
    const res = await replaceAgenda(paradas);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
