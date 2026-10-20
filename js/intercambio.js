/* ---------- Intercambio: Microsoft Project (XML MSPDI) y Excel (.xlsx) ---------- */
const xmlEsc = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PRIO_MSP = { baja: 300, media: 500, alta: 700, critica: 900 };
const prioDeMsp = n => n < 500 ? 'baja' : n < 600 ? 'media' : n < 800 ? 'alta' : 'critica';
const EXT = { estado: 188743731, responsable: 188743734, etiquetas: 188743737, archivada: 188743740, id: 188743743 };
const EXT_ALIAS = { estado: 'Estado', responsable: 'Responsable', etiquetas: 'Etiquetas', archivada: 'Archivada', id: 'IdTablero' };

function seleccionExport() {
  const sel = ($('#xchgProy') || {}).value || '';
  const proys = Store.proyectos.filter(p => !sel || p.id === sel).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const tareasDe = pid => Store.tareas.filter(t => (t.proyectoId || '') === pid);
  return { proys, sinProy: sel ? [] : tareasDe(''), tareasDe, sel };
}
function diasHabiles(a, b) { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) { const w = parseD(d).getDay(); if (w !== 0 && w !== 6) n++; } return Math.max(1, n); }

/* ===== Exportar a MSPDI ===== */
function generarMSPDI() {
  const { proys, sinProy, tareasDe } = seleccionExport(), hoy = HOY();
  let uidN = 0; const filas = [];
  const fechasTarea = (t, p) => { let s = t.inicio || t.vence || (p && p.inicio) || hoy, f = t.vence || t.inicio || s; if (f < s) f = s; return [s, f]; };
  const grupos = proys.map(p => ({ p, nombre: p.nombre, ts: tareasDe(p.id), hitos: p.hitos || [] }));
  if (sinProy.length) grupos.push({ p: null, nombre: 'Sin proyecto', ts: sinProy, hitos: [] });
  const raiz = { uid: 0, nombre: Store.config.nombrePortal, nivel: 0, wbs: '0', resumen: true, hijos: [] };
  grupos.forEach((g, gi) => {
    const nodo = { uid: ++uidN, nombre: g.nombre, nivel: 1, wbs: String(gi + 1), resumen: true, ext: { id: g.p ? g.p.id : '' }, notas: g.p ? g.p.descripcion : '', hijos: [] };
    let j = 0;
    g.ts.forEach(t => { const [s, f] = fechasTarea(t, g.p), ck = t.checklist || [];
      nodo.hijos.push({ uid: ++uidN, nombre: t.titulo, nivel: 2, wbs: nodo.wbs + '.' + (++j), s, f, pct: Store.esTerminal(t.estado) ? 100 : (ck.length ? Math.round(100 * ck.filter(c => c.hecho).length / ck.length) : 0), prio: PRIO_MSP[t.prioridad] || 500, notas: t.descripcion,
        ext: { estado: Store.col(t.estado)?.nombre || t.estado, responsable: t.responsable, etiquetas: (t.etiquetas || []).join(', '), archivada: t.archivada ? 'Sí' : '', id: t.id } }); });
    g.hitos.forEach(h => nodo.hijos.push({ uid: ++uidN, nombre: h.nombre, nivel: 2, wbs: nodo.wbs + '.' + (++j), s: h.fecha, f: h.fecha, hito: true, pct: h.hecho ? 100 : 0, prio: 500, ext: { id: h.id } }));
    const ss = [...nodo.hijos.map(h => h.s), g.p && g.p.inicio].filter(Boolean).sort(), ff = [...nodo.hijos.map(h => h.f), g.p && g.p.fin].filter(Boolean).sort();
    nodo.s = ss[0] || hoy; nodo.f = ff[ff.length - 1] || nodo.s; if (g.p && g.p.inicio) nodo.s = g.p.inicio < nodo.s ? g.p.inicio : nodo.s;
    nodo.pct = nodo.hijos.length ? Math.round(nodo.hijos.reduce((a, h) => a + h.pct, 0) / nodo.hijos.length) : 0; nodo.prio = 500;
    raiz.hijos.push(nodo);
  });
  const todas = raiz.hijos.flatMap(n => [n, ...n.hijos]);
  raiz.s = todas.map(n => n.s).sort()[0] || hoy; raiz.f = todas.map(n => n.f).sort().pop() || raiz.s; raiz.pct = raiz.hijos.length ? Math.round(raiz.hijos.reduce((a, n) => a + n.pct, 0) / raiz.hijos.length) : 0; raiz.prio = 500;
  filas.push(raiz, ...todas);
  const taskXml = n => {
    const h = n.hito ? 0 : diasHabiles(n.s, n.f) * 8, ext = Object.entries(n.ext || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => '<ExtendedAttribute><FieldID>' + EXT[k] + '</FieldID><Value>' + xmlEsc(v) + '</Value></ExtendedAttribute>').join('');
    return '<Task><UID>' + n.uid + '</UID><ID>' + n.uid + '</ID><Name>' + xmlEsc(n.nombre) + '</Name><Type>0</Type><IsNull>0</IsNull><WBS>' + n.wbs + '</WBS><OutlineNumber>' + n.wbs + '</OutlineNumber><OutlineLevel>' + n.nivel + '</OutlineLevel><Priority>' + n.prio + '</Priority>' +
      '<Start>' + n.s + 'T08:00:00</Start><Finish>' + n.f + 'T17:00:00</Finish><Duration>PT' + h + 'H0M0S</Duration><DurationFormat>7</DurationFormat><Milestone>' + (n.hito ? 1 : 0) + '</Milestone><Summary>' + (n.resumen ? 1 : 0) + '</Summary><PercentComplete>' + n.pct + '</PercentComplete><ConstraintType>0</ConstraintType>' +
      (n.notas ? '<Notes>' + xmlEsc(n.notas) + '</Notes>' : '') + ext + '</Task>';
  };
  const ahora = new Date().toISOString().slice(0, 19);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project"><SaveVersion>12</SaveVersion><UID>1</UID><Name>' + xmlEsc(Store.config.nombrePortal) + '</Name><Title>' + xmlEsc(Store.config.nombrePortal) + '</Title><CreationDate>' + ahora + '</CreationDate><LastSaved>' + ahora + '</LastSaved><ScheduleFromStart>1</ScheduleFromStart><StartDate>' + raiz.s + 'T08:00:00</StartDate><FinishDate>' + raiz.f + 'T17:00:00</FinishDate><CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth><DurationFormat>7</DurationFormat>' +
    '<ExtendedAttributes>' + Object.keys(EXT).map(k => '<ExtendedAttribute><FieldID>' + EXT[k] + '</FieldID><FieldName>Text' + (Object.keys(EXT).indexOf(k) + 1) + '</FieldName><Alias>' + EXT_ALIAS[k] + '</Alias></ExtendedAttribute>').join('') + '</ExtendedAttributes>' +
    '<Calendars><Calendar><UID>1</UID><Name>Estándar</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays><WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>' + [2, 3, 4, 5, 6].map(d => '<WeekDay><DayType>' + d + '</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>').join('') + '<WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay></WeekDays></Calendar></Calendars>' +
    '<Tasks>' + filas.map(taskXml).join('') + '</Tasks></Project>';
}

/* ===== Importar MSPDI -> borrador ===== */
function parseMSPDI(txt) {
  const doc = new DOMParser().parseFromString(txt, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('El archivo no es un XML válido.');
  const hijo = (el, n) => { for (const c of el.children) if (c.localName === n) return c.textContent.trim(); return ''; };
  const dentroDe = (el, n) => el.parentNode && el.parentNode.localName === n;
  const tareasEl = [...doc.getElementsByTagNameNS('*', 'Task')].filter(t => dentroDe(t, 'Tasks'));
  if (!tareasEl.length) throw new Error('No se encontraron tareas. Guarda el proyecto en Project como "XML" (formato MSPDI), no como .mpp.');
  const recursos = {}; [...doc.getElementsByTagNameNS('*', 'Resource')].filter(r => dentroDe(r, 'Resources')).forEach(r => { recursos[hijo(r, 'UID')] = hijo(r, 'Name'); });
  const asig = {}; [...doc.getElementsByTagNameNS('*', 'Assignment')].forEach(a => { const n = recursos[hijo(a, 'ResourceUID')]; if (n) (asig[hijo(a, 'TaskUID')] = asig[hijo(a, 'TaskUID')] || []).push(n); });
  const rev = Object.fromEntries(Object.entries(EXT).map(([k, v]) => [String(v), k]));
  const lista = tareasEl.map(t => {
    const ext = {}; [...t.children].filter(c => c.localName === 'ExtendedAttribute').forEach(e => { const k = rev[hijo(e, 'FieldID')]; if (k) ext[k] = hijo(e, 'Value'); });
    const fecha = s => (s || '').slice(0, 10);
    return { uid: hijo(t, 'UID'), nombre: hijo(t, 'Name'), nivel: +hijo(t, 'OutlineLevel') || 0, resumen: hijo(t, 'Summary') === '1', hito: hijo(t, 'Milestone') === '1', nulo: hijo(t, 'IsNull') === '1',
      s: fecha(hijo(t, 'Start')), f: fecha(hijo(t, 'Finish')), pct: +hijo(t, 'PercentComplete') || 0, prio: +hijo(t, 'Priority') || 500, notas: hijo(t, 'Notes'), ext, recursos: (asig[hijo(t, 'UID')] || []).join(', ') };
  }).filter(t => !t.nulo && t.nivel >= 1 && t.nombre);
  const base = Math.min(...lista.map(t => t.nivel));
  const out = { proyectos: [], tareas: [] }; let cur = null; const fases = {};
  lista.forEach(t => {
    if (t.resumen && t.nivel === base) { cur = { id: t.ext.id || '', nombre: t.nombre, descripcion: t.notas, inicio: t.s, fin: t.f, hitos: [], notas: [], sin: t.nombre === 'Sin proyecto' && !t.ext.id }; if (!cur.sin) out.proyectos.push(cur); fases[t.nivel] = ''; return; }
    if (t.resumen) { fases[t.nivel] = t.nombre; return; }
    const dentro = t.nivel > base && cur && !cur.sin;
    if (t.nivel === base) cur = null;
    if (t.hito && dentro) { cur.hitos.push({ id: t.ext.id || '', nombre: t.nombre, fecha: t.s, hecho: t.pct >= 100 }); return; }
    const etq = (t.ext.etiquetas || '').split(',').map(s => s.trim()).filter(Boolean);
    if (t.nivel > base + 1 && fases[t.nivel - 1] && !etq.includes(fases[t.nivel - 1])) etq.push(fases[t.nivel - 1]);
    out.tareas.push({ id: t.ext.id || '', titulo: t.nombre, descripcion: t.notas, proyId: dentro ? cur.id : '', proyNombre: dentro ? cur.nombre : '', estado: t.ext.estado || '', pct: t.pct,
      prioridad: prioDeMsp(t.prio), responsable: t.ext.responsable || t.recursos, inicio: t.s, vence: t.f, etiquetas: etq, archivada: /^s[ií]/i.test(t.ext.archivada || '') });
  });
  return out;
}

/* ===== Aplicar borrador (común a Project y Excel) ===== */
const lc = s => (s || '').toString().trim().toLowerCase();
function buscarProy(d) { return (d.id && Store.proy(d.id)) || Store.proyectos.find(p => lc(p.nombre) === lc(d.nombre)); }
function resolverEstado(nombre, pct) {
  const cols = Store.config.columnas, m = cols.find(c => lc(c.nombre) === lc(nombre) || c.id === nombre); if (m) return m.id;
  const term = cols.find(c => c.terminal), noTerm = cols.filter(c => !c.terminal);
  if (pct >= 100 && term) return term.id; if (pct > 0 && noTerm[1]) return noTerm[1].id; return (noTerm[0] || cols[0]).id;
}
function planificar(d) {
  const r = { pN: 0, pU: 0, tN: 0, tU: 0, hN: 0, nN: 0 }, nuevosP = new Set();
  d.proyectos.forEach(p => { const ex = buscarProy(p); if (ex) { r.pU++; r.hN += (p.hitos || []).filter(h => !(ex.hitos || []).some(x => x.id === h.id || lc(x.nombre) === lc(h.nombre))).length; r.nN += (p.notas || []).filter(n => !(ex.notas || []).some(x => x.id === n.id || x.texto === n.texto)).length; } else { r.pN++; r.hN += (p.hitos || []).length; r.nN += (p.notas || []).length; nuevosP.add(lc(p.nombre)); } });
  d.tareas.forEach(t => { const ex = (t.id && Store.tarea(t.id)) || Store.tareas.find(x => lc(x.titulo) === lc(t.titulo) && lc(Store.proy(x.proyectoId)?.nombre || '') === lc(t.proyNombre)); if (ex) r.tU++; else r.tN++; });
  return r;
}
async function aplicarBorrador(d) {
  await Store.require();
  await Store.batch(async () => {
    const mapaId = new Map(), mapaNom = new Map();
    for (const dp of d.proyectos) {
      const ex = buscarProy(dp), p = ex ? clone(ex) : normProy({ id: uid('p'), color: PALETA[Store.proyectos.length % PALETA.length] });
      p.nombre = dp.nombre || p.nombre; if (dp.descripcion) p.descripcion = dp.descripcion; if (dp.estado && ESTADOS_PROY.includes(lc(dp.estado))) p.estado = lc(dp.estado);
      if (dp.responsable) p.responsable = dp.responsable; if (dp.inicio) p.inicio = dp.inicio; if (dp.fin) p.fin = dp.fin; if (dp.color && /^#[0-9a-f]{6}$/i.test(dp.color)) p.color = dp.color;
      for (const h of (dp.hitos || [])) { const eh = p.hitos.find(x => (h.id && x.id === h.id) || lc(x.nombre) === lc(h.nombre)); if (eh) { eh.fecha = h.fecha || eh.fecha; eh.hecho = h.hecho; } else p.hitos.push({ id: uid('h'), nombre: h.nombre, fecha: h.fecha, hecho: !!h.hecho }); }
      for (const n of (dp.notas || [])) if (!p.notas.some(x => (n.id && x.id === n.id) || x.texto === n.texto)) p.notas.push({ id: uid('n'), texto: n.texto, fecha: n.fecha || new Date().toISOString() });
      await Store.saveProyecto(p); if (dp.id) mapaId.set(dp.id, p.id); mapaNom.set(lc(dp.nombre), p.id);
    }
    const resolver = (id, nombre) => (id && mapaId.get(id)) || (id && Store.proy(id) && id) || mapaNom.get(lc(nombre)) || Store.proyectos.find(p => lc(p.nombre) === lc(nombre))?.id || '';
    for (const dt of d.tareas) {
      let pid = resolver(dt.proyId, dt.proyNombre);
      if (!pid && dt.proyNombre) { const np = normProy({ id: uid('p'), nombre: dt.proyNombre, color: PALETA[Store.proyectos.length % PALETA.length] }); await Store.saveProyecto(np); mapaNom.set(lc(np.nombre), np.id); pid = np.id; }
      const ex = (dt.id && Store.tarea(dt.id)) || Store.tareas.find(x => lc(x.titulo) === lc(dt.titulo) && (x.proyectoId || '') === pid);
      const t = ex ? clone(ex) : normTarea({ id: uid('t') });
      t.titulo = dt.titulo; t.proyectoId = pid; if (dt.descripcion) t.descripcion = dt.descripcion;
      if (dt.prioridad && Store.config.prioridades.includes(lc(dt.prioridad))) t.prioridad = lc(dt.prioridad);
      if (dt.responsable) t.responsable = dt.responsable; t.inicio = dt.inicio || ''; t.vence = dt.vence || '';
      if (dt.etiquetas && dt.etiquetas.length) t.etiquetas = dt.etiquetas; if (dt.checklist && dt.checklist.length) t.checklist = dt.checklist;
      let est = ex ? t.estado : resolverEstado(dt.estado, dt.pct || 0);
      if (ex) { if (dt.estado) est = resolverEstado(dt.estado, 0); else if ((dt.pct || 0) >= 100 && !Store.esTerminal(est)) est = resolverEstado('', 100); }
      t.estado = est;
      if (!ex) t.orden = Math.max(-1, ...Store.tareas.filter(x => x.estado === t.estado).map(x => x.orden ?? 0)) + 1;
      if (dt.completada && Store.esTerminal(t.estado)) t.completada = dt.completada;
      if (dt.archivada !== undefined && dt.archivada !== t.archivada) { t.archivada = dt.archivada; t.fechaArchivo = dt.archivada ? HOY() : null; }
      await Store.saveTarea(t);
    }
    await Store.log('importacion', 'Importación: ' + d.proyectos.length + ' proyectos, ' + d.tareas.length + ' tareas');
  });
}
async function importarBorrador(d, origen) {
  const r = planificar(d);
  const msg = 'Se importará desde ' + origen + ':\n\nProyectos: ' + r.pN + ' nuevos, ' + r.pU + ' actualizados\nTareas: ' + r.tN + ' nuevas, ' + r.tU + ' actualizadas\nHitos nuevos: ' + r.hN + '\nNotas nuevas: ' + r.nN + '\n\nNo se elimina nada. Las tareas se emparejan por ID o por título dentro del proyecto. ¿Continuar?';
  if (!confirm(msg)) return false;
  await aplicarBorrador(d); toast('Importación completada.'); refrescar(); return true;
}

/* ===== XLSX: escritura y lectura sin librerías ===== */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(archivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0; const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const a of archivos) {
    const data = enc.encode(a.contenido), name = enc.encode(a.nombre), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    partes.push(lh, name, data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(ch, name); off += 30 + name.length + data.length;
  }
  const cs = central.reduce((n, p) => n + p.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, archivos.length, true); end.setUint16(10, archivos.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
  return new Blob([...partes, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const colLetra = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function generarXlsx(hojas) {
  const hojaXml = h => {
    const filas = [h.cols.map(c => c.t), ...h.filas];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + h.cols.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 18) + '" customWidth="1"/>').join('') + '</cols><sheetData>' +
      filas.map((f, r) => '<row r="' + (r + 1) + '">' + f.map((v, c) => '<c r="' + colLetra(c) + (r + 1) + '" t="inlineStr"' + (r === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xmlEsc(String(v == null ? '' : v).slice(0, 32000)) + '</t></is></c>').join('') + '</row>').join('') + '</sheetData></worksheet>';
  };
  const arch = [
    { nombre: '[Content_Types].xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + hojas.map((h, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
    { nombre: '_rels/.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nombre: 'xl/workbook.xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + hojas.map((h, i) => '<sheet name="' + xmlEsc(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + hojas.map((h, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nombre: 'xl/styles.xml', contenido: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ...hojas.map((h, i) => ({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', contenido: hojaXml(h) }))
  ];
  return zipStore(arch);
}
async function inflarRaw(u8) { const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function leerZip(buffer) {
  const dv = new DataView(buffer), u8 = new Uint8Array(buffer); let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El archivo no es un .xlsx válido.');
  const total = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const dec = new TextDecoder(), out = {};
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const met = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nombre = dec.decode(u8.subarray(p + 46, p + 46 + nl)), ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), datos = u8.subarray(ini, ini + cs);
    if (/\.(xml|rels)$/i.test(nombre)) out[nombre] = dec.decode(met === 0 ? datos : await inflarRaw(datos));
    p += 46 + nl + el + cl;
  }
  return out;
}
const colIdx = ref => { const l = (ref.match(/[A-Z]+/i) || ['A'])[0].toUpperCase(); let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
async function leerXlsx(file) {
  const ent = await leerZip(await file.arrayBuffer()), parse = n => ent[n] ? new DOMParser().parseFromString(ent[n], 'application/xml') : null;
  const wb = parse('xl/workbook.xml'); if (!wb) throw new Error('No parece un .xlsx (falta xl/workbook.xml).');
  const rels = {};
  [...(parse('xl/_rels/workbook.xml.rels')?.getElementsByTagName('Relationship') || [])].forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const comp = []; const ss = parse('xl/sharedStrings.xml');
  if (ss) [...ss.getElementsByTagName('si')].forEach(si => comp.push([...si.getElementsByTagName('t')].filter(t => !t.closest('rPh')).map(t => t.textContent).join('')));
  const hojas = {};
  for (const sh of wb.getElementsByTagName('sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let tg = rels[rid] || ''; tg = tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg; const doc = parse(tg); if (!doc) continue;
    const filas = [];
    [...doc.getElementsByTagName('row')].forEach(row => {
      const r = parseInt(row.getAttribute('r'), 10) - 1, cel = [];
      [...row.getElementsByTagName('c')].forEach(c => {
        const t = c.getAttribute('t'); let v;
        if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else { const x = c.getElementsByTagName('v')[0]?.textContent ?? ''; v = t === 's' ? (comp[parseInt(x, 10)] ?? '') : t === 'b' ? (x === '1' ? 'Sí' : 'No') : x; }
        cel[colIdx(c.getAttribute('r') || 'A1')] = v;
      });
      filas[r] = Array.from(cel, x => x ?? '');
    });
    hojas[sh.getAttribute('name')] = Array.from(filas, f => f || []);
  }
  return hojas;
}
function normFecha(v) {
  v = (v == null ? '' : String(v)).trim(); if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  let m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if (/^\d+(\.\d+)?$/.test(v) && +v > 20000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5); return d.toISOString().slice(0, 10); }
  return '';
}
const siNo = v => /^(s[ií]|true|1|x|yes)$/i.test(String(v).trim());

function generarExcel() {
  const { proys, sinProy, tareasDe, sel } = seleccionExport(), nomP = id => Store.proy(id)?.nombre || '';
  const ts = [...proys.flatMap(p => tareasDe(p.id)), ...sinProy];
  const ck = t => (t.checklist || []).map(c => (c.hecho ? '[x] ' : '[ ] ') + c.texto).join('\n');
  return generarXlsx([
    { nombre: 'Proyectos', cols: [{ t: 'ID', w: 20 }, { t: 'Nombre', w: 30 }, { t: 'Descripción', w: 40 }, { t: 'Estado', w: 12 }, { t: 'Responsable', w: 18 }, { t: 'Inicio', w: 12 }, { t: 'Fin', w: 12 }, { t: 'Color', w: 10 }, { t: 'Avance %', w: 10 }],
      filas: proys.map(p => [p.id, p.nombre, p.descripcion, p.estado, p.responsable, p.inicio, p.fin, p.color, avance(p.id).pct]) },
    { nombre: 'Tareas', cols: [{ t: 'ID', w: 20 }, { t: 'Título', w: 36 }, { t: 'Descripción', w: 40 }, { t: 'ProyectoID', w: 20 }, { t: 'Proyecto', w: 24 }, { t: 'Estado', w: 14 }, { t: 'Prioridad', w: 10 }, { t: 'Responsable', w: 16 }, { t: 'Inicio', w: 12 }, { t: 'Vence', w: 12 }, { t: 'Etiquetas', w: 20 }, { t: 'Completada', w: 12 }, { t: 'Archivada', w: 10 }, { t: 'Checklist', w: 40 }],
      filas: ts.map(t => [t.id, t.titulo, t.descripcion, t.proyectoId, nomP(t.proyectoId), Store.col(t.estado)?.nombre || t.estado, t.prioridad, t.responsable, t.inicio, t.vence, (t.etiquetas || []).join(', '), t.completada || '', t.archivada ? 'Sí' : '', ck(t)]) },
    { nombre: 'Hitos', cols: [{ t: 'ID', w: 20 }, { t: 'ProyectoID', w: 20 }, { t: 'Proyecto', w: 24 }, { t: 'Nombre', w: 34 }, { t: 'Fecha', w: 12 }, { t: 'Cumplido', w: 10 }],
      filas: proys.flatMap(p => (p.hitos || []).map(h => [h.id, p.id, p.nombre, h.nombre, h.fecha, h.hecho ? 'Sí' : 'No'])) },
    { nombre: 'Notas', cols: [{ t: 'ID', w: 20 }, { t: 'ProyectoID', w: 20 }, { t: 'Proyecto', w: 24 }, { t: 'Fecha', w: 18 }, { t: 'Texto', w: 70 }],
      filas: [...proys.flatMap(p => (p.notas || []).map(n => [n.id, p.id, p.nombre, n.fecha, n.texto])), ...(sel ? [] : Store.notasGen.map(n => [n.id, '', '', n.fecha, n.texto]))] }
  ]);
}
function tablaDe(hoja) {
  if (!hoja || !hoja.length) return [];
  const cab = hoja[0].map(c => lc(c)); return hoja.slice(1).filter(f => f.some(x => String(x).trim())).map(f => { const o = {}; cab.forEach((c, i) => { o[c] = f[i] ?? ''; }); return o; });
}
function borradorDeExcel(hojas) {
  const get = n => hojas[Object.keys(hojas).find(k => lc(k) === n)], P = tablaDe(get('proyectos')), T = tablaDe(get('tareas')), H = tablaDe(get('hitos')), N = tablaDe(get('notas'));
  if (!P.length && !T.length) throw new Error('El Excel no tiene hojas "Proyectos" o "Tareas" con datos. Usa un archivo generado con "Exportar a Excel".');
  const proy = new Map(); const key = (id, nom) => id || lc(nom);
  const dp = o => { const k = key(o.id || o.proyectoid, o.nombre || o.proyecto); if (!proy.has(k)) proy.set(k, { id: o.id || o.proyectoid || '', nombre: o.nombre || o.proyecto || '', hitos: [], notas: [] }); return proy.get(k); };
  P.forEach(o => { if (!o.nombre) return; Object.assign(dp({ id: o.id, nombre: o.nombre }), { descripcion: o['descripción'] || o.descripcion, estado: o.estado, responsable: o.responsable, inicio: normFecha(o.inicio), fin: normFecha(o.fin), color: o.color }); });
  const buscar = (pid, pn) => { for (const p of proy.values()) if ((pid && p.id === pid) || (pn && lc(p.nombre) === lc(pn))) return p; return null; };
  H.forEach(o => { if (!o.nombre) return; const p = buscar(o.proyectoid, o.proyecto); if (p) p.hitos.push({ id: o.id, nombre: o.nombre, fecha: normFecha(o.fecha), hecho: siNo(o.cumplido) }); });
  N.forEach(o => { if (!o.texto) return; const p = buscar(o.proyectoid, o.proyecto); if (p) p.notas.push({ id: o.id, texto: o.texto, fecha: o.fecha }); });
  const tareas = T.filter(o => o['título'] || o.titulo).map(o => ({
    id: o.id, titulo: o['título'] || o.titulo, descripcion: o['descripción'] || o.descripcion, proyId: o.proyectoid, proyNombre: o.proyecto, estado: o.estado, prioridad: o.prioridad, responsable: o.responsable,
    inicio: normFecha(o.inicio), vence: normFecha(o.vence), etiquetas: String(o.etiquetas || '').split(',').map(s => s.trim()).filter(Boolean), completada: normFecha(o.completada),
    archivada: o.archivada === '' ? undefined : siNo(o.archivada),
    checklist: String(o.checklist || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ id: uid('c'), hecho: /^\[x\]/i.test(s), texto: s.replace(/^\[[ xX]\]\s*/, '') }))
  }));
  return { proyectos: [...proy.values()], tareas };
}

/* ===== Acciones y enlace con la UI ===== */
Object.assign(ACTIONS, {
  'exp-msp'() { descargarBlob(new Blob([generarMSPDI()], { type: 'application/xml' }), 'tablero-' + HOY() + '.xml'); toast('XML de Project generado. En Project: Archivo > Abrir.'); },
  'exp-xlsx'() { descargarBlob(generarExcel(), 'tablero-' + HOY() + '.xlsx'); toast('Excel generado.'); }
});
document.addEventListener('change', async e => {
  const t = e.target; if (t.id !== 'fileImpMsp' && t.id !== 'fileImpXlsx') return;
  const f = t.files[0]; t.value = ''; if (!f) return;
  try {
    if (t.id === 'fileImpMsp') await importarBorrador(parseMSPDI(await f.text()), 'Microsoft Project (' + f.name + ')');
    else await importarBorrador(borradorDeExcel(await leerXlsx(f)), 'Excel (' + f.name + ')');
  } catch (err) { if (err.name !== 'AbortError') { console.error(err); toast(err.message, 'err'); } }
});
function intercambioHtml() {
  return '<div class="card"><h4 style="margin-top:0">Intercambio: Microsoft Project y Excel</h4><div class="filters" style="margin-bottom:10px"><label class="small muted">Alcance de la exportación</label><select id="xchgProy">' + opcionesProy('', 'Todo el tablero') + '</select></div>' +
    '<div class="filters"><button class="btn" data-act="exp-msp">⬇ Exportar a Project (XML)</button><label class="btn">⬆ Importar desde Project (XML)<input type="file" id="fileImpMsp" accept=".xml" hidden></label></div>' +
    '<div class="filters" style="margin-top:8px"><button class="btn" data-act="exp-xlsx">⬇ Exportar a Excel</button><label class="btn">⬆ Importar desde Excel<input type="file" id="fileImpXlsx" accept=".xlsx" hidden></label></div>' +
    '<p class="muted small">Project: guarda/abre en formato <b>XML (MSPDI)</b>, no .mpp. Cada proyecto es una tarea resumen; sus hitos son hitos de Project. Las tareas sin fechas se exportan con la fecha del proyecto u hoy. Al importar se actualiza por ID o por título y nunca se elimina nada. Adjuntos, conexiones y checklist (solo Excel) no viajan por Project.</p></div>';
}

