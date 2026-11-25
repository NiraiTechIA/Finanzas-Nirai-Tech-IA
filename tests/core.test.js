// Pruebas del núcleo (js/core.js): intérprete de mensajes, clasificación, duplicados y cálculos.
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const ctx = { console, Intl, Date, Math, JSON }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'v2', 'js', 'core.js'), 'utf8'), ctx);
const C = ctx; let pass = 0; const t = (n, f) => { f(); pass++; console.log('  ✓', n); };
C.loadTables({});
const HOY = '2026-11-24';
const I = s => C.interpretLocal(s, { hoy: HOY, mes: '2026-11' });

console.log('Núcleo');
t('"Hoy cobré mi sueldo de $1.500.000"', () => { const r = I('Hoy cobré mi sueldo de $1.500.000'); assert.strictEqual(r.accion, 'registrar'); const m = r.movimiento; assert.strictEqual(m.monto, 1500000); assert.strictEqual(m.tipo, 'Ingreso'); assert.strictEqual(m.categoria, 'Sueldo'); assert.strictEqual(m.fecha, HOY); });
t('"Acabo de gastar $18.500 en una cena"', () => { const m = I('Acabo de gastar $18.500 en una cena').movimiento; assert.strictEqual(m.monto, 18500); assert.strictEqual(m.tipo, 'Gasto'); assert.strictEqual(m.categoria, 'Comida y restaurantes'); assert.strictEqual(m.descripcion, 'Cena'); });
t('"Hoy gasté $35.000 en combustible"', () => { const m = I('Hoy gasté $35.000 en combustible').movimiento; assert.strictEqual(m.categoria, 'Combustible y transporte'); assert.strictEqual(m.monto, 35000); });
t('"Me ingresaron $120.000 por un trabajo extra"', () => { const m = I('Me ingresaron $120.000 por un trabajo extra').movimiento; assert.strictEqual(m.tipo, 'Ingreso'); assert.strictEqual(m.categoria, 'Trabajos adicionales'); });
t('"Compré ropa por $75.000 con tarjeta de crédito"', () => { const m = I('Compré ropa por $75.000 con tarjeta de crédito').movimiento; assert.strictEqual(m.categoria, 'Ropa'); assert.strictEqual(m.medio, 'Tarjeta de crédito'); assert.strictEqual(m.descripcion, 'Ropa'); });
t('"Pagué $250.000 de seguro del auto"', () => { const m = I('Pagué $250.000 de seguro del auto').movimiento; assert.strictEqual(m.categoria, 'Seguros'); assert.strictEqual(m.monto, 250000); });
t('"Compré una computadora por $900.000"', () => { assert.strictEqual(I('Compré una computadora por $900.000').movimiento.categoria, 'Tecnología'); });
t('"Le presté $50.000 a un amigo" es préstamo, no gasto', () => { const m = I('Le presté $50.000 a un amigo').movimiento; assert.strictEqual(m.tipo, 'Préstamo'); assert.strictEqual(m.sentido, 'salida'); const rows = C.movsFromIntent(m); assert.strictEqual(rows[0].monto, -50000); assert.strictEqual(rows[0].tipo, 'Préstamo'); });
t('montos con "mil", "k" y cuotas', () => { assert.strictEqual(C.parseAmountText('gasté 35 mil en nafta'), 35000); assert.strictEqual(C.parseAmountText('75k'), 75000); assert.strictEqual(C.parseAmountText('1,5 millones'), 1500000); const m = I('compré una tele en 6 cuotas por $600.000 con visa').movimiento; assert.strictEqual(m.cuotas, 6); assert.strictEqual(m.monto, 600000); const rows = C.movsFromIntent(m); assert.strictEqual(rows.length, 6); assert.strictEqual(rows[5].mes, '2027-04'); assert.strictEqual(rows[0].monto, -100000); assert.strictEqual(rows[0].flag, 'Cuota'); });
t('si falta el monto, pregunta', () => { const r = I('gasté en el super'); assert.deepStrictEqual(Array.from(r.faltan), ['monto']); assert(r.pregunta); });
t('corrección "el gasto anterior no fue de $18.500, fue de $16.500"', () => { const r = I('El gasto anterior no fue de $18.500, fue de $16.500'); assert.strictEqual(r.accion, 'corregir'); assert.strictEqual(r.correccion.cambios.monto, 16500); assert.strictEqual(r.correccion.montoAnterior, 18500); });
t('ayer y fecha explícita', () => { assert.strictEqual(I('ayer gasté 5000 en café').movimiento.fecha, '2026-11-23'); assert.strictEqual(I('el 15/11 pagué 8000 de luz').movimiento.fecha, '2026-11-15'); });
t('consultas', () => {
  assert.strictEqual(I('¿Cuánto gasté este mes?').consulta.metrica, 'gastos');
  assert.strictEqual(I('¿Cuánto llevo gastado en comida?').consulta.categoria, 'Comida y restaurantes');
  assert.strictEqual(I('¿Cuánto gasté con Mercado Pago?').consulta.metrica, 'gasto_medio');
  assert.strictEqual(I('¿Cuánto debo pagar de tarjeta?').consulta.metrica, 'tarjeta_a_pagar');
  assert.strictEqual(I('¿Cuánto cobré este mes?').consulta.metrica, 'ingresos');
  assert.strictEqual(I('¿Cuáles fueron mis mayores gastos?').consulta.metrica, 'mayores_gastos');
  assert.strictEqual(I('¿En qué categoría estoy gastando más?').consulta.metrica, 'categoria_top');
  assert.strictEqual(I('¿Cuánto ahorré respecto al mes anterior?').consulta.metrica, 'ahorro_vs_anterior');
  assert.strictEqual(I('¿Cuánto dinero me queda disponible?').consulta.metrica, 'disponible');
  assert.strictEqual(I('¿cuánto gasté en octubre?').consulta.mes, '2026-10');
});
t('clasificación por palabras clave (palabra más específica gana)', () => {
  const r = C.classify({ descripcion: 'MERPAGO*CARREFOUR 123456', monto: -5000, medio: 'Tarjeta de crédito' }); assert.strictEqual(r.categoria, 'Supermercado');
  assert.strictEqual(C.classify({ descripcion: 'NETFLIX.COM', monto: -9000, medio: 'Tarjeta de crédito' }).flag, 'Fijo');
  assert.strictEqual(C.classify({ descripcion: 'Rendimientos', monto: 500, medio: 'Mercado Pago' }).categoria, 'Inversiones');
  assert.strictEqual(C.classify({ descripcion: 'Gastos varios barrio', monto: -10, medio: 'Efectivo' }).categoria, 'Sin clasificar', 'no confunde "bar" dentro de "barrio"');
});
t('transferencias propias y pagos de tarjeta no son ingresos ni gastos', () => {
  C.setCfg('propios', ['Mauro Maejo']);
  const a = C.classify({ descripcion: 'Transferencia enviada Mauro Antonio Maejo', monto: -100000, medio: 'Mercado Pago' }); assert.strictEqual(a.tipo, 'Interno'); assert.strictEqual(a.categoria, 'Transferencias propias');
  const b = C.classify({ descripcion: 'Pago de resumen Visa', monto: -230000, medio: 'Mercado Pago' }, { pagos: [230000] }); assert.strictEqual(b.tipo, 'Interno'); assert.strictEqual(b.categoria, 'Pago de tarjeta');
  const c = C.classify({ descripcion: 'Pago de resumen Naranja', monto: -50000, medio: 'Mercado Pago' }, { pagos: [] }); assert.strictEqual(c.categoria, 'Tarjeta sin detalle');
});
t('importación: detecta duplicados (re-subir el mismo archivo) y repeticiones legítimas dentro del archivo', () => {
  const mk = () => C.parsedToRows({ meta: { monthKey: '2026-11', card: { nombre: 'Visa ···1234' } }, txs: [{ fecha: '2026-11-02', desc: 'CAFE MARTINEZ', monto: -3000 }, { fecha: '2026-11-02', desc: 'CAFE MARTINEZ', monto: -3000 }, { fecha: '2026-10-10', desc: 'FRAVEGA', monto: -50000, cuota: [2, 6] }] }, 'tarjeta');
  const p1 = C.buildPreview(mk()); assert.strictEqual(p1.filter(x => x.estado === 'duplicado').length, 0, 'dos cafés iguales el mismo día no son duplicado');
  C.commitImport({ fuente: 'tarjeta', mes: '2026-11', cuenta: 'Visa ···1234', archivo: 'visa.pdf' }, p1);
  const p2 = C.buildPreview(mk()); assert.strictEqual(p2.filter(x => x.estado === 'duplicado').length, 3); assert(p2.every(x => !x.incluir));
  const next = C.parsedToRows({ meta: { monthKey: '2026-12', card: { nombre: 'Visa ···1234' } }, txs: [{ fecha: '2026-10-10', desc: 'FRAVEGA', monto: -50000, cuota: [3, 6] }] }, 'tarjeta');
  assert.strictEqual(C.buildPreview(next)[0].estado, 'nuevo', 'la cuota siguiente no es duplicado');
});
t('importación: un gasto cargado por chat se reemplaza por el del resumen (sin duplicar)', () => {
  const chat = C.movsFromIntent(I('ayer gasté $42.000 en el super con mercado pago').movimiento, 'chat'); chat.forEach(C.putMov);
  const rows = C.parsedToRows({ meta: {}, txs: [{ fecha: '2026-11-23', desc: 'Pago en COTO', monto: -42000, opId: '9988' }] }, 'mercadopago');
  const pv = C.buildPreview(rows); assert.strictEqual(pv[0].estado, 'manual');
  C.commitImport({ fuente: 'mercadopago', mes: '2026-11', archivo: 'mp.pdf' }, pv);
  assert.strictEqual(C.movById(chat[0].id).estado, 'reemplazado');
  assert.strictEqual(C.summarize('2026-11').porCat['Supermercado'], 42000);
});
t('resumen mensual, tarjeta, MP, préstamos y respuestas', () => {
  C.movsFromIntent(I('Hoy cobré mi sueldo de $1.500.000').movimiento).forEach(C.putMov);
  C.movsFromIntent(I('Le presté $50.000 a un amigo').movimiento).forEach(C.putMov);
  const S = C.summarize('2026-11');
  assert.strictEqual(S.ingresos, 1500000); assert.strictEqual(S.prestamos, -50000);
  assert.strictEqual(S.gastos, 3000 * 2 + 50000 + 42000); assert.strictEqual(S.tarjeta, 56000); assert.strictEqual(S.mp, 42000);
  assert(/\$ 42\.000/.test(C.answerQuery({ metrica: 'gasto_medio', medio: 'Mercado Pago' }, '2026-11')));
  assert(/Supermercado \$ 42\.000|Tecnología/.test(C.answerQuery({ metrica: 'categoria_top' }, '2026-11')));
});
t('sueldo: no se registra solo si no está configurado como automático', () => {
  C.setCfg('recurrentes', [{ id: 'r1', nombre: 'Sueldo', categoria: 'Sueldo', monto: 1500000, dia: 5, auto: false }, { id: 'r2', nombre: 'Alquiler depto', categoria: 'Otros ingresos', monto: 200000, dia: 1, auto: true }]);
  assert.strictEqual(C.recurrentesPendientes('2026-12-03').length, 1, 'antes del día 5 el sueldo no aparece');
  const auto = C.autoRecurrentes('2026-12-06'); assert.strictEqual(auto.length, 1); assert.strictEqual(auto[0].descripcion, 'Alquiler depto');
  const pend = C.recurrentesPendientes('2026-12-06'); assert.strictEqual(pend.length, 1); assert.strictEqual(pend[0].rec.nombre, 'Sueldo');
  C.registrarRecurrente(pend[0], 1480000); assert.strictEqual(C.recurrentesPendientes('2026-12-06').length, 0);
  assert.strictEqual(C.autoRecurrentes('2026-12-07').length, 0, 'no lo duplica');
});
t('migración desde la versión 1', () => {
  const before = C.DB.movs.length;
  const n = C.migrateV1({ months: { '2026-09': { tarjetas: [{ nombre: 'Visa', txs: [{ fecha: '2026-09-01', desc: 'SHELL', monto: -20000, tipo: 'Gasto', cat: 'Nafta', flag: 'Variable' }] }], mp: { txs: [{ fecha: '2026-09-02', desc: 'Rendimientos', monto: 300, tipo: 'Rendimiento', cat: 'Rendimiento' }] }, extras: [], sueldo: 900000 } }, mappings: { shell: { tipo: 'Gasto', cat: 'Nafta', flag: 'Variable' } }, settings: { sueldo: 900000 } });
  assert.strictEqual(n, 3); assert.strictEqual(C.DB.movs.length, before + 3);
  const S = C.summarize('2026-09'); assert.strictEqual(S.porCat['Combustible y transporte'], 20000); assert.strictEqual(S.porCatIng['Inversiones'], 300);
  assert.strictEqual(C.migrateV1({ months: { '2026-09': { tarjetas: [{ nombre: 'Visa', txs: [{ fecha: '2026-09-01', desc: 'SHELL', monto: -20000, tipo: 'Gasto', cat: 'Nafta' }] }] } } }), 0, 'no duplica si se migra dos veces');
});
t('inusuales y períodos', () => {
  ['2026-08', '2026-09', '2026-10'].forEach(k => C.putMov({ id: 'h' + k, fecha: k + '-10', mes: k, descripcion: 'COTO', monto: -20000, tipo: 'Gasto', categoria: 'Supermercado', medio: 'Débito', estado: 'activo' }));
  C.putMov({ id: 'big', fecha: '2026-11-11', mes: '2026-11', descripcion: 'COTO compra grande', monto: -150000, tipo: 'Gasto', categoria: 'Supermercado', medio: 'Débito', estado: 'activo' });
  const u = C.inusuales('2026-11'); assert(u.some(x => x.tipo === 'categoria' && x.categoria === 'Supermercado')); assert(u.some(x => x.id === 'big'));
  const tri = C.periodRows('trim'); assert(tri.find(r => r.g === '2026 · T4'));
});
t('gastos fijos: obra social y seguro por tarjeta, servicios por MP', () => {
  const rows = C.parsedToRows({ meta: { monthKey: '2026-10', card: { nombre: 'Visa ···7679' } }, txs: [{ fecha: '2026-10-05', desc: 'OSDE 210 CUOTA', monto: -95000 }, { fecha: '2026-10-23', desc: 'Barbuss risk seguro', monto: -228438.68 }, { fecha: '2026-10-08', desc: 'Saldo a favor del resumen anterior', monto: 5907.2 }, { fecha: '2026-10-12', desc: 'FARMACITY', monto: -9000 }] }, 'tarjeta');
  assert.strictEqual(rows[0].categoria, 'Salud'); assert.strictEqual(rows[0].flag, 'Fijo', 'obra social es fija aunque Salud sea variable');
  assert.strictEqual(rows[1].flag, 'Fijo'); assert.strictEqual(rows[2].tipo, 'Interno', 'saldo a favor no es ingreso'); assert.strictEqual(rows[3].flag, 'Variable');
  const mp = C.parsedToRows({ meta: {}, txs: [{ fecha: '2026-10-03', desc: 'Pago de servicio Metrogas', monto: -41119.33, opId: 'm1' }] }, 'mercadopago');
  assert.strictEqual(mp[0].categoria, 'Servicios'); assert.strictEqual(mp[0].flag, 'Fijo');
  C.commitImport({ fuente: 'tarjeta', mes: '2026-10', cuenta: 'Visa ···7679', archivo: 'visa-oct.pdf' }, C.buildPreview(rows));
  C.commitImport({ fuente: 'mercadopago', mes: '2026-10', archivo: 'mp-oct.pdf' }, C.buildPreview(mp));
});
t('gastos fijos del mes: pagados y pendientes según los meses anteriores', () => {
  let F = C.fijosDelMes('2026-11');
  const osde = F.lista.find(e => /osde/i.test(e.desc)); assert(osde && osde.estado === 'pendiente' && osde.esperado === 95000);
  C.putMov({ id: 'osde-nov', fecha: '2026-11-05', mes: '2026-11', descripcion: 'OSDE 210 CUOTA', monto: -98000, tipo: 'Gasto', categoria: 'Salud', flag: 'Fijo', medio: 'Tarjeta de crédito', estado: 'activo' });
  F = C.fijosDelMes('2026-11'); const o2 = F.lista.find(e => /osde/i.test(e.desc)); assert.strictEqual(o2.estado, 'pagado'); assert.strictEqual(o2.pagado, 98000);
  assert(F.tot.nPendientes >= 2 && F.tot.pendiente >= 228438 + 41119);
});
t('marcar un comercio como fijo se aplica a todos los meses y a los próximos', () => {
  ['2026-09', '2026-10'].forEach(k => C.putMov({ id: 'gym' + k, fecha: k + '-02', mes: k, descripcion: 'SMART FIT', monto: -30000, tipo: 'Gasto', categoria: 'Entretenimiento', flag: 'Variable', medio: 'Débito', origen: 'archivo', estado: 'activo' }));
  const n = C.setFlagForKey(C.movById('gym2026-10'), 'Fijo'); assert.strictEqual(n, 2);
  const nuevo = C.parsedToRows({ meta: { monthKey: '2026-11', card: { nombre: 'Visa' } }, txs: [{ fecha: '2026-11-02', desc: 'SMART FIT', monto: -32000 }] }, 'tarjeta');
  assert.strictEqual(nuevo[0].flag, 'Fijo', 'el mes siguiente ya entra como fijo');
  C.setFlagForKey(C.movById('gym2026-10'), 'Variable'); assert.strictEqual(C.movById('gym2026-09').flag, 'Variable');
  assert.strictEqual(C.parsedToRows({ meta: { monthKey: '2026-11', card: { nombre: 'Visa' } }, txs: [{ fecha: '2026-11-02', desc: 'SMART FIT', monto: -32000 }] }, 'tarjeta')[0].flag, 'Variable');
});
t('sugiere como fijo lo que se repite con importe parecido', () => {
  ['2026-09', '2026-10'].forEach(k => C.putMov({ id: 'prof' + k, fecha: k + '-10', mes: k, descripcion: 'Transferencia enviada Profesora Ingles', monto: -40000, tipo: 'Gasto', categoria: 'Educación', flag: 'Variable', medio: 'Mercado Pago', estado: 'activo' }));
  assert(C.sugerenciasFijos('2026-10').some(s => /profesora/i.test(s.ref.descripcion)));
  assert(!C.sugerenciasFijos('2026-10').some(s => /COTO/i.test(s.ref.descripcion)), 'no sugiere el supermercado');
});
t('cambiar las palabras de fijos recalcula los movimientos existentes', () => {
  C.putMov({ id: 'pil', fecha: '2026-10-15', mes: '2026-10', descripcion: 'Pilates Lomas', monto: -25000, tipo: 'Gasto', categoria: 'Salud', flag: 'Variable', medio: 'Efectivo', estado: 'activo' });
  C.setCfg('fijosPalabras', C.DB.cfg.fijosPalabras + ',pilates'); assert(C.recalcFijos() >= 1); assert.strictEqual(C.movById('pil').flag, 'Fijo');
});
console.log(`\n${pass} pruebas del núcleo OK`);
