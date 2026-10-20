function avanceTareaPresentacion(t) {
  if (Store.esTerminal(t.estado)) return 100;
  const ck = Array.isArray(t.checklist) ? t.checklist : [];
  return ck.length ? 100 * ck.filter(c => c.hecho).length / ck.length : 0;
}

/* PMO v9.1: período inclusivo y dos niveles visibles; no modifica datos del tablero. */
(() => {
'use strict';
const legacy=window.TableroPpt.build;
const A='http://schemas.openxmlformats.org/drawingml/2006/main',P='http://schemas.openxmlformats.org/presentationml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const X=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(parseD(s).getTime())&&isoD(parseD(s))===s;
const date=s=>valid(s)?fmtF(s):'Sin fecha';
const pct=n=>n===null?'N/D':n+'%';
const original=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):null;
function overlap(a,b,from,to){if(!valid(a)&&!valid(b))return false;const s=valid(a)?a:b,e=valid(b)?b:a;return e>=s&&s<=to&&e>=from;}
function route(p,id){const a=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const f=(p.fases||[]).find(f=>f.id===id);if(!f)break;a.unshift(f.nombre);id=f.padreId;}return a.join(' > ');}
function model(o){
 if(!valid(o.from)||!valid(o.cut)||o.from>o.cut)throw Error('Indica un período válido: inicio no puede ser posterior al corte.');
 if(!o.selected?.length)throw Error('Selecciona al menos una fase.');const out=[];
 for(const p of Store.proyectos.filter(p=>!o.pid||p.id===o.pid)){
  const fs=p.fases||[],chosen=new Set(o.selected.filter(s=>s.pid===p.id).map(s=>s.id));
  const tasks=Store.tareas.filter(t=>t.proyectoId===p.id&&(o.archivadas||!t.archivada)&&overlap(t.inicio,t.vence,o.from,o.cut));
  for(const id of [...chosen].filter(id=>{const seen=new Set([id]);let f=fs.find(f=>f.id===id);while(f?.padreId&&!seen.has(f.padreId)){if(chosen.has(f.padreId))return false;seen.add(f.padreId);f=fs.find(x=>x.id===f.padreId);}return true;})){
   const root=fs.find(f=>f.id===id);if(id&&!root)continue;const ids=id?GanttV7.descendants(p,id):new Set();
   const belongs=t=>id?ids.has(t.faseId):!fs.some(f=>f.id===t.faseId),ts=tasks.filter(belongs),hs=(p.hitos||[]).filter(h=>belongs(h)&&overlap(h.fecha,h.fecha,o.from,o.cut));
   if(!ts.length&&!hs.length)continue;
   const progress=(kind,obj,list)=>o.mode==='project'?original(kind==='fase'?obj.origen?.porcentaje:obj.projectOrigen?.porcentaje):kind==='fase'?(list.length?Math.round(list.reduce((sum,t)=>sum+avanceTareaPresentacion(t),0)/list.length):0):kind==='hito'?(obj.hecho?100:0):Math.round(avanceTareaPresentacion(obj));
   const rows=[];
   function phaseRow(f,depth){const ds=GanttV7.descendants(p,f.id),child=ts.filter(t=>ds.has(t.faseId)),hit=hs.filter(h=>ds.has(h.faseId));if(!child.length&&!hit.length)return;const dates=[...child.flatMap(t=>[t.inicio,t.vence]),...hit.map(h=>h.fecha)].filter(valid).sort();rows.push({kind:'fase',name:f.nombre,depth,start:f.inicio||dates[0],end:f.fin||dates[dates.length-1],pct:progress('fase',f,child)});}
   if(root){phaseRow(root,0);for(const f of fs.filter(f=>f.padreId===id).sort((a,b)=>(a.orden||0)-(b.orden||0)))phaseRow(f,1);}
   const direct=t=>id?t.faseId===id:!fs.some(f=>f.id===t.faseId);
   for(const t of ts.filter(direct))rows.push({kind:'tarea',name:t.titulo,depth:root?1:0,start:t.inicio,end:t.vence,pct:progress('tarea',t),late:!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut});
   for(const h of hs.filter(direct))rows.push({kind:'hito',name:'◆ '+h.nombre,depth:root?1:0,start:h.fecha,end:h.fecha,pct:progress('hito',h)});
   out.push({p,name:root?route(p,id):(fs.length?'Sin fase':p.nombre),rows,ts,pct:progress('fase',root||{},ts),done:ts.filter(t=>Store.esTerminal(t.estado)),next:ts.filter(t=>!Store.esTerminal(t.estado)&&(!valid(t.vence)||t.vence>=o.cut)),late:ts.filter(t=>!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut),notes:o.notas?(p.notas||[]).filter(n=>!n.faseId||ids.has(n.faseId)).map(n=>(n.faseId?'':'[Proyecto] ')+n.texto):[]});
  }
 }
 if(!out.length)throw Error('No hay tareas ni hitos con actividad durante el período seleccionado.');return out;
}
function wrap(s,n){const a=[];for(let t of String(s||'').split(/\r?\n/)){while(t.length>n){let k=t.lastIndexOf(' ',n);if(k<1)k=n;a.push(t.slice(0,k));t=t.slice(k).trimStart();}a.push(t);}return a;}
function chunks(a,n){const b=[];for(let i=0;i<a.length;i+=n)b.push(a.slice(i,i+n));return b;}
function build(o){
 const groups=model(o),slides=[],files=legacy({title:o.title,pid:o.pid,cut:o.cut,archivadas:o.archivadas});
 function slide(g,label,draw){let id=1,shapes='';const emu=n=>Math.round(n*914400);
  const box=(x,y,w,h,c)=>{if(w<=0)return;shapes+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;};
  const text=(s,x,y,w,h,size=11,c='253746',bold=false)=>{shapes+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${String(s).split('\n').map(t=>`<a:p><a:r><a:rPr lang="es-MX" sz="${size*100}" b="${bold?1:0}"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${X(t)}</a:t></a:r><a:endParaRPr sz="${size*100}"/></a:p>`).join('')}</p:txBody></p:sp>`;};
  box(0.4,0,5.8,0.08,'339966');box(7.1,7.42,5.8,0.08,'339966');text(g.name,0.55,0.3,10.5,0.7,24,'253746',true);text(pct(g.pct),11.25,0.4,1.5,0.5,22,'339966',true);text(g.p.nombre+' · '+label,0.55,1.05,12.2,0.4,12,'64748B');draw(text,box);
  text(date(o.from)+' → '+date(o.cut)+' · '+(o.mode==='project'?'% Project original, no recalculado':'% tablero sobre tareas del período')+' · Estados actuales',0.55,7.02,12.2,0.2,9,'64748B');text(o.title,0.55,7.25,11.5,0.17,8,'64748B');text(String(slides.length+1),12.3,7.24,0.4,0.18,9,'64748B');
  const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  slides.push(xml(`<p:sld xmlns:a="${A}" xmlns:p="${P}" xmlns:r="${R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`));
 }
 for(const g of groups){
  const task=t=>t.titulo+' · '+(t.responsable||'Sin responsable')+' · '+date(t.inicio)+' → '+date(t.vence),lists=[g.done.map(task),g.next.map(task),g.late.map(task),g.notes].map(a=>chunks(a.flatMap(s=>wrap('• '+s,65)),11));
  for(let i=0;i<Math.max(1,...lists.map(a=>a.length));i++)slide(g,'Seguimiento'+(i?' · continuación '+(i+1):''),(text,box)=>{['Actividades terminadas','Siguientes pasos','Tareas vencidas','Notas'].forEach((title,k)=>{const x=0.55+(k%2)*6.4,y=1.65+Math.floor(k/2)*2.45;text(title,x,y,5.9,0.32,16,k===2?'B91C1C':'339966',true);box(x,y+0.39,5.9,0.014,'CBD5E1');text((lists[k][i]||[]).join('\n')||(i?'Sin más registros.':'Sin registros.'),x,y+0.52,5.9,1.78,11);});});
  const start=o.from,end=o.cut,days=diffDays(start,end)+1,pages=chunks(g.rows,10);
  pages.forEach((rows,page)=>slide(g,'Gantt · dos niveles · '+(page+1)+' / '+pages.length,(text,box)=>{
   box(0.5,1.65,12.35,0.43,'E9F3ED');[['Fase / hijo inmediato',0.6,4.05],['Inicio',4.7,1],['Fin',5.75,1],['Avance',6.8,0.7]].forEach(([s,x,w])=>text(s,x,1.75,w,0.24,11,'253746',true));
   for(let n=0;n<=4;n++)text(date(addDays(start,Math.round((days-1)*n/4))),7.6+4.6*n/4,1.76,0.9,0.22,8);
   rows.forEach((r,i)=>{const y=2.18+i*0.44,c=r.kind==='fase'?'339966':r.pct===100?'16A34A':r.late?'DC2626':'2563EB';if(i%2===0)box(0.5,y-0.02,12.35,0.43,'F4F6F8');text(r.name,0.6+r.depth*0.15,y,4-r.depth*0.15,0.39,10,c,r.kind==='fase');text(date(r.start),4.7,y+0.06,1,0.24,9);text(date(r.end),5.75,y+0.06,1,0.24,9);text(pct(r.pct),6.8,y+0.06,0.7,0.24,10,c);
    let a=valid(r.start)?r.start:r.end,b=valid(r.end)?r.end:r.start;if(!overlap(a,b,start,end)){text('Sin rango visible',7.65,y+0.06,4.8,0.23,9,'64748B');return;}const s=a<start?start:a,e=b>end?end:b,x=7.65+5.05*diffDays(start,s)/days,w=Math.max(0.025,5.05*(diffDays(s,e)+1)/days);box(x,y+0.12,w,0.15,'CBD5E1');if(r.pct!==null&&r.pct>0)box(x,y+0.12,w*r.pct/100,0.15,c);
   });text('Dos niveles; descendientes incluidos en avance. Barras recortadas al período; columnas con fechas completas.',0.6,6.78,12,0.18,9,'64748B');
  }));
 }
 const result=files.filter(f=>!f.nombre.startsWith('ppt/slides/')),find=n=>result.find(f=>f.nombre===n),rel=items=>xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')+'</Relationships>');
 find('ppt/presentation.xml').contenido=find('ppt/presentation.xml').contenido.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'<p:sldIdLst>'+slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')+'</p:sldIdLst>');find('ppt/_rels/presentation.xml.rels').contenido=rel([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]);const ct=find('[Content_Types].xml');ct.contenido=ct.contenido.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g,'').replace('</Types>',slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')+'</Types>');slides.forEach((s,i)=>result.push({nombre:`ppt/slides/slide${i+1}.xml`,contenido:s},{nombre:`ppt/slides/_rels/slide${i+1}.xml.rels`,contenido:rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']])}));return result;
}
function mount(){
 const button=document.getElementById('pptDownload');if(!button||document.getElementById('ppt9'))return;const panel=document.createElement('div');panel.id='ppt9';panel.innerHTML='<h4>PMO v9.1 · período y dos niveles</h4><label>Fecha inicio del período</label><input id="p9From" type="date"><input id="p9Search" placeholder="Buscar fase o subfase"><div style="display:flex;gap:8px;margin:8px 0"><button type="button" class="btn sm" id="p9All">Marcar visibles</button><button type="button" class="btn sm" id="p9None">Limpiar selección</button><span id="p9Count"></span></div><div id="p9List" style="max-height:230px;overflow:auto;border:1px solid #94a3b8;padding:8px"></div><label>Origen del avance</label><select id="p9Mode"><option value="tablero">Tablero: tareas del período; fases por terminadas</option><option value="project">Project original: última importación, no recalculado</option></select><p class="small muted">Se incluyen tareas cuyo intervalo se cruza con el período (límites incluidos). Una sola fecha se trata como un día; sin fechas válidas se excluye. Gantt: fase y sus hijos inmediatos. El seguimiento lista las tareas filtradas, incluidas las de niveles ocultos. Sus avances cuentan en el tablero. Notas de proyecto no se filtran por fecha.</p>';
 button.closest('.modal-foot').before(panel);let choices=[],selected=new Set();const el=id=>document.getElementById(id);el('p9From').value=el('pptCut').value.slice(0,8)+'01';
 function paint(){const q=norm(el('p9Search').value);el('p9List').innerHTML=choices.map((c,i)=>({c,i})).filter(({c})=>norm(c.label).includes(q)).map(({c,i})=>'<label style="display:block;margin:5px 0"><input type="checkbox" style="width:auto" data-p9="'+i+'" '+(selected.has(i)?'checked':'')+'> '+esc(c.label)+'</label>').join('')||'Sin fases coincidentes.';el('p9Count').textContent=selected.size+' seleccionadas';}
 function reset(){const pid=el('pptPid').value;choices=Store.proyectos.filter(p=>!pid||p.id===pid).flatMap(p=>{const fs=p.fases||[],a=fs.map(f=>({pid:p.id,id:f.id,label:p.nombre+' / '+route(p,f.id)}));if(!fs.length||Store.tareas.some(t=>t.proyectoId===p.id&&!fs.some(f=>f.id===t.faseId)))a.push({pid:p.id,id:'',label:p.nombre+' / '+(fs.length?'Sin fase':'Proyecto completo')});return a;});selected=new Set();paint();}
 el('pptPid').addEventListener('change',reset);el('p9Search').oninput=paint;el('p9List').onchange=e=>{if(e.target.dataset.p9===undefined)return;const i=Number(e.target.dataset.p9);if(e.target.checked)selected.add(i);else selected.delete(i);paint();};el('p9All').onclick=()=>{const q=norm(el('p9Search').value);choices.forEach((c,i)=>{if(norm(c.label).includes(q))selected.add(i);});paint();};el('p9None').onclick=()=>{selected.clear();paint();};reset();for(const k of ['resumen','avance','tareas','hitos']){const c=el('ppt_'+k);if(c)c.closest('label').hidden=true;}el('ppt_notas').checked=true;const notice=button.closest('.modal-box')?.querySelector('p.muted');if(notice)notice.textContent='Seguimiento y Gantt separados. No modifica tareas, fases ni fechas del tablero. Estados actuales, no reconstrucción histórica.';
 button.onclick=()=>{try{const o={title:el('pptTitle').value.trim(),pid:el('pptPid').value,from:el('p9From').value,cut:el('pptCut').value,selected:[...selected].map(i=>choices[i]),mode:el('p9Mode').value,notas:el('ppt_notas').checked,archivadas:el('ppt_archivadas').checked};if(!o.title)throw Error('Indica un título.');descargarBlob(new Blob([zipStore(build(o))],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'seguimiento-pmo-v9-'+o.from+'-'+o.cut+'.pptx');closeModal();toast('Presentación del período generada.');}catch(e){console.error(e);toast(e.message,'err');}};
}
new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});window.TableroPpt={build,model,overlap,legacyBuild:legacy,version:'9.1'};mount();
})();

;
/* v11.1: fases/subfases por niveles sin filtro de fechas; actividades y vencidas por período y niveles. */
(() => {
'use strict';
const base=window.TableroPpt,A='http://schemas.openxmlformats.org/drawingml/2006/main',P='http://schemas.openxmlformats.org/presentationml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const X=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(parseD(s).getTime())&&isoD(parseD(s))===s;
const date=s=>valid(s)?fmtF(s):'Sin fecha',pct=n=>n===null?'N/D':n+'%';
const original=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):null;
const sorted=a=>a.slice().sort((x,y)=>(x.orden||0)-(y.orden||0));
const TOP=1.2,AV=5.8,LH=10*1.18/72;
function wrap(s,n){const out=[];for(let t of String(s||'').split(/\r?\n/)){while(t.length>n){let k=t.lastIndexOf(' ',n);if(k<1)k=n;out.push(t.slice(0,k));t=t.slice(k).trimStart();}out.push(t);}return out;}
function chunks(a,n){const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;}
function path(p,id){const a=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const f=(p.fases||[]).find(x=>x.id===id);if(!f)break;a.unshift(f.nombre);id=f.padreId;}return a.join(' > ');}
function parseNotes(text,existing){const old=existing||[];return String(text||'').split(/\r?\n[ \t]*\r?\n/).map(s=>s.trim()).filter(Boolean).map(t=>old.find(n=>n.texto===t)||{id:uid('n'),texto:t,fecha:new Date().toISOString()});}

let lastPhase=null,pending=null;
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-g7edit]');
 if(t&&t.dataset.kind==='fase')lastPhase=t.dataset.g7edit;else if(e.target.closest?.('#g7Add'))lastPhase='';
 if(e.target.id==='fSave'){const ta=document.getElementById('v11PhaseNotes');if(ta){pending={id:lastPhase,nombre:(document.getElementById('fNombre')?.value||'').trim(),padre:document.getElementById('fPadre')?.value||'',texto:ta.value};setTimeout(()=>{pending=null;},0);}}
},true);
new MutationObserver(()=>{
 const save=document.getElementById('fSave');if(!save||document.getElementById('v11PhaseNotes'))return;
 const proj=Store.proy(window.GanttV7?.state?.pid),f=lastPhase?(proj?.fases||[]).find(x=>x.id===lastPhase):null,foot=save.closest('.modal-box')?.querySelector('.modal-foot');if(!foot)return;
 const box=document.createElement('div');box.innerHTML='<label>Notas de la fase</label><textarea id="v11PhaseNotes" rows="5" placeholder="Separa cada nota con una línea en blanco"></textarea><div class="small muted">Una nota por bloque, separadas por una línea en blanco. Aparecen en la presentación de esta fase y de sus fases superiores.</div>';
 box.querySelector('textarea').value=(f?.notas||[]).map(n=>n.texto).join('\n\n');foot.before(box);
}).observe(document.body,{childList:true,subtree:true});
const saveProject=Store.saveProyecto.bind(Store);
Store.saveProyecto=async function(p,removed){
 const old=Store.proy(p.id);
 if(old)for(const f of p.fases||[])if(f.notas===undefined){const prev=(old.fases||[]).find(x=>x.id===f.id);if(prev?.notas?.length)f.notas=prev.notas;}
 if(pending){const n=pending;pending=null;const f=n.id?(p.fases||[]).find(x=>x.id===n.id):[...(p.fases||[])].reverse().find(x=>x.nombre===n.nombre&&(x.padreId||'')===n.padre);if(f)f.notas=parseNotes(n.texto,f.notas);}
 return saveProject(p,removed);
};

function model(o){
 if(!valid(o.from)||!valid(o.cut)||o.from>o.cut)throw Error('Indica un período válido: el inicio no puede ser posterior al corte.');
 if(!o.selected?.length)throw Error('Selecciona al menos una fase.');
 const levels=Math.max(1,Number(o.levels)||2),out=[];
 for(const p of Store.proyectos.filter(p=>!o.pid||p.id===o.pid)){
  const fs=p.fases||[],chosen=new Set(o.selected.filter(s=>s.pid===p.id).map(s=>s.id));
  const allTasks=Store.tareas.filter(t=>t.proyectoId===p.id&&(o.archivadas||!t.archivada));
  const tasks=allTasks.filter(t=>base.overlap(t.inicio,t.vence,o.from,o.cut));
  const roots=[...chosen].filter(id=>{const seen=new Set([id]);let f=fs.find(x=>x.id===id);while(f?.padreId&&!seen.has(f.padreId)){if(chosen.has(f.padreId))return false;seen.add(f.padreId);f=fs.find(x=>x.id===f.padreId);}return true;});
  for(const id of roots){
   const root=fs.find(f=>f.id===id);if(id&&!root)continue;
   const ids=id?GanttV7.descendants(p,id):new Set(),belongs=t=>id?ids.has(t.faseId):!fs.some(f=>f.id===t.faseId);
   const ts=tasks.filter(belongs),hs=(p.hitos||[]).filter(h=>belongs(h)&&base.overlap(h.fecha,h.fecha,o.from,o.cut));
   const prog=(kind,obj,list)=>o.mode==='project'?original(kind==='fase'?obj.origen?.porcentaje:obj.projectOrigen?.porcentaje):kind==='fase'?(list.length?Math.round(list.reduce((sum,t)=>sum+avanceTareaPresentacion(t),0)/list.length):0):kind==='hito'?(obj.hecho?100:0):Math.round(avanceTareaPresentacion(obj));
   const rows=[],direct=(x,fid)=>fid?x.faseId===fid:!fs.some(f=>f.id===x.faseId);
   const phaseRow=(f,depth)=>{const ds=GanttV7.descendants(p,f.id),child=ts.filter(t=>ds.has(t.faseId)),hit=hs.filter(h=>ds.has(h.faseId));const dates=[...child.flatMap(t=>[t.inicio,t.vence]),...hit.map(h=>h.fecha)].filter(valid).sort();rows.push({kind:'fase',name:f.nombre,depth,start:f.inicio||dates[0],end:f.fin||dates[dates.length-1],pct:prog('fase',f,allTasks.filter(t=>ds.has(t.faseId)))});};
   const visit=(f,depth)=>{
    if(f)phaseRow(f,depth);
    if(f&&depth+1<levels)for(const c of sorted(fs.filter(x=>x.padreId===f.id)))visit(c,depth+1);
    const td=f?depth+1:depth;
    if(td<levels){
     for(const t of ts.filter(x=>direct(x,f?.id)))rows.push({kind:'tarea',name:t.titulo,depth:td,start:t.inicio,end:t.vence,pct:prog('tarea',t),late:!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut});
     for(const h of hs.filter(x=>direct(x,f?.id)))rows.push({kind:'hito',name:'◆ '+h.nombre,depth:td,start:h.fecha,end:h.fecha,pct:prog('hito',h)});
    }
   };
   visit(root||null,0);
   const notes=!o.notas?[]:[
    ...(p.notas||[]).filter(n=>!n.faseId||ids.has(n.faseId)).map(n=>(n.faseId?'':'[Proyecto] ')+n.texto),
    ...(id?sorted(fs.filter(f=>ids.has(f.id))):[]).flatMap(f=>(f.notas||[]).map(n=>(f.id===id?'':'['+f.nombre+'] ')+n.texto))
   ];
   out.push({p,name:root?path(p,id):(fs.length?'Sin fase':p.nombre),rows,ts,notes,pct:prog('fase',root||{},allTasks.filter(belongs)),
    done:ts.filter(t=>Store.esTerminal(t.estado)),next:ts.filter(t=>!Store.esTerminal(t.estado)&&(!valid(t.vence)||t.vence>=o.cut)),late:ts.filter(t=>!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut)});
  }
 }
 if(!out.length)throw Error('Selecciona al menos una fase válida.');
 return out;
}

function rowLayout(r){const lines=wrap(r.name,Math.max(28,52-3*r.depth));return {r,lines,h:Math.max(0.26,lines.length*LH+0.07)};}
function packItems(items,L){
 const pieces=items.flatMap(it=>it.length>L?chunks(it,L):[it]),pages=[];let cur=[],n=0;
 for(const it of pieces){if(cur.length&&n+it.length>L){pages.push(cur.flat());cur=[];n=0;}cur.push(it);n+=it.length;}
 pages.push(cur.flat());return pages;
}
function plan(g){
 const gantt=g.rows.map(rowLayout),cap=AV-0.5,pages=[];let cur=[],h=0;
 for(const x of gantt){if(cur.length&&h+x.h>cap){pages.push({rows:cur,h});cur=[];h=0;}cur.push(x);h+=x.h;}
 pages.push({rows:cur,h});
 const task=t=>'• '+t.titulo+' · '+date(t.inicio)+' → '+date(t.vence);
 const items=[g.done.map(task),g.next.map(task),g.late.map(task),g.notes.map(n=>'• '+n)].map(a=>a.length?a.map(s=>wrap(s,38)):[['Sin registros.']]);
 const counts=[g.done.length,g.next.length,g.late.length,g.notes.length],flat=items.map(c=>c.flat());
 const blockH=0.42+Math.max(...flat.map(c=>c.length))*LH+0.05,last=pages[pages.length-1];
 const steps=pages.map((pg,i)=>({g,kind:'gantt',rows:pg.rows,h:pg.h,part:i+1,parts:pages.length,blocks:null}));
 if(blockH<=AV-0.7-last.h)steps[steps.length-1].blocks={cols:flat,counts,h:blockH};
 else{
  const L=Math.floor((AV-0.47)/LH),paged=items.map(c=>packItems(c,L)),n=Math.max(...paged.map(c=>c.length));
  for(let i=0;i<n;i++)steps.push({g,kind:'follow',part:i+1,parts:n,blocks:{cols:paged.map(c=>c[i]||[]),counts,h:AV}});
 }
 return steps;
}

const COLS=['Actividades terminadas','Siguientes pasos','Tareas vencidas','Notas'];
function render(s,index,total,o){
 const g=s.g;let id=1,body='';const E=n=>Math.round(n*914400),days=diffDays(o.from,o.cut)+1;
 const rect=(x,y,w,h,c)=>{if(w<=0)return;body+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${E(x)}" y="${E(y)}"/><a:ext cx="${E(w)}" cy="${E(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;};
 const text=(t,x,y,w,h,size=10,c='253746',bold=false)=>{body+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${E(x)}" y="${E(y)}"/><a:ext cx="${E(w)}" cy="${E(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${String(t).split('\n').map(l=>`<a:p><a:r><a:rPr lang="es-MX" sz="${size*100}" b="${bold?1:0}"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${X(l)}</a:t></a:r><a:endParaRPr sz="${size*100}"/></a:p>`).join('')}</p:txBody></p:sp>`;};
 rect(0.4,0,5.8,0.08,'339966');rect(7.1,7.42,5.8,0.08,'339966');
 text(g.name,0.5,0.2,10.6,0.55,23,'253746',true);text(pct(g.pct),11.3,0.25,1.5,0.4,22,'339966',true);
 text(o.title+' · '+g.p.nombre+' · '+(s.kind==='gantt'?'Gantt':'Seguimiento')+(s.parts>1?' '+s.part+'/'+s.parts:''),0.5,0.82,12.3,0.3,11,'64748B');
 let y=TOP;
 if(s.kind==='gantt'){
  rect(0.5,y,12.35,0.4,'E9F3ED');[['Tarea',0.6,4.05],['Inicio',4.7,1],['Fin',5.75,1],['Avance',6.8,0.7]].forEach(([t,x,w])=>text(t,x,y+0.1,w,0.22,10,'253746',true));
  for(let n=0;n<=4;n++)text(date(addDays(o.from,Math.round((days-1)*n/4))),7.6+4.6*n/4,y+0.11,0.9,0.2,8);
  let ry=y+0.48;
  s.rows.forEach((x,i)=>{const r=x.r,c=r.kind==='fase'?'339966':r.pct===100?'16A34A':r.late?'DC2626':'2563EB';
   if(i%2===0)rect(0.5,ry-0.02,12.35,x.h,'F4F6F8');
   text(x.lines.join('\n'),0.6+r.depth*0.15,ry,4-r.depth*0.15,x.h-0.03,10,c,r.kind==='fase');text(date(r.start),4.7,ry+0.03,1,0.23,9);text(date(r.end),5.75,ry+0.03,1,0.23,9);text(pct(r.pct),6.8,ry+0.03,0.7,0.23,9,c);
   const a=valid(r.start)?r.start:r.end,b=valid(r.end)?r.end:r.start;
   if(base.overlap(a,b,o.from,o.cut)){const st=a<o.from?o.from:a,en=b>o.cut?o.cut:b,bx=7.65+5.05*diffDays(o.from,st)/days,bw=Math.max(0.025,5.05*(diffDays(st,en)+1)/days);rect(bx,ry+0.07,bw,0.13,'CBD5E1');if(r.pct!==null&&r.pct>0)rect(bx,ry+0.07,bw*r.pct/100,0.13,c);}
   else text('Sin rango visible',7.65,ry+0.03,4.8,0.23,9,'64748B');
   ry+=x.h;});
  y=y+0.5+s.h+0.2;
 }
 if(s.blocks){
  COLS.forEach((t,k)=>{const x=0.5+k*3.15,c=k===2?'B91C1C':'339966',lines=s.blocks.cols[k];
   text(t+' ('+s.blocks.counts[k]+')',x,y,2.95,0.24,11,c,true);rect(x,y+0.3,2.95,0.012,'CBD5E1');
   if(lines.length)text(lines.join('\n'),x,y+0.4,2.95,Math.max(0.2,lines.length*LH+0.05),10);});
 }
 text(date(o.from)+' → '+date(o.cut)+' · '+(o.mode==='project'?'% Project original':'% tablero actual (todas las tareas)')+' · Estados actuales',0.5,7.12,11.3,0.18,9,'64748B');text((index+1)+' / '+total,12.25,7.12,0.6,0.18,9,'64748B');
 const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
 return xml(`<p:sld xmlns:a="${A}" xmlns:p="${P}" xmlns:r="${R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}
function build(o){
 const steps=model(o).flatMap(plan),files=base.legacyBuild({title:o.title,pid:o.pid,cut:o.cut,archivadas:o.archivadas});
 const slides=steps.map((s,i)=>render(s,i,steps.length,o));
 const result=files.filter(f=>!f.nombre.startsWith('ppt/slides/')),find=n=>result.find(f=>f.nombre===n);
 const rel=items=>xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,t,target])=>`<Relationship Id="${id}" Type="${R}/${t}" Target="${target}"/>`).join('')+'</Relationships>');
 find('ppt/presentation.xml').contenido=find('ppt/presentation.xml').contenido.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'<p:sldIdLst>'+slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')+'</p:sldIdLst>');
 find('ppt/_rels/presentation.xml.rels').contenido=rel([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]);
 const ct=find('[Content_Types].xml');ct.contenido=ct.contenido.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g,'').replace('</Types>',slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')+'</Types>');
 slides.forEach((s,i)=>result.push({nombre:`ppt/slides/slide${i+1}.xml`,contenido:s},{nombre:`ppt/slides/_rels/slide${i+1}.xml.rels`,contenido:rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']])}));
 return result;
}

function tree(pid){
 const nodes=[];
 for(const p of Store.proyectos.filter(p=>!pid||p.id===pid).sort((a,b)=>a.nombre.localeCompare(b.nombre))){
  const fs=p.fases||[],ids=new Set(fs.map(f=>f.id)),pk=p.id+'|#';
  nodes.push({key:pk,kind:'proyecto',label:p.nombre,depth:0,pid:p.id});
  const add=(f,depth,parent)=>{const key=p.id+'|'+f.id;nodes.push({key,kind:'fase',pid:p.id,id:f.id,label:f.nombre,depth,parent});for(const c of sorted(fs.filter(x=>x.padreId===f.id)))add(c,depth+1,key);};
  for(const f of sorted(fs.filter(f=>!f.padreId||!ids.has(f.padreId))))add(f,1,pk);
  if(!fs.length||Store.tareas.some(t=>t.proyectoId===p.id&&!ids.has(t.faseId)))nodes.push({key:p.id+'|',kind:'fase',pid:p.id,id:'',label:fs.length?'Sin fase':'Proyecto completo',depth:1,parent:pk});
 }
 return nodes;
}
function view(nodes,expanded,selected,query){
 const by=new Map(nodes.map(n=>[n.key,n])),kids=new Map(),q=norm(query),match=new Set(),keep=new Set();
 for(const n of nodes)if(n.parent){if(!kids.has(n.parent))kids.set(n.parent,[]);kids.get(n.parent).push(n.key);}
 if(q)for(const n of nodes)if(n.kind==='fase'&&norm(n.label).includes(q)){match.add(n.key);let k=n.key;while(k){keep.add(k);k=by.get(k)?.parent;}}
 const covered=n=>{let k=n.parent;while(k){const a=by.get(k);if(!a)break;if(a.kind==='fase'&&selected.has(a.key))return true;k=a.parent;}return false;};
 const shown=n=>{if(q)return keep.has(n.key);let k=n.parent;while(k){const a=by.get(k);if(!a||a.kind==='proyecto')break;if(!expanded.has(a.key))return false;k=a.parent;}return true;};
 return nodes.filter(shown).map(n=>({n,covered:n.kind==='fase'&&covered(n),checked:selected.has(n.key),kids:n.kind==='fase'&&(kids.get(n.key)||[]).length>0,open:!!q||expanded.has(n.key),match:match.has(n.key)}));
}
function dialog(pid){
 openModal(`<h4>Generar presentación PowerPoint</h4><div class="form-grid"><div class="full"><label>Título</label><input id="v11Title" value="Seguimiento de proyectos"></div><div class="full"><label>Proyecto</label><select id="v11Pid">${opcionesProy(pid,'Todo el tablero')}</select></div><div class="full"><h4>Periodo y Selección</h4></div><div><label>Fecha inicio del período</label><input id="v11From" type="date" value="${HOY().slice(0,8)}01"></div><div><label>Fecha de corte</label><input id="v11Cut" type="date" value="${HOY()}"></div><div class="full"><button type="button" class="btn" id="v11Toggle" style="width:100%;text-align:left"></button><div id="v11Panel" style="display:none;border:1px solid #94a3b8;padding:8px;margin-top:6px"><input id="v11Search" placeholder="Buscar fase o subfase"><div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button type="button" class="btn sm" id="v11Expand">Expandir</button><button type="button" class="btn sm" id="v11Collapse">Contraer</button><button type="button" class="btn sm" id="v11All">Marcar visibles</button><button type="button" class="btn sm" id="v11None">Limpiar selección</button></div><div id="v11List" style="max-height:240px;overflow:auto"></div></div></div><div><label>Niveles a mostrar en el Gantt</label><select id="v11Levels"><option value="1">1 nivel (solo la fase)</option><option value="2" selected>2 niveles</option><option value="3">3 niveles</option><option value="4">4 niveles</option><option value="5">5 niveles</option><option value="6">6 niveles</option><option value="99">Todos los niveles</option></select></div><div><label>Origen del avance</label><select id="v11Mode"><option value="tablero">Tablero: avance actual (sin filtro de fechas)</option><option value="project">Project original: última importación</option></select></div><div class="full"><label style="display:flex;gap:8px"><input type="checkbox" id="v11Notes" checked style="width:auto">Incluir notas (proyecto y fase)</label><label style="display:flex;gap:8px"><input type="checkbox" id="v11Arch" style="width:auto">Incluir tareas archivadas</label></div></div><p class="small muted">El Gantt muestra las fases y subfases según los niveles configurados, aunque estén fuera del período. Las actividades, siguientes pasos y tareas vencidas sí respetan el período y los niveles configurados. Los porcentajes del Gantt y del encabezado corresponden al avance actual de todas las tareas de cada fase, sin filtro de fechas; se respeta la opción de archivadas.</p><div class="modal-foot"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="v11Download">Generar .pptx</button></div>`,true);
 const el=id=>document.getElementById(id);let nodes=[],expanded=new Set(),selected=new Set(),open=false;
 const paint=()=>{
  const v=view(nodes,expanded,selected,el('v11Search').value);
  el('v11List').innerHTML=v.map(x=>{const n=x.n,pad=n.depth*18;
   if(n.kind==='proyecto')return `<div style="margin:6px 0 2px"><b>${esc(n.label)}</b></div>`;
   return `<div style="padding-left:${pad}px;display:flex;align-items:center;gap:6px;margin:3px 0">${x.kids?`<button type="button" class="btn sm" data-v11t="${esc(n.key)}">${x.open?'−':'+'}</button>`:'<span style="display:inline-block;width:30px"></span>'}<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" data-v11c="${esc(n.key)}" ${x.checked||x.covered?'checked':''} ${x.covered?'disabled':''}>${esc(n.label)}${x.covered?' <span class="muted small">(incluida)</span>':''}</label></div>`;}).join('')||'Sin fases coincidentes.';
  el('v11Toggle').textContent='Fases y subfases · '+selected.size+' seleccionadas '+(open?'▲':'▼');
  el('v11Panel').style.display=open?'block':'none';
 };
 const reset=()=>{nodes=tree(el('v11Pid').value);expanded.clear();selected.clear();paint();};
 el('v11Pid').onchange=reset;el('v11Search').oninput=paint;el('v11Toggle').onclick=()=>{open=!open;paint();};
 el('v11List').onclick=e=>{const b=e.target.closest('[data-v11t]');if(!b)return;const k=b.dataset.v11t;if(expanded.has(k))expanded.delete(k);else expanded.add(k);paint();};
 el('v11List').onchange=e=>{const k=e.target.dataset.v11c;if(k===undefined)return;if(e.target.checked)selected.add(k);else selected.delete(k);paint();};
 el('v11Expand').onclick=()=>{nodes.forEach(n=>{if(n.kind==='fase')expanded.add(n.key);});paint();};el('v11Collapse').onclick=()=>{expanded.clear();paint();};
 el('v11All').onclick=()=>{view(nodes,expanded,selected,el('v11Search').value).forEach(x=>{if(x.n.kind==='fase'&&!x.covered)selected.add(x.n.key);});paint();};el('v11None').onclick=()=>{selected.clear();paint();};
 reset();
 el('v11Download').onclick=()=>{try{
  const by=new Map(nodes.map(n=>[n.key,n])),o={title:el('v11Title').value.trim(),pid:el('v11Pid').value,from:el('v11From').value,cut:el('v11Cut').value,selected:[...selected].map(k=>({pid:by.get(k).pid,id:by.get(k).id})),levels:Number(el('v11Levels').value),mode:el('v11Mode').value,notas:el('v11Notes').checked,archivadas:el('v11Arch').checked};
  if(!o.title)throw Error('Indica un título.');
  descargarBlob(new Blob([zipStore(build(o))],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'seguimiento-v11-'+o.from+'-'+o.cut+'.pptx');closeModal();toast('Presentación generada.');
 }catch(e){console.error(e);toast(e.message,'err');}};
}
document.addEventListener('click',e=>{const b=e.target.closest?.('#pptOpen');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const [route,params]=parseHash();dialog(route==='proyecto'?(params.get('id')||''):(document.getElementById('xchgProy')?.value||''));},true);
window.TableroPpt={build,model,plan,render,parseNotes,tree,view,overlap:base.overlap,legacyBuild:base.legacyBuild,dialog,version:11};
})();

