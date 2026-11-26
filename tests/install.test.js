// Prueba del instalador en 3 pasos (planilla plantilla con script vinculado) y de la clave de IA desde la app.
const assert = require('assert');
const { createEnv } = require('./gas-fake');
let pass = 0; const t = (n, f) => { f(); pass++; console.log('  ✓', n); };
const calls = [];
function scriptApi(opts) {
  return (url, o, props) => {
    if (url.startsWith('https://script.googleapis.com/')) {
      calls.push({ url, method: o.method, body: JSON.parse(o.payload || '{}'), auth: o.headers.Authorization });
      if (opts.disabled) return { code: 403, body: JSON.stringify({ error: { message: 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings then retry.' } }) };
      if (/\/versions$/.test(url)) return { code: 200, body: JSON.stringify({ versionNumber: calls.filter(c => /versions$/.test(c.url)).length }) };
      if (/\/deployments$/.test(url)) return { code: 200, body: JSON.stringify({ deploymentId: 'AKfyDEP1', entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/AKfyDEP1/exec' } }] }) };
      if (/\/deployments\/AKfyDEP1$/.test(url)) return { code: 200, body: JSON.stringify({ deploymentId: 'AKfyDEP1', entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/AKfyDEP1/exec' } }] }) };
    }
    if (url.includes('generativelanguage')) return o.headers['x-goog-api-key'] === 'AQ.buena' ? { code: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }) } : { code: 400, body: '{"error":{"message":"API key not valid"}}' };
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return { code: 200, body: JSON.stringify({ aud: '288188064237-aatf9mti4ioim04pup4m4ok9abdp16ub.apps.googleusercontent.com', iss: 'accounts.google.com', email: 'cliente@gmail.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }) };
    return { code: 404, body: '' };
  };
}
console.log('Instalador');
const opts = { disabled: true };
const env = createEnv({ fetch: scriptApi(opts), props: { OWNER_EMAIL: '', OAUTH_CLIENT_ID: '' } });
delete env.__.props.OWNER_EMAIL; delete env.__.props.OAUTH_CLIENT_ID;
const plantilla = env.bindToNewSheet();
t('onOpen agrega el menú 💹 Finanzas', () => { env.onOpen(); assert(env.__.ui.menu); });
t('sin la API de Apps Script activada: crea todo y explica el único paso que falta', () => {
  const r = env.instalar();
  assert(r.deploy.error && r.deploy.code === 403);
  assert(/Pegar mi URL publicada/.test(env.__.ui.dialogs.pop()), 'el diálogo explica el último paso');
  assert.strictEqual(env.__.props.DB_ID, plantilla.getId(), 'la copia de la planilla es la base de datos');
  assert(/Base de datos/.test(env.__.files[plantilla.getId()].name));
  assert.strictEqual(env.__.folders[env.__.files[plantilla.getId()].parent].name, 'Base de datos');
  assert.strictEqual(env.__.props.OWNER_EMAIL, 'dueno@gmail.com', 'el dueño es quien instala');
});
t('con la API activada: publica, guarda el link personal y lo manda por mail', () => {
  opts.disabled = false;
  const r = env.instalar();
  assert.strictEqual(r.deploy.id, 'AKfyDEP1');
  assert(calls.some(c => /\/versions$/.test(c.url)) && calls.some(c => /\/deployments$/.test(c.url) && c.body.manifestFileName === 'appsscript'));
  assert.strictEqual(calls[calls.length - 1].auth, 'Bearer oauth-token-test');
  assert(/v2\/\?conectar=AKfyDEP1/.test(env.__.ui.dialogs.pop()));
  assert(env.__.mails[0] && /conectar=AKfyDEP1/.test(env.__.mails[0].htmlBody) && env.__.mails[0].to === 'dueno@gmail.com');
});
t('reinstalar actualiza la misma implementación (el link no cambia)', () => {
  const n = calls.length; const r = env.instalar();
  assert.strictEqual(r.deploy.id, 'AKfyDEP1'); assert(calls.slice(n).some(c => c.method === 'put' && /deployments\/AKfyDEP1$/.test(c.url)));
  assert.strictEqual(env.__.triggers.length, 2, 'no duplica tareas');
});
t('usa el ID de cliente de la app por defecto y acepta al dueño', () => {
  env.__.props.OWNER_EMAIL = 'cliente@gmail.com';
  const r = env.post({ action: 'bootstrap', idToken: 'x' }); assert(r.ok, r.error); assert(/conectar=AKfyDEP1/.test(r.data.backend.link)); assert.strictEqual(r.data.ai, false);
});
t('clave de IA desde la app: rechaza una inválida y guarda una válida sin devolverla', () => {
  const bad = env.post({ action: 'setAiKey', idToken: 'x', payload: { key: 'AQ.mala' } }); assert(!bad.ok && /no funcionó/.test(bad.error)); assert(!env.__.props.GEMINI_API_KEY);
  const ok = env.post({ action: 'setAiKey', idToken: 'x', payload: { key: 'AQ.buena' } }); assert(ok.ok && ok.data.ai === true); assert(!JSON.stringify(ok).includes('AQ.buena'));
  assert.strictEqual(env.post({ action: 'bootstrap', idToken: 'x' }).data.ai, true);
});
t('prepararPlantilla deja solo la hoja de bienvenida', () => {
  const e2 = createEnv(); e2.bindToNewSheet('plantilla'); const msg = e2.prepararPlantilla();
  const ss = e2.SpreadsheetApp.getActiveSpreadsheet(); assert.deepStrictEqual(ss.getSheets().map(x => x.getName()), ['👋 Empezá acá']); assert(/copy/.test(msg));
});
t('plan B: API rechazada → publicación a mano y «Cargar la URL publicada a mano»', () => {
  const o2 = { disabled: true }; const e3 = createEnv({ fetch: (u, o, p) => u.startsWith('https://script.googleapis.com/') ? { code: 403, body: JSON.stringify({ error: { message: 'Apps Script API has not been used in project 123 before or it is disabled.' } }) } : scriptApi(o2)(u, o, p) });
  e3.bindToNewSheet(); const r = e3.instalar(); assert(r.deploy.error);
  const d = e3.__.ui.dialogs.pop(); assert(/Nueva implementación/.test(d) && /Pegar mi URL publicada/.test(d) && /Ref\./.test(d));
  e3.__.ui.respuesta = 'https://script.google.com/macros/s/AKfy/exec'; e3.cargarUrlManual(); assert(/no es la URL correcta/.test(e3.__.ui.dialogs.pop()) , 'rechaza URLs inválidas');
  e3.__.ui.respuesta = ' https://script.google.com/macros/s/AKfycbMANUAL9xxxxxxxxxxxxxxxxxxxx/exec ';
  e3.cargarUrlManual(); assert(/conectar=AKfycbMANUAL9x+/.test(e3.__.ui.dialogs.pop())); assert.strictEqual(e3.__.props.DEPLOYMENT_ID, 'AKfycbMANUAL9xxxxxxxxxxxxxxxxxxxx'); assert(e3.__.mails.length === 1);
  e3.mostrarLink(); assert(/conectar=AKfycbMANUAL9/.test(e3.__.ui.dialogs.pop()));
});
console.log(`\n${pass} pruebas del instalador OK`);
