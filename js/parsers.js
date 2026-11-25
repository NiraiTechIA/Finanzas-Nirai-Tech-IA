/* FINANZAS NIRAI TECH IA — lectores de archivos (PDF, Excel, CSV) y conversión de resultados de la IA.
   Los lectores exactos (Visa, American Express Santander, Mercado Pago) vienen de la versión 1 y controlan que el total cuadre. */
let workerReady=false;
function initPdf(){if(workerReady)return;pdfjsLib.GlobalWorkerOptions.workerSrc='js/vendor/pdf.worker.min.js';workerReady=true}
function mkCierre(y,m,d){const dt=new Date(y,m-1,d-15);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')}
const workYear=()=>+((typeof UI!=='undefined'&&UI.month)||todayIso()).slice(0,4);
function groupRows(items){
  items.sort((a,b)=>a.y-b.y||a.x-b.x);
  const rows=[];
  for(const it of items){
    const r=rows[rows.length-1];
    if(r&&Math.abs(it.y-r.y)<=2.6){r.items.push(it);r.ys.push(it.y);r.y=r.ys.reduce((a,b)=>a+b,0)/r.ys.length}
    else rows.push({y:it.y,ys:[it.y],items:[it]});
  }
  for(const r of rows){r.items.sort((a,b)=>a.x-b.x);r.text=r.items.map(i=>i.s).join(' ')}
  return rows;
}
async function pdfPages(file){
  initPdf();
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),vp=page.getViewport({scale:1}),tc=await page.getTextContent();
    const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str.trim(),x:i.transform[4],y:vp.height-i.transform[5]}));
    pages.push({n:p,rows:groupRows(items)});
  }
  return pages;
}
function amountIn(items,x0,x1){
  const its=items.filter(i=>i.x>=x0&&i.x<x1);if(!its.length)return null;
  const t=its.map(i=>i.s).join(' '),m=t.match(/(-?)\s*\$?\s*(-?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if(!m)return null;const v=parseAR(m[3]);return(m[1]==='-'||m[2]==='-')?-v:v;
}
const cleanDesc=s=>s.replace(/\(.*?\)/g,'').replace(/\s*\$\s*$/,'').replace(/\s+/g,' ').trim();

async function parseVisaPdf(file,pages0){
  const pages=pages0||await pdfPages(file),rows=pages.flatMap(p=>p.rows.map(r=>({...r,page:p.n})));
  const meta={fuente:'pdf',archivo:file.name,pagos:[],cuotasProx:[]},txs=[];
  let state_=null,lastDate=null;
  // fechas de cierre (página 1)
  for(const r of rows.filter(r=>r.page===1)){
    const ds=r.text.match(/\b\d{2}\/\d{2}\/\d{2}\b/g);
    if(ds&&ds.length>=4&&r.text.replace(/\b\d{2}\/\d{2}\/\d{2}\b/g,'').trim()===''){meta.fechas=ds;break}
  }
  // próximas cuotas (página 1)
  const p1=rows.filter(r=>r.page===1);
  const ix=p1.findIndex(r=>/proximas cuotas a vencer/.test(norm(r.text)));
  if(ix>=0){
    for(let j=ix+1;j<Math.min(ix+6,p1.length);j++){
      const ms=[...p1[j].text.matchAll(/(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})/gi)];
      if(ms.length>=1){
        const am=[...(p1[j+1]||{text:''}).text.matchAll(/\$\s*([\d.]+,\d{2})/g)].map(m=>parseAR(m[1]));
        meta.cuotasProx=ms.map((m,k)=>({mes:m[1]+' '+m[2],monto:am[k]!=null?am[k]:0}));break;
      }
    }
  }
  for(const r of rows){
    const T=r.text,N=norm(T);
    if(/^pago anterior y devoluciones/.test(N)){state_='pagos';continue}
    if(/^movimientos de /.test(N)){state_='consumos';continue}
    if(/^impuestos, intereses y percepciones/.test(N)){state_='imp';continue}
    if(/^terminos y condiciones/.test(N)){state_=null;continue}
    if(/^total a pagar/.test(N)){const a=amountIn(r.items,300,478);if(a!=null&&meta.total==null){meta.total=a;meta.totalUsd=amountIn(r.items,478,999)}state_=null;continue}
    if(/^subtotal de /.test(N)){meta.subtotal=amountIn(r.items,300,478);continue}
    if(state_==='pagos'){
      if(/su pago en pesos/.test(N)){const a=amountIn(r.items,300,478);if(a!=null)meta.pagos.push(Math.abs(a))}
      if(/^saldo del resumen anterior/.test(N)){meta.saldoAnterior=amountIn(r.items,300,478)}
      continue;
    }
    if(state_!=='consumos'&&state_!=='imp')continue;
    const first=r.items[0];let date=null;
    if(first&&first.x<80){const m=first.s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);if(m)date=iso(m[1],m[2],m[3])}
    const ars=amountIn(r.items,350,478),usd=amountIn(r.items,478,999);
    if(ars==null&&usd==null)continue;
    const desc=cleanDesc(r.items.filter(i=>i.x>=95&&i.x<245).map(i=>i.s).join(' '));
    if(!desc)continue;
    if(date)lastDate=date;
    const cm=r.items.filter(i=>i.x>=245&&i.x<296).map(i=>i.s).join(' ').match(/(\d+)\s*de\s*(\d+)/);
    txs.push({id:uid(),fecha:date||lastDate,desc,monto:ars!=null?-ars:0,usd:usd||0,cuota:cm?[+cm[1],+cm[2]]:null,seccion:state_});
  }
  if(!txs.length)throw new Error('no encontré movimientos; ¿es el resumen Visa en PDF?');
  if(meta.saldoAnterior!=null&&meta.saldoAnterior<-0.5){
    const f=meta.fechas&&meta.fechas[0]?(([d,m,y])=>iso(d,m,y))(meta.fechas[0].split('/').map(Number)):null;
    txs.push({id:uid(),fecha:f,desc:'Saldo a favor del resumen anterior',monto:-meta.saldoAnterior,usd:0,cuota:null,seccion:'credito'});
  }else if(meta.saldoAnterior!=null&&meta.saldoAnterior>0.5){meta.aviso='El resumen anterior tenía un saldo impago de '+$2(meta.saldoAnterior)+' que no se suma como gasto.'}
  const suma=-txs.reduce((a,t)=>a+t.monto,0);
  meta.suma=suma;meta.control=meta.total!=null?Math.round((suma-meta.total)*100)/100:null;
  if(meta.fechas&&meta.fechas[2]){
    const [d,m,y]=meta.fechas[2].split('/').map(Number);
    meta.monthKey=mkCierre(2000+y,m,d);meta.cierre=iso(d,m,y);
  }
  const lm=rows.map(r=>r.text).join(' ').match(/terminada en\s+(\d{4})/i);
  meta.card={kind:'visa',last4:lm?lm[1]:null,nombre:'Visa'+(lm?' ···'+lm[1]:'')};
  return {meta,txs};
}

async function parseMpPdf(file){return parseMpPdfPages(file,await pdfPages(file))}
async function parseMpPdfPages(file,pages){
  const txs=[],meta={fuente:'pdf',archivo:file.name};
  const all=pages.flatMap(p=>p.rows).map(r=>r.text).join('\n');
  const g=re=>{const m=all.match(re);return m?parseAR(m[1]):null};
  meta.inicial=g(/Saldo inicial:\s*\$?\s*(-?[\d.]+,\d{2})/i);meta.final=g(/Saldo final:\s*\$?\s*(-?[\d.]+,\d{2})/i);
  meta.entradas=g(/Entradas:\s*\$?\s*(-?[\d.]+,\d{2})/i);meta.salidas=g(/Salidas:\s*\$?\s*(-?[\d.]+,\d{2})/i);
  const pm=all.match(/Del\s+\d+\s+al\s+\d+\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if(pm){const mi=MESES.indexOf(norm(pm[1]));if(mi>=0)meta.monthKey=pm[2]+'-'+String(mi+1).padStart(2,'0')}
  const nm=pages[0].rows.findIndex(r=>/resumen de cuenta/.test(norm(r.text)));
  if(nm>=0&&pages[0].rows[nm+1])meta.nombre=pages[0].rows[nm+1].text;
  for(const pg of pages){
    const anchors=[],others=[];
    for(const r of pg.rows){
      const f=r.items[0],isDate=f&&f.x<80&&/^\d{2}-\d{2}-\d{4}$/.test(f.s);
      const valor=amountIn(r.items,255,345),saldo=amountIn(r.items,345,440);
      if(isDate&&valor!=null){
        const m=f.s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        anchors.push({y:r.y,fecha:iso(m[1],m[2],m[3]),valor,saldo,lines:[{y:r.y,t:r.items.filter(i=>i.x>=85&&i.x<190).map(i=>i.s).join(' ')}],id:(r.items.find(i=>i.x>=190&&i.x<255&&/^\d{8,}$/.test(i.s))||{}).s});
      }else others.push(r);
    }
    if(!anchors.length)continue;
    for(const r of others){
      if(r.items.some(i=>i.x<85))continue;
      const its=r.items.filter(i=>i.x>=85&&i.x<190);if(!its.length||its.length!==r.items.length)continue;
      let best=null,bd=1e9;for(const a of anchors){const d=Math.abs(a.y-r.y);if(d<bd){bd=d;best=a}}
      if(best&&bd<=16)best.lines.push({y:r.y,t:its.map(i=>i.s).join(' ')});
    }
    for(const a of anchors){
      a.lines.sort((p,q)=>p.y-q.y);
      txs.push({id:uid(),fecha:a.fecha,desc:a.lines.map(l=>l.t).join(' ').replace(/\s+/g,' ').trim(),monto:a.valor,saldo:a.saldo,opId:a.id||null,usd:0,cuota:null});
    }
  }
  if(!txs.length)throw new Error('no encontré movimientos; ¿es el resumen de cuenta de Mercado Pago en PDF?');
  const suma=txs.reduce((a,t)=>a+t.monto,0);
  meta.suma=suma;meta.control=(meta.inicial!=null&&meta.final!=null)?Math.round((meta.inicial+suma-meta.final)*100)/100:null;
  return {meta,txs};
}

/* ============================ Lectura de Excel / CSV (experimental) ============================ */
function parseDateAny(v){
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
  const s=String(v||'').trim();let m;
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)))return iso(m[1],m[2],m[3]);
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return m[0].slice(0,10);
  return null;
}
async function parseTableFile(file,kind){
  const isCsv=/\.(csv|txt)$/i.test(file.name||'');   // CSV: leer como texto (si no, "3.000,00" se toma como 3)
  const wb=XLSX.read(await file.arrayBuffer(),isCsv?{type:'array',raw:true}:{type:'array',cellDates:true,raw:false});
  const ws=wb.Sheets[wb.SheetNames[0]],aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  let hi=-1,cF,cD,cM,cDeb,cCred,cId,cCuota;
  for(let i=0;i<Math.min(aoa.length,40);i++){
    const h=aoa[i].map(x=>norm(x).trim());
    const f=h.findIndex(x=>/^(fecha|date|release_date|fecha de (la )?operacion|fecha de origen)/.test(x)),d=h.findIndex(x=>/descrip|detalle|concepto|comercio|establecimiento|operacion$|transaction_type|tipo de operacion|movimiento/.test(x));
    const m=h.findIndex(x=>/^(monto|valor|importe|total|transaction_net_amount|net_amount|amount|importe en pesos|pesos)/.test(x));
    const deb=h.findIndex(x=>/^(debito|debitos|egreso|salida)/.test(x)),cred=h.findIndex(x=>/^(credito|creditos|ingreso|entrada)/.test(x));
    if(f>=0&&d>=0&&(m>=0||(deb>=0&&cred>=0))){hi=i;cF=f;cD=d;cM=m;cDeb=deb;cCred=cred;cId=h.findIndex(x=>/reference_id|id de operacion|nro|numero de operacion|operation_id/.test(x));cCuota=h.findIndex(x=>/^cuota/.test(x));break}
  }
  if(hi<0)throw new Error('no reconocí las columnas (necesito Fecha, Descripción y Monto)');
  const txs=[];
  for(const r of aoa.slice(hi+1)){
    const fecha=parseDateAny(r[cF]),desc=String(r[cD]||'').trim();
    let monto;
    if(cM>=0)monto=typeof r[cM]==='number'?r[cM]:parseAR(r[cM]);
    else{const de=typeof r[cDeb]==='number'?r[cDeb]:parseAR(r[cDeb])||0,cr=typeof r[cCred]==='number'?r[cCred]:parseAR(r[cCred])||0;monto=cr-Math.abs(de)}
    if(!fecha||!desc||monto==null||monto===0)continue;
    const cm=cCuota>=0?String(r[cCuota]||'').match(/(\d+)\s*(?:de|\/)\s*(\d+)/):null;
    txs.push({id:uid(),fecha,desc,monto:kind==='tarjeta'?-monto:monto,usd:0,cuota:cm?[+cm[1],+cm[2]]:null,opId:cId>=0&&r[cId]?String(r[cId]):null});
  }
  if(!txs.length)throw new Error('el archivo no tiene movimientos reconocibles');
  const dates=txs.map(t=>t.fecha).sort();
  const head=norm(aoa[hi].join(' '));
  return {meta:{fuente:'excel',archivo:file.name,monthKey:dates[Math.floor(dates.length/2)].slice(0,7),suma:txs.reduce((a,t)=>a+t.monto,0),control:null,pagos:[],cuotasProx:[],head},txs};
}

/* ---- American Express (Santander) en PDF ---- */
const MES3=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const mes3=t=>MES3.indexOf(norm(t).slice(0,3));
function amexAmt(items,x0,x1){
  const its=items.filter(i=>i.x>=x0&&i.x<x1);if(!its.length)return null;
  const m=its.map(i=>i.s).join(' ').match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(-?)/);
  if(!m)return null;const v=parseAR(m[1]);return m[2]==='-'?-v:v;
}
function parseAmexPdf(file,pages){
  const rows=pages.flatMap(p=>p.rows.map(r=>({...r,page:p.n}))),meta={fuente:'pdf',archivo:file.name,pagos:[],cuotasProx:[]},txs=[];
  const all=rows.map(r=>r.text).join('\n');
  const cm=all.match(/CIERRE\s*(\d{1,2})\s*([A-Za-z]{3})\w*\.?\s*(\d{2})(?!\d)/),vm=all.match(/VENCIMIENTO\s*(\d{1,2})\s*([A-Za-z]{3})\w*\.?\s*(\d{2})(?!\d)/);
  let cy=null,cmo=null,cd=null;
  if(cm&&mes3(cm[2])>=0){cd=+cm[1];cmo=mes3(cm[2])+1;cy=2000+ +cm[3];meta.cierre=iso(cd,cmo,cy);meta.monthKey=mkCierre(cy,cmo,cd)}
  if(vm&&mes3(vm[2])>=0)meta.vencimiento=iso(+vm[1],mes3(vm[2])+1,2000+ +vm[3]);
  const tm=all.match(/Tarjeta\s+(\d{4})\s+Total Consumos/i);
  meta.card={kind:'amex',last4:tm?tm[1]:null,nombre:'American Express'+(tm?' ···'+tm[1]:'')};
  for(const r of rows){
    const N=norm(r.text);
    if(/saldo\s*anterior/.test(N)&&meta.saldoAnterior==null){const a=amexAmt(r.items,380,500);if(a!=null)meta.saldoAnterior=a}
    if(/saldo\s*actual/.test(N)){const a=amexAmt(r.items,380,500);if(a!=null&&meta.total==null){meta.total=a;meta.totalUsd=amexAmt(r.items,500,999)}}
    if(/pago\s*minimo/.test(N)){const a=amexAmt(r.items,380,520);if(a!=null&&meta.minimo==null)meta.minimo=a}
    const f=r.items[0],g=r.items[1];if(!f||f.x>=40)continue;
    let dd,mm;
    let m1=f.s.match(/^(\d{1,2})\s*([A-Za-zñ]{3,})\.?(?:\s|$)/);
    if(m1){dd=+m1[1];mm=mes3(m1[2])}
    else if(/^\d{1,2}$/.test(f.s)&&g&&/^[A-Za-zñ]{3,}\.?$/.test(g.s)){dd=+f.s;mm=mes3(g.s)}
    else continue;
    if(mm==null||mm<0)continue;
    const ars=amexAmt(r.items,380,500),usd=amexAmt(r.items,500,999);
    if(ars==null&&usd==null)continue;
    const desc=cleanDesc(r.items.filter(i=>i.x>=130&&i.x<380&&i.s!=='$'&&i.s!=='*').map(i=>i.s).join(' '));
    if(!desc)continue;
    let yy=cy||new Date().getFullYear();if(cmo!=null&&mm+1>cmo)yy=cy-1;
    const fecha=iso(dd,mm+1,yy);
    if(/^su pago/.test(norm(desc))){if(ars!=null)meta.pagos.push(Math.abs(ars));continue}
    txs.push({id:uid(),fecha,desc,monto:ars!=null?-ars:0,usd:usd||0,cuota:null});
  }
  if(meta.total==null&&!txs.length)throw new Error('no encontré movimientos ni saldo; ¿es el resumen de American Express (Santander) en PDF?');
  const suma=-txs.reduce((a,t)=>a+t.monto,0),pg=meta.pagos.reduce((a,b)=>a+b,0);
  meta.suma=suma;meta.control=(meta.total!=null&&meta.saldoAnterior!=null)?Math.round(((meta.saldoAnterior-pg+suma)-meta.total)*100)/100:null;
  if(meta.total!=null&&meta.total<-0.005)meta.aviso='Este resumen cierra con saldo a favor de '+$2(-meta.total)+'.';
  else if(meta.saldoAnterior!=null&&meta.saldoAnterior-pg>0.5)meta.aviso='El resumen anterior tenía un saldo impago de '+$2(meta.saldoAnterior-pg)+' que no se suma como gasto.';
  return {meta,txs};
}

/* ---- Visa en Excel (el que baja el banco) ---- */
const moneyCell=v=>{if(typeof v==='number')return v;if(v==null||String(v).trim()==='')return null;return parseAR(v)};
async function parseVisaXlsx(file){
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  const meta={fuente:'excel',archivo:file.name,pagos:[],cuotasProx:[]},txs=[];
  let st=null,last=null,last4=null;
  for(let i=0;i<aoa.length;i++){
    const r=aoa[i],c0=norm(r[0]),c1=norm(r[1]),nx=aoa[i+1]||[];
    const mt=c0.match(/^tarjeta visa.*terminada en (\d{4})/);if(mt&&!last4)last4=mt[1];
    if(c0==='fecha de cierre'){meta.cierre=parseDateAny(nx[0]);meta.vencimiento=parseDateAny(nx[1]);continue}
    if(c0==='total a pagar'){meta.total=moneyCell(nx[0]);const u=/U\$S/i.test(String(nx[1]))?moneyCell(nx[1]):null;meta.totalUsd=u;continue}
    if(c0==='pago de tarjeta y devoluciones'){st='pagos';continue}
    if(/^tarjeta de .* - visa/.test(c0)){st='consumos';const m2=c0.match(/terminada en (\d{4})/);if(m2)last4=m2[1];continue}
    if(c0==='otros conceptos'){st='imp';continue}
    if(/^total de visa/.test(c0)){st=null;continue}
    if(c0.startsWith('aviso importante')){st=null;continue}
    if(!st)continue;
    if(st==='imp'){
      if(c0==='descripcion'||!r[0])continue;const a=moneyCell(r[1]);if(a==null)continue;
      const desc=cleanDesc(String(r[0]));if(!desc)continue;
      txs.push({id:uid(),fecha:meta.cierre||null,desc,monto:-a,usd:0,cuota:null,seccion:'imp'});continue;
    }
    if(c1==='descripcion'||c0==='fecha')continue;
    const dt=parseDateAny(r[0]);if(dt)last=dt;
    const desc=cleanDesc(String(r[1]||'')),ars=moneyCell(r[4]),usd=moneyCell(r[5]);
    if(!desc||(ars==null&&usd==null))continue;
    if(st==='pagos'){
      if(/^su pago en pesos/.test(norm(desc))){if(ars!=null)meta.pagos.push(Math.abs(ars));continue}
      if(/^su pago en usd/.test(norm(desc)))continue;
    }
    const cm=String(r[2]||'').match(/(\d+)\s*de\s*(\d+)/);
    txs.push({id:uid(),fecha:dt||last,desc,monto:ars!=null?-ars:0,usd:usd||0,cuota:cm?[+cm[1],+cm[2]]:null,seccion:st});
  }
  if(!txs.length)throw new Error('no encontré movimientos en el Excel de Visa');
  meta.suma=-txs.reduce((a,t)=>a+t.monto,0);meta.control=meta.total!=null?Math.round((meta.suma-meta.total)*100)/100:null;
  if(meta.cierre){const [y,m,d]=meta.cierre.split('-').map(Number);meta.monthKey=mkCierre(y,m,d)}
  meta.card={kind:'visa',last4,nombre:'Visa'+(last4?' ···'+last4:'')};
  return {meta,txs};
}

/* ---- Lectura genérica (cualquier banco): mejor esfuerzo, sin control de cuadre ---- */
function parseGenericCardPdf(file,pages){
  const txs=[],meta={fuente:'pdf',archivo:file.name,pagos:[],cuotasProx:[],generico:true},yNow=workYear();
  const amtRe=/^-?\$?\s*-?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
  for(const p of pages)for(const r of p.rows){
    let its=r.items;
    if(its.length<3){its=[];r.items.forEach(i=>i.s.split(/\s+/).forEach((w,j)=>its.push({s:w,x:i.x+j*6,y:i.y})));if(its.length<3)continue}
    let date=null,k=0;const a=its[0].s,b=its[1]&&its[1].s;let m;
    if((m=a.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?(?:\s|$)/))){date=iso(m[1],m[2],m[3]||yNow);k=1}
    else if((m=a.match(/^(\d{1,2})\s+([A-Za-zñ]{3,})\.?(?:\s|$)/))&&mes3(m[2])>=0){date=iso(m[1],mes3(m[2])+1,yNow);k=1}
    else if((m=a.match(/^(\d{1,2})$/))&&b&&mes3(b)>=0&&/^[A-Za-zñ]{3,}\.?$/.test(b)){date=iso(m[1],mes3(b)+1,yNow);k=2}
    else continue;
    const am=its.slice(k).filter(i=>amtRe.test(i.s));if(!am.length)continue;
    const last=am[am.length-1],neg=/-/.test(last.s);let v=parseAR(last.s.replace(/\$/g,''));if(v==null)continue;if(neg&&v>0)v=-v;
    const desc=cleanDesc(its.slice(k).filter(i=>i.x<last.x&&!amtRe.test(i.s)&&!/^\d{1,3}$/.test(i.s)&&i.s!=='$'&&i.s!=='*').map(i=>i.s).join(' '));
    if(!desc||/^(saldo|total|pago|su pago)/.test(norm(desc)))continue;
    txs.push({id:uid(),fecha:date,desc,monto:-v,usd:0,cuota:null});
  }
  if(txs.length<1)throw new Error('no reconocí el formato de este resumen. Probá con el Excel/CSV del banco, conectá Drive para leerlo con IA, o cargá los consumos con el asistente');
  meta.suma=-txs.reduce((a,t)=>a+t.monto,0);meta.control=null;
  meta.aviso='Lectura genérica: este formato no lo conozco, así que revisá que estén todos los consumos y los importes. No hay control de cuadre.';
  const ds=txs.map(t=>t.fecha).sort();meta.monthKey=ds[Math.floor(ds.length/2)].slice(0,7);
  const base=file.name.replace(/\.[^.]+$/,'').slice(0,22);
  meta.card={kind:'generic',last4:null,nombre:'Tarjeta ('+base+')',base};
  return {meta,txs};
}

/* ---- Detecta qué tipo de resumen es ---- */
async function parseCardFile(file){
  if(/\.pdf$/i.test(file.name)){
    const pages=await pdfPages(file),N=norm(pages.flatMap(p=>p.rows.map(r=>r.text)).join('\n'));
    let first=null;
    if(/american express/.test(N)&&/saldo\s*anterior/.test(N)){try{return parseAmexPdf(file,pages)}catch(e){first=e}}
    else if(/resumen visa|visa credito|terminada en/.test(N)&&/movimientos de /.test(N)){try{return await parseVisaPdf(file,pages)}catch(e){first=e}}
    try{return parseGenericCardPdf(file,pages)}catch(e){throw first||e}
  }
  const wb=XLSX.read(await file.arrayBuffer(),/\.(csv|txt)$/i.test(name)?{type:'array',raw:true}:{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],top=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}).slice(0,8).map(r=>norm(r[0]));
  if(top.includes('movimientos del resumen'))return parseVisaXlsx(file);
  const p=await parseTableFile(file,'tarjeta');p.meta.pagos=p.meta.pagos||[];
  const base=file.name.replace(/\.[^.]+$/,'').slice(0,22);p.meta.card={kind:'generic',last4:null,nombre:'Tarjeta ('+base+')',base};return p;
}


/* ============================ Pipeline unificado ============================ */
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=()=>rej(r.error);r.readAsDataURL(file)})}
function kindFromName(n){n=norm(n);if(/mercado ?pago|\bmp\b|account_statement|movimientos_mp/.test(n))return 'mercadopago';if(/visa|master|amex|american|tarjeta|naranja|cabal|resumen/.test(n))return 'tarjeta';return null}
/** Convierte la respuesta de la IA en el formato {meta, txs} de los lectores. */
function aiToParsed(res,file){
  if(!res||!Array.isArray(res.movimientos))throw new Error('la IA no encontró movimientos');
  const kind=res.tipoDocumento==='tarjeta'?'tarjeta':res.tipoDocumento==='mercadopago'?'mercadopago':res.tipoDocumento==='banco'?'banco':'comprobante';
  const txs=res.movimientos.filter(m=>m&&m.descripcion&&(m.monto||m.monto===0)).map(m=>{const usd=m.moneda==='USD';const cm=String(m.cuota||'').match(/(\d+)\s*(?:\/|de)\s*(\d+)/);
    return {id:uid(),fecha:m.fecha||res.cierre||'',desc:String(m.descripcion).trim(),monto:usd?0:Number(m.monto),usd:usd?Math.abs(Number(m.monto)):0,cuota:cm?[+cm[1],+cm[2]]:null,tipo:m.tipo,categoria:m.categoria,medio:kind==='tarjeta'?'Tarjeta de crédito':kind==='mercadopago'?'Mercado Pago':(MEDIOS.indexOf(m.medio)>=0?m.medio:''),confianza:m.confianza==null?0.7:Number(m.confianza)}});
  if(!txs.length)throw new Error('la IA no encontró movimientos');
  const ds=txs.map(t=>t.fecha).filter(Boolean).sort();
  const monthKey=/^\d{4}-\d{2}$/.test(res.periodo||'')?res.periodo:(ds.length?ds[Math.floor(ds.length/2)].slice(0,7):'');
  const total=res.total!=null&&!isNaN(Number(res.total))?Number(res.total):null,suma=-txs.reduce((a,t)=>a+t.monto,0);
  return {kind,parsed:{meta:{fuente:'ia',archivo:file&&file.name,monthKey,cierre:res.cierre||'',total,suma,control:kind==='tarjeta'&&total!=null?Math.round((suma-total)*100)/100:null,pagos:[],cuotasProx:[],cuenta:res.cuenta||'',card:kind==='tarjeta'?{kind:'ia',last4:null,nombre:res.cuenta||'Tarjeta'}:null,aviso:'Leído con inteligencia artificial: revisá importes y fechas antes de confirmar.'},txs}};
}
/** Lee cualquier archivo. ai(payload) llama al backend; si no hay IA, usa los lectores locales. */
async function analyzeFile(file,opts){
  opts=opts||{};const ai=opts.ai,name=file.name||'archivo',mime=file.type||'';
  const isImg=/^image\//.test(mime)||/\.(jpe?g|png|webp|heic|gif)$/i.test(name),isPdf=/\.pdf$/i.test(name)||mime==='application/pdf';
  if(opts.preExtracted){const r=aiToParsed(opts.preExtracted,file);r.via='ia';return r}
  if(isImg){
    if(!ai)throw new Error('para leer fotos y capturas necesito la IA: conectá Google Drive en Ajustes');
    const r=aiToParsed(await ai({task:'extract',mime:mime||'image/jpeg',base64:await fileToBase64(file),name}),file);r.via='ia';return r;
  }
  if(isPdf){
    const pages=await pdfPages(file),N=norm(pages.flatMap(p=>p.rows.map(r=>r.text)).join('\n'));
    if((/mercado ?pago|mercadopago|resumen de cuenta/.test(N))&&/saldo inicial/.test(N)){try{return {kind:'mercadopago',parsed:await parseMpPdfPages(file,pages),via:'lector'}}catch(e){if(!ai)throw e}}
    if(/american express/.test(N)&&/saldo\s*anterior/.test(N)){try{return {kind:'tarjeta',parsed:parseAmexPdf(file,pages),via:'lector'}}catch(e){}}
    else if(/resumen visa|visa credito|terminada en/.test(N)&&/movimientos de /.test(N)){try{return {kind:'tarjeta',parsed:await parseVisaPdf(file,pages),via:'lector'}}catch(e){}}
    if(ai){try{const r=aiToParsed(await ai({task:'extract',mime:'application/pdf',base64:await fileToBase64(file),name}),file);r.via='ia';return r}catch(e){console.warn('IA no pudo leer el PDF',e)}}
    const g=parseGenericCardPdf(file,pages);return {kind:'tarjeta',parsed:g,via:'generico'};
  }
  // Excel / CSV
  const wb=XLSX.read(await file.arrayBuffer(),/\.(csv|txt)$/i.test(name)?{type:'array',raw:true}:{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],top=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}).slice(0,8).map(r=>norm(r[0]));
  if(top.includes('movimientos del resumen'))return {kind:'tarjeta',parsed:await parseVisaXlsx(file),via:'lector'};
  let kind=kindFromName(name);
  try{
    const probe=await parseTableFile(file,'x');
    if(!kind)kind=/reference_id|transaction|mercado/.test(probe.meta.head||'')?'mercadopago':/cuota/.test(probe.meta.head||'')?'tarjeta':'banco';
    const p=kind==='tarjeta'?await parseTableFile(file,'tarjeta'):probe;
    if(kind==='tarjeta'){const base=name.replace(/\.[^.]+$/,'').slice(0,22);p.meta.card={kind:'generic',last4:null,nombre:'Tarjeta ('+base+')',base}}
    if(kind==='banco')p.meta.medio='Transferencia';
    return {kind,parsed:p,via:'lector'};
  }catch(e){
    if(!ai)throw e;
    const r=aiToParsed(await ai({task:'extract',text:XLSX.utils.sheet_to_csv(ws),name}),file);r.via='ia';return r;
  }
}
