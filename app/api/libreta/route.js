import { NextResponse } from "next/server";
import { readLibreta, replaceLibreta } from "@/lib/sheets";
import libretaJson from "@/libreta_pulqui.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let libreta = await readLibreta();
    // Si el Sheet está vacío, sembrar desde el JSON de respaldo y guardarlo.
    if (Object.keys(libreta).length < 10) {
      await replaceLibreta(libretaJson);
      libreta = libretaJson;
    }
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
