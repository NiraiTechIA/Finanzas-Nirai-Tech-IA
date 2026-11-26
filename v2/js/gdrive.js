/* FINANZAS NIRAI TECH IA — modo directo: la app habla con Google Drive y Sheets desde el navegador.
   No hace falta instalar ni publicar nada: el usuario toca «Conectar con Google» y acepta.
   Permiso usado: drive.file (la app solo ve los archivos que ella misma crea; no ve el resto de tu Drive).
   Mismo contrato que el backend de Apps Script (bootstrap, sync, uploadFile, …), así app.js no cambia. */
var GD = (function () {
  var APP_NAME = 'FINANZAS NIRAI TECH IA', DRIVE = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files', SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  var FOLDER = 'application/vnd.google-apps.folder', SHEET = 'application/vnd.google-apps.spreadsheet';
  var SUBFOLDERS = ['Base de datos', 'Resúmenes de tarjetas', 'Comprobantes', 'Ingresos', 'Gastos', 'Reportes mensuales'];
  var KIND_FOLDER = { resumen: 'Resúmenes de tarjetas', comprobante: 'Comprobantes', ingreso: 'Ingresos', gasto: 'Gastos', reporte: 'Reportes mensuales' };
  var TABLES = {
    Movimientos: ['id', 'fecha', 'mes', 'descripcion', 'monto', 'usd', 'tipo', 'categoria', 'flag', 'medio', 'cuenta', 'cuota', 'origen', 'importId', 'archivoId', 'hash', 'opId', 'nota', 'estado', 'creado', 'modificado'],
    Importaciones: ['id', 'fecha', 'mes', 'fuente', 'cuenta', 'archivo', 'archivoId', 'movimientos', 'total', 'control', 'meta', 'estado', 'modificado'],
    Categorias: ['id', 'nombre', 'icono', 'tipo', 'palabras', 'orden', 'estado', 'modificado'],
    Mapeos: ['id', 'tipo', 'categoria', 'flag', 'modificado'],
    Config: ['id', 'valor', 'modificado'],
    Pendientes: ['id', 'archivoId', 'nombre', 'mime', 'detectado', 'estado', 'resultado', 'modificado'],
    Log: ['fecha', 'accion', 'tabla', 'id', 'antes', 'despues', 'dispositivo'],
    Privado: ['id', 'valor']   // clave de IA y datos internos: no se sincroniza a la app ni a Totales
  };
  var SYNC_TABLES = { mov: 'Movimientos', imp: 'Importaciones', cat: 'Categorias', map: 'Mapeos', cfg: 'Config', pend: 'Pendientes' };
  var token = '', email = '', st = null, _busy = Promise.resolve();

  function nowIso() { return new Date().toISOString(); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function q(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function rng(sheet, a1) { return "'" + sheet.replace(/'/g, "''") + "'" + (a1 ? '!' + a1 : ''); }
  function col(n) { var s = ''; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function stKey() { return 'nirai_gd_' + email; }

  function req(url, opt) {
    opt = opt || {};
    var h = Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {});
    if (opt.json !== undefined) { h['Content-Type'] = 'application/json'; opt.body = JSON.stringify(opt.json); }
    return fetch(url, { method: opt.method || 'GET', headers: h, body: opt.body }).then(function (r) {
      if (r.status === 401) throw new Error('AUTH: tu sesión de Google venció. Tocá «Conectar con Google».');
      if (r.status === 403) return r.text().then(function (t) {
        if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(t)) throw new Error('Falta activar Google Drive API / Sheets API en el proyecto de Google Cloud de la app.');
        if (/insufficient|scope/i.test(t)) throw new Error('AUTH: faltó aceptar el permiso de Google Drive. Volvé a tocar «Conectar con Google» y tildá el permiso.');
        throw new Error('Google rechazó el pedido (403): ' + t.slice(0, 160));
      });
      if (r.status === 404) { var e = new Error('No encontrado'); e.notFound = true; throw e; }
      if (!r.ok) return r.text().then(function (t) { throw new Error('Google respondió ' + r.status + ': ' + t.slice(0, 160)); });
      if (opt.raw) return r;
      return r.status === 204 ? {} : r.json();
    });
  }

  /* ---------- Drive ---------- */
  function list(qs, fields) { return req(DRIVE + '?q=' + encodeURIComponent(qs) + '&orderBy=createdTime&pageSize=1000&spaces=drive&fields=' + encodeURIComponent('files(' + (fields || 'id,name,mimeType,createdTime') + ')')).then(function (j) { return j.files || []; }); }
  function findOrCreate(name, mime, parent) {
    return list('name = ' + q(name) + ' and mimeType = ' + q(mime) + ' and trashed = false' + (parent ? ' and ' + q(parent) + ' in parents' : '')).then(function (f) {
      if (f.length) return { id: f[0].id, created: false };
      return req(DRIVE + '?fields=id', { method: 'POST', json: { name: name, mimeType: mime, parents: parent ? [parent] : undefined } }).then(function (j) { return { id: j.id, created: true }; });
    });
  }
  function folderUrl(id) { return 'https://drive.google.com/drive/folders/' + id; }
  function sheetUrl(id) { return 'https://docs.google.com/spreadsheets/d/' + id + '/edit'; }

  /** Busca (o crea la primera vez) la carpeta, las subcarpetas, la base de datos y la planilla de Totales. */
  function discover() {
    var s = { folders: {} };
    return findOrCreate(APP_NAME, FOLDER, null).then(function (r) {
      s.root = r.id;
      return SUBFOLDERS.reduce(function (p, n) { return p.then(function () { return findOrCreate(n, FOLDER, s.root).then(function (x) { s.folders[n] = x.id; }); }); }, Promise.resolve());
    }).then(function () { return findOrCreate('Copias de seguridad', FOLDER, s.folders['Base de datos']); }).then(function (r) {
      s.folders.copias = r.id;
      return findOrCreate(APP_NAME + ' — Base de datos', SHEET, s.folders['Base de datos']);
    }).then(function (r) {
      s.db = r.id; s.dbNew = r.created;
      return findOrCreate(APP_NAME + ' — Totales', SHEET, s.folders['Reportes mensuales']);
    }).then(function (r) { s.totals = r.id; return s; });
  }

  /* ---------- Sheets ---------- */
  function sheetTitles(id) { return req(SHEETS + '/' + id + '?fields=' + encodeURIComponent('sheets.properties(sheetId,title)')).then(function (j) { return (j.sheets || []).map(function (x) { return x.properties; }); }); }
  function ensureSheets(id, names) {
    return sheetTitles(id).then(function (props) {
      var have = {}; props.forEach(function (p) { have[p.title] = p.sheetId; });
      var reqs = names.filter(function (n) { return !(n in have); }).map(function (n) { return { addSheet: { properties: { title: n, gridProperties: { frozenRowCount: 1 } } } }; });
      ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) { if (n in have && names.indexOf(n) < 0 && props.length + reqs.length > 1) reqs.push({ deleteSheet: { sheetId: have[n] } }); });
      return reqs.length ? req(SHEETS + '/' + id + ':batchUpdate', { method: 'POST', json: { requests: reqs } }) : null;
    });
  }
  function batchGet(id, names) {
    return req(SHEETS + '/' + id + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' + names.map(function (n) { return 'ranges=' + encodeURIComponent(rng(n, 'A1:AZ')); }).join('&'))
      .then(function (j) { var out = {}; (j.valueRanges || []).forEach(function (v, i) { out[names[i]] = v.values || []; }); return out; });
  }
  function writeValues(id, data) { return data.length ? req(SHEETS + '/' + id + '/values:batchUpdate', { method: 'POST', json: { valueInputOption: 'RAW', data: data } }) : Promise.resolve(); }
  function append(id, name, rows) { return rows.length ? req(SHEETS + '/' + id + '/values/' + encodeURIComponent(rng(name, 'A1')) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', json: { values: rows } }) : Promise.resolve(); }
  function cell(v) { return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v; }

  /** Devuelve la tabla como objetos, y agrega columnas al encabezado si cambió el esquema. */
  function parse(name, values, fixes) {
    var cols = TABLES[name], head = (values[0] || []).map(String);
    if (!head.length || cols.some(function (c) { return head.indexOf(c) < 0; })) {
      cols.forEach(function (c) { if (head.indexOf(c) < 0) head.push(c); });
      fixes.push({ range: rng(name, 'A1'), values: [head] });
    }
    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var o = {}, empty = true;
      head.forEach(function (h, i) { var v = values[r][i]; if (v === undefined) v = ''; o[h] = v; if (v !== '') empty = false; });
      if (!empty) rows.push(o);
    }
    return { head: head, rows: rows, raw: values };
  }
  function readTables(names) {
    return batchGet(st.db, names).then(function (vals) {
      var fixes = [], out = {};
      names.forEach(function (n) { out[n] = parse(n, vals[n], fixes); });
      return writeValues(st.db, fixes).then(function () { return out; });
    });
  }

  /** Inserta o actualiza por id. Gana la versión con «modificado» más nuevo. Registra cada cambio en Log. */
  function upsert(name, tbl, rows, device) {
    var byId = {}; rows.forEach(function (r) { if (r && r.id != null && r.id !== '') byId[String(r.id)] = r; });
    var index = {}, idIx = tbl.head.indexOf('id'), modIx = tbl.head.indexOf('modificado');
    for (var i = 1; i < tbl.raw.length; i++) { var idv = tbl.raw[i][idIx]; if (idv !== undefined && idv !== '') index[String(idv)] = i; }
    var updates = [], appends = [], logs = [], written = 0, skipped = 0;
    Object.keys(byId).forEach(function (id) {
      var row = byId[id], arr = tbl.head.map(function (h) { return cell(row[h]); });
      if (id in index) {
        var cur = tbl.raw[index[id]] || [];
        if (modIx >= 0 && row.modificado && cur[modIx] && String(cur[modIx]) > String(row.modificado)) { skipped++; return; }
        var before = {}; tbl.head.forEach(function (h, k) { before[h] = cur[k] === undefined ? '' : cur[k]; });
        updates.push({ range: rng(name, 'A' + (index[id] + 1)), values: [arr] }); tbl.raw[index[id]] = arr;
        logs.push([nowIso(), 'editar', name, id, JSON.stringify(before).slice(0, 45000), JSON.stringify(row).slice(0, 45000), device || '']);
      } else {
        appends.push(arr); index[id] = tbl.raw.length; tbl.raw.push(arr);
        logs.push([nowIso(), 'crear', name, id, '', JSON.stringify(row).slice(0, 45000), device || '']);
      }
      written++;
    });
    return { updates: updates, appends: appends, logs: logs, written: written, skipped: skipped };
  }

  /* ---------- Totales (planilla para compartir con tu contador o asistente) ---------- */
  function summarize(movs) {
    var by = {};
    movs.forEach(function (m) {
      if (m.estado === 'borrado' || m.estado === 'reemplazado' || !m.mes) return;
      var k = String(m.mes), s = by[k] || (by[k] = { ingresos: 0, gastos: 0, tarjeta: 0, mp: 0, prestamos: 0, deudas: 0, cats: {} }), v = Number(m.monto) || 0;
      if (m.tipo === 'Ingreso') s.ingresos += v;
      else if (m.tipo === 'Gasto') { s.gastos += -v; s.cats[m.categoria] = (s.cats[m.categoria] || 0) - v; if (m.medio === 'Tarjeta de crédito') s.tarjeta += -v; else if (m.medio === 'Mercado Pago') s.mp += -v; }
      else if (m.tipo === 'Préstamo') s.prestamos += v; else if (m.tipo === 'Deuda') s.deudas += v;
    });
    return by;
  }
  function refreshTotals(movs) {
    var p = movs ? Promise.resolve(movs) : readTables(['Movimientos']).then(function (t) { return t.Movimientos.rows; });
    return p.then(function (movs) {
      var by = summarize(movs), keys = Object.keys(by).sort(), r0 = Math.round, pc = function (b, i) { return i > 0 ? Math.round(b / i * 1000) / 10 : 0; }, sheets = {};
      sheets.Mensual = [['Mes', 'Ingresos', 'Gastos', 'Balance', 'Ahorro %', 'Gastos con tarjeta', 'Gastos con Mercado Pago', 'Préstamos (neto)', 'Deudas (neto)']].concat(keys.map(function (k) { var s = by[k], b = s.ingresos - s.gastos; return [k, r0(s.ingresos), r0(s.gastos), r0(b), pc(b, s.ingresos), r0(s.tarjeta), r0(s.mp), r0(s.prestamos), r0(s.deudas)]; }));
      [['Trimestral', 3], ['Semestral', 6], ['Anual', 12]].forEach(function (pp) {
        var g = {};
        keys.forEach(function (k) { var y = k.slice(0, 4), m = Number(k.slice(5, 7)), lab = pp[1] === 3 ? y + ' T' + Math.ceil(m / 3) : pp[1] === 6 ? y + ' S' + (m <= 6 ? 1 : 2) : y, a = g[lab] || (g[lab] = { n: 0, i: 0, gs: 0 }); a.n++; a.i += by[k].ingresos; a.gs += by[k].gastos; });
        sheets[pp[0]] = [['Período', 'Meses cargados', 'Ingresos', 'Gastos', 'Balance', 'Ahorro %']].concat(Object.keys(g).sort().map(function (l) { var a = g[l], b = a.i - a.gs; return [l, a.n + ' de ' + pp[1], r0(a.i), r0(a.gs), r0(b), pc(b, a.i)]; }));
      });
      var cats = [['Mes', 'Categoría', 'Gasto']];
      keys.slice(-12).forEach(function (k) { Object.keys(by[k].cats).sort(function (a, b) { return by[k].cats[b] - by[k].cats[a]; }).forEach(function (c) { cats.push([k, c, r0(by[k].cats[c])]); }); });
      sheets['Gastos por categoría'] = cats;
      var d = new Date(); sheets.Info = [['Actualizado', today() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')], ['Nota', 'Planilla generada automáticamente por FINANZAS NIRAI TECH IA. No editar: se sobrescribe.']];
      var names = Object.keys(sheets);
      return ensureSheets(st.totals, names).then(function () {
        return req(SHEETS + '/' + st.totals + '/values:batchClear', { method: 'POST', json: { ranges: names.map(function (n) { return rng(n); }) } });
      }).then(function () { return writeValues(st.totals, names.map(function (n) { return { range: rng(n, 'A1'), values: sheets[n] }; })); });
    });
  }

  /* ---------- Privado (clave de IA, última copia) ---------- */
  function getPriv(t) { var o = {}; t.Privado.rows.forEach(function (r) { o[r.id] = r.valor; }); return o; }
  function setPriv(id, valor) {
    return readTables(['Privado']).then(function (t) {
      var r = upsert('Privado', t.Privado, [{ id: id, valor: valor }]);
      return writeValues(st.db, r.updates).then(function () { return append(st.db, 'Privado', r.appends); });
    });
  }

  /* ---------- Copias de seguridad (una por día, al abrir la app; se guardan las últimas 60) ---------- */
  function backup() {
    var d = new Date(), name = APP_NAME + ' — copia ' + today() + ' ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
    return req(DRIVE + '/' + st.db + '/copy?fields=id', { method: 'POST', json: { name: name, parents: [st.folders.copias] } }).then(function (c) {
      return list(q(st.folders.copias) + ' in parents and trashed = false', 'id,createdTime').then(function (files) {
        files.sort(function (a, b) { return a.createdTime < b.createdTime ? 1 : -1; });
        return Promise.all(files.slice(60).map(function (f) { return req(DRIVE + '/' + f.id, { method: 'PATCH', json: { trashed: true } }); })).then(function () {
          return setPriv('ultimaCopia', today()).then(function () { return { copia: sheetUrl(c.id), total: Math.min(files.length, 60) }; });
        });
      });
    });
  }

  /* ---------- Archivos ---------- */
  function b64ToBytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function bytesToB64(buf) { var u = new Uint8Array(buf), s = '', ch = 0x8000; for (var i = 0; i < u.length; i += ch) s += String.fromCharCode.apply(null, u.subarray(i, i + ch)); return btoa(s); }
  function sha256(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(function (h) { return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }); }
  function uploadFile(p) {
    if (!p.base64 || !p.name) return Promise.reject(new Error('Archivo vacío'));
    var bytes = b64ToBytes(p.base64), folder = st.folders[KIND_FOLDER[p.kind] || 'Comprobantes'];
    return sha256(bytes).then(function (hash) {
      return list(q(folder) + " in parents and trashed = false and appProperties has { key='sha256' and value=" + q(hash) + ' }', 'id,webViewLink').then(function (f) {
        if (f.length) return { fileId: f[0].id, url: f[0].webViewLink, existing: true };
        var meta = { name: p.name, mimeType: p.mime || 'application/octet-stream', parents: [folder], appProperties: { sha256: hash } };
        var fd = new FormData();
        fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        fd.append('file', new Blob([bytes], { type: meta.mimeType }));
        return req(UPLOAD + '?uploadType=multipart&fields=id,webViewLink', { method: 'POST', body: fd }).then(function (j) { return { fileId: j.id, url: j.webViewLink, existing: false }; });
      });
    });
  }
  function getFile(p) {
    return req(DRIVE + '/' + encodeURIComponent(p.fileId) + '?fields=name,mimeType').then(function (m) {
      return req(DRIVE + '/' + encodeURIComponent(p.fileId) + '?alt=media', { raw: true }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) { return { name: m.name, mime: m.mimeType, base64: bytesToB64(buf) }; });
    });
  }
  function moveFile(p) {
    return req(DRIVE + '/' + encodeURIComponent(p.fileId) + '?fields=parents').then(function (m) {
      var to = st.folders[KIND_FOLDER[p.kind] || 'Comprobantes'];
      return req(DRIVE + '/' + encodeURIComponent(p.fileId) + '?addParents=' + to + '&removeParents=' + (m.parents || []).join(',') + '&fields=id,webViewLink', { method: 'PATCH', json: {} });
    }).then(function (j) { return { fileId: j.id, url: j.webViewLink }; });
  }

  /* ---------- IA (Gemini, con la clave del usuario guardada en SU Drive) ---------- */
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
  var ANALYZE_PROMPT = 'Sos un asesor de finanzas personales en Argentina. Usá EXCLUSIVAMENTE los datos JSON provistos (son los registros reales del usuario). No inventes cifras.\nRespondé en castellano rioplatense, breve y concreto (máximo 8 líneas), con importes en formato $ 1.234. Si la pregunta no se puede responder con esos datos, decilo.';
  var aiKey = '';
  function parseJsonLoose(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); throw new Error('La IA no devolvió JSON válido'); }
  }
  function gemini(parts, opts, key) {
    key = key || aiKey; if (!key) return Promise.reject(new Error('IA no configurada: cargá tu clave de Gemini en Ajustes.'));
    var models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], lastErr = '';
    function attempt(i) {
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.1, responseMimeType: opts && opts.text ? 'text/plain' : 'application/json' } })
      }).then(function (r) {
        return r.text().then(function (body) {
          if (r.ok) {
            var j = JSON.parse(body), c = j.candidates && j.candidates[0], txt = c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
            return opts && opts.text ? txt : parseJsonLoose(txt);
          }
          lastErr = 'Gemini ' + models[i] + ' respondió ' + r.status + ': ' + body.slice(0, 300);
          if ([404, 429, 500, 503].indexOf(r.status) >= 0 && i + 1 < models.length) return attempt(i + 1);
          throw new Error(lastErr);
        });
      });
    }
    return attempt(0);
  }
  function aiTask(p) {
    var hoy = today();
    if (p.task === 'extract') {
      var parts = [{ text: EXTRACT_PROMPT + '\nCategorías: ' + (p.categorias || DEFAULT_CATS.map(function (c) { return c[0]; })).join(', ') + '\nHoy: ' + hoy + (p.name ? '\nArchivo: ' + p.name : '') }];
      if (p.base64) parts.push({ inline_data: { mime_type: p.mime, data: p.base64 } });
      if (p.text) parts.push({ text: 'Contenido:\n' + String(p.text).slice(0, 120000) });
      return gemini(parts);
    }
    if (p.task === 'chat') return gemini([{ text: CHAT_PROMPT + '\nHoy: ' + hoy + '\nCategorías: ' + (p.categorias || []).join(', ') + '\nMovimientos recientes: ' + JSON.stringify(p.recientes || []).slice(0, 8000) + '\nContexto de la charla: ' + JSON.stringify(p.contexto || null) + '\nMensaje: ' + p.mensaje }]);
    if (p.task === 'analyze') return gemini([{ text: ANALYZE_PROMPT + '\nDatos: ' + JSON.stringify(p.datos || {}).slice(0, 60000) + '\nPregunta: ' + p.pregunta }], { text: true }).then(function (t) { return { texto: t }; });
    return Promise.reject(new Error('Tarea de IA desconocida'));
  }

  /* ---------- Acciones (mismo contrato que el backend de Apps Script) ---------- */
  function ready() {
    if (st && st.db) return Promise.resolve();
    st = lsGet(stKey());
    if (st && st.db && st.totals && st.folders && st.folders.copias) return Promise.resolve();
    return discover().then(function (s) {
      st = s;
      var names = Object.keys(TABLES);
      return ensureSheets(st.db, names).then(function () { return readTables(names); }).then(function (t) {
        if (!t.Categorias.rows.length) {   // primera vez: categorías por defecto
          var ts = nowIso(), r = upsert('Categorias', t.Categorias, DEFAULT_CATS.map(function (c, i) { return { id: c[0], nombre: c[0], icono: c[1], tipo: c[2], palabras: c[3], orden: i, estado: 'activo', modificado: ts }; }), 'instalación');
          return append(st.db, 'Categorias', r.appends);
        }
      }).then(function () { return st.dbNew ? refreshTotals([]) : null; }).then(function () { delete st.dbNew; lsSet(stKey(), st); });
    });
  }
  var ACTIONS = {
    ping: function () { return Promise.resolve({ ok: true, at: nowIso() }); },
    bootstrap: function () {
      var names = Object.keys(SYNC_TABLES).map(function (k) { return SYNC_TABLES[k]; }).concat(['Privado']);
      return readTables(names).catch(function (e) { if (!e.notFound) throw e; lsSet(stKey(), null); st = null; return ready().then(function () { return readTables(names); }); }).then(function (t) {
        var out = {}, priv = getPriv(t);
        Object.keys(SYNC_TABLES).forEach(function (k) { out[k] = t[SYNC_TABLES[k]].rows; });
        aiKey = priv.geminiKey || '';
        out.ai = !!aiKey;
        out.links = { carpeta: folderUrl(st.root), baseDeDatos: sheetUrl(st.db), totales: sheetUrl(st.totals), entrada: '' };
        out.backend = { version: 'directo', owner: email, link: (window.NIRAI_CONFIG && NIRAI_CONFIG.TRIAL_URL || location.origin + location.pathname) + '?conectar=google' };
        out.serverTime = nowIso();
        if (priv.ultimaCopia !== today()) setTimeout(function () { serial(backup).catch(function (e) { console.warn('copia', e); }); }, 4000);
        return out;
      });
    },
    sync: function (p, device) {
      var ops = p.ops || [], names = [];
      ops.forEach(function (op) { var t = SYNC_TABLES[op.t]; if (!t) throw new Error('Tabla inválida ' + op.t); if (names.indexOf(t) < 0) names.push(t); });
      if (!names.length) return Promise.resolve({ result: {}, serverTime: nowIso() });
      return readTables(names).then(function (tbls) {
        var res = {}, data = [], apps = {}, logs = [];
        ops.forEach(function (op) {
          var t = SYNC_TABLES[op.t], r = upsert(t, tbls[t], op.rows || [], device);
          data = data.concat(r.updates); apps[t] = (apps[t] || []).concat(r.appends); logs = logs.concat(r.logs);
          res[op.t] = res[op.t] || { written: 0, skipped: 0 }; res[op.t].written += r.written; res[op.t].skipped += r.skipped;
        });
        return writeValues(st.db, data)
          .then(function () { return Object.keys(apps).reduce(function (pr, t) { return pr.then(function () { return append(st.db, t, apps[t]); }); }, Promise.resolve()); })
          .then(function () { return append(st.db, 'Log', logs); })
          .then(function () {
            if (!tbls.Movimientos) return;
            var h = tbls.Movimientos.head;
            return refreshTotals(tbls.Movimientos.raw.slice(1).map(function (a) { var o = {}; h.forEach(function (k, i) { o[k] = a[i] === undefined ? '' : a[i]; }); return o; }));
          })
          .then(function () { return { result: res, serverTime: nowIso() }; });
      });
    },
    uploadFile: uploadFile, getFile: getFile, moveFile: moveFile,
    checkInbox: function () { return Promise.resolve({ nuevos: 0 }); },
    ai: aiTask,
    backupNow: function () { return backup(); },
    refreshTotals: function () { return refreshTotals().then(function () { return { ok: true }; }); },
    setAiKey: function (p) {
      var key = String(p.key || '').trim();
      if (!key) return setPriv('geminiKey', '').then(function () { aiKey = ''; return { ai: false }; });
      return gemini([{ text: 'Respondé solamente: OK' }], { text: true }, key).catch(function (e) { throw new Error('La clave no funcionó: ' + String(e.message || e).slice(0, 200)); })
        .then(function () { return setPriv('geminiKey', key); }).then(function () { aiKey = key; return { ai: true }; });
    }
  };
  /* Los pedidos que escriben se hacen de a uno, para no pisar filas entre sí. */
  function serial(fn) { var p = _busy.then(fn, fn); _busy = p.catch(function () { }); return p; }
  function call(action, payload, tok, who, device) {
    token = tok; if (who && who !== email) { email = who; st = null; }
    var fn = ACTIONS[action]; if (!fn) return Promise.reject(new Error('Acción desconocida: ' + action));
    return serial(function () { return ready().then(function () { return fn(payload || {}, device); }); });
  }
  return { call: call, SCOPES: 'https://www.googleapis.com/auth/drive.file openid email profile', _reset: function () { st = null; } };
})();
