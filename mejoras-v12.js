/* v12: Gantt con tareas vencidas en rojo y tareas de proyecto desplegables.
   Cargar después de app.js. */
'use strict';

function vProyecto(params) {
  const p = Store.proy(params.get('id'));
  if (!p) { app().innerHTML = '<div class="empty">Proyecto no encontrado.</div>'; return; }
  const a = avance(p.id), ts = Store.tareas.filter(t => t.proyectoId === p.id);
  const hitos = (p.hitos || []).slice().sort((x, y) => x.fecha.localeCompare(y.fecha));
  const notas = (p.notas || []).slice().sort((x, y) => y.fecha.localeCompare(x.fecha));
  app().innerHTML = '<div class="page-head"><div><h3><span class="dot" style="background:' + esc(p.color) + '"></span> ' + esc(p.nombre) + '</h3><div class="muted small">' + esc(p.estado) + (p.responsable ? ' · ' + esc(p.responsable) : '') + (p.inicio ? ' · ' + fmtF(p.inicio) : '') + (p.fin ? ' → ' + fmtF(p.fin) : '') + '</div></div>' +
    '<div class="filters"><a class="btn" href="#tablero?proyecto=' + p.id + '">Tablero</a><a class="btn" href="#gantt?proyecto=' + p.id + '">Gantt</a><button class="btn" data-act="proy-editar" data-id="' + p.id + '">Editar</button><button class="btn danger" data-act="proy-del" data-id="' + p.id + '">Eliminar</button></div></div>' +
    '<div class="card" style="margin-bottom:14px">' + (p.descripcion ? '<p class="nota" style="margin-top:0">' + esc(p.descripcion) + '</p>' : '') + '<div class="bar"><span style="width:' + a.pct + '%"></span></div><div class="small muted" style="margin-top:6px">' + a.hechas + ' de ' + a.total + ' tareas terminadas · ' + a.pct + '%</div></div>' +
    '<div class="grid g2"><div style="display:flex;flex-direction:column;gap:14px">' +
    '<div class="card"><div class="list-item" style="border:0;padding-top:0"><h4 style="margin:0">Hitos</h4></div>' +
    (hitos.map(h => '<div class="list-item"><label><input type="checkbox" data-hito="' + h.id + '" data-proy="' + p.id + '"' + (h.hecho ? ' checked' : '') + '><span class="' + (h.hecho ? 'done-txt' : '') + '">' + esc(h.nombre) + '</span></label><span class="small">' + fmtF(h.fecha) + ' <button class="btn sm danger" data-act="hito-del" data-id="' + h.id + '" data-proy="' + p.id + '">×</button></span></div>').join('') || '<div class="muted small">Sin hitos</div>') +
    '<div class="filters" style="margin-top:8px"><input id="hitoNombre" placeholder="Nuevo hito"><input id="hitoFecha" type="date"><button class="btn" data-act="hito-add" data-proy="' + p.id + '">Agregar</button></div></div>' +
    '<div class="card"><h4 style="margin-top:0">Notas del proyecto</h4>' + notaForm(p.id) + '<div style="margin-top:10px">' + (notas.map(n => notaHtml({ ...n, proyectoId: p.id })).join('') || '<div class="muted small">Sin notas</div>') + '</div></div>' +
    '<div class="card"><h4 style="margin-top:0">Adjuntos del proyecto</h4>' + ((p.adjuntos || []).map((x, i) => '<div class="list-item"><span>' + esc(x.nombre) + '</span><span class="muted small">' + fmtBytes(x.size) + '</span><button class="btn sm" data-act="ad-dl-proy" data-id="' + p.id + '" data-i="' + i + '">⬇</button></div>').join('') || '<div class="muted small">Sin adjuntos; agrégalos desde Editar.</div>') + '</div></div>' +
    '<details class="card" id="proyTareasBox"><summary style="cursor:pointer"><div class="list-item" style="border:0;padding-top:0"><h4 style="margin:0">Tareas (' + ts.length + ')</h4><span class="muted small">' + a.hechas + '/' + a.total + ' terminadas</span></div></summary>' +
    '<div class="list-item" style="border:0;padding:8px 0 0;justify-content:flex-end"><button class="btn sm primary" data-act="tarea-nueva" data-proy="' + p.id + '">＋ Tarea</button></div>' +
    Store.config.columnas.map(c => { const l = ts.filter(t => t.estado === c.id); return l.length ? '<div class="side-title" style="margin-top:8px">' + esc(c.nombre) + ' (' + l.length + ')</div>' + l.map(t => '<div class="list-item"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '" class="' + (t.archivada ? 'done-txt' : '') + '">' + esc(t.titulo) + '</a>' + (t.archivada ? '' : '<span class="small">' + chipPrio(t.prioridad) + ' ' + vencInfo(t) + '</span>') + '</div>').join('') : ''; }).join('') +
    (ts.length ? '' : '<div class="empty">Sin tareas</div>') + '</details></div></div>';
}

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
  for (let i = 0; i < dias; i++) { const d = parseD(addDays(ini, i)); if (i === 0 || d.getDate() === 1) meses += '<span style="left:' + i * W + 'px">' + d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) + '</span>'; if (W >= 24) dlab += '<span style="left:' + (i * W + W / 3) + 'px">' + d.getDate() + '</span>'; else if (W >= 10 && d.getDay() === 1) dlab += '<span style="left:' + i * W + 'px">' + d.getDate() + '</span>'; }
  const track = inner => '<div class="g-track" style="width:' + ancho + 'px;background-size:' + W + 'px 100%"><div class="g-today" style="left:' + (off(hoy) + W / 2) + 'px"></div>' + inner + '</div>';
  let filas = '', sinFecha = 0;
  grupos.forEach(g => {
    const p = g.p, color = p ? p.color : '#94a3b8';
    const vencidas = g.ts.filter(t => !Store.esTerminal(t.estado) && t.vence && t.vence < hoy).length;
    let pi = p && p.inicio, pf = p && p.fin;
    if (p && !pi && !pf) { const rs = g.ts.map(rango).filter(Boolean); if (rs.length) { pi = pi || rs.map(r => r[0]).sort()[0]; pf = pf || rs.map(r => r[1]).sort().pop(); } }
    let inner = '';
    if (pi && pf) { const a = avance(p.id); inner += '<div class="g-bar pbar" style="--bc:' + esc(color) + ';left:' + off(pi) + 'px;width:' + (diffDays(pi, pf) + 1) * W + 'px" title="' + esc(p.nombre) + ' ' + a.pct + '%' + (vencidas ? ' · ' + vencidas + ' vencidas' : '') + '"><div class="prog" style="width:' + a.pct + '%' + (vencidas ? ';background:#dc2626' : '') + '"></div></div>'; }
    if (p) (p.hitos || []).forEach(h => { const x = off(h.fecha) + W / 2 - 7; inner += '<div class="g-ms' + (h.hecho ? ' hecho' : '') + '" style="left:' + x + 'px" title="' + esc(h.nombre) + ' ' + fmtF(h.fecha) + '">◆</div><div class="g-mslabel" style="left:' + (x + 18) + 'px">' + esc(h.nombre) + '</div>'; });
    filas += '<div class="g-row"><div class="g-label proj" title="' + esc(p ? p.nombre : 'Sin proyecto') + '"><span class="dot" style="background:' + esc(color) + '"></span>' + esc(p ? p.nombre : 'Sin proyecto') + '</div>' + track(inner) + '</div>';
    g.ts.slice().sort((a, b) => (a.inicio || a.vence || 'z').localeCompare(b.inicio || b.vence || 'z')).forEach(t => {
      const r = rango(t); let inner2 = '';
      if (r) { const done = Store.esTerminal(t.estado), late = !done && t.vence && t.vence < hoy; inner2 += '<div class="g-bar ' + (done ? 'done' : late ? 'late' : '') + '" data-act="tarea-abrir" data-id="' + t.id + '" style="--bc:' + (late ? '#dc2626' : esc(color)) + ';left:' + off(r[0]) + 'px;width:' + (diffDays(r[0], r[1]) + 1) * W + 'px" title="' + esc(t.titulo) + ' ' + fmtF(r[0]) + ' → ' + fmtF(r[1]) + (late ? ' · VENCIDA' : '') + '"></div>'; } else sinFecha++;
      filas += '<div class="g-row"><div class="g-label" title="' + esc(t.titulo) + '"><a href="#" data-act="tarea-abrir" data-id="' + t.id + '" style="color:inherit">' + esc(t.titulo) + '</a>' + (r ? '' : '<span class="muted small">sin fechas</span>') + '</div>' + track(inner2) + '</div>';
    });
  });
  app().innerHTML = '<div class="page-head"><h3>Gantt</h3><div class="filters"><select data-gantt="proyecto">' + opcionesProy(GANTT.proyecto, 'Todos los proyectos') + '</select><select data-gantt="dw"><option value="28"' + (W === 28 ? ' selected' : '') + '>Día</option><option value="12"' + (W === 12 ? ' selected' : '') + '>Semana</option><option value="4"' + (W === 4 ? ' selected' : '') + '>Mes</option></select></div></div>' +
    (grupos.length ? '<div class="gantt" id="ganttBox"><div class="g-head"><div class="g-row"><div class="g-label">Proyecto / Tarea</div><div style="width:' + ancho + 'px"><div class="g-months">' + meses + '</div><div class="g-days">' + dlab + '</div></div></div></div>' + filas + '</div><p class="muted small">Barras: tareas con fecha de inicio y/o vencimiento. Las tareas vencidas se muestran en rojo. Barra delgada: proyecto con su avance; se pinta en rojo si tiene tareas vencidas. ◆ hito (verde = cumplido). Línea roja = hoy.' + (sinFecha ? ' ' + sinFecha + ' tareas sin fechas no tienen barra.' : '') + '</p>' : '<div class="empty">No hay proyectos ni tareas para mostrar.</div>');
  const box = $('#ganttBox'); if (box) box.scrollLeft = Math.max(0, off(hoy) - 150);
}
