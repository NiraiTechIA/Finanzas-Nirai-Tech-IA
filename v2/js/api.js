/* FINANZAS NIRAI TECH IA — conexión con el backend (Apps Script), inicio de sesión con Google y sincronización.
   Funciona "local primero": cada cambio se guarda en el dispositivo y se envía a Drive apenas hay conexión. */
var LS_DATA = 'nirai_fin_v2', LS_QUEUE = 'nirai_queue_v2', LS_TOK = 'nirai_tok', LS_CONN = 'nirai_conn', LS_DEV = 'nirai_dev';
var SYNC = { queue: [], status: 'local', lastSync: null, ai: false, links: {}, user: null, error: '' };
var _flushTimer = null, _retry = 0, _flushing = false, _tokWaiters = [], _gisReady = false;

function lsGet(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function conn() {
  var c = lsGet(LS_CONN, {}) || {}, d = window.NIRAI_CONFIG || {};
  return { url: (c.url || d.BACKEND_URL || '').trim(), clientId: (c.clientId || d.GOOGLE_CLIENT_ID || '').trim() };
}
/** Link personal: …/v2/?conectar=<id de implementación o URL /exec>. Conecta este dispositivo con el Drive del dueño del link. */
function applyConnectParam() {
  var q = new URLSearchParams(location.search), v = (q.get('conectar') || '').trim();
  if (q.has('desconectar')) { localStorage.removeItem(LS_CONN); localStorage.removeItem(LS_TOK); }
  if (!v) return null;
  var url = /^https:\/\/script\.google\.com\//.test(v) ? v : /^[A-Za-z0-9_-]{20,}$/.test(v) ? 'https://script.google.com/macros/s/' + v + '/exec' : '';
  q.delete('conectar'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  if (!url) return 'invalido';
  var prev = (lsGet(LS_CONN, {}) || {}).url || '';
  if (prev && prev !== url) {   // otra cuenta: los datos guardados en este dispositivo son de la otra base (ya están en su Drive)
    [LS_DATA, LS_QUEUE, LS_TOK].forEach(function (k) { localStorage.removeItem(k); });
  }
  lsSet(LS_CONN, { url: url });
  return prev === url ? 'mismo' : 'nuevo';
}
function disconnectDevice() { [LS_CONN, LS_TOK, LS_DATA, LS_QUEUE].forEach(function (k) { localStorage.removeItem(k); }); location.href = location.pathname; }
function isConfigured() { var c = conn(); return !!(c.url && c.clientId); }
function deviceId() { var d = lsGet(LS_DEV); if (!d) { d = (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'celular-' : 'pc-') + uid().slice(-5); lsSet(LS_DEV, d); } return d; }

/* ---------- Guardado local ---------- */
function saveLocal() { if (!lsSet(LS_DATA, dumpTables())) SYNC.error = 'El navegador no deja guardar datos locales.'; lsSet(LS_QUEUE, SYNC.queue); }
function loadLocal() { var d = lsGet(LS_DATA); loadTables(d || {}); SYNC.queue = lsGet(LS_QUEUE, []) || []; }   // las categorías por defecto no se envían: Drive ya tiene las suyas (y las que editaste)
HOOKS.change = function (t, row) {
  var key = t + '|' + row.id, i = SYNC.queue.findIndex(function (q) { return q.k === key; });
  var item = { k: key, t: t, row: JSON.parse(JSON.stringify(row)) };
  if (i >= 0) SYNC.queue[i] = item; else SYNC.queue.push(item);
  scheduleSave();
};
var _saveTimer = null;
function scheduleSave() { clearTimeout(_saveTimer); _saveTimer = setTimeout(function () { saveLocal(); scheduleFlush(600); }, 50); }
function scheduleFlush(ms) { clearTimeout(_flushTimer); _flushTimer = setTimeout(flush, ms || 600); }

/* ---------- Sesión de Google (Google Identity Services) ---------- */
function getTok() { if (window.NIRAI_TEST_TOKEN) return { t: window.NIRAI_TEST_TOKEN, exp: Date.now() / 1000 + 3600, email: 'test' }; return lsGet(LS_TOK); }
function tokenValid() { var t = getTok(); return !!(t && t.t && t.exp * 1000 - 120000 > Date.now()); }
function decodeJwt(t) { var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(atob(p).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''))); }
function onCredential(resp) {
  try {
    var p = decodeJwt(resp.credential);
    lsSet(LS_TOK, { t: resp.credential, exp: p.exp, email: p.email, name: p.name, picture: p.picture });
    SYNC.user = { email: p.email, name: p.name };
    _tokWaiters.splice(0).forEach(function (w) { w.res(resp.credential); });
    connectNow();
  } catch (e) { console.error(e); }
}
function initGis() {
  var c = conn(); if (!isConfigured() || window.NIRAI_TEST_TOKEN) return;   // en la prueba gratis no hace falta Google
  if (window.google && google.accounts && google.accounts.id) return setupGis();
  if (document.getElementById('gis-script')) return;
  var s = document.createElement('script'); s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.onload = setupGis;
  s.onerror = function () { SYNC.status = 'offline'; SYNC.error = 'No se pudo cargar el inicio de sesión de Google (¿sin internet?).'; UI.refresh(); };
  document.head.appendChild(s);
}
function setupGis() {
  google.accounts.id.initialize({ client_id: conn().clientId, callback: onCredential, auto_select: true, itp_support: true, use_fedcm_for_prompt: true, cancel_on_tap_outside: false, context: 'signin' });
  _gisReady = true; UI.refresh();
  if (!tokenValid()) google.accounts.id.prompt();
}
function renderGoogleButton(el) {
  if (!el) return; if (!_gisReady) { el.innerHTML = '<span class="small mut">Cargando inicio de sesión de Google…</span>'; return; }
  el.innerHTML = ''; google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es' });
}
function getToken() {
  if (tokenValid()) return Promise.resolve(getTok().t);
  if (!_gisReady) return Promise.reject(new Error('AUTH: iniciá sesión con Google'));
  return new Promise(function (res, rej) {
    var w = { res: res }; _tokWaiters.push(w);
    try { google.accounts.id.prompt(); } catch (e) { }
    setTimeout(function () { var i = _tokWaiters.indexOf(w); if (i >= 0) { _tokWaiters.splice(i, 1); rej(new Error('AUTH: iniciá sesión con Google')); } }, 12000);
  });
}
function logout() { try { google.accounts.id.disableAutoSelect(); } catch (e) { } localStorage.removeItem(LS_TOK); SYNC.user = null; SYNC.status = isConfigured() ? 'login' : 'local'; UI.refresh(); }

/* ---------- Llamadas al backend ---------- */
/* Transporte: POST por defecto. Si el backend no acepta POST (pasa con scripts dentro de una planilla),
   se usa GET: el pedido viaja en la URL (?q=) o en partes de 6.000 caracteres (?c=&i=&n=&d=). */
var CHUNK = 6000;
function transportKey() { return 'nirai_transport_' + conn().url; }
function usingGet() { return lsGet(transportKey()) === 'get'; }
function encodeQ(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_'); }
function readJson(r) { if (!r.ok) throw new Error('Tu backend respondió ' + r.status); return r.json(); }
function sendGet(url, body) {
  var q = encodeQ(body), sep = url.indexOf('?') >= 0 ? '&' : '?';
  if (q.length <= CHUNK) return fetch(url + sep + 'q=' + encodeURIComponent(q)).then(readJson);
  var id = (uid() + uid()).replace(/[^a-z0-9]/gi, ''), n = Math.ceil(q.length / CHUNK), i = 0;
  function next() {
    var part = q.slice(i * CHUNK, (i + 1) * CHUNK);
    return fetch(url + sep + 'c=' + id + '&i=' + i + '&n=' + n + '&d=' + encodeURIComponent(part)).then(readJson).then(function (j) {
      i++; if (i < n) { if (!j.ok) throw new Error(j.error || 'Error enviando datos'); return next(); }
      return j;
    });
  }
  return next();
}
function sendPost(url, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' }).then(readJson); }
function isNetErr(e) { return /Failed to fetch|NetworkError|Load failed|network/i.test(e && e.message || ''); }
function api(action, payload) {
  var c = conn(); if (!c.url) return Promise.reject(new Error('Falta configurar la conexión con Google Drive (Ajustes).'));
  return getToken().then(function (tok) {
    var body = { action: action, payload: payload || {}, idToken: tok, device: deviceId() };
    if (usingGet()) return sendGet(c.url, body);
    return sendPost(c.url, body).catch(function (e) {
      if (!isNetErr(e) || !navigator.onLine) throw e;
      return sendGet(c.url, body).then(function (j) { lsSet(transportKey(), 'get'); return j; });   // el backend acepta GET: queda recordado
    });
  }).catch(function (e) { throw netError(e); }).then(function (j) {
    if (!j.ok) { if (j.auth) { localStorage.removeItem(LS_TOK); SYNC.status = 'login'; } throw new Error(j.error || 'Error del servidor'); }
    return j.data;
  });
}
function netError(e) { return /Failed to fetch|NetworkError|Load failed/i.test(e && e.message || '') ? new Error('No se pudo conectar con tu backend de Google. Revisá tu internet y que esté publicado como «Aplicación web» con acceso «Cualquier usuario».') : e; }
function aiCall(p) { return api('ai', Object.assign({ categorias: catNames() }, p)); }
function canUseAI() { return isConfigured() && SYNC.ai && SYNC.status !== 'login' && SYNC.status !== 'local'; }
function isOnline() { return isConfigured() && (SYNC.status === 'ok' || SYNC.status === 'saving'); }

/* ---------- Sincronización ---------- */
function flush() {
  if (_flushing || !SYNC.queue.length || !isConfigured() || !tokenValid()) { if (SYNC.queue.length && isConfigured() && !tokenValid()) SYNC.status = 'login'; UI.refreshStatus(); return Promise.resolve(); }
  _flushing = true; SYNC.status = 'saving'; UI.refreshStatus();
  var batch = SYNC.queue.slice(0, usingGet() ? 40 : 400), groups = {};
  batch.forEach(function (q) { (groups[q.t] = groups[q.t] || []).push(q.row); });
  var ops = Object.keys(groups).map(function (t) { return { t: t, rows: groups[t] }; });
  return api('sync', { ops: ops }).then(function () {
    var sent = {}; batch.forEach(function (q) { sent[q.k] = q.row.modificado || ''; });
    SYNC.queue = SYNC.queue.filter(function (q) { return !(q.k in sent) || (q.row.modificado || '') !== sent[q.k]; });
    lsSet(LS_QUEUE, SYNC.queue); _retry = 0; SYNC.status = 'ok'; SYNC.lastSync = new Date(); SYNC.error = '';
  }).catch(function (e) {
    SYNC.error = e.message; SYNC.status = /AUTH/.test(e.message) ? 'login' : 'offline';
    _retry = Math.min(_retry + 1, 6); scheduleFlush(Math.min(300000, 5000 * Math.pow(2, _retry)));
  }).then(function () { _flushing = false; UI.refreshStatus(); if (SYNC.queue.length && SYNC.status === 'ok') scheduleFlush(200); });
}
/** Trae todo desde Drive y vuelve a aplicar encima los cambios locales que todavía no se enviaron. */
function pull() {
  if (!isConfigured() || !tokenValid()) return Promise.resolve(false);
  return api('bootstrap').then(function (d) {
    loadTables(d);
    var apply = { mov: function (r) { upsertLocal(DB.movs, fixMov(r)); }, imp: function (r) { var o = Object.assign({}, r); try { o.meta = JSON.parse(r.meta || '{}'); } catch (e) { o.meta = {}; } upsertLocal(DB.imp, o); }, cat: function (r) { upsertLocal(DB.cat, r); }, pend: function (r) { upsertLocal(DB.pend, r); }, map: function (r) { if (r.categoria) DB.map[r.id] = { tipo: r.tipo, categoria: r.categoria, flag: r.flag }; else delete DB.map[r.id]; }, cfg: function (r) { try { DB.cfg[r.id] = JSON.parse(r.valor); } catch (e) { } } };
    SYNC.queue.forEach(function (q) { apply[q.t] && apply[q.t](q.row); });
    SYNC.ai = !!d.ai; SYNC.links = d.links || {}; SYNC.backend = d.backend || null; SYNC.status = 'ok'; SYNC.lastSync = new Date(); SYNC.error = '';
    var t = getTok(); SYNC.user = t ? { email: t.email, name: t.name } : null;
    autoRecurrentes(); unaVez();
    saveLocal(); UI.refresh(); scheduleFlush(300);
    return true;
  }).catch(function (e) { SYNC.error = e.message; SYNC.status = /AUTH/.test(e.message) ? 'login' : 'offline'; UI.refreshStatus(); return false; });
}
function connectNow() { if (!isConfigured()) { SYNC.status = 'local'; UI.refreshStatus(); return Promise.resolve(); } if (!tokenValid()) { SYNC.status = 'login'; UI.refreshStatus(); return Promise.resolve(); } SYNC.status = 'connecting'; SYNC.error = ''; UI.refreshStatus(); return pull().then(function () { return flush(); }); }
function startSync() {
  initGis(); connectNow();
  setInterval(function () { if (document.visibilityState === 'visible' && isConfigured() && tokenValid() && !UI.busy()) pull(); }, 90000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && isConfigured() && tokenValid() && !UI.busy()) pull(); });
  window.addEventListener('online', function () { scheduleFlush(500); });
}

/** Ajustes que se aplican una sola vez sobre los datos existentes (después de una actualización de la app). */
function unaVez() {
  if (!DB.cfg.fijosAplicados) { recalcFijos(); setCfg('fijosAplicados', true); }
}
