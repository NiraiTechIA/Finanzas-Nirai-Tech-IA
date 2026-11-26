// Prueba del modo directo: app real en Chrome + Drive/Sheets emulados (sin Apps Script, sin instalar nada).
// Uso: node tests/directo.test.js
const assert = require('assert'), path = require('path'), crypto = require('crypto'), fs = require('fs');
let pw; try { pw = require('playwright-core'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { makeServer } = require('./server');
const { makeGoogle } = require('./google-fake');
const FX = f => path.join(__dirname, 'fixtures', f);
const PORT = 8798, URL = 'http://localhost:' + PORT + '/v2/', APP = 'FINANZAS NIRAI TECH IA';
let pass = 0; const ok = n => { pass++; console.log('  ✓', n); };

(async () => {
  const { srv } = await makeServer(PORT);
  const G = makeGoogle();
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const device = async (opts) => {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
    await G.attach(ctx);
    await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: "window.google = { accounts: { oauth2: { initTokenClient: function (c) { window.__gis = c; return { requestAccessToken: function (o) { window.__tokReq = o; } }; }, hasGrantedAllScopes: function () { return true; } } } };" }));
    const page = await ctx.newPage();
    await page.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.NIRAI_CONFIG = { BACKEND_URL: '', GOOGLE_CLIENT_ID: 'cliente-test.apps.googleusercontent.com', TRIAL_URL: 'http://localhost:" + PORT + "/v2/' };" }));
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|401|status of 4/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', d => d.accept());
    if (opts.token !== false) await page.addInitScript(([t, e]) => { localStorage.setItem('nirai_tok', JSON.stringify({ t, exp: Date.now() / 1000 + 3600, email: e, direct: true })); }, [G.token, G.email]);
    if (opts.trial) await page.addInitScript(() => { if (!sessionStorage.getItem('seed')) { sessionStorage.setItem('seed', 1); localStorage.setItem('nirai_queue_v2', JSON.stringify([{ k: 'mov|prueba1', t: 'mov', row: { id: 'prueba1', fecha: '2026-11-03', mes: '2026-11', descripcion: 'Cargado en la prueba', monto: -1234, tipo: 'Gasto', categoria: 'Supermercado', medio: 'Débito', estado: 'activo', origen: 'manual', creado: '2026-11-03T10:00:00Z', modificado: '2026-11-03T10:00:00Z' } }])); } });
    await page.goto(URL + (opts.link === false ? '' : '?conectar=google')); await page.waitForSelector('#tabs button');
    return { ctx, page };
  };
  const synced = page => page.waitForFunction(() => window.APP.SYNC.queue.length === 0 && window.APP.SYNC.status === 'ok', null, { timeout: 20000 }).catch(async e => { console.log('ESTADO', await page.evaluate(() => [window.APP.SYNC.status, window.APP.SYNC.error, window.APP.SYNC.queue.length])); console.log(G.calls.slice(-8)); throw e; });
  const tab = (page, k) => page.click(`#tabs button[data-k="${k}"]`);
  const db = () => G.byName(APP + ' — Base de datos')[0].id, tot = () => G.byName(APP + ' — Totales')[0].id;
  const movs = () => G.table(db(), 'Movimientos').filter(m => m.estado === 'activo');

  console.log('Modo directo (sin instalar nada)');
  // 1) primer ingreso desde el celular, con datos cargados en la prueba gratis
  const A = await device({ mobile: true, trial: true });
  await synced(A.page);
  assert.strictEqual(new globalThis.URL(A.page.url()).search, '', 'la URL queda limpia');
  assert.strictEqual(G.byName(APP).length, 1);
  for (const n of ['Base de datos', 'Resúmenes de tarjetas', 'Comprobantes', 'Ingresos', 'Gastos', 'Reportes mensuales', 'Copias de seguridad']) assert.strictEqual(G.byName(n).length, 1, 'carpeta ' + n);
  assert.deepStrictEqual(G.titles(db()).sort(), ['Categorias', 'Config', 'Importaciones', 'Log', 'Mapeos', 'Movimientos', 'Pendientes', 'Privado'].sort(), 'sin la «Hoja 1» vacía');
  assert(G.table(db(), 'Categorias').length >= 25, 'categorías por defecto');
  assert(movs().some(m => m.id === 'prueba1' && m.monto === -1234 && m.mes === '2026-11'), 'lo cargado en la prueba se pasa a Drive (número y mes intactos)');
  assert(await A.page.isVisible('#syncPill:has-text("Sincronizado")'));
  ok('desde el celular: un toque crea carpeta, base y Totales en el Drive del cliente y pasa los datos de la prueba');

  // 2) gasto por el asistente → Movimientos + Log + Totales
  await tab(A.page, 'asistente');
  await A.page.fill('#chatIn', 'gasté 8500 en nafta'); await A.page.press('#chatIn', 'Enter');
  await A.page.waitForFunction(() => window.APP.DB.movs.some(m => m.monto === -8500)); await synced(A.page);
  const nafta = movs().find(m => m.monto === -8500); assert(nafta && nafta.categoria === 'Combustible y transporte');
  assert(G.table(db(), 'Log').some(l => l.accion === 'crear' && l.id === nafta.id));
  const mensual = G.table(tot(), 'Mensual'); assert(mensual.some(r => r.Mes === nafta.mes && r.Gastos >= 8500), 'Totales actualizado');
  assert(G.titles(tot()).includes('Anual') && !G.titles(tot()).includes('Hoja 1'));
  ok('gasto por mensaje: se guarda en la planilla, queda en el Log y actualiza Totales');

  // 3) importar resumen: archivo original a Drive (sin duplicar) + movimientos
  await A.ctx.close();
  const B = await device({});   // PC: abre el mismo link
  await synced(B.page);
  await B.page.reload(); await B.page.waitForSelector('#tabs button'); await synced(B.page);   // al volver a abrir la app (sin link) sigue conectada
  await tab(B.page, 'importar');
  assert(!(await B.page.isVisible('text=Carpeta «Entrada»')), 'sin la carpeta Entrada (no aplica en modo directo)');
  await B.page.setInputFiles('[data-file="import"]', FX('visa_noviembre.csv')); await B.page.waitForSelector('.imp .pv', { timeout: 20000 });
  await B.page.click('[data-act="impOk"]'); await B.page.waitForSelector('.imp:has-text("movimientos importados")'); await synced(B.page);
  const up = G.byName('visa_noviembre.csv'); assert.strictEqual(up.length, 1);
  assert.strictEqual(up[0].parents[0], G.byName('Resúmenes de tarjetas')[0].id);
  assert.strictEqual(up[0].appProperties.sha256, crypto.createHash('sha256').update(fs.readFileSync(FX('visa_noviembre.csv'))).digest('hex'));
  assert(up[0].content.equals(fs.readFileSync(FX('visa_noviembre.csv'))), 'archivo idéntico');
  const n1 = movs().length; assert(n1 > 5);
  assert(G.table(db(), 'Importaciones').length === 1);
  // abrir el original desde la app
  const back = await B.page.evaluate(id => window.APP.api('getFile', { fileId: id }), up[0].id);
  assert.strictEqual(Buffer.from(back.base64, 'base64').toString('utf8'), fs.readFileSync(FX('visa_noviembre.csv'), 'utf8'));
  const again = await B.page.evaluate(b64 => window.APP.api('uploadFile', { name: 'otro nombre.csv', mime: 'text/csv', base64: b64, kind: 'resumen' }), fs.readFileSync(FX('visa_noviembre.csv')).toString('base64'));
  assert(again.existing && again.fileId === up[0].id, 'mismo archivo no se sube dos veces');
  ok('importar resumen: el original queda en «Resúmenes de tarjetas» (sin duplicar) y los movimientos en la base');

  // 4) segundo dispositivo: encuentra lo mismo, no crea nada nuevo; edición con «último cambio gana»
  const C = await device({});
  await synced(C.page);
  assert.strictEqual(await C.page.evaluate(() => window.APP.DB.movs.filter(m => m.estado === 'activo').length), n1);
  assert.strictEqual(G.byName(APP).length, 1); assert.strictEqual(G.byName(APP + ' — Base de datos').length, 1);
  await C.page.evaluate(id => { const m = window.APP.DB.movs.find(x => x.id === id); window.APP.putMov(Object.assign({}, m, { descripcion: 'Nafta YPF', modificado: new Date().toISOString() })); }, nafta.id);
  await synced(C.page);
  assert.strictEqual(movs().find(m => m.id === nafta.id).descripcion, 'Nafta YPF'); assert.strictEqual(movs().length, n1, 'edita la misma fila');
  await B.page.evaluate(() => window.APP.pull()); await B.page.waitForFunction(id => (window.APP.DB.movs.find(m => m.id === id) || {}).descripcion === 'Nafta YPF', nafta.id);
  ok('otro dispositivo ve los mismos datos, no crea carpetas nuevas y las ediciones llegan a todos');

  // 5) IA: la clave se prueba, queda en «Privado» (no en Totales ni en Config) y se usa
  const bad = await C.page.evaluate(() => window.APP.api('setAiKey', { key: 'AQ.mala' }).then(() => 'ok', e => e.message));
  assert(/no funcionó/.test(bad));
  await C.page.evaluate(() => window.APP.api('setAiKey', { key: 'AQ.clave-buena' }));
  assert.deepStrictEqual(G.table(db(), 'Privado').find(r => r.id === 'geminiKey').valor, 'AQ.clave-buena');
  assert(!JSON.stringify(G.sheets[tot()]).includes('clave-buena') && !JSON.stringify(G.table(db(), 'Config')).includes('clave-buena'));
  await C.page.evaluate(() => window.APP.pull()); assert(await C.page.evaluate(() => window.APP.SYNC.ai));
  const r = await C.page.evaluate(() => window.APP.api('ai', { task: 'chat', mensaje: 'hola' })); assert.strictEqual(r.respuesta, 'Hola desde Gemini');
  ok('IA: valida la clave de Gemini, la guarda solo en la base privada del cliente y responde');

  // 6) copia de seguridad diaria
  await C.page.waitForTimeout(4500);
  const copias = Object.values(G.files).filter(f => f.parents.includes(G.byName('Copias de seguridad')[0].id) && !f.trashed);
  assert(copias.length >= 1 && /copia \d{4}-\d{2}-\d{2}/.test(copias[0].name));
  assert(G.table(db(), 'Privado').find(r => r.id === 'ultimaCopia'));
  ok('copia de seguridad del día en «Base de datos / Copias de seguridad»');

  // 7) sesión vencida: cambios quedan en espera y aparece «Conectar con Google»
  G.token = 'tok-nuevo';
  await C.page.evaluate(() => { const m = window.APP.DB.movs.find(x => x.estado === 'activo'); window.APP.putMov(Object.assign({}, m, { nota: 'sin sesión', modificado: new Date().toISOString() })); });
  await C.page.waitForFunction(() => window.APP.SYNC.status === 'login', null, { timeout: 15000 });
  await tab(C.page, 'inicio');
  assert(await C.page.isVisible('.banner button[data-act="gconnect"]'));
  assert(await C.page.evaluate(() => window.APP.SYNC.queue.length) >= 1);
  await C.page.evaluate(t => { localStorage.setItem('nirai_tok', JSON.stringify({ t, exp: Date.now() / 1000 + 3600, email: 'cliente@gmail.com', direct: true })); return window.APP.connectNow(); }, G.token);
  await synced(C.page); assert(movs().some(m => m.nota === 'sin sesión'));
  ok('sesión vencida: guarda en el dispositivo, pide «Conectar con Google» y después sube lo pendiente');

  // 8) APIs sin activar en Google Cloud: mensaje claro
  G.apisOn = false;
  const msg = await C.page.evaluate(() => window.APP.api('refreshTotals').then(() => 'ok', e => e.message));
  assert(/Drive API/.test(msg)); G.apisOn = true;
  ok('si faltan activar las APIs en Google Cloud, lo dice claramente');

  // 9) sin token: botón «Conectar con Google» en Ajustes, y la prueba gratis sigue sin mostrar nada de Google
  const D = await device({ token: false });
  await tab(D.page, 'ajustes'); assert(await D.page.isVisible('#gbtn button[data-act="gconnect"]'));
  await D.page.click('#gbtn button[data-act="gconnect"]');
  assert.strictEqual(await D.page.evaluate(() => window.__tokReq.prompt), 'consent', 'la primera vez pide el permiso');
  assert(/drive\.file/.test(await D.page.evaluate(() => window.__gis.scope)) && !/auth\/drive[ "]/.test(await D.page.evaluate(() => window.__gis.scope)), 'solo permiso drive.file');
  await D.page.evaluate(t => window.__gis.callback({ access_token: t, expires_in: 3599 }), G.token);
  await synced(D.page);
  assert.strictEqual(await D.page.evaluate(() => JSON.parse(localStorage.getItem('nirai_tok')).email), G.email);
  await D.page.click('#tabs button[data-k="ajustes"]');
  assert(await D.page.isVisible('text=' + G.email));
  ok('«Conectar con Google»: pide solo el permiso drive.file, toma el mail de la cuenta y sincroniza');
  const E = await device({ token: false, link: false });
  await E.page.evaluate(() => localStorage.clear()); await E.page.goto(URL); await E.page.waitForSelector('#tabs button');
  await tab(E.page, 'ajustes'); assert(!(await E.page.isVisible('[data-act="gconnect"]'))); assert(await E.page.isVisible('#syncPill:has-text("Prueba gratis")'));
  ok('sin sesión muestra «Conectar con Google»; la prueba gratis no muestra nada de Google');

  assert.deepStrictEqual(errors, [], 'sin errores de JavaScript: ' + errors.join(' | '));
  await browser.close(); srv.close();
  console.log(pass + ' pruebas del modo directo OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
