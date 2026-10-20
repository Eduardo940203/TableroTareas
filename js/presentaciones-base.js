/* Tablero v4: PowerPoint editable OOXML; utiliza zipStore de intercambio.js. Sin red. */
(() => {
  'use strict';
  const X = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const A='http://schemas.openxmlformats.org/drawingml/2006/main', P='http://schemas.openxmlformats.org/presentationml/2006/main', R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
  const rel=items=>xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')+'</Relationships>');
  const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const text=(id,name,lines,x,y,w,h,size,color)=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${lines.map(s=>`<a:p><a:pPr><a:spcAft><a:spcPts val="600"/></a:spcAft></a:pPr><a:r><a:rPr lang="es-MX" sz="${size}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${X(s)}</a:t></a:r><a:endParaRPr lang="es-MX" sz="${size}"/></a:p>`).join('')}</p:txBody></p:sp>`;
  function packagePpt(slides,title,color) {
    const files=[],add=(nombre,contenido)=>files.push({nombre,contenido});
    add('[Content_Types].xml',xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+[['/ppt/presentation.xml','presentation'],['/ppt/slideMasters/slideMaster1.xml','slideMaster'],['/ppt/slideLayouts/slideLayout1.xml','slideLayout'],['/ppt/theme/theme1.xml','theme'],...slides.map((_,i)=>['/ppt/slides/slide'+(i+1)+'.xml','slide'])].map(([p,t])=>`<Override PartName="${p}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.${t}+xml"/>`).join('')+'</Types>'));
    // Theme has its own DrawingML content type.
    files[0].contenido=files[0].contenido.replace('presentationml.presentation+xml','presentationml.presentation.main+xml').replace('application/vnd.openxmlformats-officedocument.presentationml.theme+xml','application/vnd.openxmlformats-officedocument.theme+xml');
    add('_rels/.rels',rel([['rId1','officeDocument','ppt/presentation.xml']]));
    add('ppt/presentation.xml',xml(`<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`));
    add('ppt/_rels/presentation.xml.rels',rel([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...slides.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]));
    add('ppt/slideMasters/slideMaster1.xml',xml(`<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`));
    add('ppt/slideMasters/_rels/slideMaster1.xml.rels',rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],['rId2','theme','../theme/theme1.xml']]));
    add('ppt/slideLayouts/slideLayout1.xml',xml(`<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1"><p:cSld name="Blanco"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`));
    add('ppt/slideLayouts/_rels/slideLayout1.xml.rels',rel([['rId1','slideMaster','../slideMasters/slideMaster1.xml']]));
    const colors={dk1:'1F2937',lt1:'FFFFFF',dk2:'475569',lt2:'F4F6FA',accent1:color,accent2:'16A34A',accent3:'D97706',accent4:'DC2626',accent5:'7C3AED',accent6:'0891B2',hlink:'2563EB',folHlink:'7C3AED'};
    const fill='<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    add('ppt/theme/theme1.xml',xml(`<a:theme xmlns:a="${A}" name="Tablero"><a:themeElements><a:clrScheme name="Tablero">${Object.entries(colors).map(([k,v])=>`<a:${k}><a:srgbClr val="${v}"/></a:${k}>`).join('')}</a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Basico"><a:fillStyleLst>${fill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[6350,12700,19050].map(w=>`<a:ln w="${w}">${fill}<a:prstDash val="solid"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`));
    slides.forEach((s,i)=>{
      add(`ppt/slides/slide${i+1}.xml`,xml(`<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}${text(2,'Titulo',[s.title],457200,300000,11277600,700000,2800,color)}${text(3,'Contenido',s.lines,457200,1200000,11277600,4800000,1800,'1F2937')}${text(4,'Pie',[title.slice(0,85)+' | '+(i+1)+' / '+slides.length],457200,6300000,11277600,300000,1000,'64748B')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`));
      add(`ppt/slides/_rels/slide${i+1}.xml.rels`,rel([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']]));
    });
    return files;
  }
  function build(o) {
    const ps=Store.proyectos.filter(p=>!o.pid||p.id===o.pid);
    const ts=Store.tareas.filter(t=>(!o.pid||t.proyectoId===o.pid)&&(o.archivadas||!t.archivada));
    const slides=[],clip=(s,n=105)=>String(s||'').replace(/\s+/g,' ').slice(0,n);
    const add=(title,lines)=>{
      const wrapped=[];
      for(const line of lines){
        let v=String(line); while(v.length>105){let n=v.lastIndexOf(' ',105);if(n<30)n=105;wrapped.push(v.slice(0,n));v=v.slice(n).trimStart();}wrapped.push(v);
      }
      if(!wrapped.length)wrapped.push('Sin registros.');
      for(let i=0;i<wrapped.length;i+=9)slides.push({title:title+(i?' (continuación)':''),lines:wrapped.slice(i,i+9)});
    };
    const pn=id=>Store.proy(id)?.nombre||'Sin proyecto',done=t=>Store.esTerminal(t.estado),fecha=f=>f?fmtF(f):'Sin fecha';
    add(o.title,[o.pid?pn(o.pid):'Todos los proyectos','Fecha de corte: '+fecha(o.cut),'Responsable: '+(Store.config.responsable||'No indicado'),'Estado actual de los datos; no representa una reconstrucción histórica.']);
    if(o.resumen)add('Resumen general',['Proyectos: '+ps.length,'Tareas incluidas: '+ts.length,...Store.config.columnas.map(c=>c.nombre+': '+ts.filter(t=>t.estado===c.id).length),'Vencidas al corte: '+ts.filter(t=>!done(t)&&t.vence&&t.vence<o.cut).length]);
    if(o.avance)add('Avance por proyecto',ps.map(p=>{const a=avance(p.id);return clip(p.nombre,55)+' | '+p.estado+' | '+a.hechas+'/'+a.total+' terminadas ('+a.pct+'%) | Fin: '+fecha(p.fin);}).concat(['Avance según el tablero: incluye tareas archivadas.']));
    if(o.tareas){
      const orden={critica:0,alta:1,media:2,baja:3};
      const pendientes=ts.filter(t=>!done(t)).sort((a,b)=>(orden[a.prioridad]??9)-(orden[b.prioridad]??9)||(a.vence||'9999').localeCompare(b.vence||'9999'));
      add('Actividades pendientes y prioritarias',pendientes.flatMap(t=>[clip(t.titulo,95)+' | '+(Store.col(t.estado)?.nombre||t.estado)+' | '+t.prioridad,clip(pn(t.proyectoId),45)+' | '+clip(t.responsable||'Sin responsable',25)+' | Vence: '+fecha(t.vence)]));
    }
    if(o.hitos)add('Hitos',ps.flatMap(p=>(p.hitos||[]).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(h=>clip(p.nombre,35)+' | '+clip(h.nombre,45)+' | '+fecha(h.fecha)+' | '+(h.hecho?'Cumplido':'Pendiente'))));
    if(o.notas)add('Notas de seguimiento',[...ps.flatMap(p=>(p.notas||[]).map(n=>p.nombre+': '+n.texto)),...(o.pid?[]:Store.notasGen.map(n=>'General: '+n.texto))]);
    const color=/^#[0-9a-f]{6}$/i.test(Store.config.colorPrimario||'')?Store.config.colorPrimario.slice(1):'2563EB';
    return packagePpt(slides,o.title,color);
  }
  function dialog(pid='') {
    openModal('<h4>Generar presentación PowerPoint</h4><div class="form-grid"><div class="full"><label>Título</label><input id="pptTitle" value="Seguimiento de proyectos"></div><div><label>Alcance</label><select id="pptPid">'+opcionesProy(pid,'Todo el tablero')+'</select></div><div><label>Fecha de corte</label><input id="pptCut" type="date" value="'+HOY()+'"></div><div class="full">'+[['resumen','Resumen general',true],['avance','Avance por proyecto',true],['tareas','Pendientes prioritarios',true],['hitos','Hitos',true],['notas','Notas (pueden contener información sensible)',false],['archivadas','Incluir tareas archivadas',false]].map(([id,label,on])=>'<label style="display:block;margin:8px 0"><input type="checkbox" id="ppt_'+id+'" style="width:auto" '+(on?'checked':'')+'> '+label+'</label>').join('')+'</div></div><p class="muted small">Portada incluida. Se usan los datos actuales. No se exportan conexiones, passwords ni adjuntos. Textos editables; notas largas generan más diapositivas.</p><div class="modal-foot"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" id="pptDownload">Generar .pptx</button></div>');
    document.getElementById('pptDownload').onclick=()=>{
      try{
        const o={title:document.getElementById('pptTitle').value.trim(),pid:document.getElementById('pptPid').value,cut:document.getElementById('pptCut').value};
        if(!o.title||!o.cut)return toast('Indica título y fecha de corte.','warn');
        for(const k of ['resumen','avance','tareas','hitos','notas','archivadas'])o[k]=document.getElementById('ppt_'+k).checked;
        const blob=new Blob([zipStore(build(o))],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
        descargarBlob(blob,'seguimiento-'+o.cut+'.pptx');closeModal();toast('Presentación generada.');
      }catch(e){console.error(e);toast('No se pudo generar: '+e.message,'err');}
    };
  }
  function mount(){
    if(document.getElementById('pptOpen'))return;
    const [route,params]=parseHash();let target,pid='';
    if(route==='config')target=document.getElementById('xchgProy')?.closest('.card');
    if(route==='proyecto'){pid=params.get('id')||'';if(Store.proy(pid))target=document.querySelector('#app .page-head .filters');}
    if(!target)return;
    const b=document.createElement('button');b.id='pptOpen';b.className='btn';b.textContent='Generar presentación';b.style.marginTop='8px';b.onclick=()=>dialog(route==='config'?(document.getElementById('xchgProy')?.value||''):pid);target.appendChild(b);
  }
  new MutationObserver(mount).observe(document.getElementById('app'),{childList:true,subtree:true});
  mount();
  // Expuesto para pruebas automatizadas sin descargar ni modificar datos.
  window.TableroPpt={build};
})();

