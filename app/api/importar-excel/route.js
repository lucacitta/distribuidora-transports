import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALIAS = {
  fechaSug:  ["fecha sugerida", "fecha"],
  accion:    ["acción", "accion", "tipo de viaje"],
  nombre:    ["nombre"],
  carga:     ["qué lleva", "que lleva", "detalle de carga", "carga"],
  retira:    ["qué retira", "que retira"],
  direccion: ["dirección", "direccion"],
  barrio:    ["zona / barrio", "zona / localidad", "zona", "barrio", "localidad"],
  horario:   ["horario", "horario de atención", "horario de atencion"],
  urgente:   ["urgente"],
  notas:     ["observaciones", "notas"],
  chofer:    ["chofer sugerido", "chofer (cami / dani)", "chofer"],
  estado:    ["estado (cami)", "estado"],
};

function norm(s) { return (s || "").trim().toLowerCase(); }

function parseFecha(raw) {
  if (!raw) return "";
  const serial = Number(raw);
  if (!isNaN(serial) && serial > 1000) {
    try {
      const d = XLSX.SSF.parse_date_code(serial);
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } catch { /* noop */ }
  }
  const s = String(raw).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? "20" + y : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function nuevoId() {
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function calcImpKey(nombre, tipo, carga, retira, fechaSug) {
  return [nombre, tipo, carga, retira, fechaSug].map(norm).join("|");
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const existingKeysRaw = formData.get("existingKeys") || "[]";
    const existingKeys = new Set(JSON.parse(existingKeysRaw));

    if (!file) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    const sheetName = wb.SheetNames.includes("Pedidos José")
      ? "Pedidos José"
      : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const headerRowIdx = data.findIndex((row) =>
      row.some((cell) => norm(String(cell)) === "nombre")
    );
    if (headerRowIdx === -1) {
      return NextResponse.json({ error: "No se encontró la columna 'nombre' en la planilla." }, { status: 422 });
    }

    const headers = data[headerRowIdx].map((h) => norm(String(h)));
    const cols = {};
    for (const [campo, aliases] of Object.entries(ALIAS)) {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias);
        if (idx !== -1) { cols[campo] = idx; break; }
      }
    }

    const importados = [];
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      const get = (campo) => String(cols[campo] !== undefined ? row[cols[campo]] ?? "" : "").trim();

      const nombre = get("nombre");
      if (!nombre) continue;
      if (norm(get("estado")) === "completado") continue;

      const accionRaw = norm(get("accion"));
      let tipo = "Entrega";
      if ((accionRaw.includes("llevar") || accionRaw.includes("entreg")) && accionRaw.includes("retir"))
        tipo = "Entrega y retiro";
      else if (accionRaw.includes("retir") || accionRaw.includes("proveedor"))
        tipo = "Retiro";
      else if (accionRaw.includes("llevar") || accionRaw.includes("entreg"))
        tipo = "Entrega";

      const choferRaw = norm(get("chofer"));
      const impChoferSug = choferRaw.startsWith("ariel") ? "Ariel" : "José";

      const urgente = norm(get("urgente")).startsWith("s");
      const notasBase = get("notas");
      const notas = urgente ? ("⚠ URGENTE" + (notasBase ? " — " + notasBase : "")) : notasBase;

      const impFechaSug = parseFecha(get("fechaSug"));
      const carga = get("carga");
      const retira = get("retira");
      const impKey = calcImpKey(nombre, tipo, carga, retira, impFechaSug);

      if (existingKeys.has(impKey)) continue;
      existingKeys.add(impKey);

      importados.push({
        id: nuevoId(),
        fecha: "",
        chofer: "",
        tipo,
        nombre,
        barrio: get("barrio"),
        direccion: get("direccion"),
        carga,
        retira,
        horario: get("horario"),
        transporte: "",
        notas,
        impKey,
        recurrenteId: "",
        impFechaSug,
        impChoferSug,
      });
    }

    return NextResponse.json({ importados });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
