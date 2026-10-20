/* Tablero v9. PMO multifase y Gantt jerárquico. Conserva el nombre de entrada v8 para compatibilidad. */
(() => {
'use strict';
const legacy=window.TableroPpt.build;
const A='http://schemas.openxmlformats.org/drawingml/2006/main',P='http://schemas.openxmlformats.org/presentationml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const X=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(parseD(s).getTime())&&isoD(parseD(s))===s;
const date=s=>valid(s)?fmtF(s):'Sin fecha';
const original=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):null;
function route(p,id){const out=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const f=(p.fases||[]).find(f=>f.id===id);if(!f)break;out.unshift(f.nombre);id=f.padreId;}return out.join(' > ');}
function model(o){
 if(!o.selected?.length)throw Error('Selecciona al menos una fase.');
 const out=[];
 for(const p of Store.proyectos.filter(p=>!o.pid||p.id===o.pid)){
  const fs=p.fases||[],chosen=new Set(o.selected.filter(s=>s.pid===p.id).map(s=>s.id));
  const tasks=Store.tareas.filter(t=>t.proyectoId===p.id&&(o.archivadas||!t.archivada));
  const roots=[...chosen].filter(id=>{const seen=new Set([id]);let parent=fs.find(f=>f.id===id)?.padreId;while(parent&&!seen.has(parent)){if(chosen.has(parent))return false;seen.add(parent);parent=fs.find(f=>f.id===parent)?.padreId;}return true;});
  for(const id of roots){
   const phase=fs.find(f=>f.id===id);if(id&&!phase)continue;
   const ids=id?GanttV7.descendants(p,id):new Set();
   const included=t=>id?ids.has(t.faseId):!fs.some(f=>f.id===t.faseId);
   const ts=tasks.filter(included),hs=(p.hitos||[]).filter(included);
   const pct=(kind,obj,list)=>o.mode==='project'?original(kind==='fase'?obj.origen?.porcentaje:obj.projectOrigen?.porcentaje):kind==='fase'?(list.length?Math.round(100*list.filter(t=>Store.esTerminal(t.estado)).length/list.length):0):kind==='hito'?(obj.hecho?100:0):(Store.esTerminal(obj.estado)?100:0);
   const rows=[],visited=new Set();
   function visit(fid,depth){
    if(visited.has(fid))return;visited.add(fid);
    const f=fs.find(f=>f.id===fid),desc=f?GanttV7.descendants(p,fid):new Set();
    if(f){const child=ts.filter(t=>desc.has(t.faseId)),dates=[...fs.filter(s=>desc.has(s.id)).flatMap(s=>[s.inicio,s.fin]),...child.flatMap(t=>[t.inicio,t.vence]),...hs.filter(h=>desc.has(h.faseId)).map(h=>h.fecha)].filter(valid).sort();rows.push({kind:'fase',name:f.nombre,depth,start:f.inicio||dates[0],end:f.fin||dates[dates.length-1],pct:pct('fase',f,child)});}
    for(const child of fs.filter(f=>f.padreId===fid&&ids.has(f.id)).sort((a,b)=>(a.orden||0)-(b.orden||0)))visit(child.id,depth+1);
    const direct=t=>fid?t.faseId===fid:!fs.some(f=>f.id===t.faseId);
    for(const t of ts.filter(direct))rows.push({kind:'tarea',name:t.titulo,depth:depth+(f?1:0),start:t.inicio,end:t.vence,pct:pct('tarea',t),late:!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut});
    for(const h of hs.filter(direct))rows.push({kind:'hito',name:'◆ '+h.nombre,depth:depth+(f?1:0),start:h.fecha,end:h.fecha,pct:pct('hito',h)});
   }
   visit(id,0);
   const notes=o.notas?(p.notas||[]).filter(n=>!n.faseId||ids.has(n.faseId)).map(n=>(n.faseId?'':'[Proyecto] ')+n.texto):[];
   out.push({p,name:phase?route(p,id):(fs.length?'Sin fase':p.nombre),rows,ts,notes,pct:pct('fase',phase||{},ts),done:ts.filter(t=>Store.esTerminal(t.estado)),next:ts.filter(t=>!Store.esTerminal(t.estado)&&(!valid(t.vence)||t.vence>=o.cut)),late:ts.filter(t=>!Store.esTerminal(t.estado)&&valid(t.vence)&&t.vence<o.cut)});
  }
 }
 if(!out.length)throw Error('Las fases seleccionadas no están disponibles.');return out;
}
function wrap(s,n){const out=[];for(let t of String(s||'').split(/\r?\n/)){while(t.length>n){let k=t.lastIndexOf(' ',n);if(k<1)k=n;out.push(t.slice(0,k));t=t.slice(k).trimStart();}out.push(t);}return out;}
function chunks(a,n){const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;}
function build(o){
 const groups=model(o),slides=[];
 const files=legacy({title:o.title,pid:o.pid,cut:o.cut,archivadas:o.archivadas});
 const mode=o.mode==='project'?'% original Project (última importación)':'% tablero (estado actual; tareas 0/100)';
 const pct=n=>n===null?'N/D':n+'%';
 function slide(g,label,draw){
  let id=1,shapes='';const emu=n=>Math.round(n*914400);
  const box=(x,y,w,h,c)=>{if(w<=0)return;shapes+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;};
  const text=(s,x,y,w,h,size=11,c='253746',bold=false)=>{shapes+=`<p:sp><p:nvSpPr><p:cNvPr id="${++id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${String(s).split('\n').map(t=>`<a:p><a:r><a:rPr lang="es-MX" sz="${size*100}" b="${bold?1:0}"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${X(t)}</a:t></a:r><a:endParaRPr sz="${size*100}"/></a:p>`).join('')}</p:txBody></p:sp>`;};
  box(0.4,0,5.8,0.08,'339966');box(7.1,7.42,5.8,0.08,'339966');
  text(g.name,0.55,0.3,10.5,0.7,24,'253746',true);text(pct(g.pct),11.25,0.4,1.5,0.5,22,'339966',true);
  text(g.p.nombre+' · '+label,0.55,1.05,12.2,0.4,12,'64748B');
  draw(text,box);
  text(mode+' · Corte '+fmtF(o.cut)+' · Estados actuales, no históricos',0.55,7.02,12.2,0.2,9,'64748B');
  text(o.title,0.55,7.25,11.5,0.17,8,'64748B');text(String(slides.length+1),12.3,7.24,0.4,0.18,9,'64748B');
  const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  slides.push(xml(`<p:sld xmlns:a="${A}" xmlns:p="${P}" xmlns:r="${R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`));
 }
 for(const g of groups){
  const task=t=>t.titulo+' · '+(t.responsable||'Sin responsable')+' · Fin: '+date(t.vence);
  const lists=[g.done.map(task),g.next.slice().sort((a,b)=>(a.vence||'9999').localeCompare(b.vence||'9999')).map(task),g.late.map(task),g.notes].map(a=>chunks(a.flatMap(s=>wrap('• '+s,65)),11));
  for(let i=0;i<Math.max(1,...lists.map(a=>a.length));i++)slide(g,'Seguimiento'+(i?' · continuación '+(i+1):''),(text,box)=>{
   ['Actividades terminadas','Siguientes pasos','Tareas vencidas','Notas'].forEach((title,k)=>{const x=0.55+(k%2)*6.4,y=1.65+Math.floor(k/2)*2.45;text(title,x,y,5.9,0.32,16,k===2?'B91C1C':'339966',true);box(x,y+0.39,5.9,0.014,'CBD5E1');text((lists[k][i]||[]).join('\n')||(i?'Sin más registros.':'Sin registros.'),x,y+0.52,5.9,1.78,11);});
  });
  const dates=g.rows.flatMap(r=>[r.start,r.end]).filter(valid).sort(),start=dates[0],end=dates[dates.length-1],days=start?Math.max(1,diffDays(start,end)+1):1;
  const pages=chunks(g.rows,10);if(!pages.length)pages.push([]);
  pages.forEach((rows,page)=>slide(g,'Gantt · '+(page+1)+' / '+pages.length,(text,box)=>{
   box(0.5,1.65,12.35,0.43,'E9F3ED');
   [['Fase / subfase / actividad',0.6,4.05],['Inicio',4.7,1.0],['Fin',5.75,1.0],['Avance',6.8,0.7]].forEach(([s,x,w])=>text(s,x,1.75,w,0.24,11,'253746',true));
   if(start)for(let n=0;n<=4;n++)text(date(addDays(start,Math.round((days-1)*n/4))),7.6+4.6*n/4,1.76,0.9,0.22,8);
   rows.forEach((r,i)=>{const y=2.18+i*0.44,c=r.kind==='fase'?'339966':r.pct===100?'16A34A':r.late?'DC2626':'2563EB';if(i%2===0)box(0.5,y-0.02,12.35,0.43,'F4F6F8');const indent=Math.min(r.depth,8)*0.1;text(r.name,0.6+indent,y,4.0-indent,0.39,10,c,r.kind==='fase');text(date(r.start),4.7,y+0.06,1,0.24,9);text(date(r.end),5.75,y+0.06,1,0.24,9);text(pct(r.pct),6.8,y+0.06,0.7,0.24,10,c);
    if(!valid(r.start)||!valid(r.end)||r.end<r.start){text('Sin rango válido',7.65,y+0.06,4.8,0.23,9,'64748B');return;}
    const x=7.65+5.05*diffDays(start,r.start)/days,w=Math.max(0.025,5.05*(diffDays(r.start,r.end)+1)/days);box(x,y+0.12,w,0.15,'CBD5E1');if(r.pct!==null&&r.pct>0)box(x,y+0.12,w*r.pct/100,0.15,c);
   });
   if(!rows.length)text('Sin actividades ni hitos en esta fase.',0.6,2.5,11,0.4,13);
   text('Barra gris: duración planificada · Relleno: avance · N/D: porcentaje original no disponible',0.6,6.78,12,0.18,9,'64748B');
  }));
 }
 const result=files.filter(f=>!f.nombre.startsWith('ppt/slides/')),find=n=>result.find(f=>f.nombre===n);
 const rel=items=>xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')+'</Relationships>');
 find('ppt/presentation.xml').contenido=find('ppt/presentation.xml').contenido.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'<p:sldIdLst>'+slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')+'</p:sldIdLst>');
 find('ppt/_rels/presentation.xml.rels').contenido=rel([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]);
 const ct=find('[Content_Types].xml');ct.contenido=ct.contenido.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g,'').replace('</Types>',slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')+'</Types>');
 slides.forEach((s,i)=>result.push({nombre:`ppt/slides/slide${i+1}.xml`,contenido:s},{nombre:`ppt/slides/_rels/slide${i+1}.xml.rels`,contenido:rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']])}));return result;
}
function mount(){
 const button=document.getElementById('pptDownload');if(!button||document.getElementById('ppt9'))return;
 const panel=document.createElement('div');panel.id='ppt9';panel.innerHTML='<h4>PMO v9 · selección múltiple de fases</h4><input id="p9Search" placeholder="Buscar fase o subfase"><div style="display:flex;gap:8px;margin:8px 0"><button type="button" class="btn sm" id="p9All">Marcar visibles</button><button type="button" class="btn sm" id="p9None">Limpiar selección</button><span id="p9Count"></span></div><div id="p9List" style="max-height:230px;overflow:auto;border:1px solid #94a3b8;padding:8px"></div><label>Origen del porcentaje de avance</label><select id="p9Mode"><option value="tablero">Tablero: tareas 0/100; fases por tareas terminadas</option><option value="project">Project original: porcentaje de la última importación</option></select><p class="small muted">Selecciona una o varias fases. Padres incluyen todas sus subfases y tareas; seleccionar ambos no duplica el árbol. El Gantt se exporta separado, con inicio, fin y avance por fila. N/D indica porcentaje original ausente.</p>';
 button.closest('.modal-foot').before(panel);
 let choices=[],selected=new Set();const el=id=>document.getElementById(id);
 function paint(){const q=norm(el('p9Search').value);el('p9List').innerHTML=choices.map((c,i)=>({c,i})).filter(({c})=>norm(c.label).includes(q)).map(({c,i})=>'<label style="display:block;margin:5px 0"><input type="checkbox" style="width:auto" data-p9="'+i+'" '+(selected.has(i)?'checked':'')+'> '+esc(c.label)+'</label>').join('')||'Sin fases coincidentes.';el('p9Count').textContent=selected.size+' seleccionadas';}
 function reset(){const pid=el('pptPid').value;choices=Store.proyectos.filter(p=>!pid||p.id===pid).flatMap(p=>{const fs=p.fases||[],a=fs.map(f=>({pid:p.id,id:f.id,label:p.nombre+' / '+route(p,f.id)}));if(!fs.length||Store.tareas.some(t=>t.proyectoId===p.id&&!fs.some(f=>f.id===t.faseId)))a.push({pid:p.id,id:'',label:p.nombre+' / '+(fs.length?'Sin fase':'Proyecto completo')});return a;});selected=new Set();paint();}
 el('pptPid').addEventListener('change',reset);el('p9Search').oninput=paint;el('p9List').onchange=e=>{if(e.target.dataset.p9===undefined)return;const i=Number(e.target.dataset.p9);if(e.target.checked)selected.add(i);else selected.delete(i);paint();};el('p9All').onclick=()=>{const q=norm(el('p9Search').value);choices.forEach((c,i)=>{if(norm(c.label).includes(q))selected.add(i);});paint();};el('p9None').onclick=()=>{selected.clear();paint();};reset();
 for(const k of ['resumen','avance','tareas','hitos']){const c=el('ppt_'+k);if(c)c.closest('label').hidden=true;}el('ppt_notas').checked=true;
 const notice=button.closest('.modal-box')?.querySelector('p.muted');if(notice)notice.textContent='PowerPoint PMO editable. Seguimiento y Gantt separados. No exporta credenciales ni adjuntos. Notas sin fase se muestran como [Proyecto].';
 button.onclick=()=>{try{const o={title:el('pptTitle').value.trim(),pid:el('pptPid').value,cut:el('pptCut').value,selected:[...selected].map(i=>choices[i]),mode:el('p9Mode').value,notas:el('ppt_notas').checked,archivadas:el('ppt_archivadas').checked};if(!o.title||!valid(o.cut))throw Error('Indica título y fecha de corte válida.');descargarBlob(new Blob([zipStore(build(o))],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'seguimiento-pmo-v9-'+o.cut+'.pptx');closeModal();toast('Presentación PMO v9 generada.');}catch(e){console.error(e);toast(e.message,'err');}};
}
new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});window.TableroPpt={build,model,legacyBuild:legacy,version:9};mount();
})();
