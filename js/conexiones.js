/* ---------- Conexiones (Administración) ---------- */
/* Datos en data/conexiones.json. AVISO: los valores (incluidos passwords) se guardan en texto plano en tu carpeta. */
function conexionesBase() {
  const T = (id, nombre, icono, campos) => ({ id, nombre, icono, campos: campos.map((c, i) => ({ id: id + '_' + i, ...c })) });
  const tx = (etiqueta, extra = {}) => ({ etiqueta, tipo: 'texto', obligatorio: false, opciones: [], ...extra });
  const sec = ['Ninguna', 'SSL/TLS', 'STARTTLS', 'SSH', 'Wallet', 'OAuth2', 'Basic', 'API Key'];
  return {
    tipos: [
      T('bd', 'Base de datos', '🗄️', [tx('Host', { obligatorio: true }), tx('Puerto', { tipo: 'numero' }), tx('Servicio / Base de datos'), tx('Usuario'), tx('Password', { tipo: 'secreto' }), tx('Seguridad', { tipo: 'lista', opciones: sec.slice(0, 5) }), tx('Cadena de conexión', { tipo: 'textoLargo' })]),
      T('api', 'API REST', '🔌', [tx('URL base', { tipo: 'url', obligatorio: true }), tx('Autenticación', { tipo: 'lista', opciones: ['Ninguna', 'Basic', 'Bearer/JWT', 'OAuth2', 'API Key'] }), tx('Usuario / Client ID'), tx('Password / Client Secret', { tipo: 'secreto' }), tx('Token URL', { tipo: 'url' }), tx('Scope')]),
      T('sftp', 'SFTP / FTP', '📁', [tx('Host', { obligatorio: true }), tx('Puerto', { tipo: 'numero' }), tx('Seguridad', { tipo: 'lista', opciones: ['FTP', 'FTPS', 'SFTP'] }), tx('Usuario'), tx('Password', { tipo: 'secreto' }), tx('Ruta remota'), tx('Llave privada', { tipo: 'textoLargo' })]),
      T('cloud', 'Nube (OCI / AWS / Azure)', '☁️', [tx('Región'), tx('Tenancy / Cuenta'), tx('Usuario OCID / Access Key'), tx('Fingerprint'), tx('Compartment / Resource Group'), tx('Llave privada / Secret', { tipo: 'secreto' })]),
      T('smtp', 'Correo (SMTP)', '✉️', [tx('Host', { obligatorio: true }), tx('Puerto', { tipo: 'numero' }), tx('Seguridad', { tipo: 'lista', opciones: ['Ninguna', 'SSL/TLS', 'STARTTLS'] }), tx('Usuario'), tx('Password', { tipo: 'secreto' }), tx('Remitente')])
    ],
    items: []
  };
}
function normConexiones(c) { const b = conexionesBase(); return c && Array.isArray(c.tipos) ? { tipos: c.tipos, items: c.items || [] } : b; }
Store.saveConexiones = async function () { await this.require(); await FS.writeJson(DIR_DATA + '/conexiones.json', this.conexiones); await this.cache(); };
const ENTORNOS = ['Desarrollo', 'QA', 'Pruebas', 'Producción', 'Otro'];
const CON_FILTRO = { tipo: '', q: '' };
const tipoCon = id => Store.conexiones.tipos.find(t => t.id === id);
const MASK = '••••••••';

function conCardHtml(c) {
  const t = tipoCon(c.tipoId); if (!t) return '';
  const filas = t.campos.map(f => {
    const v = c.valores[f.id]; if (v === undefined || v === '' || v === false) return '';
    let cuerpo;
    if (f.tipo === 'secreto') cuerpo = '<span class="cv" data-mask="1">' + MASK + '</span> <button class="btn sm" data-act="con-ver" data-id="' + c.id + '" data-f="' + f.id + '" title="Mostrar/ocultar">👁</button>';
    else if (f.tipo === 'checkbox') cuerpo = '<span>✔ Sí</span>';
    else if (f.tipo === 'textoLargo') cuerpo = '<pre class="nota small" style="margin:0;max-height:90px;overflow:auto">' + esc(v) + '</pre>';
    else if (f.tipo === 'url') cuerpo = '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + '</a>';
    else cuerpo = '<span>' + esc(v) + '</span>';
    return '<div class="list-item" style="padding:5px 0"><span class="muted small" style="min-width:110px">' + esc(f.etiqueta) + '</span><span style="flex:1;word-break:break-all">' + cuerpo + '</span>' + (f.tipo === 'checkbox' ? '' : '<button class="btn sm" data-act="con-copiar" data-id="' + c.id + '" data-f="' + f.id + '" title="Copiar">📋</button>') + '</div>';
  }).join('');
  return '<div class="card"><div class="list-item" style="border:0;padding-top:0"><b>' + esc(t.icono) + ' ' + esc(c.nombre) + '</b><span>' + (c.entorno ? '<span class="chip ' + (c.entorno === 'Producción' ? 'prio-critica' : 'prio-media') + '">' + esc(c.entorno) + '</span> ' : '') + '<span class="chip out">' + esc(t.nombre) + '</span></span></div>' +
    (filas || '<div class="muted small">Sin valores capturados</div>') + (c.notas ? '<div class="small muted nota" style="margin-top:6px">' + esc(c.notas) + '</div>' : '') +
    '<div class="filters" style="margin-top:8px"><button class="btn sm" data-act="con-editar" data-id="' + c.id + '">✏️ Editar</button><button class="btn sm" data-act="con-dup" data-id="' + c.id + '">Duplicar</button><button class="btn sm danger" data-act="con-del" data-id="' + c.id + '">Eliminar</button></div></div>';
}
function conLista() {
  const q = CON_FILTRO.q.toLowerCase();
  const l = Store.conexiones.items.filter(c => (!CON_FILTRO.tipo || c.tipoId === CON_FILTRO.tipo) && (!q || (c.nombre + ' ' + Object.entries(c.valores).filter(([k]) => { const f = (tipoCon(c.tipoId)?.campos || []).find(x => x.id === k); return f && f.tipo !== 'secreto'; }).map(([, v]) => v).join(' ')).toLowerCase().includes(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return l.length ? '<div class="grid g2">' + l.map(conCardHtml).join('') + '</div>' : '<div class="empty">Sin conexiones. Crea la primera con "＋ Nueva conexión".</div>';
}
function vConexiones() {
  app().innerHTML = '<div class="page-head"><h3>Conexiones</h3><div class="filters"><select data-conf="tipo"><option value="">Todos los tipos</option>' + Store.conexiones.tipos.map(t => '<option value="' + t.id + '"' + (t.id === CON_FILTRO.tipo ? ' selected' : '') + '>' + esc(t.icono + ' ' + t.nombre) + '</option>').join('') + '</select>' +
    '<input data-conf="q" placeholder="Buscar…" value="' + esc(CON_FILTRO.q) + '"><button class="btn" data-act="con-tipos">⚙ Tipos y campos</button><button class="btn primary" data-act="con-nueva">＋ Nueva conexión</button></div></div>' +
    '<div class="banner" style="background:var(--col);color:var(--text);border-color:var(--border)">🔒 Los valores, incluidos los passwords, se guardan en texto plano en <code>data/conexiones.json</code>. Protege la carpeta y evita subirla a repositorios o correos.</div><div id="conLista">' + conLista() + '</div>';
}
function conCamposHtml() {
  const t = tipoCon(M.obj.tipoId); if (!t) return '';
  return t.campos.map(f => {
    const v = M.obj.valores[f.id] ?? '', a = 'data-f="' + f.id + '"', et = esc(f.etiqueta) + (f.obligatorio ? ' *' : '');
    if (f.tipo === 'lista') return '<div><label>' + et + '</label><select ' + a + '><option value=""></option>' + (f.opciones || []).map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
    if (f.tipo === 'checkbox') return '<div><label>' + et + '</label><input type="checkbox" ' + a + (v ? ' checked' : '') + ' style="width:auto"></div>';
    if (f.tipo === 'textoLargo') return '<div class="full"><label>' + et + '</label><textarea rows="3" ' + a + '>' + esc(v) + '</textarea></div>';
    if (f.tipo === 'secreto') return '<div><label>' + et + '</label><input type="password" autocomplete="new-password" ' + a + ' value="' + esc(v) + '"></div>';
    return '<div><label>' + et + '</label><input type="' + (f.tipo === 'numero' ? 'number' : f.tipo === 'url' ? 'url' : 'text') + '" ' + a + ' value="' + esc(v) + '"></div>';
  }).join('');
}
function syncCon() {
  $$('#mForm [name]').forEach(el => { M.obj[el.name] = el.value; });
  $$('#mForm [data-f]').forEach(el => { M.obj.valores[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
}
function abrirConexion(id, copia) {
  const ex = id ? Store.conexiones.items.find(c => c.id === id) : null;
  const c = ex ? clone(ex) : { id: uid('cx'), nombre: '', tipoId: CON_FILTRO.tipo || Store.conexiones.tipos[0]?.id || '', entorno: '', valores: {}, notas: '' };
  if (copia) { c.id = uid('cx'); c.nombre += ' (copia)'; }
  M = { tipo: 'conexion', obj: c, nuevo: !ex || copia };
  const box = openModal('<h4>' + (M.nuevo ? 'Nueva conexión' : 'Editar conexión') + '</h4><form id="mForm" class="form-grid"><div class="full"><label>Nombre *</label><input name="nombre" value="' + esc(c.nombre) + '"></div>' +
    '<div><label>Tipo</label><select name="tipoId" data-contipo="1">' + Store.conexiones.tipos.map(t => '<option value="' + t.id + '"' + (t.id === c.tipoId ? ' selected' : '') + '>' + esc(t.icono + ' ' + t.nombre) + '</option>').join('') + '</select></div>' +
    '<div><label>Entorno</label><select name="entorno"><option value=""></option>' + ENTORNOS.map(e => '<option' + (e === c.entorno ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></div>' +
    '<div class="full form-grid" id="conCampos" style="padding:0">' + conCamposHtml() + '</div><div class="full"><label>Notas</label><textarea name="notas" rows="2">' + esc(c.notas) + '</textarea></div></form>' +
    '<div class="modal-foot"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" data-act="con-guardar">Guardar</button></div>');
  $('[name=nombre]', box).focus();
}

/* editor de tipos y campos */
let CT = null, CT_SEL = 0;
const TIPOS_CAMPO = { texto: 'Texto corto', numero: 'Número', lista: 'Lista desplegable', secreto: 'Secreto (password)', url: 'URL', textoLargo: 'Texto largo', checkbox: 'Casilla' };
function leerTiposDOM() {
  if (!CT) return; const t = CT[CT_SEL]; if (!t || !$('#ctNombre')) return;
  t.nombre = $('#ctNombre').value.trim(); t.icono = $('#ctIcono').value.trim() || '🔗';
  t.campos = $$('#ctCampos tbody tr').map(tr => ({ id: tr.dataset.fid, etiqueta: $('.f-e', tr).value.trim(), tipo: $('.f-t', tr).value, opciones: $('.f-o', tr).value.split(',').map(s => s.trim()).filter(Boolean), obligatorio: $('.f-r', tr).checked }));
}
function pintarTipos() {
  const t = CT[CT_SEL];
  $('#ctBody').innerHTML = '<div class="filters" style="margin-bottom:10px"><select id="ctSel">' + CT.map((x, i) => '<option value="' + i + '"' + (i === CT_SEL ? ' selected' : '') + '>' + esc(x.icono + ' ' + x.nombre) + '</option>').join('') + '</select><button class="btn sm" data-act="ct-nuevo">＋ Nuevo tipo</button><button class="btn sm danger" data-act="ct-del">Eliminar tipo</button></div>' +
    '<div class="filters" style="margin-bottom:10px"><input id="ctNombre" placeholder="Nombre del tipo" value="' + esc(t.nombre) + '"><input id="ctIcono" style="width:70px" maxlength="4" value="' + esc(t.icono) + '"></div>' +
    '<table id="ctCampos"><thead><tr><th>Campo</th><th>Tipo</th><th>Opciones (lista)</th><th>Oblig.</th><th></th></tr></thead><tbody>' + t.campos.map((f, i) => '<tr data-fid="' + f.id + '"><td><input class="f-e" value="' + esc(f.etiqueta) + '"></td><td><select class="f-t">' + Object.entries(TIPOS_CAMPO).map(([k, v]) => '<option value="' + k + '"' + (k === f.tipo ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></td><td><input class="f-o" value="' + esc((f.opciones || []).join(', ')) + '" placeholder="a, b, c"></td><td><input type="checkbox" class="f-r"' + (f.obligatorio ? ' checked' : '') + '></td><td style="white-space:nowrap"><button class="btn sm" data-act="cf-up" data-i="' + i + '">↑</button> <button class="btn sm" data-act="cf-down" data-i="' + i + '">↓</button> <button class="btn sm danger" data-act="cf-del" data-i="' + i + '">✕</button></td></tr>').join('') + '</tbody></table>' +
    '<button class="btn sm" style="margin-top:8px" data-act="cf-add">＋ Agregar campo</button>';
}
function abrirTipos() {
  CT = clone(Store.conexiones.tipos); CT_SEL = 0; M = { tipo: 'tipos', obj: {} };
  openModal('<h4>Tipos de conexión y campos</h4><p class="muted small" style="margin-top:0">Define qué campos lleva cada tipo (host, puerto, región, etc.). Los campos de tipo "Secreto" se muestran enmascarados.</p><div id="ctBody"></div><div class="modal-foot"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" data-act="ct-guardar">Guardar cambios</button></div>', true);
  pintarTipos();
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.contipo && M && M.tipo === 'conexion') { syncCon(); M.obj.tipoId = t.value; $('#conCampos').innerHTML = conCamposHtml(); }
  else if (t.id === 'ctSel' && CT) { leerTiposDOM(); CT_SEL = +t.value; pintarTipos(); }
  else if (t.classList && t.classList.contains('f-t')) { /* sin acción: las opciones solo se usan si es lista */ }
  else if (t.dataset.conf === 'tipo') { CON_FILTRO.tipo = t.value; $('#conLista').innerHTML = conLista(); }
});
document.addEventListener('input', e => { if (e.target.dataset.conf === 'q') { CON_FILTRO.q = e.target.value; $('#conLista').innerHTML = conLista(); } });
async function copiarTxt(v) {
  try { await navigator.clipboard.writeText(v); } catch (e) { const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Copiado al portapapeles.');
}
const valCon = (id, f) => Store.conexiones.items.find(c => c.id === id).valores[f];
Object.assign(ACTIONS, {
  'con-nueva': () => abrirConexion(null),
  'con-editar': b => abrirConexion(b.dataset.id),
  'con-dup': b => abrirConexion(b.dataset.id, true),
  'con-tipos': () => abrirTipos(),
  'con-ver'(b) {
    const s = b.parentElement.querySelector('.cv'); if (s.dataset.mask === '1') { s.textContent = valCon(b.dataset.id, b.dataset.f); s.dataset.mask = '0'; } else { s.textContent = MASK; s.dataset.mask = '1'; }
  },
  'con-copiar': b => copiarTxt(String(valCon(b.dataset.id, b.dataset.f))),
  async 'con-guardar'() {
    syncCon(); const c = M.obj, t = tipoCon(c.tipoId);
    if (!c.nombre.trim()) return toast('El nombre es obligatorio.', 'warn');
    if (!t) return toast('Elige un tipo.', 'warn');
    const falta = t.campos.find(f => f.obligatorio && (c.valores[f.id] === undefined || c.valores[f.id] === '' || c.valores[f.id] === false));
    if (falta) return toast('Falta el campo "' + falta.etiqueta + '".', 'warn');
    c.nombre = c.nombre.trim(); c.modificada = new Date().toISOString(); c.creada = c.creada || c.modificada;
    const l = Store.conexiones.items, i = l.findIndex(x => x.id === c.id); if (i >= 0) l[i] = c; else l.push(c);
    await Store.saveConexiones(); closeModal(); toast('Conexión guardada.'); router();
  },
  async 'con-del'(b) {
    const c = Store.conexiones.items.find(x => x.id === b.dataset.id); if (!confirm('¿Eliminar la conexión "' + c.nombre + '"?')) return;
    Store.conexiones.items = Store.conexiones.items.filter(x => x.id !== c.id); await Store.saveConexiones(); router();
  },
  'ct-nuevo'() { leerTiposDOM(); CT.push({ id: 'tp_' + Date.now().toString(36), nombre: 'Nuevo tipo', icono: '🔗', campos: [{ id: 'f_' + uid('x'), etiqueta: 'Host', tipo: 'texto', opciones: [], obligatorio: false }] }); CT_SEL = CT.length - 1; pintarTipos(); },
  'ct-del'() {
    leerTiposDOM(); const t = CT[CT_SEL];
    if (Store.conexiones.items.some(c => c.tipoId === t.id)) return toast('Hay conexiones de este tipo. Elimínalas o cámbialas antes.', 'warn');
    if (CT.length === 1) return toast('Debe existir al menos un tipo.', 'warn');
    CT.splice(CT_SEL, 1); CT_SEL = 0; pintarTipos();
  },
  'cf-add'() { leerTiposDOM(); CT[CT_SEL].campos.push({ id: 'f_' + uid('x'), etiqueta: 'Nuevo campo', tipo: 'texto', opciones: [], obligatorio: false }); pintarTipos(); },
  'cf-up'(b) { leerTiposDOM(); const c = CT[CT_SEL].campos, i = +b.dataset.i; if (i > 0) [c[i - 1], c[i]] = [c[i], c[i - 1]]; pintarTipos(); },
  'cf-down'(b) { leerTiposDOM(); const c = CT[CT_SEL].campos, i = +b.dataset.i; if (i < c.length - 1) [c[i + 1], c[i]] = [c[i], c[i + 1]]; pintarTipos(); },
  'cf-del'(b) { leerTiposDOM(); CT[CT_SEL].campos.splice(+b.dataset.i, 1); pintarTipos(); },
  async 'ct-guardar'() {
    leerTiposDOM();
    if (CT.some(t => !t.nombre || t.campos.some(f => !f.etiqueta))) return toast('Cada tipo y cada campo necesitan nombre.', 'warn');
    const ids = new Set(CT.map(t => t.id)); if (Store.conexiones.items.some(c => !ids.has(c.tipoId))) return toast('Se intentó quitar un tipo en uso.', 'warn');
    Store.conexiones.tipos = CT;
    Store.conexiones.items.forEach(c => { const t = CT.find(x => x.id === c.tipoId), ok = new Set(t.campos.map(f => f.id)); Object.keys(c.valores).forEach(k => { if (!ok.has(k)) delete c.valores[k]; }); });
    await Store.saveConexiones(); closeModal(); toast('Tipos y campos guardados.'); router();
  }
});
RUTAS.conexiones = vConexiones;

