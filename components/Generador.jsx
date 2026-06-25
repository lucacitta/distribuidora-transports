"use client";

import React, { useState, useEffect, useRef } from "react";
import LIBRETA_JSON from "@/libreta_pulqui.json";
import {
  Plus, Trash2, Copy, Check, ChevronUp, ChevronDown, Truck, RotateCcw,
  BookOpen, Pencil, X, Save, Tag, PackageCheck, Eraser, CalendarDays,
  Inbox, Cloud, CloudOff, RefreshCw, FileUp, Repeat, Menu,
  ChevronLeft, ChevronRight, Search, History, MessageSquare, GripVertical,
} from "lucide-react";

// ─── Storage / API ────────────────────────────────────────────────────────────

const storage = {
  get: async (k) => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(k);
    return v == null ? null : { value: v };
  },
  set: async (k, v) => { if (typeof window !== "undefined") window.localStorage.setItem(k, v); },
};
async function apiGet(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.json();
}
async function apiSend(url, method, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}`);
  return r.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const nuevoId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
const BASE     = "Mons. Bufano 2357, San Justo";
const DIAS     = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CHOFERES = ["José", "Ariel"];
const TIPOS    = ["Entrega", "Retiro", "Entrega y retiro"];
const DIAS_REC = [{ label: "Dom", val: 0 }, { label: "Lun", val: 1 }, { label: "Mar", val: 2 }, { label: "Mié", val: 3 }, { label: "Jue", val: 4 }, { label: "Vie", val: 5 }, { label: "Sáb", val: 6 }];
const SEMILLA  = LIBRETA_JSON;
const VACIA    = { tipo: "Entrega", nombre: "", barrio: "", carga: "", retira: "", horario: "", transporte: "", direccion: "", notas: "" };
const VACIA_REC = { nombre: "", tipo: "Entrega", direccion: "", barrio: "", transporte: "", horario: "", chofer: "José", dias: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!propias.length) return "";
  let out = `*HOJA DE RUTA — ${chofer.toUpperCase()}*\n`;
  out += `${fechaLarga(fecha)} · Salida: ${BASE}\n`;
  propias.forEach((p, i) => {
    out += `\n━━━━━━━━━━\n`;
    const esD = p.tipo === "Entrega" && p.transporte;
    if (esD) {
      out += `*${i + 1} · DESPACHO — ${p.nombre} (vía ${p.transporte})*\n`;
      out += p.direccion ? `${p.direccion}\n` : `${p.transporte} — sucursal a elección\n`;
    } else {
      const barrio = p.barrio ? ` (${p.barrio})` : "";
      out += `*${i + 1} · ${p.tipo.toUpperCase()} — ${p.nombre}${barrio}*\n`;
      if (p.direccion) out += `${p.direccion}\n`;
    }
    const comb = p.tipo === "Entrega y retiro";
    if (p.carga)             out += `📦 ${comb ? "Lleva: " : ""}${p.carga}\n`;
    if (comb && p.retira)    out += `📥 Retira: ${p.retira}\n`;
    if (p.horario)           out += `🕐 ${p.horario}\n`;
    if (p.transporte && !esD) out += `🚛 ${p.transporte}\n`;
    if (p.notas)             out += `📝 ${p.notas}\n`;
  });
  out += `━━━━━━━━━━`;
  return out;
}

function conNegritas(linea, key) {
  const partes = linea.split(/(\*[^*]+\*)/g);
  return <span key={key}>{partes.map((t, i) => t.startsWith("*") && t.endsWith("*") ? <strong key={i}>{t.slice(1, -1)}</strong> : <span key={i}>{t}</span>)}</span>;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function TipoBadge({ tipo, transporte }) {
  const esD = tipo === "Entrega" && transporte;
  if (esD)                    return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-sky-100 text-sky-700">Despacho</span>;
  if (tipo === "Entrega")     return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">Entrega</span>;
  if (tipo === "Retiro")      return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">Retiro</span>;
  return                             <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">E + R</span>;
}

function RowAccent({ tipo, transporte }) {
  const esD = tipo === "Entrega" && transporte;
  if (esD)                return "border-l-2 border-sky-400";
  if (tipo === "Entrega") return "border-l-2 border-emerald-400";
  if (tipo === "Retiro")  return "border-l-2 border-amber-400";
  return "border-l-2 border-violet-400";
}

function WhatsAppMsg({ chofer, fecha, paradas, onCopy, copiado }) {
  const txt = textoChofer(chofer, fecha, paradas);
  if (!txt) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{chofer}</span>
        <button
          onClick={() => onCopy(chofer)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition ${copiado === chofer ? "bg-emerald-100 text-emerald-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {copiado === chofer ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
        </button>
      </div>
      <div className="rounded-xl rounded-tl-none px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm max-w-[360px]" style={{ background: "#dcf8c6", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {txt.split("\n").map((l, i) => <div key={i}>{conNegritas(l, i)}</div>)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Generador() {
  // Data
  const [fecha, setFecha]               = useState(hoyISO());
  const [defaultChofer, setDefaultChofer] = useState("José");
  const [paradas, setParadas]           = useState([]);
  const [libreta, setLibreta]           = useState({});
  const [recurrentes, setRecurrentes]   = useState([]);
  const [cargado, setCargado]           = useState(false);
  const [sync, setSync]                 = useState("idle");

  // Form
  const [form, setForm]               = useState({ ...VACIA, chofer: "José" });
  const [editandoId, setEditandoId]   = useState(null);
  const [reconocido, setReconocido]   = useState(false);
  const [libretaMsg, setLibretaMsg]   = useState(false);

  // Recurrentes form
  const [formRec, setFormRec]             = useState({ ...VACIA_REC });
  const [editandoRecId, setEditandoRecId] = useState(null);
  const [cargasRec, setCargasRec]         = useState({});

  // Libreta editing
  const [editKey, setEditKey]       = useState(null);
  const [editVal, setEditVal]       = useState(null);
  const [busqLibreta, setBusqLibreta] = useState("");

  // UI
  const [activeView, setActiveView]   = useState("agenda");
  const [panel, setPanel]             = useState(null);
  const [filtroChofer, setFiltroChofer] = useState("");
  const [copiado, setCopiado]         = useState(null);
  const [asigDraft, setAsigDraft]     = useState({});
  const [confirmar, setConfirmar]     = useState(null);
  const [aviso, setAviso]             = useState("");
  const [importMsg, setImportMsg]     = useState("");
  const [expandedDias, setExpandedDias]     = useState(new Set());
  const [expandedRecs, setExpandedRecs]     = useState(new Set());
  const [formRecAbierto, setFormRecAbierto] = useState(false);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [dragId, setDragId]                 = useState(null);
  const [dragOverId, setDragOverId]         = useState(null);


  // Refs
  const taRef              = useRef(null);
  const importRef          = useRef(null);
  const hydratedRef        = useRef(false);
  const skipLibretaSync    = useRef(false);
  const skipAgendaSync     = useRef(false);
  const skipRecurrentesSync = useRef(false);
  const libretaTimer       = useRef(null);
  const agendaTimer        = useRef(null);
  const recurrentesTimer   = useRef(null);

  // ── Sync ──────────────────────────────────────────────────────────────────

  async function pushJSON(url, method, body) {
    setSync("saving");
    try { await apiSend(url, method, body); setSync("saved"); }
    catch { setSync("error"); }
  }

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
          if (v.paradas) setParadas(v.paradas.map((p) => ({ ...p, id: String(p.id) })));
          if (v.defaultChofer) setDefaultChofer(v.defaultChofer);
        }
      } catch { /* noop */ }

      try {
        const [lr, ar, rr] = await Promise.all([apiGet("/api/libreta"), apiGet("/api/agenda"), apiGet("/api/recurrentes")]);
        const libSheet = lr.libreta && Object.keys(lr.libreta).length ? lr.libreta : null;
        if (libSheet) { skipLibretaSync.current = true; setLibreta(libSheet); storage.set("pulqui_libreta_v2", JSON.stringify(libSheet)).catch(() => {}); }
        else if (!lib) setLibreta(SEMILLA);

        if (Array.isArray(ar.paradas) && ar.paradas.length > 0) {
          skipAgendaSync.current = true;
          const loaded = ar.paradas.map((p) => ({ ...p, id: String(p.id) }));
          setParadas(loaded);
          const drafts = {};
          for (const p of loaded) if (!p.fecha && (p.impFechaSug || p.impChoferSug)) drafts[p.id] = { fecha: p.impFechaSug || hoyISO(), chofer: p.impChoferSug || "José" };
          if (Object.keys(drafts).length) setAsigDraft((d) => ({ ...d, ...drafts }));
        }
        if (Array.isArray(rr.recurrentes)) { skipRecurrentesSync.current = true; setRecurrentes(rr.recurrentes); }
      } catch { if (!lib) setLibreta(SEMILLA); }

      hydratedRef.current = true;
      setCargado(true);
    })();
  }, []);

  useEffect(() => { if (cargado) storage.set("pulqui_borrador", JSON.stringify({ fecha, paradas, defaultChofer })).catch(() => {}); }, [fecha, paradas, defaultChofer, cargado]);
  useEffect(() => { setForm((f) => ({ ...f, chofer: defaultChofer })); }, [defaultChofer]);
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

  // ── Business logic ─────────────────────────────────────────────────────────

  function guardarLibreta(nueva) { setLibreta(nueva); storage.set("pulqui_libreta_v2", JSON.stringify(nueva)).catch(() => {}); }

  function autocompletar(texto) {
    const hit = resolver(libreta, texto);
    if (hit) { setReconocido(true); setForm((f) => ({ ...f, nombre: hit.nombre, direccion: hit.direccion || "", barrio: hit.barrio || "", transporte: hit.transporte || "", horario: hit.horario || "" })); }
    else { setReconocido(false); setForm((f) => ({ ...f, nombre: texto })); }
  }

  function agregar(pendiente = false) {
    if (!form.nombre.trim()) return;
    if (editandoId) {
      setParadas((p) => p.map((x) => (x.id === editandoId ? { ...form, chofer: form.chofer || defaultChofer, id: editandoId, fecha } : x)));
      setEditandoId(null);
    } else {
      setParadas((p) => [...p, { ...form, id: nuevoId(), fecha: pendiente ? "" : fecha, chofer: pendiente ? "" : form.chofer, impKey: "", recurrenteId: "", impFechaSug: "", impChoferSug: "" }]);
      if (form.direccion.trim() || form.barrio.trim() || form.transporte.trim()) {
        const clave = norm(form.nombre);
        const prev  = libreta[clave] || {};
        guardarLibreta({ ...libreta, [clave]: { nombre: form.nombre.trim(), direccion: form.direccion.trim(), barrio: form.barrio.trim(), transporte: form.transporte.trim(), aliases: prev.aliases || [] } });
      }
    }
    setForm({ ...VACIA, chofer: defaultChofer });
    setReconocido(false);
    setPanel(null);
  }

  function abrirEditar(p) { setEditandoId(p.id); setForm({ ...p }); if (p.fecha) setFecha(p.fecha); setReconocido(false); setPanel({ mode: "edit", trip: p }); }
  function cancelarEdicion() { setEditandoId(null); setForm({ ...VACIA, chofer: defaultChofer }); setReconocido(false); setPanel(null); }

  function actualizarLibreta() {
    if (!form.nombre.trim()) return;
    const clave = norm(form.nombre); const prev = libreta[clave] || {};
    guardarLibreta({ ...libreta, [clave]: { nombre: form.nombre.trim(), direccion: form.direccion.trim(), barrio: form.barrio.trim(), transporte: form.transporte.trim(), horario: form.horario.trim(), aliases: prev.aliases || [] } });
    setLibretaMsg(true); setTimeout(() => setLibretaMsg(false), 1800);
  }

  const borrar = (id) => {
    setParadas((prev) => prev.filter((x) => x.id !== id));
    if (panel?.trip?.id === id) setPanel(null);
  };

  function mover(id, dir) {
    setParadas((p) => {
      const item = p.find((x) => x.id === id); if (!item) return p;
      const same = p.map((x, idx) => ({ x, idx })).filter((o) => o.x.fecha === item.fecha);
      const pos  = same.findIndex((o) => o.x.id === id), tgt = pos + dir;
      if (tgt < 0 || tgt >= same.length) return p;
      const a = same[pos].idx, b = same[tgt].idx, c = [...p]; [c[a], c[b]] = [c[b], c[a]]; return c;
    });
  }

  function reordenar(draggedId, targetId) {
    if (draggedId === targetId) return;
    setParadas((prev) => {
      const dragged = prev.find((x) => x.id === draggedId);
      if (!dragged) return prev;
      const rest = prev.filter((x) => x.id !== draggedId);
      const tgtIdx = rest.findIndex((x) => x.id === targetId);
      if (tgtIdx === -1) return prev;
      rest.splice(tgtIdx, 0, dragged);
      return rest;
    });
  }

  const cambiarChofer = (id, ch) => setParadas((p) => p.map((x) => (x.id === id ? { ...x, chofer: ch } : x)));
  const cambiarFecha  = (id, f)  => setParadas((p) => p.map((x) => (x.id === id ? { ...x, fecha: f } : x)));

  async function copiar(chofer, fechaCopia) {
    const f   = fechaCopia || fecha;
    const prs = paradas.filter((p) => p.fecha === f);
    const txt = textoChofer(chofer, f, prs);
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); } catch { if (taRef.current) { taRef.current.value = txt; taRef.current.select(); document.execCommand("copy"); } }
    setCopiado(chofer + (fechaCopia || ""));
    setTimeout(() => setCopiado(null), 1800);
    const propias = prs.filter((p) => p.chofer === chofer);
    apiSend("/api/hojas-de-ruta", "POST", { fecha: f, chofer, cant_paradas: propias.length, texto: txt, generado_en: new Date().toISOString() }).catch(() => {});
  }

  const pedir = (msg, onOk) => setConfirmar({ msg, onOk });

  const getDraft = (id) => asigDraft[id] || { fecha, chofer: "José" };
  const setDraft = (id, patch) => setAsigDraft((d) => ({ ...d, [id]: { ...getDraft(id), ...patch } }));
  function asignar(id) {
    const d = getDraft(id); if (!d.fecha || !d.chofer) return;
    setParadas((p) => p.map((x) => (x.id === id ? { ...x, fecha: d.fecha, chofer: d.chofer } : x)));
    setAsigDraft((prev) => { const c = { ...prev }; delete c[id]; return c; });
  }

  function iniciarEdit(k) { setEditKey(k); setEditVal({ ...libreta[k], aliasesTxt: (libreta[k].aliases || []).join(", ") }); }
  function guardarEdit() {
    const nuevoNombre = editVal.nombre.trim(); if (!nuevoNombre) return;
    const nuevaClave = norm(nuevoNombre);
    const entrada = { nombre: nuevoNombre, direccion: editVal.direccion.trim(), barrio: editVal.barrio.trim(), transporte: editVal.transporte.trim(), horario: (editVal.horario || "").trim(), aliases: editVal.aliasesTxt.split(",").map((s) => s.trim()).filter(Boolean) };
    const copia = { ...libreta }; if (nuevaClave !== editKey) delete copia[editKey]; copia[nuevaClave] = entrada;
    guardarLibreta(copia); setEditKey(null); setEditVal(null);
  }
  function borrarEntrada(k) { pedir(`¿Borrar "${libreta[k].nombre}" de la libreta?`, () => { const c = { ...libreta }; delete c[k]; guardarLibreta(c); }); }

  async function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ""; setImportMsg("Procesando…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("existingKeys", JSON.stringify(paradas.map((p) => p.impKey).filter(Boolean)));
      const res = await fetch("/api/importar-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor.");
      const nuevos = data.importados || [];
      if (!nuevos.length) { setImportMsg("No hay pedidos nuevos (completados o ya importados)."); }
      else {
        setParadas((p) => [...p, ...nuevos]);
        setAsigDraft((d) => { const patch = {}; for (const n of nuevos) patch[n.id] = { fecha: n.impFechaSug || hoyISO(), chofer: n.impChoferSug || "José" }; return { ...d, ...patch }; });
        setImportMsg(`Importados ${nuevos.length} pedido${nuevos.length === 1 ? "" : "s"} como pendientes.`);
        setActiveView("pendientes");
      }
    } catch (err) { setImportMsg("Error: " + err.message); }
    setTimeout(() => setImportMsg(""), 4000);
  }

  // Recurrentes
  function autocompletarRec(texto) { const hit = resolver(libreta, texto); if (hit) setFormRec((f) => ({ ...f, nombre: hit.nombre, direccion: hit.direccion || "", barrio: hit.barrio || "", transporte: hit.transporte || "", horario: hit.horario || "" })); else setFormRec((f) => ({ ...f, nombre: texto })); }
  function toggleDiaRec(val) { setFormRec((f) => ({ ...f, dias: f.dias.includes(val) ? f.dias.filter((d) => d !== val) : [...f.dias, val].sort((a, b) => a - b) })); }
  function guardarRecurrente() {
    if (!formRec.nombre.trim() || !formRec.dias.length) return;
    if (editandoRecId) { setRecurrentes((r) => r.map((x) => (x.id === editandoRecId ? { ...formRec, id: editandoRecId } : x))); setEditandoRecId(null); }
    else setRecurrentes((r) => [...r, { ...formRec, id: nuevoId() }]);
    setFormRec({ ...VACIA_REC });
    setFormRecAbierto(false);
  }
  function editarRecurrente(r) { setEditandoRecId(r.id); setFormRec({ ...r }); setFormRecAbierto(true); }
  function cancelarEdicionRec() { setEditandoRecId(null); setFormRec({ ...VACIA_REC }); setFormRecAbierto(false); }
  function borrarRecurrente(id) { const r = recurrentes.find((x) => x.id === id); pedir(`¿Borrar el recurrente "${r?.nombre}"?`, () => setRecurrentes((rs) => rs.filter((x) => x.id !== id))); }

  // Sugerencias recurrentes del día
  const weekdayFecha    = weekdayOf(fecha);
  const recurrentesDelDia = recurrentes.filter((r) => r.dias.includes(weekdayFecha));
  const yaAgregados     = new Set(paradas.filter((p) => p.fecha === fecha && p.recurrenteId).map((p) => p.recurrenteId));
  const sugerencias_dia = recurrentesDelDia.filter((r) => !yaAgregados.has(r.id));
  function agregarDesdeRecurrente(r) {
    const inp = cargasRec[r.id] || { carga: "", retira: "" };
    setParadas((p) => [...p, { id: nuevoId(), fecha, chofer: r.chofer, tipo: r.tipo, nombre: r.nombre, barrio: r.barrio, direccion: r.direccion, transporte: r.transporte, horario: r.horario, carga: inp.carga, retira: inp.retira, notas: "", impKey: "", recurrenteId: r.id, impFechaSug: "", impChoferSug: "" }]);
    setCargasRec((c) => { const n = { ...c }; delete n[r.id]; return n; });
  }

  // Day navigation (solo días con paradas, desde hoy en adelante para la agenda)
  const todosLosDias  = [...new Set(paradas.map((p) => p.fecha).filter(Boolean))].sort();
  const diasFuturos   = todosLosDias.filter((d) => d >= hoyISO());
  const diasPasados   = todosLosDias.filter((d) => d < hoyISO()).reverse(); // newest first

  function navDia(dir) {
    const [y, m, d] = fecha.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir);
    setFecha(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
  }

  // Derived
  const paradasDia       = paradas.filter((p) => p.fecha === fecha);
  const paradasFiltradas = filtroChofer ? paradasDia.filter((p) => p.chofer === filtroChofer) : paradasDia;
  const pendientes       = paradas.filter((p) => !p.fecha);
  const sugerenciasNombres = Object.values(libreta).map((v) => v.nombre);
  const entradasOrdenadas  = Object.entries(libreta).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const entradasFiltradas  = busqLibreta
    ? entradasOrdenadas.filter(([, v]) => norm(v.nombre).includes(norm(busqLibreta)) || norm(v.direccion || "").includes(norm(busqLibreta)))
    : entradasOrdenadas;

  const SYNC_UI = {
    saving: { icon: <RefreshCw size={11} className="animate-spin" />, label: "Guardando…", cls: "text-slate-400" },
    saved:  { icon: <Cloud size={11} />,    label: "Guardado",      cls: "text-emerald-500" },
    error:  { icon: <CloudOff size={11} />, label: "Sin conexión",  cls: "text-red-400" },
  };
  const syncUI  = SYNC_UI[sync];
  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-300 outline-none bg-white";
  const lblCls   = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", background: "#F5F0EA" }} className="flex h-screen overflow-hidden text-slate-800">
      <textarea ref={taRef} style={{ position: "absolute", left: "-9999px" }} readOnly />
      <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />

      {/* Confirm */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setConfirmar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-700 mb-5 leading-relaxed">{confirmar.msg}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmar(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => { confirmar.onOk?.(); setConfirmar(null); }} className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {aviso && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <Check size={14} className="text-emerald-400" /> {aviso}
        </div>
      )}

      {/* Backdrop mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ══════ SIDEBAR ══════ */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-64 md:w-60 flex flex-col shrink-0 transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`} style={{ background: "#0E0A04", borderRight: "1px solid #1E1508" }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid #1E1508" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0" style={{ background: "#F5A623" }}>
            <Truck size={20} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-black text-lg tracking-tight leading-none" style={{ color: "#F5A623", letterSpacing: "-0.02em" }}>PULQUI</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mt-0.5" style={{ color: "#6B4E2A" }}>Distribuidora</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2" style={{ color: "#4A3820" }}>Principal</p>
          {[
            { view: "agenda",      icon: <CalendarDays size={14} />, label: "Agenda",       badge: diasFuturos.length },
            { view: "pendientes",  icon: <Inbox size={14} />,        label: "Pendientes",   badge: pendientes.length },
            { view: "consolidado", icon: <MessageSquare size={14} />, label: "Consolidado", badge: diasFuturos.length },
          ].map(({ view, icon, label, badge }) => (
            <button key={view} onClick={() => { setActiveView(view); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === view ? "" : "text-[#8A6A3A] hover:bg-[#1A1209] hover:text-[#F5A623]"}`}
              style={activeView === view ? { background: "#F5A623", color: "#0E0A04" } : undefined}
            >
              <span className="flex items-center gap-2.5">{icon}{label}</span>
              {badge > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={activeView === view ? { background: "rgba(0,0,0,0.2)", color: "#0E0A04" } : { background: "#1E1508", color: "#6B4E2A" }}>{badge}</span>}
            </button>
          ))}

          <div className="pt-4 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2" style={{ color: "#4A3820" }}>Historial</p>
            <button onClick={() => { setActiveView("historial"); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "historial" ? "" : "text-[#8A6A3A] hover:bg-[#1A1209] hover:text-[#F5A623]"}`}
              style={activeView === "historial" ? { background: "#F5A623", color: "#0E0A04" } : undefined}
            >
              <span className="flex items-center gap-2.5"><History size={14} />Historial</span>
              {diasPasados.length > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={activeView === "historial" ? { background: "rgba(0,0,0,0.2)", color: "#0E0A04" } : { background: "#1E1508", color: "#6B4E2A" }}>{diasPasados.length}</span>}
            </button>
          </div>

          <div className="pt-4 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2" style={{ color: "#4A3820" }}>Configuración</p>
          </div>
          {[
            { view: "libreta",     icon: <BookOpen size={14} />, label: "Libreta",     badge: Object.keys(libreta).length },
            { view: "recurrentes", icon: <Repeat size={14} />,   label: "Recurrentes", badge: recurrentes.length },
          ].map(({ view, icon, label, badge }) => (
            <button key={view} onClick={() => { setActiveView(view); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === view ? "" : "text-[#8A6A3A] hover:bg-[#1A1209] hover:text-[#F5A623]"}`}
              style={activeView === view ? { background: "#F5A623", color: "#0E0A04" } : undefined}
            >
              <span className="flex items-center gap-2.5">{icon}{label}</span>
              {badge > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={activeView === view ? { background: "rgba(0,0,0,0.2)", color: "#0E0A04" } : { background: "#1E1508", color: "#6B4E2A" }}>{badge}</span>}
            </button>
          ))}

          <div className="pt-3 mt-2" style={{ borderTop: "1px solid #1E1508" }}>
            <button onClick={() => importRef.current?.click()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all text-[#6B4E2A] hover:bg-[#1A1209] hover:text-[#F5A623]"
            >
              <FileUp size={14} /> Importar Excel
            </button>
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 space-y-3" style={{ borderTop: "1px solid #1E1508" }}>
          {syncUI && <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${syncUI.cls}`}>{syncUI.icon} {syncUI.label}</div>}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "#4A3820" }}>Chofer default</div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #2A1F0E" }}>
              {CHOFERES.map((c) => (
                <button key={c} onClick={() => setDefaultChofer(c)} className="flex-1 py-1.5 text-xs font-bold transition-all"
                  style={defaultChofer === c ? { background: "#F5A623", color: "#0E0A04" } : { color: "#6B4E2A", background: "transparent" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ══════ MAIN ══════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="bg-white px-3 md:px-6 h-14 flex items-center gap-2 md:gap-3 shrink-0" style={{ borderBottom: "2px solid #F5A623", boxShadow: "0 1px 8px 0 rgba(245,166,35,0.08)" }}>
          {/* Hamburger — mobile only */}
          <button className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>

          {activeView === "agenda" && (
            <>
              <div className="flex items-center gap-1 min-w-0">
                <button onClick={() => navDia(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition shrink-0">
                  <ChevronLeft size={16} />
                </button>
                <div className="px-1 md:px-2 min-w-0">
                  <span className="font-bold text-slate-800 text-sm md:text-base truncate">{fechaLarga(fecha)}</span>
                  {fecha === hoyISO() && <span className="ml-1 md:ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "#FFF3D6", color: "#C47A0A" }}>Hoy</span>}
                </div>
                <button onClick={() => navDia(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition shrink-0">
                  <ChevronRight size={16} />
                </button>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="hidden md:block ml-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-400 focus:outline-none focus:border-amber-400" />
                {fecha !== hoyISO() && (
                  <button onClick={() => setFecha(hoyISO())} className="hidden md:flex ml-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition items-center gap-1.5">
                    <CalendarDays size={12} /> Hoy
                  </button>
                )}
              </div>

              <div className="hidden md:flex rounded-lg border border-slate-200 overflow-hidden ml-1">
                {[["", "Todos"], ["José", "José"], ["Ariel", "Ariel"]].map(([val, lbl]) => (
                  <button key={val} onClick={() => setFiltroChofer(val)} className={`px-3 py-1.5 text-xs font-semibold transition ${filtroChofer === val ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{lbl}</button>
                ))}
              </div>

              <div className="flex-1" />

              {importMsg && <span className="hidden md:flex text-xs text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg items-center gap-1.5"><FileUp size={12} /> {importMsg}</span>}

              {CHOFERES.map((ch) => {
                const txt = textoChofer(ch, fecha, paradasDia);
                const key = ch + (fecha || "");
                return (
                  <button key={ch} onClick={() => copiar(ch)} disabled={!txt} className={`hidden md:flex items-center gap-1.5 text-xs font-semibold border px-3 py-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed ${copiado === key ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {copiado === key ? <Check size={13} /> : <Copy size={13} />} {ch}
                  </button>
                );
              })}

              {paradasDia.length > 0 && (
                <button onClick={() => pedir(`¿Vaciar todos los viajes del ${fechaLarga(fecha)}?`, () => setParadas((p) => p.filter((x) => x.fecha !== fecha)))}
                  className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition">
                  <RotateCcw size={13} /> Vaciar día
                </button>
              )}
              <button onClick={() => { setForm({ ...VACIA, chofer: defaultChofer }); setEditandoId(null); setReconocido(false); setPanel({ mode: "create" }); }}
                className="flex items-center gap-1.5 font-bold px-3 md:px-4 py-1.5 rounded-lg text-sm shadow-sm transition shrink-0"
                style={{ background: "#F5A623", color: "#0E0A04" }}>
                <Plus size={15} strokeWidth={2.5} /> <span className="hidden sm:inline">Nuevo viaje</span><span className="sm:hidden">Nuevo</span>
              </button>
            </>
          )}

          {activeView === "pendientes" && (
            <>
              <div>
                <h1 className="font-bold text-slate-800 text-sm md:text-base">Pendientes</h1>
                <p className="text-xs text-slate-400">{pendientes.length} viaje{pendientes.length !== 1 ? "s" : ""} sin asignar</p>
              </div>
              <div className="flex-1" />
              {importMsg && <span className="text-xs text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><FileUp size={12} /> {importMsg}</span>}
            </>
          )}

          {activeView === "consolidado" && (
            <div>
              <h1 className="font-bold text-slate-800">Consolidado</h1>
              <p className="text-xs text-slate-400">Próximos días · {diasFuturos.length} día{diasFuturos.length !== 1 ? "s" : ""} programados</p>
            </div>
          )}

          {activeView === "historial" && (
            <div>
              <h1 className="font-bold text-slate-800">Historial</h1>
              <p className="text-xs text-slate-400">{diasPasados.length} día{diasPasados.length !== 1 ? "s" : ""} anteriores</p>
            </div>
          )}

          {activeView === "libreta" && (
            <>
              <div>
                <h1 className="font-bold text-slate-800">Libreta de clientes</h1>
                <p className="text-xs text-slate-400">{Object.keys(libreta).length} entradas</p>
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busqLibreta} onChange={(e) => setBusqLibreta(e.target.value)} placeholder="Buscar cliente…" className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 w-52" />
              </div>
              <button onClick={() => pedir("¿Vaciar TODA la libreta? No se puede deshacer.", () => guardarLibreta({}))} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 border border-slate-200 px-3 py-1.5 rounded-lg transition">
                <Eraser size={13} /> Vaciar
              </button>
            </>
          )}

          {activeView === "recurrentes" && (
            <div>
              <h1 className="font-bold text-slate-800">Viajes recurrentes</h1>
              <p className="text-xs text-slate-400">{recurrentes.length} templates guardados</p>
            </div>
          )}
        </header>

        {/* Chips de días futuros */}
        {activeView === "agenda" && diasFuturos.length > 0 && (
          <div className="flex items-center gap-2 px-4 md:px-6 py-2 overflow-x-auto bg-white border-b border-slate-100 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {diasFuturos.map((d) => {
              const cant = paradas.filter((p) => p.fecha === d).length;
              const activo = d === fecha;
              return (
                <button key={d} onClick={() => setFecha(d)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition"
                  style={activo
                    ? { background: "#0E0A04", color: "#F5A623", borderColor: "#0E0A04" }
                    : { background: "white", color: "#64748b", borderColor: "#e2e8f0" }}
                  onMouseEnter={(e) => { if (!activo) { e.currentTarget.style.borderColor = "#F5A623"; e.currentTarget.style.color = "#C47A0A"; } }}
                  onMouseLeave={(e) => { if (!activo) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; } }}
                >
                  {d === hoyISO() ? "Hoy" : fechaLarga(d)}
                  {cant > 0 && <span className="font-bold ml-1">{cant}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto p-3 md:p-6 space-y-4">

          {/* ═══ AGENDA ═══ */}
          {activeView === "agenda" && (
            <>
              {/* Stats row */}
              {paradasDia.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total hoy", value: paradasDia.length, color: "text-slate-800", bg: "bg-white" },
                    { label: "José", value: paradasDia.filter((p) => p.chofer === "José").length, color: "text-slate-700", bg: "bg-white" },
                    { label: "Ariel", value: paradasDia.filter((p) => p.chofer === "Ariel").length, color: "text-slate-700", bg: "bg-white" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl border border-slate-200 px-4 py-3 shadow-sm`}>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
                      <div className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recurrentes sugeridos — desplegable */}
              {sugerencias_dia.length > 0 && (() => {
                const abierto = expandedRecs.has("sugeridos");
                return (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => setExpandedRecs((s) => { const n = new Set(s); n.has("sugeridos") ? n.delete("sugeridos") : n.add("sugeridos"); return n; })}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition text-left"
                    >
                      <Repeat size={14} className="text-slate-500" />
                      <span className="text-sm font-bold text-slate-700">Recurrentes sugeridos para hoy</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF3D6", color: "#C47A0A" }}>{sugerencias_dia.length}</span>
                      <div className="flex-1" />
                      <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`} />
                    </button>
                    {abierto && (
                      <div className="border-t border-slate-100 divide-y divide-slate-100">
                        {sugerencias_dia.map((r) => {
                          const inp = cargasRec[r.id] || { carga: "", retira: "" };
                          return (
                            <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap bg-slate-50">
                              <TipoBadge tipo={r.tipo} transporte={r.transporte} />
                              <span className="font-semibold text-sm text-slate-800 flex-1 min-w-0 truncate">{r.nombre}</span>
                              {r.barrio && <span className="text-xs text-slate-400">{r.barrio}</span>}
                              <input value={inp.carga} onChange={(e) => setCargasRec((c) => ({ ...c, [r.id]: { ...inp, carga: e.target.value } }))} placeholder="Qué lleva…" className="border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs w-36 focus:outline-none focus:border-amber-400" />
                              {r.tipo === "Entrega y retiro" && <input value={inp.retira} onChange={(e) => setCargasRec((c) => ({ ...c, [r.id]: { ...inp, retira: e.target.value } }))} placeholder="Qué retira…" className="border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs w-36 focus:outline-none focus:border-amber-400" />}
                              <button onClick={() => agregarDesdeRecurrente(r)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0" style={{ background: "#F5A623", color: "#0E0A04" }}><Plus size={12} /> Agregar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tablas por chofer */}
              {paradasDia.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-slate-400">
                  <CalendarDays size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-semibold text-slate-500">Sin viajes para {fechaLarga(fecha)}</p>
                  <p className="text-xs mt-1">Usá el botón "Nuevo viaje" para agregar uno</p>
                </div>
              ) : (
                CHOFERES.map((chofer) => {
                  const filas = paradasDia.filter((p) => p.chofer === chofer);
                  if (!filas.length) return null;
                  return (
                    <div key={chofer} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Header del chofer */}
                      <div className="flex items-center gap-2.5 px-5 py-3" style={{ background: "#0E0A04" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: "#F5A623", color: "#0E0A04" }}>
                          {chofer[0]}
                        </div>
                        <span className="font-bold text-white text-sm">{chofer}</span>
                        <span className="text-xs font-semibold" style={{ color: "#6B4E2A" }}>{filas.length} viaje{filas.length !== 1 ? "s" : ""}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left pl-5 pr-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 w-28">Tipo</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Cliente / Proveedor</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden sm:table-cell">Barrio</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden md:table-cell">Dirección</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden lg:table-cell">Carga</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden sm:table-cell">Fecha</th>
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden lg:table-cell">Horario</th>
                            <th className="w-24"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filas.map((p, i) => (
                            <tr key={p.id}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(p.id); }}
                              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(p.id); }}
                              onDrop={(e) => { e.preventDefault(); if (dragId) reordenar(dragId, p.id); setDragId(null); setDragOverId(null); }}
                              onClick={() => { if (!dragId) setPanel({ mode: "detail", trip: p }); }}
                              className={`transition group ${RowAccent({ tipo: p.tipo, transporte: p.transporte })} ${dragId === p.id ? "opacity-30" : dragOverId === p.id && dragId !== p.id ? "bg-amber-100" : "hover:bg-amber-50/40"}`}
                              style={{ cursor: dragId ? "grabbing" : "grab" }}
                            >
                              <td className="pl-2 pr-1 py-3.5 w-5">
                                <GripVertical size={13} className="text-slate-300 group-hover:text-slate-400 transition" />
                              </td>
                              <td className="pr-3 py-3.5"><TipoBadge tipo={p.tipo} transporte={p.transporte} /></td>
                              <td className="px-3 py-3.5">
                                <div className="font-semibold text-slate-800">{p.nombre}</div>
                              </td>
                              <td className="px-3 py-3.5 text-slate-500 text-xs hidden sm:table-cell">{p.barrio || <span className="text-slate-300">—</span>}</td>
                              <td className="px-3 py-3.5 text-slate-500 text-xs hidden md:table-cell max-w-[180px] truncate">{p.direccion || <span className="text-slate-300">—</span>}</td>
                              <td className="px-3 py-3.5 text-xs hidden lg:table-cell max-w-[180px]">
                                {p.carga
                                  ? <div className="text-slate-600 truncate"><span className="font-semibold text-slate-400">{p.tipo === "Retiro" ? "Retira:" : "Lleva:"}</span> {p.carga}</div>
                                  : <span className="text-slate-300">—</span>}
                                {p.tipo === "Entrega y retiro" && p.retira
                                  ? <div className="text-slate-600 truncate mt-0.5"><span className="font-semibold text-slate-400">Retira:</span> {p.retira}</div>
                                  : null}
                              </td>
                              <td className="px-3 py-3.5 hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="date"
                                  value={p.fecha || ""}
                                  onChange={(e) => cambiarFecha(p.id, e.target.value)}
                                  className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 focus:outline-none focus:border-amber-400 bg-white w-32"
                                />
                              </td>
                              <td className="px-3 py-3.5 text-slate-500 text-xs hidden lg:table-cell">{p.horario || <span className="text-slate-300">—</span>}</td>
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                  <button onClick={(e) => { e.stopPropagation(); mover(p.id, -1); }} disabled={i === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400"><ChevronUp size={13} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); mover(p.id, 1); }} disabled={i === filas.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400"><ChevronDown size={13} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); abrirEditar(p); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-sky-600"><Pencil size={13} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); pedir(`¿Eliminar el viaje a ${p.nombre}?`, () => borrar(p.id)); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}

              {/* Viajes sin chofer asignado */}
              {(() => {
                const sinChofer = paradasDia.filter((p) => !p.chofer);
                if (!sinChofer.length) return null;
                return (
                  <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3 bg-red-50 border-b border-red-100">
                      <span className="font-bold text-red-600 text-sm">Sin chofer asignado</span>
                      <span className="text-xs text-red-400">{sinChofer.length} viaje{sinChofer.length !== 1 ? "s" : ""} · asigná un chofer para que aparezcan en la hoja de ruta</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {sinChofer.map((p) => (
                          <tr key={p.id} onClick={() => setPanel({ mode: "detail", trip: p })} className={`hover:bg-amber-50/40 cursor-pointer transition group ${RowAccent({ tipo: p.tipo, transporte: p.transporte })}`}>
                            <td className="pl-4 pr-3 py-3.5"><TipoBadge tipo={p.tipo} transporte={p.transporte} /></td>
                            <td className="px-3 py-3.5 font-semibold text-slate-800">{p.nombre}</td>
                            <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                                {CHOFERES.map((c) => (
                                  <button key={c} onClick={() => cambiarChofer(p.id, c)} className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition">{c}</button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={(e) => { e.stopPropagation(); abrirEditar(p); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-sky-600"><Pencil size={13} /></button>
                                <button onClick={(e) => { e.stopPropagation(); pedir(`¿Eliminar el viaje a ${p.nombre}?`, () => borrar(p.id)); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* WhatsApp messages — siempre visibles si hay paradas */}
              {paradasDia.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={15} className="text-emerald-600" />
                      <span className="font-bold text-slate-700 text-sm">Mensajes para WhatsApp</span>
                    </div>
                    <span className="text-xs text-slate-400">{fechaLarga(fecha)}</span>
                  </div>
                  <div className="p-5 grid sm:grid-cols-2 gap-6" style={{ background: "#f0f2f5" }}>
                    {CHOFERES.map((ch) => {
                      const key = ch + fecha;
                      return (
                        <WhatsAppMsg key={ch} chofer={ch} fecha={fecha} paradas={paradasDia}
                          onCopy={(c) => copiar(c, fecha)}
                          copiado={copiado === key ? ch : null} />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              {paradasDia.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-medium">{paradasDia.length} viaje{paradasDia.length !== 1 ? "s" : ""} en total</span>
                  <button onClick={() => pedir(`¿Vaciar las paradas del ${fechaLarga(fecha)}?`, () => setParadas((p) => p.filter((x) => x.fecha !== fecha)))} className="flex items-center gap-1 hover:text-red-500 transition font-medium">
                    <RotateCcw size={11} /> Vaciar este día
                  </button>
                </div>
              )}

            </>
          )}

          {/* ═══ PENDIENTES ═══ */}
          {activeView === "pendientes" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {!pendientes.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Inbox size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-semibold text-slate-500">No hay pendientes</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-100">
                      <th className="text-left pl-5 pr-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 w-28">Tipo</th>
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Cliente / Proveedor</th>
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden md:table-cell">Carga</th>
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Asignar</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendientes.map((p) => {
                      const d = getDraft(p.id);
                      return (
                        <tr key={p.id} className={`hover:bg-amber-50/30 transition ${RowAccent({ tipo: p.tipo, transporte: p.transporte })}`}>
                          <td className="pl-4 pr-3 py-3.5"><TipoBadge tipo={p.tipo} transporte={p.transporte} /></td>
                          <td className="px-3 py-3.5">
                            <div className="font-semibold text-slate-800">{p.nombre}</div>
                            {p.barrio && <div className="text-xs text-slate-400 mt-0.5">{p.barrio}</div>}
                          </td>
                          <td className="px-3 py-3.5 text-slate-500 text-xs hidden md:table-cell max-w-[160px] truncate">{p.carga || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="date" value={d.fecha} onChange={(e) => setDraft(p.id, { fecha: e.target.value })} className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-400" />
                              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                {CHOFERES.map((c) => <button key={c} onClick={() => setDraft(p.id, { chofer: c })} className={`px-2.5 py-1 text-xs font-semibold transition ${d.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{c}</button>)}
                              </div>
                              <button onClick={() => asignar(p.id)} disabled={!d.fecha || !d.chofer} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition" style={{ background: "#F5A623", color: "#0E0A04" }}><Check size={12} /> Asignar</button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => abrirEditar(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-sky-600"><Pencil size={13} /></button>
                              <button onClick={() => pedir(`¿Eliminar el pendiente de ${p.nombre}?`, () => borrar(p.id))} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ═══ CONSOLIDADO & HISTORIAL (shared DayTable component logic) ═══ */}
          {(activeView === "consolidado" || activeView === "historial") && (() => {
            const listaDias = activeView === "consolidado" ? diasFuturos : diasPasados;
            const empty     = activeView === "consolidado" ? "No hay días programados próximamente." : "El historial está vacío.";

            if (!listaDias.length) return (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
                <History size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-semibold text-slate-500">{empty}</p>
              </div>
            );

            return (
              <div className="space-y-2">
                {listaDias.map((dia) => {
                  const ps    = paradas.filter((p) => p.fecha === dia);
                  const pJose = ps.filter((p) => p.chofer === "José");
                  const pAriel = ps.filter((p) => p.chofer === "Ariel");
                  const expanded = expandedDias.has(dia);
                  const isPast   = dia < hoyISO();

                  return (
                    <div key={dia} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${expanded ? "border-amber-300 shadow-amber-100" : "border-slate-200"}`}>
                      {/* Row header */}
                      <button
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition text-left"
                        onClick={() => setExpandedDias((s) => { const n = new Set(s); n.has(dia) ? n.delete(dia) : n.add(dia); return n; })}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{fechaLarga(dia)}</span>
                            {!isPast && dia === hoyISO() && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "#FFF3D6", color: "#C47A0A" }}>Hoy</span>}
                            {isPast && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Pasado</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400">{ps.length} viaje{ps.length !== 1 ? "s" : ""}</span>
                            {pJose.length > 0 && <span className="text-xs font-medium text-slate-600">José: <strong>{pJose.length}</strong></span>}
                            {pAriel.length > 0 && <span className="text-xs font-medium text-slate-600">Ariel: <strong>{pAriel.length}</strong></span>}
                          </div>
                        </div>
                        {/* Mini tipo breakdown */}
                        <div className="hidden sm:flex items-center gap-1.5">
                          {["Entrega", "Retiro", "Entrega y retiro"].map((t) => {
                            const cnt = ps.filter((p) => p.tipo === t && !(p.tipo === "Entrega" && p.transporte)).length;
                            const despCnt = t === "Entrega" ? ps.filter((p) => p.tipo === "Entrega" && p.transporte).length : 0;
                            return cnt > 0 ? <TipoBadge key={t} tipo={t} /> : null;
                          })}
                        </div>
                        <ChevronRight size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </button>

                      {/* Expanded content */}
                      {expanded && (
                        <div className="border-t border-slate-100">
                          {/* Trip list */}
                          <div className="divide-y divide-slate-100">
                            {ps.map((p) => (
                              <div key={p.id} className={`flex items-center gap-3 pl-5 pr-4 py-3 ${RowAccent({ tipo: p.tipo, transporte: p.transporte })}`}>
                                <TipoBadge tipo={p.tipo} transporte={p.transporte} />
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-slate-800 text-sm">{p.nombre}</span>
                                  {p.barrio && <span className="text-xs text-slate-400 ml-2">{p.barrio}</span>}
                                  {p.carga && <div className="text-xs text-slate-500 mt-0.5 truncate">{p.carga}</div>}
                                </div>
                                <span className="text-xs font-medium text-slate-500 shrink-0">{p.chofer}</span>
                                {p.horario && <span className="text-xs text-slate-400 shrink-0">{p.horario}</span>}
                              </div>
                            ))}
                          </div>

                          {/* Day actions */}
                          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
                            <button onClick={() => { setFecha(dia); setActiveView("agenda"); }} className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                              <CalendarDays size={12} /> Ver en agenda
                            </button>
                            {!isPast && (
                              <button onClick={() => pedir(`¿Vaciar las paradas del ${fechaLarga(dia)}?`, () => setParadas((p) => p.filter((x) => x.fecha !== dia)))} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition">
                                <RotateCcw size={11} /> Vaciar día
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ LIBRETA ═══ */}
          {activeView === "libreta" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {!entradasFiltradas.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <BookOpen size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-semibold text-slate-500">{busqLibreta ? "Sin resultados" : "La libreta está vacía"}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-100">
                      <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Cliente / Proveedor</th>
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden md:table-cell">Dirección</th>
                      <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 hidden lg:table-cell">Flete / Barrio</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entradasFiltradas.map(([k, v]) => (
                      <tr key={k} className="hover:bg-slate-50 transition group">
                        {editKey === k ? (
                          <td colSpan={4} className="px-5 py-4">
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input value={editVal.nombre} onChange={(e) => setEditVal({ ...editVal, nombre: e.target.value })} placeholder="Nombre" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                                <input value={editVal.barrio} onChange={(e) => setEditVal({ ...editVal, barrio: e.target.value })} placeholder="Barrio" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                              </div>
                              <input value={editVal.direccion} onChange={(e) => setEditVal({ ...editVal, direccion: e.target.value })} placeholder="Dirección" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                              <div className="grid grid-cols-3 gap-2">
                                <input value={editVal.transporte} onChange={(e) => setEditVal({ ...editVal, transporte: e.target.value })} placeholder="Flete" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                                <input value={editVal.horario || ""} onChange={(e) => setEditVal({ ...editVal, horario: e.target.value })} placeholder="Horario" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                                <input value={editVal.aliasesTxt} onChange={(e) => setEditVal({ ...editVal, aliasesTxt: e.target.value })} placeholder="Alias (separados por coma)" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400" />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => { setEditKey(null); setEditVal(null); }} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center gap-1"><X size={12} /> Cancelar</button>
                                <button onClick={guardarEdit} className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1 font-semibold"><Save size={12} /> Guardar</button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-5 py-3.5">
                              <div className="font-semibold text-slate-800">{v.nombre}</div>
                              {(v.aliases || []).length > 0 && <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><Tag size={10} /> {v.aliases.join(", ")}</div>}
                            </td>
                            <td className="px-3 py-3.5 text-slate-500 text-xs hidden md:table-cell">{v.direccion || <span className="text-amber-400 italic">{v.transporte ? "sucursal a elección" : "falta dirección"}</span>}</td>
                            <td className="px-3 py-3.5 text-xs hidden lg:table-cell">
                              {v.transporte ? <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-semibold">vía {v.transporte}</span> : v.barrio ? <span className="text-slate-400">{v.barrio}</span> : null}
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => iniciarEdit(k)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-sky-600"><Pencil size={13} /></button>
                                <button onClick={() => borrarEntrada(k)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ═══ RECURRENTES ═══ */}
          {activeView === "recurrentes" && (
            <div className="space-y-3">

              {/* Toggle para abrir/cerrar formulario */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => {
                    if (formRecAbierto && !editandoRecId) {
                      setFormRecAbierto(false);
                      setFormRec({ ...VACIA_REC });
                    } else {
                      setFormRecAbierto(true);
                    }
                  }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: formRecAbierto ? "#F5A623" : "#F5F0EA" }}>
                      <Plus size={14} style={{ color: formRecAbierto ? "#0E0A04" : "#F5A623" }} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">
                        {editandoRecId ? "Editando recurrente" : "Nuevo recurrente"}
                      </div>
                      {!formRecAbierto && (
                        <div className="text-xs text-slate-400 mt-0.5">Hacé clic para agregar un viaje recurrente</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${formRecAbierto ? "rotate-90" : ""}`} />
                </button>

                {/* Formulario colapsable */}
                {formRecAbierto && (
                  <div className="border-t border-slate-100 px-5 py-5 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={lblCls}>Nombre</label>
                        <input list="lista-nombres-rec" value={formRec.nombre} onChange={(e) => autocompletarRec(e.target.value)} placeholder="Cliente o destino…" className={inputCls} />
                        <datalist id="lista-nombres-rec">{sugerenciasNombres.map((n, i) => <option key={i} value={n} />)}</datalist>
                      </div>
                      <div>
                        <label className={lblCls}>Tipo</label>
                        <div className="mt-1 flex rounded-lg border border-slate-200 overflow-hidden">
                          {TIPOS.map((t) => { const on = formRec.tipo === t; const col = t === "Entrega" ? "bg-emerald-600" : t === "Retiro" ? "bg-amber-500" : "bg-violet-600"; return <button key={t} onClick={() => setFormRec((f) => ({ ...f, tipo: t }))} className={`flex-1 py-2.5 text-xs font-bold transition ${on ? col + " text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{t}</button>; })}
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2"><label className={lblCls}>Dirección</label><input value={formRec.direccion} onChange={(e) => setFormRec((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} /></div>
                      <div><label className={lblCls}>Barrio</label><input value={formRec.barrio} onChange={(e) => setFormRec((f) => ({ ...f, barrio: e.target.value }))} className={inputCls} /></div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div><label className={lblCls}>Flete</label><input value={formRec.transporte} onChange={(e) => setFormRec((f) => ({ ...f, transporte: e.target.value }))} placeholder="Barapack…" className={inputCls} /></div>
                      <div><label className={lblCls}>Horario</label><input value={formRec.horario} onChange={(e) => setFormRec((f) => ({ ...f, horario: e.target.value }))} placeholder="antes de 13 hs" className={inputCls} /></div>
                      <div>
                        <label className={lblCls}>Chofer</label>
                        <div className="mt-1 flex rounded-lg border border-slate-200 overflow-hidden">
                          {CHOFERES.map((c) => <button key={c} onClick={() => setFormRec((f) => ({ ...f, chofer: c }))} className={`flex-1 py-2.5 text-sm font-semibold transition ${formRec.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{c}</button>)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className={lblCls}>Días de la semana</label>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {DIAS_REC.map((d) => { const on = formRec.dias.includes(d.val); return <button key={d.val} onClick={() => toggleDiaRec(d.val)} className={`px-3.5 py-1.5 text-xs font-bold rounded-full border transition ${on ? "border-transparent text-white" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`} style={on ? { background: "#F5A623", color: "#0E0A04", borderColor: "#F5A623" } : {}}>{d.label}</button>; })}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
                      <button onClick={cancelarEdicionRec} className="text-xs px-4 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 font-medium"><X size={12} /> Cancelar</button>
                      <button onClick={guardarRecurrente} disabled={!formRec.nombre.trim() || !formRec.dias.length} className="text-sm px-4 py-2 disabled:opacity-40 font-bold rounded-lg flex items-center gap-2 transition shadow-sm" style={{ background: "#F5A623", color: "#0E0A04" }}>
                        <Save size={14} /> {editandoRecId ? "Guardar cambios" : "Crear recurrente"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista desplegable */}
              {recurrentes.length > 0 ? (
                <div className="space-y-2">
                  {recurrentes.map((r) => {
                    const expanded = expandedRecs.has(r.id);
                    const toggle = () => setExpandedRecs((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; });
                    return (
                      <div key={r.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${editandoRecId === r.id ? "border-amber-300" : expanded ? "border-slate-300" : "border-slate-200"}`}>
                        {/* Fila principal — siempre visible */}
                        <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-left">
                          <TipoBadge tipo={r.tipo} transporte={r.transporte} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 text-sm">{r.nombre}</div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {DIAS_REC.filter((d) => r.dias.includes(d.val)).map((d) => (
                                <span key={d.val} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#FFF3D6", color: "#C47A0A" }}>{d.label}</span>
                              ))}
                              <span className="text-[10px] text-slate-400 font-medium">· {r.chofer}</span>
                            </div>
                          </div>
                          <ChevronRight size={15} className={`text-slate-400 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
                        </button>

                        {/* Detalle desplegado */}
                        {expanded && (
                          <div className="border-t border-slate-100 px-4 py-4 space-y-3 bg-slate-50">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                              {r.direccion && (
                                <div className="col-span-2">
                                  <span className="font-bold uppercase tracking-wide text-slate-400">Dirección</span>
                                  <div className="text-slate-700 mt-0.5">{r.direccion}</div>
                                </div>
                              )}
                              {r.barrio && (
                                <div>
                                  <span className="font-bold uppercase tracking-wide text-slate-400">Barrio</span>
                                  <div className="text-slate-700 mt-0.5">{r.barrio}</div>
                                </div>
                              )}
                              {r.transporte && (
                                <div>
                                  <span className="font-bold uppercase tracking-wide text-slate-400">Flete</span>
                                  <div className="text-slate-700 mt-0.5">{r.transporte}</div>
                                </div>
                              )}
                              {r.horario && (
                                <div>
                                  <span className="font-bold uppercase tracking-wide text-slate-400">Horario</span>
                                  <div className="text-slate-700 mt-0.5">{r.horario}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={(e) => { e.stopPropagation(); editarRecurrente(r); }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition bg-white">
                                <Pencil size={12} /> Editar
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); borrarRecurrente(r.id); }} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition">
                                <Trash2 size={12} /> Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !formRecAbierto && (
                  <div className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-14 text-slate-400">
                    <Repeat size={32} className="mb-3 opacity-20" />
                    <p className="text-sm font-semibold text-slate-500">No hay recurrentes todavía</p>
                    <p className="text-xs mt-1">Usá el botón de arriba para crear el primero</p>
                  </div>
                )
              )}
            </div>
          )}

        </main>
      </div>

      {/* ══════ SLIDE PANEL ══════ */}
      {panel && <div className="fixed inset-0 bg-black/25 z-30" onClick={() => { setPanel(null); cancelarEdicion(); }} />}
      <div className={`fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-40 flex flex-col transform transition-transform duration-300 ease-out ${panel ? "translate-x-0" : "translate-x-full"}`}>
        {panel && (
          <>
            {/* Panel header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${panel.mode === "detail" ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"}`}>
              <div>
                <h2 className="font-bold text-slate-800 text-base">
                  {panel.mode === "create" && "Nuevo viaje"}
                  {panel.mode === "edit"   && "Editar viaje"}
                  {panel.mode === "detail" && panel.trip?.nombre}
                </h2>
                {panel.mode === "detail" && panel.trip?.fecha && (
                  <p className="text-xs text-slate-400 mt-0.5">{fechaLarga(panel.trip.fecha)}</p>
                )}
              </div>
              <button onClick={() => { setPanel(null); cancelarEdicion(); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {/* DETAIL */}
              {panel.mode === "detail" && panel.trip && (() => {
                const p  = paradas.find((x) => x.id === panel.trip.id) || panel.trip;
                const esD = p.tipo === "Entrega" && p.transporte;
                const fields = [
                  { label: "Tipo", node: <TipoBadge tipo={p.tipo} transporte={p.transporte} /> },
                  { label: "Chofer", value: p.chofer },
                  { label: "Dirección", value: p.direccion },
                  { label: "Barrio", value: p.barrio },
                  { label: p.tipo === "Entrega y retiro" ? "Qué lleva" : "Carga", value: p.carga },
                  { label: "Qué retira", value: p.retira, hide: p.tipo !== "Entrega y retiro" },
                  { label: "Horario", value: p.horario },
                  { label: esD ? "Flete (despacho)" : "Flete", value: p.transporte },
                  { label: "Notas", value: p.notas },
                ];
                return (
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      {fields.filter((f) => !f.hide && (f.value || f.node)).map(({ label, value, node }) => (
                        <div key={label} className={label === "Carga" || label === "Qué lleva" || label === "Qué retira" || label === "Notas" ? "col-span-2" : ""}>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</div>
                          {node || <div className="text-slate-800 text-sm font-medium">{value}</div>}
                        </div>
                      ))}
                    </div>

                    {p.fecha && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Vista WhatsApp</div>
                        <div className="rounded-xl rounded-tl-none px-3.5 py-3 text-[12.5px] leading-relaxed shadow-sm" style={{ background: "#dcf8c6", whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: "340px" }}>
                          {textoChofer(p.chofer, p.fecha, paradas.filter((x) => x.fecha === p.fecha)).split("\n").map((l, i) => <div key={i}>{conNegritas(l, i)}</div>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CREATE / EDIT */}
              {(panel.mode === "create" || panel.mode === "edit") && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className={lblCls}>Tipo</label>
                    <div className="mt-1 flex rounded-lg border border-slate-200 overflow-hidden">
                      {TIPOS.map((t) => { const on = form.tipo === t; const col = t === "Entrega" ? "bg-emerald-600" : t === "Retiro" ? "bg-amber-500" : "bg-violet-600"; return <button key={t} onClick={() => setForm((f) => ({ ...f, tipo: t }))} className={`flex-1 py-2.5 text-xs font-bold leading-tight transition ${on ? col + " text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{t}</button>; })}
                    </div>
                  </div>
                  <div>
                    <label className={lblCls}>Chofer</label>
                    <div className="mt-1 flex rounded-lg border border-slate-200 overflow-hidden">
                      {CHOFERES.map((c) => <button key={c} onClick={() => setForm((f) => ({ ...f, chofer: c }))} className={`flex-1 py-2.5 text-sm font-semibold transition ${form.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{c}</button>)}
                    </div>
                  </div>
                  <div>
                    <label className={lblCls}>Cliente / Proveedor</label>
                    <input list="lista-nombres" value={form.nombre} onChange={(e) => autocompletar(e.target.value)} placeholder="Reconstructora Union SA…" className={inputCls} />
                    <datalist id="lista-nombres">{sugerenciasNombres.map((n, i) => <option key={i} value={n} />)}</datalist>
                    {reconocido && <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><Check size={12} /> Reconocido de la libreta</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2"><label className={lblCls}>Dirección</label><input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} /></div>
                    <div><label className={lblCls}>Barrio</label><input value={form.barrio} onChange={(e) => setForm((f) => ({ ...f, barrio: e.target.value }))} className={inputCls} /></div>
                  </div>
                  <div>
                    <label className={lblCls}>{form.tipo === "Entrega y retiro" ? "Qué lleva" : "Carga / Productos"}</label>
                    <input value={form.carga} onChange={(e) => setForm((f) => ({ ...f, carga: e.target.value }))} placeholder={form.tipo === "Entrega y retiro" ? "pago, muestra, pedido…" : ""} className={inputCls} />
                  </div>
                  {form.tipo === "Entrega y retiro" && (
                    <div>
                      <label className={lblCls}>Qué retira</label>
                      <input value={form.retira} onChange={(e) => setForm((f) => ({ ...f, retira: e.target.value }))} placeholder="qué trae de vuelta…" className={inputCls} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lblCls}>Horario</label><input value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} placeholder="antes de 13 hs" className={inputCls} /></div>
                    <div><label className={lblCls}>Flete {form.tipo !== "Retiro" && <span className="text-slate-300 normal-case font-normal">(opcional)</span>}</label><input value={form.transporte} onChange={(e) => setForm((f) => ({ ...f, transporte: e.target.value }))} placeholder="Barapack…" className={inputCls} /></div>
                  </div>
                  {form.tipo === "Entrega" && form.transporte.trim() && (
                    <div className="flex items-start gap-2 text-xs bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5 text-sky-800">
                      <PackageCheck size={14} className="mt-0.5 shrink-0" />
                      <span>Se arma como <strong>DESPACHO (vía {form.transporte})</strong> — destino: <strong>{form.direccion || "sucursal a elección"}</strong></span>
                    </div>
                  )}
                  <div><label className={lblCls}>Notas</label><input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} className={inputCls} /></div>
                  <div>
                    <label className={lblCls}>Día</label>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                    <span className="text-xs text-slate-400 mt-0.5 block">{fechaLarga(fecha)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 shrink-0 space-y-2">
              {panel.mode === "detail" && (
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(panel.trip)} className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition">
                    <Pencil size={15} /> Editar
                  </button>
                  <button onClick={() => pedir(`¿Eliminar el viaje a ${panel.trip.nombre}?`, () => borrar(panel.trip.id))} className="flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-500 font-semibold py-2.5 px-4 rounded-lg text-sm transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
              {(panel.mode === "create" || panel.mode === "edit") && (
                <div className="space-y-2">
                  <button onClick={() => agregar(false)} disabled={!form.nombre.trim()} className="w-full disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm shadow-sm" style={{ background: panel.mode === "edit" ? "#0EA5E9" : "#F5A623", color: panel.mode === "edit" ? "#fff" : "#0E0A04" }}>
                    {panel.mode === "edit" ? <><Save size={16} /> Guardar cambios</> : <><Plus size={16} strokeWidth={2.5} /> Agregar al {fechaLarga(fecha)}</>}
                  </button>
                  {panel.mode === "create" && (
                    <button onClick={() => agregar(true)} disabled={!form.nombre.trim()} className="w-full border border-dashed border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-slate-600 text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2">
                      <Inbox size={14} /> Dejar pendiente (sin asignar día)
                    </button>
                  )}
                  {form.nombre.trim() && (
                    <button onClick={actualizarLibreta} className="w-full border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-medium py-2 rounded-lg transition flex items-center justify-center gap-2">
                      {libretaMsg ? <><Check size={13} className="text-emerald-600" /> Guardado en libreta</> : <><BookOpen size={13} /> Actualizar libreta</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
