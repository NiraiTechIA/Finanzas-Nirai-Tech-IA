/* FINANZAS NIRAI TECH IA — núcleo: datos, categorías, clasificación, duplicados, cálculos e intérprete local.
   No toca el DOM: se puede probar en Node. */

/* ============================ Constantes ============================ */
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var TIPOS = ['Ingreso', 'Gasto', 'Interno', 'Préstamo', 'Deuda'];
var FLAGS = ['Fijo', 'Cuota', 'Variable', 'Único', 'Negocio'];
var MEDIOS = ['Tarjeta de crédito', 'Mercado Pago', 'Débito', 'Efectivo', 'Transferencia', 'Otro', ''];
var MEDIO_ICON = { 'Tarjeta de crédito': '💳', 'Mercado Pago': '📲', 'Débito': '🏧', 'Efectivo': '💵', 'Transferencia': '🏦', 'Otro': '🔹', '': '·' };
var TIPO_ICON = { Ingreso: '⬆️', Gasto: '⬇️', Interno: '🔁', 'Préstamo': '🤲', Deuda: '📉' };
var FIXED_CATS = ['Vivienda y alquiler', 'Servicios', 'Celular e internet', 'Suscripciones', 'Seguros', 'Educación'];
// misma lista que el backend (apps-script/Code.gs) para funcionar también sin conexión
var DEFAULT_CATS = [
  ['Comida y restaurantes', '🍔', 'Gasto', 'mcdonald,burger,cafe,confiteria,restaurante,pizzer,parrilla,rotiseria,heladeria,starbucks,mostaza,kfc,pedidosya,rappi,cena,almuerzo,resto,bar,sushi,empanadas'],
  ['Supermercado', '🛒', 'Gasto', 'coto,cencosud,carrefour,jumbo,disco,changomas,walmart,vea,la anonima,supermercado,autoservicio,mayorista,diarco,makro,chino,verduleria,carniceria'],
  ['Combustible y transporte', '🚗', 'Gasto', 'shell,ypf,axion,puma,nafta,combustible,estacion de servicio,uber,cabify,didi,sube,peaje,estacionamiento,taxi,remis,tren,colectivo'],
  ['Vivienda y alquiler', '🏠', 'Gasto', 'alquiler,expensas,inmobiliaria,consorcio,hipoteca'],
  ['Servicios', '💡', 'Gasto', 'pago de servicio,metrogas,aysa,edenor,edesur,absa,naturgy,camuzzi,abl,arba,luz,gas,agua'],
  ['Celular e internet', '📶', 'Gasto', 'tuenti,claro,movistar,personal,telecentro,fibertel,flow,recargas,internet'],
  ['Tecnología', '📱', 'Gasto', 'mercadolibre,fravega,garbarino,musimundo,compumundo,computadora,notebook,celular nuevo,tele,televisor,smart tv,heladera,lavarropas,auriculares,monitor,apple store,samsung'],
  ['Ropa', '👕', 'Gasto', 'ropa,zapatillas,remera,pantalon,zara,adidas,nike,dexter,grimoldi,falabella,indumentaria'],
  ['Salud', '💊', 'Gasto', 'farmacia,farmacity,clinica,laboratorio,odontolog,medico,obra social,osde,swiss medical,galeno,medicus,prepaga'],
  ['Entretenimiento', '🎮', 'Gasto', 'teatro,cine,hoyts,showcase,cinemark,allaccess,eventbrite,ticketek,steam,playstation,xbox,nintendo,recital,juego'],
  ['Suscripciones', '📺', 'Gasto', 'spotify,netflix,apple.com,youtube,google *,disney,hbo,max,prime video,icloud,chatgpt,openai,anthropic,paramount,star+'],
  ['Viajes', '✈️', 'Gasto', 'aerolineas,flybondi,jetsmart,despegar,booking,airbnb,hotel,hostel,pasaje,almundo'],
  ['Seguros', '🛡️', 'Gasto', 'seguro,la caja,sancor,federacion patronal,mapfre,zurich,rus,mercantil andina'],
  ['Mantenimiento', '🔧', 'Gasto', 'taller,mecanico,gomeria,ferreteria,easy,sodimac,repuesto,lavadero,service'],
  ['Educación', '🎓', 'Gasto', 'curso,udemy,platzi,coursera,colegio,universidad,libreria,cuota escolar'],
  ['Mascotas', '🐶', 'Gasto', 'veterinaria,pet shop,petshop,alimento perro,puppis'],
  ['Impuestos y percepciones', '🧾', 'Gasto', 'impuesto de sellos,iibb,iva rg,db.rg,cr.rg,percep,afip,arca,monotributo,ganancias'],
  ['Negocio (costos)', '🏭', 'Gasto', 'proveedor,hosting,dominio,insumos'],
  ['Compras varias', '🛍️', 'Gasto', ''],
  ['Tarjeta sin detalle', '💳', 'Gasto', ''],
  ['Sin clasificar', '❓', 'Gasto', ''],
  ['Sueldo', '💰', 'Ingreso', 'sueldo,haberes,salario,aguinaldo'],
  ['Trabajos adicionales', '💼', 'Ingreso', 'trabajo extra,changa,freelance,honorarios'],
  ['Clientes (negocio)', '🤝', 'Ingreso', 'abono,suscripcion cliente,factura'],
  ['Inversiones', '📈', 'Ingreso', 'rendimientos,plazo fijo,intereses ganados,dividendo,fci'],
  ['Otros ingresos', '🎁', 'Ingreso', 'regalo,reintegro,devolucion'],
  ['Transferencias propias', '🏦', 'Interno', ''],
  ['Pago de tarjeta', '💳', 'Interno', 'pago de resumen,pago tarjeta'],
  ['Préstamos', '🤲', 'Préstamo', 'le preste,prestamo a'],
  ['Deudas', '📉', 'Deuda', 'me prestaron,prestamo personal,credito']
];
// nombres de la versión 1 → versión 2
var LEGACY_CATS = { 'Comida y salidas': 'Comida y restaurantes', 'Nafta': 'Combustible y transporte', 'Transporte': 'Combustible y transporte', 'Seguro de auto': 'Seguros', 'Reparación de auto': 'Mantenimiento', 'Celular': 'Celular e internet', 'Otra tarjeta (sin detalle)': 'Tarjeta sin detalle', 'Compras en cuotas': 'Compras varias', 'Cliente (negocio)': 'Clientes (negocio)', 'Transferencia propia': 'Transferencias propias', 'Ida y vuelta': 'Transferencias propias', 'Pago Visa': 'Pago de tarjeta', 'Pago tarjeta': 'Pago de tarjeta', 'Rendimiento': 'Inversiones' };
// palabras que hacen que un gasto sea FIJO aunque su categoría sea variable (ej: obra social dentro de Salud). Editable en Ajustes.
var DEFAULT_FIJOS = 'obra social,prepaga,osde,swiss medical,galeno,medicus,omint,ioma,sancor salud,hospital italiano,medife,seguro,gimnasio,gym,megatlon,sportclub,club,cuota social,alquiler,expensas,colegio,cuota escolar,monotributo,internet,telefonia,pago de servicio';
var DEFAULT_CFG = { fijosPalabras: DEFAULT_FIJOS, noFijos: [], ahorroMeta: 0, saldoInicial: 0, saldoInicialFecha: '', colchonMeses: 3, nProm: 3, mpReservado: 0, usd: 0, tc: 0, propios: [], recurrentes: [], omitidos: {} };

/* ============================ Utilidades ============================ */
var nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function $0(v) { return (v < -0.5 ? '-$ ' : '$ ') + nf0.format(Math.abs(Math.round(v || 0))); }
function $2(v) { return (v < 0 ? '-$ ' : '$ ') + nf2.format(Math.abs(v || 0)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function monthLabel(k) { var p = String(k).split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; }
function monthShort(k) { var p = String(k).split('-'); return MESES[+p[1] - 1].slice(0, 3) + ' ' + p[0].slice(2); }
function uid() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(-12); }
function nowIso() { return new Date().toISOString(); }
function pad2(n) { return String(n).padStart(2, '0'); }
function iso(d, m, y) { y = +y; if (y < 100) y += 2000; return y + '-' + pad2(m) + '-' + pad2(d); }
function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function addDays(isoD, n) { var p = isoD.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function addMonths(k, n) { var p = k.split('-').map(Number), d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function daysBetween(a, b) { return Math.round((new Date(a) - new Date(b)) / 864e5); }
function fmtDate(d) { return d ? String(d).split('-').reverse().join('/') : '—'; }
function parseAR(s) { s = String(s).replace(/[^\d,.\-]/g, ''); var neg = s.indexOf('-') >= 0; s = s.replace(/-/g, '').replace(/\./g, '').replace(',', '.'); var v = parseFloat(s); return isNaN(v) ? null : (neg ? -v : v); }
function parseNum(s) { if (typeof s === 'number') return s; var v = parseAR(s); return v == null ? 0 : v; }
function normKey(desc) {
  var toks = norm(desc).split(/\s+/).filter(Boolean), out = [];
  for (var i = 0; i < toks.length; i++) {
    var tk = toks[i];
    if (tk.indexOf('*') >= 0) { tk = tk.split('*').filter(function (p) { return !/\d/.test(p); }).join('*'); if (!tk) continue; }
    else if (/\d/.test(tk) && tk.length >= 6) continue;
    out.push(tk);
  }
  return out.join(' ').trim();
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ============================ Estado ============================ */
var DB = { movs: [], imp: [], cat: [], map: {}, cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), pend: [] };
var HOOKS = { change: function () { } };   // api.js lo reemplaza para encolar la sincronización

function defaultCatRows() {
  var ts = nowIso();
  return DEFAULT_CATS.map(function (c, i) { return { id: c[0], nombre: c[0], icono: c[1], tipo: c[2], palabras: c[3], orden: i, estado: 'activo', modificado: ts }; });
}
function loadTables(t) {
  DB.movs = (t.mov || []).map(fixMov);
  DB.imp = (t.imp || []).map(function (i) { var o = Object.assign({}, i); if (typeof o.meta === 'string') { try { o.meta = JSON.parse(o.meta || '{}'); } catch (e) { o.meta = {}; } } return o; });
  DB.cat = (t.cat && t.cat.length ? t.cat : defaultCatRows()).map(function (c) { return Object.assign({}, c, { orden: +c.orden || 0 }); });
  DB.map = {}; (t.map || []).forEach(function (r) { if (r.categoria) DB.map[r.id] = { tipo: r.tipo, categoria: r.categoria, flag: r.flag || '' }; });
  DB.cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
  (t.cfg || []).forEach(function (r) { try { DB.cfg[r.id] = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor; } catch (e) { DB.cfg[r.id] = r.valor; } });
  DB.pend = (t.pend || []).slice();
}
function dumpTables() {
  return {
    mov: DB.movs, imp: DB.imp.map(function (i) { return Object.assign({}, i, { meta: JSON.stringify(i.meta || {}) }); }), cat: DB.cat,
    map: Object.keys(DB.map).map(function (k) { return Object.assign({ id: k }, DB.map[k]); }),
    cfg: Object.keys(DB.cfg).map(function (k) { return { id: k, valor: JSON.stringify(DB.cfg[k]) }; }), pend: DB.pend
  };
}
function fixMov(m) {
  var o = Object.assign({}, m);
  o.monto = Number(o.monto) || 0; o.usd = Number(o.usd) || 0;
  o.cuota = o.cuota == null ? '' : String(o.cuota); o.estado = o.estado || 'activo';
  if (!o.mes && o.fecha) o.mes = String(o.fecha).slice(0, 7);
  return o;
}
function upsertLocal(arr, row) { var i = arr.findIndex(function (x) { return x.id === row.id; }); if (i >= 0) arr[i] = row; else arr.push(row); }
function putMov(m) { m = fixMov(m); m.modificado = nowIso(); if (!m.creado) m.creado = m.modificado; upsertLocal(DB.movs, m); HOOKS.change('mov', m); return m; }
function putImp(i) { i.modificado = nowIso(); upsertLocal(DB.imp, i); HOOKS.change('imp', Object.assign({}, i, { meta: JSON.stringify(i.meta || {}) })); return i; }
function putCat(c) { c.modificado = nowIso(); upsertLocal(DB.cat, c); HOOKS.change('cat', c); return c; }
function putPend(p) { p.modificado = nowIso(); upsertLocal(DB.pend, p); HOOKS.change('pend', p); return p; }
function putMap(k, v) { DB.map[k] = v; HOOKS.change('map', Object.assign({ id: k, modificado: nowIso() }, v)); }
function setCfg(k, v) { DB.cfg[k] = v; HOOKS.change('cfg', { id: k, valor: JSON.stringify(v), modificado: nowIso() }); }
function activeMovs() { return DB.movs.filter(function (m) { return m.estado !== 'borrado' && m.estado !== 'reemplazado'; }); }
function movById(id) { return DB.movs.find(function (m) { return m.id === id; }); }

/* ============================ Categorías ============================ */
function cats(tipo) { return DB.cat.filter(function (c) { return c.estado !== 'oculto' && (!tipo || c.tipo === tipo); }).sort(function (a, b) { return a.orden - b.orden; }); }
function catByName(n) { return DB.cat.find(function (c) { return c.nombre === n; }); }
function catIcon(n) { var c = catByName(n); return c ? c.icono : '🏷️'; }
function catNames(tipo) { return cats(tipo).map(function (c) { return c.nombre; }); }
function ensureCat(nombre, tipo, icono) {
  nombre = String(nombre || '').trim(); if (!nombre) return 'Sin clasificar';
  var ex = DB.cat.find(function (c) { return norm(c.nombre) === norm(nombre); });
  if (ex) { if (ex.estado === 'oculto') { ex.estado = 'activo'; putCat(ex); } return ex.nombre; }
  putCat({ id: uid(), nombre: nombre, icono: icono || '🏷️', tipo: tipo || 'Gasto', palabras: '', orden: DB.cat.length, estado: 'activo' });
  return nombre;
}
function renameCat(id, nuevo) {
  var c = DB.cat.find(function (x) { return x.id === id; }); if (!c || !nuevo || nuevo === c.nombre) return 0;
  var old = c.nombre, n = 0; c.nombre = nuevo; putCat(c);
  DB.movs.forEach(function (m) { if (m.categoria === old) { m.categoria = nuevo; putMov(m); n++; } });
  Object.keys(DB.map).forEach(function (k) { if (DB.map[k].categoria === old) putMap(k, Object.assign({}, DB.map[k], { categoria: nuevo })); });
  (DB.cfg.recurrentes || []).forEach(function (r) { if (r.categoria === old) r.categoria = nuevo; }); setCfg('recurrentes', DB.cfg.recurrentes || []);
  return n;
}
var _kwCache = { sig: '', list: [] };
function keywordList() {
  var sig = DB.cat.map(function (c) { return c.nombre + c.palabras + c.estado; }).join('|');
  if (sig === _kwCache.sig) return _kwCache.list;
  var list = [];
  cats().forEach(function (c) {
    String(c.palabras || '').split(',').map(function (w) { return norm(w).trim(); }).filter(Boolean).forEach(function (w) {
      list.push({ re: new RegExp('(^|[^a-z0-9])' + escRe(w) + '($|[^a-z0-9])'), cat: c.nombre, tipo: c.tipo, len: w.length });
    });
  });
  list.sort(function (a, b) { return b.len - a.len; });   // la palabra más específica gana
  _kwCache = { sig: sig, list: list }; return list;
}
function matchCategory(text, tipo) {
  var d = norm(text), l = keywordList();
  for (var i = 0; i < l.length; i++) if ((!tipo || l[i].tipo === tipo) && l[i].re.test(d)) return l[i];
  return null;
}
var _fxCache = { sig: null, re: null };
function fixedRe() {
  var sig = DB.cfg.fijosPalabras == null ? DEFAULT_FIJOS : DB.cfg.fijosPalabras;
  if (sig !== _fxCache.sig) { var ws = String(sig).split(',').map(function (w) { return norm(w).trim(); }).filter(Boolean); _fxCache = { sig: sig, re: ws.length ? new RegExp('(^|[^a-z0-9])(' + ws.map(escRe).join('|') + ')($|[^a-z0-9])') : null }; }
  return _fxCache.re;
}
function isFixedText(desc) { var re = fixedRe(); return !!(re && desc && re.test(norm(desc))); }
function defaultFlag(cat, tipo, cuota, desc) {
  if (tipo !== 'Gasto') return '';
  if (cuota) { var p = String(cuota).split('/').map(Number); return p[0] < p[1] ? 'Cuota' : 'Único'; }
  if (cat === 'Negocio (costos)') return 'Negocio';
  if (desc && (DB.cfg.noFijos || []).indexOf(normKey(desc)) >= 0) return 'Variable';
  if (desc && isFixedText(desc)) return 'Fijo';
  return FIXED_CATS.indexOf(cat) >= 0 ? 'Fijo' : 'Variable';
}

/* ============================ Clasificación ============================ */
function ownTokens() { return (DB.cfg.propios || []).map(function (n) { return norm(n).split(/\s+/).filter(Boolean); }).filter(function (a) { return a.length; }); }
function cardPagos() {
  var out = [];
  DB.imp.forEach(function (i) {
    if (i.estado === 'borrado') return;
    if (i.meta && i.meta.pagos) out.push.apply(out, i.meta.pagos);
    if (i.fuente === 'tarjeta' && i.total !== '' && i.total != null && Number(i.total) > 0) out.push(Number(i.total));   // pagar el total de un resumen
  });
  return out;
}
function looksCardPayment(d) { return /pago de resumen|pago (de )?tarjeta|pago visa|pago amex|pago master|resumen de tarjeta/.test(d); }
/** Completa tipo, categoría y flag de un movimiento (m.medio debe estar seteado). */
function classify(m, ctx) {
  ctx = ctx || {};
  var d = norm(m.descripcion), k = normKey(m.descripcion), r = DB.map[k];
  if (r && r.categoria) { m.tipo = r.tipo; m.categoria = r.categoria; m.flag = r.flag || ''; }
  else {
    var isCard = m.medio === 'Tarjeta de crédito', pagos = ctx.pagos || cardPagos();
    var own = (ctx.own || ownTokens()).some(function (tks) { return tks.every(function (t) { return d.indexOf(t) >= 0; }); });
    if (isCard && /saldo a favor|saldo anterior|su pago|pago en pesos|pago en dolares/.test(d)) { m.tipo = 'Interno'; m.categoria = 'Pago de tarjeta'; m.nota = m.nota || 'Saldo o pago del resumen anterior: no es ingreso ni gasto.'; }
    else if (!isCard && /^rendimientos?\b/.test(d)) { m.tipo = 'Ingreso'; m.categoria = 'Inversiones'; }
    else if (!isCard && own && /transferencia|transf\b/.test(d)) {
      var pv = pagos.some(function (p) { return Math.abs(Math.abs(m.monto) - p) <= 100; });
      m.tipo = 'Interno'; m.categoria = pv ? 'Pago de tarjeta' : 'Transferencias propias';
    } else if (!isCard && m.monto < 0 && looksCardPayment(d)) {
      var paid = pagos.some(function (p) { return Math.abs(Math.abs(m.monto) - p) <= 100; });
      if (paid) { m.tipo = 'Interno'; m.categoria = 'Pago de tarjeta'; }
      else { m.tipo = 'Gasto'; m.categoria = 'Tarjeta sin detalle'; m.nota = m.nota || 'Pago de una tarjeta cuyo resumen no está cargado: se cuenta como gasto para no perderlo.'; }
    } else if (!isCard && m.monto > 0) {
      var mi = matchCategory(m.descripcion, 'Ingreso'); m.tipo = 'Ingreso'; m.categoria = mi ? mi.cat : 'Sin clasificar';
    } else {
      var mg = matchCategory(m.descripcion, 'Gasto'); m.tipo = 'Gasto'; m.categoria = mg ? mg.cat : 'Sin clasificar';
    }
    m.flag = '';
  }
  var cat = catByName(m.categoria); if (cat && cat.tipo !== 'Gasto' && cat.tipo !== m.tipo) m.tipo = cat.tipo;
  if (m.tipo !== 'Gasto') m.flag = '';
  else if (m.cuota) m.flag = defaultFlag(m.categoria, m.tipo, m.cuota);
  else if (!m.flag) m.flag = defaultFlag(m.categoria, m.tipo, '', m.descripcion);
  return m;
}
/** El usuario cambió la categoría/tipo: lo recuerda para ese comercio y lo aplica a los iguales sin clasificar. */
function learnFrom(m) {
  var k = normKey(m.descripcion); if (!k || m.origen === 'chat' || m.origen === 'manual') return 0;
  putMap(k, { tipo: m.tipo, categoria: m.categoria, flag: m.cuota ? '' : (m.flag || '') });
  var n = 0;
  activeMovs().forEach(function (o) {
    if (o !== m && normKey(o.descripcion) === k && (o.categoria === 'Sin clasificar' || o.mes === m.mes) && (o.categoria !== m.categoria || o.tipo !== m.tipo)) {
      o.tipo = m.tipo; o.categoria = m.categoria; o.flag = o.cuota ? defaultFlag(o.categoria, o.tipo, o.cuota) : (m.tipo === 'Gasto' ? (m.flag || 'Variable') : ''); putMov(o); n++;
    }
  });
  return n;
}
/** Marca un comercio/concepto como Fijo o Variable: lo recuerda y lo aplica a todos sus movimientos (meses anteriores y futuros). */
function setFlagForKey(m, flag) {
  var k = normKey(m.descripcion); if (!k) return 0;
  putMap(k, { tipo: m.tipo, categoria: m.categoria, flag: flag });
  var nf = (DB.cfg.noFijos || []).filter(function (x) { return x !== k; }); if (flag === 'Variable') nf.push(k);
  setCfg('noFijos', nf);
  var n = 0;
  activeMovs().forEach(function (o) { if (normKey(o.descripcion) === k && o.tipo === 'Gasto' && !o.cuota && o.flag !== flag) { o.flag = flag; putMov(o); n++; } });
  return n;
}
/** Aplica las palabras de gastos fijos a los movimientos existentes (solo pasa Variable → Fijo; respeta lo que marcaste a mano). */
function recalcFijos() {
  var n = 0, no = DB.cfg.noFijos || [];
  activeMovs().forEach(function (m) {
    if (m.tipo !== 'Gasto' || m.cuota || m.flag !== 'Variable') return;
    var k = normKey(m.descripcion), mp = DB.map[k];
    if (no.indexOf(k) >= 0 || (mp && mp.flag)) return;
    if (isFixedText(m.descripcion)) { m.flag = 'Fijo'; putMov(m); n++; }
  });
  return n;
}
var NO_SUGERIR_FIJO = ['Supermercado', 'Comida y restaurantes', 'Combustible y transporte', 'Sin clasificar', 'Compras varias', 'Tarjeta sin detalle', 'Impuestos y percepciones', 'Entretenimiento'];
/** Gastos fijos del mes: los conocidos (marcados Fijo en los últimos 4 meses) con su estado pagado / pendiente. */
function fijosDelMes(mes) {
  var desde = addMonths(mes, -3), known = {};
  activeMovs().forEach(function (m) {
    if (m.tipo !== 'Gasto' || m.cuota || m.flag !== 'Fijo' || m.mes < desde || m.mes > mes) return;
    var k = normKey(m.descripcion) || norm(m.descripcion);
    var e = known[k] || (known[k] = { key: k, desc: m.descripcion, categoria: m.categoria, medio: m.medio, cuenta: m.cuenta, esperado: 0, mesAnt: '', pagado: 0, usd: 0, movs: [], ref: m });
    if (m.mes === mes) { e.pagado += -m.monto; e.usd += m.usd || 0; e.movs.push(m); e.desc = m.descripcion; e.medio = m.medio; e.categoria = m.categoria; e.ref = m; }
    else if (m.mes >= e.mesAnt) { if (m.mes > e.mesAnt) { e.esperado = 0; e.mesAnt = m.mes; } e.esperado += -m.monto; if (!e.movs.length) { e.desc = m.descripcion; e.medio = m.medio; e.categoria = m.categoria; e.ref = m; } }
  });
  var list = Object.keys(known).map(function (k) { var e = known[k]; e.estado = e.movs.length ? 'pagado' : 'pendiente'; return e; });
  list.sort(function (a, b) { return (a.estado === b.estado ? 0 : a.estado === 'pendiente' ? -1 : 1) || (Math.max(b.pagado, b.esperado) - Math.max(a.pagado, a.esperado)); });
  var tot = { pagado: 0, pendiente: 0, nPagados: 0, nPendientes: 0 };
  list.forEach(function (e) { if (e.estado === 'pagado') { tot.pagado += e.pagado; tot.nPagados++; } else { tot.pendiente += e.esperado; tot.nPendientes++; } });
  return { lista: list, tot: tot };
}
/** Sugiere gastos que se repiten todos los meses con importe parecido y todavía no están marcados como fijos. */
function sugerenciasFijos(mes) {
  var desde = addMonths(mes, -2), g = {}, no = DB.cfg.noFijos || [];
  activeMovs().forEach(function (m) {
    if (m.tipo !== 'Gasto' || m.cuota || m.flag === 'Fijo' || m.mes < desde || m.mes > mes || NO_SUGERIR_FIJO.indexOf(m.categoria) >= 0 || !m.monto) return;
    var k = normKey(m.descripcion); if (!k || no.indexOf(k) >= 0) return;
    var e = g[k] || (g[k] = { key: k, porMes: {}, ref: m }); e.porMes[m.mes] = (e.porMes[m.mes] || 0) + (-m.monto); if (m.mes >= e.ref.mes) e.ref = m;
  });
  return Object.keys(g).map(function (k) { return g[k]; }).filter(function (e) {
    var v = Object.keys(e.porMes).map(function (x) { return e.porMes[x]; }); if (v.length < 2) return false;
    return Math.max.apply(null, v) / Math.max(1, Math.min.apply(null, v)) <= 1.25;
  }).map(function (e) { var v = Object.keys(e.porMes).sort().map(function (x) { return e.porMes[x]; }); return { key: e.key, ref: e.ref, meses: v.length, monto: v[v.length - 1] }; });
}
/** Re-evalúa pagos de tarjeta cuando entra un resumen nuevo (evita contar dos veces). */
function reconcileCardPayments() {
  var pagos = cardPagos(), n = 0;
  activeMovs().forEach(function (m) {
    if (m.medio === 'Tarjeta de crédito' || m.monto >= 0) return;
    var match = pagos.some(function (p) { return Math.abs(Math.abs(m.monto) - p) <= 100; });
    if (match && (m.categoria === 'Tarjeta sin detalle' || m.categoria === 'Transferencias propias') && m.origen !== 'manual') {
      m.tipo = 'Interno'; m.categoria = 'Pago de tarjeta'; m.flag = ''; m.nota = 'Pago de tarjeta: las compras ya están en el resumen de la tarjeta.'; putMov(m); n++;
    }
  });
  return n;
}

/* ============================ Duplicados ============================ */
function movHash(m) {
  if (m.opId) return 'op|' + m.opId;
  return [m.medio || '', norm(m.cuenta || ''), m.fecha || '', Math.round((Number(m.monto) || 0) * 100), normKey(m.descripcion), m.cuota || ''].join('|');
}
/** Arma la vista previa de una importación: marca duplicados y coincidencias con cargas manuales. */
function buildPreview(rows) {
  var seen = {}, existing = {};
  activeMovs().forEach(function (m) { if (m.hash) existing[m.hash] = m; });
  var manual = activeMovs().filter(function (m) { return (m.origen === 'chat' || m.origen === 'manual') && !m.importId; }), usedManual = {};
  return rows.map(function (r) {
    var base = movHash(r), n = seen[base] = (seen[base] || 0) + 1;
    r.hash = r.opId ? base : base + '#' + n;
    var item = { row: r, estado: 'nuevo', incluir: true, match: null };
    if (existing[r.hash]) { item.estado = 'duplicado'; item.incluir = false; item.match = existing[r.hash]; return item; }
    var mm = manual.find(function (x) {
      return !usedManual[x.id] && x.tipo === r.tipo && Math.abs(Math.abs(x.monto) - Math.abs(r.monto)) <= Math.max(1, Math.abs(r.monto) * 0.01) && r.fecha && x.fecha && Math.abs(daysBetween(x.fecha, r.fecha)) <= 4 && (!x.medio || !r.medio || x.medio === r.medio);
    });
    if (mm) { usedManual[mm.id] = true; item.estado = 'manual'; item.match = mm; return item; }
    if (r._confianza != null && r._confianza < 0.6) item.estado = 'revisar';
    else if (r.categoria === 'Sin clasificar' && (r.tipo === 'Gasto' || r.tipo === 'Ingreso')) item.estado = 'revisar';
    return item;
  });
}
function previewStats(items) {
  var s = { nuevos: 0, duplicados: 0, manual: 0, revisar: 0, gastos: 0, ingresos: 0, internos: 0, incluidos: 0 };
  items.forEach(function (it) {
    if (it.estado === 'duplicado') s.duplicados++; else if (it.estado === 'manual') s.manual++; else if (it.estado === 'revisar') s.revisar++; else s.nuevos++;
    if (!it.incluir) return; s.incluidos++;
    var r = it.row; if (r.tipo === 'Gasto') s.gastos += -r.monto; else if (r.tipo === 'Ingreso') s.ingresos += r.monto; else s.internos += r.monto;
  });
  return s;
}
/** Confirma una importación: guarda el registro de origen y los movimientos incluidos. */
function commitImport(imp, items) {
  var ins = items.filter(function (it) { return it.incluir; }), ts = nowIso();
  imp.id = imp.id || uid(); imp.fecha = imp.fecha || ts; imp.estado = 'activo'; imp.movimientos = ins.length;
  putImp(imp);
  ins.forEach(function (it) {
    var r = it.row; delete r._confianza;
    r.id = r.id || uid(); r.importId = imp.id; r.archivoId = imp.archivoId || ''; r.origen = r.origen || 'archivo'; r.estado = 'activo';
    if (!r.mes) r.mes = imp.mes || String(r.fecha).slice(0, 7);
    if (it.estado === 'manual' && it.match) { var mm = movById(it.match.id); if (mm) { mm.estado = 'reemplazado'; mm.nota = 'Reemplazado por el movimiento importado de ' + (imp.archivo || 'un archivo'); putMov(mm); r.nota = (r.nota ? r.nota + ' · ' : '') + 'Coincidía con una carga manual: "' + mm.descripcion + '"'; } }
    putMov(r);
  });
  var rec = reconcileCardPayments();
  return { importados: ins.length, conciliados: rec, importId: imp.id };
}
/** Convierte el resultado de un lector de archivo ({meta, txs}) en filas de movimientos. */
function parsedToRows(parsed, kind) {
  var meta = parsed.meta || {}, medio = kind === 'tarjeta' ? 'Tarjeta de crédito' : kind === 'mercadopago' ? 'Mercado Pago' : (meta.medio || ''), cuenta = (meta.card && meta.card.nombre) || meta.cuenta || (kind === 'mercadopago' ? 'Mercado Pago' : '');
  var ctx = { own: ownTokens().concat(meta.nombre ? [norm(meta.nombre).split(/\s+/).filter(Boolean)] : []), pagos: cardPagos().concat(meta.pagos || []) };
  return parsed.txs.map(function (t) {
    var r = {
      id: uid(), fecha: t.fecha || meta.cierre || '', mes: kind === 'tarjeta' ? (meta.monthKey || '') : String(t.fecha || '').slice(0, 7), descripcion: t.desc, monto: Math.round((t.monto || 0) * 100) / 100, usd: t.usd || 0,
      medio: t.medio || medio, cuenta: cuenta, cuota: t.cuota ? (Array.isArray(t.cuota) ? t.cuota[0] + '/' + t.cuota[1] : String(t.cuota)) : '', opId: t.opId || '', origen: 'archivo', nota: '', estado: 'activo'
    };
    if (t.tipo && TIPOS.indexOf(t.tipo) >= 0 && t.categoria) {   // sugerido por la IA
      r.tipo = t.tipo; r.categoria = catByName(t.categoria) ? t.categoria : (t.categoria === 'Sin clasificar' ? t.categoria : ensureCatSuggestion(t.categoria, t.tipo));
      var mp = DB.map[normKey(r.descripcion)]; if (mp && mp.categoria) { r.tipo = mp.tipo; r.categoria = mp.categoria; }
      r.flag = (mp && mp.flag && !r.cuota) ? mp.flag : defaultFlag(r.categoria, r.tipo, r.cuota, r.descripcion); r._confianza = t.confianza;
      if (r.medio === 'Tarjeta de crédito' && r.tipo === 'Ingreso') r.tipo = 'Gasto';
    } else classify(r, ctx);
    if (!r.mes) r.mes = String(r.fecha).slice(0, 7);
    return r;
  });
}
var PENDING_NEW_CATS = {};
function ensureCatSuggestion(nombre, tipo) { PENDING_NEW_CATS[nombre] = tipo; return nombre; }   // se crea recién al confirmar la importación
function materializeCats(rows) { rows.forEach(function (r) { if (!catByName(r.categoria)) r.categoria = ensureCat(r.categoria, PENDING_NEW_CATS[r.categoria] || r.tipo); }); }

/* ============================ Cálculos ============================ */
function monthKeys() {
  var s = {}; activeMovs().forEach(function (m) { if (m.mes) s[m.mes] = 1; });
  return Object.keys(s).sort();
}
function summarize(mes) {
  var S = { mes: mes, ingresos: 0, gastos: 0, balance: 0, tasa: 0, interno: 0, prestamos: 0, deudas: 0, porCat: {}, porCatIng: {}, porMedio: {}, porCuenta: {}, porFlag: {}, tarjeta: 0, mp: 0, usd: 0, pend: 0, n: 0, movs: [] };
  FLAGS.forEach(function (f) { S.porFlag[f] = 0; });
  activeMovs().forEach(function (m) {
    if (m.mes !== mes) return; S.n++; S.movs.push(m);
    var v = Number(m.monto) || 0;
    if (m.tipo === 'Ingreso') { S.ingresos += v; S.porCatIng[m.categoria] = (S.porCatIng[m.categoria] || 0) + v; if (m.categoria === 'Sin clasificar') S.pend++; }
    else if (m.tipo === 'Gasto') {
      var g = -v; S.gastos += g; S.porCat[m.categoria] = (S.porCat[m.categoria] || 0) + g;
      var md = m.medio || 'Sin indicar'; S.porMedio[md] = (S.porMedio[md] || 0) + g;
      if (m.medio === 'Tarjeta de crédito') { S.tarjeta += g; var cu = m.cuenta || 'Tarjeta'; S.porCuenta[cu] = (S.porCuenta[cu] || 0) + g; }
      if (m.medio === 'Mercado Pago') S.mp += g;
      if (m.flag && S.porFlag[m.flag] != null) S.porFlag[m.flag] += g;
      if (m.categoria === 'Sin clasificar') S.pend++;
      S.usd += m.usd || 0;
    } else if (m.tipo === 'Interno') S.interno += v;
    else if (m.tipo === 'Préstamo') S.prestamos += v;
    else if (m.tipo === 'Deuda') S.deudas += v;
  });
  S.balance = S.ingresos - S.gastos; S.tasa = S.ingresos > 0 ? S.balance / S.ingresos : 0;
  S.negocioNeto = (S.porCatIng['Clientes (negocio)'] || 0) - S.porFlag.Negocio;
  return S;
}
function prevMonthWithData(mes) { return monthKeys().filter(function (k) { return k < mes; }).pop() || null; }
/** Dinero disponible = saldo de partida + todo lo que entró y salió de tu bolsillo (las compras con tarjeta restan recién cuando pagás el resumen). */
function disponible() {
  var c = DB.cfg, desde = c.saldoInicialFecha || '', tot = Number(c.saldoInicial) || 0, pagosTarjeta = 0;
  activeMovs().forEach(function (m) {
    if (desde && m.fecha && m.fecha < desde) return;
    if (m.medio === 'Tarjeta de crédito') return;
    if (m.tipo === 'Interno' && m.categoria === 'Transferencias propias') return;
    if (m.tipo === 'Interno' && m.categoria === 'Pago de tarjeta') pagosTarjeta += -m.monto;
    tot += Number(m.monto) || 0;
  });
  return { total: tot, desde: desde, saldoInicial: Number(c.saldoInicial) || 0, pagosTarjeta: pagosTarjeta, configurado: !!desde };
}
/** Lo que hay que pagar de tarjeta: total de los resúmenes importados del mes, o la suma de consumos si no hay resumen. */
function tarjetaAPagar(mes) {
  var imps = DB.imp.filter(function (i) { return i.estado !== 'borrado' && i.fuente === 'tarjeta' && i.mes === mes; });
  var conTotal = imps.filter(function (i) { return i.total !== '' && i.total != null && !isNaN(Number(i.total)); });
  var S = summarize(mes);
  if (conTotal.length) return { total: conTotal.reduce(function (a, i) { return a + Number(i.total); }, 0), detalle: conTotal.map(function (i) { return { cuenta: i.cuenta, total: Number(i.total), vence: (i.meta && i.meta.vencimiento) || '' }; }), fuente: 'resumen' };
  return { total: S.tarjeta, detalle: Object.keys(S.porCuenta).map(function (k) { return { cuenta: k, total: S.porCuenta[k] }; }), fuente: 'consumos' };
}
function periodRows(kind) {
  var groups = {};
  monthKeys().forEach(function (k) {
    var y = +k.slice(0, 4), m = +k.slice(5, 7), g = kind === 'mes' ? k : kind === 'trim' ? y + ' · T' + Math.ceil(m / 3) : kind === 'sem' ? y + ' · S' + (m <= 6 ? 1 : 2) : String(y), per = kind === 'mes' ? 1 : kind === 'trim' ? 3 : kind === 'sem' ? 6 : 12;
    (groups[g] = groups[g] || { ks: [], per: per }).ks.push(k);
  });
  return Object.keys(groups).map(function (g) {
    var o = groups[g], A = { g: kind === 'mes' ? monthLabel(g) : g, key: g, n: o.ks.length, per: o.per, ingresos: 0, gastos: 0, fijo: 0, cuota: 0, variable: 0, unico: 0, balance: 0, tarjeta: 0, mp: 0 };
    o.ks.forEach(function (k) { var S = summarize(k); A.ingresos += S.ingresos; A.gastos += S.gastos; A.fijo += S.porFlag.Fijo; A.cuota += S.porFlag.Cuota; A.variable += S.porFlag.Variable; A.unico += S.porFlag['Único']; A.balance += S.balance; A.tarjeta += S.tarjeta; A.mp += S.mp; });
    A.tasa = A.ingresos > 0 ? A.balance / A.ingresos : 0; return A;
  }).sort(function (a, b) { return a.key < b.key ? 1 : -1; });
}
function projection(mes) {
  var c = DB.cfg, keys = monthKeys().filter(function (k) { return k <= mes; }), last = keys.slice(-Math.max(1, c.nProm || 3)), sums = last.map(summarize), S = summarize(mes);
  var avg = function (f) { return sums.length ? sums.reduce(function (a, s) { return a + f(s); }, 0) / sums.length : 0; };
  var next = addMonths(mes, 1), cuotasNext = 0;
  DB.imp.forEach(function (i) { if (i.estado !== 'borrado' && i.mes === mes && i.meta && i.meta.cuotasProx && i.meta.cuotasProx[0]) cuotasNext += Number(i.meta.cuotasProx[0].monto) || 0; });
  if (!cuotasNext) cuotasNext = S.porFlag.Cuota;
  var rec = (c.recurrentes || []).reduce(function (a, r) { return a + (Number(r.monto) || 0); }, 0);
  var d = { fijos: S.porFlag.Fijo, cuotas: cuotasNext, variables: avg(function (s) { return s.porFlag.Variable; }), unicos: 0, negocio: avg(function (s) { return s.negocioNeto; }), sueldo: rec || avg(function (s) { return s.porCatIng['Sueldo'] || 0; }), otros: 0 };
  var o = (c.proyeccion && c.proyeccion[mes]) || {}, v = {};
  Object.keys(d).forEach(function (k) { v[k] = o[k] != null ? o[k] : d[k]; });
  v.ingresos = v.sueldo + v.negocio + v.otros; v.gastos = v.fijos + v.cuotas + v.variables + v.unicos;
  v.ahorroProy = v.ingresos - v.gastos; v.ahorroObj = Number(c.ahorroMeta) || 0;
  v.presupVar = v.ingresos - v.fijos - v.cuotas - v.unicos - v.ahorroObj;
  var piso = v.fijos + v.cuotas, techo = piso + v.variables, liq = (Number(c.mpReservado) || 0) + (Number(c.usd) || 0) * (Number(c.tc) || 0);
  v.indep = { piso: piso, techo: techo, liq: liq, covPiso: piso > 0 ? v.negocio / piso : 0, covTecho: techo > 0 ? v.negocio / techo : 0, defPiso: Math.max(0, piso - v.negocio), defTecho: Math.max(0, techo - v.negocio) };
  v.indep.mesesPiso = v.indep.defPiso > 0 ? liq / v.indep.defPiso : Infinity; v.indep.mesesTecho = v.indep.defTecho > 0 ? liq / v.indep.defTecho : Infinity;
  v.nMeses = sums.length; v.defaults = d; return v;
}
/** Gastos inusuales: categorías muy por encima de su promedio y compras individuales grandes. */
function inusuales(mes) {
  var S = summarize(mes), prev = monthKeys().filter(function (k) { return k < mes; }).slice(-3).map(summarize), out = [];
  if (prev.length) Object.keys(S.porCat).forEach(function (c) {
    var avg = prev.reduce(function (a, p) { return a + (p.porCat[c] || 0); }, 0) / prev.length;
    if (S.porCat[c] > avg * 1.5 && S.porCat[c] - avg > 20000) out.push({ tipo: 'categoria', categoria: c, actual: S.porCat[c], promedio: avg, texto: catIcon(c) + ' ' + c + ': ' + $0(S.porCat[c]) + ' contra un promedio de ' + $0(avg) + ' (+' + Math.round((S.porCat[c] / Math.max(1, avg) - 1) * 100) + '%)' });
  });
  var hist = {}; activeMovs().forEach(function (m) { if (m.tipo === 'Gasto' && m.mes < mes) (hist[m.categoria] = hist[m.categoria] || []).push(-m.monto); });
  S.movs.filter(function (m) { return m.tipo === 'Gasto'; }).forEach(function (m) {
    var h = (hist[m.categoria] || []).slice().sort(function (a, b) { return a - b; }); if (h.length < 3) return;
    var med = h[Math.floor(h.length / 2)];
    if (-m.monto > med * 4 && -m.monto > 30000) out.push({ tipo: 'movimiento', id: m.id, texto: catIcon(m.categoria) + ' ' + m.descripcion + ' (' + fmtDate(m.fecha) + '): ' + $0(-m.monto) + ', ' + Math.round(-m.monto / med) + ' veces lo habitual en ' + m.categoria });
  });
  return out;
}
function recomendaciones(mes) {
  var S = summarize(mes), P = prevMonthWithData(mes) ? summarize(prevMonthWithData(mes)) : null, out = [], meta = Number(DB.cfg.ahorroMeta) || 0;
  if (S.ingresos === 0 && S.gastos > 0) out.push('Todavía no registraste ingresos en ' + monthLabel(mes) + ': el balance va a dar negativo hasta que cargues el sueldo.');
  if (meta > 0 && S.balance < meta && S.ingresos > 0) out.push('Vas ' + $0(S.balance) + ' de ahorro contra una meta de ' + $0(meta) + ': faltan ' + $0(meta - S.balance) + '.');
  if (S.ingresos > 0 && S.tasa < 0.1) out.push('Tu tasa de ahorro es ' + Math.round(S.tasa * 100) + '%. Una referencia razonable es apuntar al 10–20% de los ingresos.');
  if (P) {
    var up = Object.keys(S.porCat).map(function (c) { return [c, S.porCat[c] - (P.porCat[c] || 0)]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
    if (up && up[1] > 10000) out.push('La categoría que más creció es ' + catIcon(up[0]) + ' ' + up[0] + ': ' + $0(up[1]) + ' más que en ' + monthLabel(P.mes) + '.');
  }
  var subs = S.porCat['Suscripciones'] || 0; if (subs > 0) out.push('Suscripciones: ' + $0(subs) + ' este mes. Revisá si usás todas.');
  if (S.porFlag.Cuota > 0 && S.gastos > 0 && S.porFlag.Cuota / S.gastos > 0.25) out.push('Las cuotas son el ' + Math.round(S.porFlag.Cuota / S.gastos * 100) + '% de tus gastos: conviene no sumar compras en cuotas hasta que bajen.');
  if (S.pend > 0) out.push('Tenés ' + S.pend + ' movimientos sin clasificar: clasificarlos mejora estos números.');
  if (S.usd > 0) out.push('Hay US$ ' + nf2.format(S.usd) + ' en consumos en dólares que no están sumados en pesos.');
  return out;
}

/* ============================ Ingresos recurrentes (sueldo) ============================ */
function recurrentesPendientes(hoy) {
  hoy = hoy || todayIso(); var mes = hoy.slice(0, 7), dia = +hoy.slice(8, 10), out = [];
  (DB.cfg.recurrentes || []).forEach(function (r) {
    if (!r.monto || !r.nombre) return;
    var opId = 'rec:' + r.id + ':' + mes;
    if (DB.movs.some(function (m) { return m.opId === opId && m.estado !== 'borrado'; })) return;
    if ((DB.cfg.omitidos || {})[opId]) return;
    if (dia < (+r.dia || 1)) return;
    out.push({ rec: r, mes: mes, opId: opId });
  });
  return out;
}
function registrarRecurrente(p, monto, fecha) {
  var r = p.rec;
  return putMov({ id: uid(), fecha: fecha || (p.mes + '-' + pad2(Math.min(28, +r.dia || 1))), mes: p.mes, descripcion: r.nombre, monto: Math.abs(monto != null ? monto : r.monto), tipo: 'Ingreso', categoria: r.categoria || 'Sueldo', flag: '', medio: r.medio || 'Transferencia', cuenta: '', cuota: '', origen: r.auto ? 'automatico' : 'manual', opId: p.opId, nota: r.auto ? 'Registrado automáticamente (cobro configurado como automático).' : 'Confirmado por vos.', estado: 'activo' });
}
/** Solo registra solos los que marcaste como automáticos; el resto espera tu confirmación. */
function autoRecurrentes(hoy) { return recurrentesPendientes(hoy).filter(function (p) { return p.rec.auto; }).map(function (p) { return registrarRecurrente(p); }); }

/* ============================ Intérprete local de mensajes ============================ */
var NUM_RE = /(?:\$|ars|pesos)?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(millones|millon|palos?|mill|mil|lucas?|k\b|m\b)?/i;
function parseAmountText(text) {
  var t = norm(text).replace(/(\d{1,2})\/(\d{1,2})(\/\d{2,4})?/g, ' ').replace(/\b(\d+)\s*cuotas?\b/g, ' ').replace(/\ben\s+\d+\b(?=\s*(pagos|cuotas))/g, ' ');
  var m = t.match(NUM_RE); if (!m) return null;
  var raw = m[1].replace(/\s/g, ''), mult = m[2] ? norm(m[2]) : '', v;
  if (/^(millones|millon|palo|palos|mill|m)$/.test(mult)) { v = parseFloat(raw.replace(/\./g, '').replace(',', '.')); if (/^\d+\.\d{1,2}$/.test(raw)) v = parseFloat(raw); return v * 1e6; }
  if (/^(mil|luca|lucas|k)$/.test(mult)) { v = parseFloat(raw.replace(/\./g, '').replace(',', '.')); if (/^\d+\.\d{1,2}$/.test(raw)) v = parseFloat(raw); return v * 1e3; }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
}
function parseDateText(text, hoy) {
  hoy = hoy || todayIso(); var t = norm(text), m;
  if (/\banteayer\b/.test(t)) return addDays(hoy, -2);
  if (/\bayer\b/.test(t)) return addDays(hoy, -1);
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) return iso(m[1], m[2], m[3] || hoy.slice(0, 4));
  if ((m = t.match(/\bel (\d{1,2}) de ([a-z]+)/)) && MESES.indexOf(m[2]) >= 0) return iso(m[1], MESES.indexOf(m[2]) + 1, hoy.slice(0, 4));
  if ((m = t.match(/\bel (?:dia )?(\d{1,2})\b(?! ?(mil|cuotas|k\b))/)) && +m[1] >= 1 && +m[1] <= 31) return hoy.slice(0, 8) + pad2(m[1]);
  return hoy;
}
function parseMedioText(t) {
  t = norm(t);
  if (/tarjeta de credito|\bcon (la )?(visa|amex|american|master(card)?|tarjeta)\b|\bcredito\b/.test(t)) return 'Tarjeta de crédito';
  if (/mercado ?pago|\bmp\b/.test(t)) return 'Mercado Pago';
  if (/debito/.test(t)) return 'Débito';
  if (/efectivo|cash/.test(t)) return 'Efectivo';
  if (/transferencia|transferi/.test(t)) return 'Transferencia';
  return '';
}
var VERB_ING = /\b(cobre|cobro|me (ingresaron|ingreso|pagaron|depositaron|transfirieron|entraron|entro)|recibi|gane|ingreso|ingresaron|vendi)\b/;
var VERB_GAS = /\b(gaste|gasto|gastar|pague|pagar|compre|comprar|me cobraron|abone|invert[ií] en|saque|cargue)\b/;
function conceptFrom(text) {
  var t = norm(text);
  t = t.replace(/\ben \d+ (cuotas|pagos)\b/g, ' ').replace(new RegExp(NUM_RE.source, 'gi'), ' ').replace(/\$/g, ' ').replace(/\b(hoy|ayer|anteayer|recien|acabo de|reci[eé]n|el \d{1,2}(\/\d{1,2}(\/\d{2,4})?)?|el dia \d{1,2})\b/g, ' ');
  t = t.replace(/\b(en|con) (la |mi )?(tarjeta( de credito| de debito)?|visa|amex|mastercard|mercado ?pago|mp|efectivo|debito|credito)\b/g, ' ').replace(/\bpor transferencia\b/g, ' ').replace(/\ben \d+ cuotas\b/g, ' ');
  t = t.replace(VERB_ING, ' ').replace(VERB_GAS, ' ').replace(/\b(le preste|preste|me prestaron|me presto|me devolvio|me devolvieron|devolvi)\b/g, ' ');
  t = t.replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  for (var i = 0; i < 4; i++) t = t.replace(/^(en|de|por|para|un|una|unos|unas|el|la|los|las|mi|mis|del|al|a|que|y|lo)\s+/, '').trim();
  t = t.replace(/\s+(de|en|por|con|a|y)$/, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
function monthFromText(t, mes) {
  t = norm(t);
  if (/mes pasado|mes anterior|ultimo mes/.test(t)) return addMonths(mes, -1);
  for (var i = 0; i < 12; i++) if (new RegExp('\\b(en |de )' + MESES[i] + '\\b').test(t)) { var y = +mes.slice(0, 4); if (i + 1 > +mes.slice(5, 7)) y--; return y + '-' + pad2(i + 1); }
  return mes;
}
/** Interpreta un mensaje sin IA. Devuelve la misma forma que el backend con Gemini. */
function interpretLocal(text, ctx) {
  ctx = ctx || {}; var hoy = ctx.hoy || todayIso(), mes = ctx.mes || hoy.slice(0, 7), t = norm(text).trim();
  var monto = parseAmountText(text);
  // corrección: "el gasto anterior no fue de $18.500, fue de $16.500"
  if (/(anterior|ultimo|ultima)\b.*\b(no fue|era|fue de|corregi|cambia)|\b(corregi|corrigi|me equivoque)\b/.test(t)) {
    var nums = norm(text).match(new RegExp(NUM_RE.source, 'gi')) || [], vals = nums.map(parseAmountText).filter(function (x) { return x; });
    var nuevo = vals.length ? vals[vals.length - 1] : null, viejo = vals.length > 1 ? vals[0] : null;
    return { accion: 'corregir', correccion: { referencia: /ingreso|cobro/.test(t) ? 'Ingreso' : /gasto/.test(t) ? 'Gasto' : '', montoAnterior: viejo, cambios: nuevo ? { monto: nuevo } : {} }, faltan: nuevo ? [] : ['monto'], pregunta: nuevo ? '' : '¿Cuál es el importe correcto?' };
  }
  if (/\b(borra|borrar|elimina|eliminar|anula|anular)\b.*\b(anterior|ultimo|ultima|eso)\b/.test(t)) return { accion: 'eliminar', correccion: { referencia: '' } };
  var isQ = /^¿|\?\s*$/.test(text.trim()) || /^(cuanto|cuantos|cual|cuales|que|en que|como voy|dame|mostrame|decime|resumen|mis )/.test(t);
  if (isQ && !(monto && (VERB_GAS.test(t) || VERB_ING.test(t)) && !/cuanto/.test(t))) {
    var q = { metrica: 'libre', categoria: '', medio: '', mes: monthFromText(t, mes) };
    if (/tarjeta/.test(t) && /(pagar|debo|deuda|resumen|vence)/.test(t)) q.metrica = 'tarjeta_a_pagar';
    else if (/(mayores|mas grandes|mas caros|top)/.test(t)) q.metrica = 'mayores_gastos';
    else if (/(que|cual) categoria|en que (estoy )?gast/.test(t)) q.metrica = 'categoria_top';
    else if (/ahorr/.test(t) && /(anterior|pasado|respecto|compar)/.test(t)) q.metrica = 'ahorro_vs_anterior';
    else if (/disponible|(me )?queda|tengo (para|disponible)/.test(t)) q.metrica = 'disponible';
    else if (/inusual|raro|extrano|sospech/.test(t)) q.metrica = 'inusuales';
    else if (/recomend|consejo|mejorar|tips?\b|organiz/.test(t)) q.metrica = 'recomendaciones';
    else if (/balance|resultado|como voy/.test(t)) q.metrica = 'balance';
    else if (/ahorr/.test(t)) q.metrica = 'balance';
    else if (/(cobre|cobro|ingres|gane|entro|entraron)/.test(t)) q.metrica = 'ingresos';
    else if (/(gast|pague|consum)/.test(t)) {
      var med = parseMedioText(t); if (med) { q.metrica = 'gasto_medio'; q.medio = med; }
      else { var cm = catMentioned(t); if (cm) { q.metrica = 'gasto_categoria'; q.categoria = cm; } else q.metrica = 'gastos'; }
    }
    return { accion: 'consultar', consulta: q };
  }
  // registro
  var tipo = null, sentido = null;
  if (/\b(le preste|preste)\b/.test(t)) { tipo = 'Préstamo'; sentido = 'salida'; }
  else if (/\bme devolvi(o|eron)\b/.test(t)) { tipo = 'Préstamo'; sentido = 'entrada'; }
  else if (/\bme prest(aron|o)\b/.test(t)) { tipo = 'Deuda'; sentido = 'entrada'; }
  else if (/\b(devolvi|pague la cuota del prestamo|pague el prestamo)\b/.test(t)) { tipo = 'Deuda'; sentido = 'salida'; }
  else if (/\btransferi a mi\b|\bentre mis cuentas\b/.test(t)) { tipo = 'Interno'; sentido = 'salida'; }
  else if (VERB_ING.test(t)) { tipo = 'Ingreso'; sentido = 'entrada'; }
  else if (VERB_GAS.test(t)) { tipo = 'Gasto'; sentido = 'salida'; }
  if (!tipo && !monto) return { accion: 'conversar', respuesta: '' };
  var concepto = conceptFrom(text), medio = parseMedioText(text), cuotasM = t.match(/\ben (\d+) (cuotas|pagos)\b/);
  var cat = null;
  if (tipo === 'Préstamo') cat = 'Préstamos'; else if (tipo === 'Deuda') cat = 'Deudas'; else if (tipo === 'Interno') cat = 'Transferencias propias';
  else if (tipo) { var mc = matchCategory(text, tipo); cat = mc ? mc.cat : (tipo === 'Ingreso' && /trabajo|extra|changa/.test(t) ? 'Trabajos adicionales' : 'Sin clasificar'); }
  if (tipo === 'Préstamo' && sentido === 'salida' && concepto) concepto = 'Préstamo a ' + concepto.replace(/^Amigo$/, 'un amigo').toLowerCase();
  if (tipo === 'Préstamo' && sentido === 'entrada') concepto = 'Devolución de préstamo' + (concepto ? ' (' + concepto.toLowerCase() + ')' : '');
  if (tipo === 'Deuda' && sentido === 'entrada' && !concepto) concepto = 'Préstamo recibido';
  var faltan = []; if (!monto) faltan.push('monto'); if (!tipo) faltan.push('tipo');
  return {
    accion: 'registrar', _local: true,
    movimiento: { fecha: parseDateText(text, hoy), descripcion: concepto || cat || '', monto: monto || null, tipo: tipo, sentido: sentido, categoria: cat, medio: medio, cuotas: cuotasM ? +cuotasM[1] : null },
    faltan: faltan, pregunta: !monto ? '¿De cuánto fue?' : !tipo ? '¿Fue un ingreso o un gasto?' : ''
  };
}
function catMentioned(t) {
  t = norm(t); var best = null;
  cats().forEach(function (c) { var n = norm(c.nombre); if (t.indexOf(n) >= 0 || n.split(/ y | /).some(function (w) { return w.length > 3 && new RegExp('\\b' + escRe(w)).test(t); })) best = best || c.nombre; });
  if (!best) { var mc = matchCategory(t, 'Gasto'); if (mc) best = mc.cat; }
  return best;
}
/** Convierte la interpretación (local o IA) en uno o más movimientos listos para guardar. */
function movsFromIntent(mv, origen) {
  var tipo = TIPOS.indexOf(mv.tipo) >= 0 ? mv.tipo : 'Gasto';
  var sentido = mv.sentido || (tipo === 'Ingreso' || tipo === 'Deuda' ? 'entrada' : 'salida');
  var abs = Math.abs(Number(mv.monto) || 0), sign = sentido === 'entrada' ? 1 : -1;
  var cat = mv.categoria || 'Sin clasificar';
  if (!catByName(cat)) cat = ensureCat(cat, tipo, mv.icono);
  var fecha = mv.fecha || todayIso(), n = Math.max(1, Math.min(48, +mv.cuotas || 1)), out = [];
  for (var i = 0; i < n; i++) {
    var cuota = n > 1 ? (i + 1) + '/' + n : '';
    out.push({
      id: uid(), fecha: fecha, mes: addMonths(fecha.slice(0, 7), i), descripcion: mv.descripcion || cat, monto: Math.round(sign * abs / n * 100) / 100, usd: 0, tipo: tipo, categoria: cat,
      flag: defaultFlag(cat, tipo, cuota, mv.descripcion || cat), medio: mv.medio || '', cuenta: '', cuota: cuota, origen: origen || 'chat', estado: 'activo', nota: ''
    });
  }
  return out;
}
/** Responde consultas usando SOLO los datos registrados. */
function answerQuery(q, mesActual) {
  var mes = q.mes || mesActual, S = summarize(mes), L = monthLabel(mes), P = prevMonthWithData(mes) ? summarize(prevMonthWithData(mes)) : null;
  var sinDatos = S.n === 0 ? 'No tengo movimientos registrados en ' + L + '.' : null;
  switch (q.metrica) {
    case 'gastos': return sinDatos || 'En ' + L + ' gastaste ' + $0(S.gastos) + ' en ' + S.movs.filter(function (m) { return m.tipo === 'Gasto'; }).length + ' movimientos' + (P ? ' (' + monthLabel(P.mes) + ': ' + $0(P.gastos) + ')' : '') + '.';
    case 'ingresos': return sinDatos || 'En ' + L + ' cobraste ' + $0(S.ingresos) + (Object.keys(S.porCatIng).length ? ': ' + Object.keys(S.porCatIng).map(function (c) { return catIcon(c) + ' ' + c + ' ' + $0(S.porCatIng[c]); }).join(' · ') : '') + '.';
    case 'balance': return sinDatos || L + ': ingresos ' + $0(S.ingresos) + ', gastos ' + $0(S.gastos) + ', balance ' + $0(S.balance) + ' (ahorro ' + Math.round(S.tasa * 100) + '%).';
    case 'gasto_categoria': {
      var c = q.categoria && (catByName(q.categoria) ? q.categoria : catMentioned(q.categoria));
      if (!c) return 'No reconocí la categoría. Probá con el nombre exacto, por ejemplo "Supermercado".';
      var v = S.porCat[c] || 0, n = S.movs.filter(function (m) { return m.tipo === 'Gasto' && m.categoria === c; }).length;
      return catIcon(c) + ' En ' + c + ' llevás ' + $0(v) + ' en ' + L + ' (' + n + ' movimientos' + (S.gastos > 0 ? ', ' + Math.round(v / S.gastos * 100) + '% del total' : '') + ')' + (P ? '. En ' + monthLabel(P.mes) + ' fueron ' + $0(P.porCat[c] || 0) : '') + '.';
    }
    case 'gasto_medio': { var md = q.medio || 'Mercado Pago', vm = S.porMedio[md] || 0; return (MEDIO_ICON[md] || '') + ' Con ' + md + ' gastaste ' + $0(vm) + ' en ' + L + '.'; }
    case 'tarjeta_a_pagar': {
      var tp = tarjetaAPagar(mes);
      if (!tp.total) return 'No tengo consumos de tarjeta ni resúmenes cargados para ' + L + '.';
      return '💳 ' + (tp.fuente === 'resumen' ? 'Según los resúmenes cargados, a pagar: ' : 'No hay resumen cargado; los consumos con tarjeta suman ') + $0(tp.total) + (tp.detalle.length > 1 || tp.fuente === 'resumen' ? ' — ' + tp.detalle.map(function (d) { return d.cuenta + ' ' + $0(d.total) + (d.vence ? ' (vence ' + fmtDate(d.vence) + ')' : ''); }).join(' · ') : '') + '.';
    }
    case 'mayores_gastos': {
      var top = S.movs.filter(function (m) { return m.tipo === 'Gasto'; }).sort(function (a, b) { return a.monto - b.monto; }).slice(0, 5);
      return sinDatos || (top.length ? 'Mayores gastos de ' + L + ':\n' + top.map(function (m, i) { return (i + 1) + '. ' + catIcon(m.categoria) + ' ' + m.descripcion + ' — ' + $0(-m.monto) + ' (' + fmtDate(m.fecha) + ')'; }).join('\n') : 'No hay gastos en ' + L + '.');
    }
    case 'categoria_top': {
      var arr = Object.keys(S.porCat).map(function (k) { return [k, S.porCat[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
      return sinDatos || (arr.length ? 'Donde más gastás en ' + L + ': ' + arr.slice(0, 3).map(function (a) { return catIcon(a[0]) + ' ' + a[0] + ' ' + $0(a[1]) + ' (' + Math.round(a[1] / S.gastos * 100) + '%)'; }).join(' · ') + '.' : 'No hay gastos en ' + L + '.');
    }
    case 'ahorro_vs_anterior':
      if (!P) return 'No tengo un mes anterior cargado para comparar.';
      var dif = S.balance - P.balance;
      return 'Ahorro de ' + L + ': ' + $0(S.balance) + ' (' + Math.round(S.tasa * 100) + '%). En ' + monthLabel(P.mes) + ': ' + $0(P.balance) + ' (' + Math.round(P.tasa * 100) + '%). Diferencia: ' + (dif >= 0 ? '+' : '') + $0(dif) + '.';
    case 'disponible': {
      var d = disponible();
      if (!d.configurado) return 'Para calcular el dinero disponible necesito tu saldo de partida (Ajustes → Valores). Mientras tanto, el balance de ' + L + ' es ' + $0(S.balance) + '.';
      return '💵 Disponible estimado: ' + $0(d.total) + ' (saldo de partida ' + $0(d.saldoInicial) + ' al ' + fmtDate(d.desde) + ' + movimientos registrados; las compras con tarjeta restan cuando se paga el resumen). Tarjeta a pagar de ' + L + ': ' + $0(tarjetaAPagar(mes).total) + '.';
    }
    case 'inusuales': { var u = inusuales(mes); return u.length ? 'Gastos fuera de lo habitual en ' + L + ':\n' + u.map(function (x) { return '• ' + x.texto; }).join('\n') : 'No detecto gastos inusuales en ' + L + ' respecto de los meses anteriores.'; }
    case 'recomendaciones': { var r = recomendaciones(mes); return r.length ? r.map(function (x) { return '• ' + x; }).join('\n') : 'Con los datos de ' + L + ' no veo alertas. Seguí registrando para tener comparaciones.'; }
  }
  return null;
}
function analysisData(mes) {
  var S = summarize(mes), keys = monthKeys().slice(-6);
  return {
    mesConsultado: mes, hoy: todayIso(),
    meses: keys.map(function (k) { var s = summarize(k); return { mes: k, ingresos: Math.round(s.ingresos), gastos: Math.round(s.gastos), balance: Math.round(s.balance), tarjeta: Math.round(s.tarjeta), mercadoPago: Math.round(s.mp), porCategoria: Object.keys(s.porCat).reduce(function (a, c) { a[c] = Math.round(s.porCat[c]); return a; }, {}) }; }),
    mayoresGastos: S.movs.filter(function (m) { return m.tipo === 'Gasto'; }).sort(function (a, b) { return a.monto - b.monto; }).slice(0, 10).map(function (m) { return { fecha: m.fecha, descripcion: m.descripcion, monto: -m.monto, categoria: m.categoria, medio: m.medio }; }),
    prestamosYDeudas: activeMovs().filter(function (m) { return m.tipo === 'Préstamo' || m.tipo === 'Deuda'; }).map(function (m) { return { fecha: m.fecha, descripcion: m.descripcion, monto: m.monto, tipo: m.tipo }; }),
    inusuales: inusuales(mes).map(function (x) { return x.texto; }), metaAhorro: DB.cfg.ahorroMeta || 0, disponible: disponible()
  };
}

/* ============================ Migración desde la versión 1 ============================ */
function migrateV1(st) {
  var rows = [], cat = function (c) { return LEGACY_CATS[c] || c; }, n = 0;
  Object.keys(st.months || {}).forEach(function (k) {
    var m = st.months[k];
    var tarjetas = m.tarjetas || (m.visa ? [{ nombre: 'Visa', meta: m.visa.meta, txs: m.visa.txs }] : []);
    tarjetas.forEach(function (c) { (c.txs || []).forEach(function (t) { rows.push(v1row(t, k, 'Tarjeta de crédito', c.nombre, cat)); }); });
    if (m.mp) (m.mp.txs || []).forEach(function (t) { rows.push(v1row(t, k, 'Mercado Pago', 'Mercado Pago', cat)); });
    (m.extras || []).forEach(function (t) { rows.push(v1row(t, k, 'Efectivo', '', cat, 'manual')); });
    if (m.sueldo != null && m.sueldo > 0) rows.push({ id: uid(), fecha: k + '-01', mes: k, descripcion: 'Sueldo', monto: m.sueldo, usd: 0, tipo: 'Ingreso', categoria: 'Sueldo', flag: '', medio: 'Transferencia', cuenta: '', cuota: '', origen: 'migracion', estado: 'activo', nota: 'Migrado de la versión anterior' });
  });
  var have = {}; activeMovs().forEach(function (m) { if (m.hash) have[m.hash] = 1; });
  rows.forEach(function (r) { r.hash = 'v1|' + movHash(r) + '|' + r.mes; if (have[r.hash]) return; have[r.hash] = 1; if (!catByName(r.categoria)) r.categoria = ensureCat(r.categoria, r.tipo); putMov(r); n++; });
  Object.keys(st.mappings || {}).forEach(function (k) { var v = st.mappings[k]; if (!DB.map[k]) putMap(k, { tipo: v.tipo === 'Rendimiento' ? 'Ingreso' : v.tipo, categoria: cat(v.cat), flag: v.flag || '' }); });
  (st.customCats || []).forEach(function (c) { ensureCat(cat(c), 'Gasto'); });
  var s = st.settings || {};
  if (s.ahorro && !DB.cfg.ahorroMeta) setCfg('ahorroMeta', s.ahorro);
  ['colchonMeses', 'nProm', 'mpReservado', 'usd', 'tc'].forEach(function (k) { if (s[k] && !DB.cfg[k]) setCfg(k, s[k]); });
  if (s.sueldo && !(DB.cfg.recurrentes || []).length) setCfg('recurrentes', [{ id: uid(), nombre: 'Sueldo', categoria: 'Sueldo', monto: s.sueldo, dia: 1, auto: false, medio: 'Transferencia' }]);
  return n;
}
function v1row(t, k, medio, cuenta, cat, origen) {
  var tipo = t.tipo === 'Rendimiento' ? 'Ingreso' : t.tipo, c = cat(t.cat || 'Sin clasificar');
  if (t.tipo === 'Rendimiento') c = 'Inversiones';
  return { id: uid(), fecha: t.fecha || k + '-01', mes: k, descripcion: t.desc, monto: t.monto, usd: t.usd || 0, tipo: tipo, categoria: c, flag: tipo === 'Gasto' ? (t.flag || 'Variable') : '', medio: medio, cuenta: cuenta, cuota: t.cuota ? t.cuota[0] + '/' + t.cuota[1] : '', opId: t.opId || '', origen: origen || 'migracion', estado: 'activo', nota: '' };
}
