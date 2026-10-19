/* v5: importacion MSPDI por GUID de origen + UID. Cargar despues de intercambio.js. */
(() => {
  'use strict';
  let busy = false;
  const children = (e, name) => [...e.children].filter(x => x.localName === name);
  const value = (e, name) => children(e, name)[0]?.textContent.trim() || '';
  const fecha = s => {
    const m = String(s || '').match(/^\d{4}-\d{2}-\d{2}/);
    if (!m) return '';
    const d = new Date(m[0] + 'T12:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === m[0] ? m[0] : '';
  };
  async function stable(source, kind, uid) {
    const data = new TextEncoder().encode(JSON.stringify([source, kind, uid]));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return 'msp_' + kind + '_' + [...hash].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  async function parse(txt, fallback = '') {
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'Project') throw new Error('XML Project no valido.');
    const root = doc.documentElement, guid = value(root, 'GUID').replace(/[{}]/g, '').toLowerCase();
    if (!guid && !fallback.trim()) throw new Error('Este XML no tiene GUID. Indica una clave estable para identificar el proyecto de origen.');
    const source = guid ? 'guid:' + guid : 'clave:' + fallback.trim();
    const resources = new Map();
    const resourceRoot = children(root, 'Resources')[0];
    if (resourceRoot) children(resourceRoot, 'Resource').forEach(r => resources.set(value(r, 'UID'), value(r, 'Name')));
    const assigned = new Map(), assignmentRoot = children(root, 'Assignments')[0];
    if (assignmentRoot) children(assignmentRoot, 'Assignment').forEach(a => {
      const id = value(a, 'TaskUID'), name = resources.get(value(a, 'ResourceUID'));
      if (name) assigned.set(id, [...(assigned.get(id) || []), name]);
    });
    const taskRoot = children(root, 'Tasks')[0];
    if (!taskRoot) throw new Error('No se encontro Tasks en el XML.');
    const nodes = children(taskRoot, 'Task'), rows = [], seen = new Set();
    let skipped = 0;
    for (const t of nodes) {
      const level = Number(value(t, 'OutlineLevel')), name = value(t, 'Name');
      if (value(t, 'IsNull') === '1' || !name || level === 0) { skipped++; continue; }
      if (!Number.isInteger(level) || level < 1) throw new Error('OutlineLevel invalido: ' + name);
      const uid = value(t, 'UID');
      if (!uid || seen.has(uid)) throw new Error('UID ausente o duplicado: ' + (uid || name));
      seen.add(uid);
      const pct = Number(value(t, 'PercentComplete') || 0);
      rows.push({ uid, level, name, summary: value(t, 'Summary') === '1', milestone: value(t, 'Milestone') === '1',
        inicio: fecha(value(t, 'Start')), fin: fecha(value(t, 'Finish')), actual: fecha(value(t, 'ActualFinish')),
        pct: Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)), notes: value(t, 'Notes'),
        prioridad: prioDeMsp(Number(value(t, 'Priority') || 500)), responsable: [...new Set(assigned.get(uid) || [])].join(', '), wbs: value(t, 'WBS') });
    }
    if (!rows.length) throw new Error('No hay actividades importables.');
    const base = Math.min(...rows.map(t => t.level)), proyectos = [], tareas = [], stack = [];
    let current = null, summaries = 0;
    const proyecto = async row => {
      const p = { id: await stable(source, 'p', row.uid), nombre: row.name, inicio: row.inicio, fin: row.fin, descripcion: row.notes,
        hitos: [], projectOrigen: { source, uid: row.uid, guid, tipo: 'MSPDI' } };
      proyectos.push(p); return p;
    };
    for (const row of rows) {
      while (stack.length && stack[stack.length - 1].level >= row.level) stack.pop();
      if (row.level === base) current = null;
      if (row.summary && row.level === base) { current = await proyecto(row); stack.push(row); continue; }
      if (!current) current = await proyecto({ uid: '$project', name: value(root, 'Title') || value(root, 'Name') || 'Proyecto importado', inicio: fecha(value(root, 'StartDate')), fin: fecha(value(root, 'FinishDate')), notes: '' });
      if (row.summary) { summaries++; stack.push(row); continue; }
      const ruta = stack.map(x => x.name), origen = { source, uid: row.uid, guid, tipo: 'MSPDI', ruta, wbs: row.wbs, porcentaje: row.pct };
      if (row.milestone) {
        current.hitos.push({ id: await stable(source, 'h', row.uid), nombre: row.name, fecha: row.inicio || row.fin, hecho: row.pct >= 100, projectOrigen: origen });
      } else {
        tareas.push({ id: await stable(source, 't', row.uid), titulo: row.name, proyectoId: current.id,
          descripcion: [row.notes, ruta.length ? 'Ruta de Project: ' + ruta.join(' > ') : ''].filter(Boolean).join('\n\n'),
          inicio: row.inicio, vence: row.fin, prioridad: row.prioridad, responsable: row.responsable,
          estado: resolverEstado('', row.pct), completada: row.pct >= 100 ? row.actual || row.fin || HOY() : null,
          projectOrigen: origen });
      }
    }
    // Los planes planos sin tarea resumen comparten un solo proyecto implicito.
    const unique = new Map();
    for (const p of proyectos) {
      if (unique.has(p.id)) unique.get(p.id).hitos.push(...p.hitos);
      else unique.set(p.id, p);
    }
    return { source, proyectos: [...unique.values()], tareas, resumenes: summaries, omitidos: skipped, totalXML: nodes.length };
  }
  function preview(d) {
    const out = { proyectosNuevos: 0, proyectosActualizados: 0, tareasNuevas: 0, tareasActualizadas: 0, hitosNuevos: 0, hitosActualizados: 0 };
    for (const p of d.proyectos) {
      const ex = Store.proy(p.id); out[ex ? 'proyectosActualizados' : 'proyectosNuevos']++;
      for (const h of p.hitos) out[ex?.hitos?.some(x => x.id === h.id) ? 'hitosActualizados' : 'hitosNuevos']++;
    }
    for (const t of d.tareas) out[Store.tarea(t.id) ? 'tareasActualizadas' : 'tareasNuevas']++;
    return out;
  }
  async function apply(d, progress = () => {}) {
    await Store.require();
    const stats = { proyectosGuardados: 0, tareasCreadas: 0, tareasActualizadas: 0, hitosProcesados: 0, tareasVerificadas: 0, errores: [] };
    const backup = { fecha: new Date().toISOString(), origen: d.source,
      proyectos: d.proyectos.map(p => Store.proy(p.id)).filter(Boolean), tareas: d.tareas.map(t => Store.tarea(t.id)).filter(Boolean) };
    if (backup.proyectos.length || backup.tareas.length) await FS.writeJson('data/respaldos/project-' + Date.now() + '-' + uid('b') + '.json', backup);
    const failedProjects = new Set(); let processed = 0;
    for (const dp of d.proyectos) {
      try {
        const old = Store.proy(dp.id), p = old ? clone(old) : normProy({ id: dp.id });
        Object.assign(p, { nombre: dp.nombre, inicio: dp.inicio, fin: dp.fin, descripcion: dp.descripcion, projectOrigen: dp.projectOrigen, modificado: new Date().toISOString() });
        for (const h of dp.hitos) { const i = p.hitos.findIndex(x => x.id === h.id); if (i < 0) p.hitos.push(h); else p.hitos[i] = h; }
        await FS.writeJson(DIR_PROY + '/' + p.id + '.json', p);
        const i = Store.proyectos.findIndex(x => x.id === p.id); if (i < 0) Store.proyectos.push(p); else Store.proyectos[i] = p;
        stats.proyectosGuardados++; stats.hitosProcesados += dp.hitos.length;
      } catch (e) { failedProjects.add(dp.id); stats.errores.push({ tipo: 'proyecto', id: dp.id, error: e.message }); }
    }
    for (const dt of d.tareas) {
      if (failedProjects.has(dt.proyectoId)) { stats.errores.push({ tipo: 'tarea', uid: dt.projectOrigen.uid, error: 'No se pudo guardar el proyecto padre.' }); processed++; progress(processed, d.tareas.length); continue; }
      try {
        const old = Store.tarea(dt.id), t = old ? clone(old) : normTarea({ id: dt.id, orden: Store.tareas.length });
        Object.assign(t, dt, { modificada: new Date().toISOString() });
        await FS.writeJson(DIR_TAR + '/' + t.id + '.json', t);
        const i = Store.tareas.findIndex(x => x.id === t.id); if (i < 0) Store.tareas.push(t); else Store.tareas[i] = t;
        stats[old ? 'tareasActualizadas' : 'tareasCreadas']++;
      } catch (e) { stats.errores.push({ tipo: 'tarea', uid: dt.projectOrigen.uid, error: e.message }); }
      processed++; progress(processed, d.tareas.length);
      if (processed % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    for (const dt of d.tareas) {
      try {
        const t = await FS.readJson(DIR_TAR + '/' + dt.id + '.json');
        if (Object.keys(dt).every(k => JSON.stringify(t[k]) === JSON.stringify(dt[k]))) stats.tareasVerificadas++;
        else throw new Error('Datos guardados no coinciden.');
      } catch (e) { stats.errores.push({ tipo: 'verificacion', uid: dt.projectOrigen.uid, error: e.message }); }
    }
    await Store.cache();
    await Store.log('importacion', 'Project UID: ' + stats.tareasCreadas + ' creadas, ' + stats.tareasActualizadas + ' actualizadas, ' + stats.errores.length + ' errores.');
    await Store.cache();
    return stats;
  }
  function report(d, stats) {
    const text = 'Importacion XML Project\nOrigen: ' + d.source + '\nTareas esperadas: ' + d.tareas.length + '\nCreadas: ' + stats.tareasCreadas + '\nActualizadas: ' + stats.tareasActualizadas + '\nVerificadas en disco: ' + stats.tareasVerificadas + '\nHitos procesados: ' + stats.hitosProcesados + '\nErrores: ' + stats.errores.length + '\n\n' + stats.errores.map(e => JSON.stringify(e)).join('\n');
    openModal('<h4>Resultado de importacion Project</h4><pre class="nota" style="max-height:55vh;overflow:auto">' + esc(text) + '</pre><p class="muted small">No se eliminan registros anteriores. Las cargas antiguas sin UID pueden seguir en otro proyecto. Este proceso permite recuperar una carga parcial al reintentar; no es una transaccion atomica.</p><div class="modal-foot"><button class="btn" id="projectReportDownload">Descargar informe</button><button class="btn primary" data-act="cerrar">Cerrar</button></div>');
    document.getElementById('projectReportDownload').onclick = () => descargarBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'importacion-project-' + HOY() + '.txt');
  }
  document.addEventListener('change', async e => {
    const input = e.target;
    if (busy && input.matches('input[type=file]')) { e.preventDefault(); e.stopImmediatePropagation(); input.value = ''; toast('Espera a que termine la importacion.', 'warn'); return; }
    if (input.id !== 'fileImpMsp') return;
    e.stopImmediatePropagation();
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    busy = true;
    let overlay;
    const warn = ev => { if (busy) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    try {
      await Store.require();
      const txt = await file.text(), doc = new DOMParser().parseFromString(txt, 'application/xml');
      let key = '';
      if (!doc.querySelector('parsererror') && !value(doc.documentElement, 'GUID')) {
        key = prompt('Este XML no tiene GUID. Escribe una clave unica y estable para este plan. Reutilizala al actualizarlo (no uses el nombre de version del archivo).', value(doc.documentElement, 'Title') || '');
        if (key === null) return;
      }
      const d = await parse(txt, key), p = preview(d);
      const msg = 'Se importaran ' + d.proyectos.length + ' proyectos, ' + d.tareas.length + ' tareas y ' + d.proyectos.reduce((n,x) => n + x.hitos.length,0) + ' hitos.\nTareas nuevas: ' + p.tareasNuevas + '; actualizadas: ' + p.tareasActualizadas + '.\nFases/subfases conservadas como ruta: ' + d.resumenes + '.\n\nSe identifica por GUID de origen + UID, nunca por titulo. No se borran cargas antiguas; las que no tienen UID permanecen separadas. Se respaldan los registros afectados antes de actualizarlos.\n\nContinuar?';
      if (!confirm(msg)) return;
      overlay = document.createElement('div'); overlay.className = 'modal-ov'; overlay.style.zIndex = '150';
      overlay.innerHTML = '<div class="modal-box"><h4>Importando Project</h4><p id="projectProgress">Preparando archivos...</p><p>No cierres la pagina.</p></div>';
      document.body.appendChild(overlay);
      const stats = await apply(d, (n,total) => { overlay.querySelector('#projectProgress').textContent = n + ' / ' + total + ' tareas procesadas'; });
      refrescar(); report(d, stats);
    } catch (err) {
      console.error(err); toast('Importacion detenida: ' + err.message + '. Puede haber registros guardados; reimportar con el mismo origen y UID no los duplica.', 'err');
    } finally {
      overlay?.remove(); busy = false; window.removeEventListener('beforeunload', warn);
    }
  }, true);
  window.ProjectImportV5 = { parse, preview, apply, get busy() { return busy; } };
})();
