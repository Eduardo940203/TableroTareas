/* TABLERO DE TAREAS - app estática sin backend.
   La carpeta del proyecto es la fuente de verdad (File System Access API, Chrome/Edge).
   data/config.json | data/proyectos/<id>.json | data/tareas/<id>.json | data/conexiones.json
   data/notas-generales.json | data/historial.json | recursos/<id>/ (adjuntos) */
'use strict';
const DIR_DATA = 'data', DIR_PROY = 'data/proyectos', DIR_TAR = 'data/tareas', DIR_REC = 'recursos';
const MAX_MB = 100, MAX_HIST = 2000;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => (v == null ? '' : String(v)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const isoD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return isoD(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const HOY = () => isoD(new Date());
const fmtF = s => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return d + '/' + m + '/' + y; };
const fmtTs = s => { if (!s) return ''; const d = new Date(s); return fmtF(isoD(d)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtBytes = b => !b ? '0 KB' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
function toast(msg, tipo = '') {
  const el = document.createElement('div'); el.className = 'toast ' + tipo; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4500);
}
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function slug(t) { return (t || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function nombreSeguro(n) {
  const i = n.lastIndexOf('.'), base = i > 0 ? n.slice(0, i) : n, ext = i > 0 ? n.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const b = slug(base).slice(0, 80) || 'archivo'; return ext ? b + '.' + ext : b;
}

/* ---------- IndexedDB (solo caché ligera y handle de carpeta) ---------- */
let _db = null;
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('tableroTareasDB', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('meta', { keyPath: 'key' });
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => { const q = db.transaction('meta').objectStore('meta').get(key); q.onsuccess = () => res(q.result ? q.result.value : null); q.onerror = () => rej(q.error); });
}
async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((res, rej) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ key, value }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function idbClear() {
  const db = await openDB();
  return new Promise((res, rej) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}

/* ---------- Capa de carpeta ---------- */
const FS = {
  handle: null, granted: false,
  get supported() { return typeof window.showDirectoryPicker === 'function'; },
  get ready() { return !!this.handle && this.granted; },
  get nombre() { return this.handle ? this.handle.name : ''; },
  async loadHandle() {
    this.handle = await idbGet('dirHandle'); this.granted = false;
    if (this.handle && this.handle.queryPermission) {
      try { this.granted = (await this.handle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.granted = false; }
    }
  },
  async pick() {
    const h = await window.showDirectoryPicker({ id: 'tablero-tareas', mode: 'readwrite' });
    this.handle = h; this.granted = true; await idbPut('dirHandle', h);
  },
  async ensure(forzar = false) {
    if (!this.supported) throw new Error('Este navegador no permite escribir en carpetas locales. Usa Chrome o Edge.');
    if (!forzar && this.ready) return;
    if (!forzar && this.handle) {
      const p = await this.handle.requestPermission({ mode: 'readwrite' });
      if (p === 'granted') { this.granted = true; return; }
    }
    await this.pick();
  },
  split: p => p.split('/').filter(Boolean),
  async dir(parts, create) { let d = this.handle; for (const p of parts) d = await d.getDirectoryHandle(p, { create }); return d; },
  async writeFile(path, data) {
    const parts = this.split(path), name = parts.pop(), d = await this.dir(parts, true);
    const fh = await d.getFileHandle(name, { create: true }), w = await fh.createWritable();
    await w.write(data); await w.close();
  },
  async writeJson(path, obj) { await this.writeFile(path, JSON.stringify(obj, null, 2)); },
  async readFile(path) {
    const parts = this.split(path), name = parts.pop(), d = await this.dir(parts, false);
    return (await d.getFileHandle(name)).getFile();
  },
  async readJson(path) { return JSON.parse(await (await this.readFile(path)).text()); },
  async exists(path) { try { await this.readFile(path); return true; } catch (e) { return false; } },
  async remove(path) {
    const parts = this.split(path), name = parts.pop();
    try { const d = await this.dir(parts, false); await d.removeEntry(name, { recursive: true }); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
  },
  async listFiles(path) {
    let d; try { d = await this.dir(this.split(path), false); } catch (e) { return []; }
    const out = []; for await (const [n, h] of d.entries()) if (h.kind === 'file') out.push(n);
    return out.sort();
  },
  async uniqueName(dirPath, name, reservados) {
    const ex = new Set([...(await this.listFiles(dirPath)), ...reservados]);
    if (!ex.has(name)) return name;
    const i = name.lastIndexOf('.'), base = i > 0 ? name.slice(0, i) : name, ext = i > 0 ? name.slice(i) : '';
    let n = 2; while (ex.has(base + '-' + n + ext)) n++; return base + '-' + n + ext;
  }
};

/* ---------- Store ---------- */
const CONFIG_BASE = {
  nombrePortal: 'Tablero de Tareas', logoTexto: 'TT', colorPrimario: '#2563eb', tema: 'claro', responsable: '',
  columnas: [
    { id: 'activo', nombre: 'Activo', color: '#64748b', terminal: false },
    { id: 'proceso', nombre: 'En proceso', color: '#d97706', terminal: false },
    { id: 'terminado', nombre: 'Terminado', color: '#16a34a', terminal: true }
  ],
  prioridades: ['baja', 'media', 'alta', 'critica']
};
const ESTADOS_PROY = ['planeado', 'en curso', 'pausado', 'cerrado'];
const PALETA = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#d97706', '#16a34a', '#0891b2', '#475569'];

const Store = {
  config: clone(CONFIG_BASE), proyectos: [], tareas: [], notasGen: [], historial: [], conexiones: null, fuente: 'vacio',
  async init() {
    try { await FS.loadHandle(); } catch (e) { console.warn(e); }
    const c = await idbGet('cache');
    if (c) { this.load(c); this.fuente = 'cache'; }
    if (!this.conexiones) this.conexiones = normConexiones(null);
  },
  load(c) {
    this.config = Object.assign(clone(CONFIG_BASE), c.config || {});
    this.proyectos = (c.proyectos || []).map(normProy);
    this.tareas = (c.tareas || []).map(normTarea);
    this.notasGen = c.notasGen || []; this.historial = c.historial || []; this.conexiones = normConexiones(c.conexiones);
  },
  async cache() { if (this._lote) return; await idbPut('cache', { conexiones: this.conexiones, config: this.config, proyectos: this.proyectos, tareas: this.tareas, notasGen: this.notasGen, historial: this.historial }); },
  async syncFromFolder() {
    if (!(await FS.exists(DIR_DATA + '/config.json'))) return false;
    const cfg = await FS.readJson(DIR_DATA + '/config.json');
    const proyectos = [], tareas = [];
    for (const f of (await FS.listFiles(DIR_PROY)).filter(n => n.endsWith('.json'))) { try { proyectos.push(await FS.readJson(DIR_PROY + '/' + f)); } catch (e) { console.warn(f, e); } }
    for (const f of (await FS.listFiles(DIR_TAR)).filter(n => n.endsWith('.json'))) { try { tareas.push(await FS.readJson(DIR_TAR + '/' + f)); } catch (e) { console.warn(f, e); } }
    let notasGen = [], historial = [], conexiones = null;
    try { notasGen = await FS.readJson(DIR_DATA + '/notas-generales.json'); } catch (e) { }
    try { historial = await FS.readJson(DIR_DATA + '/historial.json'); } catch (e) { }
    try { conexiones = await FS.readJson(DIR_DATA + '/conexiones.json'); } catch (e) { }
    this.load({ config: cfg, proyectos, tareas, notasGen, historial, conexiones });
    this.fuente = 'carpeta'; await this.cache(); return true;
  },
  async connect(forzar = false) {
    await FS.ensure(forzar);
    if (await FS.exists(DIR_DATA + '/config.json')) { await this.syncFromFolder(); return { inicializada: false }; }
    await FS.writeJson(DIR_DATA + '/config.json', this.config);
    await FS.writeJson(DIR_DATA + '/notas-generales.json', this.notasGen);
    await FS.writeJson(DIR_DATA + '/historial.json', this.historial);
    await FS.writeJson(DIR_DATA + '/conexiones.json', this.conexiones);
    for (const p of this.proyectos) await FS.writeJson(DIR_PROY + '/' + p.id + '.json', p);
    for (const t of this.tareas) await FS.writeJson(DIR_TAR + '/' + t.id + '.json', t);
    this.fuente = 'carpeta'; return { inicializada: true };
  },
  async require() { if (!FS.ready) await this.connect(); },
  async batch(fn) { this._lote = true; try { await fn(); } finally { this._lote = false; await FS.writeJson(DIR_DATA + '/historial.json', this.historial); await this.cache(); } },

  col(id) { return this.config.columnas.find(c => c.id === id); },
  esTerminal(id) { const c = this.col(id); return !!(c && c.terminal); },
  proy(id) { return this.proyectos.find(p => p.id === id); },
  tarea(id) { return this.tareas.find(t => t.id === id); },

  async log(tipo, texto, extra = {}) {
    this.historial.unshift({ id: uid('e'), fecha: new Date().toISOString(), tipo, texto, ...extra });
    if (this.historial.length > MAX_HIST) this.historial.length = MAX_HIST;
    if (!this._lote) await FS.writeJson(DIR_DATA + '/historial.json', this.historial);
  },
  async saveConfig(cfg) {
    await this.require(); this.config = Object.assign(this.config, cfg);
    await FS.writeJson(DIR_DATA + '/config.json', this.config); await this.cache();
  },
  async materializar(dirPath, lista) {
    const out = [], res = new Set();
    for (const it of lista) {
      if (!it.file) { out.push(it); continue; }
      const archivo = await FS.uniqueName(dirPath, nombreSeguro(it.nombre), res); res.add(archivo);
      await FS.writeFile(dirPath + '/' + archivo, it.file);
      out.push({ nombre: it.nombre, archivo, ruta: dirPath + '/' + archivo, size: it.file.size, tipo: it.file.type });
    }
    return out;
  },
  async saveTarea(t, eliminadas = []) {
    await this.require();
    const prev = this.tarea(t.id);
    t.adjuntos = await this.materializar(DIR_REC + '/' + t.id, t.adjuntos || []);
    t.modificada = new Date().toISOString();
    const term = this.esTerminal(t.estado);
    if (term && !t.completada) t.completada = HOY();
    if (!term) t.completada = null;
    await FS.writeJson(DIR_TAR + '/' + t.id + '.json', t);
    for (const r of eliminadas) await FS.remove(r);
    const i = this.tareas.findIndex(x => x.id === t.id);
    if (i >= 0) this.tareas[i] = t; else this.tareas.push(t);
    const ex = { tareaId: t.id, proyectoId: t.proyectoId || '' };
    if (!prev) await this.log('tarea_creada', 'Tarea creada: ' + t.titulo, ex);
    else {
      if (prev.estado !== t.estado) await this.log('tarea_movida', t.titulo + ': ' + (this.col(prev.estado)?.nombre || prev.estado) + ' → ' + (this.col(t.estado)?.nombre || t.estado), ex);
      const campos = ['titulo', 'descripcion', 'proyectoId', 'prioridad', 'responsable', 'inicio', 'vence'].filter(k => (prev[k] || '') !== (t[k] || ''));
      if (JSON.stringify(prev.etiquetas) !== JSON.stringify(t.etiquetas)) campos.push('etiquetas');
      if (JSON.stringify(prev.checklist) !== JSON.stringify(t.checklist)) campos.push('checklist');
      if ((prev.adjuntos || []).length !== t.adjuntos.length) campos.push('adjuntos');
      if (campos.length) await this.log('tarea_editada', 'Editada: ' + t.titulo + ' (' + campos.join(', ') + ')', ex);
    }
    await this.cache(); return t;
  },
  async reordenar(colId, ids) {
    await this.require();
    for (let i = 0; i < ids.length; i++) {
      const t = this.tarea(ids[i]); if (!t) continue;
      if (t.estado === colId && t.orden === i) continue;
      const cambio = t.estado !== colId, ant = t.estado;
      t.estado = colId; t.orden = i; t.modificada = new Date().toISOString();
      const term = this.esTerminal(colId);
      if (term && !t.completada) t.completada = HOY();
      if (!term) t.completada = null;
      await FS.writeJson(DIR_TAR + '/' + t.id + '.json', t);
      if (cambio) await this.log('tarea_movida', t.titulo + ': ' + (this.col(ant)?.nombre || ant) + ' → ' + this.col(colId).nombre, { tareaId: t.id, proyectoId: t.proyectoId || '' });
    }
    await this.cache();
  },
  async archivar(ids, archivar = true) {
    await this.require();
    for (const id of ids) {
      const t = this.tarea(id); if (!t) continue;
      t.archivada = archivar; t.fechaArchivo = archivar ? HOY() : null; t.modificada = new Date().toISOString();
      await FS.writeJson(DIR_TAR + '/' + t.id + '.json', t);
      await this.log(archivar ? 'tarea_archivada' : 'tarea_restaurada', (archivar ? 'Archivada: ' : 'Restaurada: ') + t.titulo, { tareaId: t.id, proyectoId: t.proyectoId || '' });
    }
    await this.cache();
  },
  async deleteTarea(id) {
    await this.require(); const t = this.tarea(id); if (!t) return;
    await FS.remove(DIR_TAR + '/' + id + '.json'); await FS.remove(DIR_REC + '/' + id);
    this.tareas = this.tareas.filter(x => x.id !== id);
    await this.log('tarea_eliminada', 'Eliminada: ' + t.titulo, { proyectoId: t.proyectoId || '' }); await this.cache();
  },
  async saveProyecto(p, eliminadas = []) {
    await this.require(); const prev = this.proy(p.id);
    p.adjuntos = await this.materializar(DIR_REC + '/' + p.id, p.adjuntos || []);
    p.modificado = new Date().toISOString();
    await FS.writeJson(DIR_PROY + '/' + p.id + '.json', p);
    for (const r of eliminadas) await FS.remove(r);
    const i = this.proyectos.findIndex(x => x.id === p.id);
    if (i >= 0) this.proyectos[i] = p; else this.proyectos.push(p);
    if (!prev) await this.log('proyecto_creado', 'Proyecto creado: ' + p.nombre, { proyectoId: p.id });
    else if (prev.estado !== p.estado) await this.log('proyecto_estado', p.nombre + ': ' + prev.estado + ' → ' + p.estado, { proyectoId: p.id });
    await this.cache(); return p;
  },
  async deleteProyecto(id) {
    await this.require(); const p = this.proy(id); if (!p) return;
    for (const t of this.tareas.filter(t => t.proyectoId === id)) { await FS.remove(DIR_TAR + '/' + t.id + '.json'); await FS.remove(DIR_REC + '/' + t.id); }
    this.tareas = this.tareas.filter(t => t.proyectoId !== id);
    await FS.remove(DIR_PROY + '/' + id + '.json'); await FS.remove(DIR_REC + '/' + id);
    this.proyectos = this.proyectos.filter(x => x.id !== id);
    await this.log('proyecto_eliminado', 'Proyecto eliminado: ' + p.nombre); await this.cache();
  },
  async saveNotasGen() { await this.require(); await FS.writeJson(DIR_DATA + '/notas-generales.json', this.notasGen); await this.cache(); },
  async exportAll() { return JSON.stringify({ config: this.config, proyectos: this.proyectos, tareas: this.tareas, notasGen: this.notasGen, historial: this.historial, conexiones: this.conexiones }, null, 2); },
  async importAll(txt) {
    const o = JSON.parse(txt); if (!o.tareas && !o.proyectos) throw new Error('El archivo no tiene proyectos ni tareas.');
    await this.require();
    if (o.config) { this.config = Object.assign(this.config, o.config); await FS.writeJson(DIR_DATA + '/config.json', this.config); }
    for (const p of (o.proyectos || [])) { const n = normProy(p); await FS.writeJson(DIR_PROY + '/' + n.id + '.json', n); const i = this.proyectos.findIndex(x => x.id === n.id); if (i >= 0) this.proyectos[i] = n; else this.proyectos.push(n); }
    for (const t of (o.tareas || [])) { const n = normTarea(t); await FS.writeJson(DIR_TAR + '/' + n.id + '.json', n); const i = this.tareas.findIndex(x => x.id === n.id); if (i >= 0) this.tareas[i] = n; else this.tareas.push(n); }
    if (o.notasGen) { this.notasGen = o.notasGen; await FS.writeJson(DIR_DATA + '/notas-generales.json', this.notasGen); }
    if (o.conexiones) { this.conexiones = normConexiones(o.conexiones); await FS.writeJson(DIR_DATA + '/conexiones.json', this.conexiones); }
    await this.log('importacion', 'Datos importados desde JSON'); await this.cache();
  }
};
function normProy(p) {
  return Object.assign({ id: uid('p'), nombre: '', descripcion: '', estado: 'en curso', responsable: '', inicio: '', fin: '', color: PALETA[0], hitos: [], notas: [], adjuntos: [] }, p);
}
function normTarea(t) {
  return Object.assign({ id: uid('t'), titulo: '', descripcion: '', proyectoId: '', estado: 'activo', prioridad: 'media', responsable: '', inicio: '', vence: '', etiquetas: [], checklist: [], adjuntos: [], orden: 9999, creada: new Date().toISOString(), completada: null, archivada: false }, t);
}

/* ---------- UI base ---------- */
const app = () => $('#app');
let M = null; // estado del modal abierto
function openModal(html, wide) {
  const old = $('#modalOv'); if (old) old.remove();
  const ov = document.createElement('div'); ov.className = 'modal-ov'; ov.id = 'modalOv';
  ov.innerHTML = '<div class="modal-box' + (wide ? ' wide' : '') + '">' + html + '</div>';
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov); return ov.firstElementChild;
}
function closeModal() { const o = $('#modalOv'); if (o) o.remove(); M = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function aplicarTema() {
  let t = localStorage.getItem('tt-tema') || Store.config.tema || 'claro';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  document.documentElement.dataset.theme = t;
  $('#btnTema').textContent = t === 'oscuro' ? '☀️' : '🌙';
  document.documentElement.style.setProperty('--primary', Store.config.colorPrimario || '#2563eb');
  $('#brandName').textContent = Store.config.nombrePortal; $('#brandLogo').textContent = Store.config.logoTexto;
  document.title = Store.config.nombrePortal;
}
function pintarCarpeta() {
  const st = $('#folderStatus'), bn = $('#folderBanner');
  if (FS.ready) { st.className = 'folder-status ok'; st.textContent = '● Carpeta: ' + FS.nombre; bn.innerHTML = ''; return; }
  st.className = 'folder-status'; st.textContent = FS.supported ? '○ Sin carpeta conectada' : '○ Solo lectura';
  const msg = !FS.supported ? 'Este navegador no puede escribir en carpetas. Usa Chrome o Edge para editar.'
    : FS.handle ? 'Reconecta la carpeta <b>' + esc(FS.nombre) + '</b> para ver y editar los datos actuales (se muestra la última caché).'
    : 'Conecta la carpeta del proyecto (la que contiene <code>index.html</code>) para guardar tareas, notas y adjuntos en disco.';
  bn.innerHTML = '<div class="banner"><span>📂 ' + msg + '</span>' + (FS.supported ? '<button class="btn primary" data-act="conectar">' + (FS.handle ? 'Reconectar' : 'Conectar carpeta') + '</button>' : '') + '</div>';
}
function pintarSidebar() {
  $('#sideProyectos').innerHTML = Store.proyectos.filter(p => p.estado !== 'cerrado').sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => '<a href="#proyecto?id=' + p.id + '" data-route="proyecto?id=' + p.id + '"><span class="dot" style="background:' + esc(p.color) + '"></span>' + esc(p.nombre) + '</a>').join('') || '<div class="muted small" style="padding:4px 10px">Sin proyectos</div>';
  marcarActivo();
}
function marcarActivo() {
  const h = location.hash.slice(1) || 'inicio';
  $$('.sidebar a').forEach(a => { const r = a.dataset.route; a.classList.toggle('active', r === h || (!r.includes('?') && r === h.split('?')[0])); });
}

/* ---------- Router ---------- */
const RUTAS = { inicio: vInicio, tablero: vTablero, proyectos: vProyectos, proyecto: vProyecto, gantt: vGantt, archivo: vArchivo, historial: vHistorial, config: vConfig };
function parseHash() { const raw = location.hash.slice(1) || 'inicio'; const [p, q] = raw.split('?'); return [p, new URLSearchParams(q || '')]; }
async function router() {
  const [p, params] = parseHash(); marcarActivo();
  try { await (RUTAS[p] || vInicio)(params); } catch (e) { console.error(e); app().innerHTML = '<div class="empty">Error al mostrar la vista: ' + esc(e.message) + '</div>'; }
}
window.addEventListener('hashchange', () => { closeModal(); router(); });
function refrescar() { pintarSidebar(); pintarCarpeta(); router(); }

/* ---------- Utilidades de datos ---------- */
function avance(pid) {
  const ts = Store.tareas.filter(t => t.proyectoId === pid);
  if (!ts.length) return { total: 0, hechas: 0, pct: 0 };
  const h = ts.filter(t => Store.esTerminal(t.estado)).length; return { total: ts.length, hechas: h, pct: Math.round(100 * h / ts.length) };
}
const chipProy = id => { const p = Store.proy(id); return p ? '<span class="chip" style="background:' + esc(p.color) + '">' + esc(p.nombre) + '</span>' : '<span class="chip out">Sin proyecto</span>'; };
const chipPrio = pr => '<span class="chip prio-' + esc(pr) + '">' + esc(pr) + '</span>';
function vencInfo(t) {
  if (!t.vence) return '';
  const late = !Store.esTerminal(t.estado) && t.vence < HOY();
  return '<span class="' + (late ? 'late' : '') + '">📅 ' + fmtF(t.vence) + (late ? ' (vencida)' : '') + '</span>';
}
function opcionesProy(sel, vacio) {
  return '<option value="">' + vacio + '</option>' + Store.proyectos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + '</option>').join('');
}
function todasLasNotas() {
  return [...Store.notasGen.map(n => ({ ...n, proyectoId: '' })), ...Store.proyectos.flatMap(p => (p.notas || []).map(n => ({ ...n, proyectoId: p.id })))].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function notaHtml(n) {
  return '<div class="list-item"><div style="flex:1"><div class="small muted">' + chipProy(n.proyectoId) + ' ' + fmtTs(n.fecha) + (n.tareaId ? ' · ✅ ya es tarea' : '') + '</div><div class="nota">' + esc(n.texto) + '</div></div><div style="display:flex;gap:4px;flex:none">' +
    (n.tareaId ? '' : '<button class="btn sm" data-act="nota-tarea" data-id="' + n.id + '" data-proy="' + n.proyectoId + '" title="Convertir en tarea">→ Tarea</button>') +
    '<button class="btn sm danger" data-act="nota-del" data-id="' + n.id + '" data-proy="' + n.proyectoId + '">✕</button></div></div>';
}
function notaForm(proyFijo) {
  return '<div class="nota-form" data-proy="' + (proyFijo || '') + '"><textarea rows="3" placeholder="Escribe una nota…"></textarea><div class="filters" style="margin-top:6px">' +
    (proyFijo === undefined ? '<select class="nota-sel">' + opcionesProy('', 'General (sin proyecto)') + '</select>' : '') +
    '<button class="btn primary" data-act="nota-guardar">Guardar nota</button></div></div>';
}

/* ---------- Inicio ---------- */
function vInicio() {
  const act = Store.tareas.filter(t => !t.archivada);
  const hoy = HOY(), en7 = addDays(hoy, 7);
  const prox = act.filter(t => !Store.esTerminal(t.estado) && t.vence && t.vence <= en7).sort((a, b) => a.vence.localeCompare(b.vence)).slice(0, 8);
  const vencidas = act.filter(t => !Store.esTerminal(t.estado) && t.vence && t.vence < hoy).length;
  const hitos = Store.proyectos.filter(p => p.estado !== 'cerrado').flatMap(p => (p.hitos || []).filter(h => !h.hecho).map(h => ({ ...h, p }))).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
  const stats = Store.config.columnas.map(c => '<div class="card stat" style="border-top:4px solid ' + esc(c.color) + '"><div class="muted small">' + esc(c.nombre) + '</div><div class="n">' + act.filter(t => t.estado === c.id).length + '</div></div>').join('');
  app().innerHTML = '<div class="page-head"><h3>Inicio</h3><div class="filters"><button class="btn primary" data-act="tarea-nueva">＋ Nueva tarea</button><button class="btn" data-act="proy-nuevo">＋ Nuevo proyecto</button></div></div>' +
    '<div class="grid g4" style="margin-bottom:14px">' + stats + '<div class="card stat" style="border-top:4px solid var(--danger)"><div class="muted small">Vencidas</div><div class="n">' + vencidas + '</div></div></div>' +
    '<div class="grid g2"><div class="card"><h4 style="margin-top:0">📝 Notas rápidas</h4>' + notaForm() + '<div id="listaNotas" style="margin-top:10px">' +
    (todasLasNotas().slice(0, 10).map(notaHtml).join('') || '<div class="empty">Sin notas todavía</div>') + '</div></div>' +
    '<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><h4 style="margin-top:0">⏰ Vencen pronto (7 días)</h4>' +
    (prox.map(t => '<div class="list-item"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '">' + esc(t.titulo) + '</a><span class="small">' + chipProy(t.proyectoId) + ' ' + vencInfo(t) + '</span></div>').join('') || '<div class="empty">Nada por vencer</div>') + '</div>' +
    '<div class="card"><h4 style="margin-top:0">🚩 Próximos hitos</h4>' + (hitos.map(h => '<div class="list-item"><span>◆ ' + esc(h.nombre) + '</span><span class="small">' + chipProy(h.p.id) + ' ' + fmtF(h.fecha) + '</span></div>').join('') || '<div class="empty">Sin hitos pendientes</div>') + '</div>' +
    '<div class="card"><h4 style="margin-top:0">📁 Avance de proyectos</h4>' + (Store.proyectos.filter(p => p.estado !== 'cerrado').map(p => { const a = avance(p.id); return '<div style="margin-bottom:10px"><div class="list-item" style="border:0;padding:0 0 4px"><a href="#proyecto?id=' + p.id + '">' + esc(p.nombre) + '</a><span class="small muted">' + a.hechas + '/' + a.total + ' · ' + a.pct + '%</span></div><div class="bar"><span style="width:' + a.pct + '%"></span></div></div>'; }).join('') || '<div class="empty">Sin proyectos</div>') + '</div></div></div>';
}

/* ---------- Tablero ---------- */
const FILTROS = { proyecto: '', prioridad: '', q: '' };
function vTablero(params) {
  if (params.has('proyecto')) FILTROS.proyecto = params.get('proyecto');
  app().innerHTML = '<div class="page-head"><h3>Tablero</h3><div class="filters"><select data-filtro="proyecto">' + opcionesProy(FILTROS.proyecto, 'Todos los proyectos') + '</select>' +
    '<select data-filtro="prioridad"><option value="">Toda prioridad</option>' + Store.config.prioridades.map(p => '<option' + (p === FILTROS.prioridad ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select>' +
    '<input data-filtro="q" placeholder="Buscar…" value="' + esc(FILTROS.q) + '"><button class="btn" data-act="archivar-terminadas">📦 Archivar terminadas</button><button class="btn primary" data-act="tarea-nueva">＋ Nueva tarea</button></div></div><div id="board" class="board"></div>';
  pintarColumnas();
}
function tareasFiltradas() {
  const q = FILTROS.q.toLowerCase();
  return Store.tareas.filter(t => !t.archivada && (!FILTROS.proyecto || t.proyectoId === FILTROS.proyecto) && (!FILTROS.prioridad || t.prioridad === FILTROS.prioridad) &&
    (!q || [t.titulo, t.descripcion, t.responsable, (t.etiquetas || []).join(' ')].join(' ').toLowerCase().includes(q)));
}
function cardHtml(t) {
  const p = Store.proy(t.proyectoId), ck = t.checklist || [], hechos = ck.filter(c => c.hecho).length;
  return '<div class="card-t" draggable="true" data-id="' + t.id + '" style="--pc:' + (p ? esc(p.color) : '#94a3b8') + '"><div class="tt"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '" style="color:inherit">' + esc(t.titulo) + '</a></div><div class="meta">' +
    chipPrio(t.prioridad) + (p ? '<span class="chip" style="background:' + esc(p.color) + '">' + esc(p.nombre) + '</span>' : '') + vencInfo(t) + (ck.length ? '<span>☑ ' + hechos + '/' + ck.length + '</span>' : '') +
    ((t.adjuntos || []).length ? '<span>📎 ' + t.adjuntos.length + '</span>' : '') + (t.responsable ? '<span>👤 ' + esc(t.responsable) + '</span>' : '') +
    (Store.esTerminal(t.estado) ? '<button class="btn sm" data-act="archivar" data-id="' + t.id + '">📦</button>' : '') + '</div></div>';
}
function pintarColumnas() {
  const b = $('#board'); if (!b) return; const ts = tareasFiltradas();
  b.innerHTML = Store.config.columnas.map(c => {
    const l = ts.filter(t => t.estado === c.id).sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    return '<div class="col"><div class="col-head" style="--c:' + esc(c.color) + '"><span>' + esc(c.nombre) + ' <span class="muted">' + l.length + '</span></span></div><div class="col-body" data-col="' + c.id + '">' + l.map(cardHtml).join('') + '</div>' +
      '<div class="quick"><input data-quick="' + c.id + '" placeholder="＋ Agregar tarea y Enter"></div></div>';
  }).join('');
}
/* drag & drop */
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.card-t'); if (c) { c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.dataset.id); } });
document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('.card-t'); if (c) c.classList.remove('dragging'); $$('.col-body.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => {
  const body = e.target.closest && e.target.closest('.col-body'); const dr = $('.card-t.dragging'); if (!body || !dr) return;
  e.preventDefault(); $$('.col-body.over').forEach(x => x.classList.remove('over')); body.classList.add('over');
  const after = $$('.card-t:not(.dragging)', body).find(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  if (after) body.insertBefore(dr, after); else body.appendChild(dr);
});
document.addEventListener('drop', async e => {
  const body = e.target.closest && e.target.closest('.col-body'); if (!body) return; e.preventDefault();
  const ids = $$('.card-t', body).map(c => c.dataset.id);
  try { await Store.reordenar(body.dataset.col, ids); } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }
  pintarCarpeta(); pintarColumnas();
});

/* ---------- Proyectos ---------- */
function vProyectos() {
  const l = Store.proyectos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  app().innerHTML = '<div class="page-head"><h3>Proyectos</h3><button class="btn primary" data-act="proy-nuevo">＋ Nuevo proyecto</button></div>' +
    (l.length ? '<div class="grid g2">' + l.map(p => { const a = avance(p.id); const nh = (p.hitos || []).length; return '<div class="card" style="border-top:4px solid ' + esc(p.color) + '"><div class="list-item" style="border:0;padding-top:0"><a href="#proyecto?id=' + p.id + '"><b>' + esc(p.nombre) + '</b></a><span class="chip out">' + esc(p.estado) + '</span></div><div class="muted small" style="margin-bottom:8px">' + esc(p.descripcion || '').slice(0, 120) + '</div><div class="bar"><span style="width:' + a.pct + '%"></span></div><div class="small muted" style="margin-top:6px">' + a.hechas + '/' + a.total + ' tareas · ' + a.pct + '% · ' + nh + ' hitos' + (p.fin ? ' · fin ' + fmtF(p.fin) : '') + '</div></div>'; }).join('') + '</div>'
      : '<div class="empty">Aún no hay proyectos. Crea el primero.</div>');
}
function vProyecto(params) {
  const p = Store.proy(params.get('id')); if (!p) { app().innerHTML = '<div class="empty">Proyecto no encontrado.</div>'; return; }
  const a = avance(p.id), ts = Store.tareas.filter(t => t.proyectoId === p.id);
  const hitos = (p.hitos || []).slice().sort((x, y) => x.fecha.localeCompare(y.fecha));
  app().innerHTML = '<div class="page-head"><div><h3><span class="dot" style="background:' + esc(p.color) + '"></span>' + esc(p.nombre) + '</h3><div class="muted small">' + esc(p.estado) + (p.responsable ? ' · 👤 ' + esc(p.responsable) : '') + (p.inicio ? ' · ' + fmtF(p.inicio) : '') + (p.fin ? ' → ' + fmtF(p.fin) : '') + '</div></div>' +
    '<div class="filters"><a class="btn" href="#tablero?proyecto=' + p.id + '">🗂️ Tablero</a><a class="btn" href="#gantt?proyecto=' + p.id + '">📊 Gantt</a><button class="btn" data-act="proy-editar" data-id="' + p.id + '">✏️ Editar</button><button class="btn danger" data-act="proy-del" data-id="' + p.id + '">Eliminar</button></div></div>' +
    '<div class="card" style="margin-bottom:14px">' + (p.descripcion ? '<p class="nota" style="margin-top:0">' + esc(p.descripcion) + '</p>' : '') + '<div class="bar"><span style="width:' + a.pct + '%"></span></div><div class="small muted" style="margin-top:6px">' + a.hechas + ' de ' + a.total + ' tareas terminadas (' + a.pct + '%)</div></div>' +
    '<div class="grid g2"><div style="display:flex;flex-direction:column;gap:14px">' +
    '<div class="card"><div class="list-item" style="border:0;padding-top:0"><h4 style="margin:0">🚩 Hitos</h4></div>' +
    (hitos.map(h => '<div class="list-item"><label><input type="checkbox" data-hito="' + h.id + '" data-proy="' + p.id + '"' + (h.hecho ? ' checked' : '') + '> <span class="' + (h.hecho ? 'done-txt' : '') + '">' + esc(h.nombre) + '</span></label><span class="small">' + fmtF(h.fecha) + ' <button class="btn sm danger" data-act="hito-del" data-id="' + h.id + '" data-proy="' + p.id + '">✕</button></span></div>').join('') || '<div class="muted small">Sin hitos</div>') +
    '<div class="filters" style="margin-top:8px"><input id="hitoNombre" placeholder="Nuevo hito"><input id="hitoFecha" type="date"><button class="btn" data-act="hito-add" data-proy="' + p.id + '">Agregar</button></div></div>' +
    '<div class="card"><h4 style="margin-top:0">📝 Notas del proyecto</h4>' + notaForm(p.id) + '<div style="margin-top:10px">' + ((p.notas || []).slice().sort((x, y) => y.fecha.localeCompare(x.fecha)).map(n => notaHtml({ ...n, proyectoId: p.id })).join('') || '<div class="muted small">Sin notas</div>') + '</div></div>' +
    '<div class="card"><h4 style="margin-top:0">📎 Adjuntos del proyecto</h4>' + ((p.adjuntos || []).map((x, i) => '<div class="list-item"><span>' + esc(x.nombre) + ' <span class="muted small">' + fmtBytes(x.size) + '</span></span><button class="btn sm" data-act="ad-dl-proy" data-id="' + p.id + '" data-i="' + i + '">⬇</button></div>').join('') || '<div class="muted small">Sin adjuntos (agrégalos desde Editar)</div>') + '</div></div>' +
    '<div class="card"><div class="list-item" style="border:0;padding-top:0"><h4 style="margin:0">✅ Tareas (' + ts.length + ')</h4><button class="btn sm primary" data-act="tarea-nueva" data-proy="' + p.id + '">＋ Tarea</button></div>' +
    Store.config.columnas.map(c => { const l = ts.filter(t => t.estado === c.id); return l.length ? '<div class="side-title" style="margin-top:8px">' + esc(c.nombre) + ' (' + l.length + ')</div>' + l.map(t => '<div class="list-item"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '" class="' + (t.archivada ? 'done-txt' : '') + '">' + esc(t.titulo) + (t.archivada ? ' 📦' : '') + '</a><span class="small">' + chipPrio(t.prioridad) + ' ' + vencInfo(t) + '</span></div>').join('') : ''; }).join('') +
    (ts.length ? '' : '<div class="empty">Sin tareas</div>') + '</div></div>';
}

/* ---------- Gantt ---------- */
const GANTT = { proyecto: '', dw: 28 };
function vGantt(params) {
  if (params.has('proyecto')) GANTT.proyecto = params.get('proyecto');
  const W = GANTT.dw, hoy = HOY();
  const proys = Store.proyectos.filter(p => !GANTT.proyecto || p.id === GANTT.proyecto);
  const grupos = proys.map(p => ({ p, ts: Store.tareas.filter(t => t.proyectoId === p.id && !t.archivada) }));
  const sinProy = Store.tareas.filter(t => !t.proyectoId && !t.archivada);
  if (!GANTT.proyecto && sinProy.length) grupos.push({ p: null, ts: sinProy });
  const rango = t => { const s = t.inicio || t.vence, e = t.vence || t.inicio; if (!s) return null; return s <= e ? [s, e] : [e, s]; };
  const fechas = [hoy];
  grupos.forEach(g => { g.ts.forEach(t => { const r = rango(t); if (r) fechas.push(...r); }); if (g.p) { if (g.p.inicio) fechas.push(g.p.inicio); if (g.p.fin) fechas.push(g.p.fin); (g.p.hitos || []).forEach(h => fechas.push(h.fecha)); } });
  fechas.sort();
  const ini = addDays(fechas[0], -3), fin = addDays(fechas[fechas.length - 1], 10), dias = diffDays(ini, fin) + 1, ancho = dias * W;
  const off = d => diffDays(ini, d) * W;
  let meses = '', dlab = '';
  for (let i = 0; i < dias; i++) {
    const d = parseD(addDays(ini, i));
    if (i === 0 || d.getDate() === 1) meses += '<span style="left:' + (i * W) + 'px">' + d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) + '</span>';
    if (W >= 24) dlab += '<span style="left:' + (i * W + 3) + 'px">' + d.getDate() + '</span>';
    else if (W >= 10 && d.getDay() === 1) dlab += '<span style="left:' + (i * W) + 'px">' + d.getDate() + '</span>';
  }
  const track = inner => '<div class="g-track" style="width:' + ancho + 'px;background-size:' + W + 'px 100%">' + '<div class="g-today" style="left:' + (off(hoy) + W / 2) + 'px"></div>' + inner + '</div>';
  let filas = '', sinFecha = 0;
  grupos.forEach(g => {
    const p = g.p, color = p ? p.color : '#94a3b8';
    let pi = p && p.inicio, pf = p && p.fin;
    if (p && (!pi || !pf)) { const rs = g.ts.map(rango).filter(Boolean); if (rs.length) { pi = pi || rs.map(r => r[0]).sort()[0]; pf = pf || rs.map(r => r[1]).sort().pop(); } }
    let inner = '';
    if (pi && pf) { const a = avance(p.id); inner += '<div class="g-bar pbar" style="--bc:' + esc(color) + ';left:' + off(pi) + 'px;width:' + ((diffDays(pi, pf) + 1) * W) + 'px" title="' + esc(p.nombre) + ' ' + a.pct + '%"><div class="prog" style="width:' + a.pct + '%"></div></div>'; }
    if (p) (p.hitos || []).forEach(h => { const x = off(h.fecha) + W / 2 - 7; inner += '<div class="g-ms ' + (h.hecho ? 'hecho' : '') + '" style="left:' + x + 'px" title="' + esc(h.nombre) + ' ' + fmtF(h.fecha) + '"></div><div class="g-mslabel" style="left:' + (x + 18) + 'px">' + esc(h.nombre) + '</div>'; });
    filas += '<div class="g-row"><div class="g-label proj" title="' + esc(p ? p.nombre : 'Sin proyecto') + '"><span class="dot" style="background:' + esc(color) + '"></span>' + esc(p ? p.nombre : 'Sin proyecto') + '</div>' + track(inner) + '</div>';
    g.ts.slice().sort((a, b) => ((a.inicio || a.vence || 'z')).localeCompare(b.inicio || b.vence || 'z')).forEach(t => {
      const r = rango(t); let inner2 = '';
      if (r) { const done = Store.esTerminal(t.estado); inner2 = '<div class="g-bar ' + (done ? 'done' : '') + '" data-act="tarea-abrir" data-id="' + t.id + '" style="--bc:' + esc(color) + ';left:' + off(r[0]) + 'px;width:' + ((diffDays(r[0], r[1]) + 1) * W) + 'px" title="' + esc(t.titulo) + ' (' + fmtF(r[0]) + ' → ' + fmtF(r[1]) + ')">' + esc(t.titulo) + '</div>'; } else sinFecha++;
      filas += '<div class="g-row"><div class="g-label" title="' + esc(t.titulo) + '"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '" style="color:inherit">' + esc(t.titulo) + '</a>' + (r ? '' : ' <span class="muted small">(sin fechas)</span>') + '</div>' + track(inner2) + '</div>';
    });
  });
  app().innerHTML = '<div class="page-head"><h3>Gantt</h3><div class="filters"><select data-gantt="proyecto">' + opcionesProy(GANTT.proyecto, 'Todos los proyectos') + '</select>' +
    '<select data-gantt="dw"><option value="28"' + (W === 28 ? ' selected' : '') + '>Día</option><option value="12"' + (W === 12 ? ' selected' : '') + '>Semana</option><option value="4"' + (W === 4 ? ' selected' : '') + '>Mes</option></select></div></div>' +
    (grupos.length ? '<div class="gantt" id="ganttBox"><div class="g-head"><div class="g-row"><div class="g-label">Proyecto / Tarea</div><div style="width:' + ancho + 'px"><div class="g-months">' + meses + '</div><div class="g-days">' + dlab + '</div></div></div></div>' + filas + '</div>' +
      '<p class="muted small">Barras: tareas con fecha de inicio y/o vencimiento. Barra delgada: proyecto con su avance. ◆ hito (verde = cumplido). Línea roja = hoy.' + (sinFecha ? ' ' + sinFecha + ' tareas sin fechas no tienen barra.' : '') + '</p>'
      : '<div class="empty">No hay proyectos ni tareas para mostrar.</div>');
  const box = $('#ganttBox'); if (box) box.scrollLeft = Math.max(0, off(hoy) - 150);
}

/* ---------- Archivo e Historial ---------- */
let ARQ_Q = '';
function listaArchivo() {
  const q = ARQ_Q.toLowerCase();
  return Store.tareas.filter(t => t.archivada && (!q || t.titulo.toLowerCase().includes(q))).sort((a, b) => (b.fechaArchivo || '').localeCompare(a.fechaArchivo || ''))
    .map(t => '<tr><td>' + esc(t.titulo) + '</td><td>' + chipProy(t.proyectoId) + '</td><td>' + fmtF(t.completada) + '</td><td>' + fmtF(t.fechaArchivo) + '</td><td style="white-space:nowrap"><button class="btn sm" data-act="tarea-abrir" data-id="' + t.id + '">Ver</button> <button class="btn sm" data-act="restaurar" data-id="' + t.id + '">Restaurar</button> <button class="btn sm danger" data-act="tarea-del" data-id="' + t.id + '">Eliminar</button></td></tr>').join('') || '<tr><td colspan="5" class="empty">Sin tareas archivadas</td></tr>';
}
function vArchivo() {
  app().innerHTML = '<div class="page-head"><h3>Archivo</h3><input data-arq placeholder="Buscar…" value="' + esc(ARQ_Q) + '"></div><div class="card"><table><thead><tr><th>Tarea</th><th>Proyecto</th><th>Terminada</th><th>Archivada</th><th></th></tr></thead><tbody id="arqBody">' + listaArchivo() + '</tbody></table></div>';
}
let HIST_Q = '';
const ICONO = { tarea_creada: '🆕', tarea_movida: '➡️', tarea_editada: '✏️', tarea_archivada: '📦', tarea_restaurada: '♻️', tarea_eliminada: '🗑️', proyecto_creado: '📁', proyecto_estado: '🔄', proyecto_eliminado: '🗑️', hito: '🚩', nota: '📝', importacion: '⬆️' };
function listaHistorial() {
  const q = HIST_Q.toLowerCase();
  return Store.historial.filter(h => !q || h.texto.toLowerCase().includes(q)).slice(0, 300).map(h => '<div class="list-item"><span>' + (ICONO[h.tipo] || '•') + ' ' + esc(h.texto) + '</span><span class="small muted">' + fmtTs(h.fecha) + '</span></div>').join('') || '<div class="empty">Sin movimientos</div>';
}
function vHistorial() {
  app().innerHTML = '<div class="page-head"><h3>Historial</h3><input data-hq placeholder="Buscar…" value="' + esc(HIST_Q) + '"></div><div class="card" id="histBody">' + listaHistorial() + '</div><p class="muted small">Se muestran los últimos 300 de un máximo de ' + MAX_HIST + ' movimientos.</p>';
}

/* ---------- Configuración ---------- */
let COLS = [];
function vConfig() {
  const c = Store.config; COLS = clone(c.columnas);
  app().innerHTML = '<div class="page-head"><h3>Configuración</h3></div><div class="grid g2"><div class="card"><h4 style="margin-top:0">General</h4><form id="cfgForm" class="form-grid">' +
    '<div class="full"><label>Nombre del portal</label><input name="nombrePortal" value="' + esc(c.nombrePortal) + '"></div><div><label>Logo (texto)</label><input name="logoTexto" maxlength="3" value="' + esc(c.logoTexto) + '"></div><div><label>Color principal</label><input type="color" name="colorPrimario" value="' + esc(c.colorPrimario) + '"></div>' +
    '<div><label>Tema</label><select name="tema">' + ['claro', 'oscuro', 'auto'].map(x => '<option' + ((localStorage.getItem('tt-tema') || c.tema) === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div><div><label>Responsable predeterminado</label><input name="responsable" value="' + esc(c.responsable) + '"></div>' +
    '<div class="full"><button class="btn primary" type="submit">Guardar</button></div></form></div>' +
    '<div class="card"><h4 style="margin-top:0">Columnas del tablero</h4><div id="colsEd"></div><div class="filters" style="margin-top:8px"><button class="btn" data-act="col-add">＋ Columna</button><button class="btn primary" data-act="col-save">Guardar columnas</button></div><p class="muted small">Una columna "terminal" marca la tarea como completada (fecha de término y avance del proyecto).</p></div>' +
    '<div class="card"><h4 style="margin-top:0">Carpeta de datos</h4><p class="small">' + (FS.ready ? '✅ Conectada: <b>' + esc(FS.nombre) + '</b>' : 'Sin conexión') + '<br>Origen de datos mostrados: ' + esc(Store.fuente) + '</p><div class="filters"><button class="btn" data-act="conectar">Conectar / Reconectar</button><button class="btn" data-act="cambiar-carpeta">Cambiar carpeta</button><button class="btn" data-act="recargar">Recargar desde carpeta</button></div></div>' +
    intercambioHtml() +
    '<div class="card"><h4 style="margin-top:0">Respaldo</h4><div class="filters"><button class="btn" data-act="exportar">⬇ Exportar JSON</button><label class="btn">⬆ Importar JSON<input type="file" id="fileImport" accept=".json" hidden></label><button class="btn danger" data-act="limpiar-cache">Limpiar caché</button></div><p class="muted small">El JSON incluye textos, rutas y conexiones (con sus passwords en texto plano). Los adjuntos viven en <code>recursos/</code>. Para un respaldo completo copia toda la carpeta.</p></div></div>';
  pintarCols();
}
function pintarCols() {
  $('#colsEd').innerHTML = '<table><thead><tr><th>Nombre</th><th>Color</th><th>Terminal</th><th></th></tr></thead><tbody>' + COLS.map((c, i) => '<tr data-cid="' + c.id + '"><td><input class="c-n" value="' + esc(c.nombre) + '"></td><td><input class="c-c" type="color" value="' + esc(c.color) + '"></td><td><input class="c-t" type="checkbox"' + (c.terminal ? ' checked' : '') + '></td><td style="white-space:nowrap"><button class="btn sm" data-act="col-up" data-i="' + i + '">↑</button> <button class="btn sm" data-act="col-down" data-i="' + i + '">↓</button> <button class="btn sm danger" data-act="col-del" data-i="' + i + '">✕</button></td></tr>').join('') + '</tbody></table>';
}
function leerCols() { COLS = $$('#colsEd tbody tr').map(tr => ({ id: tr.dataset.cid, nombre: $('.c-n', tr).value.trim(), color: $('.c-c', tr).value, terminal: $('.c-t', tr).checked })); }

/* ---------- Modales ---------- */
const adjHtml = () => (M.obj.adjuntos || []).map((a, i) => '<div class="check-row"><span style="flex:1">📎 ' + esc(a.nombre) + ' <span class="muted small">' + fmtBytes(a.size) + (a.file ? ' · pendiente de guardar' : '') + '</span></span><button type="button" class="btn sm" data-act="ad-dl" data-i="' + i + '">⬇</button><button type="button" class="btn sm danger" data-act="ad-rm" data-i="' + i + '">✕</button></div>').join('') || '<div class="muted small">Sin adjuntos</div>';
const chkHtml = () => (M.obj.checklist || []).map((c, i) => '<div class="check-row"><input type="checkbox" data-ck="' + i + '"' + (c.hecho ? ' checked' : '') + '><input type="text" data-ct="' + i + '" value="' + esc(c.texto) + '"><button type="button" class="btn sm danger" data-act="ck-del" data-i="' + i + '">✕</button></div>').join('');
function syncForm() {
  $$('#mForm [name]').forEach(el => { let v = el.value; if (el.name === 'etiquetas') v = v.split(',').map(s => s.trim()).filter(Boolean); M.obj[el.name] = v; });
}
function abrirTarea(id, opts = {}) {
  const ex = id ? Store.tarea(id) : null;
  const t = ex ? clone(ex) : normTarea({ id: uid('t'), estado: opts.estado || Store.config.columnas[0].id, proyectoId: opts.proyectoId || '', responsable: Store.config.responsable || '', ...(opts.prefill || {}) });
  if (!ex) t.orden = Math.max(-1, ...Store.tareas.filter(x => x.estado === t.estado).map(x => x.orden ?? 0)) + 1;
  M = { tipo: 'tarea', obj: t, eliminadas: [], nuevo: !ex, fromNota: opts.fromNota || null };
  const hist = ex ? Store.historial.filter(h => h.tareaId === id).slice(0, 8) : [];
  const box = openModal('<h4>' + (ex ? 'Tarea' : 'Nueva tarea') + (t.archivada ? ' 📦 (archivada)' : '') + '</h4><form id="mForm" class="form-grid">' +
    '<div class="full"><label>Título *</label><input name="titulo" value="' + esc(t.titulo) + '"></div><div class="full"><label>Descripción</label><textarea name="descripcion" rows="3">' + esc(t.descripcion) + '</textarea></div>' +
    '<div><label>Proyecto</label><select name="proyectoId">' + opcionesProy(t.proyectoId, 'Sin proyecto') + '</select></div><div><label>Estado</label><select name="estado">' + Store.config.columnas.map(c => '<option value="' + c.id + '"' + (c.id === t.estado ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('') + '</select></div>' +
    '<div><label>Prioridad</label><select name="prioridad">' + Store.config.prioridades.map(p => '<option' + (p === t.prioridad ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></div><div><label>Responsable</label><input name="responsable" value="' + esc(t.responsable) + '"></div>' +
    '<div><label>Inicio</label><input type="date" name="inicio" value="' + esc(t.inicio) + '"></div><div><label>Vence</label><input type="date" name="vence" value="' + esc(t.vence) + '"></div>' +
    '<div class="full"><label>Etiquetas (separadas por coma)</label><input name="etiquetas" value="' + esc((t.etiquetas || []).join(', ')) + '"></div></form>' +
    '<h5 style="margin:14px 0 6px">Checklist</h5><div id="chkList">' + chkHtml() + '</div><div class="check-row"><input type="text" id="ckNuevo" placeholder="Nuevo elemento y Enter"><button type="button" class="btn sm" data-act="ck-add">＋</button></div>' +
    '<h5 style="margin:14px 0 6px">Adjuntos (presentaciones, Excel, etc.)</h5><div id="adjList">' + adjHtml() + '</div><label class="btn sm" style="margin-top:6px;display:inline-block">＋ Agregar archivos<input type="file" id="mFiles" multiple hidden></label>' +
    (hist.length ? '<h5 style="margin:14px 0 6px">Historial de la tarea</h5>' + hist.map(h => '<div class="small muted">' + fmtTs(h.fecha) + ' — ' + esc(h.texto) + '</div>').join('') : '') +
    '<div class="modal-foot">' + (ex ? (t.archivada ? '<button class="btn" data-act="restaurar" data-id="' + id + '">Restaurar</button>' : '<button class="btn" data-act="archivar" data-id="' + id + '">📦 Archivar</button>') + '<button class="btn danger" data-act="tarea-del" data-id="' + id + '">Eliminar</button>' : '') +
    '<button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" data-act="tarea-guardar">Guardar</button></div>', true);
  $('[name=titulo]', box).focus();
}
function abrirProyecto(id) {
  const ex = id ? Store.proy(id) : null, p = ex ? clone(ex) : normProy({ id: uid('p'), color: PALETA[Store.proyectos.length % PALETA.length] });
  M = { tipo: 'proyecto', obj: p, eliminadas: [], nuevo: !ex };
  const box = openModal('<h4>' + (ex ? 'Editar proyecto' : 'Nuevo proyecto') + '</h4><form id="mForm" class="form-grid"><div class="full"><label>Nombre *</label><input name="nombre" value="' + esc(p.nombre) + '"></div><div class="full"><label>Descripción</label><textarea name="descripcion" rows="3">' + esc(p.descripcion) + '</textarea></div>' +
    '<div><label>Estado</label><select name="estado">' + ESTADOS_PROY.map(e => '<option' + (e === p.estado ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></div><div><label>Responsable</label><input name="responsable" value="' + esc(p.responsable) + '"></div>' +
    '<div><label>Inicio</label><input type="date" name="inicio" value="' + esc(p.inicio) + '"></div><div><label>Fin</label><input type="date" name="fin" value="' + esc(p.fin) + '"></div><div><label>Color</label><input type="color" name="color" value="' + esc(p.color) + '"></div></form>' +
    '<h5 style="margin:14px 0 6px">Adjuntos</h5><div id="adjList">' + adjHtml() + '</div><label class="btn sm" style="margin-top:6px;display:inline-block">＋ Agregar archivos<input type="file" id="mFiles" multiple hidden></label>' +
    '<div class="modal-foot"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" data-act="proy-guardar">Guardar</button></div>');
  $('[name=nombre]', box).focus();
}
async function leerRecurso(ruta) { if (!FS.ready) await Store.connect(); return FS.readFile(ruta); }

/* ---------- Acciones ---------- */
const guardarNotaDe = async proy => { if (proy) await Store.saveProyecto(Store.proy(proy)); else await Store.saveNotasGen(); };
const ACTIONS = {
  menu: () => $('#sidebar').classList.toggle('open'),
  cerrar: () => closeModal(),
  async conectar() { const r = await Store.connect(); toast(r.inicializada ? 'Carpeta inicializada.' : 'Carpeta conectada y datos cargados.'); aplicarTema(); refrescar(); },
  async 'cambiar-carpeta'() { const r = await Store.connect(true); toast(r.inicializada ? 'Carpeta inicializada.' : 'Carpeta conectada.'); aplicarTema(); refrescar(); },
  async recargar() { await Store.require(); await Store.syncFromFolder(); aplicarTema(); refrescar(); toast('Datos recargados.'); },
  async tema() {
    const nuevo = document.documentElement.dataset.theme === 'oscuro' ? 'claro' : 'oscuro';
    localStorage.setItem('tt-tema', nuevo); aplicarTema(); if (FS.ready) await Store.saveConfig({ tema: nuevo });
  },
  'tarea-nueva': b => abrirTarea(null, { proyectoId: b.dataset.proy || FILTROS.proyecto || '' }),
  'tarea-abrir': b => abrirTarea(b.dataset.id),
  'proy-nuevo': () => abrirProyecto(null),
  'proy-editar': b => abrirProyecto(b.dataset.id),
  async 'proy-guardar'() {
    syncForm(); if (!M.obj.nombre.trim()) return toast('El nombre es obligatorio.', 'warn');
    M.obj.nombre = M.obj.nombre.trim();
    if (M.obj.inicio && M.obj.fin && M.obj.fin < M.obj.inicio) return toast('La fecha fin es anterior al inicio.', 'warn');
    const id = M.obj.id, nuevo = M.nuevo; await Store.saveProyecto(M.obj, M.eliminadas); closeModal(); toast('Proyecto guardado.'); pintarSidebar();
    if (nuevo) location.hash = 'proyecto?id=' + id; else router();
  },
  async 'proy-del'(b) {
    const p = Store.proy(b.dataset.id), n = Store.tareas.filter(t => t.proyectoId === p.id).length;
    if (!confirm('¿Eliminar el proyecto "' + p.nombre + '" junto con sus ' + n + ' tareas, notas y adjuntos? No se puede deshacer.')) return;
    await Store.deleteProyecto(p.id); toast('Proyecto eliminado.'); pintarSidebar(); location.hash = 'proyectos';
  },
  async 'tarea-guardar'() {
    syncForm(); const t = M.obj; if (!t.titulo.trim()) return toast('El título es obligatorio.', 'warn');
    t.titulo = t.titulo.trim();
    if (t.inicio && t.vence && t.vence < t.inicio) return toast('El vencimiento es anterior al inicio.', 'warn');
    const fn = M.fromNota, elim = M.eliminadas; await Store.saveTarea(t, elim);
    if (fn) {
      const lista = fn.proyectoId ? Store.proy(fn.proyectoId)?.notas : Store.notasGen, n = (lista || []).find(x => x.id === fn.id);
      if (n) { n.tareaId = t.id; await guardarNotaDe(fn.proyectoId); }
    }
    closeModal(); toast('Tarea guardada.'); refrescar();
  },
  async 'tarea-del'(b) {
    const t = Store.tarea(b.dataset.id); if (!confirm('¿Eliminar definitivamente "' + t.titulo + '" y sus adjuntos?')) return;
    await Store.deleteTarea(t.id); closeModal(); toast('Tarea eliminada.'); refrescar();
  },
  async archivar(b) { await Store.archivar([b.dataset.id]); closeModal(); toast('Tarea archivada.'); refrescar(); },
  async restaurar(b) { await Store.archivar([b.dataset.id], false); closeModal(); toast('Tarea restaurada.'); refrescar(); },
  async 'archivar-terminadas'() {
    const ids = tareasFiltradas().filter(t => Store.esTerminal(t.estado)).map(t => t.id);
    if (!ids.length) return toast('No hay tareas terminadas para archivar.', 'warn');
    if (!confirm('¿Archivar ' + ids.length + ' tareas terminadas?')) return;
    await Store.archivar(ids); toast(ids.length + ' tareas archivadas.'); refrescar();
  },
  async 'nota-guardar'(b) {
    const f = b.closest('.nota-form'), txt = $('textarea', f).value.trim(); if (!txt) return toast('Escribe la nota.', 'warn');
    const sel = $('.nota-sel', f), proy = sel ? sel.value : f.dataset.proy;
    const n = { id: uid('n'), texto: txt, fecha: new Date().toISOString() };
    if (proy) { const p = Store.proy(proy); p.notas = p.notas || []; p.notas.unshift(n); } else Store.notasGen.unshift(n);
    await guardarNotaDe(proy); await Store.log('nota', 'Nota agregada' + (proy ? ' en ' + Store.proy(proy).nombre : ' (general)'), { proyectoId: proy }); toast('Nota guardada.'); router();
  },
  'nota-tarea'(b) {
    const proy = b.dataset.proy, lista = proy ? Store.proy(proy).notas : Store.notasGen, n = lista.find(x => x.id === b.dataset.id);
    abrirTarea(null, { prefill: { titulo: n.texto.split('\n')[0].slice(0, 80), descripcion: n.texto, proyectoId: proy }, fromNota: { id: n.id, proyectoId: proy } });
  },
  async 'nota-del'(b) {
    if (!confirm('¿Eliminar la nota?')) return; const proy = b.dataset.proy;
    if (proy) { const p = Store.proy(proy); p.notas = p.notas.filter(n => n.id !== b.dataset.id); } else Store.notasGen = Store.notasGen.filter(n => n.id !== b.dataset.id);
    await guardarNotaDe(proy); router();
  },
  async 'hito-add'(b) {
    const nombre = $('#hitoNombre').value.trim(), fecha = $('#hitoFecha').value; if (!nombre || !fecha) return toast('Indica nombre y fecha del hito.', 'warn');
    const p = Store.proy(b.dataset.proy); p.hitos = p.hitos || []; p.hitos.push({ id: uid('h'), nombre, fecha, hecho: false });
    await Store.saveProyecto(p); await Store.log('hito', 'Hito agregado en ' + p.nombre + ': ' + nombre, { proyectoId: p.id }); router();
  },
  async 'hito-del'(b) { const p = Store.proy(b.dataset.proy); p.hitos = p.hitos.filter(h => h.id !== b.dataset.id); await Store.saveProyecto(p); router(); },
  async 'ad-dl'(b) {
    const a = M.obj.adjuntos[+b.dataset.i]; descargarBlob(a.file || await leerRecurso(a.ruta), a.nombre);
  },
  async 'ad-dl-proy'(b) { const a = Store.proy(b.dataset.id).adjuntos[+b.dataset.i]; descargarBlob(await leerRecurso(a.ruta), a.nombre); },
  'ad-rm'(b) { const a = M.obj.adjuntos.splice(+b.dataset.i, 1)[0]; if (a.ruta) M.eliminadas.push(a.ruta); $('#adjList').innerHTML = adjHtml(); },
  'ck-add'() { const i = $('#ckNuevo'), v = i.value.trim(); if (!v) return; M.obj.checklist.push({ id: uid('c'), texto: v, hecho: false }); $('#chkList').innerHTML = chkHtml(); i.value = ''; i.focus(); },
  'ck-del'(b) { M.obj.checklist.splice(+b.dataset.i, 1); $('#chkList').innerHTML = chkHtml(); },
  'col-add'() { leerCols(); COLS.push({ id: 'c_' + Date.now().toString(36), nombre: 'Nueva columna', color: '#0891b2', terminal: false }); pintarCols(); },
  'col-up'(b) { leerCols(); const i = +b.dataset.i; if (i > 0) [COLS[i - 1], COLS[i]] = [COLS[i], COLS[i - 1]]; pintarCols(); },
  'col-down'(b) { leerCols(); const i = +b.dataset.i; if (i < COLS.length - 1) [COLS[i + 1], COLS[i]] = [COLS[i], COLS[i + 1]]; pintarCols(); },
  'col-del'(b) {
    leerCols(); const c = COLS[+b.dataset.i];
    if (Store.tareas.some(t => t.estado === c.id)) return toast('La columna tiene tareas (incluidas archivadas). Muévelas antes de eliminarla.', 'warn');
    COLS.splice(+b.dataset.i, 1); pintarCols();
  },
  async 'col-save'() {
    leerCols(); if (!COLS.length || COLS.some(c => !c.nombre)) return toast('Cada columna necesita nombre y debe haber al menos una.', 'warn');
    const ids = new Set(COLS.map(c => c.id)); const huerf = Store.tareas.find(t => !ids.has(t.estado));
    if (huerf) return toast('Hay tareas en una columna eliminada: "' + huerf.titulo + '".', 'warn');
    await Store.saveConfig({ columnas: COLS }); toast('Columnas guardadas.'); vConfig();
  },
  async exportar() { descargarBlob(new Blob([await Store.exportAll()], { type: 'application/json' }), 'tablero-tareas-' + HOY() + '.json'); },
  async 'limpiar-cache'() { if (!confirm('Se borra solo la caché del navegador y la carpeta recordada. Los archivos no se tocan.')) return; await idbClear(); toast('Caché limpiada. Recarga la página.'); }
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACTIONS[b.dataset.act]; if (!fn) return; e.preventDefault();
  try { await fn(b, e); } catch (err) { if (err.name !== 'AbortError') { console.error(err); toast(err.message || String(err), 'err'); } pintarCarpeta(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ct !== undefined && M) M.obj.checklist[+t.dataset.ct].texto = t.value;
  else if (t.dataset.filtro === 'q') { FILTROS.q = t.value; pintarColumnas(); }
  else if (t.dataset.arq !== undefined) { ARQ_Q = t.value; $('#arqBody').innerHTML = listaArchivo(); }
  else if (t.dataset.hq !== undefined) { HIST_Q = t.value; $('#histBody').innerHTML = listaHistorial(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.dataset.ck !== undefined && M) M.obj.checklist[+t.dataset.ck].hecho = t.checked;
    else if (t.dataset.filtro && t.dataset.filtro !== 'q') { FILTROS[t.dataset.filtro] = t.value; pintarColumnas(); }
    else if (t.dataset.gantt) { if (t.dataset.gantt === 'dw') GANTT.dw = +t.value; else GANTT.proyecto = t.value; vGantt(new URLSearchParams()); }
    else if (t.dataset.hito) {
      const p = Store.proy(t.dataset.proy), h = p.hitos.find(x => x.id === t.dataset.hito); h.hecho = t.checked;
      await Store.saveProyecto(p); await Store.log('hito', (t.checked ? 'Hito cumplido: ' : 'Hito reabierto: ') + h.nombre + ' (' + p.nombre + ')', { proyectoId: p.id }); router();
    } else if (t.id === 'mFiles' && M) {
      for (const f of t.files) {
        if (f.size > MAX_MB * 1048576) { toast(f.name + ' supera ' + MAX_MB + ' MB.', 'err'); continue; }
        M.obj.adjuntos.push({ nombre: f.name, size: f.size, tipo: f.type, file: f });
      }
      t.value = ''; $('#adjList').innerHTML = adjHtml();
    } else if (t.id === 'fileImport') {
      const f = t.files[0]; t.value = ''; if (!f) return;
      await Store.importAll(await f.text()); toast('Datos importados.'); refrescar();
    }
  } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }
});
document.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return; const t = e.target;
  try {
    if (t.dataset.quick) {
      const v = t.value.trim(); if (!v) return;
      const orden = Math.max(-1, ...Store.tareas.filter(x => x.estado === t.dataset.quick).map(x => x.orden ?? 0)) + 1;
      await Store.saveTarea(normTarea({ id: uid('t'), titulo: v, estado: t.dataset.quick, proyectoId: FILTROS.proyecto, responsable: Store.config.responsable || '', orden }));
      pintarColumnas(); pintarCarpeta(); const n = $('[data-quick="' + t.dataset.quick + '"]'); if (n) n.focus();
    } else if (t.id === 'ckNuevo') { e.preventDefault(); ACTIONS['ck-add'](); }
  } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'cfgForm') {
    e.preventDefault();
    try {
      const d = Object.fromEntries(new FormData(e.target).entries()); localStorage.setItem('tt-tema', d.tema);
      await Store.saveConfig(d); aplicarTema(); toast('Configuración guardada.');
    } catch (err) { if (err.name !== 'AbortError') toast(err.message, 'err'); }
  } else if (e.target.id === 'mForm') e.preventDefault();
});

/* ---------- Inicio ---------- */
async function initApp() {
  try { await Store.init(); } catch (e) { console.error(e); }
  aplicarTema(); pintarSidebar(); pintarCarpeta();
  if (!location.hash) location.hash = 'inicio'; else router();
  if (FS.ready) {
    try { if (await Store.syncFromFolder()) { aplicarTema(); refrescar(); } } catch (e) { console.warn('No se pudo sincronizar', e); }
  }
}
document.addEventListener('DOMContentLoaded', initApp);

