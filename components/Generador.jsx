"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Plus, Trash2, Copy, Check, ChevronUp, ChevronDown, Truck, RotateCcw,
  BookOpen, Pencil, X, Save, Tag, PackageCheck, Eraser, CalendarDays,
  ArrowRight, Inbox, Cloud, CloudOff, RefreshCw, FileUp, Repeat, ChevronRight,
} from "lucide-react";

const storage = {
  get: async (k) => {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(k);
    return value == null ? null : { value };
  },
  set: async (k, v) => {
    if (typeof window !== "undefined") window.localStorage.setItem(k, v);
  },
};

async function apiGet(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.json();
}
async function apiSend(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}`);
  return r.json();
}

const nuevoId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

const BASE = "Mons. Bufano 2357, San Justo";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CHOFERES = ["José", "Ariel"];
const TIPOS = ["Entrega", "Retiro", "Entrega y retiro"];
const DIAS_REC = [
  { label: "Dom", val: 0 }, { label: "Lun", val: 1 }, { label: "Mar", val: 2 },
  { label: "Mié", val: 3 }, { label: "Jue", val: 4 }, { label: "Vie", val: 5 },
  { label: "Sáb", val: 6 },
];

const SEMILLA = {
  "reconstructora union sa": { nombre: "Reconstructora Union SA", direccion: "Pepirí 1321, CABA", barrio: "", transporte: "Barapack", aliases: ["la union", "la unión"] },
};

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fechaLarga(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
function weekdayOf(iso) {
  if (!iso) return -1;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
const norm = (s) => (s || "").trim().toLowerCase();

function resolver(libreta, texto) {
  const k = norm(texto);
  if (libreta[k]) return libreta[k];
  for (const v of Object.values(libreta)) if ((v.aliases || []).map(norm).includes(k)) return v;
  return null;
}

function textoChofer(chofer, fecha, paradas) {
  const propias = paradas.filter((p) => p.chofer === chofer);
  if (propias.length === 0) return "";
  let out = `*HOJA DE RUTA — ${chofer.toUpperCase()}*\n`;
  out += `${fechaLarga(fecha)} · Salida: ${BASE}\n`;
  propias.forEach((p, i) => {
    out += `\n━━━━━━━━━━\n`;
    const esDespacho = p.tipo === "Entrega" && p.transporte;
    if (esDespacho) {
      out += `*${i + 1} · DESPACHO — ${p.nombre} (vía ${p.transporte})*\n`;
      out += p.direccion ? `${p.direccion}\n` : `${p.transporte} — sucursal a elección\n`;
    } else {
      const barrio = p.barrio ? ` (${p.barrio})` : "";
      out += `*${i + 1} · ${p.tipo.toUpperCase()} — ${p.nombre}${barrio}*\n`;
      if (p.direccion) out += `${p.direccion}\n`;
    }
    const combinado = p.tipo === "Entrega y retiro";
    if (p.carga) out += `📦 ${combinado ? "Lleva: " : ""}${p.carga}\n`;
    if (combinado && p.retira) out += `📥 Retira: ${p.retira}\n`;
    if (p.horario) out += `🕐 ${p.horario}\n`;
    if (p.transporte && !esDespacho) out += `🚛 ${p.transporte}\n`;
    if (p.notas) out += `📝 ${p.notas}\n`;
  });
  out += `━━━━━━━━━━`;
  return out;
}

function conNegritas(linea, key) {
  const partes = linea.split(/(\*[^*]+\*)/g);
  return (
    <span key={key}>
      {partes.map((t, i) =>
        t.startsWith("*") && t.endsWith("*") ? <strong key={i}>{t.slice(1, -1)}</strong> : <span key={i}>{t}</span>
      )}
    </span>
  );
}

const VACIA = { tipo: "Entrega", nombre: "", barrio: "", carga: "", retira: "", horario: "", transporte: "", direccion: "", notas: "" };
const VACIA_REC = { nombre: "", tipo: "Entrega", direccion: "", barrio: "", transporte: "", horario: "", chofer: "José", dias: [] };

// ---------- Import helpers ----------

function calcImpKey(nombre, tipo, carga, retira, fechaSug) {
  return [nombre, tipo, carga, retira, fechaSug].map((s) => norm(s)).join("|");
}

function parseFechaExcel(raw) {
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
  // dd/mm/yy or dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? "20" + y : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function parsearExcel(file, paradasExistentes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheetName = wb.SheetNames.includes("Pedidos José")
          ? "Pedidos José"
          : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const headerRowIdx = data.findIndex((row) =>
          row.some((cell) => norm(String(cell)) === "nombre")
        );
        if (headerRowIdx === -1) {
          reject(new Error("No se encontró la columna 'nombre' en la planilla."));
          return;
        }

        const headers = data[headerRowIdx].map((h) => norm(String(h)));

        const ALIAS = {
          fechaSug: ["fecha sugerida", "fecha"],
          accion:   ["acción", "accion", "tipo de viaje"],
          nombre:   ["nombre"],
          carga:    ["qué lleva", "que lleva", "detalle de carga", "carga"],
          retira:   ["qué retira", "que retira"],
          direccion:["dirección", "direccion"],
          barrio:   ["zona / barrio", "zona / localidad", "zona", "barrio", "localidad"],
          horario:  ["horario", "horario de atención", "horario de atencion"],
          urgente:  ["urgente"],
          notas:    ["observaciones", "notas"],
          chofer:   ["chofer sugerido", "chofer (cami / dani)", "chofer"],
          estado:   ["estado (cami)", "estado"],
        };

        const cols = {};
        for (const [campo, aliases] of Object.entries(ALIAS)) {
          for (const alias of aliases) {
            const idx = headers.indexOf(alias);
            if (idx !== -1) { cols[campo] = idx; break; }
          }
        }

        const existingKeys = new Set(paradasExistentes.map((p) => p.impKey).filter(Boolean));
        const importados = [];

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          const get = (campo) =>
            String(cols[campo] !== undefined ? row[cols[campo]] ?? "" : "").trim();

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
          const notas = urgente
            ? ("⚠ URGENTE" + (notasBase ? " — " + notasBase : ""))
            : notasBase;

          const impFechaSug = parseFechaExcel(get("fechaSug"));
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

        resolve(importados);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ---------- Componente principal ----------

export default function Generador() {
  const [fecha, setFecha] = useState(hoyISO());
  const [defaultChofer, setDefaultChofer] = useState("José");
  const [paradas, setParadas] = useState([]);
  const [form, setForm] = useState({ ...VACIA, chofer: "José" });
  const [reconocido, setReconocido] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [libretaMsg, setLibretaMsg] = useState(false);
  const [libreta, setLibreta] = useState({});
  const [copiado, setCopiado] = useState(null);
  const [cargado, setCargado] = useState(false);
  const [verLibreta, setVerLibreta] = useState(false);
  const [verConsolidado, setVerConsolidado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [asigDraft, setAsigDraft] = useState({});
  const [aviso, setAviso] = useState("");
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState(null);
  const [sync, setSync] = useState("idle");
  const taRef = useRef(null);

  // Recurrentes
  const [recurrentes, setRecurrentes] = useState([]);
  const [verRecurrentes, setVerRecurrentes] = useState(false);
  const [formRec, setFormRec] = useState({ ...VACIA_REC });
  const [editandoRecId, setEditandoRecId] = useState(null);
  const [cargasRec, setCargasRec] = useState({});
  const [recPanelAbierto, setRecPanelAbierto] = useState(false);

  // Import Excel
  const [importMsg, setImportMsg] = useState("");
  const importRef = useRef(null);

  const hydratedRef = useRef(false);
  const skipLibretaSync = useRef(false);
  const skipAgendaSync = useRef(false);
  const skipRecurrentesSync = useRef(false);
  const libretaTimer = useRef(null);
  const agendaTimer = useRef(null);
  const recurrentesTimer = useRef(null);

  async function pushJSON(url, method, body) {
    setSync("saving");
    try { await apiSend(url, method, body); setSync("saved"); }
    catch { setSync("error"); }
  }

  // Hidratación inicial
  useEffect(() => {
    (async () => {
      let lib = null;
      try { const r = await storage.get("pulqui_libreta_v2"); if (r) lib = JSON.parse(r.value); } catch { /* noop */ }
      if (lib) setLibreta(lib);
      try {
        const b = await storage.get("pulqui_borrador");
        if (b) {
          const v = JSON.parse(b.value);
          if (v.fecha) setFecha(v.fecha);
          if (v.paradas) setParadas(v.paradas.map((p) => ({ ...p, id: String(p.id), fecha: p.fecha || v.fecha || hoyISO() })));
          if (v.defaultChofer) setDefaultChofer(v.defaultChofer);
        }
      } catch { /* noop */ }

      try {
        const [lr, ar, rr] = await Promise.all([
          apiGet("/api/libreta"),
          apiGet("/api/agenda"),
          apiGet("/api/recurrentes"),
        ]);

        const libSheet = lr.libreta && Object.keys(lr.libreta).length ? lr.libreta : null;
        if (libSheet) {
          skipLibretaSync.current = true;
          setLibreta(libSheet);
          storage.set("pulqui_libreta_v2", JSON.stringify(libSheet)).catch(() => {});
        } else if (!lib) {
          setLibreta(SEMILLA);
        }

        if (Array.isArray(ar.paradas) && ar.paradas.length > 0) {
          skipAgendaSync.current = true;
          const loaded = ar.paradas.map((p) => ({ ...p, id: String(p.id) }));
          setParadas(loaded);
          // Pre-cargar sugerencias de asignación para pendientes importados
          const drafts = {};
          for (const p of loaded) {
            if (!p.fecha && (p.impFechaSug || p.impChoferSug)) {
              drafts[p.id] = {
                fecha: p.impFechaSug || hoyISO(),
                chofer: p.impChoferSug || "José",
              };
            }
          }
          if (Object.keys(drafts).length) setAsigDraft((d) => ({ ...d, ...drafts }));
        }

        if (Array.isArray(rr.recurrentes)) {
          skipRecurrentesSync.current = true;
          setRecurrentes(rr.recurrentes);
        }
      } catch {
        if (!lib) setLibreta(SEMILLA);
      }

      hydratedRef.current = true;
      setCargado(true);
    })();
  }, []);

  // Caché local del borrador
  useEffect(() => {
    if (cargado) storage.set("pulqui_borrador", JSON.stringify({ fecha, paradas, defaultChofer })).catch(() => {});
  }, [fecha, paradas, defaultChofer, cargado]);

  useEffect(() => { setForm((f) => ({ ...f, chofer: defaultChofer })); }, [defaultChofer]);

  // Sync debounced
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipLibretaSync.current) { skipLibretaSync.current = false; return; }
    clearTimeout(libretaTimer.current);
    libretaTimer.current = setTimeout(() => pushJSON("/api/libreta", "PUT", { libreta }), 1000);
    return () => clearTimeout(libretaTimer.current);
  }, [libreta]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipAgendaSync.current) { skipAgendaSync.current = false; return; }
    clearTimeout(agendaTimer.current);
    agendaTimer.current = setTimeout(() => pushJSON("/api/agenda", "PUT", { paradas }), 1000);
    return () => clearTimeout(agendaTimer.current);
  }, [paradas]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipRecurrentesSync.current) { skipRecurrentesSync.current = false; return; }
    clearTimeout(recurrentesTimer.current);
    recurrentesTimer.current = setTimeout(() => pushJSON("/api/recurrentes", "PUT", { recurrentes }), 1000);
    return () => clearTimeout(recurrentesTimer.current);
  }, [recurrentes]);

  function guardarLibreta(nueva) {
    setLibreta(nueva);
    storage.set("pulqui_libreta_v2", JSON.stringify(nueva)).catch(() => {});
  }

  function autocompletar(texto) {
    const hit = resolver(libreta, texto);
    if (hit) {
      setReconocido(true);
      setForm((f) => ({ ...f, nombre: hit.nombre, direccion: hit.direccion || "", barrio: hit.barrio || "", transporte: hit.transporte || "", horario: hit.horario || "" }));
    } else {
      setReconocido(false);
      setForm((f) => ({ ...f, nombre: texto }));
    }
  }

  function agregar(pendiente = false) {
    if (!form.nombre.trim()) return;
    if (editandoId) {
      setParadas((p) => p.map((x) => (x.id === editandoId ? { ...form, id: editandoId, fecha } : x)));
      setEditandoId(null);
    } else {
      setParadas((p) => [...p, { ...form, id: nuevoId(), fecha: pendiente ? "" : fecha, chofer: pendiente ? "" : form.chofer, impKey: "", recurrenteId: "", impFechaSug: "", impChoferSug: "" }]);
      if (form.direccion.trim() || form.barrio.trim() || form.transporte.trim()) {
        const clave = norm(form.nombre);
        const prev = libreta[clave] || {};
        guardarLibreta({ ...libreta, [clave]: { nombre: form.nombre.trim(), direccion: form.direccion.trim(), barrio: form.barrio.trim(), transporte: form.transporte.trim(), aliases: prev.aliases || [] } });
      }
    }
    setForm({ ...VACIA, chofer: defaultChofer });
    setReconocido(false);
  }

  function editarParada(p) {
    setEditandoId(p.id);
    setForm({ ...p });
    if (p.fecha) setFecha(p.fecha);
    setReconocido(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelarEdicion() { setEditandoId(null); setForm({ ...VACIA, chofer: defaultChofer }); setReconocido(false); }

  const getDraft = (id) => asigDraft[id] || { fecha, chofer: "José" };
  const setDraft = (id, patch) => setAsigDraft((d) => ({ ...d, [id]: { ...getDraft(id), ...patch } }));
  function asignar(id) {
    const d = getDraft(id);
    if (!d.fecha || !d.chofer) return;
    setParadas((p) => p.map((x) => (x.id === id ? { ...x, fecha: d.fecha, chofer: d.chofer } : x)));
    setAsigDraft((prev) => { const c = { ...prev }; delete c[id]; return c; });
  }

  function actualizarLibreta() {
    if (!form.nombre.trim()) return;
    const clave = norm(form.nombre);
    const prev = libreta[clave] || {};
    guardarLibreta({ ...libreta, [clave]: { nombre: form.nombre.trim(), direccion: form.direccion.trim(), barrio: form.barrio.trim(), transporte: form.transporte.trim(), horario: form.horario.trim(), aliases: prev.aliases || [] } });
    setLibretaMsg(true); setTimeout(() => setLibretaMsg(false), 1800);
  }

  const borrar = (id) => setParadas((p) => p.filter((x) => x.id !== id));
  function mover(id, dir) {
    setParadas((p) => {
      const item = p.find((x) => x.id === id); if (!item) return p;
      const same = p.map((x, idx) => ({ x, idx })).filter((o) => o.x.fecha === item.fecha);
      const pos = same.findIndex((o) => o.x.id === id), tgt = pos + dir;
      if (tgt < 0 || tgt >= same.length) return p;
      const a = same[pos].idx, b = same[tgt].idx, c = [...p]; [c[a], c[b]] = [c[b], c[a]]; return c;
    });
  }
  const cambiarChofer = (id, ch) => setParadas((p) => p.map((x) => (x.id === id ? { ...x, chofer: ch } : x)));

  async function copiar(chofer) {
    const propias = paradas.filter((p) => p.fecha === fecha && p.chofer === chofer);
    const txt = textoChofer(chofer, fecha, paradas.filter((p) => p.fecha === fecha)); if (!txt) return;
    try { await navigator.clipboard.writeText(txt); } catch {
      if (taRef.current) { taRef.current.value = txt; taRef.current.select(); document.execCommand("copy"); }
    }
    setCopiado(chofer); setTimeout(() => setCopiado(null), 1800);
    apiSend("/api/hojas-de-ruta", "POST", { fecha, chofer, cant_paradas: propias.length, texto: txt, generado_en: new Date().toISOString() }).catch(() => {});
  }

  const pedir = (msg, onOk) => setConfirmar({ msg, onOk });
  const toast = (m) => { setAviso(m); setTimeout(() => setAviso(""), 2600); };
  function limpiarDia() { pedir(`¿Vaciar las paradas del ${fechaLarga(fecha)}? La libreta y los otros días se mantienen.`, () => setParadas((p) => p.filter((x) => x.fecha !== fecha))); }
  function vaciarAgenda() { pedir("¿Vaciar TODA la agenda? Borra los viajes de todos los días y no se puede deshacer. La libreta se mantiene.", () => { setParadas([]); setEditandoId(null); }); }
  function vaciarLibreta() { pedir("¿Vaciar TODA la libreta? Esto borra todos los clientes guardados (también en el Sheet) y no se puede deshacer.", () => guardarLibreta({})); }

  function iniciarEdit(k) { setEditKey(k); setEditVal({ ...libreta[k], aliasesTxt: (libreta[k].aliases || []).join(", ") }); }
  function guardarEdit() {
    const nuevoNombre = editVal.nombre.trim(); if (!nuevoNombre) return;
    const nuevaClave = norm(nuevoNombre);
    const entrada = { nombre: nuevoNombre, direccion: editVal.direccion.trim(), barrio: editVal.barrio.trim(), transporte: editVal.transporte.trim(), horario: (editVal.horario || "").trim(), aliases: editVal.aliasesTxt.split(",").map((s) => s.trim()).filter(Boolean) };
    const copia = { ...libreta }; if (nuevaClave !== editKey) delete copia[editKey]; copia[nuevaClave] = entrada;
    guardarLibreta(copia); setEditKey(null); setEditVal(null);
  }
  function borrarEntrada(k) { pedir(`¿Borrar "${libreta[k].nombre}" de la libreta?`, () => { const c = { ...libreta }; delete c[k]; guardarLibreta(c); }); }

  // ---------- Importar Excel ----------

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportMsg("Procesando…");
    try {
      const nuevos = await parsearExcel(file, paradas);
      if (nuevos.length === 0) {
        setImportMsg("No hay pedidos nuevos (completados o ya importados).");
      } else {
        setParadas((p) => [...p, ...nuevos]);
        // Pre-cargar drafts de asignación con las sugerencias
        setAsigDraft((d) => {
          const patch = {};
          for (const n of nuevos) {
            patch[n.id] = { fecha: n.impFechaSug || hoyISO(), chofer: n.impChoferSug || "José" };
          }
          return { ...d, ...patch };
        });
        setImportMsg(`Importados ${nuevos.length} pedido${nuevos.length === 1 ? "" : "s"} como pendientes.`);
      }
    } catch (err) {
      setImportMsg("Error: " + err.message);
    }
    setTimeout(() => setImportMsg(""), 4000);
  }

  // ---------- Recurrentes CRUD ----------

  function autocompletarRec(texto) {
    const hit = resolver(libreta, texto);
    if (hit) {
      setFormRec((f) => ({ ...f, nombre: hit.nombre, direccion: hit.direccion || "", barrio: hit.barrio || "", transporte: hit.transporte || "", horario: hit.horario || "" }));
    } else {
      setFormRec((f) => ({ ...f, nombre: texto }));
    }
  }

  function toggleDiaRec(val) {
    setFormRec((f) => ({
      ...f,
      dias: f.dias.includes(val) ? f.dias.filter((d) => d !== val) : [...f.dias, val].sort((a, b) => a - b),
    }));
  }

  function guardarRecurrente() {
    if (!formRec.nombre.trim() || formRec.dias.length === 0) return;
    if (editandoRecId) {
      setRecurrentes((r) => r.map((x) => (x.id === editandoRecId ? { ...formRec, id: editandoRecId } : x)));
      setEditandoRecId(null);
    } else {
      setRecurrentes((r) => [...r, { ...formRec, id: nuevoId() }]);
    }
    setFormRec({ ...VACIA_REC });
  }

  function editarRecurrente(r) {
    setEditandoRecId(r.id);
    setFormRec({ ...r });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelarEdicionRec() { setEditandoRecId(null); setFormRec({ ...VACIA_REC }); }

  function borrarRecurrente(id) {
    const r = recurrentes.find((x) => x.id === id);
    pedir(`¿Borrar el recurrente "${r?.nombre}"?`, () => setRecurrentes((rs) => rs.filter((x) => x.id !== id)));
  }

  // ---------- Sugerencias del día ----------

  const weekdayFecha = weekdayOf(fecha);
  const recurrentesDelDia = recurrentes.filter((r) => r.dias.includes(weekdayFecha));
  const yaAgregados = new Set(paradas.filter((p) => p.fecha === fecha && p.recurrenteId).map((p) => p.recurrenteId));
  const sugerencias_dia = recurrentesDelDia.filter((r) => !yaAgregados.has(r.id));

  function agregarDesdeRecurrente(r) {
    const inp = cargasRec[r.id] || { carga: "", retira: "" };
    setParadas((p) => [...p, {
      id: nuevoId(),
      fecha,
      chofer: r.chofer,
      tipo: r.tipo,
      nombre: r.nombre,
      barrio: r.barrio,
      direccion: r.direccion,
      transporte: r.transporte,
      horario: r.horario,
      carga: inp.carga,
      retira: inp.retira,
      notas: "",
      impKey: "",
      recurrenteId: r.id,
      impFechaSug: "",
      impChoferSug: "",
    }]);
    setCargasRec((c) => { const n = { ...c }; delete n[r.id]; return n; });
  }

  // ---------- Derivados UI ----------

  const esRetiro = form.tipo === "Retiro";
  const paradasDia = paradas.filter((p) => p.fecha === fecha);
  const pendientes = paradas.filter((p) => !p.fecha);
  const dias = [...new Set(paradas.map((p) => p.fecha).filter(Boolean))].sort();
  const armaDespacho = form.tipo === "Entrega" && form.transporte.trim();
  const sugerenciasNombres = Object.values(libreta).map((v) => v.nombre);
  const entradasOrdenadas = Object.entries(libreta).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));

  const inputCls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none";
  const lblCls = "text-xs font-semibold uppercase tracking-wide text-slate-500";

  const SYNC_UI = {
    saving: { icon: <RefreshCw size={13} className="animate-spin" />, txt: "Guardando…", cls: "text-slate-500 bg-stone-100 border-stone-200" },
    saved:  { icon: <Cloud size={13} />, txt: "Guardado", cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    error:  { icon: <CloudOff size={13} />, txt: "Sin conexión", cls: "text-red-500 bg-red-50 border-red-200" },
  };
  const syncBadge = SYNC_UI[sync];

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }} className="min-h-screen bg-stone-100 text-slate-800 p-4 sm:p-6">
      <textarea ref={taRef} style={{ position: "absolute", left: "-9999px" }} readOnly />
      <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />

      {/* Modal de confirmación */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setConfirmar(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-700 mb-4">{confirmar.msg}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmar(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-slate-600 hover:bg-stone-50">Cancelar</button>
              <button onClick={() => { confirmar.onOk && confirmar.onOk(); setConfirmar(null); }} className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {aviso && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check size={15} className="text-emerald-400" /> {aviso}
        </div>
      )}

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-md bg-amber-400 flex items-center justify-center shadow-sm"><Truck size={20} className="text-slate-900" strokeWidth={2.5} /></div>
            <h1 className="text-xl font-bold tracking-tight">Generador de hojas de ruta</h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">Cargá las paradas → copiá el texto listo para WhatsApp</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncBadge && (
            <span className={`flex items-center gap-1.5 text-xs font-medium border px-2.5 py-2 rounded-lg ${syncBadge.cls}`}>
              {syncBadge.icon} {syncBadge.txt}
            </span>
          )}
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"
          >
            <FileUp size={16} className="text-violet-500" /> Importar pedidos
          </button>
          <button
            onClick={() => { setVerRecurrentes((v) => !v); setVerConsolidado(false); setVerLibreta(false); }}
            className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"
          >
            <Repeat size={16} className="text-sky-500" /> Recurrentes ({recurrentes.length})
          </button>
          <button
            onClick={() => { setVerConsolidado((v) => !v); setVerLibreta(false); setVerRecurrentes(false); }}
            className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"
          >
            <CalendarDays size={16} className="text-sky-500" /> Consolidado{dias.length > 0 ? ` (${dias.length} día${dias.length === 1 ? "" : "s"})` : ""}
          </button>
          <button
            onClick={() => { setVerLibreta((v) => !v); setVerConsolidado(false); setVerRecurrentes(false); }}
            className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"
          >
            <BookOpen size={16} className="text-amber-500" /> Libreta ({Object.keys(libreta).length})
          </button>
        </div>
      </div>

      {/* Mensaje de importación */}
      {importMsg && (
        <div className="max-w-6xl mx-auto mb-3">
          <div className="bg-violet-50 border border-violet-200 text-violet-800 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
            <FileUp size={15} /> {importMsg}
          </div>
        </div>
      )}

      {/* Panel Recurrentes */}
      {verRecurrentes && (
        <div className="max-w-6xl mx-auto mb-5 bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Repeat size={16} className="text-sky-500" /> Viajes recurrentes</h2>
            <button onClick={() => setVerRecurrentes(false)} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>
          </div>

          {/* Formulario crear/editar recurrente */}
          <div className="bg-stone-50 rounded-lg border border-stone-200 p-3 mb-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{editandoRecId ? "Editar recurrente" : "Nuevo recurrente"}</p>

            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <span className={lblCls}>Nombre</span>
                <input
                  list="lista-nombres-rec"
                  value={formRec.nombre}
                  onChange={(e) => autocompletarRec(e.target.value)}
                  placeholder="Cliente o destino…"
                  className={inputCls}
                />
                <datalist id="lista-nombres-rec">{sugerenciasNombres.map((n, i) => <option key={i} value={n} />)}</datalist>
              </div>
              <div>
                <span className={lblCls}>Tipo</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {TIPOS.map((t) => {
                    const on = formRec.tipo === t;
                    const col = t === "Entrega" ? "bg-emerald-600" : t === "Retiro" ? "bg-amber-500" : "bg-violet-600";
                    return <button key={t} onClick={() => setFormRec((f) => ({ ...f, tipo: t }))} className={`flex-1 py-2 text-xs font-medium leading-tight transition ${on ? col + " text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{t}</button>;
                  })}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <span className={lblCls}>Dirección</span>
                <input value={formRec.direccion} onChange={(e) => setFormRec((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <span className={lblCls}>Barrio</span>
                <input value={formRec.barrio} onChange={(e) => setFormRec((f) => ({ ...f, barrio: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <span className={lblCls}>Flete</span>
                <input value={formRec.transporte} onChange={(e) => setFormRec((f) => ({ ...f, transporte: e.target.value }))} placeholder="Barapack…" className={inputCls} />
              </div>
              <div>
                <span className={lblCls}>Horario</span>
                <input value={formRec.horario} onChange={(e) => setFormRec((f) => ({ ...f, horario: e.target.value }))} placeholder="antes de 13 hs" className={inputCls} />
              </div>
              <div>
                <span className={lblCls}>Chofer</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {CHOFERES.map((c) => (
                    <button key={c} onClick={() => setFormRec((f) => ({ ...f, chofer: c }))} className={`flex-1 py-2 text-sm font-medium transition ${formRec.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className={lblCls}>Días de la semana</span>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {DIAS_REC.map((d) => {
                  const on = formRec.dias.includes(d.val);
                  return (
                    <button key={d.val} onClick={() => toggleDiaRec(d.val)} className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${on ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-stone-300 hover:bg-stone-50"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              {editandoRecId && (
                <button onClick={cancelarEdicionRec} className="text-xs px-3 py-1.5 text-slate-500 border border-stone-300 rounded-lg flex items-center gap-1 hover:bg-stone-50"><X size={13} /> Cancelar</button>
              )}
              <button
                onClick={guardarRecurrente}
                disabled={!formRec.nombre.trim() || formRec.dias.length === 0}
                className="text-xs px-4 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white rounded-lg flex items-center gap-1"
              >
                <Save size={13} /> {editandoRecId ? "Guardar cambios" : "Crear recurrente"}
              </button>
            </div>
          </div>

          {/* Lista de recurrentes */}
          {recurrentes.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-4">No hay recurrentes todavía.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {recurrentes.map((r) => (
                <div key={r.id} className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${editandoRecId === r.id ? "border-sky-300 bg-sky-50" : "border-stone-200"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.nombre}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.tipo === "Entrega" ? "bg-emerald-100 text-emerald-700" : r.tipo === "Retiro" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>{r.tipo}</span>
                      <span className="text-xs text-slate-400">{r.chofer}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {DIAS_REC.filter((d) => r.dias.includes(d.val)).map((d) => (
                        <span key={d.val} className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">{d.label}</span>
                      ))}
                      {r.horario && <span className="text-xs text-slate-400">· {r.horario}</span>}
                      {r.barrio && <span className="text-xs text-slate-400">· {r.barrio}</span>}
                    </div>
                  </div>
                  <button onClick={() => editarRecurrente(r)} className="text-slate-300 hover:text-sky-600"><Pencil size={14} /></button>
                  <button onClick={() => borrarRecurrente(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel Consolidado */}
      {verConsolidado && (
        <div className="max-w-6xl mx-auto mb-5 bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><CalendarDays size={16} className="text-sky-500" /> Consolidado de viajes</h2>
            <div className="flex items-center gap-2">
              {dias.length > 0 && <button onClick={vaciarAgenda} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Eraser size={13} /> Vaciar todo</button>}
              <button onClick={() => setVerConsolidado(false)} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>
            </div>
          </div>
          {dias.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">No hay viajes cargados todavía.</div>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-auto">
              {dias.map((d) => {
                const pas = paradas.filter((p) => p.fecha === d);
                const past = d < hoyISO();
                return (
                  <div key={d} className={`rounded-lg border px-3 py-2.5 ${d === fecha ? "border-sky-300 bg-sky-50" : "border-stone-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fechaLarga(d)}</span>
                        <span className="text-xs text-slate-400">{pas.length} parada{pas.length === 1 ? "" : "s"}</span>
                        {past && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">pasado</span>}
                      </div>
                      <button onClick={() => { setFecha(d); setVerConsolidado(false); }} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium">Abrir <ArrowRight size={12} /></button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {CHOFERES.map((ch) => {
                        const ps = pas.filter((p) => p.chofer === ch);
                        return (
                          <div key={ch} className="rounded border border-stone-100 bg-stone-50/60 px-2 py-1.5">
                            <div className="text-[11px] font-semibold text-slate-500 mb-1">{ch} · {ps.length}</div>
                            {ps.length === 0 ? <div className="text-[11px] text-slate-300">—</div> : (
                              <div className="space-y-1">
                                {ps.map((p) => {
                                  const esD = p.tipo === "Entrega" && p.transporte;
                                  const col = esD ? "bg-sky-100 text-sky-700" : p.tipo === "Entrega" ? "bg-emerald-100 text-emerald-700" : p.tipo === "Retiro" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700";
                                  const ab = esD ? "Desp" : p.tipo === "Entrega y retiro" ? "E+R" : p.tipo.slice(0, 3);
                                  return (
                                    <div key={p.id} className="flex items-center gap-1.5 text-xs min-w-0">
                                      <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${col}`}>{ab}</span>
                                      <span className="font-medium truncate">{p.nombre}</span>
                                      {esD && <span className="text-sky-500 truncate shrink-0">vía {p.transporte}</span>}
                                      {!esD && p.barrio && <span className="text-slate-400 truncate">{p.barrio}</span>}
                                      {p.horario && <span className="text-slate-400 shrink-0">· {p.horario}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Panel Libreta */}
      {verLibreta && (
        <div className="max-w-6xl mx-auto mb-5 bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen size={16} className="text-amber-500" /> Libreta</h2>
            <div className="flex items-center gap-2">
              <button onClick={vaciarLibreta} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-stone-300 px-3 py-1.5 rounded-md hover:bg-red-50 text-red-500"><Eraser size={14} /> Vaciar</button>
              <button onClick={() => setVerLibreta(false)} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto">
            {entradasOrdenadas.map(([k, v]) => {
              const flete = v.transporte;
              return (
                <div key={k} className="rounded-lg border border-stone-200 px-3 py-2">
                  {editKey === k ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editVal.nombre} onChange={(e) => setEditVal({ ...editVal, nombre: e.target.value })} placeholder="Nombre" className="rounded border border-stone-300 px-2 py-1 text-sm" />
                        <input value={editVal.barrio} onChange={(e) => setEditVal({ ...editVal, barrio: e.target.value })} placeholder="Barrio" className="rounded border border-stone-300 px-2 py-1 text-sm" />
                      </div>
                      <input value={editVal.direccion} onChange={(e) => setEditVal({ ...editVal, direccion: e.target.value })} placeholder="Dirección (punto de entrega)" className="w-full rounded border border-stone-300 px-2 py-1 text-sm" />
                      <div className="grid grid-cols-3 gap-2">
                        <input value={editVal.transporte} onChange={(e) => setEditVal({ ...editVal, transporte: e.target.value })} placeholder="Flete" className="rounded border border-stone-300 px-2 py-1 text-sm" />
                        <input value={editVal.horario || ""} onChange={(e) => setEditVal({ ...editVal, horario: e.target.value })} placeholder="Horario" className="rounded border border-stone-300 px-2 py-1 text-sm" />
                        <input value={editVal.aliasesTxt} onChange={(e) => setEditVal({ ...editVal, aliasesTxt: e.target.value })} placeholder="Alias (coma)" className="rounded border border-stone-300 px-2 py-1 text-sm" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditKey(null); setEditVal(null); }} className="text-xs px-2 py-1 text-slate-500 flex items-center gap-1"><X size={13} /> Cancelar</button>
                        <button onClick={guardarEdit} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded flex items-center gap-1"><Save size={13} /> Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {v.nombre}
                          {flete && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">vía {flete}</span>}
                          {!flete && v.barrio && <span className="text-slate-400 font-normal text-xs">· {v.barrio}</span>}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {v.direccion || <span className="text-amber-500">{flete ? "sucursal a elección" : "falta dirección"}</span>}
                          {v.horario && <span className="text-slate-400"> · 🕐 {v.horario}</span>}
                        </div>
                        {(v.aliases || []).length > 0 && <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><Tag size={10} /> {v.aliases.join(", ")}</div>}
                      </div>
                      <button onClick={() => iniciarEdit(k)} className="text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                      <button onClick={() => borrarEntrada(k)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">

          {/* Selector de fecha y chofer */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={lblCls}>Día que estoy armando</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                <span className="text-xs text-slate-400 mt-0.5 block">{fechaLarga(fecha)}</span>
              </label>
              <label className="block">
                <span className={lblCls}>Chofer por default</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {CHOFERES.map((c) => (
                    <button key={c} onClick={() => setDefaultChofer(c)} className={`flex-1 py-2 text-sm font-medium transition ${defaultChofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>
                      {c}{c === "José" && <span className="opacity-60 text-xs"> (ppal)</span>}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            {dias.length > 0 && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <span className={lblCls}>Días programados</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {dias.map((d) => {
                    const n = paradas.filter((p) => p.fecha === d).length;
                    const on = d === fecha;
                    return (
                      <button key={d} onClick={() => setFecha(d)} className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-stone-300 hover:bg-stone-50"}`}>
                        {fechaLarga(d)} · {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sugerencias de recurrentes del día */}
          {sugerencias_dia.length > 0 && (
            <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setRecPanelAbierto((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-sky-50 transition"
              >
                <div className="flex items-center gap-2">
                  <Repeat size={15} className="text-sky-500" />
                  <span className="text-sm font-semibold text-sky-700">
                    {sugerencias_dia.length} recurrente{sugerencias_dia.length === 1 ? "" : "s"} para {fechaLarga(fecha)}
                  </span>
                </div>
                <ChevronRight size={15} className={`text-sky-400 transition-transform ${recPanelAbierto ? "rotate-90" : ""}`} />
              </button>
              {recPanelAbierto && (
                <div className="px-4 pb-4 space-y-3 border-t border-sky-100 pt-3">
                  {sugerencias_dia.map((r) => {
                    const inp = cargasRec[r.id] || { carga: "", retira: "" };
                    const esCombinado = r.tipo === "Entrega y retiro";
                    return (
                      <div key={r.id} className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.tipo === "Entrega" ? "bg-emerald-100 text-emerald-700" : r.tipo === "Retiro" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>{r.tipo}</span>
                          <span className="font-medium text-sm flex-1">{r.nombre}</span>
                          <span className="text-xs text-slate-400">{r.chofer}</span>
                        </div>
                        {r.barrio && <div className="text-xs text-slate-400 mb-2">{r.barrio}{r.horario ? " · " + r.horario : ""}</div>}
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1.5">
                            <input
                              value={inp.carga}
                              onChange={(e) => setCargasRec((c) => ({ ...c, [r.id]: { ...inp, carga: e.target.value } }))}
                              placeholder={esCombinado ? "Qué lleva…" : "Productos / carga (opcional)"}
                              className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs"
                            />
                            {esCombinado && (
                              <input
                                value={inp.retira}
                                onChange={(e) => setCargasRec((c) => ({ ...c, [r.id]: { ...inp, retira: e.target.value } }))}
                                placeholder="Qué retira…"
                                className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs"
                              />
                            )}
                          </div>
                          <button
                            onClick={() => agregarDesdeRecurrente(r)}
                            className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1"
                          >
                            <Plus size={13} /> Agregar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Formulario agregar parada */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {editandoId ? <Pencil size={16} className="text-sky-500" /> : <Plus size={16} className="text-amber-500" />}
                <h2 className="font-semibold text-sm">{editandoId ? "Editar parada" : "Agregar parada"}</h2>
              </div>
              {editandoId && <button onClick={cancelarEdicion} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><X size={13} /> Cancelar</button>}
            </div>
            <div className="space-y-3">
              <div>
                <span className={lblCls}>Tipo</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {TIPOS.map((t) => {
                    const on = form.tipo === t;
                    const col = t === "Entrega" ? "bg-emerald-600" : t === "Retiro" ? "bg-amber-500" : "bg-violet-600";
                    return <button key={t} onClick={() => setForm((f) => ({ ...f, tipo: t }))} className={`flex-1 py-2 text-xs font-medium leading-tight transition ${on ? col + " text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{t}</button>;
                  })}
                </div>
              </div>
              <div>
                <span className={lblCls}>Chofer</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {CHOFERES.map((c) => (
                    <button key={c} onClick={() => setForm((f) => ({ ...f, chofer: c }))} className={`flex-1 py-2 text-sm font-medium transition ${form.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{c}</button>
                  ))}
                </div>
              </div>

              <div>
                <span className={lblCls}>Nombre (cliente / proveedor)</span>
                <input list="lista-nombres" value={form.nombre} onChange={(e) => autocompletar(e.target.value)} placeholder="Reconstructora Union SA…" className={inputCls} />
                <datalist id="lista-nombres">{sugerenciasNombres.map((n, i) => <option key={i} value={n} />)}</datalist>
                {reconocido && <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><Check size={12} /> Reconocido — completé lo guardado</span>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><span className={lblCls}>Dirección (entrega)</span><input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} /></div>
                <div><span className={lblCls}>Barrio</span><input value={form.barrio} onChange={(e) => setForm((f) => ({ ...f, barrio: e.target.value }))} className={inputCls} /></div>
              </div>

              <div>
                <span className={lblCls}>{form.tipo === "Entrega y retiro" ? "Qué lleva" : "Productos / carga"}</span>
                <input value={form.carga} onChange={(e) => setForm((f) => ({ ...f, carga: e.target.value }))} placeholder={form.tipo === "Entrega y retiro" ? "pago, muestra, pedido…" : ""} className={inputCls} />
              </div>
              {form.tipo === "Entrega y retiro" && (
                <div><span className={lblCls}>Qué retira</span><input value={form.retira} onChange={(e) => setForm((f) => ({ ...f, retira: e.target.value }))} placeholder="qué trae de vuelta…" className={inputCls} /></div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><span className={lblCls}>Horario</span><input value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} placeholder="antes de 13 hs" className={inputCls} /></div>
                <div><span className={lblCls}>Flete {esRetiro ? "" : <span className="text-slate-300 normal-case">(opcional)</span>}</span><input value={form.transporte} onChange={(e) => setForm((f) => ({ ...f, transporte: e.target.value }))} placeholder="Barapack…" className={inputCls} /></div>
              </div>

              {armaDespacho && (
                <div className="flex items-start gap-2 text-xs bg-sky-50 border border-sky-200 rounded-md px-3 py-2 text-sky-800">
                  <PackageCheck size={14} className="mt-0.5 shrink-0" />
                  <span>Se arma como <strong>DESPACHO (vía {form.transporte})</strong> — destino: <strong>{form.direccion || "sucursal a elección"}</strong></span>
                </div>
              )}

              <div><span className={lblCls}>Notas</span><input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} className={inputCls} /></div>

              <button
                onClick={() => agregar(false)}
                disabled={!form.nombre.trim()}
                className={`w-full ${editandoId ? "bg-sky-500 hover:bg-sky-600 text-white" : "bg-amber-400 hover:bg-amber-500 text-slate-900"} disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2`}
              >
                {editandoId ? <><Save size={18} strokeWidth={2.5} /> Guardar cambios</> : <><Plus size={18} strokeWidth={2.5} /> Agregar al {fechaLarga(fecha)}</>}
              </button>

              {!editandoId && (
                <button
                  onClick={() => agregar(true)}
                  disabled={!form.nombre.trim()}
                  className="w-full border border-dashed border-stone-400 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Inbox size={15} /> Dejar pendiente (asignar día y chofer después)
                </button>
              )}

              {form.nombre.trim() && (
                <button onClick={actualizarLibreta} className="w-full border border-stone-300 hover:bg-stone-50 text-slate-600 text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2">
                  {libretaMsg ? <><Check size={15} className="text-emerald-600" /> Guardado en libreta</> : <><BookOpen size={15} /> Actualizar libreta (dirección · barrio · flete · horario)</>}
                </button>
              )}
            </div>
          </div>

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-300 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3"><Inbox size={16} className="text-slate-500" /><h2 className="font-semibold text-sm">Pendientes de asignar ({pendientes.length})</h2></div>
              <div className="space-y-2">
                {pendientes.map((p) => {
                  const d = getDraft(p.id);
                  const esD = p.tipo === "Entrega y retiro";
                  const col = esD ? "bg-violet-100 text-violet-700" : p.tipo === "Entrega" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
                  return (
                    <div key={p.id} className="rounded-lg border border-stone-200 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${col}`}>{esD ? "E+R" : p.tipo}</span>
                        <span className="font-medium text-sm truncate flex-1">{p.nombre}</span>
                        {p.impKey && <span title="Importado desde Excel" className="text-[10px] text-violet-500 shrink-0"><FileUp size={11} /></span>}
                        <button onClick={() => editarParada(p)} className="text-slate-300 hover:text-sky-600"><Pencil size={14} /></button>
                        <button onClick={() => borrar(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                      {p.carga && <div className="text-xs text-slate-500 truncate mb-2">{p.carga}</div>}
                      {p.notas && <div className="text-xs text-amber-700 truncate mb-2">{p.notas}</div>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={d.fecha} onChange={(e) => setDraft(p.id, { fecha: e.target.value })} className="rounded-md border border-stone-300 px-2 py-1 text-xs" />
                        <div className="flex rounded-md border border-stone-300 overflow-hidden">
                          {CHOFERES.map((c) => (
                            <button key={c} onClick={() => setDraft(p.id, { chofer: c })} className={`px-2.5 py-1 text-xs font-medium ${d.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500"}`}>{c}</button>
                          ))}
                        </div>
                        <button
                          onClick={() => asignar(p.id)}
                          disabled={!d.fecha || !d.chofer}
                          className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1"
                        >
                          <Check size={13} /> Asignar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de paradas del día */}
          {paradasDia.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Paradas del {fechaLarga(fecha)} ({paradasDia.length})</h2>
                <button onClick={limpiarDia} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><RotateCcw size={13} /> Vaciar este día</button>
              </div>
              <div className="space-y-2">
                {paradasDia.map((p, i) => {
                  const esD = p.tipo === "Entrega" && p.transporte;
                  const lbl = esD ? "Despacho" : p.tipo === "Entrega y retiro" ? "Entrega + Retiro" : p.tipo;
                  const col = esD ? "bg-sky-100 text-sky-700" : p.tipo === "Entrega" ? "bg-emerald-100 text-emerald-700" : p.tipo === "Retiro" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700";
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${editandoId === p.id ? "border-sky-400 ring-1 ring-sky-300 bg-sky-50" : "border-stone-200"}`}>
                      <div className="flex flex-col">
                        <button onClick={() => mover(p.id, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={14} /></button>
                        <button onClick={() => mover(p.id, 1)} disabled={i === paradasDia.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={14} /></button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${col}`}>{lbl}</span>
                          <span className="font-medium text-sm truncate">{p.nombre}</span>
                          {esD && <span className="text-xs text-sky-500 truncate">vía {p.transporte}</span>}
                          {!esD && p.barrio && <span className="text-xs text-slate-400 truncate">{p.barrio}</span>}
                          {p.recurrenteId && <Repeat size={11} className="text-sky-400 shrink-0" title="Recurrente" />}
                        </div>
                        {p.carga && <div className="text-xs text-slate-500 truncate">{p.carga}</div>}
                      </div>
                      <select value={p.chofer} onChange={(e) => cambiarChofer(p.id, e.target.value)} className="text-xs border border-stone-200 rounded px-1.5 py-1 bg-stone-50 text-slate-600">
                        {CHOFERES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => editarParada(p)} className="text-slate-300 hover:text-sky-600"><Pencil size={15} /></button>
                      <button onClick={() => borrar(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: previews de WhatsApp */}
        <div className="space-y-4">
          {CHOFERES.map((chofer) => {
            const txt = textoChofer(chofer, fecha, paradasDia);
            const cant = paradasDia.filter((p) => p.chofer === chofer).length;
            return (
              <div key={chofer} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
                  <span className="font-semibold text-sm">{chofer} <span className="opacity-50 font-normal">· {cant} parada{cant === 1 ? "" : "s"}</span></span>
                  <button onClick={() => copiar(chofer)} disabled={!txt} className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition">
                    {copiado === chofer ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                  </button>
                </div>
                <div className="p-3" style={{ background: "#e5ddd5" }}>
                  {txt ? (
                    <div className="rounded-lg rounded-tl-none px-3 py-2 text-[13px] leading-relaxed shadow-sm max-w-[340px]" style={{ background: "#dcf8c6", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {txt.split("\n").map((l, i) => <div key={i}>{conNegritas(l, i)}</div>)}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 text-sm py-8">Sin paradas para {chofer}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
