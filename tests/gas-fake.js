// Emulación mínima en memoria de los servicios de Google Apps Script usados por apps-script/Code.gs.
// Sirve SOLO para pruebas automáticas: en producción el código corre en Google.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
const toSigned = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const toBuf = bytes => Buffer.from(bytes.map(b => b & 0xff));

function createEnv(opts = {}) {
  let n = 0; const nid = p => p + (++n).toString(36) + crypto.randomBytes(3).toString('hex');
  const files = {}, folders = {}, sheetsById = {};
  const props = {}, cache = {}, triggers = [], logs = [], mails = [], active = {}, ui = { dialogs: [] }, service = {};
  const myDrive = { id: 'root', name: 'Mi unidad', parent: null };
  folders.root = myDrive;

  function Folder(f) {
    return {
      getId: () => f.id, getName: () => f.name, getUrl: () => 'https://drive.google.com/drive/folders/' + f.id,
      getFoldersByName: name => iter(Object.values(folders).filter(x => x.parent === f.id && x.name === name).map(Folder)),
      createFolder: name => { const x = { id: nid('fo'), name, parent: f.id }; folders[x.id] = x; return Folder(x); },
      getFiles: () => iter(Object.values(files).filter(x => x.parent === f.id && !x.trashed).map(File)),
      createFile: blob => { const x = { id: nid('fi'), name: blob.getName(), mime: blob.getContentType(), bytes: blob._buf, parent: f.id, created: new Date(Date.now() + n), desc: '' }; files[x.id] = x; return File(x); },
      getParents: () => iter(f.parent && folders[f.parent] && f.parent !== 'root' ? [Folder(folders[f.parent])] : [])
    };
  }
  function File(x) {
    return {
      getId: () => x.id, getName: () => x.name, getUrl: () => 'https://drive.google.com/file/d/' + x.id, getMimeType: () => x.mime,
      getDescription: () => x.desc, setDescription: d => { x.desc = d; }, getDateCreated: () => x.created,
      getBlob: () => Blob(x.bytes || Buffer.alloc(0), x.mime, x.name),
      getParents: () => iter(x.parent && x.parent !== 'root' ? [Folder(folders[x.parent])] : []),
      moveTo: fo => { x.parent = fo.getId(); return File(x); },
      setTrashed: t => { x.trashed = t; },
      makeCopy: (name, fo) => {
        const y = { ...x, id: nid('fi'), name, parent: fo.getId(), created: new Date(Date.now() + (++n)) }; files[y.id] = y;
        if (sheetsById[x.id]) { const src = sheetsById[x.id]; sheetsById[y.id] = { id: y.id, name, sheets: src.sheets.map(s => ({ name: s.name, cells: s.cells.map(r => r.slice()) })) }; }
        return File(y);
      }
    };
  }
  function Blob(buf, mime, name) { return { _buf: buf, getBytes: () => toSigned(buf), getContentType: () => mime, getName: () => name, getDataAsString: () => buf.toString('utf8') }; }

  function Range(sh, r, c, nr = 1, nc = 1) {
    const self = {
      getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.cells[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
      setValues: vals => {
        if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error(`setValues: dimensiones ${vals.length}x${vals[0] && vals[0].length} no coinciden con ${nr}x${nc}`);
        vals.forEach((row, i) => { const R = sh.cells[r - 1 + i] = sh.cells[r - 1 + i] || []; row.forEach((v, j) => { R[c - 1 + j] = v; }); });
        return self;
      },
      setNumberFormat: () => self, setFontWeight: () => self, setFontSize: () => self
    };
    return self;
  }
  function Sheet(s) {
    const lastRow = () => { for (let i = s.cells.length - 1; i >= 0; i--) if ((s.cells[i] || []).some(v => v !== '' && v != null)) return i + 1; return 0; };
    const lastCol = () => s.cells.reduce((a, r) => { if (!r) return a; for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] != null) return Math.max(a, j + 1); return a; }, 0);
    return {
      getName: () => s.name, clear: () => { s.cells = []; }, setColumnWidth: () => { }, getLastRow: lastRow, getLastColumn: lastCol, getMaxRows: () => 1000,
      getRange: (r, c, nr, nc) => Range(s, r, c, nr, nc), setFrozenRows: () => { }, clearContents: () => { s.cells = []; }, _s: s
    };
  }
  function Spreadsheet(ss) {
    return {
      getId: () => ss.id, rename: n => { ss.name = n; if (files[ss.id]) files[ss.id].name = n; }, getName: () => ss.name, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + ss.id,
      getSheetByName: name => { const s = ss.sheets.find(x => x.name === name); return s ? Sheet(s) : null; },
      insertSheet: (name, idx) => { const s = { name, cells: [] }; if (idx === 0) ss.sheets.unshift(s); else ss.sheets.push(s); return Sheet(s); },
      getSheets: () => ss.sheets.map(Sheet), deleteSheet: sh => { ss.sheets = ss.sheets.filter(x => x !== sh._s); }
    };
  }

  const fetchHandler = opts.fetch || ((url) => {
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const tok = decodeURIComponent(url.split('id_token=')[1]);
      if (tok === 'token-valido') return { code: 200, body: JSON.stringify({ aud: props.OAUTH_CLIENT_ID, iss: 'https://accounts.google.com', email: props.OWNER_EMAIL, email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }) };
      if (tok === 'token-otro') return { code: 200, body: JSON.stringify({ aud: props.OAUTH_CLIENT_ID, iss: 'accounts.google.com', email: 'intruso@gmail.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }) };
      return { code: 400, body: '{"error":"invalid_token"}' };
    }
    return { code: 404, body: 'no mock' };
  });

  const ctx = {
    console, JSON, Math, Date, Object, Array, String, Number, RegExp, Error,
    Logger: { log: m => logs.push(m) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    MailApp: { sendEmail: o => mails.push(o) },
    HtmlService: { createHtmlOutput: h => { const o = { html: h, setWidth: () => o, setHeight: () => o }; return o; } },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, getAll: ks => ks.reduce((a, k) => { if (k in cache) a[k] = cache[k]; return a; }, {}), removeAll: ks => ks.forEach(k => delete cache[k]) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { }, tryLock: () => true, releaseLock: () => { } }) },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires', getEffectiveUser: () => ({ getEmail: () => 'dueno@gmail.com' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ getContent: () => s }) }) },
    ScriptApp: {
      getScriptId: () => 'script-123', getOAuthToken: () => 'oauth-token-test', getService: () => ({ getUrl: () => service.url || null }),
      getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: fn => { const t = { fn }; const ch = { timeBased: () => ch, everyMinutes: m => { t.every = m; return ch; }, atHour: h => { t.hour = h; return ch; }, everyDays: () => ch, create: () => { triggers.push(t); return t; } }; return ch; }
    },
    UrlFetchApp: { fetch: (url, o) => { const r = fetchHandler(url, o || {}, props); return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, x) => toSigned(crypto.createHash(alg).update(typeof x === 'string' ? Buffer.from(x, 'utf8') : toBuf(x)).digest()),
      base64Decode: s => toSigned(Buffer.from(s, 'base64')),
      base64DecodeWebSafe: s => toSigned(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      base64Encode: b => toBuf(b).toString('base64'),
      newBlob: (bytes, mime, name) => Blob(Array.isArray(bytes) ? toBuf(bytes) : Buffer.from(String(bytes), 'utf8'), mime, name),
      formatDate: (d, tz, fmt) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {}); return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute); }
    },
    DriveApp: {
      getFolderById: id => { if (!folders[id]) throw new Error('no folder'); return Folder(folders[id]); },
      getFoldersByName: name => iter(Object.values(folders).filter(x => x.parent === 'root' && x.name === name).map(Folder)),
      createFolder: name => Folder(myDrive).createFolder(name),
      getFileById: id => { if (!files[id]) throw new Error('No se encontró el archivo ' + id); return File(files[id]); }
    },
    SpreadsheetApp: {
      create: name => { const id = nid('ss'); const ss = { id, name, sheets: [{ name: 'Hoja 1', cells: [] }] }; sheetsById[id] = ss; files[id] = { id, name, mime: 'application/vnd.google-apps.spreadsheet', parent: 'root', created: new Date() }; return Spreadsheet(ss); },
      openById: id => { if (!sheetsById[id]) throw new Error('no ss'); return Spreadsheet(sheetsById[id]); },
      getActiveSpreadsheet: () => (active.id && sheetsById[active.id] ? Spreadsheet(sheetsById[active.id]) : null),
      getUi: () => { if (!active.id) throw new Error('sin interfaz'); return { ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 'ok', CANCEL: 'cancel' }, prompt: () => ({ getSelectedButton: () => 'ok', getResponseText: () => ui.respuesta || '' }), createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => { ui.menu = true; } }; return m; }, showModalDialog: (o, t) => { ui.dialogs.push(o.html); } }; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  Object.assign(props, { OWNER_EMAIL: 'dueno@gmail.com', OAUTH_CLIENT_ID: 'cliente-test.apps.googleusercontent.com' }, opts.props || {});
  ctx.__ = { files, folders, sheetsById, props, triggers, logs, mails, ui, active, service, Folder, File };
  // simula estar dentro de una copia de la planilla plantilla (script vinculado)
  ctx.bindToNewSheet = name => { const ss = ctx.SpreadsheetApp.create(name || 'Copia de FINANZAS NIRAI TECH IA — Instalador'); active.id = ss.getId(); return ss; };
  ctx.post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  ctx.addInboxFile = (name, mime, buf) => { const fo = Object.values(folders).find(f => f.name === 'Entrada'); return Folder(fo).createFile(Blob(buf, mime, name)).getId(); };
  return ctx;
}
module.exports = { createEnv };
