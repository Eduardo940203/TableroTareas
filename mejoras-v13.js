/* TableroTareas-v13 */
(() => {
'use strict';
const projectRoute = RUTAS.proyecto;
RUTAS.proyecto = async function(params) {
  await projectRoute(params);
  const head = [...app().querySelectorAll('h4')].find(h => /Tareas\s*\(/.test(h.textContent));
  const card = head?.closest('.card');
  const header = head?.closest('.list-item');
  if (!card || !header || header.parentElement !== card || card.querySelector('[data-v13-toggle]')) return;
  const list = document.createElement('div');
  list.id = 'proyTareasList';
  list.hidden = true;
  while (header.nextSibling) list.appendChild(header.nextSibling);
  card.appendChild(list);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn sm';
  button.dataset.v13Toggle = '';
  button.textContent = '＋ Mostrar tareas';
  button.setAttribute('aria-controls', list.id);
  button.setAttribute('aria-expanded', 'false');
  button.onclick = () => {
    list.hidden = !list.hidden;
    button.textContent = list.hidden ? '＋ Mostrar tareas' : '− Ocultar tareas';
    button.setAttribute('aria-expanded', String(!list.hidden));
  };
  header.insertBefore(button, header.querySelector('button'));
};
const originalZip = zipStore;
const drawingNS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const presentationNS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
function repairSlide(source) {
  // v12.1 omitted XML escaping in text nodes. Escape their raw contents first.
  const escaped = source.replace(/(<a:t\b[^>]*>)([\s\S]*?)(<\/a:t>)/g, (_, open, text, close) => open + text.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + close);
  const doc = new DOMParser().parseFromString(escaped, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('No se pudo validar el XML de una diapositiva; no se descargó la presentación.');
  const shapes = [...doc.getElementsByTagNameNS(presentationNS, 'sp')];
  const yOf = shape => Number(shape.getElementsByTagNameNS(drawingNS, 'off')[0]?.getAttribute('y'));
  const redText = shapes.filter(shape => shape.getElementsByTagNameNS(presentationNS, 'txBody').length && [...shape.getElementsByTagNameNS(drawingNS, 'srgbClr')].some(c => c.getAttribute('val')?.toUpperCase() === 'DC2626')).map(yOf);
  for (const shape of shapes) {
    if (shape.getElementsByTagNameNS(presentationNS, 'txBody').length) continue;
    const extent = shape.getElementsByTagNameNS(drawingNS, 'ext')[0];
    const y = yOf(shape);
    if (!extent || Math.abs(Number(extent.getAttribute('cy')) - Math.round(0.13 * 914400)) > 2) continue;
    if (!redText.some(ty => y >= ty && y - ty < 0.12 * 914400)) continue;
    for (const color of shape.getElementsByTagNameNS(drawingNS, 'srgbClr')) {
      if (color.getAttribute('val')?.toUpperCase() === 'CBD5E1') color.setAttribute('val', 'DC2626');
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
zipStore = function(files) {
  return originalZip(files.map(file => /^ppt\/slides\/slide\d+\.xml$/.test(file.nombre) ? { ...file, contenido: repairSlide(file.contenido) } : file));
};
window.TableroTareasVersion = 'TableroTareas-v13';
})();
