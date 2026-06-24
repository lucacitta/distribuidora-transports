import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// Credenciales de la Service Account, decodificadas desde Base64.
function getCreds() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Falta la variable GOOGLE_SERVICE_ACCOUNT_B64");
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 no es un JSON válido en Base64");
  }
}

async function getDoc() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Falta la variable GOOGLE_SHEET_ID");
  const creds = getCreds();
  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(sheetId, jwt);
  await doc.loadInfo();
  return doc;
}

// Definición de las tres pestañas y sus columnas.
export const TABS = {
  libreta: {
    title: "Libreta",
    headers: ["clave", "nombre", "direccion", "barrio", "transporte", "horario", "aliases"],
  },
  agenda: {
    title: "Agenda",
    headers: ["id", "fecha", "chofer", "tipo", "nombre", "barrio", "direccion", "carga", "retira", "horario", "transporte", "notas"],
  },
  hojas: {
    title: "Hojas de ruta",
    headers: ["fecha", "chofer", "cant_paradas", "texto", "generado_en"],
  },
};

// Devuelve la pestaña; la crea con sus headers si no existe.
async function getSheet(doc, { title, headers }) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow(headers);
    }
  }
  return sheet;
}

// ---------- Libreta (clientes / proveedores) ----------

export async function readLibreta() {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.libreta);
  const rows = await sheet.getRows();
  const out = {};
  for (const r of rows) {
    const clave = (r.get("clave") || "").trim();
    if (!clave) continue;
    out[clave] = {
      nombre: r.get("nombre") || "",
      direccion: r.get("direccion") || "",
      barrio: r.get("barrio") || "",
      transporte: r.get("transporte") || "",
      horario: r.get("horario") || "",
      aliases: (r.get("aliases") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  return out;
}

export async function replaceLibreta(libreta) {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.libreta);
  await sheet.clearRows();
  const rows = Object.entries(libreta || {}).map(([clave, v]) => ({
    clave,
    nombre: v.nombre || "",
    direccion: v.direccion || "",
    barrio: v.barrio || "",
    transporte: v.transporte || "",
    horario: v.horario || "",
    aliases: (v.aliases || []).join(", "),
  }));
  if (rows.length) await sheet.addRows(rows);
  return { count: rows.length };
}

// ---------- Agenda (paradas / viajes) ----------

export async function readAgenda() {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.agenda);
  const rows = await sheet.getRows();
  return rows
    .map((r) => ({
      id: r.get("id") || "",
      fecha: r.get("fecha") || "",
      chofer: r.get("chofer") || "",
      tipo: r.get("tipo") || "Entrega",
      nombre: r.get("nombre") || "",
      barrio: r.get("barrio") || "",
      direccion: r.get("direccion") || "",
      carga: r.get("carga") || "",
      retira: r.get("retira") || "",
      horario: r.get("horario") || "",
      transporte: r.get("transporte") || "",
      notas: r.get("notas") || "",
    }))
    .filter((p) => p.id);
}

export async function replaceAgenda(paradas) {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.agenda);
  await sheet.clearRows();
  const rows = (paradas || []).map((p) => ({
    id: String(p.id ?? ""),
    fecha: p.fecha || "",
    chofer: p.chofer || "",
    tipo: p.tipo || "Entrega",
    nombre: p.nombre || "",
    barrio: p.barrio || "",
    direccion: p.direccion || "",
    carga: p.carga || "",
    retira: p.retira || "",
    horario: p.horario || "",
    transporte: p.transporte || "",
    notas: p.notas || "",
  }));
  if (rows.length) await sheet.addRows(rows);
  return { count: rows.length };
}

// ---------- Hojas de ruta (historial generado) ----------

export async function readHojas() {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.hojas);
  const rows = await sheet.getRows();
  return rows.map((r) => ({
    fecha: r.get("fecha") || "",
    chofer: r.get("chofer") || "",
    cant_paradas: Number(r.get("cant_paradas") || 0),
    texto: r.get("texto") || "",
    generado_en: r.get("generado_en") || "",
  }));
}

export async function appendHoja({ fecha, chofer, cant_paradas, texto, generado_en }) {
  const doc = await getDoc();
  const sheet = await getSheet(doc, TABS.hojas);
  await sheet.addRow({
    fecha: fecha || "",
    chofer: chofer || "",
    cant_paradas: cant_paradas ?? 0,
    texto: texto || "",
    generado_en: generado_en || new Date().toISOString(),
  });
  return { ok: true };
}
