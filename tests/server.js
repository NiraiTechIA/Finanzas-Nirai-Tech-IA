// Servidor de pruebas: sirve la app y responde /api con el backend real (Code.gs) sobre Drive/Sheets emulados.
// Uso: node tests/server.js [puerto]
const http = require('http'), fs = require('fs'), path = require('path');
const { createEnv } = require('./gas-fake');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8' };

// Respuestas de Gemini emuladas (misma forma que la API real)
function geminiMock(url, o) {
  const body = JSON.parse(o.payload), parts = body.contents[0].parts, prompt = parts[0].text;
  let out;
  if (/extractor de movimientos/.test(prompt)) {
    const isImg = parts[1] && parts[1].inline_data && /image/.test(parts[1].inline_data.mime_type);
    out = isImg
      ? { tipoDocumento: 'comprobante', periodo: '2026-11', movimientos: [{ fecha: '2026-11-21', descripcion: 'Farmacity Lomas', monto: -12800, moneda: 'ARS', tipo: 'Gasto', categoria: 'Salud', medio: 'Débito', confianza: 0.92 }] }
      : { tipoDocumento: 'tarjeta', cuenta: 'Mastercard ···9999', periodo: '2026-11', cierre: '2026-11-20', total: 45500, movimientos: [{ fecha: '2026-11-03', descripcion: 'DISCO SUC 45', monto: -30500, moneda: 'ARS', cuota: '', tipo: 'Gasto', categoria: 'Supermercado', confianza: 0.95 }, { fecha: '2026-11-08', descripcion: 'KIOSCO EL TURCO', monto: -15000, moneda: 'ARS', cuota: '', tipo: 'Gasto', categoria: 'Kiosco', confianza: 0.5 }] };
  } else if (/Interpretá el mensaje/.test(prompt)) {
    const msg = prompt.split('Mensaje: ').pop();
    out = /hola/i.test(msg) ? { accion: 'conversar', respuesta: '¡Hola! ¿Qué registramos hoy?' } : { accion: 'conversar', respuesta: 'No entendí.' };
  } else return { code: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Según tus datos, tu mayor gasto es Supermercado.' }] } }] }) };
  return { code: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }) };
}
function makeServer(port) {
  const env = createEnv({
    props: { GEMINI_API_KEY: 'clave-test' },
    fetch: (url, o, props) => {
      if (url.includes('generativelanguage')) return geminiMock(url, o);
      if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        const tok = decodeURIComponent(url.split('id_token=')[1]);
        if (tok === 'token-valido') return { code: 200, body: JSON.stringify({ aud: props.OAUTH_CLIENT_ID, iss: 'accounts.google.com', email: props.OWNER_EMAIL, email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }) };
        return { code: 400, body: '{}' };
      }
      return { code: 404, body: '' };
    }
  });
  env.setup();
  const srv = http.createServer((req, res) => {
    if (req.url === '/api' && req.method === 'POST') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        try { const out = env.doPost({ postData: { contents: b } }).getContent(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(out); }
        catch (e) { res.writeHead(500); res.end(String(e.stack)); }
      });
      return;
    }
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const fp = path.join(ROOT, p); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  });
  return new Promise(r => srv.listen(port, () => r({ srv, env })));
}
module.exports = { makeServer };
if (require.main === module) makeServer(+process.argv[2] || 8765).then(() => console.log('http://localhost:' + (+process.argv[2] || 8765)));
