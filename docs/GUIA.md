# Guía de uso — FINANZAS NIRAI TECH IA

## Cargar resúmenes

Hay **dos formas**:

1. **Desde la app:** entrá a **📥 Importar** y arrastrá o elegí uno o varios archivos.
2. **Desde Drive (ideal en el celular):** compartí el PDF, la captura o la foto a la carpeta **FINANZAS NIRAI TECH IA / Entrada**. En 10 minutos aparece en *Importar → Carpeta «Entrada»* (y como aviso en Inicio). Tocás **Revisar**.

| Archivo | Cómo lo lee |
|---|---|
| Resumen Visa (PDF o Excel del banco) | Lector exacto, con control de que el total cuadre |
| American Express Santander (PDF) | Lector exacto, con control de cuadre |
| Mercado Pago, resumen de cuenta (PDF) | Lector exacto, con control de saldo inicial y final |
| Mercado Pago o banco en Excel/CSV | Detecta las columnas Fecha, Descripción y Monto (o Débito y Crédito) |
| PDF de otro banco o tarjeta | IA (Gemini) con control contra el total. Sin IA, hace una lectura genérica |
| Foto de ticket o captura de pantalla | IA |

**Antes de guardar ves una vista previa** con:

- 🆕 **Nuevos**, ❓ **a revisar** (baja confianza o sin categoría) y ♻️ **duplicados**. Los duplicados vienen destildados y no se importan.
- ✍️ **Coincide con una carga a mano**: si ya le habías dicho al asistente "gasté $42.000 en el súper" y después aparece en el resumen, el del resumen **reemplaza** al manual. No se cuenta dos veces.
- Los totales de gastos e ingresos, y si el resumen **cuadra ✓**.
- Podés cambiar el tipo, la categoría y el mes de cada fila, o destildarla. Si cambiás la categoría de un comercio, la app lo recuerda para la próxima vez.

Al confirmar, el archivo original se guarda en Drive: en *Resúmenes de tarjetas* o en *Comprobantes*. Si te equivocaste, *Historial de importaciones → Deshacer* quita esos movimientos.

**Para que no se dupliquen gastos:**

- En *Ajustes → Tus nombres como titular* poné cómo figurás en las transferencias (por ejemplo `Mauro Maejo`). Así las transferencias entre tus cuentas quedan como 🔁 *Internas* y no como ingreso o gasto.
- El pago del resumen de la tarjeta, hecho desde Mercado Pago o el banco, queda como 💳 *Pago de tarjeta* (interno) cuando coincide con un resumen cargado. Las compras ya están en el resumen. Si todavía no cargaste ese resumen, el pago se cuenta como gasto *Tarjeta sin detalle* para no perderlo, y se corrige solo cuando lo subís.

## El asistente (💬)

También hay una caja rápida en Inicio. Ejemplos:

| Escribís | Qué hace |
|---|---|
| Hoy cobré mi sueldo de $1.500.000 | 💰 Ingreso · Sueldo |
| Acabo de gastar $18.500 en una cena | 🍔 Gasto · Comida y restaurantes |
| Compré ropa por $75.000 con tarjeta de crédito | 👕 Gasto · Ropa · 💳 |
| Compré una tele en 6 cuotas por $600.000 con visa | Crea 6 cuotas de $100.000 en los próximos 6 meses |
| Le presté $50.000 a un amigo | 🤲 Préstamo (no cuenta como gasto) |
| Me devolvió $20.000 | 🤲 Devolución de préstamo |
| Ayer pagué 8 mil de luz con débito | Fecha de ayer, 💡 Servicios, 🏧 |
| El gasto anterior no fue de $18.500, fue de $16.500 | **Corrige** el movimiento original, sin crear otro |
| Borrá el último | Pide confirmación y lo borra |

- Si falta el importe, te lo pregunta. Si no reconoce la categoría, te ofrece botones para elegirla. Si querés una categoría nueva, la IA la crea.
- Después de registrar, aparecen los botones **Deshacer**, **Editar** y, si no dijiste el medio de pago, sugerencias para indicarlo.

**Preguntas** (responde **solo con lo registrado**):

- ¿Cuánto gasté este mes? · ¿Cuánto gasté en octubre?
- ¿Cuánto llevo gastado en comida? · ¿Cuánto gasté con Mercado Pago?
- ¿Cuánto debo pagar de tarjeta? (usa el total de los resúmenes cargados)
- ¿Cuánto cobré este mes? · ¿Cuáles fueron mis mayores gastos?
- ¿En qué categoría estoy gastando más? · ¿Cuánto ahorré respecto al mes anterior?
- ¿Cuánto dinero me queda disponible? (necesita el saldo de partida en Ajustes)
- ¿Hay gastos inusuales? · Dame recomendaciones

## Sueldo e ingresos (💰)

- En **Ingresos** configurá tu sueldo: monto, día de cobro, medio y si es **automático**.
  - **No automático (recomendado):** desde el día de cobro, Inicio te pregunta *"¿Ya cobraste?"* con tres opciones: **Sí** / **Otro monto** / **Todavía no**. No se cuenta como cobrado hasta que confirmes.
  - **Automático:** se registra solo ese día.
- Podés sumar otros ingresos habituales (trabajos fijos, rentas) y registrar ingresos sueltos: trabajos independientes, extraordinarios o inversiones.

## Movimientos (📋)

- Filtros por año, mes, tipo, categoría, medio de pago y búsqueda. Tenés atajos para ingresos, gastos, préstamos, deudas, internos y sin clasificar.
- Tocá cualquier movimiento para ver su detalle (origen, archivo en Drive, fechas de alta y cambio), editarlo o eliminarlo.
- Si tocás una porción del gráfico de categorías en Inicio, se abre esta lista filtrada.

## Categorías e íconos

En *Ajustes → Categorías e íconos* podés:

- Cambiar el emoji, el nombre (se actualizan todos los movimientos), el tipo y las **palabras clave** que usa la clasificación automática.
- Ocultar las categorías que no usás y agregar nuevas.

## Reportes (📊)

- Tablas **mensual, trimestral, semestral y anual**, con tarjeta, Mercado Pago, fijos, cuotas, variables, balance y % de ahorro.
- **Proyección del mes siguiente** y escenario **"vivir de tu negocio"**.
- **Descargar Excel**. La planilla **Totales** de Drive (para tu asistente) se actualiza sola.

## Dinero disponible

En *Ajustes → Valores* cargá cuánto tenés hoy entre todas tus cuentas y el efectivo, con la fecha. A partir de ahí:

> disponible = saldo de partida + ingresos − gastos ± préstamos y deudas

Las compras con tarjeta **no** restan hasta que pagás el resumen (el pago de la tarjeta sí resta).
