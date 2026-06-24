"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Copy, Check, ChevronUp, ChevronDown, Truck, RotateCcw, BookOpen, Download, Upload, Pencil, X, Save, Tag, PackageCheck, Eraser, CalendarDays, ArrowRight, Inbox } from "lucide-react";

// Persistencia local. Reemplaza a window.storage (que era del sandbox donde
// se prototipó y no existe en un navegador real). Misma forma: get() devuelve
// { value } o null; set() devuelve una promesa. En la Fase 3 se sincroniza con Sheets.
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

const BASE = "Mons. Bufano 2357, San Justo";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CHOFERES = ["José", "Ariel"];
const TIPOS = ["Entrega", "Retiro", "Entrega y retiro"];

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
const norm = (s) => (s || "").trim().toLowerCase();

function resolver(libreta, texto) {
  const k = norm(texto);
  if (libreta[k]) return libreta[k];
  for (const v of Object.values(libreta)) if ((v.aliases || []).map(norm).includes(k)) return v;
  return null;
}

// La dirección cargada SIEMPRE es el punto de entrega.
// Si hay flete, el título lo marca como DESPACHO (vía flete); si no hay dirección, "sucursal a elección".
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
  return <span key={key}>{partes.map((t, i) => (t.startsWith("*") && t.endsWith("*") ? <strong key={i}>{t.slice(1, -1)}</strong> : <span key={i}>{t}</span>))}</span>;
}

const VACIA = { tipo: "Entrega", nombre: "", barrio: "", carga: "", retira: "", horario: "", transporte: "", direccion: "", notas: "" };

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
  const taRef = useRef(null);
  const importRef = useRef(null);
  const importAgendaRef = useRef(null);

  useEffect(() => {
    (async () => {
      let lib = null;
      try { const r = await storage.get("pulqui_libreta_v2"); if (r) lib = JSON.parse(r.value); } catch (e) {}
      if (!lib) { lib = SEMILLA; storage.set("pulqui_libreta_v2", JSON.stringify(lib)).catch(() => {}); }
      setLibreta(lib);
      try { const b = await storage.get("pulqui_borrador"); if (b) { const v = JSON.parse(b.value); if (v.fecha) setFecha(v.fecha); if (v.paradas) setParadas(v.paradas.map((p) => (p.fecha ? p : { ...p, fecha: v.fecha || hoyISO() }))); if (v.defaultChofer) setDefaultChofer(v.defaultChofer); } } catch (e) {}
      setCargado(true);
    })();
  }, []);

  useEffect(() => { if (cargado) storage.set("pulqui_borrador", JSON.stringify({ fecha, paradas, defaultChofer })).catch(() => {}); }, [fecha, paradas, defaultChofer, cargado]);
  useEffect(() => { setForm((f) => ({ ...f, chofer: defaultChofer })); }, [defaultChofer]);

  function guardarLibreta(nueva) { setLibreta(nueva); storage.set("pulqui_libreta_v2", JSON.stringify(nueva)).catch(() => {}); }

  function autocompletar(texto) {
    const hit = resolver(libreta, texto);
    if (hit) { setReconocido(true); setForm((f) => ({ ...f, nombre: hit.nombre, direccion: hit.direccion || "", barrio: hit.barrio || "", transporte: hit.transporte || "", horario: hit.horario || "" })); }
    else { setReconocido(false); setForm((f) => ({ ...f, nombre: texto })); }
  }

  function agregar(pendiente = false) {
    if (!form.nombre.trim()) return;
    if (editandoId) {
      setParadas((p) => p.map((x) => (x.id === editandoId ? { ...form, id: editandoId, fecha } : x)));
      setEditandoId(null);
    } else {
      setParadas((p) => [...p, { ...form, id: Date.now() + Math.random(), fecha: pendiente ? "" : fecha, chofer: pendiente ? "" : form.chofer }]);
      if (form.direccion.trim() || form.barrio.trim() || form.transporte.trim()) {
        const clave = norm(form.nombre);
        const prev = libreta[clave] || {};
        guardarLibreta({ ...libreta, [clave]: { nombre: form.nombre.trim(), direccion: form.direccion.trim(), barrio: form.barrio.trim(), transporte: form.transporte.trim(), aliases: prev.aliases || [] } });
      }
    }
    setForm({ ...VACIA, chofer: defaultChofer });
    setReconocido(false);
  }
  function editarParada(p) { setEditandoId(p.id); setForm({ ...p }); if (p.fecha) setFecha(p.fecha); setReconocido(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }
  function cancelarEdicion() { setEditandoId(null); setForm({ ...VACIA, chofer: defaultChofer }); setReconocido(false); }
  const getDraft = (id) => asigDraft[id] || { fecha: fecha, chofer: "José" };
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
    const txt = textoChofer(chofer, fecha, paradas.filter((p) => p.fecha === fecha)); if (!txt) return;
    try { await navigator.clipboard.writeText(txt); } catch (e) { if (taRef.current) { taRef.current.value = txt; taRef.current.select(); document.execCommand("copy"); } }
    setCopiado(chofer); setTimeout(() => setCopiado(null), 1800);
  }
  const pedir = (msg, onOk) => setConfirmar({ msg, onOk });
  const toast = (m) => { setAviso(m); setTimeout(() => setAviso(""), 2600); };
  function limpiarDia() { pedir(`¿Vaciar las paradas del ${fechaLarga(fecha)}? La libreta y los otros días se mantienen.`, () => setParadas((p) => p.filter((x) => x.fecha !== fecha))); }
  function vaciarAgenda() { pedir("¿Vaciar TODA la agenda? Borra los viajes de todos los días y no se puede deshacer. La libreta se mantiene.", () => { setParadas([]); setEditandoId(null); }); }
  function exportarAgenda() {
    const blob = new Blob([JSON.stringify({ paradas, defaultChofer }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `agenda_viajes_pulqui_${hoyISO()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importarAgenda(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let arr, dc;
      try {
        const data = JSON.parse(ev.target.result);
        arr = (Array.isArray(data) ? data : data.paradas || []).map((p) => (p.fecha ? p : { ...p, fecha: hoyISO() }));
        dc = !Array.isArray(data) ? data.defaultChofer : null;
      } catch (err) { toast("No pude leer el archivo de agenda."); return; }
      const aplicar = () => { setParadas(arr); if (dc) setDefaultChofer(dc); setEditandoId(null); toast(`Agenda importada: ${arr.length} viaje(s).`); };
      if (paradas.length > 0) pedir("Importar reemplaza la agenda actual por la del archivo. ¿Seguir?", aplicar);
      else aplicar();
    };
    reader.readAsText(file); e.target.value = "";
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(libreta, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `libreta_direcciones_pulqui_${hoyISO()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importar(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { const data = JSON.parse(ev.target.result); const merged = { ...libreta, ...data }; guardarLibreta(merged); toast(`Libreta importada: ${Object.keys(merged).length} entradas.`); } catch (err) { toast("No pude leer el archivo de libreta."); } };
    reader.readAsText(file); e.target.value = "";
  }
  function vaciarLibreta() { pedir("¿Vaciar TODA la libreta? Conviene exportar un backup antes. Esto no se puede deshacer.", () => guardarLibreta({})); }

  function iniciarEdit(k) { setEditKey(k); setEditVal({ ...libreta[k], aliasesTxt: (libreta[k].aliases || []).join(", ") }); }
  function guardarEdit() {
    const nuevoNombre = editVal.nombre.trim(); if (!nuevoNombre) return;
    const nuevaClave = norm(nuevoNombre);
    const entrada = { nombre: nuevoNombre, direccion: editVal.direccion.trim(), barrio: editVal.barrio.trim(), transporte: editVal.transporte.trim(), horario: (editVal.horario || "").trim(), aliases: editVal.aliasesTxt.split(",").map((s) => s.trim()).filter(Boolean) };
    const copia = { ...libreta }; if (nuevaClave !== editKey) delete copia[editKey]; copia[nuevaClave] = entrada;
    guardarLibreta(copia); setEditKey(null); setEditVal(null);
  }
  function borrarEntrada(k) { pedir(`¿Borrar "${libreta[k].nombre}" de la libreta?`, () => { const c = { ...libreta }; delete c[k]; guardarLibreta(c); }); }

  const esRetiro = form.tipo === "Retiro";
  const paradasDia = paradas.filter((p) => p.fecha === fecha);
  const pendientes = paradas.filter((p) => !p.fecha);
  const dias = [...new Set(paradas.map((p) => p.fecha).filter(Boolean))].sort();
  const armaDespacho = form.tipo === "Entrega" && form.transporte.trim();
  const sugerencias = Object.values(libreta).map((v) => v.nombre);
  const entradasOrdenadas = Object.entries(libreta).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));

  const inputCls = "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none";
  const lblCls = "text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }} className="min-h-screen bg-stone-100 text-slate-800 p-4 sm:p-6">
      <textarea ref={taRef} style={{ position: "absolute", left: "-9999px" }} readOnly />

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
      {aviso && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check size={15} className="text-emerald-400" /> {aviso}
        </div>
      )}

      <div className="max-w-6xl mx-auto mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-md bg-amber-400 flex items-center justify-center shadow-sm"><Truck size={20} className="text-slate-900" strokeWidth={2.5} /></div>
            <h1 className="text-xl font-bold tracking-tight">Generador de hojas de ruta</h1>
          </div>
          <p className="text-sm text-slate-500 ml-12">Cargá las paradas → copiá el texto listo para WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setVerConsolidado((v) => !v); setVerLibreta(false); }} className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"><CalendarDays size={16} className="text-sky-500" /> Consolidado{dias.length > 0 ? ` (${dias.length} día${dias.length === 1 ? "" : "s"})` : ""}</button>
          <button onClick={() => { setVerLibreta((v) => !v); setVerConsolidado(false); }} className="flex items-center gap-2 text-sm font-medium bg-white border border-stone-300 hover:bg-stone-50 px-3 py-2 rounded-lg shadow-sm"><BookOpen size={16} className="text-amber-500" /> Libreta ({Object.keys(libreta).length})</button>
        </div>
      </div>

      {verConsolidado && (
        <div className="max-w-6xl mx-auto mb-5 bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><CalendarDays size={16} className="text-sky-500" /> Consolidado de viajes</h2>
            <div className="flex items-center gap-2">
              <button onClick={exportarAgenda} disabled={dias.length === 0} className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30"><Download size={14} /> Exportar</button>
              <button onClick={() => importAgendaRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-stone-300 px-3 py-1.5 rounded-md hover:bg-stone-50"><Upload size={14} /> Importar</button>
              <input ref={importAgendaRef} type="file" accept="application/json,.json" onChange={importarAgenda} style={{ display: "none" }} />
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

      {verLibreta && (
        <div className="max-w-6xl mx-auto mb-5 bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen size={16} className="text-amber-500" /> Libreta</h2>
            <div className="flex items-center gap-2">
              <button onClick={exportar} className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-700"><Download size={14} /> Exportar</button>
              <button onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-stone-300 px-3 py-1.5 rounded-md hover:bg-stone-50"><Upload size={14} /> Importar</button>
              <button onClick={vaciarLibreta} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-stone-300 px-3 py-1.5 rounded-md hover:bg-red-50 text-red-500"><Eraser size={14} /> Vaciar</button>
              <input ref={importRef} type="file" accept="application/json,.json" onChange={importar} style={{ display: "none" }} />
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
            );})}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className={lblCls}>Día que estoy armando</span>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                <span className="text-xs text-slate-400 mt-0.5 block">{fechaLarga(fecha)}</span></label>
              <label className="block"><span className={lblCls}>Chofer por default</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {CHOFERES.map((c) => <button key={c} onClick={() => setDefaultChofer(c)} className={`flex-1 py-2 text-sm font-medium transition ${defaultChofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{c}{c === "José" && <span className="opacity-60 text-xs"> (ppal)</span>}</button>)}
                </div></label>
            </div>
            {dias.length > 0 && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <span className={lblCls}>Días programados</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {dias.map((d) => {
                    const n = paradas.filter((p) => p.fecha === d).length;
                    const on = d === fecha;
                    return <button key={d} onClick={() => setFecha(d)} className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-stone-300 hover:bg-stone-50"}`}>{fechaLarga(d)} · {n}</button>;
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">{editandoId ? <Pencil size={16} className="text-sky-500" /> : <Plus size={16} className="text-amber-500" />}<h2 className="font-semibold text-sm">{editandoId ? "Editar parada" : "Agregar parada"}</h2></div>
              {editandoId && <button onClick={cancelarEdicion} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><X size={13} /> Cancelar</button>}
            </div>
            <div className="space-y-3">
              <div><span className={lblCls}>Tipo</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {TIPOS.map((t) => { const on = form.tipo === t; const col = t === "Entrega" ? "bg-emerald-600" : t === "Retiro" ? "bg-amber-500" : "bg-violet-600"; return <button key={t} onClick={() => setForm((f) => ({ ...f, tipo: t }))} className={`flex-1 py-2 text-xs font-medium leading-tight transition ${on ? col + " text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{t}</button>; })}
                </div></div>
              <div><span className={lblCls}>Chofer</span>
                <div className="mt-1 flex rounded-lg border border-stone-300 overflow-hidden">
                  {CHOFERES.map((c) => <button key={c} onClick={() => setForm((f) => ({ ...f, chofer: c }))} className={`flex-1 py-2 text-sm font-medium transition ${form.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-stone-50"}`}>{c}</button>)}
                </div></div>

              <div><span className={lblCls}>Nombre (cliente / proveedor)</span>
                <input list="lista-nombres" value={form.nombre} onChange={(e) => autocompletar(e.target.value)} placeholder="Reconstructora Union SA…" className={inputCls} />
                <datalist id="lista-nombres">{sugerencias.map((n, i) => <option key={i} value={n} />)}</datalist>
                {reconocido && <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><Check size={12} /> Reconocido — completé lo guardado</span>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><span className={lblCls}>Dirección (entrega)</span><input value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} className={inputCls} /></div>
                <div><span className={lblCls}>Barrio</span><input value={form.barrio} onChange={(e) => setForm((f) => ({ ...f, barrio: e.target.value }))} className={inputCls} /></div>
              </div>

              <div><span className={lblCls}>{form.tipo === "Entrega y retiro" ? "Qué lleva" : "Productos / carga"}</span><input value={form.carga} onChange={(e) => setForm((f) => ({ ...f, carga: e.target.value }))} placeholder={form.tipo === "Entrega y retiro" ? "pago, muestra, pedido…" : ""} className={inputCls} /></div>
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

              <button onClick={() => agregar(false)} disabled={!form.nombre.trim()} className={`w-full ${editandoId ? "bg-sky-500 hover:bg-sky-600 text-white" : "bg-amber-400 hover:bg-amber-500 text-slate-900"} disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2`}>{editandoId ? <><Save size={18} strokeWidth={2.5} /> Guardar cambios</> : <><Plus size={18} strokeWidth={2.5} /> Agregar al {fechaLarga(fecha)}</>}</button>

              {!editandoId && (
                <button onClick={() => agregar(true)} disabled={!form.nombre.trim()} className="w-full border border-dashed border-stone-400 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"><Inbox size={15} /> Dejar pendiente (asignar día y chofer después)</button>
              )}

              {form.nombre.trim() && (
                <button onClick={actualizarLibreta} className="w-full border border-stone-300 hover:bg-stone-50 text-slate-600 text-sm font-medium py-2 rounded-lg transition flex items-center justify-center gap-2">
                  {libretaMsg ? <><Check size={15} className="text-emerald-600" /> Guardado en libreta</> : <><BookOpen size={15} /> Actualizar libreta (dirección · barrio · flete · horario)</>}
                </button>
              )}
            </div>
          </div>

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
                        <button onClick={() => editarParada(p)} className="text-slate-300 hover:text-sky-600"><Pencil size={14} /></button>
                        <button onClick={() => borrar(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                      {p.carga && <div className="text-xs text-slate-500 truncate mb-2">{p.carga}</div>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={d.fecha} onChange={(e) => setDraft(p.id, { fecha: e.target.value })} className="rounded-md border border-stone-300 px-2 py-1 text-xs" />
                        <div className="flex rounded-md border border-stone-300 overflow-hidden">
                          {CHOFERES.map((c) => <button key={c} onClick={() => setDraft(p.id, { chofer: c })} className={`px-2.5 py-1 text-xs font-medium ${d.chofer === c ? "bg-slate-800 text-white" : "bg-white text-slate-500"}`}>{c}</button>)}
                        </div>
                        <button onClick={() => asignar(p.id)} disabled={!d.fecha || !d.chofer} className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1"><Check size={13} /> Asignar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {paradasDia.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-sm">Paradas del {fechaLarga(fecha)} ({paradasDia.length})</h2><button onClick={limpiarDia} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><RotateCcw size={13} /> Vaciar este día</button></div>
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
                        </div>
                        {p.carga && <div className="text-xs text-slate-500 truncate">{p.carga}</div>}
                      </div>
                      <select value={p.chofer} onChange={(e) => cambiarChofer(p.id, e.target.value)} className="text-xs border border-stone-200 rounded px-1.5 py-1 bg-stone-50 text-slate-600">{CHOFERES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                      <button onClick={() => editarParada(p)} className="text-slate-300 hover:text-sky-600"><Pencil size={15} /></button>
                      <button onClick={() => borrar(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {CHOFERES.map((chofer) => {
            const txt = textoChofer(chofer, fecha, paradasDia);
            const cant = paradasDia.filter((p) => p.chofer === chofer).length;
            return (
              <div key={chofer} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
                  <span className="font-semibold text-sm">{chofer} <span className="opacity-50 font-normal">· {cant} parada{cant === 1 ? "" : "s"}</span></span>
                  <button onClick={() => copiar(chofer)} disabled={!txt} className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition">{copiado === chofer ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}</button>
                </div>
                <div className="p-3" style={{ background: "#e5ddd5" }}>
                  {txt ? (
                    <div className="rounded-lg rounded-tl-none px-3 py-2 text-[13px] leading-relaxed shadow-sm max-w-[340px]" style={{ background: "#dcf8c6", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {txt.split("\n").map((l, i) => <div key={i}>{conNegritas(l, i)}</div>)}
                    </div>
                  ) : <div className="text-center text-slate-400 text-sm py-8">Sin paradas para {chofer}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
