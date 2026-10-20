/* v7: Gantt jerarquico y edicion de fases. Cargar ANTES de import-project-v5.js. */
(() => {
'use strict';
let busy=false;
const st={pid:'',focus:'',q:'',view:'todo',depth:99,zoom:10,fit:false,opened:new Set(),arch:false};
const phases=p=>p?.fases||[];
const phase=(p,id)=>phases(p).find(f=>f.id===id);
const duration=f=>{const m=String(f.origen?.duracion||'').match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);return m?((Number(m[1]||0)*60+Number(m[2]||0)+Number(m[3]||0)/60)/(f.origen.minutosDia||480)).toLocaleString('es-MX',{maximumFractionDigits:2})+' d laborables (Project original)':'';};
const val=(e,n)=>[...e.children].find(x=>x.localName===n)?.textContent.trim()||'';
const lc=s=>String(s||'').trim().toLowerCase();
async function stable(source,kind,uid){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([source,kind,uid])));return 'msp_'+kind+'_'+[...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');}
function descendants(p,id){const out=new Set([id]);let changed=true;while(changed){changed=false;for(const f of phases(p))if(out.has(f.padreId||'')&&!out.has(f.id)){out.add(f.id);changed=true;}}return out;}
function path(p,id){const out=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const f=phase(p,id);if(!f)break;out.unshift(f.nombre);id=f.padreId;}return out.join(' > ');}
function percent(p,id,mode=p.ganttModo||'tablero'){
 const f=phase(p,id);if(mode==='project')return f?.origen?.porcentaje??null;
 const ids=descendants(p,id),ts=Store.tareas.filter(t=>t.proyectoId===p.id&&(!id||ids.has(t.faseId)));
 const unique=[...new Map(ts.map(t=>[t.id,t])).values()];return unique.length?Math.round(100*unique.filter(t=>Store.esTerminal(t.estado)).length/unique.length):0;
}
function validParent(p,id,parent){if(!parent)return true;return !!phase(p,parent)&&parent!==id&&!descendants(p,id).has(parent);}
async function enrich(txt,key=''){
 const d=await ProjectImportV5.parse(txt,key),root=new DOMParser().parseFromString(txt,'application/xml').documentElement;
 const taskRoot=[...root.children].find(x=>x.localName==='Tasks');
 const rows=[...taskRoot.children].filter(t=>t.localName==='Task'&&val(t,'IsNull')!=='1'&&val(t,'Name')&&Number(val(t,'OutlineLevel'))>0);
 const base=Math.min(...rows.map(t=>Number(val(t,'OutlineLevel'))));
 const byProject=new Map(d.proyectos.map(p=>[p.projectOrigen.uid,p]));
 const byTask=new Map(d.tareas.map(t=>[t.projectOrigen.uid,t]));
 const byHito=new Map(d.proyectos.flatMap(p=>p.hitos.map(h=>[h.projectOrigen.uid,h])));
 d.proyectos.forEach(p=>p.fases=[]);
 let current=null;const stack=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],level=Number(val(row,'OutlineLevel')),uid=val(row,'UID'),summary=val(row,'Summary')==='1';
  while(stack.length&&stack[stack.length-1].level>=level)stack.pop();
  if(level===base)current=null;
  if(summary&&level===base){current=byProject.get(uid);continue;}
  if(!current)current=byProject.get('$project');
  if(!current)throw new Error('No se pudo asociar el nodo '+uid+' al proyecto.');
  const parent=stack.length?stack[stack.length-1].id:'';
  if(summary){
   const pct=Number(val(row,'PercentComplete'))||0,id=await stable(d.source,'f',uid);
   current.fases.push({id,nombre:val(row,'Name'),padreId:parent,inicio:val(row,'Start').slice(0,10),fin:val(row,'Finish').slice(0,10),orden:i,origen:{source:d.source,uid,nivel:level,wbs:val(row,'WBS'),duracion:val(row,'Duration'),minutosDia:Number(val(root,'MinutesPerDay'))||480,porcentaje:pct,inicio:val(row,'Start'),fin:val(row,'Finish')}});
   stack.push({id,level});
  }else{const t=byTask.get(uid)||byHito.get(uid);if(t)t.faseId=parent;}
 }
 return d;
}
function prepare(d,replace=false){
 const copy=clone(d);
 for(const dp of copy.proyectos){
  const old=Store.proy(dp.id),merged=new Map(phases(old).map(f=>[f.id,clone(f)]));
  for(const f of dp.fases){const ex=merged.get(f.id);if(ex&&!replace)for(const k of ['nombre','padreId','inicio','fin'])if(ex.local?.[k])f[k]=ex[k];f.local=replace?{}:(ex?.local||{});merged.set(f.id,f);}
  dp.fases=[...merged.values()];
  for(const f of dp.fases)if(f.padreId&&!dp.fases.some(x=>x.id===f.padreId))throw new Error('Padre de fase no encontrado: '+f.nombre);
  const fake={fases:dp.fases};for(const f of dp.fases)if(!validParent(fake,f.id,f.padreId))throw new Error('Ciclo en fases: '+f.nombre);
 }
 for(const dt of copy.tareas){const old=Store.tarea(dt.id);if(old&&!replace)for(const k of ['inicio','vence','faseId','proyectoId','estado'])if(old.ganttLocal?.[k])dt[k]=old[k];dt.ganttLocal=replace?{}:(old?.ganttLocal||{});if(old&&!replace&&old.ganttLocal?.estado)dt.completada=Store.esTerminal(dt.estado)?old.completada||HOY():null;}
 return copy;
}
async function apply(d,replace=false,onProgress=()=>{}){
 const copy=prepare(d,replace),stats=await ProjectImportV5.apply(copy,onProgress);
 stats.fasesGuardadas=0;
 for(const dp of copy.proyectos){
  const old=Store.proy(dp.id);if(!old){stats.errores.push({tipo:'fases',error:'Proyecto no guardado',id:dp.id});continue;}
  try{const p=clone(old);p.fases=dp.fases;p.ganttModo=p.ganttModo||'tablero';await Store.saveProyecto(p);stats.fasesGuardadas+=p.fases.length;
   const disk=await FS.readJson(DIR_PROY+'/'+p.id+'.json');if(JSON.stringify(disk.fases)!==JSON.stringify(p.fases))throw new Error('Verificacion de fases fallida');
  }catch(e){stats.errores.push({tipo:'fases',id:dp.id,error:e.message});}
 }
 return stats;
}
// Marcar campos editados localmente; el importador escribe por separado y no marca cambios importados.
const saveTask=Store.saveTarea.bind(Store);
Store.saveTarea=async function(t,removed=[]){
 const old=Store.tarea(t.id),next={...t,ganttLocal:{...(t.ganttLocal||{})}};
 if(next.faseId&&!phase(Store.proy(next.proyectoId),next.faseId))throw new Error('La fase no pertenece al proyecto seleccionado.');
 if(old)for(const k of ['inicio','vence','faseId','proyectoId','estado'])if((old[k]||'')!==(next[k]||''))next.ganttLocal[k]=true;
 return saveTask(next,removed);
};
const reorder=Store.reordenar.bind(Store);
Store.reordenar=async function(col,ids){const prev=new Map(ids.map(id=>[id,Store.tarea(id)?.estado]));await reorder(col,ids);for(const id of ids){const t=Store.tarea(id);if(t&&prev.get(id)!==t.estado){t.ganttLocal={...(t.ganttLocal||{}),estado:true};await FS.writeJson(DIR_TAR+'/'+t.id+'.json',t);}}await Store.cache();};
function options(p,selected='',exclude=''){
 const forbidden=exclude?descendants(p,exclude):new Set();
 return '<option value="">Sin fase / nivel principal</option>'+phases(p).filter(f=>!forbidden.has(f.id)).map(f=>'<option value="'+f.id+'"'+(f.id===selected?' selected':'')+'>'+esc(path(p,f.id))+'</option>').join('');
}
function mountTask(){
 const form=document.getElementById('mForm');if(!form||!form.querySelector('[name=titulo]')||form.querySelector('[name=faseId]'))return;
 const p=Store.proy(form.querySelector('[name=proyectoId]')?.value),item=Store.tarea(M?.obj?.id);
 const box=document.createElement('div');box.className='full';box.innerHTML='<label>Fase / subfase</label><select name="faseId">'+options(p,item?.faseId||'')+'</select><div class="small muted">Se conserva en la siguiente importacion salvo que elijas reemplazar cambios locales.</div>';form.appendChild(box);
}
new MutationObserver(mountTask).observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(e.target.matches('#mForm [name=proyectoId]')){const sel=document.querySelector('#mForm [name=faseId]');if(sel)sel.innerHTML=options(Store.proy(e.target.value));}});
async function savePhase(pid,obj){
 const p=clone(Store.proy(pid));if(!p)throw new Error('Proyecto no encontrado.');p.fases=phases(p);
 if(!obj.nombre.trim())throw new Error('Indica nombre de fase.');
 if(!validParent(p,obj.id,obj.padreId))throw new Error('El padre no es valido o produce un ciclo.');
 if(obj.inicio&&obj.fin&&obj.fin<obj.inicio)throw new Error('Fin anterior al inicio.');
 const old=phase(p,obj.id),f={...obj,nombre:obj.nombre.trim(),local:{...(obj.local||{})}};
 for(const k of ['nombre','padreId','inicio','fin'])if(!old||(old[k]||'')!==(f[k]||''))f.local[k]=true;
 const i=p.fases.findIndex(x=>x.id===f.id);if(i<0)p.fases.push(f);else p.fases[i]=f;
 await Store.saveProyecto(p);return f;
}
function editPhase(id=''){
 const p=Store.proy(st.pid),f=clone(phase(p,id)||{id:uid('fase'),nombre:'',padreId:st.focus||'',inicio:'',fin:'',orden:Date.now()});
 openModal('<h4>'+ (id?'Editar fase':'Nueva fase / subfase')+'</h4><div class="form-grid"><div class="full"><label>Nombre</label><input id="fNombre" value="'+esc(f.nombre)+'"></div><div class="full"><label>Fase padre</label><select id="fPadre">'+options(p,f.padreId,f.id)+'</select></div><div><label>Inicio (vacio = rango de descendientes)</label><input id="fInicio" type="date" value="'+esc(f.inicio)+'"></div><div><label>Fin (vacio = rango de descendientes)</label><input id="fFin" type="date" value="'+esc(f.fin)+'"></div></div><p class="small muted">UID Project: '+esc(f.origen?.uid||'Fase manual')+'. Cambiar fechas no desplaza automaticamente sus tareas.</p><div class="modal-foot">'+(id?'<button class="btn danger" id="fDel">Eliminar fase vacia</button>':'')+'<button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="fSave">Guardar</button></div>');
 document.getElementById('fSave').onclick=async()=>{try{await savePhase(p.id,{...f,nombre:document.getElementById('fNombre').value,padreId:document.getElementById('fPadre').value,inicio:document.getElementById('fInicio').value,fin:document.getElementById('fFin').value});closeModal();render();}catch(e){toast(e.message,'err');}};
 if(id)document.getElementById('fDel').onclick=async()=>{try{if(phases(p).some(x=>x.padreId===id)||Store.tareas.some(t=>t.proyectoId===p.id&&t.faseId===id)||(p.hitos||[]).some(h=>h.faseId===id))throw new Error('La fase tiene subfases, tareas o hitos. Muevelos antes de eliminarla.');if(!confirm('Eliminar fase? Si es importada se recreara al reimportar.'))return;const c=clone(p);c.fases=phases(c).filter(x=>x.id!==id);await Store.saveProyecto(c);if(st.focus===id)st.focus='';closeModal();render();}catch(e){toast(e.message,'err');}};
}
function entries(p){
 const fs=phases(p),tasks=Store.tareas.filter(t=>t.proyectoId===p.id&&(st.arch||!t.archivada));
 const allowed=st.focus?descendants(p,st.focus):null;
 const all=[];
 const visit=(parent,depth)=>{
  for(const f of fs.filter(x=>(x.padreId||'')===parent).sort((a,b)=>(a.orden||0)-(b.orden||0))){all.push({kind:'fase',id:f.id,parent,depth,obj:f});visit(f.id,depth+1);}
  if(st.view!=='fases'){
   for(const t of tasks.filter(x=>(phase(p,x.faseId)?x.faseId:'')===parent))all.push({kind:'tarea',id:t.id,parent,depth,obj:t});
   for(const h of (p.hitos||[]).filter(x=>(phase(p,x.faseId)?x.faseId:'')===parent))all.push({kind:'hito',id:h.id,parent,depth,obj:h});
  }
 };visit('',0);
 let candidates=all.filter(e=>!allowed||allowed.has(e.id)||allowed.has(e.parent));
 if(st.q){const q=lc(st.q),keep=new Set();for(const e of candidates)if(lc(e.obj.nombre||e.obj.titulo).includes(q)){keep.add(e.id);if(e.kind==='fase'){const branch=descendants(p,e.id);for(const item of candidates)if(branch.has(item.id)||branch.has(item.parent))keep.add(item.id);}let parent=e.parent;while(parent){keep.add(parent);parent=phase(p,parent)?.padreId;}}
  return candidates.filter(e=>keep.has(e.id));
 }
 const rootDepth=st.focus?all.find(e=>e.id===st.focus)?.depth||0:0;
 return candidates.filter(e=>{if(e.depth-rootDepth>=st.depth)return false;let parent=e.parent;while(parent&&parent!==phase(p,st.focus)?.padreId){if(!st.opened.has(parent))return false;parent=phase(p,parent)?.padreId;}return true;});
}
function range(p,e){
 if(e.kind==='tarea')return [e.obj.inicio||e.obj.vence,e.obj.vence||e.obj.inicio];
 if(e.kind==='hito')return [e.obj.fecha,e.obj.fecha];
 const ids=descendants(p,e.id),ds=phases(p).filter(f=>ids.has(f.id)&&f.id!==e.id).flatMap(f=>[f.inicio,f.fin]);
 ds.push(...Store.tareas.filter(t=>t.proyectoId===p.id&&ids.has(t.faseId)).flatMap(t=>[t.inicio,t.vence]));
 ds.push(...(p.hitos||[]).filter(h=>ids.has(h.faseId)).map(h=>h.fecha));
 const dates=ds.filter(Boolean).sort();return [e.obj.inicio||dates[0],e.obj.fin||dates[dates.length-1]];
}
function render(params){
 if(params?.has('proyecto')){st.pid=params.get('proyecto');st.focus='';}
 if(!Store.proy(st.pid))st.pid=Store.proyectos[0]?.id||'';
 const p=Store.proy(st.pid);
 if(!p){app().innerHTML='<div class="empty">Crea un proyecto para ver su Gantt.</div>';return;}
 if(st.focus&&!phase(p,st.focus))st.focus='';
 const list=entries(p),dates=list.flatMap(e=>range(p,e)).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')).sort();
 const start=addDays(dates[0]||HOY(),-2),end=addDays(dates[dates.length-1]||HOY(),3),days=diffDays(start,end)+1;
 const width=st.fit?Math.max(0.05,Math.min(40,((document.querySelector('main')?.clientWidth||1000)-460)/Math.max(1,days))):st.zoom;
 const total=Math.max(1,days*width),off=d=>diffDays(start,d)*width;
 let ticks='';const step=width>=20?Math.max(1,Math.ceil(80/width)):width>=6?Math.max(7,Math.ceil(80/width/7)*7):Math.max(30,Math.ceil(80/width/30)*30);
 for(let i=0;i<days;i+=step)ticks+='<span style="position:absolute;left:'+i*width+'px">'+fmtF(addDays(start,i))+'</span>';
 const header='<div class="hg7-row hg7-header"><div class="hg7-label">Fase / actividad · fechas · avance</div><div class="hg7-track" style="width:'+total+'px">'+ticks+'</div></div>';
 const rows=list.map(e=>{
  const f=e.obj,name=f.nombre||f.titulo,r=range(p,e),valid=r[0]&&r[1]&&r[1]>=r[0];
  const pct=e.kind==='fase'?percent(p,e.id):e.kind==='tarea'?(Store.esTerminal(f.estado)?100:0):(f.hecho?100:0);
  let bar=valid?'<button class="hg7-bar" data-g7edit="'+e.id+'" data-kind="'+e.kind+'" style="left:'+off(r[0])+'px;width:'+Math.max(8,(diffDays(r[0],r[1])+1)*width)+'px;--bc:'+esc(p.color||'#2563eb')+'" title="'+esc(name)+(e.kind==='fase'&&duration(f)?' · '+duration(f):'')+' · '+fmtF(r[0])+' → '+fmtF(r[1])+'"><span style="width:'+(pct??0)+'%"></span></button>':'';
  if(e.kind==='hito'&&valid)bar='<span class="hg7-diamond" style="left:'+off(r[0])+'px" title="'+esc(name)+'"></span>';
  const indent=Math.min(e.depth,10)*16;
  return '<div class="hg7-row"><div class="hg7-label" style="padding-left:'+(8+indent)+'px" title="'+esc(name)+'"><div>'+(e.kind==='fase'?'<button class="btn sm" data-g7toggle="'+e.id+'">'+(st.opened.has(e.id)?'−':'+')+'</button> ':'')+'<button class="hg7-name" data-g7edit="'+e.id+'" data-kind="'+e.kind+'">'+esc(name)+'</button></div><div class="muted small">'+(valid?fmtF(r[0])+' → '+fmtF(r[1]):'Sin rango valido')+' · '+(pct===null?'Sin % Project':pct+'%')+(e.kind==='fase'&&duration(f)?' · '+duration(f):'')+'</div></div><div class="hg7-track" style="width:'+total+'px;background-size:'+Math.max(1,width)+'px 100%">'+bar+'</div></div>';
 }).join('');
 app().innerHTML='<div class="page-head"><h3>Gantt jerarquico</h3><div class="filters"><select id="g7Project">'+opcionesProy(st.pid,'Seleccionar proyecto')+'</select><button class="btn primary" id="g7Add">＋ Fase / subfase</button></div></div>'+
 '<div class="card filters" style="margin-bottom:12px"><select id="g7Focus"><option value="">Todas las fases</option>'+phases(p).map(f=>'<option value="'+f.id+'"'+(f.id===st.focus?' selected':'')+'>'+esc(path(p,f.id))+'</option>').join('')+'</select><select id="g7View"><option value="todo"'+(st.view==='todo'?' selected':'')+'>Fases y actividades</option><option value="fases"'+(st.view==='fases'?' selected':'')+'>Solo fases / subfases</option></select><select id="g7Mode"><option value="tablero"'+(p.ganttModo!=='project'?' selected':'')+'>Avance del tablero</option><option value="project"'+(p.ganttModo==='project'?' selected':'')+'>Avance original Project</option></select><select id="g7Depth">'+[[1,'Un nivel'],[2,'Dos niveles'],[3,'Tres niveles'],[99,'Todos los niveles']].map(([n,s])=>'<option value="'+n+'"'+(st.depth===n?' selected':'')+'>'+s+'</option>').join('')+'</select><input id="g7Search" placeholder="Buscar" value="'+esc(st.q)+'"><button class="btn" id="g7Expand">Expandir</button><button class="btn" id="g7Collapse">Contraer</button><select id="g7Zoom">'+[[28,'Dia'],[10,'Semana'],[3,'Mes']].map(([n,s])=>'<option value="'+n+'"'+(st.zoom===n?' selected':'')+'>'+s+'</option>').join('')+'</select><button class="btn" id="g7Fit">Ajustar a seleccion</button><label><input type="checkbox" id="g7Arch" '+(st.arch?'checked':'')+'> Archivadas</label></div>'+
 (!phases(p).length?'<div class="banner">Reimporta el XML con esta version para recuperar fases y sus fechas. Tambien puedes crearlas manualmente.</div>':'')+
 '<div class="hg7" id="g7Box">'+header+rows+'</div><p class="muted small">'+list.length+' filas visibles. Avance del tablero: terminadas / actividades descendientes, incluidas archivadas; fases e hitos no cuentan como actividades. Los cambios de fase no reprograman las tareas. El porcentaje original Project aplica a fases; en actividades se muestra estado del tablero.</p>';
 const el=id=>document.getElementById(id);
 const change=(id,fn)=>el(id).onchange=async e=>{try{await fn(e.target);render();}catch(err){toast(err.message,'err');}};
 change('g7Project',x=>{st.pid=x.value;st.focus='';st.opened.clear();});
 change('g7Focus',x=>{st.focus=x.value;st.opened.clear();if(x.value)st.opened.add(x.value);st.fit=true;});
 change('g7View',x=>st.view=x.value);change('g7Depth',x=>st.depth=Number(x.value));change('g7Search',x=>st.q=x.value);
 change('g7Zoom',x=>{st.zoom=Number(x.value);st.fit=false;});change('g7Arch',x=>st.arch=x.checked);
 change('g7Mode',async x=>{const c=clone(p);c.ganttModo=x.value;await Store.saveProyecto(c);});
 el('g7Add').onclick=()=>editPhase();el('g7Expand').onclick=()=>{phases(p).forEach(f=>st.opened.add(f.id));render();};el('g7Collapse').onclick=()=>{st.opened.clear();render();};el('g7Fit').onclick=()=>{st.fit=true;render();};
 app().querySelectorAll('[data-g7toggle]').forEach(b=>b.onclick=()=>{const id=b.dataset.g7toggle;if(st.opened.has(id))st.opened.delete(id);else st.opened.add(id);render();});
 app().querySelectorAll('[data-g7edit]').forEach(b=>b.onclick=()=>{if(b.dataset.kind==='fase')editPhase(b.dataset.g7edit);else if(b.dataset.kind==='tarea')abrirTarea(b.dataset.g7edit);else toast('Edita el hito desde la ficha del proyecto.');});
}
// Este listener se registra antes del de v5 y sustituye solo la carga XML de Project.
document.addEventListener('change',async e=>{
 const input=e.target;if(busy&&input.matches('input[type=file]')){e.stopImmediatePropagation();input.value='';toast('Hay una importacion en curso.','warn');return;}
 if(input.id!=='fileImpMsp')return;e.stopImmediatePropagation();const file=input.files?.[0];input.value='';if(!file)return;busy=true;let overlay;
 const unload=ev=>{ev.preventDefault();ev.returnValue='';};window.addEventListener('beforeunload',unload);
 try{
  await Store.require();const txt=await file.text(),doc=new DOMParser().parseFromString(txt,'application/xml');let key='';
  if(!doc.querySelector('parsererror')&&!val(doc.documentElement,'GUID')){key=prompt('Clave estable para este plan sin GUID (reutiliza la misma clave de v5):',val(doc.documentElement,'Title'));if(key===null)return;}
  const d=await enrich(txt,key),p=ProjectImportV5.preview(d),count=d.proyectos.reduce((n,p)=>n+p.fases.length,0);
  if(!confirm('Project: '+d.tareas.length+' tareas, '+count+' fases/subfases. Nuevas: '+p.tareasNuevas+'; actualizadas: '+p.tareasActualizadas+'. Se conservan por defecto las ediciones locales. Continuar?'))return;
  const edited=d.tareas.some(t=>Object.keys(Store.tarea(t.id)?.ganttLocal||{}).length)||d.proyectos.some(p=>phases(Store.proy(p.id)).some(f=>Object.keys(f.local||{}).length));
  const replace=edited&&confirm('REEMPLAZAR los campos editados localmente con las fechas, ubicaciones y estados del XML? Aceptar = reemplazar. Cancelar = conservar cambios locales y continuar. Las fases manuales siempre se conservan.');
  overlay=document.createElement('div');overlay.className='modal-ov';overlay.style.zIndex='150';overlay.innerHTML='<div class="modal-box"><h4>Importando estructura Project</h4><p class="progress">Preparando...</p></div>';document.body.appendChild(overlay);
  const stats=await apply(d,replace,(n,total)=>overlay.querySelector('.progress').textContent=n+' / '+total+' tareas');
  refrescar();openModal('<h4>Resultado Project v7</h4><pre class="nota">'+esc(JSON.stringify(stats,null,2))+'</pre><p>Las cargas anteriores sin UID no se eliminan. La escritura es por registro; puedes reintentar sin duplicar con el mismo GUID/UID.</p><div class="modal-foot"><button class="btn primary" data-act="cerrar">Cerrar</button></div>');
 }catch(err){console.error(err);toast('Importacion detenida: '+err.message,'err');}finally{overlay?.remove();busy=false;window.removeEventListener('beforeunload',unload);}
},true);
RUTAS.gantt=render;
window.GanttV7={enrich,prepare,apply,percent,descendants,validParent,savePhase,entries,render,state:st};
})();
