/* Control de Presupuesto - v2.8 (Copia a Excel corregida) */
(() => {
'use strict';

let PPT_STATE = { hoja: '', page: 0, limit: 25, search: '' };
let PPT_DATA = { archivo: '', fecha: '', hojas: [] };

async function cargarDatosPresupuesto() {
  try {
    if (!FS.ready) return;
    if (await FS.exists(DIR_DATA + '/presupuesto.json')) {
      PPT_DATA = await FS.readJson(DIR_DATA + '/presupuesto.json');
    }
  } catch (e) { console.warn('Error al cargar presupuesto:', e); }
}

async function vPresupuesto() {
  if (!FS.ready) {
    app().innerHTML = `
      <div class="page-head"><h3>Control de Presupuesto</h3></div>
      <div class="card empty" style="padding: 40px; text-align: center;">
        <h4 style="margin-top:0">Carpeta no conectada</h4>
        <p class="muted">Para guardar y leer el presupuesto, primero debes conectar la carpeta del proyecto.</p>
        <button class="btn primary" data-act="conectar" style="margin-top:10px;">Conectar carpeta</button>
      </div>`;
    return;
  }

  await cargarDatosPresupuesto();
  
  if (!PPT_DATA || !PPT_DATA.hojas || !PPT_DATA.hojas.length) {
    app().innerHTML = `
      <div class="page-head"><h3>Control de Presupuesto</h3></div>
      <div class="card empty" style="padding: 40px; text-align: center;">
        <h4 style="margin-top:0">No hay datos de presupuesto cargados</h4>
        <p class="muted">Sube un archivo Excel (.xlsx) para visualizar su contenido aquí.</p>
        <button class="btn primary" data-act="ppt-upload" style="margin-top:10px; font-size:16px; padding:10px 20px;">⬆ Cargar Excel</button>
      </div>`;
    return;
  }

  if (!PPT_STATE.hoja || !PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja)) {
    PPT_STATE.hoja = PPT_DATA.hojas[0].nombre;
  }

  const hojaActiva = PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja);
  const tabs = PPT_DATA.hojas.map(h => `<button class="btn ${h.nombre === PPT_STATE.hoja ? 'primary' : ''}" data-act="ppt-tab" data-tab="${esc(h.nombre)}">${esc(h.nombre)}</button>`).join('');

  app().innerHTML = `
    <div class="page-head">
      <div><h3>Control de Presupuesto</h3><div class="small muted">Archivo: ${esc(PPT_DATA.archivo)} · Cargado: ${fmtTs(PPT_DATA.fecha)}</div></div>
      <div class="filters">
        <button class="btn" data-act="ppt-calc-open" style="border-color: var(--primary); color: var(--primary); font-weight: 600;">🧮 Calculadora / Desglose</button>
        <button class="btn" data-act="ppt-copy-data" style="border-color: var(--ok); color: var(--ok);">📋 Copiar Datos</button>
        <button class="btn" data-act="ppt-upload">⬆ Actualizar</button>
        <button class="btn danger" data-act="ppt-clear">🗑 Eliminar</button>
      </div>
    </div>
    <div class="filters" style="margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:10px; overflow-x:auto; flex-wrap:nowrap;">${tabs}</div>
    <div class="card" style="padding:12px; margin-bottom:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
      <input placeholder="Buscar en todas las columnas..." data-ppt="q" value="${esc(PPT_STATE.search)}" style="flex:1; min-width:250px;">
      <label class="small muted">Filas por página:</label>
      <select data-ppt="limit">
        <option value="10"${PPT_STATE.limit===10?' selected':''}>10</option>
        <option value="25"${PPT_STATE.limit===25?' selected':''}>25</option>
        <option value="50"${PPT_STATE.limit===50?' selected':''}>50</option>
        <option value="100"${PPT_STATE.limit===100?' selected':''}>100</option>
      </select>
    </div>
    <div class="card" style="padding:0; overflow-x:auto;">
      <div id="pptTableWrap"></div>
    </div>
  `;
  renderTablaPresupuesto(hojaActiva);
}

function renderTablaPresupuesto(hoja) {
  if (!hoja) return;
  const q = PPT_STATE.search.toLowerCase();
  const filtradas = hoja.filas.filter(fila => {
    if (!q) return true;
    return fila.some(cell => String(cell).toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filtradas.length / PPT_STATE.limit) || 1;
  if (PPT_STATE.page >= totalPages) PPT_STATE.page = totalPages - 1;
  if (PPT_STATE.page < 0) PPT_STATE.page = 0;
  const start = PPT_STATE.page * PPT_STATE.limit;
  const pageRows = filtradas.slice(start, start + PPT_STATE.limit);

  const th = hoja.columnas.map(c => `<th>${esc(c)}</th>`).join('');
  const trs = pageRows.map(fila => `<tr>${fila.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');

  const html = `
    <table style="white-space:nowrap; min-width:100%;">
      <thead style="position:sticky; top:0; background:var(--card); z-index:10; box-shadow:0 1px 0 var(--border);"><tr>${th}</tr></thead>
      <tbody>${trs || '<tr><td colspan="'+hoja.columnas.length+'" class="empty">Sin resultados</td></tr>'}</tbody>
    </table>
    <div style="padding:10px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border);">
      <span class="small muted">Mostrando ${filtradas.length ? start + 1 : 0} - ${Math.min(start + PPT_STATE.limit, filtradas.length)} de ${filtradas.length}</span>
      <div class="filters">
        <button class="btn sm" data-act="ppt-prev" ${PPT_STATE.page === 0 ? 'disabled' : ''}>← Anterior</button>
        <span class="small muted">Pág. ${PPT_STATE.page + 1} / ${totalPages}</span>
        <button class="btn sm" data-act="ppt-next" ${PPT_STATE.page >= totalPages - 1 ? 'disabled' : ''}>Siguiente →</button>
      </div>
    </div>
  `;
  const wrap = document.getElementById('pptTableWrap');
  if (wrap) wrap.innerHTML = html;
}

// ============ UTILIDAD PARA COPIAR TABLAS ============
function copiarTablaHtmlAlPortapapeles(selector) {
  const table = document.querySelector(selector);
  if (!table) return toast('No hay tabla para copiar.', 'warn');
  
  const rows = table.querySelectorAll('tr');
  let tsv = '';
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    tsv += Array.from(cells).map(cell => {
      let text = cell.innerText.replace(/\n/g, ' ').trim();
      
      // Proteger contra interpretación de fórmulas en Excel
      if (text === '-' || /^[=+\-@]/.test(text)) {
        text = "'" + text;
      }
      return text;
    }).join('\t') + '\n';
  });

  navigator.clipboard.writeText(tsv).then(() => {
    toast('¡Copiado! Listo para pegar en Excel.');
  }).catch(err => {
    console.error(err);
    toast('Error al copiar al portapapeles.', 'err');
  });
}

// ============ CALCULADORA EN TIEMPO REAL ============
function abrirCalculadora() {
  if (!PPT_DATA || !PPT_DATA.hojas.length) return toast('Primero debes cargar un Excel.', 'warn');

  const style = `
    <style>
      .modal-box.wide { width: 95vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; }
      .calc-modal-body { flex: 1; overflow-y: auto; padding-right: 5px; }
      
      .calc-row-grid {
        display: grid;
        grid-template-columns: 40px 1.2fr 1fr 1fr 1fr 1fr 35px;
        gap: 6px;
        align-items: center;
        margin-bottom: 8px;
        background: var(--bg);
        padding: 6px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      .calc-row-grid select, .calc-row-grid button {
        width: 100%;
        margin: 0;
        padding: 6px;
        font-size: 12px;
      }
    </style>
  `;

  let html = `
    ${style}
    <h4>🧮 Calculadora y Desglose</h4>
    
    <div class="calc-modal-body">
      <p class="small muted">Los resultados se actualizan automáticamente al cambiar los filtros.</p>
      
      <div class="form-grid" style="margin-bottom: 15px; background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
        <div class="full">
          <label>Valor a buscar en los registros (Ej. S287)</label>
          <input id="calcFilterVal" placeholder="Escribe el valor aquí... (Dejar vacío para sumar todo)" style="width:100%; border: 2px solid var(--primary);">
        </div>
      </div>

      <div style="display:flex; margin-bottom:6px; padding:0 6px; font-size:11px; color:var(--muted); font-weight:bold; gap:6px;">
        <span style="width:40px">Op</span>
        <span style="flex:1.2">Pestaña</span>
        <span style="flex:1">Filtro</span>
        <span style="flex:1">Agrupar 1</span>
        <span style="flex:1">Agrupar 2</span>
        <span style="flex:1">Monto</span>
        <span style="width:35px"></span>
      </div>

      <div id="calcRows" style="margin-bottom: 15px;"></div>
      <button class="btn" id="calcAddRow" style="margin-bottom: 20px;">＋ Agregar Operación</button>

      <div id="calcResultWrap" style="margin-bottom: 20px;">
        <!-- Resultados aquí -->
      </div>
    </div>

    <div class="modal-foot" style="flex-shrink:0;">
      <button class="btn" style="border-color: var(--ok); color: var(--ok);" id="calcCopyBtn">📋 Copiar Resultados</button>
      <button class="btn primary" data-act="cerrar">Cerrar</button>
    </div>
  `;

  openModal(html, true);
  
  const rowsContainer = document.getElementById('calcRows');
  const addRowBtn = document.getElementById('calcAddRow');
  const filterInput = document.getElementById('calcFilterVal');
  const copyBtn = document.getElementById('calcCopyBtn');

  copyBtn.addEventListener('click', () => {
    copiarTablaHtmlAlPortapapeles('#calcResultWrap table');
  });

  function evaluarCalculadora() {
    const globalFilterVal = filterInput.value.trim().toLowerCase();
    const rows = [...rowsContainer.querySelectorAll('.calc-row-grid')];
    if (!rows.length) return;

    const opsMeta = rows.map((r, i) => ({
      op: i === 0 ? '+' : r.querySelector('.calc-op').value,
      sheetName: r.querySelector('.calc-sheet').value,
      valColName: r.querySelector('.calc-val-col').value
    }));

    const results = {};

    rows.forEach((r, i) => {
      const op = opsMeta[i].op;
      const sheetName = opsMeta[i].sheetName;
      const filterColName = r.querySelector('.calc-filter-col').value;
      const groupColName1 = r.querySelector('.calc-group-col-1').value;
      const groupColName2 = r.querySelector('.calc-group-col-2').value;
      const valColName = opsMeta[i].valColName;
      
      const hoja = PPT_DATA.hojas.find(h => h.nombre === sheetName);
      if(!hoja) return;

      const fIdx = hoja.columnas.indexOf(filterColName);
      const gIdx1 = hoja.columnas.indexOf(groupColName1);
      const gIdx2 = hoja.columnas.indexOf(groupColName2);
      const valIdx = hoja.columnas.indexOf(valColName);
      
      if (gIdx1 < 0 || valIdx < 0) return; 
      
      hoja.filas.forEach(f => {
        if (globalFilterVal && filterColName) {
          if (fIdx < 0) return; 
          const rowFilterVal = f[fIdx] ? String(f[fIdx]).toLowerCase() : '';
          if (!rowFilterVal.includes(globalFilterVal)) return; 
        }

        let gVal1 = f[gIdx1] ? String(f[gIdx1]).trim() : '(Sin valor)';
        let gVal = gVal1;
        if (gIdx2 >= 0) {
          let gVal2 = f[gIdx2] ? String(f[gIdx2]).trim() : '(Sin valor)';
          gVal = gVal1 + ' ➜ ' + gVal2;
        }
        
        let rawVal = f[valIdx];
        if (rawVal) {
          let cleanStr = String(rawVal).replace(/[^0-9.-]+/g, '');
          let num = parseFloat(cleanStr);
          
          if (!isNaN(num)) {
            if (!results[gVal]) {
              results[gVal] = {
                total: 0,
                sumaAgregados: 0, 
                breakdown: new Array(rows.length).fill(0)
              };
            }

            if (op === '+') {
              results[gVal].total += num;
              results[gVal].breakdown[i] += num;
            } else if (op === '-') {
              results[gVal].total -= num;
              results[gVal].breakdown[i] -= num;
            } else if (op === '*') {
              results[gVal].total = results[gVal].total === 0 ? num : results[gVal].total * num;
              results[gVal].breakdown[i] = num;
            } else if (op === '/') {
              results[gVal].total = num !== 0 ? results[gVal].total / num : 0;
              results[gVal].breakdown[i] = num;
            }

            if (i > 0) {
              if (op === '+') results[gVal].sumaAgregados += num;
              else if (op === '-') results[gVal].sumaAgregados -= num;
              else if (op === '*') results[gVal].sumaAgregados = results[gVal].sumaAgregados === 0 ? num : results[gVal].sumaAgregados * num;
              else if (op === '/') results[gVal].sumaAgregados = num !== 0 ? results[gVal].sumaAgregados / num : 0;
            }
          }
        }
      });
    });

    const sortedKeys = Object.keys(results).sort();
    if (!sortedKeys.length) {
      document.getElementById('calcResultWrap').innerHTML = '<div class="empty" style="padding:20px">No se encontraron datos que coincidan con los filtros.</div>';
      return;
    }

    let tableHtml = `
      <table style="width:100%; border-collapse: collapse; white-space: nowrap; font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border);">Grupo / Llave</th>
            ${opsMeta.map(m => `
              <th style="text-align:right; padding:8px; border-bottom:2px solid var(--border); color:var(--muted); font-weight:normal;">
                [${m.op}] ${esc(m.sheetName)}<br><span style="font-size:10px">(${esc(m.valColName)})</span>
              </th>
            `).join('')}
            <th style="text-align:right; padding:8px; border-bottom:2px solid var(--border); color:var(--primary); font-weight:bold; background:var(--bg);">Total Agregado</th>
            <th style="text-align:right; padding:8px; border-bottom:2px solid var(--border); border-left:1px solid var(--border); font-weight:bold;">Total Final</th>
          </tr>
        </thead>
        <tbody>
    `;

    let globalTotal = 0;
    let globalAgregados = 0;
    const globalBreakdown = new Array(rows.length).fill(0);

    sortedKeys.forEach(k => {
      const data = results[k];
      globalTotal += data.total;
      globalAgregados += data.sumaAgregados;
      
      const aggColor = data.sumaAgregados < 0 ? 'var(--danger)' : (data.sumaAgregados > 0 ? 'var(--ok)' : 'var(--text)');
      const totColor = data.total < 0 ? 'var(--danger)' : 'var(--ok)';

      tableHtml += `
        <tr>
          <td style="padding:8px; border-bottom:1px solid var(--border);"><b>${esc(k)}</b></td>
          ${data.breakdown.map((val, idx) => {
            globalBreakdown[idx] += val;
            const fmt = val.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
            return `<td style="text-align:right; padding:8px; border-bottom:1px solid var(--border); color:${val < 0 ? 'var(--danger)' : 'var(--text)'};">
              ${val !== 0 ? '$ '+fmt : '-'}
            </td>`;
          }).join('')}
          <td style="text-align:right; padding:8px; border-bottom:1px solid var(--border); color:${aggColor}; font-weight:bold; background:var(--bg);">
            $ ${data.sumaAgregados.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})}
          </td>
          <td style="text-align:right; padding:8px; border-bottom:1px solid var(--border); border-left:1px solid var(--border); color:${totColor}; font-weight:bold;">
            $ ${data.total.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})}
          </td>
        </tr>
      `;
    });

    const globalFmt = globalTotal.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
    const globalAgregadosFmt = globalAgregados.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
    
    tableHtml += `
        </tbody>
        <tfoot style="background:var(--col);">
          <tr>
            <td style="padding:12px 8px; font-weight:bold; border-top:2px solid var(--border);">TOTALES</td>
            ${globalBreakdown.map(val => `
              <td style="text-align:right; padding:12px 8px; font-weight:bold; border-top:2px solid var(--border); color:var(--muted);">
                $ ${val.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})}
              </td>
            `).join('')}
            <td style="text-align:right; padding:12px 8px; font-weight:bold; border-top:2px solid var(--border); background:var(--bg); color:var(--primary); font-size:16px;">
              $ ${globalAgregadosFmt}
            </td>
            <td style="text-align:right; padding:12px 8px; font-weight:bold; border-top:2px solid var(--border); border-left:1px solid var(--border); font-size:18px; color:var(--primary);">
              $ ${globalFmt}
            </td>
          </tr>
        </tfoot>
      </table>
    `;

    document.getElementById('calcResultWrap').innerHTML = tableHtml;
  }

  function addRow() {
    const row = document.createElement('div');
    row.className = 'calc-row-grid';
    
    const opSel = document.createElement('select');
    opSel.className = 'calc-op';
    ['+', '-', '*', '/'].forEach(op => {
      const opt = document.createElement('option');
      opt.value = op;
      opt.textContent = op;
      opSel.appendChild(opt);
    });

    const sheetSel = document.createElement('select');
    sheetSel.className = 'calc-sheet';
    PPT_DATA.hojas.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.nombre;
      opt.textContent = h.nombre;
      sheetSel.appendChild(opt);
    });

    const filterColSel = document.createElement('select');
    filterColSel.className = 'calc-filter-col';

    const groupColSel1 = document.createElement('select');
    groupColSel1.className = 'calc-group-col-1';

    const groupColSel2 = document.createElement('select');
    groupColSel2.className = 'calc-group-col-2';

    const valColSel = document.createElement('select');
    valColSel.className = 'calc-val-col';

    function updateCols() {
      filterColSel.innerHTML = '<option value="">(No filtrar)</option>';
      groupColSel1.innerHTML = '';
      groupColSel2.innerHTML = '<option value="">(No agrupar)</option>';
      valColSel.innerHTML = '';
      
      const h = PPT_DATA.hojas.find(x => x.nombre === sheetSel.value);
      if (h) {
        h.columnas.forEach((c) => {
          filterColSel.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
          groupColSel1.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
          groupColSel2.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
          valColSel.innerHTML += `<option value="${esc(c)}">${esc(c)}</option>`;
        });
      }
      evaluarCalculadora();
    }
    
    sheetSel.addEventListener('change', updateCols);
    filterColSel.addEventListener('change', evaluarCalculadora);
    groupColSel1.addEventListener('change', evaluarCalculadora);
    groupColSel2.addEventListener('change', evaluarCalculadora);
    valColSel.addEventListener('change', evaluarCalculadora);
    opSel.addEventListener('change', evaluarCalculadora);

    updateCols();

    const delBtn = document.createElement('button');
    delBtn.className = 'btn danger';
    delBtn.innerHTML = '✕';
    delBtn.onclick = () => {
      row.remove();
      updateFirstRow();
      evaluarCalculadora(); 
    };

    row.appendChild(opSel);
    row.appendChild(sheetSel);
    row.appendChild(filterColSel);
    row.appendChild(groupColSel1);
    row.appendChild(groupColSel2);
    row.appendChild(valColSel);
    row.appendChild(delBtn);
    
    rowsContainer.appendChild(row);
    updateFirstRow();
    evaluarCalculadora(); 
  }

  function updateFirstRow() {
    const rows = rowsContainer.querySelectorAll('.calc-row-grid');
    rows.forEach((r, i) => {
      const op = r.querySelector('.calc-op');
      op.style.visibility = i === 0 ? 'hidden' : 'visible';
    });
  }

  filterInput.addEventListener('input', evaluarCalculadora);

  addRowBtn.onclick = addRow;
  addRow(); 
}

// ============ LÓGICA DE CARGA DEL EXCEL ============
async function procesarCargaExcel(file) {
  try {
    toast('Leyendo archivo Excel...', '');
    const hojas = await window.leerXlsx(file);
    const nombresHojas = Object.keys(hojas);
    if (!nombresHojas.length) throw new Error('El archivo no contiene hojas válidas.');

    let checkboxes = nombresHojas.map((n, i) => `<label style="display:block; margin-bottom:8px; font-size:14px;"><input type="checkbox" class="ppt-sheet-check" value="${esc(n)}" checked style="width:auto; margin-right:8px;"> ${esc(n)}</label>`).join('');
    closeModal();
    
    openModal(`
      <h4>Seleccionar pestañas a cargar</h4>
      <p class="small muted">Selecciona las hojas del archivo <b>${esc(file.name)}</b> que deseas importar.</p>
      <div style="max-height:300px; overflow-y:auto; padding:10px; border:1px solid var(--border); border-radius:8px; margin:15px 0;">${checkboxes}</div>
      <div class="modal-foot">
        <button class="btn" data-act="cerrar">Cancelar</button>
        <button class="btn primary" id="pptConfirmSheets">Confirmar e Importar</button>
      </div>
    `);

    document.getElementById('pptConfirmSheets').onclick = async () => {
      const seleccionadas = [...document.querySelectorAll('.ppt-sheet-check:checked')].map(cb => cb.value);
      if (!seleccionadas.length) return toast('Debes seleccionar al menos una pestaña.', 'warn');
      if (PPT_DATA && PPT_DATA.hojas && PPT_DATA.hojas.length) {
        if (!confirm('Esto reemplazará el presupuesto actual por el nuevo archivo. ¿Continuar?')) return;
      }
      closeModal();
      
      try {
        toast('Guardando presupuesto...', '');
        const nuevasHojas = seleccionadas.map(nombre => {
          const filas = hojas[nombre] || [];
          const filasLimpias = filas.filter(f => f && f.some(c => String(c).trim() !== ''));
          if (!filasLimpias.length) return null;

          let headerIndex = 0, maxCols = 0;
          const scanLimit = Math.min(filasLimpias.length, 15);
          for (let i = 0; i < scanLimit; i++) {
            const colsCount = filasLimpias[i].filter(c => String(c).trim() !== '').length;
            if (colsCount > maxCols) { maxCols = colsCount; headerIndex = i; }
          }

          const rowHeader = filasLimpias[headerIndex];
          const columnas = rowHeader.map((c, i) => String(c).trim() || `Columna ${i+1}`);
          const datos = filasLimpias.slice(headerIndex + 1);
          return { nombre, columnas, filas: datos };
        }).filter(Boolean);

        if (!nuevasHojas.length) throw new Error('Las pestañas seleccionadas están vacías.');

        PPT_DATA = { archivo: file.name, fecha: new Date().toISOString(), hojas: nuevasHojas };
        await Store.require(); 
        await FS.writeJson(DIR_DATA + '/presupuesto.json', PPT_DATA);
        PPT_STATE = { hoja: nuevasHojas[0].nombre, page: 0, limit: 25, search: '' };
        toast('Presupuesto importado correctamente.');
        vPresupuesto();
      } catch (err) {
        console.error(err);
        if (err.name !== 'AbortError') alert("Error al guardar: " + err.message);
      }
    };
  } catch (err) {
    console.error(err);
    alert("Error al leer el Excel:\n" + err.message);
  }
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;

  if (b.dataset.act === 'ppt-upload') {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.xlsx'; fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.onchange = (ev) => {
      const file = ev.target.files[0];
      document.body.removeChild(fileInput);
      if (file) procesarCargaExcel(file);
    };
    fileInput.click();
  }

  if (b.dataset.act === 'ppt-calc-open') {
    abrirCalculadora();
  }

  if (b.dataset.act === 'ppt-copy-data') {
    copiarTablaHtmlAlPortapapeles('#pptTableWrap table');
  }

  if (b.dataset.act === 'ppt-clear') {
    if (!confirm('¿Eliminar los datos de presupuesto cargados?')) return;
    await FS.remove(DIR_DATA + '/presupuesto.json');
    PPT_DATA = { archivo: '', fecha: '', hojas: [] };
    PPT_STATE = { hoja: '', page: 0, limit: 25, search: '' };
    toast('Presupuesto eliminado.'); vPresupuesto();
  }

  if (b.dataset.act === 'ppt-tab') {
    PPT_STATE.hoja = b.dataset.tab; PPT_STATE.page = 0; vPresupuesto();
  }
  if (b.dataset.act === 'ppt-prev') {
    PPT_STATE.page--; renderTablaPresupuesto(PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja));
  }
  if (b.dataset.act === 'ppt-next') {
    PPT_STATE.page++; renderTablaPresupuesto(PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja));
  }
});

document.addEventListener('input', e => {
  if (e.target.dataset.ppt === 'q') {
    PPT_STATE.search = e.target.value; PPT_STATE.page = 0;
    renderTablaPresupuesto(PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja));
  }
});

document.addEventListener('change', e => {
  if (e.target.dataset.ppt === 'limit') {
    PPT_STATE.limit = Number(e.target.value); PPT_STATE.page = 0;
    renderTablaPresupuesto(PPT_DATA.hojas.find(h => h.nombre === PPT_STATE.hoja));
  }
});

window.vPresupuesto = vPresupuesto;
if (typeof RUTAS !== 'undefined') {
  RUTAS.presupuesto = vPresupuesto;
}
})();