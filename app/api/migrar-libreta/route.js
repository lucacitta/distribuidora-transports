import { NextResponse } from "next/server";
import { readLibreta, replaceLibreta } from "@/lib/sheets";
import libretaJson from "@/libreta_pulqui.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Solo migra si el Sheet está vacío para no pisar datos existentes.
    const actual = await readLibreta();
    if (Object.keys(actual).length > 0) {
      return NextResponse.json({
        ok: false,
        msg: `El Sheet ya tiene ${Object.keys(actual).length} entradas. No se migró nada para evitar sobreescribir.`,
      });
    }

    await replaceLibreta(libretaJson);
    return NextResponse.json({ ok: true, migrados: Object.keys(libretaJson).length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
