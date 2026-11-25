/* FINANZAS NIRAI TECH IA — interfaz */
var UI = {
  tab: 'inicio', month: todayIso().slice(0, 7), period: 'mes',
  f: { anio: '', mes: '', tipo: '', cat: '', medio: '', q: '' },
  chat: [], chatCtx: null, lastChat: [], imports: [], modal: null, _dirty: false,
  busy: function () { return !!UI.modal || UI.imports.some(function (s) { return s.status === 'leyendo' || s.status === 'guardando'; }) || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)); },
  refresh: function () { if (UI.busy()) { UI._dirty = true; UI.refreshStatus(); return; } render(); },
  refreshStatus: function () { var el = document.getElementById('syncPill'); if (el) el.outerHTML = statusPill(); }
};
var $app = document.getElementById('app');
var TABS = [['inicio', '🏠', 'Inicio'], ['asistente', '💬', 'Asistente'], ['importar', '📥', 'Importar'], ['movimientos', '📋', 'Movimientos'], ['ingresos', '💰', 'Ingresos'], ['reportes', '📊', 'Reportes'], ['ajustes', '⚙️', 'Ajustes']];

function saveUI() { lsSet('nirai_ui', { tab: UI.tab, month: UI.month, period: UI.period, chat: UI.chat.slice(-60) }); }
function loadUI() { var u = lsGet('nirai_ui', {}) || {}; if (u.tab) UI.tab = u.tab; if (u.month) UI.month = u.month; if (u.period) UI.period = u.period; UI.chat = u.chat || []; }
function toast(msg, err) { var t = document.getElementById('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, err ? 6500 : 3500); }
function opt(list, val, labels) { return list.map(function (o, i) { return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(labels ? labels[i] : (o || '—')) + '</option>'; }).join(''); }
function catOptions(val, tipo) {
  var list = tipo && tipo !== 'Gasto' && tipo !== 'Ingreso' ? cats(tipo) : cats(tipo || null);
  if (val && !list.find(function (c) { return c.nombre === val; })) { var c = catByName(val); list = list.concat([c || { nombre: val, icono: '🏷️' }]); }
  return list.map(function (c) { return '<option value="' + esc(c.nombre) + '"' + (c.nombre === val ? ' selected' : '') + '>' + c.icono + ' ' + esc(c.nombre) + '</option>'; }).join('') + '<option value="__new__">➕ Nueva categoría…</option>';
}
function pct(a, b) { if (!b) return ''; var d = (a - b) / Math.abs(b) * 100; return (d >= 0 ? '+' : '') + Math.round(d) + '%'; }
function statusPill() {
  var s = SYNC.status, m = { local: ['📴', 'Modo local', 'warn'], ok: ['☁️', 'Sincronizado', 'ok'], saving: ['⏳', 'Guardando…', 'ok'], offline: ['⚠️', 'Sin conexión' + (SYNC.queue.length ? ' · ' + SYNC.queue.length + ' pendientes' : ''), 'warn'], login: ['🔑', 'Iniciar sesión', 'bad'], error: ['⚠️', 'Error', 'bad'] }[s] || ['', s, ''];
  return '<button id="syncPill" class="pill ' + m[2] + '" data-act="tab" data-k="ajustes" title="' + esc(SYNC.error || (SYNC.lastSync ? 'Última sincronización: ' + SYNC.lastSync.toLocaleTimeString('es-AR') : '')) + '">' + m[0] + ' ' + m[1] + '</button>';
}

/* ============================ Estructura ============================ */
function renderChrome() {
  var keys = monthKeys(), set = {}; keys.concat([todayIso().slice(0, 7), UI.month]).forEach(function (k) { set[k] = 1; });
  var ms = Object.keys(set).sort().reverse();
  document.getElementById('hdrRight').innerHTML = '<div class="monthnav"><button class="btn icon" data-act="mPrev" aria-label="Mes anterior">‹</button><select id="mSel" aria-label="Mes">' + ms.map(function (k) { return '<option value="' + k + '"' + (k === UI.month ? ' selected' : '') + '>' + monthLabel(k) + '</option>'; }).join('') + '</select><button class="btn icon" data-act="mNext" aria-label="Mes siguiente">›</button></div>' + statusPill();
  var badge = { inicio: recurrentesPendientes().length, importar: DB.pend.filter(function (p) { return p.estado === 'nuevo'; }).length + UI.imports.filter(function (s) { return s.status === 'preview'; }).length };
  document.getElementById('tabs').innerHTML = TABS.map(function (t) { return '<button class="' + (UI.tab === t[0] ? 'on' : '') + '" data-act="tab" data-k="' + t[0] + '"><span class="ti">' + t[1] + '</span><span class="tl">' + t[2] + '</span>' + (badge[t[0]] ? '<span class="badge">' + badge[t[0]] + '</span>' : '') + '</button>'; }).join('');
}
function render() {
  UI._dirty = false; renderChrome();
  var v = { inicio: viewInicio, asistente: viewAsistente, importar: viewImportar, movimientos: viewMovimientos, ingresos: viewIngresos, reportes: viewReportes, ajustes: viewAjustes }[UI.tab] || viewInicio;
  $app.innerHTML = v();
  if (UI.tab === 'ajustes') renderGoogleButton(document.getElementById('gbtn'));
  if (UI.tab === 'asistente') { var log = document.getElementById('chatLog'); if (log) log.scrollTop = log.scrollHeight; }
  saveUI();
}

/* ============================ Gráficos (SVG) ============================ */
function chartEvolucion(keys) {
  var data = keys.map(function (k) { return summarize(k); }), W = 680, H = 240, L = 54, B = 30, T = 12;
  var max = Math.max(1, Math.max.apply(null, data.map(function (s) { return Math.max(s.ingresos, s.gastos); })));
  var min = Math.min(0, Math.min.apply(null, data.map(function (s) { return s.balance; })));
  var y = function (v) { return T + (H - T - B) * (1 - (v - min) / (max - min)); }, n = Math.max(1, data.length), slot = (W - L - 10) / n, bw = Math.min(26, slot / 2.8);
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Ingresos y gastos por mes">';
  [0, .25, .5, .75, 1].forEach(function (f) { var v = min + (max - min) * f; g += '<line x1="' + L + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + 'M' : nf0.format(Math.round(v / 1000)) + 'k') + '</text>'; });
  var pts = [];
  data.forEach(function (s, i) {
    var cx = L + slot * (i + .5);
    g += '<rect x="' + (cx - bw - 1) + '" y="' + y(s.ingresos) + '" width="' + bw + '" height="' + Math.max(0, y(0) - y(s.ingresos)) + '" class="b-ing" rx="3" data-tip="' + esc(monthLabel(s.mes) + ' · Ingresos ' + $0(s.ingresos)) + '" data-act="goMonth" data-k="' + s.mes + '"/>';
    g += '<rect x="' + (cx + 1) + '" y="' + y(s.gastos) + '" width="' + bw + '" height="' + Math.max(0, y(0) - y(s.gastos)) + '" class="b-gas" rx="3" data-tip="' + esc(monthLabel(s.mes) + ' · Gastos ' + $0(s.gastos)) + '" data-act="goMonth" data-k="' + s.mes + '"/>';
    g += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle" class="ax' + (s.mes === UI.month ? ' cur' : '') + '">' + monthShort(s.mes) + '</text>';
    pts.push([cx, y(s.balance), s]);
  });
  if (pts.length > 1) g += '<polyline points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" class="l-bal"/>';
  pts.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" class="d-bal" data-tip="' + esc(monthLabel(p[2].mes) + ' · Balance ' + $0(p[2].balance) + ' · Ahorro ' + Math.round(p[2].tasa * 100) + '%') + '"/>'; });
  return g + '</svg><div class="legend"><span><i class="sw ing"></i>Ingresos</span><span><i class="sw gas"></i>Gastos</span><span><i class="sw bal"></i>Balance</span></div>';
}
function chartAhorro(keys) {
  var data = keys.map(summarize), W = 680, H = 150, L = 40, B = 26, T = 22;
  if (data.length < 2) { var s0 = data[0]; return s0 ? '<div class="bigstat ' + (s0.tasa < 0 ? 'neg' : 'pos') + '">' + Math.round(s0.tasa * 100) + '%</div><p class="small mut">Ahorro de ' + monthLabel(s0.mes) + ' (' + $0(s0.balance) + '). La evolución aparece cuando haya más meses cargados.</p>' : ''; }
  var vals = data.map(function (s) { return Math.round(s.tasa * 100); }), max = Math.max(30, Math.max.apply(null, vals)), min = Math.min(0, Math.min.apply(null, vals));
  var y = function (v) { return T + (H - T - B) * (1 - (v - min) / (max - min)); }, n = Math.max(1, data.length), slot = (W - L - 10) / n;
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Porcentaje de ahorro por mes"><line x1="' + L + '" x2="' + (W - 6) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="grid"/>';
  var pts = data.map(function (s, i) { return [L + slot * (i + .5), y(vals[i]), s, vals[i]]; });
  if (pts.length > 1) g += '<polyline points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" class="l-aho"/>';
  pts.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" class="d-aho" data-tip="' + esc(monthLabel(p[2].mes) + ': ahorro ' + p[3] + '% (' + $0(p[2].balance) + ')') + '"/><text x="' + p[0] + '" y="' + (p[1] - 9) + '" text-anchor="middle" class="ax">' + p[3] + '%</text><text x="' + p[0] + '" y="' + (H - 8) + '" text-anchor="middle" class="ax">' + monthShort(p[2].mes) + '</text>'; });
  return g + '</svg>';
}
var PALETTE = ['#3b6cf6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];
function chartDonut(entries, total) {
  if (!entries.length || total <= 0) return '<p class="mut small">Sin gastos en este mes.</p>';
  var top = entries.slice(0, 8), rest = entries.slice(8).reduce(function (a, e) { return a + e[1]; }, 0); if (rest > 0) top.push(['Otras', rest]);
  var R = 70, r = 44, cx = 90, cy = 90, a0 = -Math.PI / 2, g = '<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Gastos por categoría">';
  top.forEach(function (e, i) {
    var f = e[1] / total, a1 = a0 + f * Math.PI * 2 - 0.0001, big = f > 0.5 ? 1 : 0;
    var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2); };
    var d = f >= 0.9999 ? 'M ' + p(R, 0) + ' A ' + R + ' ' + R + ' 0 1 1 ' + p(R, Math.PI) + ' A ' + R + ' ' + R + ' 0 1 1 ' + p(R, 0) + ' M ' + p(r, 0) + ' A ' + r + ' ' + r + ' 0 1 0 ' + p(r, Math.PI) + ' A ' + r + ' ' + r + ' 0 1 0 ' + p(r, 0) : 'M ' + p(R, a0) + ' A ' + R + ' ' + R + ' 0 ' + big + ' 1 ' + p(R, a1) + ' L ' + p(r, a1) + ' A ' + r + ' ' + r + ' 0 ' + big + ' 0 ' + p(r, a0) + ' Z';
    g += '<path d="' + d + '" fill="' + PALETTE[i % PALETTE.length] + '" fill-rule="evenodd" data-tip="' + esc(catIcon(e[0]) + ' ' + e[0] + ': ' + $0(e[1]) + ' (' + Math.round(f * 100) + '%)') + '"' + (e[0] !== 'Otras' ? ' data-act="filterCat" data-k="' + esc(e[0]) + '"' : '') + '/>';
    a0 = a1;
  });
  g += '<text x="90" y="86" text-anchor="middle" class="dn-l">Gastos</text><text x="90" y="104" text-anchor="middle" class="dn-v">' + (total >= 1e6 ? nf2.format(total / 1e6).replace(/,?0+$/, '') + 'M' : nf0.format(Math.round(total / 1000)) + 'k') + '</text></svg>';
  var leg = '<div class="dlegend">' + top.map(function (e, i) { return '<button class="dl" ' + (e[0] !== 'Otras' ? 'data-act="filterCat" data-k="' + esc(e[0]) + '"' : '') + '><i style="background:' + PALETTE[i % PALETTE.length] + '"></i><span>' + catIcon(e[0]) + ' ' + esc(e[0]) + '</span><b>' + $0(e[1]) + '</b><em>' + Math.round(e[1] / total * 100) + '%</em></button>'; }).join('') + '</div>';
  return '<div class="donutwrap">' + g + leg + '</div>';
}
function hbars(rows, total) {
  return rows.map(function (r) { var w = total > 0 ? Math.max(2, r[1] / total * 100) : 0; return '<div class="hb"><span class="hb-l">' + r[0] + '</span><span class="hb-t"><i style="width:' + w + '%"></i></span><b>' + $0(r[1]) + '</b></div>'; }).join('');
}

/* ============================ Inicio (dashboard) ============================ */
function banners() {
  var h = '';
  if (!isConfigured()) h += '<div class="banner warn">📴 <div><b>Modo local:</b> tus datos quedan solo en este dispositivo. Conectá Google Drive para verlos desde el celular y la PC, con copias automáticas.</div><button class="btn pri" data-act="tab" data-k="ajustes">Conectar Drive</button></div>';
  else if (SYNC.status === 'login') h += '<div class="banner bad">🔑 <div>Iniciá sesión con Google para sincronizar.' + (SYNC.queue.length ? ' Hay ' + SYNC.queue.length + ' cambios esperando.' : '') + '</div><button class="btn pri" data-act="tab" data-k="ajustes">Iniciar sesión</button></div>';
  if (lsGet('finanzas_chini_v1') && !DB.cfg.migradoV1) h += '<div class="banner">🗂️ <div>Encontré datos de la versión anterior en este navegador.</div><button class="btn pri" data-act="migrar">Traerlos</button><button class="btn" data-act="noMigrar">Ignorar</button></div>';
  recurrentesPendientes().forEach(function (p) {
    h += '<div class="banner">' + catIcon(p.rec.categoria) + ' <div>¿Ya cobraste <b>' + esc(p.rec.nombre) + '</b> de ' + monthLabel(p.mes) + ' (' + $0(p.rec.monto) + ')?</div><button class="btn pri" data-act="recOk" data-k="' + p.rec.id + '">Sí, registrar</button><button class="btn" data-act="recOtro" data-k="' + p.rec.id + '">Otro monto</button><button class="btn ghost" data-act="recSkip" data-k="' + p.opId + '">Todavía no</button></div>';
  });
  var np = DB.pend.filter(function (p) { return p.estado === 'nuevo'; }).length;
  if (np) h += '<div class="banner">📥 <div>Hay <b>' + np + '</b> archivo(s) nuevo(s) en tu carpeta <i>Entrada</i> de Drive.</div><button class="btn pri" data-act="tab" data-k="importar">Revisar</button></div>';
  var S = summarize(UI.month);
  if (S.pend) h += '<div class="banner">❓ <div>' + S.pend + ' movimiento(s) sin clasificar en ' + monthLabel(UI.month) + '.</div><button class="btn" data-act="verSinClasificar">Clasificar</button></div>';
  return h;
}
function kpi(icon, label, value, sub, cls, act) { return '<div class="card kpi' + (act ? ' click" data-act="' + act : '') + '"><div class="kh"><span class="ki">' + icon + '</span><span class="l">' + label + '</span></div><div class="v ' + (cls || '') + '">' + value + '</div><div class="s">' + (sub || '&nbsp;') + '</div></div>'; }
function viewInicio() {
  var k = UI.month, S = summarize(k), pk = prevMonthWithData(k), P = pk ? summarize(pk) : null, D = disponible(), TP = tarjetaAPagar(k);
  var keys = monthKeys().filter(function (x) { return x <= k; }).slice(-12); if (keys.indexOf(k) < 0) keys.push(k);
  var vs = function (a, b, inv) { if (!P) return ''; var p = pct(a, b); if (!p) return ''; var up = a > b; return '<span class="' + ((inv ? !up : up) ? 'pos' : 'neg') + '">' + p + '</span> vs ' + monthShort(P.mes); };
  var h = banners();
  h += '<div class="card quick"><form data-form="quickChat" class="row"><input type="text" id="quickIn" placeholder="Contale al asistente: «gasté $18.500 en una cena» o «¿cuánto gasté este mes?»" autocomplete="off" style="flex:1"><button class="btn pri">Enviar</button></form></div>';
  h += '<div class="grid g4">' +
    kpi('⬆️', 'Ingresos del mes', $0(S.ingresos), vs(S.ingresos, P && P.ingresos), 'pos', 'verIngresos') +
    kpi('⬇️', 'Gastos del mes', $0(S.gastos), vs(S.gastos, P && P.gastos, true), 'neg', 'verGastos') +
    kpi('⚖️', 'Balance mensual', $0(S.balance), P ? 'Mes anterior ' + $0(P.balance) : '', S.balance < 0 ? 'neg' : 'pos') +
    kpi('🐷', 'Ahorro', S.ingresos > 0 ? Math.round(S.tasa * 100) + '%' : '—', DB.cfg.ahorroMeta ? 'Meta ' + $0(DB.cfg.ahorroMeta) + (S.balance >= DB.cfg.ahorroMeta ? ' ✓' : '') : (P ? 'Mes anterior ' + Math.round(P.tasa * 100) + '%' : ''), S.tasa < 0 ? 'neg' : 'pos') +
    kpi('💵', 'Dinero disponible', D.configurado ? $0(D.total) : '—', D.configurado ? 'Desde ' + fmtDate(D.desde) : '<a href="#" data-act="tab" data-k="ajustes">Cargá tu saldo de partida</a>', D.total < 0 ? 'neg' : '') +
    kpi('💳', 'Tarjeta de crédito', $0(S.tarjeta), TP.fuente === 'resumen' ? 'A pagar ' + $0(TP.total) : Object.keys(S.porCuenta).length > 1 ? Object.keys(S.porCuenta).map(function (c) { return esc(c) + ' ' + $0(S.porCuenta[c]); }).join(' · ') : 'Consumos del mes', '', 'verTarjeta') +
    kpi('📲', 'Mercado Pago', $0(S.mp), 'Gastos pagados con MP', '', 'verMP') +
    kpi('🤲', 'Préstamos y deudas', $0(S.prestamos + S.deudas), (S.prestamos ? 'Prestado ' + $0(-S.prestamos) : '') + (S.deudas ? ' · Deuda ' + $0(S.deudas) : '') || 'Sin movimientos', '', 'verPrestamos') + '</div>';
  var catRows = Object.keys(S.porCat).map(function (c) { return [c, S.porCat[c]]; }).sort(function (a, b) { return b[1] - a[1]; });
  h += '<div class="grid g2"><div class="card"><h2>Evolución de ingresos y gastos</h2>' + chartEvolucion(keys) + '</div><div class="card"><h2>Gastos por categoría — ' + monthLabel(k) + '</h2>' + chartDonut(catRows, S.gastos) + '</div></div>';
  var medios = Object.keys(S.porMedio).map(function (m) { return [(MEDIO_ICON[m] || '·') + ' ' + esc(m), S.porMedio[m]]; }).sort(function (a, b) { return b[1] - a[1]; });
  var top = S.movs.filter(function (m) { return m.tipo === 'Gasto'; }).sort(function (a, b) { return a.monto - b.monto; }).slice(0, 6);
  h += '<div class="grid g3"><div class="card"><h2>Porcentaje de ahorro</h2>' + chartAhorro(keys) + '</div>' +
    '<div class="card"><h2>Gastos por medio de pago</h2>' + (medios.length ? hbars(medios, S.gastos) : '<p class="mut small">Sin gastos.</p>') + '</div>' +
    '<div class="card"><h2>Mayores gastos</h2>' + (top.length ? '<ul class="mlist">' + top.map(movLi).join('') + '</ul>' : '<p class="mut small">Sin gastos.</p>') + '</div></div>';
  if (P) {
    var all = {}; Object.keys(S.porCat).concat(Object.keys(P.porCat)).forEach(function (c) { all[c] = 1; });
    var cmp = Object.keys(all).map(function (c) { return [c, S.porCat[c] || 0, P.porCat[c] || 0]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    h += '<div class="card"><h2>Comparación con ' + monthLabel(P.mes) + '</h2><div class="tablewrap"><table><thead><tr><th>Categoría</th><th class="n">' + monthShort(k) + '</th><th class="n">' + monthShort(P.mes) + '</th><th class="n">Diferencia</th></tr></thead><tbody>' +
      '<tr class="tot"><td>Ingresos</td><td class="n">' + $0(S.ingresos) + '</td><td class="n">' + $0(P.ingresos) + '</td><td class="n ' + (S.ingresos >= P.ingresos ? 'pos' : 'neg') + '">' + $0(S.ingresos - P.ingresos) + '</td></tr>' +
      '<tr class="tot"><td>Gastos</td><td class="n">' + $0(S.gastos) + '</td><td class="n">' + $0(P.gastos) + '</td><td class="n ' + (S.gastos <= P.gastos ? 'pos' : 'neg') + '">' + $0(S.gastos - P.gastos) + '</td></tr>' +
      cmp.map(function (r) { var d = r[1] - r[2]; return '<tr><td>' + catIcon(r[0]) + ' ' + esc(r[0]) + '</td><td class="n">' + $0(r[1]) + '</td><td class="n">' + $0(r[2]) + '</td><td class="n ' + (d > 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '+' : '') + $0(d) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  var u = inusuales(k), rec = recomendaciones(k);
  if (u.length || rec.length) h += '<div class="grid g2">' + (u.length ? '<div class="card"><h2>⚠️ Gastos inusuales</h2><ul class="tips">' + u.map(function (x) { return '<li>' + esc(x.texto) + '</li>'; }).join('') + '</ul></div>' : '') + (rec.length ? '<div class="card"><h2>💡 Recomendaciones</h2><ul class="tips">' + rec.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') + '</div>';
  if (!S.n && !monthKeys().length) h += '<div class="card"><h2>Primeros pasos</h2><ol class="steps"><li>Conectá tu Google Drive en <b>Ajustes</b> (una sola vez).</li><li>Subí tus resúmenes de tarjeta y de Mercado Pago en <b>Importar</b>, o dejalos en la carpeta <i>Entrada</i> de Drive.</li><li>Configurá tu sueldo en <b>Ingresos</b>.</li><li>Contale tus gastos al <b>Asistente</b>: «hoy gasté $35.000 en combustible».</li></ol></div>';
  return h;
}
function movLi(m) { return '<li data-act="openMov" data-k="' + m.id + '"><span class="mi">' + catIcon(m.categoria) + '</span><span class="md"><b>' + esc(m.descripcion) + '</b><small>' + fmtDate(m.fecha) + ' · ' + esc(m.categoria) + (m.medio ? ' · ' + MEDIO_ICON[m.medio] + ' ' + esc(m.medio) : '') + '</small></span><span class="n ' + (m.monto < 0 ? 'neg' : 'pos') + '">' + $0(m.monto) + '</span></li>'; }

/* ============================ Asistente ============================ */
var SUGERENCIAS = ['¿Cuánto gasté este mes?', '¿Cuánto llevo gastado en comida?', '¿Cuánto gasté con Mercado Pago?', '¿Cuánto debo pagar de tarjeta?', '¿Cuáles fueron mis mayores gastos?', '¿En qué categoría estoy gastando más?', '¿Cuánto ahorré respecto al mes anterior?', '¿Cuánto dinero me queda disponible?', '¿Hay gastos inusuales?', 'Dame recomendaciones'];
function viewAsistente() {
  var h = '<div class="card chat"><div class="chat-h"><h2>💬 Asistente financiero</h2><span class="small mut">' + (canUseAI() ? '🤖 IA activa (Gemini)' : isConfigured() ? 'IA: conectá Drive para activarla' : 'Intérprete local (sin IA)') + '</span><button class="btn ghost small" data-act="chatClear">Limpiar</button></div><div id="chatLog" class="chat-log">';
  if (!UI.chat.length) h += '<div class="msg bot"><div class="bubble">¡Hola! Podés escribirme cosas como:<br>• «Hoy cobré mi sueldo de $1.500.000»<br>• «Acabo de gastar $18.500 en una cena»<br>• «Compré ropa por $75.000 con tarjeta de crédito»<br>• «Le presté $50.000 a un amigo»<br>• «El gasto anterior no fue de $18.500, fue de $16.500»<br>O preguntarme por tus números. Respondo solo con lo que está registrado.</div></div>';
  UI.chat.forEach(function (m) { h += '<div class="msg ' + m.who + '"><div class="bubble">' + (m.html || esc(m.text).replace(/\n/g, '<br>')) + '</div></div>'; });
  h += '</div><div class="chips sug">' + SUGERENCIAS.map(function (s) { return '<button class="chip" data-act="chatSug" data-k="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div><form data-form="chat" class="row chat-in"><input type="text" id="chatIn" placeholder="Escribí un gasto, un ingreso o una pregunta…" autocomplete="off" style="flex:1" enterkeyhint="send"><button class="btn pri">Enviar</button></form></div>';
  return h;
}
function botSay(html, isHtml) { UI.chat.push({ who: 'bot', html: isHtml ? html : esc(html).replace(/\n/g, '<br>') }); }
function movSummaryHtml(m) { return catIcon(m.categoria) + ' <b>' + esc(m.descripcion) + '</b> — <b class="' + (m.monto < 0 ? 'neg' : 'pos') + '">' + $0(m.monto) + '</b> · ' + m.tipo + ' · ' + esc(m.categoria) + (m.medio ? ' · ' + MEDIO_ICON[m.medio] + ' ' + esc(m.medio) : '') + ' · ' + fmtDate(m.fecha) + (m.cuota ? ' · cuota ' + m.cuota : ''); }
function quickCats(ids, tipo) { return '<div class="chips">' + cats(tipo === 'Ingreso' ? 'Ingreso' : 'Gasto').slice(0, 12).map(function (c) { return '<button class="chip" data-act="chatSetCat" data-k="' + ids + '" data-v="' + esc(c.nombre) + '">' + c.icono + ' ' + esc(c.nombre) + '</button>'; }).join('') + '</div>'; }
function findCorrectionTarget(c) {
  if (c && c.id) { var byId = movById(c.id); if (byId) return byId; }
  var recent = activeMovs().slice().sort(function (a, b) { return String(b.creado || '').localeCompare(String(a.creado || '')); }).slice(0, 30);
  var pool = recent.filter(function (m) { return (!c.referencia || m.tipo === c.referencia); });
  if (c.montoAnterior) { var hit = pool.find(function (m) { return Math.abs(Math.abs(m.monto) - c.montoAnterior) < 1; }); if (hit) return hit; }
  var last = UI.lastChat.length ? movById(UI.lastChat[0]) : null;
  if (last && last.estado === 'activo' && (!c.referencia || last.tipo === c.referencia)) return last;
  return pool.find(function (m) { return m.origen === 'chat'; }) || null;
}
async function sendChat(text) {
  text = String(text || '').trim(); if (!text) return;
  UI.chat.push({ who: 'me', text: text }); UI.chat.push({ who: 'bot', html: '<span class="typing">Pensando…</span>', tmp: true }); if (UI.tab === 'asistente') render();
  try { await handleChat(text); } catch (e) { console.error(e); botSay('No pude procesar eso: ' + e.message); }
  UI.chat = UI.chat.filter(function (m) { return !m.tmp; }); saveUI();
  if (UI.tab !== 'asistente') { var last = UI.chat[UI.chat.length - 1]; toast(last ? last.html.replace(/<[^>]+>/g, '').slice(0, 160) : 'Listo'); }
  render();
}
async function handleChat(text) {
  var intent = null;
  // ¿Estábamos esperando un dato?
  if (UI.chatCtx && UI.chatCtx.mov) {
    var mv = UI.chatCtx.mov, t = norm(text);
    if (UI.chatCtx.faltan.indexOf('monto') >= 0) { var a = parseAmountText(text); if (a) mv.monto = a; }
    if (UI.chatCtx.faltan.indexOf('tipo') >= 0) { if (/ingres|cobr|entr/.test(t)) { mv.tipo = 'Ingreso'; mv.sentido = 'entrada'; } else if (/gast|pag|sal/.test(t)) { mv.tipo = 'Gasto'; mv.sentido = 'salida'; } }
    if (/^(no|cancel|olvidalo|dejalo)/.test(t)) { UI.chatCtx = null; botSay('Listo, no registro nada.'); return; }
    intent = { accion: 'registrar', movimiento: mv, faltan: [] };
    if (!mv.monto) intent.faltan.push('monto'); if (!mv.tipo) intent.faltan.push('tipo');
    if (intent.faltan.length) intent.pregunta = !mv.monto ? 'Necesito el importe. ¿De cuánto fue?' : '¿Fue un ingreso o un gasto?';
  }
  if (!intent) {
    intent = interpretLocal(text, { mes: todayIso().slice(0, 7) });
    if (intent.accion === 'consultar' && intent.consulta.mes === todayIso().slice(0, 7) && !/este mes|hoy/.test(norm(text))) intent.consulta.mes = UI.month;
    var needAI = intent.accion === 'conversar' || (intent.accion === 'registrar' && intent.movimiento && (intent.movimiento.categoria === 'Sin clasificar' || !intent.movimiento.tipo)) || (intent.accion === 'consultar' && intent.consulta.metrica === 'libre');
    if (needAI && canUseAI()) {
      try {
        var recientes = activeMovs().slice().sort(function (a, b) { return String(b.creado || '').localeCompare(String(a.creado || '')); }).slice(0, 8).map(function (m) { return { id: m.id, fecha: m.fecha, descripcion: m.descripcion, monto: m.monto, tipo: m.tipo, categoria: m.categoria, medio: m.medio }; });
        var ai = await aiCall({ task: 'chat', mensaje: text, recientes: recientes });
        if (ai && ai.accion) {
          if (ai.accion === 'registrar' && ai.movimiento && intent.movimiento) {   // los números los confirma el intérprete local si los encontró
            if (intent.movimiento.monto && !ai.movimiento.monto) ai.movimiento.monto = intent.movimiento.monto;
            ai.faltan = (ai.faltan || []).filter(function (f) { return !(f === 'monto' && ai.movimiento.monto); });
          }
          if (ai.accion !== 'conversar' || intent.accion === 'conversar') intent = ai;
        }
      } catch (e) { console.warn('IA no disponible', e); }
    }
  }
  if (intent.accion === 'registrar') {
    var mov = intent.movimiento || {};
    if ((intent.faltan && intent.faltan.length) || !mov.monto || !mov.tipo) {
      var fal = intent.faltan && intent.faltan.length ? intent.faltan : (!mov.monto ? ['monto'] : ['tipo']);
      UI.chatCtx = { mov: mov, faltan: fal }; botSay(intent.pregunta || (fal[0] === 'monto' ? '¿De cuánto fue?' : '¿Fue un ingreso o un gasto?')); return;
    }
    UI.chatCtx = null;
    var rows = movsFromIntent(mov, 'chat'); rows.forEach(putMov); UI.lastChat = rows.map(function (r) { return r.id; });
    var m0 = rows[0], ids = UI.lastChat.join(',');
    var html = '✅ Registré ' + (rows.length > 1 ? rows.length + ' cuotas: ' : '') + movSummaryHtml(m0) + (rows.length > 1 ? ' (de ' + monthLabel(rows[0].mes) + ' a ' + monthLabel(rows[rows.length - 1].mes) + ')' : '') +
      '<div class="row mt"><button class="btn small" data-act="chatUndo" data-k="' + ids + '">Deshacer</button><button class="btn small" data-act="openMov" data-k="' + m0.id + '">Editar</button></div>';
    if (m0.categoria === 'Sin clasificar') html += '<div class="mt small">¿En qué categoría lo pongo?</div>' + quickCats(ids, m0.tipo);
    if (!mov.medio && m0.tipo === 'Gasto') html += '<div class="mt small mut">No me dijiste el medio de pago. Si querés: ' + ['Efectivo', 'Débito', 'Mercado Pago', 'Tarjeta de crédito'].map(function (md) { return '<button class="chip" data-act="chatSetMedio" data-k="' + ids + '" data-v="' + md + '">' + MEDIO_ICON[md] + ' ' + md + '</button>'; }).join(' ') + '</div>';
    botSay(html, true); return;
  }
  if (intent.accion === 'corregir') {
    var c = intent.correccion || {}, target = findCorrectionTarget(c), ch = c.cambios || {};
    if (!target) { botSay('No encontré el movimiento a corregir. Abrilo en Movimientos y editalo ahí.'); return; }
    if (!Object.keys(ch).some(function (k) { return ch[k] !== '' && ch[k] != null; })) { botSay('¿Qué dato querés cambiar de «' + target.descripcion + '»?'); return; }
    var antes = movSummaryHtml(target), group = DB.movs.filter(function (m) { return m.estado === 'activo' && m.creado === target.creado && m.descripcion === target.descripcion && m.cuota && target.cuota; });
    (group.length ? group : [target]).forEach(function (m) {
      if (ch.monto) { var sign = m.monto < 0 ? -1 : 1, n = group.length || 1; m.monto = sign * Math.abs(ch.monto) / n; }
      if (ch.descripcion) m.descripcion = ch.descripcion;
      if (ch.categoria) { m.categoria = catByName(ch.categoria) ? ch.categoria : ensureCat(ch.categoria, m.tipo); m.flag = defaultFlag(m.categoria, m.tipo, m.cuota); }
      if (ch.fecha) m.fecha = ch.fecha;
      if (ch.medio && MEDIOS.indexOf(ch.medio) >= 0) m.medio = ch.medio;
      m.nota = (m.nota ? m.nota + ' · ' : '') + 'Corregido por el asistente'; putMov(m);
    });
    botSay('✏️ Corregí el movimiento (sin crear otro):<br><s>' + antes + '</s><br>' + movSummaryHtml(movById(target.id)), true); return;
  }
  if (intent.accion === 'eliminar') {
    var tg = findCorrectionTarget(intent.correccion || {});
    if (!tg) { botSay('No encontré cuál borrar.'); return; }
    botSay('¿Borro este movimiento? ' + movSummaryHtml(tg) + '<div class="row mt"><button class="btn danger small" data-act="chatUndo" data-k="' + tg.id + '">Sí, borrar</button></div>', true); return;
  }
  if (intent.accion === 'consultar') {
    var q = intent.consulta || {}; if (!q.mes) q.mes = UI.month;
    var ans = answerQuery(q, UI.month);
    if ((q.metrica === 'recomendaciones' || q.metrica === 'inusuales' || !ans) && canUseAI()) {
      try { var r = await aiCall({ task: 'analyze', pregunta: text, datos: analysisData(q.mes) }); if (r && r.texto) ans = (ans ? ans + '\n\n' : '') + '🤖 ' + r.texto.trim(); } catch (e) { console.warn(e); }
    }
    botSay(ans || 'Con los datos registrados no puedo responder eso. Probá con: «¿cuánto gasté en supermercado?» o «¿cuáles fueron mis mayores gastos?»'); return;
  }
  botSay(intent.respuesta || 'Puedo registrar gastos e ingresos («gasté $5.000 en café con débito») y responder sobre tus números («¿cuánto gasté este mes?»).');
}

/* ============================ Importar ============================ */
function viewImportar() {
  var h = '<div class="card"><h2>📥 Importar resúmenes y comprobantes</h2><label class="drop" data-drop="1"><input type="file" multiple accept=".pdf,.xlsx,.xls,.csv,image/*" data-file="import"><b>Tocá para elegir archivos o arrastralos acá</b><br><span class="small">Resúmenes de tarjeta (Visa, American Express y otros bancos), Mercado Pago, extractos, fotos de tickets y capturas. PDF, Excel, CSV o imagen.</span></label>' +
    '<p class="small mut">Antes de guardar te muestro lo que encontré. Los duplicados, las transferencias propias y los pagos de tarjeta se detectan solos. ' + (isOnline() ? 'El archivo original se guarda en tu Drive.' : '<b>Conectá Drive para guardar el archivo original y leer fotos con IA.</b>') + '</p></div>';
  UI.imports.forEach(function (s) { h += importCard(s); });
  var pend = DB.pend.filter(function (p) { return p.estado === 'nuevo'; });
  h += '<div class="card"><div class="row"><h2 style="margin:0">📂 Carpeta «Entrada» de Drive</h2><span style="flex:1"></span>' + (isOnline() ? '<button class="btn small" data-act="checkInbox">Buscar archivos nuevos</button>' + (SYNC.links.entrada ? ' <a class="btn small" target="_blank" rel="noopener" href="' + esc(SYNC.links.entrada) + '">Abrir carpeta</a>' : '') : '') + '</div>' +
    '<p class="small mut">Desde el celular podés compartir un PDF o una foto a la carpeta <i>FINANZAS NIRAI TECH IA / Entrada</i> de Drive. Cada 10 minutos se detectan los archivos nuevos y aparecen acá para que confirmes.</p>' +
    (pend.length ? '<ul class="plist">' + pend.map(function (p) { return '<li><span>' + (/image/.test(p.mime) ? '🖼️' : /pdf/.test(p.mime) ? '📄' : '📊') + ' ' + esc(p.nombre) + ' <small class="mut">' + new Date(p.detectado).toLocaleString('es-AR') + '</small></span><span class="row"><button class="btn pri small" data-act="pendOpen" data-k="' + p.id + '">Revisar</button><button class="btn ghost small" data-act="pendSkip" data-k="' + p.id + '">Descartar</button></span></li>'; }).join('') + '</ul>' : '<p class="mut small">' + (isOnline() ? 'No hay archivos nuevos.' : 'Disponible al conectar Google Drive.') + '</p>') + '</div>';
  var imps = DB.imp.filter(function (i) { return i.estado !== 'borrado'; }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  h += '<div class="card"><h2>Historial de importaciones</h2>' + (imps.length ? '<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Archivo</th><th>Tipo</th><th>Mes</th><th class="n">Movs.</th><th>Control</th><th></th></tr></thead><tbody>' + imps.map(function (i) {
    var c = i.control, ok = c !== '' && c != null && Math.abs(Number(c)) < 0.05;
    return '<tr><td class="small">' + new Date(i.fecha).toLocaleDateString('es-AR') + '</td><td>' + (i.archivoId ? '<a target="_blank" rel="noopener" href="https://drive.google.com/file/d/' + esc(i.archivoId) + '/view">' + esc(i.archivo) + '</a>' : esc(i.archivo)) + '<br><small class="mut">' + esc(i.cuenta || '') + '</small></td><td>' + ({ tarjeta: '💳 Tarjeta', mercadopago: '📲 Mercado Pago', banco: '🏦 Banco', comprobante: '🧾 Comprobante' }[i.fuente] || esc(i.fuente)) + '</td><td>' + (i.mes ? monthShort(i.mes) : '') + '</td><td class="n">' + i.movimientos + '</td><td>' + (c === '' || c == null ? '<span class="pill warn">sin control</span>' : ok ? '<span class="pill ok">cuadra ✓</span>' : '<span class="pill bad">dif. ' + $2(Number(c)) + '</span>') + '</td><td><button class="btn ghost small danger" data-act="impUndo" data-k="' + i.id + '">Deshacer</button></td></tr>';
  }).join('') + '</tbody></table></div>' : '<p class="mut small">Todavía no importaste archivos.</p>') + '</div>';
  return h;
}
function importCard(s) {
  if (s.status === 'leyendo') return '<div class="card imp"><div class="row"><span class="spin"></span><b>' + esc(s.name) + '</b><span class="mut small">Leyendo…</span></div></div>';
  if (s.status === 'guardando') return '<div class="card imp"><div class="row"><span class="spin"></span><b>' + esc(s.name) + '</b><span class="mut small">Guardando…</span></div></div>';
  if (s.status === 'error') return '<div class="card imp"><div class="row"><b>' + esc(s.name) + '</b><span class="pill bad">No pude leerlo</span><span style="flex:1"></span><button class="btn ghost small" data-act="impClose" data-k="' + s.id + '">Cerrar</button></div><p class="small">' + esc(s.error) + '</p></div>';
  if (s.status === 'hecho') return '<div class="card imp"><div class="row"><b>' + esc(s.name) + '</b><span class="pill ok">✓ ' + s.result + '</span><span style="flex:1"></span><button class="btn ghost small" data-act="impClose" data-k="' + s.id + '">Cerrar</button></div></div>';
  var meta = s.parsed.meta || {}, st = previewStats(s.items), c = meta.control, okc = c != null && Math.abs(c) < 0.05;
  var h = '<div class="card imp"><div class="row"><h2 style="margin:0">' + esc(s.name) + '</h2><span class="pill">' + (s.via === 'ia' ? '🤖 Leído con IA' : s.via === 'generico' ? '🔎 Lectura genérica' : '📖 Lector exacto') + '</span>' + (c == null ? '<span class="pill warn">Sin control de cuadre</span>' : okc ? '<span class="pill ok">El total cuadra con el resumen ✓</span>' : '<span class="pill bad">No cuadra: diferencia ' + $2(c) + '</span>') + '</div>';
  h += '<div class="row mt"><div class="field"><label>Tipo de archivo</label><select data-imp="kind" data-k="' + s.id + '">' + opt(['tarjeta', 'mercadopago', 'banco', 'comprobante'], s.kind, ['💳 Resumen de tarjeta', '📲 Mercado Pago', '🏦 Banco / extracto', '🧾 Comprobante o ticket']) + '</select></div>' +
    '<div class="field"><label>' + (s.kind === 'tarjeta' ? 'Mes del resumen' : 'Mes (si es uno solo)') + '</label><input type="month" data-imp="mes" data-k="' + s.id + '" value="' + esc(s.mes || '') + '"></div>' +
    '<div class="field"><label>Cuenta / tarjeta</label><input type="text" data-imp="cuenta" data-k="' + s.id + '" value="' + esc(s.cuenta || '') + '"></div></div>';
  if (meta.aviso) h += '<div class="note">' + esc(meta.aviso) + '</div>';
  h += '<div class="stats"><span>🆕 <b>' + st.nuevos + '</b> nuevos</span><span>❓ <b>' + st.revisar + '</b> a revisar</span><span>♻️ <b>' + st.duplicados + '</b> duplicados (no se importan)</span><span>✍️ <b>' + st.manual + '</b> coinciden con cargas a mano (las reemplazan)</span><span>⬇️ Gastos <b>' + $0(st.gastos) + '</b></span><span>⬆️ Ingresos <b>' + $0(st.ingresos) + '</b></span>' + (st.internos ? '<span>🔁 Internos ' + $0(st.internos) + '</span>' : '') + (meta.total != null ? '<span>Total del resumen <b>' + $2(meta.total) + '</b></span>' : '') + '</div>';
  h += '<div class="tablewrap"><table class="pv"><thead><tr><th></th><th>Fecha</th><th>Descripción</th><th class="n">Monto</th><th>Tipo</th><th>Categoría</th><th>Estado</th></tr></thead><tbody>' + s.items.map(function (it, i) {
    var r = it.row, lab = { nuevo: '', duplicado: '<span class="pill">♻️ ya está</span>', manual: '<span class="pill warn" title="' + esc(it.match ? it.match.descripcion + ' ' + $0(it.match.monto) : '') + '">✍️ coincide con «' + esc(it.match ? it.match.descripcion : '') + '»</span>', revisar: '<span class="pill warn">revisar</span>' }[it.estado];
    return '<tr class="' + (it.incluir ? '' : 'off') + ' st-' + it.estado + '"><td><input type="checkbox" data-pv="incluir" data-k="' + s.id + '" data-i="' + i + '"' + (it.incluir ? ' checked' : '') + ' aria-label="Incluir"></td><td class="small">' + fmtDate(r.fecha) + '</td><td>' + esc(r.descripcion) + (r.cuota ? ' <span class="pill warn">cuota ' + r.cuota + '</span>' : '') + (r.usd ? ' <span class="pill warn">US$ ' + nf2.format(r.usd) + '</span>' : '') + '</td><td class="n ' + (r.monto < 0 ? 'neg' : 'pos') + '">' + (r.monto ? $2(r.monto) : '') + '</td><td><select data-pv="tipo" data-k="' + s.id + '" data-i="' + i + '">' + opt(TIPOS, r.tipo) + '</select></td><td><select data-pv="categoria" data-k="' + s.id + '" data-i="' + i + '">' + catOptions(r.categoria, r.tipo) + '</select></td><td>' + lab + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  h += '<div class="row mt"><button class="btn pri" data-act="impOk" data-k="' + s.id + '">Confirmar importación (' + st.incluidos + ')</button><button class="btn" data-act="impNo" data-k="' + s.id + '">Descartar</button>' + (st.revisar ? '<span class="small warnt">Hay ' + st.revisar + ' movimiento(s) que conviene revisar: elegí su categoría o destildalos.</span>' : '') + '</div></div>';
  return h;
}
function rebuildSession(s) {
  var rows = parsedToRows(s.parsed, s.kind);
  rows.forEach(function (r) { if (s.kind === 'tarjeta' && s.mes) r.mes = s.mes; if (s.cuenta) r.cuenta = s.cuenta; });
  s.items = buildPreview(rows);
}
async function handleFiles(files, extra) {
  UI.tab = 'importar';
  for (var i = 0; i < files.length; i++) {
    var f = files[i], s = { id: uid(), name: f.name, file: f, status: 'leyendo', pend: extra && extra.pend };
    UI.imports.unshift(s); render();
    try {
      var r = await analyzeFile(f, { ai: canUseAI() ? aiCall : null, preExtracted: extra && extra.pre });
      s.kind = r.kind; s.parsed = r.parsed; s.via = r.via; s.mes = r.parsed.meta.monthKey || ''; s.cuenta = (r.parsed.meta.card && r.parsed.meta.card.nombre) || r.parsed.meta.cuenta || '';
      if (s.kind === 'tarjeta' && !s.mes) s.mes = UI.month;
      rebuildSession(s); s.status = 'preview';
    } catch (e) { console.error(e); s.status = 'error'; s.error = e.message || String(e); }
    UI.refresh(); if (UI.busy()) render();
  }
}
async function confirmImport(s) {
  s.status = 'guardando'; render();
  try {
    var meta = s.parsed.meta || {}, archivoId = '';
    var incl = s.items.filter(function (it) { return it.incluir; }).map(function (it) { return it.row; });
    materializeCats(incl);
    if (isOnline()) {
      var kindF = s.kind === 'comprobante' ? 'comprobante' : 'resumen';
      try {
        if (s.pend) { var p = DB.pend.find(function (x) { return x.id === s.pend; }); archivoId = p.archivoId; await api('moveFile', { fileId: archivoId, kind: kindF }); }
        else { var up = await api('uploadFile', { name: s.name, mime: s.file.type || 'application/octet-stream', base64: await fileToBase64(s.file), kind: kindF }); archivoId = up.fileId; }
      } catch (e) { toast('No pude guardar el original en Drive (' + e.message + '). Los movimientos se guardan igual.', true); }
    }
    var imp = { fuente: s.kind, mes: s.mes || '', cuenta: s.cuenta || '', archivo: s.name, archivoId: archivoId, total: meta.total != null ? meta.total : '', control: meta.control != null ? meta.control : '', meta: { pagos: meta.pagos || [], cuotasProx: meta.cuotasProx || [], cierre: meta.cierre || '', vencimiento: meta.vencimiento || '', saldoAnterior: meta.saldoAnterior, inicial: meta.inicial, final: meta.final, via: s.via, totalUsd: meta.totalUsd || 0 } };
    var res = commitImport(imp, s.items);
    s.items.forEach(function (it) { if (it.incluir && it.row._edited) learnFrom(movById(it.row.id) || it.row); });
    if (s.pend) { var pp = DB.pend.find(function (x) { return x.id === s.pend; }); if (pp) { pp.estado = 'importado'; putPend(pp); } }
    s.status = 'hecho'; s.result = res.importados + ' movimientos importados' + (res.conciliados ? ' · ' + res.conciliados + ' pagos de tarjeta conciliados' : '') + (!archivoId && !isOnline() ? ' (original no guardado: sin conexión)' : '');
    if (s.mes) UI.month = s.mes;
  } catch (e) { console.error(e); s.status = 'preview'; toast('No pude importar: ' + e.message, true); }
  render();
}
function base64ToFile(b64, name, mime) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type: mime }); }
async function openPending(id) {
  var p = DB.pend.find(function (x) { return x.id === id; }); if (!p) return;
  var pre = null; try { pre = p.resultado ? JSON.parse(p.resultado) : null; if (pre && pre.error) pre = null; } catch (e) { }
  try {
    toast('Descargando ' + p.nombre + ' desde Drive…');
    var f = await api('getFile', { fileId: p.archivoId });
    await handleFiles([base64ToFile(f.base64, f.name, f.mime)], { pend: p.id, pre: /image/.test(p.mime) ? pre : null });
  } catch (e) { toast('No pude abrir el archivo: ' + e.message, true); }
}

/* ============================ Movimientos ============================ */
function filteredMovs() {
  var f = UI.f, q = norm(f.q);
  return activeMovs().filter(function (m) {
    if (f.anio && String(m.mes).slice(0, 4) !== f.anio) return false;
    if (f.mes && m.mes !== f.mes) return false;
    if (f.tipo && m.tipo !== f.tipo) return false;
    if (f.cat && m.categoria !== f.cat) return false;
    if (f.medio && (m.medio || 'Sin indicar') !== f.medio) return false;
    if (q && norm(m.descripcion + ' ' + m.categoria + ' ' + m.cuenta + ' ' + m.nota).indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)) || String(b.creado).localeCompare(String(a.creado)); });
}
function viewMovimientos() {
  var f = UI.f, years = {}; monthKeys().forEach(function (k) { years[k.slice(0, 4)] = 1; });
  var list = filteredMovs(), ing = 0, gas = 0; list.forEach(function (m) { if (m.tipo === 'Ingreso') ing += m.monto; else if (m.tipo === 'Gasto') gas += -m.monto; });
  var h = '<div class="card"><div class="row"><h2 style="margin:0">📋 Movimientos</h2><span style="flex:1"></span><button class="btn pri" data-act="newMov">➕ Agregar movimiento</button></div>' +
    '<div class="filters"><div class="field"><label>Año</label><select data-flt="anio"><option value="">Todos</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (y === f.anio ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Mes</label><select data-flt="mes"><option value="">Todos</option>' + monthKeys().slice().reverse().map(function (k) { return '<option value="' + k + '"' + (k === f.mes ? ' selected' : '') + '>' + monthLabel(k) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Tipo</label><select data-flt="tipo"><option value="">Todos</option>' + TIPOS.map(function (t) { return '<option' + (t === f.tipo ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Categoría</label><select data-flt="cat"><option value="">Todas</option>' + cats().map(function (c) { return '<option value="' + esc(c.nombre) + '"' + (c.nombre === f.cat ? ' selected' : '') + '>' + c.icono + ' ' + esc(c.nombre) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><label>Medio de pago</label><select data-flt="medio"><option value="">Todos</option>' + MEDIOS.filter(Boolean).concat(['Sin indicar']).map(function (m) { return '<option' + (m === f.medio ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
    '<div class="field" style="flex:1;min-width:160px"><label>Buscar</label><input type="search" data-flt="q" value="' + esc(f.q) + '" placeholder="Comercio, persona, nota…"></div>' +
    '<div class="field"><label>&nbsp;</label><button class="btn ghost" data-act="fltClear">Limpiar</button></div></div>' +
    '<div class="chips mt"><button class="chip' + (f.tipo === 'Ingreso' ? ' on' : '') + '" data-act="fltTipo" data-k="Ingreso">⬆️ Ingresos</button><button class="chip' + (f.tipo === 'Gasto' ? ' on' : '') + '" data-act="fltTipo" data-k="Gasto">⬇️ Gastos</button><button class="chip' + (f.tipo === 'Préstamo' ? ' on' : '') + '" data-act="fltTipo" data-k="Préstamo">🤲 Préstamos</button><button class="chip' + (f.tipo === 'Deuda' ? ' on' : '') + '" data-act="fltTipo" data-k="Deuda">📉 Deudas</button><button class="chip' + (f.tipo === 'Interno' ? ' on' : '') + '" data-act="fltTipo" data-k="Interno">🔁 Internos</button><button class="chip' + (f.cat === 'Sin clasificar' ? ' on' : '') + '" data-act="verSinClasificar">❓ Sin clasificar</button></div>' +
    '<p class="small mut">' + list.length + ' movimientos · Ingresos ' + $0(ing) + ' · Gastos ' + $0(gas) + ' · Balance ' + $0(ing - gas) + '</p>';
  var shown = list.slice(0, UI.fLimit || 300);
  h += '<div class="tablewrap tall"><table class="movs"><thead><tr><th></th><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Medio</th><th class="n">Monto</th></tr></thead><tbody>' + (shown.map(function (m) {
    return '<tr data-act="openMov" data-k="' + m.id + '" class="click"><td class="ic">' + catIcon(m.categoria) + '</td><td class="small nowrap">' + fmtDate(m.fecha) + '</td><td>' + esc(m.descripcion) + (m.cuota ? ' <span class="pill warn">' + m.cuota + '</span>' : '') + (m.tipo !== 'Gasto' && m.tipo !== 'Ingreso' ? ' <span class="pill">' + TIPO_ICON[m.tipo] + ' ' + m.tipo + '</span>' : '') + '<br><small class="mut">' + ({ chat: '💬 asistente', manual: '✍️ manual', archivo: '📄 ' + esc(m.cuenta || 'archivo'), automatico: '🔄 automático', migracion: '🗂️ versión anterior' }[m.origen] || esc(m.origen || '')) + '</small></td><td class="small">' + esc(m.categoria) + '</td><td class="small">' + (m.medio ? MEDIO_ICON[m.medio] + ' ' + esc(m.medio) : '<span class="mut">—</span>') + '</td><td class="n ' + (m.monto < 0 ? 'neg' : 'pos') + '">' + $2(m.monto) + '</td></tr>';
  }).join('') || '<tr><td colspan="6" class="mut">No hay movimientos con estos filtros.</td></tr>') + '</tbody></table></div>' + (list.length > shown.length ? '<button class="btn mt" data-act="moreMovs">Ver más (' + (list.length - shown.length) + ')</button>' : '') + '</div>';
  var pd = activeMovs().filter(function (m) { return m.tipo === 'Préstamo' || m.tipo === 'Deuda'; });
  if (pd.length) {
    var pr = pd.filter(function (m) { return m.tipo === 'Préstamo'; }).reduce(function (a, m) { return a + m.monto; }, 0), de = pd.filter(function (m) { return m.tipo === 'Deuda'; }).reduce(function (a, m) { return a + m.monto; }, 0);
    h += '<div class="card"><h2>🤲 Préstamos y deudas (saldo total)</h2><p>Te deben: <b>' + $0(Math.max(0, -pr)) + '</b>' + (pr > 0 ? ' (te devolvieron de más ' + $0(pr) + ')' : '') + ' · Debés: <b>' + $0(Math.max(0, de)) + '</b></p><p class="small mut">Los préstamos y deudas no cuentan como gastos ni ingresos del mes.</p></div>';
  }
  return h;
}
function movForm(m) {
  var isNew = !m.id, t = m.tipo || 'Gasto';
  return '<div class="modal-h"><h2>' + (isNew ? 'Nuevo movimiento' : catIcon(m.categoria) + ' ' + esc(m.descripcion)) + '</h2><button class="btn ghost" data-act="closeModal" aria-label="Cerrar">✕</button></div><form data-form="mov" class="mform">' +
    '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + esc(m.fecha || todayIso()) + '" required></div>' +
    '<div class="field"><label>Mes al que corresponde</label><input type="month" name="mes" value="' + esc(m.mes || (m.fecha || todayIso()).slice(0, 7)) + '"></div>' +
    '<div class="field wide"><label>Descripción</label><input type="text" name="descripcion" value="' + esc(m.descripcion || '') + '" required></div>' +
    '<div class="field"><label>Importe</label><input type="text" inputmode="decimal" name="monto" class="money" value="' + (m.monto ? nf2.format(Math.abs(m.monto)) : '') + '" required></div>' +
    '<div class="field"><label>Sentido</label><select name="sentido">' + opt(['salida', 'entrada'], m.monto > 0 ? 'entrada' : 'salida', ['⬇️ Sale dinero', '⬆️ Entra dinero']) + '</select></div>' +
    '<div class="field"><label>Tipo</label><select name="tipo" data-mf="tipo">' + opt(TIPOS, t) + '</select></div>' +
    '<div class="field"><label>Categoría</label><select name="categoria">' + catOptions(m.categoria || (t === 'Ingreso' ? 'Otros ingresos' : 'Sin clasificar'), t) + '</select></div>' +
    '<div class="field"><label>Fijo / variable</label><select name="flag">' + opt([''].concat(FLAGS), m.flag || '') + '</select></div>' +
    '<div class="field"><label>Medio de pago</label><select name="medio">' + opt(MEDIOS, m.medio || '', MEDIOS.map(function (x) { return x ? MEDIO_ICON[x] + ' ' + x : 'Sin indicar'; })) + '</select></div>' +
    '<div class="field"><label>Cuenta / tarjeta</label><input type="text" name="cuenta" value="' + esc(m.cuenta || '') + '"></div>' +
    '<div class="field"><label>Cuota</label><input type="text" name="cuota" value="' + esc(m.cuota || '') + '" placeholder="ej: 2/6"></div>' +
    '<div class="field wide"><label>Nota</label><input type="text" name="nota" value="' + esc(m.nota || '') + '"></div>' +
    (isNew ? '' : '<div class="wide small mut">Origen: ' + esc(m.origen || '') + (m.archivoId ? ' · <a target="_blank" rel="noopener" href="https://drive.google.com/file/d/' + esc(m.archivoId) + '/view">ver archivo original</a>' : '') + ' · Creado ' + (m.creado ? new Date(m.creado).toLocaleString('es-AR') : '') + ' · Modificado ' + (m.modificado ? new Date(m.modificado).toLocaleString('es-AR') : '') + '</div>') +
    '<div class="wide row"><button class="btn pri">Guardar</button>' + (isNew ? '' : '<button type="button" class="btn danger" data-act="delMov" data-k="' + m.id + '">Eliminar</button>') + '<button type="button" class="btn ghost" data-act="closeModal">Cancelar</button></div><input type="hidden" name="id" value="' + esc(m.id || '') + '"></form>';
}
function openModal(html) { UI.modal = true; var md = document.getElementById('modal'); md.innerHTML = '<div class="modal-b" role="dialog" aria-modal="true">' + html + '</div>'; md.className = 'show'; var i = md.querySelector('input:not([type=hidden])'); if (i && window.innerWidth > 700) i.focus(); }
function closeModal() { UI.modal = null; var md = document.getElementById('modal'); md.className = ''; md.innerHTML = ''; if (UI._dirty) render(); }
function saveMovForm(form) {
  var d = {}; new FormData(form).forEach(function (v, k) { d[k] = v; });
  var monto = Math.abs(parseNum(d.monto)); if (!monto || !d.descripcion) { toast('Completá descripción e importe', true); return; }
  var m = d.id ? Object.assign({}, movById(d.id)) : { id: uid(), origen: 'manual', estado: 'activo', usd: 0, opId: '', importId: '', archivoId: '' };
  var prevCat = m.categoria, prevTipo = m.tipo;
  m.fecha = d.fecha; m.mes = d.mes || d.fecha.slice(0, 7); m.descripcion = d.descripcion.trim(); m.monto = (d.sentido === 'entrada' ? 1 : -1) * monto;
  m.tipo = d.tipo; m.categoria = d.categoria === '__new__' ? 'Sin clasificar' : d.categoria; m.flag = m.tipo === 'Gasto' ? (d.flag || defaultFlag(m.categoria, m.tipo, d.cuota)) : '';
  m.medio = d.medio; m.cuenta = d.cuenta; m.cuota = d.cuota; m.nota = d.nota;
  putMov(m);
  var n = (prevCat !== m.categoria || prevTipo !== m.tipo) ? learnFrom(m) : 0;
  closeModal(); toast('Guardado' + (n ? ' · apliqué lo mismo a ' + n + ' movimiento(s) iguales' : '')); render();
}

/* ============================ Ingresos ============================ */
function viewIngresos() {
  var recs = DB.cfg.recurrentes || [], S = summarize(UI.month), ic = cats('Ingreso');
  var h = '<div class="card"><h2>💰 Sueldo e ingresos habituales</h2><p class="small mut">Configurá tu sueldo y otros cobros fijos. Si marcás <b>automático</b>, se registra solo el día de cobro. Si no, te pregunto en Inicio y <b>no se cuenta como cobrado hasta que confirmes</b>.</p>' +
    '<div class="tablewrap"><table><thead><tr><th>Concepto</th><th>Categoría</th><th class="n">Monto</th><th>Día de cobro</th><th>Medio</th><th>Automático</th><th></th></tr></thead><tbody>' +
    recs.map(function (r) { return '<tr><td><input type="text" data-rec="nombre" data-k="' + r.id + '" value="' + esc(r.nombre) + '"></td><td><select data-rec="categoria" data-k="' + r.id + '">' + ic.map(function (c) { return '<option value="' + esc(c.nombre) + '"' + (c.nombre === r.categoria ? ' selected' : '') + '>' + c.icono + ' ' + esc(c.nombre) + '</option>'; }).join('') + '</select></td><td><input type="text" class="money" inputmode="decimal" data-rec="monto" data-k="' + r.id + '" value="' + nf0.format(r.monto || 0) + '"></td><td><input type="number" min="1" max="31" data-rec="dia" data-k="' + r.id + '" value="' + (r.dia || 1) + '" style="width:70px"></td><td><select data-rec="medio" data-k="' + r.id + '">' + opt(MEDIOS, r.medio || '', MEDIOS.map(function (x) { return x || 'Sin indicar'; })) + '</select></td><td><label class="sw"><input type="checkbox" data-rec="auto" data-k="' + r.id + '"' + (r.auto ? ' checked' : '') + '> ' + (r.auto ? 'Sí' : 'No') + '</label></td><td><button class="btn ghost small danger" data-act="recDel" data-k="' + r.id + '">Quitar</button></td></tr>'; }).join('') +
    '</tbody></table></div><div class="row mt"><button class="btn" data-act="recAdd" data-k="Sueldo">➕ Sueldo</button><button class="btn" data-act="recAdd" data-k="Trabajos adicionales">➕ Trabajo independiente fijo</button><button class="btn" data-act="recAdd" data-k="Inversiones">➕ Renta / inversión</button><button class="btn" data-act="recAdd" data-k="Otros ingresos">➕ Otro</button></div></div>';
  h += '<div class="card"><h2>Registrar un ingreso</h2><form data-form="ingreso" class="row"><div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + (todayIso().slice(0, 7) === UI.month ? todayIso() : UI.month + '-01') + '"></div><div class="field" style="flex:1"><label>Concepto</label><input type="text" name="descripcion" placeholder="Ej: trabajo extra instalación" required></div><div class="field"><label>Monto</label><input type="text" class="money" inputmode="decimal" name="monto" required></div><div class="field"><label>Tipo de ingreso</label><select name="categoria">' + ic.map(function (c) { return '<option value="' + esc(c.nombre) + '">' + c.icono + ' ' + esc(c.nombre) + '</option>'; }).join('') + '</select></div><div class="field"><label>Medio</label><select name="medio">' + opt(MEDIOS, 'Transferencia', MEDIOS.map(function (x) { return x || 'Sin indicar'; })) + '</select></div><div class="field"><label>&nbsp;</label><button class="btn pri">Agregar</button></div></form></div>';
  var list = S.movs.filter(function (m) { return m.tipo === 'Ingreso'; }).sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  var porCat = Object.keys(S.porCatIng).map(function (c) { return [catIcon(c) + ' ' + esc(c), S.porCatIng[c]]; }).sort(function (a, b) { return b[1] - a[1]; });
  h += '<div class="grid g2"><div class="card"><h2>Ingresos de ' + monthLabel(UI.month) + ': ' + $0(S.ingresos) + '</h2>' + (porCat.length ? hbars(porCat, S.ingresos) : '<p class="mut small">Todavía no hay ingresos este mes.</p>') + '</div><div class="card"><h2>Detalle</h2>' + (list.length ? '<ul class="mlist">' + list.map(movLi).join('') + '</ul>' : '<p class="mut small">—</p>') + '</div></div>';
  var keys = monthKeys().slice(-12); if (keys.length > 1) h += '<div class="card"><h2>Evolución de ingresos</h2>' + hbars(keys.map(function (k) { return [monthShort(k), summarize(k).ingresos]; }), Math.max.apply(null, keys.map(function (k) { return summarize(k).ingresos; }).concat([1]))) + '</div>';
  return h;
}

/* ============================ Reportes ============================ */
function viewReportes() {
  var kind = UI.period, rows = periodRows(kind), k = UI.month, pr = projection(k);
  var h = '<div class="card"><div class="row"><h2 style="margin:0">📊 Resumen ' + { mes: 'mensual', trim: 'trimestral', sem: 'semestral', anio: 'anual' }[kind] + '</h2><span class="chips">' + [['mes', 'Mensual'], ['trim', 'Trimestral'], ['sem', 'Semestral'], ['anio', 'Anual']].map(function (p) { return '<button class="chip' + (kind === p[0] ? ' on' : '') + '" data-act="period" data-k="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</span><span style="flex:1"></span><button class="btn" data-act="xlsx">Descargar Excel</button>' + (SYNC.links.totales ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(SYNC.links.totales) + '">Planilla de totales en Drive</a>' : '') + '</div>' +
    (rows.length ? '<div class="tablewrap"><table><thead><tr><th>Período</th>' + (kind !== 'mes' ? '<th>Meses</th>' : '') + '<th class="n">Ingresos</th><th class="n">Gastos</th><th class="n">Tarjeta</th><th class="n">Mercado Pago</th><th class="n">Fijos</th><th class="n">Cuotas</th><th class="n">Variables</th><th class="n">Balance</th><th class="n">Ahorro</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + (kind === 'mes' ? '<a href="#" data-act="goMonth" data-k="' + r.key + '">' + r.g + '</a>' : r.g) + '</td>' + (kind !== 'mes' ? '<td class="small' + (r.n < r.per ? ' warnt' : '') + '">' + r.n + ' de ' + r.per + '</td>' : '') + '<td class="n">' + $0(r.ingresos) + '</td><td class="n">' + $0(r.gastos) + '</td><td class="n">' + $0(r.tarjeta) + '</td><td class="n">' + $0(r.mp) + '</td><td class="n">' + $0(r.fijo) + '</td><td class="n">' + $0(r.cuota) + '</td><td class="n">' + $0(r.variable) + '</td><td class="n ' + (r.balance < 0 ? 'neg' : 'pos') + '">' + $0(r.balance) + '</td><td class="n">' + Math.round(r.tasa * 100) + '%</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Todavía no hay datos.</p>') + '</div>';
  var S = summarize(k), tipoRows = FLAGS.map(function (f) { return [f, S.porFlag[f]]; }).filter(function (r) { return r[1] > 0.5; });
  h += '<div class="grid g2"><div class="card"><h2>Gastos por tipo — ' + monthLabel(k) + '</h2>' + (tipoRows.length ? hbars(tipoRows, S.gastos) : '<p class="mut small">Sin gastos.</p>') + '</div><div class="card"><h2>Por tarjeta / cuenta</h2>' + (Object.keys(S.porCuenta).length ? hbars(Object.keys(S.porCuenta).map(function (c) { return ['💳 ' + esc(c), S.porCuenta[c]]; }), S.tarjeta) : '<p class="mut small">Sin consumos con tarjeta.</p>') + '</div></div>';
  var inp = function (id, l, v) { return '<div class="field"><label>' + l + '</label><input type="text" class="money" inputmode="decimal" data-proj="' + id + '" value="' + nf0.format(Math.round(v)) + '"></div>'; };
  h += '<div class="card"><h2>🔮 Proyección de ' + monthLabel(addMonths(k, 1)) + '</h2><p class="small mut">Fijos del mes, cuotas que informan los resúmenes y variables promedio de los últimos ' + pr.nMeses + ' mes(es). Podés ajustar cualquier número.</p><div class="row">' + inp('sueldo', 'Sueldo', pr.sueldo) + inp('negocio', 'Ingreso neto del negocio', pr.negocio) + inp('otros', 'Otros ingresos', pr.otros) + inp('fijos', 'Gastos fijos', pr.fijos) + inp('cuotas', 'Cuotas comprometidas', pr.cuotas) + inp('variables', 'Variables esperados', pr.variables) + inp('unicos', 'Únicos esperados', pr.unicos) + '<button class="btn" data-act="resetProj">Volver a los calculados</button></div>' +
    '<div class="grid g4 mt">' + kpi('⬆️', 'Ingresos esperados', $0(pr.ingresos)) + kpi('⬇️', 'Gastos esperados', $0(pr.gastos)) + kpi('🐷', 'Ahorro proyectado', $0(pr.ahorroProy), 'Meta ' + $0(pr.ahorroObj), pr.ahorroProy < 0 ? 'neg' : 'pos') + kpi('🛒', 'Podés gastar en variables', $0(pr.presupVar), '≈ ' + $0(pr.presupVar / 4.33) + ' por semana', pr.presupVar < 0 ? 'neg' : 'pos') + '</div></div>';
  var I = pr.indep, mm = function (x) { return x === Infinity ? 'sin déficit' : nf2.format(x).replace(/,00$/, '') + ' meses'; };
  h += '<div class="card"><h2>🚀 Escenario: vivir de tu negocio</h2><div class="tablewrap"><table><thead><tr><th></th><th class="n">Solo fijos y cuotas</th><th class="n">Fijos + variables</th></tr></thead><tbody><tr><td>Gastos mensuales a cubrir</td><td class="n">' + $0(I.piso) + '</td><td class="n">' + $0(I.techo) + '</td></tr><tr><td>Ingreso neto del negocio</td><td class="n">' + $0(pr.negocio) + '</td><td class="n">' + $0(pr.negocio) + '</td></tr><tr><td>% que cubre el negocio</td><td class="n">' + Math.round(I.covPiso * 100) + '%</td><td class="n">' + Math.round(I.covTecho * 100) + '%</td></tr><tr><td>Déficit mensual</td><td class="n">' + $0(I.defPiso) + '</td><td class="n">' + $0(I.defTecho) + '</td></tr><tr><td>Meses que aguantás con tu colchón (' + $0(I.liq) + ')</td><td class="n">' + mm(I.mesesPiso) + '</td><td class="n">' + mm(I.mesesTecho) + '</td></tr></tbody></table></div><p class="small mut">Ingreso del negocio = categoría «Clientes (negocio)» menos gastos marcados «Negocio». Colchón = Mercado Pago reservado + dólares × tipo de cambio (Ajustes).</p></div>';
  return h;
}
function exportXlsx() {
  var wb = XLSX.utils.book_new();
  var mv = [['Fecha', 'Mes', 'Descripción', 'Monto', 'US$', 'Tipo', 'Categoría', 'Fijo/Variable', 'Medio', 'Cuenta', 'Cuota', 'Origen', 'Nota']];
  activeMovs().slice().sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); }).forEach(function (m) { mv.push([m.fecha, m.mes, m.descripcion, m.monto, m.usd || '', m.tipo, m.categoria, m.flag || '', m.medio, m.cuenta, m.cuota, m.origen, m.nota]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mv), 'Movimientos');
  [['mes', 'Mensual'], ['trim', 'Trimestral'], ['sem', 'Semestral'], ['anio', 'Anual']].forEach(function (p) {
    var a = [['Período', 'Meses', 'Ingresos', 'Gastos', 'Tarjeta', 'Mercado Pago', 'Fijos', 'Cuotas', 'Variables', 'Únicos', 'Balance', 'Ahorro %']];
    periodRows(p[0]).forEach(function (r) { a.push([r.g, r.n + ' de ' + r.per, Math.round(r.ingresos), Math.round(r.gastos), Math.round(r.tarjeta), Math.round(r.mp), Math.round(r.fijo), Math.round(r.cuota), Math.round(r.variable), Math.round(r.unico), Math.round(r.balance), Math.round(r.tasa * 1000) / 10]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), p[1]);
  });
  XLSX.writeFile(wb, 'finanzas-nirai-' + todayIso() + '.xlsx');
}

/* ============================ Ajustes ============================ */
function viewAjustes() {
  var c = conn(), t = getTok(), cfg = DB.cfg;
  var h = '<div class="card"><h2>☁️ Google Drive</h2>';
  if (!isConfigured()) h += '<p class="small">Para conectar tu Drive necesitás dos datos que se obtienen una sola vez (ver la guía <a href="https://github.com/niraitechia/Finanzas-Nirai-Tech-IA/blob/main/docs/INSTALACION.md" target="_blank" rel="noopener">INSTALACIÓN</a>). No son secretos: la clave de la IA queda guardada en tu Apps Script, nunca acá.</p>';
  h += '<form data-form="conn" class="row"><div class="field" style="flex:2;min-width:240px"><label>URL de la aplicación web (Apps Script)</label><input type="url" name="url" value="' + esc(c.url) + '" placeholder="https://script.google.com/macros/s/…/exec"></div><div class="field" style="flex:2;min-width:240px"><label>ID de cliente de Google (OAuth)</label><input type="text" name="clientId" value="' + esc(c.clientId) + '" placeholder="…apps.googleusercontent.com"></div><div class="field"><label>&nbsp;</label><button class="btn pri">Guardar</button></div></form>';
  if (isConfigured()) {
    h += '<div class="row mt">' + (tokenValid() ? '<span class="pill ok">✓ Sesión iniciada' + (t && t.email && t.email !== 'test' ? ': ' + esc(t.email) : '') + '</span><button class="btn ghost small" data-act="logout">Cerrar sesión</button>' : '<div id="gbtn"></div>') + statusPill() + '</div>';
    if (SYNC.error) h += '<p class="small neg">' + esc(SYNC.error) + '</p>';
    if (SYNC.links.carpeta) h += '<div class="row mt"><a class="btn small" target="_blank" rel="noopener" href="' + esc(SYNC.links.carpeta) + '">📁 Carpeta en Drive</a><a class="btn small" target="_blank" rel="noopener" href="' + esc(SYNC.links.baseDeDatos) + '">🗄️ Base de datos</a><a class="btn small" target="_blank" rel="noopener" href="' + esc(SYNC.links.totales) + '">📊 Totales</a><button class="btn small" data-act="syncNow">🔄 Sincronizar ahora</button><button class="btn small" data-act="backupNow">💾 Copia de seguridad ahora</button></div>' +
      '<p class="small mut">Para tu asistente de ADM: compartile solo la planilla <b>Totales</b> (botón Compartir de Google → «Lector»). Tiene los totales mensuales, trimestrales, semestrales, anuales y por categoría, se actualiza sola y no incluye el detalle de cada movimiento.</p>';
  }
  h += '</div>';
  var f = function (id, l, v, hint, type) { return '<div class="field"><label>' + l + '</label><input type="' + (type || 'text') + '"' + (type ? '' : ' class="money" inputmode="decimal"') + ' data-cfg="' + id + '" value="' + (type ? esc(v || '') : nf0.format(v || 0)) + '">' + (hint ? '<span class="small mut">' + hint + '</span>' : '') + '</div>'; };
  h += '<div class="card"><h2>🎯 Valores de referencia</h2><div class="row">' + f('saldoInicial', 'Saldo de partida (todas tus cuentas + efectivo)', cfg.saldoInicial) + f('saldoInicialFecha', 'A la fecha', cfg.saldoInicialFecha, 'Base del «Dinero disponible»', 'date') + f('ahorroMeta', 'Meta de ahorro mensual', cfg.ahorroMeta) + f('nProm', 'Meses para promediar', cfg.nProm) + f('mpReservado', 'Colchón reservado en MP', cfg.mpReservado) + f('usd', 'Ahorros en dólares (US$)', cfg.usd) + f('tc', 'Tipo de cambio', cfg.tc) + f('colchonMeses', 'Meses de colchón deseados', cfg.colchonMeses) + '</div>' +
    '<div class="field mt"><label>Tus nombres como titular (para detectar transferencias entre tus cuentas)</label><input type="text" data-cfg="propios" value="' + esc((cfg.propios || []).join(', ')) + '" placeholder="Ej: Mauro Maejo, Mauro Antonio Maejo Puga"></div></div>';
  h += '<div class="card"><h2>🏷️ Categorías e íconos</h2><p class="small mut">Editá el ícono (cualquier emoji), el nombre y las palabras clave que usa la clasificación automática. Si renombrás, se actualizan todos los movimientos.</p><div class="tablewrap"><table class="cats"><thead><tr><th>Ícono</th><th>Nombre</th><th>Tipo</th><th>Palabras clave (separadas por coma)</th><th></th></tr></thead><tbody>' +
    DB.cat.slice().sort(function (a, b) { return (a.tipo === b.tipo ? 0 : TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo)) || a.orden - b.orden; }).map(function (ct) { return '<tr class="' + (ct.estado === 'oculto' ? 'off' : '') + '"><td><input type="text" data-catf="icono" data-k="' + esc(ct.id) + '" value="' + esc(ct.icono) + '" class="emoji" aria-label="Ícono"></td><td><input type="text" data-catf="nombre" data-k="' + esc(ct.id) + '" value="' + esc(ct.nombre) + '"></td><td><select data-catf="tipo" data-k="' + esc(ct.id) + '">' + opt(TIPOS, ct.tipo) + '</select></td><td><input type="text" data-catf="palabras" data-k="' + esc(ct.id) + '" value="' + esc(ct.palabras || '') + '" style="width:100%"></td><td><button class="btn ghost small" data-act="catToggle" data-k="' + esc(ct.id) + '">' + (ct.estado === 'oculto' ? 'Mostrar' : 'Ocultar') + '</button></td></tr>'; }).join('') +
    '</tbody></table></div><form data-form="newCat" class="row mt"><input type="text" name="icono" class="emoji" value="🏷️" aria-label="Ícono"><input type="text" name="nombre" placeholder="Nueva categoría" required><select name="tipo">' + opt(TIPOS, 'Gasto') + '</select><button class="btn">Agregar</button></form></div>';
  h += '<div class="card"><h2>🗂️ Datos</h2><div class="row"><button class="btn" data-act="xlsx">Descargar Excel</button><button class="btn" data-act="backupJson">Descargar copia (.json)</button><label class="btn">Restaurar copia<input type="file" accept=".json" data-file="restore" hidden></label>' + (lsGet('finanzas_chini_v1') ? '<button class="btn" data-act="migrar">Traer datos de la versión anterior</button>' : '') + '<button class="btn ghost" data-act="clearMap">Olvidar categorías aprendidas (' + Object.keys(DB.map).length + ')</button></div><p class="small mut">Todos los cambios quedan registrados en la hoja «Log» de tu base de datos, y cada noche se guarda una copia en Drive (Base de datos / Copias de seguridad, últimas 60).</p></div>';
  return h;
}

/* ============================ Eventos ============================ */
function goTab(k) { UI.tab = k; render(); window.scrollTo(0, 0); }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) { if (e.target.id === 'modal') closeModal(); return; }
  var a = b.dataset.act, k = b.dataset.k;
  if (b.tagName === 'A' && a !== 'none') e.preventDefault();
  switch (a) {
    case 'tab': goTab(k); break;
    case 'mPrev': UI.month = addMonths(UI.month, -1); render(); break;
    case 'mNext': UI.month = addMonths(UI.month, 1); render(); break;
    case 'goMonth': UI.month = k; if (UI.tab === 'reportes') UI.tab = 'inicio'; render(); window.scrollTo(0, 0); break;
    case 'filterCat': UI.f = { anio: '', mes: UI.month, tipo: '', cat: k, medio: '', q: '' }; goTab('movimientos'); break;
    case 'verIngresos': UI.f = { anio: '', mes: UI.month, tipo: 'Ingreso', cat: '', medio: '', q: '' }; goTab('movimientos'); break;
    case 'verGastos': UI.f = { anio: '', mes: UI.month, tipo: 'Gasto', cat: '', medio: '', q: '' }; goTab('movimientos'); break;
    case 'verTarjeta': UI.f = { anio: '', mes: UI.month, tipo: 'Gasto', cat: '', medio: 'Tarjeta de crédito', q: '' }; goTab('movimientos'); break;
    case 'verMP': UI.f = { anio: '', mes: UI.month, tipo: 'Gasto', cat: '', medio: 'Mercado Pago', q: '' }; goTab('movimientos'); break;
    case 'verPrestamos': UI.f = { anio: '', mes: '', tipo: 'Préstamo', cat: '', medio: '', q: '' }; goTab('movimientos'); break;
    case 'verSinClasificar': UI.f = { anio: '', mes: '', tipo: '', cat: 'Sin clasificar', medio: '', q: '' }; goTab('movimientos'); break;
    case 'fltClear': UI.f = { anio: '', mes: '', tipo: '', cat: '', medio: '', q: '' }; render(); break;
    case 'fltTipo': UI.f.tipo = UI.f.tipo === k ? '' : k; if (UI.f.cat === 'Sin clasificar') UI.f.cat = ''; render(); break;
    case 'moreMovs': UI.fLimit = (UI.fLimit || 300) + 300; render(); break;
    case 'openMov': { var m = movById(k); if (m) openModal(movForm(m)); break; }
    case 'newMov': openModal(movForm({ fecha: todayIso().slice(0, 7) === UI.month ? todayIso() : UI.month + '-01', mes: UI.month })); break;
    case 'closeModal': closeModal(); break;
    case 'delMov': { var dm = movById(k); if (dm && confirm('¿Eliminar «' + dm.descripcion + '» (' + $0(dm.monto) + ')? Queda registrado en el historial de cambios.')) { dm.estado = 'borrado'; putMov(dm); closeModal(); toast('Eliminado'); render(); } break; }
    case 'chatSug': sendChat(k); break;
    case 'chatClear': UI.chat = []; UI.chatCtx = null; render(); break;
    case 'chatUndo': { var ids = k.split(','), n = 0; ids.forEach(function (id) { var x = movById(id); if (x && x.estado === 'activo') { x.estado = 'borrado'; putMov(x); n++; } }); botSay(n ? '↩️ Listo, lo borré.' : 'Ya estaba borrado.'); render(); break; }
    case 'chatSetCat': { var v = b.dataset.v; k.split(',').forEach(function (id) { var x = movById(id); if (x) { x.categoria = v; x.flag = defaultFlag(v, x.tipo, x.cuota); putMov(x); } }); botSay('🏷️ Lo puse en ' + catIcon(v) + ' ' + v + '.'); render(); break; }
    case 'chatSetMedio': { var md = b.dataset.v; k.split(',').forEach(function (id) { var x = movById(id); if (x) { x.medio = md; putMov(x); } }); botSay(MEDIO_ICON[md] + ' Medio de pago: ' + md + '.'); render(); break; }
    case 'recOk': case 'recOtro': {
      var p = recurrentesPendientes().find(function (x) { return x.rec.id === k; }); if (!p) break;
      var monto = p.rec.monto; if (a === 'recOtro') { var s = prompt('¿Cuánto cobraste de ' + p.rec.nombre + '?', nf0.format(p.rec.monto)); if (s == null) break; monto = parseNum(s); if (!monto) break; }
      registrarRecurrente(p, monto, todayIso().slice(0, 7) === p.mes ? todayIso() : null); toast('Registrado: ' + p.rec.nombre + ' ' + $0(monto)); render(); break;
    }
    case 'recSkip': { var om = Object.assign({}, DB.cfg.omitidos || {}); om[k] = true; setCfg('omitidos', om); render(); break; }
    case 'recAdd': { var r = (DB.cfg.recurrentes || []).slice(); r.push({ id: uid(), nombre: k === 'Sueldo' ? 'Sueldo' : k === 'Inversiones' ? 'Renta' : k === 'Trabajos adicionales' ? 'Trabajo independiente' : 'Ingreso', categoria: k, monto: 0, dia: 1, auto: false, medio: 'Transferencia' }); setCfg('recurrentes', r); render(); break; }
    case 'recDel': if (confirm('¿Quitar este ingreso habitual? (los ya registrados no se borran)')) { setCfg('recurrentes', (DB.cfg.recurrentes || []).filter(function (x) { return x.id !== k; })); render(); } break;
    case 'impOk': { var s1 = UI.imports.find(function (x) { return x.id === k; }); if (s1) confirmImport(s1); break; }
    case 'impNo': case 'impClose': UI.imports = UI.imports.filter(function (x) { return x.id !== k; }); render(); break;
    case 'impUndo': { var im = DB.imp.find(function (x) { return x.id === k; }); if (!im) break; var ms = DB.movs.filter(function (m) { return m.importId === k && m.estado === 'activo'; }); if (!confirm('¿Deshacer la importación de «' + im.archivo + '»? Se quitan ' + ms.length + ' movimientos (quedan en el historial de cambios y el archivo sigue en Drive).')) break; ms.forEach(function (m) { m.estado = 'borrado'; putMov(m); }); DB.movs.forEach(function (m) { if (m.estado === 'reemplazado' && /Reemplazado por/.test(m.nota || '') && m.nota.indexOf(im.archivo) >= 0) { m.estado = 'activo'; putMov(m); } }); im.estado = 'borrado'; putImp(im); toast('Importación deshecha'); render(); break; }
    case 'pendOpen': if (!isOnline()) { toast('Necesito conexión con Drive', true); break; } openPending(k); break;
    case 'pendSkip': { var pd = DB.pend.find(function (x) { return x.id === k; }); if (pd && confirm('¿Descartar «' + pd.nombre + '»? El archivo queda en Drive, solo deja de aparecer acá.')) { pd.estado = 'descartado'; putPend(pd); render(); } break; }
    case 'checkInbox': toast('Buscando en la carpeta Entrada…'); api('checkInbox').then(function (r) { return pull().then(function () { toast(r.nuevos ? r.nuevos + ' archivo(s) nuevo(s)' : 'No hay archivos nuevos'); }); }).catch(function (e2) { toast(e2.message, true); }); break;
    case 'period': UI.period = k; render(); break;
    case 'resetProj': { var pj = Object.assign({}, DB.cfg.proyeccion || {}); delete pj[UI.month]; setCfg('proyeccion', pj); render(); break; }
    case 'xlsx': exportXlsx(); break;
    case 'logout': logout(); render(); break;
    case 'syncNow': connectNow().then(function () { toast(SYNC.status === 'ok' ? 'Sincronizado' : (SYNC.error || 'No se pudo sincronizar'), SYNC.status !== 'ok'); render(); }); break;
    case 'backupNow': api('backupNow').then(function () { toast('Copia de seguridad creada en Drive'); }).catch(function (e2) { toast(e2.message, true); }); break;
    case 'backupJson': { var blob = new Blob([JSON.stringify({ app: 'finanzas-nirai-v2', fecha: nowIso(), tablas: dumpTables() })], { type: 'application/json' }); var u = document.createElement('a'); u.href = URL.createObjectURL(blob); u.download = 'finanzas-nirai-copia-' + todayIso() + '.json'; document.body.appendChild(u); u.click(); setTimeout(function () { URL.revokeObjectURL(u.href); u.remove(); }, 500); break; }
    case 'migrar': { var n2 = migrateV1(lsGet('finanzas_chini_v1', {})); setCfg('migradoV1', true); toast('Traje ' + n2 + ' movimientos de la versión anterior'); render(); break; }
    case 'noMigrar': setCfg('migradoV1', true); render(); break;
    case 'clearMap': if (confirm('¿Olvidar todas las categorías aprendidas?')) { Object.keys(DB.map).forEach(function (mk) { putMap(mk, { tipo: '', categoria: '', flag: '' }); delete DB.map[mk]; }); render(); } break;
    case 'catToggle': { var ct = DB.cat.find(function (x) { return x.id === k; }); if (ct) { ct.estado = ct.estado === 'oculto' ? 'activo' : 'oculto'; putCat(ct); render(); } break; }
  }
});
document.addEventListener('submit', function (e) {
  var f = e.target, k = f.dataset.form; if (!k) return; e.preventDefault();
  if (k === 'chat' || k === 'quickChat') { var inp = f.querySelector('input'); var v = inp.value; inp.value = ''; if (k === 'quickChat') { UI.tab = 'asistente'; } sendChat(v); }
  else if (k === 'mov') saveMovForm(f);
  else if (k === 'ingreso') { var d = {}; new FormData(f).forEach(function (v2, kk) { d[kk] = v2; }); var monto = Math.abs(parseNum(d.monto)); if (!monto) { toast('Falta el monto', true); return; } putMov({ id: uid(), fecha: d.fecha, mes: d.fecha.slice(0, 7), descripcion: d.descripcion, monto: monto, tipo: 'Ingreso', categoria: d.categoria, flag: '', medio: d.medio, cuenta: '', cuota: '', origen: 'manual', estado: 'activo' }); toast('Ingreso registrado'); render(); }
  else if (k === 'conn') { var c = { url: f.url.value.trim(), clientId: f.clientId.value.trim() }; lsSet(LS_CONN, c); toast('Conexión guardada'); var old = document.getElementById('gis-script'); if (old) old.remove(); _gisReady = false; initGis(); connectNow(); render(); }
  else if (k === 'newCat') { var n = f.nombre.value.trim(); if (!n) return; if (catByName(n)) { toast('Ya existe', true); return; } putCat({ id: uid(), nombre: n, icono: f.icono.value.trim() || '🏷️', tipo: f.tipo.value, palabras: '', orden: DB.cat.length, estado: 'activo' }); render(); }
});
function askNewCat(sel, tipo) { var n = (prompt('Nombre de la nueva categoría:') || '').trim(); if (!n) return null; var ic = (prompt('Ícono (emoji) para «' + n + '»:', '🏷️') || '🏷️').trim(); return ensureCat(n, tipo === 'Ingreso' ? 'Ingreso' : 'Gasto', ic); }
document.addEventListener('change', function (e) {
  var t = e.target, ds = t.dataset;
  if (t.id === 'mSel') { UI.month = t.value; render(); return; }
  if (t.matches('[data-file="import"]')) { var fs = Array.prototype.slice.call(t.files); t.value = ''; if (fs.length) handleFiles(fs); return; }
  if (t.matches('[data-file="restore"]')) {
    var file = t.files[0]; t.value = ''; if (!file) return; var rd = new FileReader();
    rd.onload = function () { try { var o = JSON.parse(rd.result); if (!o.tablas) throw new Error('no es una copia de esta app'); if (!confirm('Esto reemplaza los datos actuales por los de la copia (' + (o.fecha || '') + '). ¿Continuar?')) return; loadTables(o.tablas); ['mov', 'imp', 'cat', 'pend'].forEach(function (tb) { (o.tablas[tb] || []).forEach(function (r) { r.modificado = nowIso(); HOOKS.change(tb, r); }); }); (o.tablas.cfg || []).forEach(function (r) { HOOKS.change('cfg', Object.assign({}, r, { modificado: nowIso() })); }); (o.tablas.map || []).forEach(function (r) { HOOKS.change('map', Object.assign({}, r, { modificado: nowIso() })); }); saveLocal(); toast('Copia restaurada'); render(); } catch (err) { toast('No pude restaurar: ' + err.message, true); } };
    rd.readAsText(file); return;
  }
  if (ds.flt) { UI.f[ds.flt] = t.value; UI.fLimit = 300; render(); return; }
  if (ds.imp) { var s = UI.imports.find(function (x) { return x.id === ds.k; }); if (!s) return; s[ds.imp] = t.value; rebuildSession(s); render(); return; }
  if (ds.pv) {
    var s2 = UI.imports.find(function (x) { return x.id === ds.k; }), it = s2 && s2.items[+ds.i]; if (!it) return;
    if (ds.pv === 'incluir') it.incluir = t.checked;
    else if (ds.pv === 'tipo') { it.row.tipo = t.value; var cc = catByName(it.row.categoria); if (cc && cc.tipo !== t.value && cc.tipo !== 'Gasto') it.row.categoria = t.value === 'Ingreso' ? 'Otros ingresos' : 'Sin clasificar'; if (t.value === 'Interno') it.row.categoria = 'Transferencias propias'; if (t.value === 'Préstamo') it.row.categoria = 'Préstamos'; if (t.value === 'Deuda') it.row.categoria = 'Deudas'; it.row.flag = defaultFlag(it.row.categoria, it.row.tipo, it.row.cuota); it.row._edited = true; if (it.estado === 'revisar') it.estado = 'nuevo'; }
    else if (ds.pv === 'categoria') { var v = t.value === '__new__' ? askNewCat(t, it.row.tipo) : t.value; if (!v) { render(); return; } it.row.categoria = v; var c2 = catByName(v); if (c2 && c2.tipo !== 'Gasto' && c2.tipo !== 'Ingreso') it.row.tipo = c2.tipo; it.row.flag = defaultFlag(v, it.row.tipo, it.row.cuota); it.row._edited = true; if (it.estado === 'revisar') it.estado = 'nuevo';
      // aplica a las filas iguales de la misma importación
      var key = normKey(it.row.descripcion); s2.items.forEach(function (o) { if (o !== it && normKey(o.row.descripcion) === key && o.row.categoria === 'Sin clasificar') { o.row.categoria = v; o.row.tipo = it.row.tipo; o.row._edited = true; if (o.estado === 'revisar') o.estado = 'nuevo'; } }); }
    render(); return;
  }
  if (t.name === 'categoria' && t.value === '__new__' && t.closest('form[data-form="mov"]')) { var nv = askNewCat(t, t.form.tipo.value); var sel = t; if (nv) { sel.insertAdjacentHTML('afterbegin', '<option value="' + esc(nv) + '">' + catIcon(nv) + ' ' + esc(nv) + '</option>'); sel.value = nv; } else sel.selectedIndex = 0; return; }
  if (ds.mf === 'tipo') { var form = t.form, tipo = t.value, catSel = form.categoria, cur = catSel.value; catSel.innerHTML = catOptions(tipo === 'Ingreso' && catByName(cur) && catByName(cur).tipo !== 'Ingreso' ? 'Otros ingresos' : tipo === 'Interno' ? 'Transferencias propias' : tipo === 'Préstamo' ? 'Préstamos' : tipo === 'Deuda' ? 'Deudas' : cur, tipo); form.sentido.value = tipo === 'Ingreso' ? 'entrada' : form.sentido.value; return; }
  if (ds.rec) { var recs = (DB.cfg.recurrentes || []).map(function (r) { if (r.id !== ds.k) return r; var o = Object.assign({}, r); o[ds.rec] = ds.rec === 'auto' ? t.checked : ds.rec === 'monto' ? parseNum(t.value) : ds.rec === 'dia' ? Math.max(1, Math.min(31, +t.value || 1)) : t.value; return o; }); setCfg('recurrentes', recs); render(); return; }
  if (ds.cfg) { var key2 = ds.cfg, val = key2 === 'propios' ? t.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : key2 === 'saldoInicialFecha' ? t.value : parseNum(t.value); setCfg(key2, val); render(); return; }
  if (ds.proj) { var pj = Object.assign({}, DB.cfg.proyeccion || {}); pj[UI.month] = Object.assign({}, pj[UI.month] || {}); pj[UI.month][ds.proj] = parseNum(t.value); setCfg('proyeccion', pj); render(); return; }
  if (ds.catf) { var ct = DB.cat.find(function (x) { return x.id === ds.k; }); if (!ct) return; if (ds.catf === 'nombre') { var nn = t.value.trim(); if (!nn) { render(); return; } if (catByName(nn) && catByName(nn) !== ct) { toast('Ya existe una categoría con ese nombre', true); render(); return; } var cnt = renameCat(ct.id, nn); toast('Renombrada' + (cnt ? ' · ' + cnt + ' movimientos actualizados' : '')); } else { ct[ds.catf] = t.value; putCat(ct); } render(); return; }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.modal) closeModal(); });
document.addEventListener('focusout', function () { setTimeout(function () { if (UI._dirty && !UI.busy()) render(); }, 300); });
['dragover', 'dragleave', 'drop'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault();
    if (ev === 'dragover') z.classList.add('over'); else z.classList.remove('over');
    if (ev === 'drop' && e.dataTransfer.files.length) handleFiles(Array.prototype.slice.call(e.dataTransfer.files));
  });
});
// tooltips de los gráficos (mouse y toque)
(function () {
  var tip = document.getElementById('tip');
  function show(el, x, y) { tip.textContent = el.getAttribute('data-tip'); tip.className = 'show'; var w = tip.offsetWidth; tip.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x - w / 2)) + 'px'; tip.style.top = (y - 44) + 'px'; }
  document.addEventListener('mousemove', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else tip.className = ''; });
  document.addEventListener('touchstart', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (el) { var t = e.touches[0]; show(el, t.clientX, t.clientY); } else tip.className = ''; }, { passive: true });
})();

/* ============================ Arranque ============================ */
loadLocal(); loadUI(); autoRecurrentes(); render(); startSync();
window.APP = { DB: DB, UI: UI, SYNC: SYNC, summarize: summarize, sendChat: sendChat, handleFiles: handleFiles, render: render };
