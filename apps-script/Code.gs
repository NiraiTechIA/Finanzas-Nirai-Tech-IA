/**
 * FINANZAS NIRAI TECH IA — Backend (Google Apps Script)
 *
 * Corre con TU cuenta de Google. Guarda todo en tu Drive:
 *   FINANZAS NIRAI TECH IA/
 *     ├── Base de datos/            (planilla principal + Copias de seguridad/)
 *     ├── Entrada/                  (soltá acá archivos desde el celu: se detectan solos)
 *     ├── Resúmenes de tarjetas/
 *     ├── Comprobantes/
 *     ├── Ingresos/
 *     ├── Gastos/
 *     └── Reportes mensuales/       (planilla "Totales" para compartir con tu asistente)
 *
 * INSTALACIÓN PARA CLIENTES (3 pasos): hacer una copia de la planilla plantilla →
 * menú «💹 Finanzas → Instalar» → abrir el link personal que aparece (y llega por mail).
 *
 * Propiedades del script (las crea instalar()/setup(); se pueden editar en Configuración del proyecto):
 *   OWNER_EMAIL       Gmail del dueño (único usuario autorizado). Se toma solo de quien instala.
 *   OAUTH_CLIENT_ID   opcional: por defecto el de la app publicada (DEFAULT_CLIENT_ID)
 *   GEMINI_API_KEY    opcional: se carga desde la app (Ajustes → Inteligencia artificial)
 *   GEMINI_MODEL      opcional (por defecto gemini-3.8-flash)
 *   GEMINI_FALLBACK   opcional (por defecto gemini-3.5-flash-lite)
 * Las crea/lee setup(); nunca van en el código del frontend.
 */

var APP_NAME = 'FINANZAS NIRAI TECH IA';
var BACKEND_VERSION = 3;
var APP_URL = 'https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/';
// ID de cliente OAuth de la app publicada (es público: identifica a la app, no da acceso a nada)
var DEFAULT_CLIENT_ID = '288188064237-aatf9mti4ioim04pup4m4ok9abdp16ub.apps.googleusercontent.com';
var SUBFOLDERS = ['Base de datos', 'Entrada', 'Resúmenes de tarjetas', 'Comprobantes', 'Ingresos', 'Gastos', 'Reportes mensuales'];
var KIND_FOLDER = { resumen: 'Resúmenes de tarjetas', comprobante: 'Comprobantes', ingreso: 'Ingresos', gasto: 'Gastos', reporte: 'Reportes mensuales' };

var TABLES = {
  Movimientos: ['id', 'fecha', 'mes', 'descripcion', 'monto', 'usd', 'tipo', 'categoria', 'flag', 'medio', 'cuenta', 'cuota', 'origen', 'importId', 'archivoId', 'hash', 'opId', 'nota', 'estado', 'creado', 'modificado'],
  Importaciones: ['id', 'fecha', 'mes', 'fuente', 'cuenta', 'archivo', 'archivoId', 'movimientos', 'total', 'control', 'meta', 'estado', 'modificado'],
  Categorias: ['id', 'nombre', 'icono', 'tipo', 'palabras', 'orden', 'estado', 'modificado'],
  Mapeos: ['id', 'tipo', 'categoria', 'flag', 'modificado'],
  Config: ['id', 'valor', 'modificado'],
  Pendientes: ['id', 'archivoId', 'nombre', 'mime', 'detectado', 'estado', 'resultado', 'modificado'],
  Log: ['fecha', 'accion', 'tabla', 'id', 'antes', 'despues', 'dispositivo']
};
// columnas que deben quedar como texto (si no, Sheets convierte "2026-11" en fecha)
var TEXT_COLS = ['id', 'fecha', 'mes', 'cuota', 'opId', 'hash', 'importId', 'archivoId', 'creado', 'modificado', 'detectado'];
var SYNC_TABLES = { mov: 'Movimientos', imp: 'Importaciones', cat: 'Categorias', map: 'Mapeos', cfg: 'Config', pend: 'Pendientes' };

var DEFAULT_CATS = [
  ['Comida y restaurantes', '🍔', 'Gasto', 'mcdonald,burger,cafe,confiteria,restaurante,pizzer,parrilla,rotiseria,heladeria,starbucks,mostaza,kfc,pedidosya,rappi,cena,almuerzo,resto,bar,sushi,empanadas'],
  ['Supermercado', '🛒', 'Gasto', 'coto,cencosud,carrefour,jumbo,disco,changomas,walmart,vea,la anonima,supermercado,autoservicio,dia%,mayorista,diarco,makro,chino,verduleria,carniceria'],
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

/* =========================== Utilidades =========================== */
function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k, def) { var v = props_().getProperty(k); return v == null || v === '' ? def : v; }
function nowIso_() { return new Date().toISOString(); }
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function hex_(bytes) { return bytes.map(function (b) { var h = (b & 0xff).toString(16); return h.length === 1 ? '0' + h : h; }).join(''); }
function sha256_(x) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, x)); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function tz_() { return Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires'; }
function cellOut_(v, col) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), col === 'mes' ? 'yyyy-MM' : 'yyyy-MM-dd');
  return v;
}

/* =========================== Setup (correr una vez) =========================== */
function setup() {
  var p = props_(), log = [];
  if (!prop_('OWNER_EMAIL')) p.setProperty('OWNER_EMAIL', Session.getEffectiveUser().getEmail());
  if (!prop_('GEMINI_API_KEY')) log.push('IA sin activar (opcional): cargá tu clave de Gemini desde la app → Ajustes.');

  var root = getRoot_(true);
  var folders = {};
  SUBFOLDERS.forEach(function (n) { folders[n] = child_(root, n, true); });
  child_(folders['Base de datos'], 'Copias de seguridad', true);

  var db = getDb_(true);
  Object.keys(TABLES).forEach(function (t) { ensureSheet_(db, t); });
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) { var d = db.getSheetByName(n); if (d && db.getSheets().length > 1 && d.getLastRow() === 0) db.deleteSheet(d); });
  if (readTable_('Categorias').length === 0) {
    var ts = nowIso_();
    upsertRows_('Categorias', DEFAULT_CATS.map(function (c, i) {
      return { id: c[0], nombre: c[0], icono: c[1], tipo: c[2], palabras: c[3], orden: i, estado: 'activo', modificado: ts };
    }), 'setup');
  }
  getTotals_(true);
  refreshTotals_();

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkInbox').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('dailyBackup').timeBased().atHour(3).everyDays(1).create();

  log.unshift('Listo. Carpeta: ' + root.getUrl(), 'Base de datos: ' + db.getUrl(), 'Totales (para compartir): ' + SpreadsheetApp.openById(prop_('TOTALS_ID')).getUrl(), 'Usuario autorizado: ' + prop_('OWNER_EMAIL'));
  Logger.log(log.join('\n'));
  return log;
}

function getRoot_(create) {
  var id = prop_('ROOT_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var it = DriveApp.getFoldersByName(APP_NAME), f = it.hasNext() ? it.next() : (create ? DriveApp.createFolder(APP_NAME) : null);
  if (f) props_().setProperty('ROOT_ID', f.getId());
  return f;
}
function child_(parent, name, create) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? parent.createFolder(name) : null;
}
function folder_(name) { return child_(getRoot_(true), name, true); }
function getDb_(create) {
  var id = prop_('DB_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { } }
  if (!create) throw new Error('Falta correr setup()');
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { }   // instalación desde la planilla plantilla: esa planilla es la base
  if (ss) ss.rename(APP_NAME + ' — Base de datos'); else ss = SpreadsheetApp.create(APP_NAME + ' — Base de datos');
  DriveApp.getFileById(ss.getId()).moveTo(folder_('Base de datos'));
  props_().setProperty('DB_ID', ss.getId());
  return ss;
}
function getTotals_(create) {
  var id = prop_('TOTALS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { } }
  if (!create) return null;
  var ss = SpreadsheetApp.create(APP_NAME + ' — Totales');
  DriveApp.getFileById(ss.getId()).moveTo(folder_('Reportes mensuales'));
  props_().setProperty('TOTALS_ID', ss.getId());
  return ss;
}
function ensureSheet_(ss, name) {
  var sh = ss.getSheetByName(name), cols = TABLES[name];
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    // agrega columnas nuevas si cambió el esquema
    var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    var missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
    if (missing.length) sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
  var headNow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headNow.forEach(function (c, i) { if (TEXT_COLS.indexOf(c) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@'); });
  return sh;
}

/* =========================== Tablas =========================== */
function sheet_(name) { var db = getDb_(false), sh = db.getSheetByName(name); return sh || ensureSheet_(db, name); }
function readTable_(name) {
  var sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(1, 1, last, sh.getLastColumn()).getValues(), head = vals[0], out = [];
  for (var r = 1; r < vals.length; r++) {
    var o = {}, empty = true;
    for (var c = 0; c < head.length; c++) { if (!head[c]) continue; var v = cellOut_(vals[r][c], head[c]); o[head[c]] = v; if (v !== '' && v != null) empty = false; }
    if (!empty) out.push(o);
  }
  return out;
}
/** Inserta o actualiza por id. Gana la versión con "modificado" más nuevo. Registra cada cambio en Log. */
function upsertRows_(name, rows, device) {
  if (!rows || !rows.length) return { written: 0, skipped: 0 };
  var byId = {}; rows.forEach(function (r) { if (r && r.id != null && r.id !== '') byId[String(r.id)] = r; });
  rows = Object.keys(byId).map(function (k) { return byId[k]; });
  var sh = sheet_(name), last = sh.getLastRow(), ncol = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, ncol).getValues()[0];
  var data = last >= 2 ? sh.getRange(2, 1, last - 1, ncol).getValues() : [];
  var idIx = head.indexOf('id'), modIx = head.indexOf('modificado'), index = {};
  data.forEach(function (r, i) { if (r[idIx] !== '') index[String(r[idIx])] = i; });
  var appends = [], logs = [], written = 0, skipped = 0, touched = {};
  rows.forEach(function (row) {
    if (!row || row.id == null || row.id === '') return;
    var id = String(row.id), arr = head.map(function (h) { var v = row[h]; return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v); });
    if (index.hasOwnProperty(id)) {
      var cur = data[index[id]];
      if (modIx >= 0 && row.modificado && cur[modIx] && String(cur[modIx]) > String(row.modificado)) { skipped++; return; }
      var before = {}; head.forEach(function (h, i) { before[h] = cellOut_(cur[i], h); });
      data[index[id]] = arr; touched[index[id]] = true;
      logs.push([nowIso_(), 'editar', name, id, JSON.stringify(before).slice(0, 45000), JSON.stringify(row).slice(0, 45000), device || '']);
    } else {
      index[id] = data.length + appends.length; appends.push(arr);
      logs.push([nowIso_(), 'crear', name, id, '', JSON.stringify(row).slice(0, 45000), device || '']);
    }
    written++;
  });
  Object.keys(touched).forEach(function (i) { sh.getRange(2 + Number(i), 1, 1, ncol).setValues([data[i]]); });
  if (appends.length) sh.getRange(last + 1, 1, appends.length, ncol).setValues(appends);
  if (name !== 'Log' && logs.length) appendLog_(logs);
  return { written: written, skipped: skipped };
}
function appendLog_(rows) {
  var sh = sheet_('Log');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/* =========================== Seguridad =========================== */
function verifyToken_(idToken) {
  if (!idToken) throw new Error('AUTH: falta iniciar sesión con Google');
  var key = 'tok_' + sha256_(idToken).slice(0, 40), cache = CacheService.getScriptCache(), hit = cache.get(key);
  if (hit) return hit;
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('AUTH: sesión vencida o inválida');
  var info = JSON.parse(res.getContentText());
  var owner = String(prop_('OWNER_EMAIL', '')).toLowerCase(), client = prop_('OAUTH_CLIENT_ID', DEFAULT_CLIENT_ID);
  if (!client || info.aud !== client) throw new Error('AUTH: el token no es para esta aplicación');
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(info.iss) < 0) throw new Error('AUTH: emisor inválido');
  if (String(info.email_verified) !== 'true' || String(info.email).toLowerCase() !== owner) throw new Error('AUTH: esta cuenta no tiene acceso');
  var ttl = Math.max(60, Math.min(3000, Number(info.exp) - Math.floor(Date.now() / 1000) - 60));
  cache.put(key, info.email, ttl);
  return info.email;
}

/* =========================== Web app =========================== */
function doGet() { return json_({ ok: true, app: APP_NAME, version: 2 }); }

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  try {
    verifyToken_(req.idToken);
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Acción desconocida: ' + req.action);
    return json_({ ok: true, data: fn(req.payload || {}, req.device || '') });
  } catch (err) {
    var msg = String(err && err.message || err);
    return json_({ ok: false, error: msg, auth: msg.indexOf('AUTH:') === 0 });
  }
}

var ACTIONS = {
  ping: function () { return { ok: true, at: nowIso_() }; },
  bootstrap: function () {
    var out = {};
    Object.keys(SYNC_TABLES).forEach(function (k) { out[k] = readTable_(SYNC_TABLES[k]); });
    var root = getRoot_(true), tot = getTotals_(false);
    out.links = { carpeta: root.getUrl(), baseDeDatos: getDb_(false).getUrl(), totales: tot ? tot.getUrl() : '', entrada: folder_('Entrada').getUrl() };
    out.ai = !!prop_('GEMINI_API_KEY');
    out.backend = { version: BACKEND_VERSION, owner: prop_('OWNER_EMAIL'), link: personalLink_() };
    out.serverTime = nowIso_();
    return out;
  },
  sync: function (p, device) {
    var lock = LockService.getScriptLock(); lock.waitLock(25000);
    try {
      var res = {};
      (p.ops || []).forEach(function (op) {
        var t = SYNC_TABLES[op.t]; if (!t) throw new Error('Tabla inválida ' + op.t);
        var r = upsertRows_(t, op.rows || [], device);
        res[op.t] = res[op.t] || { written: 0, skipped: 0 }; res[op.t].written += r.written; res[op.t].skipped += r.skipped;
      });
      if ((p.ops || []).some(function (o) { return o.t === 'mov'; })) refreshTotals_();
      return { result: res, serverTime: nowIso_() };
    } finally { lock.releaseLock(); }
  },
  uploadFile: function (p) {
    if (!p.base64 || !p.name) throw new Error('Archivo vacío');
    var bytes = Utilities.base64Decode(p.base64), hash = sha256_(bytes);
    var folder = folder_(KIND_FOLDER[p.kind] || 'Comprobantes'), it = folder.getFiles();
    while (it.hasNext()) { var f = it.next(); if (f.getDescription() === 'sha256:' + hash) return { fileId: f.getId(), url: f.getUrl(), existing: true }; }
    var file = folder.createFile(Utilities.newBlob(bytes, p.mime || 'application/octet-stream', p.name));
    file.setDescription('sha256:' + hash);
    return { fileId: file.getId(), url: file.getUrl(), existing: false };
  },
  getFile: function (p) {
    var f = DriveApp.getFileById(p.fileId);
    if (!insideRoot_(f)) throw new Error('El archivo no está en la carpeta de la app');
    var b = f.getBlob();
    return { name: f.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
  },
  moveFile: function (p) {
    var f = DriveApp.getFileById(p.fileId);
    if (!insideRoot_(f)) throw new Error('El archivo no está en la carpeta de la app');
    f.moveTo(folder_(KIND_FOLDER[p.kind] || 'Comprobantes'));
    return { fileId: f.getId(), url: f.getUrl() };
  },
  checkInbox: function () { return checkInbox(); },
  ai: function (p) { return aiTask_(p); },
  backupNow: function () { return dailyBackup(); },
  refreshTotals: function () { refreshTotals_(); return { ok: true }; },
  /** Guarda la clave de Gemini del dueño (la prueba antes de guardarla). Nunca se devuelve al navegador. */
  setAiKey: function (p) {
    var key = String(p.key || '').trim();
    if (!key) { props_().deleteProperty('GEMINI_API_KEY'); return { ai: false }; }
    var prev = prop_('GEMINI_API_KEY');
    props_().setProperty('GEMINI_API_KEY', key);
    try { gemini_([{ text: 'Respondé solamente: OK' }], { text: true }); }
    catch (e) { if (prev) props_().setProperty('GEMINI_API_KEY', prev); else props_().deleteProperty('GEMINI_API_KEY'); throw new Error('La clave no funcionó: ' + String(e.message || e).slice(0, 200)); }
    return { ai: true };
  }
};

function insideRoot_(file) {
  var rootId = getRoot_(false).getId(), queue = [], it = file.getParents(), seen = 0;
  while (it.hasNext()) queue.push(it.next());
  while (queue.length && seen < 20) {
    var f = queue.shift(); seen++;
    if (f.getId() === rootId) return true;
    var pi = f.getParents(); while (pi.hasNext()) queue.push(pi.next());
  }
  return false;
}

/* =========================== Bandeja de entrada (trigger) =========================== */
function checkInbox() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { nuevos: 0 };
  try {
    var inbox = folder_('Entrada'), known = {}, nuevos = [];
    readTable_('Pendientes').forEach(function (r) { known[r.archivoId] = true; });
    var it = inbox.getFiles();
    while (it.hasNext()) {
      var f = it.next(); if (known[f.getId()]) continue;
      var mime = f.getMimeType(), row = { id: uid_(), archivoId: f.getId(), nombre: f.getName(), mime: mime, detectado: nowIso_(), estado: 'nuevo', resultado: '', modificado: nowIso_() };
      // Fotos: se pre-procesan con IA para que el resumen esté listo al abrir la app.
      // PDF/Excel/CSV: los lee la app con sus lectores exactos (cuadran contra el total del resumen).
      if (/^image\//.test(mime) && prop_('GEMINI_API_KEY')) {
        try { row.resultado = JSON.stringify(aiTask_({ task: 'extract', mime: mime, base64: Utilities.base64Encode(f.getBlob().getBytes()), name: f.getName() })).slice(0, 49000); }
        catch (e) { row.resultado = JSON.stringify({ error: String(e.message || e) }); }
      }
      nuevos.push(row);
    }
    if (nuevos.length) upsertRows_('Pendientes', nuevos, 'trigger');
    return { nuevos: nuevos.length };
  } finally { lock.releaseLock(); }
}

/* =========================== Copias de seguridad =========================== */
function dailyBackup() {
  var db = getDb_(false), dest = child_(folder_('Base de datos'), 'Copias de seguridad', true);
  var name = APP_NAME + ' — copia ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH.mm');
  var copy = DriveApp.getFileById(db.getId()).makeCopy(name, dest);
  // conserva las últimas 60 copias (las viejas van a la papelera, se pueden recuperar 30 días)
  var files = [], it = dest.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(60).forEach(function (f) { f.setTrashed(true); });
  return { copia: copy.getUrl(), total: Math.min(files.length, 60) };
}

/* =========================== Planilla de totales (para compartir) =========================== */
function summarizeRows_(movs) {
  var by = {};
  movs.forEach(function (m) {
    if (m.estado === 'borrado' || m.estado === 'reemplazado' || !m.mes) return;
    var k = String(m.mes), s = by[k] || (by[k] = { mes: k, ingresos: 0, gastos: 0, tarjeta: 0, mp: 0, prestamos: 0, deudas: 0, cats: {} });
    var v = Number(m.monto) || 0;
    if (m.tipo === 'Ingreso') s.ingresos += v;
    else if (m.tipo === 'Gasto') {
      s.gastos += -v; s.cats[m.categoria] = (s.cats[m.categoria] || 0) - v;
      if (m.medio === 'Tarjeta de crédito') s.tarjeta += -v; else if (m.medio === 'Mercado Pago') s.mp += -v;
    } else if (m.tipo === 'Préstamo') s.prestamos += v;
    else if (m.tipo === 'Deuda') s.deudas += v;
  });
  return by;
}
function refreshTotals_() {
  var ss = getTotals_(false); if (!ss) return;
  var by = summarizeRows_(readTable_('Movimientos')), keys = Object.keys(by).sort();
  var r0 = function (x) { return Math.round(x); };
  var mensual = [['Mes', 'Ingresos', 'Gastos', 'Balance', 'Ahorro %', 'Gastos con tarjeta', 'Gastos con Mercado Pago', 'Préstamos (neto)', 'Deudas (neto)']];
  keys.forEach(function (k) { var s = by[k], bal = s.ingresos - s.gastos; mensual.push([k, r0(s.ingresos), r0(s.gastos), r0(bal), s.ingresos > 0 ? Math.round(bal / s.ingresos * 1000) / 10 : 0, r0(s.tarjeta), r0(s.mp), r0(s.prestamos), r0(s.deudas)]); });
  writeSheet_(ss, 'Mensual', mensual);
  [['Trimestral', 3], ['Semestral', 6], ['Anual', 12]].forEach(function (pp) {
    var g = {}, rows = [['Período', 'Meses cargados', 'Ingresos', 'Gastos', 'Balance', 'Ahorro %']];
    keys.forEach(function (k) {
      var y = k.slice(0, 4), m = Number(k.slice(5, 7)), lab = pp[1] === 3 ? y + ' T' + Math.ceil(m / 3) : pp[1] === 6 ? y + ' S' + (m <= 6 ? 1 : 2) : y;
      var a = g[lab] || (g[lab] = { n: 0, i: 0, gs: 0 }); a.n++; a.i += by[k].ingresos; a.gs += by[k].gastos;
    });
    Object.keys(g).sort().forEach(function (lab) { var a = g[lab], b = a.i - a.gs; rows.push([lab, a.n + ' de ' + pp[1], r0(a.i), r0(a.gs), r0(b), a.i > 0 ? Math.round(b / a.i * 1000) / 10 : 0]); });
    writeSheet_(ss, pp[0], rows);
  });
  var cats = [['Mes', 'Categoría', 'Gasto']];
  keys.slice(-12).forEach(function (k) { Object.keys(by[k].cats).sort(function (a, b) { return by[k].cats[b] - by[k].cats[a]; }).forEach(function (c) { cats.push([k, c, r0(by[k].cats[c])]); }); });
  writeSheet_(ss, 'Gastos por categoría', cats);
  writeSheet_(ss, 'Info', [['Actualizado', Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm')], ['Nota', 'Planilla generada automáticamente por FINANZAS NIRAI TECH IA. No editar: se sobrescribe.']]);
  var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1'); if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
function writeSheet_(ss, name, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var w = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 1);
  var norm = rows.map(function (r) { while (r.length < w) r.push(''); return r; });
  sh.getRange(1, 1, 1, w).setNumberFormat('@');
  if (name === 'Mensual' || name === 'Gastos por categoría') sh.getRange(1, 1, Math.max(1, norm.length), 1).setNumberFormat('@');
  sh.getRange(1, 1, norm.length, w).setValues(norm);
  sh.getRange(1, 1, 1, w).setFontWeight('bold'); sh.setFrozenRows(1);
}

/* =========================== Gemini =========================== */
function gemini_(parts, opts) {
  var key = prop_('GEMINI_API_KEY'); if (!key) throw new Error('IA no configurada: falta GEMINI_API_KEY');
  var models = [prop_('GEMINI_MODEL', 'gemini-3.8-flash'), prop_('GEMINI_FALLBACK', 'gemini-3.5-flash-lite')], lastErr = '';
  for (var i = 0; i < models.length; i++) {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0.1, responseMimeType: (opts && opts.text) ? 'text/plain' : 'application/json' }
      })
    });
    var code = res.getResponseCode(), body = res.getContentText();
    if (code === 200) {
      var j = JSON.parse(body), c = j.candidates && j.candidates[0], txt = c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
      if (opts && opts.text) return txt;
      return parseJsonLoose_(txt);
    }
    lastErr = 'Gemini ' + models[i] + ' respondió ' + code + ': ' + body.slice(0, 300);
    if ([404, 429, 500, 503].indexOf(code) < 0) break;
  }
  throw new Error(lastErr);
}
function parseJsonLoose_(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); throw new Error('La IA no devolvió JSON válido'); }
}

var EXTRACT_PROMPT = [
  'Sos un extractor de movimientos financieros de Argentina. Analizá el documento adjunto (resumen de tarjeta de crédito, resumen de cuenta de Mercado Pago, extracto bancario, comprobante de pago, ticket o captura de pantalla).',
  'Devolvé SOLO un JSON con esta forma exacta:',
  '{"tipoDocumento":"tarjeta|mercadopago|banco|comprobante|otro","cuenta":"nombre de la tarjeta o cuenta, ej: Visa ···1234, o vacío","periodo":"YYYY-MM del resumen o del comprobante","cierre":"YYYY-MM-DD o vacío","total":número o null,',
  '"movimientos":[{"fecha":"YYYY-MM-DD","descripcion":"texto","monto":número,"moneda":"ARS|USD","cuota":"n/m o vacío","tipo":"Ingreso|Gasto|Interno|Préstamo|Deuda","categoria":"una de la lista","medio":"Tarjeta de crédito|Mercado Pago|Débito|Efectivo|Transferencia|Otro","confianza":0.0 a 1.0}]}',
  'Reglas: monto NEGATIVO para salidas de dinero/compras y POSITIVO para entradas. Importes argentinos usan punto de miles y coma decimal (1.234,56 = 1234.56).',
  'En resúmenes de tarjeta NO incluyas los pagos del resumen anterior ("su pago", "pago en pesos"), ni saldos ni totales: solo consumos, cuotas, impuestos y cargos.',
  'Transferencias entre cuentas propias y pagos de tarjeta van como tipo "Interno". Rendimientos de Mercado Pago son "Ingreso" categoría "Inversiones".',
  'Si un dato no se lee bien, poné confianza baja (<0.6). No inventes movimientos. Si el año no figura, usá el del período.'
].join('\n');

var CHAT_PROMPT = [
  'Sos el asistente de finanzas personales FINANZAS NIRAI TECH IA (Argentina, pesos). Interpretá el mensaje del usuario y devolvé SOLO JSON:',
  '{"accion":"registrar|corregir|eliminar|consultar|conversar",',
  '"movimiento":{"fecha":"YYYY-MM-DD","descripcion":"concepto corto","monto":número positivo,"tipo":"Ingreso|Gasto|Interno|Préstamo|Deuda","sentido":"entrada|salida","categoria":"una de la lista o una nueva si ninguna encaja","icono":"emoji si la categoría es nueva","medio":"Tarjeta de crédito|Mercado Pago|Débito|Efectivo|Transferencia|", "cuotas":número o null},',
  '"correccion":{"id":"id del movimiento a corregir (de la lista de recientes)","cambios":{"monto":número positivo,"descripcion":"","categoria":"","fecha":"","medio":""}},',
  '"consulta":{"metrica":"gastos|ingresos|balance|gasto_categoria|gasto_medio|tarjeta_a_pagar|mayores_gastos|categoria_top|ahorro_vs_anterior|disponible|inusuales|recomendaciones|libre","categoria":"","medio":"","mes":"YYYY-MM"},',
  '"faltan":["monto|tipo|descripcion"],"pregunta":"pregunta corta si falta un dato indispensable","respuesta":"respuesta breve para conversar"}',
  'Reglas: "le presté X a alguien" = tipo Préstamo sentido salida. "me prestaron" = Deuda entrada. "me devolvió" un préstamo = Préstamo entrada. "pagué la cuota del préstamo" = Deuda salida.',
  'Sueldo/cobro = Ingreso. Gasté/pagué/compré = Gasto. Si el medio no se dice, dejalo vacío. Fecha por defecto: hoy. "ayer" = hoy-1.',
  'Para correcciones como "el gasto anterior no fue de X, fue de Y" elegí el movimiento reciente que coincida y poné solo los cambios.',
  'No inventes importes: si no hay monto, ponelo en "faltan".'
].join('\n');

var ANALYZE_PROMPT = [
  'Sos un asesor de finanzas personales en Argentina. Usá EXCLUSIVAMENTE los datos JSON provistos (son los registros reales del usuario). No inventes cifras.',
  'Respondé en castellano rioplatense, breve y concreto (máximo 8 líneas), con importes en formato $ 1.234. Si la pregunta no se puede responder con esos datos, decilo.'
].join('\n');

function aiTask_(p) {
  var today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  if (p.task === 'extract') {
    var parts = [{ text: EXTRACT_PROMPT + '\nCategorías: ' + (p.categorias || DEFAULT_CATS.map(function (c) { return c[0]; })).join(', ') + '\nHoy: ' + today + (p.name ? '\nArchivo: ' + p.name : '') }];
    if (p.base64) parts.push({ inline_data: { mime_type: p.mime, data: p.base64 } });
    if (p.text) parts.push({ text: 'Contenido:\n' + String(p.text).slice(0, 120000) });
    return gemini_(parts);
  }
  if (p.task === 'chat') {
    return gemini_([{ text: CHAT_PROMPT + '\nHoy: ' + today + '\nCategorías: ' + (p.categorias || []).join(', ') + '\nMovimientos recientes: ' + JSON.stringify(p.recientes || []).slice(0, 8000) + '\nContexto de la charla: ' + JSON.stringify(p.contexto || null) + '\nMensaje: ' + p.mensaje }]);
  }
  if (p.task === 'analyze') {
    return { texto: gemini_([{ text: ANALYZE_PROMPT + '\nDatos: ' + JSON.stringify(p.datos || {}).slice(0, 60000) + '\nPregunta: ' + p.pregunta }], { text: true }) };
  }
  throw new Error('Tarea de IA desconocida');
}

/* =========================== Instalación en 3 pasos (planilla plantilla) =========================== */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('💹 Finanzas')
      .addItem('Instalar (o reparar)', 'instalar')
      .addItem('Ver mi link personal', 'mostrarLink')
      .addToUi();
  } catch (e) { }
}
function personalLink_() { var id = prop_('DEPLOYMENT_ID'); return id ? APP_URL + '?conectar=' + id : ''; }
/** Paso 2: crea carpetas, base y tareas, publica el backend y entrega el link personal. */
function instalar() {
  var log = setup(), dep;
  try { dep = desplegar_(); props_().setProperty('DEPLOYMENT_ID', dep.id); props_().setProperty('WEBAPP_URL', dep.url); enviarLink_(); }
  catch (e) { dep = { error: String(e.message || e), code: e.code || 0 }; }
  mostrarResultado_(dep);
  return { log: log, deploy: dep };
}
function mostrarLink() { mostrarResultado_(prop_('DEPLOYMENT_ID') ? { id: prop_('DEPLOYMENT_ID') } : { error: 'Todavía no está instalado. Usá el menú 💹 Finanzas → Instalar.' }); }
/** Publica el script como aplicación web con la API de Apps Script (crea versión + implementación, o actualiza la existente). */
function desplegar_() {
  var base = 'https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId(), headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  var call = function (method, path, body) {
    var r = UrlFetchApp.fetch(base + path, { method: method, contentType: 'application/json', headers: headers, muteHttpExceptions: true, payload: JSON.stringify(body || {}) });
    var t = r.getContentText();
    if (r.getResponseCode() >= 300) { var msg = t; try { msg = JSON.parse(t).error.message; } catch (e) { } var err = new Error(msg); err.code = r.getResponseCode(); throw err; }
    return JSON.parse(t || '{}');
  };
  var v = call('post', '/versions', { description: APP_NAME + ' v' + BACKEND_VERSION });
  var cfg = { versionNumber: v.versionNumber, manifestFileName: 'appsscript', description: APP_NAME };
  var d = null, id = prop_('DEPLOYMENT_ID');
  if (id) { try { d = call('put', '/deployments/' + id, { deploymentConfig: cfg }); } catch (e) { d = null; } }
  if (!d) d = call('post', '/deployments', cfg);
  var ep = (d.entryPoints || []).filter(function (x) { return x.entryPointType === 'WEB_APP'; })[0];
  if (!ep || !ep.webApp) throw new Error('La publicación no generó la aplicación web.');
  return { id: d.deploymentId, url: ep.webApp.url };
}
function enviarLink_() {
  try {
    var link = personalLink_(); if (!link) return;
    MailApp.sendEmail({ to: prop_('OWNER_EMAIL'), subject: 'Tu link personal de ' + APP_NAME,
      htmlBody: '<p>¡Listo! Tu asistente financiero quedó conectado a tu Google Drive.</p><p><b>Tu link personal:</b><br><a href="' + link + '">' + link + '</a></p><p>Abrilo una vez en cada dispositivo (PC y celular) e iniciá sesión con esta misma cuenta de Google. No lo compartas: es la llave a tu base de datos (igual, solo tu cuenta puede entrar).</p>' });
  } catch (e) { }
}
function mostrarResultado_(dep) {
  var html;
  if (dep && dep.id) {
    var link = personalLink_() || (APP_URL + '?conectar=' + dep.id);
    html = '<div style="font:14px/1.5 system-ui,Arial;padding:4px 6px"><h2 style="margin:0 0 8px">✅ ¡Instalado!</h2><p>Tu asistente financiero quedó conectado a tu Google Drive (carpeta <b>' + APP_NAME + '</b>).</p>' +
      '<p><a href="' + link + '" target="_blank" style="display:inline-block;background:#1f4fd8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Abrir mi app</a></p>' +
      '<p style="font-size:12px;color:#555">Tu link personal (también te llegó por mail, para abrirlo en el celular):<br><input style="width:100%;font-size:12px" readonly value="' + link + '" onclick="this.select()"></p></div>';
  } else {
    var api = /Apps Script API|has not enabled|not been used|disabled/i.test((dep && dep.error) || '');
    html = '<div style="font:14px/1.5 system-ui,Arial;padding:4px 6px">' + (api
      ? '<h2 style="margin:0 0 8px">Falta un permiso (una sola vez)</h2><ol><li>Abrí <a href="https://script.google.com/home/usersettings" target="_blank"><b>este enlace</b></a> y activá <b>«API de Google Apps Script»</b> (interruptor en «Activado»).</li><li>Volvé a esta planilla y tocá otra vez <b>💹 Finanzas → Instalar</b>.</li></ol><p style="font-size:12px;color:#555">Tus carpetas y tu base de datos ya están creadas; solo falta publicar tu conexión.</p>'
      : '<h2 style="margin:0 0 8px">No se pudo terminar</h2><p>' + String((dep && dep.error) || '').replace(/</g, '&lt;') + '</p><p>Probá de nuevo con <b>💹 Finanzas → Instalar</b>. Si sigue, escribinos.</p>') + '</div>';
  }
  try { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(330), APP_NAME); } catch (e) { Logger.log(html); }
}
/** Solo para el dueño de la app: deja lista la planilla plantilla que se comparte con los clientes. */
function prepararPlantilla() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename(APP_NAME + ' — Instalador');
  var sh = ss.getSheetByName('👋 Empezá acá') || ss.insertSheet('👋 Empezá acá', 0);
  sh.clear();
  sh.getRange(1, 1, 9, 1).setValues([['💹 ' + APP_NAME], [''], ['Instalación en 3 pasos:'], ['1. Ya hiciste la copia ✔'], ['2. Arriba, en el menú, tocá  💹 Finanzas  →  Instalar  y aceptá los permisos de Google.'], ['3. Tocá «Abrir mi app». Tu link personal también te llega por mail.'], [''], ['Tus datos quedan en TU Google Drive. Nadie más tiene acceso.'], ['Si el menú 💹 Finanzas no aparece, recargá la página (F5).']]);
  sh.getRange(1, 1).setFontSize(18).setFontWeight('bold'); sh.getRange(3, 1).setFontWeight('bold'); sh.setColumnWidth(1, 720);
  ss.getSheets().forEach(function (x) { if (x.getName() !== '👋 Empezá acá') ss.deleteSheet(x); });
  ['DB_ID', 'ROOT_ID', 'TOTALS_ID', 'DEPLOYMENT_ID', 'WEBAPP_URL', 'OWNER_EMAIL', 'GEMINI_API_KEY', 'OAUTH_CLIENT_ID'].forEach(function (k) { props_().deleteProperty(k); });
  return 'Plantilla lista. Compartila como «Cualquier persona con el enlace: Lector» y usá el link terminado en /copy.';
}
