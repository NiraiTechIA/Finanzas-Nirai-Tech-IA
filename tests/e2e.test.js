// Prueba integral: Chrome real + app real + backend real (Code.gs) sobre Drive/Sheets emulados.
// Uso: node tests/e2e.test.js   (requiere playwright-core y Google Chrome)
const assert = require('assert'), path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright-core'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { makeServer } = require('./server');
const FX = f => path.join(__dirname, 'fixtures', f), SHOTS = path.join(__dirname, 'screenshots');
const PORT = 8799, URL = 'http://localhost:' + PORT + '/v2/';
let pass = 0; const ok = n => { pass++; console.log('  ✓', n); };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, env } = await makeServer(PORT);
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const newPage = async (ctx, connected) => {
    const page = await ctx.newPage();
    await page.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.NIRAI_CONFIG = { BACKEND_URL: '', GOOGLE_CLIENT_ID: '' };" }));   // pruebas: sin la configuración real
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/gsi|accounts\.google|favicon|ERR_/.test(m.text())) errors.push(m.text()); });
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? (d.message().includes('Ícono') ? '🧃' : d.message().includes('cuánto') ? '1.480.000' : 'Kiosco') : undefined));
    if (connected) await page.addInitScript(() => { window.NIRAI_TEST_TOKEN = 'token-valido'; localStorage.setItem('nirai_conn', JSON.stringify({ url: '/api', clientId: 'cliente-test.apps.googleusercontent.com' })); });
    await page.goto(URL); await page.waitForSelector('#tabs button');
    return page;
  };
  const dbMovs = () => env.readTable_('Movimientos').filter(m => m.estado === 'activo');
  const waitSynced = async page => { await page.waitForFunction(() => window.APP.SYNC.queue.length === 0 && window.APP.SYNC.status === 'ok', null, { timeout: 15000 }); };
  const chat = async (page, text) => {
    const n = await page.evaluate(() => window.APP.UI.chat.filter(m => m.who === 'bot' && !m.tmp).length);
    await page.fill('#chatIn', text); await page.press('#chatIn', 'Enter');
    await page.waitForFunction(n0 => window.APP.UI.chat.filter(m => m.who === 'bot' && !m.tmp).length > n0 && !document.querySelector('.typing'), n);
    return page.$$eval('.msg.bot .bubble', x => x[x.length - 1].innerText);
  };
  const closeAll = async page => { while (await page.$('[data-act="impClose"], [data-act="impNo"]')) await page.click('[data-act="impClose"], [data-act="impNo"] >> nth=0'); };
  const importFx = async (page, f) => { await closeAll(page); await page.setInputFiles('[data-file="import"]', FX(f)); await page.waitForSelector('.imp .pv', { timeout: 20000 }); };
  const confirmImp = async page => { await page.click('[data-act="impOk"]'); await page.waitForSelector('.imp:has-text("movimientos importados")'); await waitSynced(page); };
  const tab = (page, k) => page.click(`#tabs button[data-k="${k}"]`);

  console.log('Prueba integral (navegador)');
  // 1) modo local, sin conexión
  const ctxL = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const pl = await newPage(ctxL, false);
  assert(await pl.isVisible('#syncPill:has-text("Prueba gratis")')); assert(!(await pl.isVisible('text=Sin conexión'))); ok('arranca en modo prueba gratis sin configuración (sin intentar conectarse)');
  await tab(pl, 'importar'); await pl.setInputFiles('[data-file="import"]', FX('mastercard.pdf'));
  await pl.waitForSelector('.imp .pv', { timeout: 15000 });
  assert(await pl.isVisible('text=Lectura genérica')); ok('PDF de banco desconocido sin IA: lectura genérica con pdf.js');
  await tab(pl, 'inicio'); assert(await pl.isVisible('a.btn:has-text("Cómo instalarlo")')); assert(await pl.isVisible('a.btn:has-text("Ver planes")'));
  // link personal: conecta el dispositivo y limpia la URL; si es de otra cuenta, borra la copia local anterior
  await pl.evaluate(() => { localStorage.setItem('nirai_conn', JSON.stringify({ url: 'https://script.google.com/macros/s/AKfyOTRA/exec' })); localStorage.setItem('nirai_fin_v2', JSON.stringify({ mov: [{ id: 'x1', fecha: '2026-11-01', mes: '2026-11', descripcion: 'dato de otra cuenta', monto: -1, tipo: 'Gasto', categoria: 'Sin clasificar', estado: 'activo' }] })); });
  await pl.goto(URL + '?conectar=AKfycbTEST_123456789012345678901'); await pl.waitForSelector('#tabs button');
  assert.strictEqual(new globalThis.URL(pl.url()).search, '', 'la URL queda limpia');
  assert.strictEqual(await pl.evaluate(() => JSON.parse(localStorage.getItem('nirai_conn')).url), 'https://script.google.com/macros/s/AKfycbTEST_123456789012345678901/exec');
  assert.strictEqual(await pl.evaluate(() => window.APP.DB.movs.length), 0, 'no mezcla datos de otra cuenta');
  for (const pg of ['instalar.html', 'terminos.html', 'privacidad.html', 'arrepentimiento.html']) { await pl.goto(URL + pg); assert(await pl.isVisible('h1')); }
  assert(await pl.isVisible('text=10 días corridos'));
  ok('v2 pública en modo local, link personal ?conectar=, y páginas de instalación, términos, privacidad y arrepentimiento');
  await ctxL.close();

  // 2) conectado a Drive
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const p = await newPage(ctx, true);
  await waitSynced(p);
  assert(await p.isVisible('#syncPill:has-text("Sincronizado")')); ok('se conecta con el backend y sincroniza');

  // asistente: registro por mensajes
  await tab(p, 'asistente');
  let r = await chat(p, 'Hoy cobré mi sueldo de $1.500.000'); assert(/Registré/.test(r) && /1\.500\.000/.test(r) && /Sueldo/.test(r), r);
  r = await chat(p, 'Acabo de gastar $18.500 en una cena'); assert(/Comida y restaurantes/.test(r), r); await waitSynced(p);
  r = await chat(p, 'El gasto anterior no fue de $18.500, fue de $16.500'); assert(/Corregí/.test(r) && /16\.500/.test(r), r);
  r = await chat(p, 'Hoy gasté $35.000 en combustible'); assert(/Combustible/.test(r));
  r = await chat(p, 'Me ingresaron $120.000 por un trabajo extra'); assert(/Trabajos adicionales/.test(r));
  r = await chat(p, 'Compré ropa por $75.000 con tarjeta de crédito'); assert(/Ropa/.test(r) && /Tarjeta de crédito/.test(r));
  r = await chat(p, 'Le presté $50.000 a un amigo'); assert(/Préstamo/.test(r));
  r = await chat(p, 'gasté en el kiosco'); assert(/cuánto/i.test(r), 'pregunta el monto');
  r = await chat(p, '2500'); assert(/Registré/.test(r) && /2\.500/.test(r), r);
  await waitSynced(p);
  const cena = dbMovs().filter(m => /cena/i.test(m.descripcion));
  assert.strictEqual(cena.length, 1); assert.strictEqual(cena[0].monto, -16500);
  assert(env.readTable_('Log').some(l => l.accion === 'editar' && l.id === cena[0].id && /-18500/.test(l.antes)));
  ok('registra los mensajes de ejemplo, pregunta datos faltantes y corrige sin duplicar (con historial en Log)');

  r = await chat(p, '¿Cuánto gasté este mes?'); assert(/gastaste \$ 129\.000/.test(r), r);
  r = await chat(p, '¿Cuánto llevo gastado en comida?'); assert(/16\.500/.test(r), r);
  r = await chat(p, '¿Cuánto cobré este mes?'); assert(/1\.620\.000/.test(r), r);
  r = await chat(p, '¿Cuáles fueron mis mayores gastos?'); assert(/Ropa/.test(r.split('\n')[1]), r);
  r = await chat(p, 'hola'); assert(/Hola/.test(r), 'conversación usa la IA');
  ok('responde consultas con los datos registrados (y usa Gemini para lo libre)');
  await p.screenshot({ path: path.join(SHOTS, 'asistente.png') });

  // ajustes: nombre propio para transferencias
  await tab(p, 'ajustes'); await p.fill('[data-cfg="propios"]', 'Mauro Maejo'); await p.press('[data-cfg="propios"]', 'Tab');
  // importar Mercado Pago (CSV)
  await tab(p, 'importar'); await importFx(p, 'mercadopago_noviembre.csv');
  const txt = await p.innerText('.imp');
  assert(/Mercado Pago/.test(await p.inputValue('[data-imp="cuenta"]')) || /mercadopago/.test(await p.inputValue('[data-imp="kind"]')));
  await confirmImp(p);
  const mp = dbMovs().filter(m => m.medio === 'Mercado Pago');
  assert.strictEqual(mp.length, 6, 'importa 6 movimientos de MP');
  assert.strictEqual(mp.find(m => /Rendimientos/.test(m.descripcion)).categoria, 'Inversiones');
  assert.strictEqual(mp.find(m => /Mauro/.test(m.descripcion)).tipo, 'Interno', 'transferencia propia no es gasto');
  assert.strictEqual(mp.find(m => /COTO/.test(m.descripcion)).categoria, 'Supermercado');
  assert.strictEqual(mp.find(m => /COTO/.test(m.descripcion)).monto, -42000); assert.strictEqual(mp.find(m => /Rendimientos/.test(m.descripcion)).monto, 1250.4);
  assert(env.readTable_('Importaciones').length === 1 && env.readTable_('Importaciones')[0].archivoId, 'guarda el original en Drive');
  const orig = env.__.files[env.readTable_('Importaciones')[0].archivoId]; assert.strictEqual(env.__.folders[orig.parent].name, 'Resúmenes de tarjetas');
  ok('importa Mercado Pago: categoriza, separa transferencias propias y guarda el original en Drive');
  // re-subir: todo duplicado
  await importFx(p, 'mercadopago_noviembre.csv');
  assert(/6<\/b> duplicados|6 duplicados/.test(await p.innerHTML('.imp .stats')) || /♻️ 6/.test(await p.innerText('.imp .stats')));
  assert(/Confirmar importación \(0\)/.test(await p.innerText('[data-act="impOk"]')));
  await p.click('[data-act="impNo"]'); ok('volver a subir el mismo archivo no duplica nada');

  // tarjeta en CSV: la compra de ropa cargada por chat coincide
  await importFx(p, 'visa_noviembre.csv');
  const st = await p.innerText('.imp .stats'); assert(/1\s*coinciden/.test(st.replace(/\n/g, ' ')), st);
  await confirmImp(p);
  const ropa = env.readTable_('Movimientos').filter(m => /ropa|zara/i.test(m.descripcion));
  assert.strictEqual(ropa.filter(m => m.estado === 'activo').length, 1); assert(ropa.some(m => m.estado === 'reemplazado'));
  assert.strictEqual(dbMovs().filter(m => /CAFE MARTINEZ/.test(m.descripcion)).length, 2, 'dos cafés iguales se mantienen');
  assert.strictEqual(dbMovs().find(m => /FRAVEGA/.test(m.descripcion)).cuota, '2/6');
  ok('resumen de tarjeta: reemplaza la carga manual equivalente, respeta repeticiones reales y cuotas');

  // PDF desconocido con IA (+ categoría nueva sugerida)
  await importFx(p, 'mastercard.pdf');
  assert(await p.isVisible('text=Leído con IA')); assert(await p.isVisible('text=El total cuadra'));
  assert(/1\s*a revisar/.test((await p.innerText('.imp .stats')).replace(/\n/g, ' ')), 'baja confianza pide revisión');
  await confirmImp(p);
  assert(env.readTable_('Categorias').some(c => c.nombre === 'Kiosco'), 'crea la categoría nueva al confirmar');
  ok('PDF de otro banco con IA: control de cuadre, pide revisar lo dudoso y crea categorías nuevas');

  // foto de comprobante
  await importFx(p, 'ticket.png');
  await confirmImp(p);
  const farm = dbMovs().find(m => /Farmacity/.test(m.descripcion)); assert(farm && farm.categoria === 'Salud' && farm.medio === 'Débito');
  assert.strictEqual(env.__.folders[env.__.files[farm.archivoId].parent].name, 'Comprobantes');
  ok('foto de comprobante: IA + archivo en Comprobantes/');

  // bandeja de entrada de Drive
  env.addInboxFile('mp_desde_celu.csv', 'text/csv', Buffer.from(fs.readFileSync(FX('mercadopago_noviembre.csv'), 'utf8').replace(/1006;-9\.999,00/, '1006;-9.999,00').replace('12-11-2026;Pago Netflix', '12-11-2026;Pago Netflix') + '20-11-2026;Pago en Farmacity;1007;-5.000,00;58.251,40\n'));
  await closeAll(p);
  await p.click('[data-act="checkInbox"]'); await p.waitForSelector('[data-act="pendOpen"]');
  await p.click('[data-act="pendOpen"]'); await p.waitForSelector('.imp .pv');
  const st2 = (await p.innerText('.imp .stats')).replace(/\n/g, ' '); assert(/1\s*nuevos/.test(st2) && /6\s*duplicados/.test(st2), st2);
  await confirmImp(p);
  assert.strictEqual(env.readTable_('Pendientes')[0].estado, 'importado');
  const inboxFile = env.__.files[env.readTable_('Pendientes')[0].archivoId]; assert.strictEqual(env.__.folders[inboxFile.parent].name, 'Resúmenes de tarjetas');
  ok('archivo dejado en Drive/Entrada: se detecta, se revisa, se importa sin duplicar y se archiva');

  // movimientos: filtros y edición
  await tab(p, 'movimientos');
  await p.selectOption('[data-flt="medio"]', 'Mercado Pago'); await p.waitForTimeout(100);
  const nMp = await p.$$eval('table.movs tbody tr.click', x => x.length); assert.strictEqual(nMp, 7, 'filtro por medio');
  await p.click('[data-act="fltClear"]'); await p.click('[data-act="fltTipo"][data-k="Préstamo"]');
  assert.strictEqual(await p.$$eval('table.movs tbody tr.click', x => x.length), 1);
  await p.click('table.movs tbody tr.click'); await p.waitForSelector('#modal.show');
  await p.fill('form[data-form="mov"] [name="monto"]', '45.000'); await p.click('form[data-form="mov"] button.pri'); await waitSynced(p);
  assert.strictEqual(dbMovs().find(m => m.tipo === 'Préstamo').monto, -45000);
  ok('historial con filtros; editar actualiza Drive');
  await p.click('[data-act="fltClear"]'); await p.screenshot({ path: path.join(SHOTS, 'movimientos.png') });

  // ingresos: sueldo que requiere confirmación
  await tab(p, 'ingresos'); await p.click('[data-act="recAdd"][data-k="Sueldo"]');
  await p.fill('[data-rec="monto"]', '1.500.000'); await p.press('[data-rec="monto"]', 'Tab');
  await p.evaluate(() => { const m = window.APP.DB.movs.find(x => x.categoria === 'Sueldo'); }); // el sueldo de noviembre ya fue registrado por chat (sin opId)
  await tab(p, 'inicio');
  assert(await p.isVisible('text=¿Ya cobraste'), 'pregunta por el sueldo, no lo registra solo');
  const before = dbMovs().filter(m => m.categoria === 'Sueldo').length;
  await p.click('[data-act="recOk"]'); await waitSynced(p);
  assert.strictEqual(dbMovs().filter(m => m.categoria === 'Sueldo').length, before + 1);
  assert(!(await p.isVisible('text=¿Ya cobraste')));
  ok('sueldo habitual: pide confirmación y no lo registra antes');

  // dashboard
  assert(await p.isVisible('text=Ingresos del mes')); assert(await p.isVisible('svg.donut')); assert(await p.isVisible('text=Gastos por medio de pago'));
  await p.hover('svg.donut path >> nth=0'); assert(await p.isVisible('#tip.show'));
  await p.screenshot({ path: path.join(SHOTS, 'inicio.png'), fullPage: true });
  await p.click('svg.donut path >> nth=0'); assert(await p.isVisible('text=📋 Movimientos'), 'clic en el gráfico filtra movimientos');
  ok('dashboard con KPIs, gráficos interactivos y tooltips');
  await tab(p, 'inicio'); assert(await p.isVisible('text=Gastos fijos de noviembre'));
  assert(await p.isVisible('.fijos li:has-text("Netflix") >> text=pagado'), 'Netflix (MP) aparece como fijo pagado');
  await p.screenshot({ path: path.join(SHOTS, 'fijos.png'), fullPage: false, clip: await p.$eval('.fijos', el => { const r = el.closest('.card').getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }; }) }).catch(() => { });
  await tab(p, 'movimientos'); await p.click('[data-act="fltClear"]'); await p.click('[data-act="fltFlag"][data-k="Fijo"]');
  assert((await p.$$eval('table.movs tbody tr.click', x => x.length)) >= 1); await p.click('[data-act="fltFlag"][data-k="Fijo"]');
  ok('panel de gastos fijos (pagados / pendientes) y filtro de fijos');

  await tab(p, 'reportes'); for (const k of ['trim', 'sem', 'anio']) { await p.click(`[data-act="period"][data-k="${k}"]`); assert(await p.isVisible('table tbody tr')); }
  const dl = p.waitForEvent('download'); await p.click('[data-act="xlsx"] >> nth=0'); const d = await dl; assert(/\.xlsx$/.test(d.suggestedFilename()));
  await p.screenshot({ path: path.join(SHOTS, 'reportes.png'), fullPage: true });
  const tot = env.SpreadsheetApp.openById(env.__.props.TOTALS_ID).getSheetByName('Mensual').getRange(1, 1, 3, 9).getValues();
  const S = await p.evaluate(() => window.APP.summarize('2026-11'));
  assert.strictEqual(tot[1][0], '2026-11'); assert.strictEqual(tot[1][1], Math.round(S.ingresos)); assert.strictEqual(tot[1][2], Math.round(S.gastos));
  ok('reportes mensual/trimestral/semestral/anual, Excel y planilla de Totales en Drive coinciden con la app');

  await tab(p, 'ajustes'); await p.fill('[data-catf="icono"][data-k="Supermercado"]', '🧺'); await p.press('[data-catf="icono"][data-k="Supermercado"]', 'Tab'); await waitSynced(p);
  assert.strictEqual(env.readTable_('Categorias').find(c => c.id === 'Supermercado').icono, '🧺');
  await p.fill('[data-catf="nombre"][data-k="Supermercado"]', 'Súper y almacén'); await p.press('[data-catf="nombre"][data-k="Supermercado"]', 'Tab'); await waitSynced(p);
  assert(dbMovs().some(m => m.categoria === 'Súper y almacén') && !dbMovs().some(m => m.categoria === 'Supermercado'));
  ok('categorías editables (ícono y nombre) y se propagan a los movimientos');
  assert(await p.isVisible('text=Inteligencia artificial (Gemini)'));
  assert.strictEqual(await p.isVisible('[data-act="aiOff"]'), true, 'con clave cargada muestra la opción de quitarla');
  await p.click('[data-act="aiOff"]'); await p.waitForSelector('form[data-form="aiKey"]');
  assert(!env.__.props.GEMINI_API_KEY);
  await p.fill('form[data-form="aiKey"] [name="key"]', 'AQ.clave-de-prueba'); await p.check('form[data-form="aiKey"] [name="ok"]'); await p.click('form[data-form="aiKey"] button');
  await p.waitForSelector('[data-act="aiOff"]'); assert.strictEqual(env.__.props.GEMINI_API_KEY, 'AQ.clave-de-prueba');
  assert(!(await p.content()).includes('AQ.clave-de-prueba'), 'la clave no queda en la página');
  ok('IA: el cliente activa y quita su propia clave desde Ajustes (se prueba antes de guardar)');
  await p.screenshot({ path: path.join(SHOTS, 'ajustes.png'), fullPage: true });

  // 3) otro dispositivo (celular) ve lo mismo
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const pm = await newPage(ctxM, true); await waitSynced(pm);
  assert.strictEqual(await pm.evaluate(() => window.APP.DB.cat.find(c => c.id === 'Supermercado').nombre), 'Súper y almacén', 'un dispositivo nuevo no pisa las categorías');
  await pm.waitForTimeout(1500); assert.strictEqual(env.readTable_('Categorias').find(c => c.id === 'Supermercado').icono, '🧺');
  const n1 = await p.evaluate(() => window.APP.DB.movs.filter(m => m.estado === 'activo').length), n2 = await pm.evaluate(() => window.APP.DB.movs.filter(m => m.estado === 'activo').length);
  assert.strictEqual(n1, n2);
  await pm.screenshot({ path: path.join(SHOTS, 'celular-inicio.png'), fullPage: true });
  await pm.click('#tabs button[data-k="asistente"]'); await chat(pm, 'gasté 5 mil en café con mercado pago'); await waitSynced(pm);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.evaluate(() => pull());
  assert(await p.evaluate(() => window.APP.DB.movs.some(m => /caf/i.test(m.descripcion) && m.monto === -5000)), 'la PC ve lo cargado desde el celular');
  await pm.screenshot({ path: path.join(SHOTS, 'celular-asistente.png') });
  ok('sincronización entre dispositivos (PC ↔ celular)');

  // 4) sin conexión: guarda local y envía después
  await ctx.setOffline(true);
  await tab(p, 'asistente'); await chat(p, 'gasté 1200 en un alfajor');
  await p.waitForFunction(() => window.APP.SYNC.status === 'offline' || window.APP.SYNC.queue.length > 0);
  await ctx.setOffline(false); await p.evaluate(() => flush()); await waitSynced(p);
  assert(dbMovs().some(m => /alfajor/i.test(m.descripcion)));
  ok('sin internet: guarda en el dispositivo y sube al volver la conexión');
  // backend que rechaza POST (script dentro de una planilla): la app pasa sola a GET, también para archivos
  srv.failPost = true;
  await tab(p, 'asistente'); await chat(p, 'gasté 2300 en una birome'); await waitSynced(p);
  assert(dbMovs().some(m => /birome/i.test(m.descripcion)), 'sincroniza por GET');
  await tab(p, 'importar'); await importFx(p, 'mastercard.pdf'); await confirmImp(p);
  assert(env.readTable_('Importaciones').some(i => i.archivo === 'mastercard.pdf' && i.archivoId), 'sube el archivo en partes por GET');
  assert(srv.gets > 3); srv.failPost = false;
  ok('si el backend rechaza POST, la app usa GET automáticamente (incluido subir archivos en partes)');

  assert.deepStrictEqual(errors, [], 'errores en consola: ' + errors.join(' | '));
  ok('sin errores de JavaScript');
  await browser.close(); srv.close();
  console.log(`\n${pass} pruebas integrales OK`);
})().catch(e => { console.error('\n✗', e); process.exit(1); });
