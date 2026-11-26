// Prueba del backend (apps-script/Code.gs) contra Drive/Sheets emulados en memoria.
const assert = require('assert');
const { createEnv } = require('./gas-fake');

let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('  ✓', name); };

// Gemini emulado: devuelve una respuesta con la forma real de la API
const geminiCalls = [];
const env = createEnv({
  props: { GEMINI_API_KEY: 'clave-test' },
  fetch: (url, o, props) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      geminiCalls.push({ url, body: JSON.parse(o.payload), key: o.headers['x-goog-api-key'] });
      if (url.includes('gemini-3.8-flash') && geminiCalls.length === 1) return { code: 503, body: 'sobrecargado' };
      const out = { tipoDocumento: 'comprobante', periodo: '2026-11', movimientos: [{ fecha: '2026-11-20', descripcion: 'YPF Lomas', monto: -35000, moneda: 'ARS', tipo: 'Gasto', categoria: 'Combustible y transporte', medio: 'Débito', confianza: 0.9 }] };
      return { code: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(out) + '\n```' }] } }] }) };
    }
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      const tok = decodeURIComponent(url.split('id_token=')[1]);
      const base = { aud: props.OAUTH_CLIENT_ID, iss: 'https://accounts.google.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) };
      if (tok === 'token-valido') return { code: 200, body: JSON.stringify({ ...base, email: props.OWNER_EMAIL }) };
      if (tok === 'token-otro') return { code: 200, body: JSON.stringify({ ...base, email: 'intruso@gmail.com' }) };
      if (tok === 'token-otra-app') return { code: 200, body: JSON.stringify({ ...base, aud: 'otra-app', email: props.OWNER_EMAIL }) };
      return { code: 400, body: '{}' };
    }
    return { code: 404, body: '' };
  }
});
const call = (action, payload, tok = 'token-valido') => env.post({ action, payload, idToken: tok, device: 'test' });

console.log('Backend');
t('setup crea carpetas, planillas y triggers', () => {
  const log = env.setup();
  const names = Object.values(env.__.folders).map(f => f.name);
  ['FINANZAS NIRAI TECH IA', 'Base de datos', 'Entrada', 'Resúmenes de tarjetas', 'Comprobantes', 'Ingresos', 'Gastos', 'Reportes mensuales', 'Copias de seguridad'].forEach(n => assert(names.includes(n), 'falta carpeta ' + n));
  assert.strictEqual(env.__.triggers.length, 2);
  assert(log[0].startsWith('Listo'));
  env.setup(); // idempotente
  assert.strictEqual(Object.values(env.__.folders).filter(f => f.name === 'Entrada').length, 1);
  assert.strictEqual(env.__.triggers.length, 2);
});
t('rechaza sin token, token inválido, otra cuenta y otra app', () => {
  assert.strictEqual(env.post({ action: 'bootstrap' }).ok, false);
  const r1 = call('bootstrap', {}, 'basura'); assert(!r1.ok && r1.auth);
  const r2 = call('bootstrap', {}, 'token-otro'); assert(!r2.ok && /no tiene acceso/.test(r2.error));
  const r3 = call('bootstrap', {}, 'token-otra-app'); assert(!r3.ok && /no es para esta/.test(r3.error));
});
t('bootstrap devuelve categorías por defecto y links', () => {
  const r = call('bootstrap'); assert(r.ok, r.error);
  assert(r.data.cat.length >= 25); assert(r.data.cat.find(c => c.nombre === 'Supermercado' && c.icono === '🛒'));
  assert(r.data.links.totales && r.data.links.entrada); assert.strictEqual(r.data.ai, true);
});
const mov = (id, extra) => Object.assign({ id, fecha: '2026-11-20', mes: '2026-11', descripcion: 'Cena', monto: -18500, tipo: 'Gasto', categoria: 'Comida y restaurantes', medio: 'Efectivo', origen: 'chat', estado: 'activo', creado: '2026-11-20T10:00:00Z', modificado: '2026-11-20T10:00:00Z' }, extra);
t('sync inserta, actualiza, respeta la versión más nueva y registra log', () => {
  let r = call('sync', { ops: [{ t: 'mov', rows: [mov('a1'), mov('a2', { descripcion: 'Sueldo', monto: 1500000, tipo: 'Ingreso', categoria: 'Sueldo' })] }] });
  assert(r.ok, r.error); assert.strictEqual(r.data.result.mov.written, 2);
  r = call('sync', { ops: [{ t: 'mov', rows: [mov('a1', { monto: -16500, modificado: '2026-11-20T11:00:00Z' })] }] });
  assert.strictEqual(r.data.result.mov.written, 1);
  r = call('sync', { ops: [{ t: 'mov', rows: [mov('a1', { monto: -99999, modificado: '2026-11-20T09:00:00Z' })] }] }); // versión vieja de otro dispositivo
  assert.strictEqual(r.data.result.mov.skipped, 1);
  const movs = call('bootstrap').data.mov;
  assert.strictEqual(movs.length, 2);
  assert.strictEqual(movs.find(m => m.id === 'a1').monto, -16500);
  assert.strictEqual(movs.find(m => m.id === 'a1').mes, '2026-11');
  const log = env.SpreadsheetApp.openById(env.__.props.DB_ID).getSheetByName('Log').getRange(1, 1, 200, 7).getValues().filter(r => r[0]);
  assert(log.some(r => r[1] === 'editar' && r[3] === 'a1' && String(r[4]).includes('-18500')), 'el log guarda el valor anterior');
});
t('ids repetidos en el mismo envío no rompen', () => {
  const r = call('sync', { ops: [{ t: 'mov', rows: [mov('d1'), mov('d1', { monto: -1 })] }] });
  assert(r.ok, r.error); assert.strictEqual(call('bootstrap').data.mov.filter(m => m.id === 'd1').length, 1);
});
t('planilla de Totales se actualiza y excluye borrados', () => {
  call('sync', { ops: [{ t: 'mov', rows: [mov('d1', { estado: 'borrado', modificado: '2026-11-21T00:00:00Z' })] }] });
  const ss = env.SpreadsheetApp.openById(env.__.props.TOTALS_ID), rows = ss.getSheetByName('Mensual').getRange(1, 1, 3, 9).getValues();
  assert.deepStrictEqual(rows[1].slice(0, 4), ['2026-11', 1500000, 16500, 1483500]);
  assert(ss.getSheetByName('Trimestral') && ss.getSheetByName('Anual') && ss.getSheetByName('Gastos por categoría'));
});
t('uploadFile guarda en la carpeta correcta y no duplica', () => {
  const b64 = Buffer.from('%PDF-1.4 resumen').toString('base64');
  const a = call('uploadFile', { name: 'visa.pdf', mime: 'application/pdf', base64: b64, kind: 'resumen' }).data;
  const b = call('uploadFile', { name: 'visa (1).pdf', mime: 'application/pdf', base64: b64, kind: 'resumen' }).data;
  assert.strictEqual(a.fileId, b.fileId); assert.strictEqual(b.existing, true);
  const f = env.__.files[a.fileId]; assert.strictEqual(env.__.folders[f.parent].name, 'Resúmenes de tarjetas');
  const g = call('getFile', { fileId: a.fileId }).data; assert.strictEqual(Buffer.from(g.base64, 'base64').toString(), '%PDF-1.4 resumen');
});
t('getFile no entrega archivos fuera de la carpeta de la app', () => {
  const outsider = env.DriveApp.createFolder('Privado').createFile(env.Utilities.newBlob([1, 2], 'text/plain', 'x.txt'));
  const r = call('getFile', { fileId: outsider.getId() }); assert(!r.ok && /no está en la carpeta/.test(r.error));
});
t('bandeja de Entrada: detecta archivos nuevos una sola vez y pre-procesa fotos con IA', () => {
  env.addInboxFile('ticket.jpg', 'image/jpeg', Buffer.from([255, 216, 255]));
  env.addInboxFile('mp.pdf', 'application/pdf', Buffer.from('%PDF'));
  assert.strictEqual(env.checkInbox().nuevos, 2);
  assert.strictEqual(env.checkInbox().nuevos, 0);
  const pend = call('bootstrap').data.pend; assert.strictEqual(pend.length, 2);
  const foto = pend.find(p => p.nombre === 'ticket.jpg'); assert(JSON.parse(foto.resultado).movimientos.length === 1);
  assert(geminiCalls[0].url.includes('gemini-3.8-flash') && geminiCalls[1].url.includes('gemini-3.5-flash-lite'), 'usa el modelo de respaldo si el principal falla');
  assert.strictEqual(geminiCalls[1].key, 'clave-test'); assert(geminiCalls[1].body.contents[0].parts[1].inline_data);
});
t('IA: extracción y chat devuelven JSON', () => {
  const r = call('ai', { task: 'extract', text: 'fecha;detalle;monto\n20/11/2026;YPF;-35000', name: 'x.csv' }); assert(r.ok, r.error); assert.strictEqual(r.data.movimientos[0].monto, -35000);
  const c = call('ai', { task: 'chat', mensaje: 'hoy gasté 35000 en nafta', categorias: ['Combustible y transporte'] }); assert(c.ok);
});
t('moveFile mueve de Entrada a Resúmenes', () => {
  const p = call('bootstrap').data.pend.find(x => x.nombre === 'mp.pdf');
  call('moveFile', { fileId: p.archivoId, kind: 'resumen' });
  assert.strictEqual(env.__.folders[env.__.files[p.archivoId].parent].name, 'Resúmenes de tarjetas');
});
t('copia de seguridad diaria crea una copia de la base', () => {
  const r = env.dailyBackup(); assert(r.copia);
  const copias = Object.values(env.__.files).filter(f => env.__.folders[f.parent] && env.__.folders[f.parent].name === 'Copias de seguridad');
  assert.strictEqual(copias.length, 1); assert(env.__.sheetsById[copias[0].id].sheets.find(s => s.name === 'Movimientos'));
});
t('vía GET: pedido completo en la URL y en partes (para backends que rechazan POST)', () => {
  const enc = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const g = params => JSON.parse(env.doGet({ parameter: params }).getContent());
  assert.strictEqual(g({}).version, 7);
  const r = g({ q: enc({ action: 'ping', idToken: 'token-valido' }) }); assert(r.ok && r.data.ok);
  assert(!g({ q: enc({ action: 'ping', idToken: 'basura' }) }).ok, 'sigue exigiendo el token');
  const big = enc({ action: 'uploadFile', idToken: 'token-valido', payload: { name: 'grande.pdf', mime: 'application/pdf', base64: Buffer.alloc(30000, 7).toString('base64'), kind: 'resumen' } });
  const n = Math.ceil(big.length / 6000); let last;
  for (let i = 0; i < n; i++) last = g({ c: 'abc123', i: String(i), n: String(n), d: big.slice(i * 6000, (i + 1) * 6000) });
  assert(last.ok && last.data.fileId, JSON.stringify(last)); assert.strictEqual(env.__.files[last.data.fileId].bytes.length, 30000);
  assert(!g({ c: 'zz9', i: '1', n: '2', d: 'x' }).ok, 'falta la parte 0');
});
console.log(`\n${pass} pruebas de backend OK`);
