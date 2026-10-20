/* TableroTareas-v14: desplegables independientes por columna del tablero.
   Cargar después de mejoras-v13.js para conservar las correcciones PPTX. */
(() => {
'use strict';
const previousRoute = RUTAS.proyecto;
const expanded = new Map();
RUTAS.proyecto = async function(params) {
  await previousRoute(params);
  const head = [...app().querySelectorAll('h4')].find(h => /Tareas\s*\(/.test(h.textContent));
  const card = head?.closest('.card');
  if (!card || card.dataset.v14Columns === 'true') return;
  const globalList = card.querySelector('#proyTareasList');
  if (globalList) globalList.replaceWith(...globalList.childNodes);
  card.querySelector('[data-v13-toggle]')?.remove();
  const pid = params.get('id');
  const tasks = Store.tareas.filter(t => t.proyectoId === pid);
  const columns = Store.config.columnas.filter(c => tasks.some(t => t.estado === c.id));
  const headings = [...card.children].filter(el => el.classList.contains('side-title'));
  headings.forEach((heading, index) => {
    const column = columns[index];
    if (!column) return;
    const key = JSON.stringify([pid, column.id]);
    const list = document.createElement('div');
    list.id = 'v14-column-' + index;
    list.dataset.columnId = column.id;
    list.hidden = !expanded.get(key);
    while (heading.nextSibling && !(heading.nextSibling.nodeType === 1 && heading.nextSibling.classList.contains('side-title'))) {
      list.appendChild(heading.nextSibling);
    }
    heading.after(list);
    const label = document.createElement('span');
    label.textContent = heading.textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn sm';
    button.style.textTransform = 'none';
    button.setAttribute('aria-controls', list.id);
    const paint = () => {
      button.textContent = list.hidden ? '＋ Mostrar tareas' : '− Ocultar tareas';
      button.setAttribute('aria-expanded', String(!list.hidden));
    };
    button.onclick = () => {
      list.hidden = !list.hidden;
      expanded.set(key, !list.hidden);
      paint();
    };
    heading.replaceChildren(label, button);
    heading.style.display = 'flex';
    heading.style.justifyContent = 'space-between';
    heading.style.alignItems = 'center';
    heading.style.gap = '8px';
    heading.style.flexWrap = 'wrap';
    paint();
  });
  card.dataset.v14Columns = 'true';
};
window.TableroTareasVersion = 'TableroTareas-v14';
})();
