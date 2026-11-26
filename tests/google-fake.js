// Emulador mínimo de las APIs REST de Google Drive v3, Sheets v4, userinfo y Gemini, para probar el modo directo.
// Se engancha a Playwright con context.route(). Guarda todo en memoria (G.files, G.sheets).
function makeGoogle(opts) {
  opts = opts || {};
  const G = { files: {}, sheets: {}, n: 0, calls: [], token: opts.token || 'tok-directo', email: opts.email || 'cliente@gmail.com', geminiOk: true, apisOn: true };
  const id = p => p + (++G.n).toString(36).padStart(6, '0');
  const now = () => new Date(Date.now() + G.n * 1000).toISOString();
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  const unq = s => s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');

  function matches(f, q) {
    if (/trashed = false/.test(q) && f.trashed) return false;
    let m;
    if ((m = q.match(/name = ('(?:[^'\\]|\\.)*')/)) && f.name !== unq(m[1])) return false;
    if ((m = q.match(/mimeType = ('(?:[^'\\]|\\.)*')/)) && f.mimeType !== unq(m[1])) return false;
    if ((m = q.match(/('(?:[^'\\]|\\.)*') in parents/)) && !f.parents.includes(unq(m[1]))) return false;
    if ((m = q.match(/appProperties has \{ key='(\w+)' and value=('(?:[^'\\]|\\.)*') \}/)) && (f.appProperties || {})[m[1]] !== unq(m[2])) return false;
    return true;
  }
  function newSheetFile(fid) { G.sheets[fid] = { sheets: [{ sheetId: 0, title: 'Hoja 1', values: [] }] }; }
  function parseRange(r) {
    const m = r.match(/^'((?:[^']|'')*)'(?:!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?)?$/) || r.match(/^([^!]+)(?:!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?)?$/);
    if (!m) throw new Error('rango inválido ' + r);
    const colN = s => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
    return { title: m[1].replace(/''/g, "'"), col: m[2] ? colN(m[2]) : 0, row: m[3] ? Number(m[3]) - 1 : 0 };
  }
  function sheetOf(fid, title) { const s = G.sheets[fid] && G.sheets[fid].sheets.find(x => x.title === title); if (!s) throw Object.assign(new Error('Unable to parse range: ' + title), { code: 400 }); return s; }
  function trim(vals) { while (vals.length && !(vals[vals.length - 1] || []).some(v => v !== '' && v != null)) vals.pop(); return vals; }

  async function handle(route) {
    const req = route.request(), url = new URL(req.url()), method = req.method(), path = decodeURIComponent(url.pathname);
    G.calls.push(method + ' ' + url.host + path);
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.host === 'generativelanguage.googleapis.com') {
      const body = JSON.parse(req.postData() || '{}'), key = req.headers()['x-goog-api-key'];
      if (!G.geminiOk || key !== 'AQ.clave-buena') return json(route, 400, { error: { message: 'API key not valid' } });
      const txt = JSON.stringify(body).includes('Respondé solamente: OK') ? 'OK' : JSON.stringify({ accion: 'conversar', respuesta: 'Hola desde Gemini' });
      return json(route, 200, { candidates: [{ content: { parts: [{ text: txt }] } }] });
    }
    if ((req.headers()['authorization'] || '') !== 'Bearer ' + G.token) return json(route, 401, { error: { code: 401, message: 'Invalid Credentials' } });
    if (!G.apisOn) return json(route, 403, { error: { code: 403, message: 'Google Drive API has not been used in project 123 before or it is disabled.' } });
    try {
      if (url.host === 'www.googleapis.com' && path === '/oauth2/v3/userinfo') return json(route, 200, { email: G.email, name: 'Cliente' });
      // ---- Drive ----
      if (url.host === 'www.googleapis.com' && path.startsWith('/upload/drive/v3/files')) {
        const raw = req.postDataBuffer(), ct = req.headers()['content-type'], b = ct.match(/boundary=(.+)$/)[1];
        const parts = raw.toString('latin1').split('--' + b).filter(p => p.includes('\r\n\r\n'));
        const meta = JSON.parse(Buffer.from(parts[0].split('\r\n\r\n').slice(1).join('\r\n\r\n'), 'latin1').toString('utf8').trim());
        const content = Buffer.from(parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''), 'latin1');
        const f = { id: id('f'), name: meta.name, mimeType: meta.mimeType, parents: meta.parents || ['root'], appProperties: meta.appProperties || {}, content, createdTime: now(), trashed: false };
        G.files[f.id] = f; return json(route, 200, { id: f.id, webViewLink: 'https://drive.google.com/file/d/' + f.id });
      }
      if (url.host === 'www.googleapis.com' && path.startsWith('/drive/v3/files')) {
        const rest = path.slice('/drive/v3/files'.length).split('/').filter(Boolean);
        if (!rest.length && method === 'GET') {
          const files = Object.values(G.files).filter(f => matches(f, url.searchParams.get('q') || '')).sort((a, b) => a.createdTime < b.createdTime ? -1 : 1);
          return json(route, 200, { files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, createdTime: f.createdTime, webViewLink: 'https://drive.google.com/file/d/' + f.id })) });
        }
        if (!rest.length && method === 'POST') {
          const meta = JSON.parse(req.postData());
          const f = { id: id(meta.mimeType.includes('spreadsheet') ? 's' : 'd'), name: meta.name, mimeType: meta.mimeType, parents: meta.parents || ['root'], createdTime: now(), trashed: false };
          G.files[f.id] = f; if (f.mimeType.includes('spreadsheet')) newSheetFile(f.id);
          return json(route, 200, { id: f.id });
        }
        const f = G.files[rest[0]]; if (!f) return json(route, 404, { error: { code: 404 } });
        if (rest[1] === 'copy') {
          const meta = JSON.parse(req.postData()), c = { ...f, id: id('s'), name: meta.name, parents: meta.parents, createdTime: now() };
          G.files[c.id] = c; if (G.sheets[f.id]) G.sheets[c.id] = JSON.parse(JSON.stringify(G.sheets[f.id]));
          return json(route, 200, { id: c.id });
        }
        if (method === 'GET' && url.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, contentType: f.mimeType, body: f.content });
        if (method === 'GET') return json(route, 200, { id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents });
        if (method === 'PATCH') {
          const meta = JSON.parse(req.postData() || '{}'); if (meta.trashed) f.trashed = true;
          const add = url.searchParams.get('addParents'), rem = url.searchParams.get('removeParents');
          if (rem) f.parents = f.parents.filter(p => !rem.split(',').includes(p)); if (add) f.parents.push(...add.split(','));
          return json(route, 200, { id: f.id, webViewLink: 'https://drive.google.com/file/d/' + f.id });
        }
      }
      // ---- Sheets ----
      if (url.host === 'sheets.googleapis.com') {
        const m = path.match(/^\/v4\/spreadsheets\/([^/:]+)(.*)$/), fid = m[1], tail = m[2], ss = G.sheets[fid];
        if (!ss) return json(route, 404, { error: { code: 404 } });
        if (tail === '' && method === 'GET') return json(route, 200, { sheets: ss.sheets.map(s => ({ properties: { sheetId: s.sheetId, title: s.title } })) });
        if (tail === ':batchUpdate') {
          for (const r of JSON.parse(req.postData()).requests) {
            if (r.addSheet) ss.sheets.push({ sheetId: ++G.n, title: r.addSheet.properties.title, values: [] });
            if (r.deleteSheet) ss.sheets = ss.sheets.filter(s => s.sheetId !== r.deleteSheet.sheetId);
          }
          return json(route, 200, {});
        }
        if (tail === '/values:batchGet') {
          return json(route, 200, { valueRanges: url.searchParams.getAll('ranges').map(r => { const p = parseRange(r), s = sheetOf(fid, p.title); return { range: r, values: trim(JSON.parse(JSON.stringify(s.values))) }; }) });
        }
        if (tail === '/values:batchUpdate') {
          const b = JSON.parse(req.postData()); assert(b.valueInputOption === 'RAW');
          for (const d of b.data) { const p = parseRange(d.range), s = sheetOf(fid, p.title); d.values.forEach((row, i) => { const t = s.values[p.row + i] || (s.values[p.row + i] = []); row.forEach((v, j) => { t[p.col + j] = v; }); }); }
          return json(route, 200, {});
        }
        if (tail === '/values:batchClear') { for (const r of JSON.parse(req.postData()).ranges) sheetOf(fid, parseRange(r).title).values = []; return json(route, 200, {}); }
        const ap = tail.match(/^\/values\/(.+):append$/);
        if (ap) { const s = sheetOf(fid, parseRange(ap[1]).title), b = JSON.parse(req.postData()); trim(s.values); s.values.push(...b.values); return json(route, 200, {}); }
      }
      return json(route, 400, { error: { message: 'no emulado: ' + method + ' ' + url.host + path } });
    } catch (e) { return json(route, e.code || 500, { error: { message: String(e.message) } }); }
  }
  function assert(c) { if (!c) throw new Error('assert'); }
  G.attach = ctx => ctx.route(u => /googleapis\.com/.test(u.host), handle);
  G.byName = name => Object.values(G.files).filter(f => f.name === name && !f.trashed);
  G.table = (fid, title) => { const s = G.sheets[fid].sheets.find(x => x.title === title); if (!s) return []; const v = s.values, h = v[0] || []; return v.slice(1).filter(r => r && r.some(x => x !== '' && x != null)).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] === undefined ? '' : r[i]]))); };
  G.titles = fid => G.sheets[fid].sheets.map(s => s.title);
  return G;
}
module.exports = { makeGoogle };
