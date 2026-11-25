# Puesta en producción — FINANZAS NIRAI TECH IA

Se hace **una sola vez** y lleva unos 20 minutos. Necesitás tu cuenta de Google (la misma de Drive).

```
GitHub Pages (la app)  ──►  Apps Script (tu backend, corre con tu cuenta)  ──►  Drive + Sheets
        │                         │
        └─ Iniciar sesión          └─ Gemini (IA), con la clave guardada en el backend
           con Google
```

- **No hay secretos en el código público.** La clave de Gemini queda en las *Propiedades del script*.
- El backend solo acepta pedidos con un token de Google válido, emitido para tu app y para **tu** email.

---

## 1. Clave de Gemini (gratis)

1. Entrá a <https://aistudio.google.com/apikey> con tu cuenta.
2. Tocá **Create API key**, elegí o creá un proyecto y copiá la clave. La vas a pegar en el paso 2.

> **Privacidad:** en el nivel gratuito, Google puede usar lo que se le envía a Gemini para mejorar sus productos. La app solo usa la IA para fotos, capturas, PDF de bancos que no reconoce y preguntas abiertas. Los resúmenes Visa, American Express (Santander) y Mercado Pago se leen en tu navegador sin IA. Si preferís no usarla, no cargues la clave: todo lo demás sigue funcionando.

## 2. Backend en Google Apps Script

1. Entrá a <https://script.google.com> y tocá **Nuevo proyecto**. Ponele de nombre `Finanzas Nirai Tech IA`.
2. Borrá el contenido de `Código.gs` y pegá todo el contenido de [`apps-script/Code.gs`](../apps-script/Code.gs).
3. **Configuración del proyecto** (ícono ⚙️): activá *Mostrar el archivo de manifiesto "appsscript.json"*. Volvé al editor y reemplazá el contenido de `appsscript.json` por el de [`apps-script/appsscript.json`](../apps-script/appsscript.json).
4. **Configuración del proyecto → Propiedades del script → Agregar propiedad**:

   | Propiedad | Valor |
   |---|---|
   | `OWNER_EMAIL` | tu Gmail (el único que va a poder entrar) |
   | `GEMINI_API_KEY` | la clave del paso 1 |
   | `OAUTH_CLIENT_ID` | lo completás en el paso 3 |

5. En el editor, elegí la función **`setup`** y tocá **Ejecutar**. Google te pide permisos: aceptalos. Como es tu propio script, aparece "Google no verificó esta app": tocá *Configuración avanzada → Ir a Finanzas Nirai Tech IA*.
   - El script crea la carpeta **FINANZAS NIRAI TECH IA** en tu Drive (con Base de datos, Entrada, Resúmenes de tarjetas, Comprobantes, Ingresos, Gastos y Reportes mensuales), la planilla de base de datos, la planilla de Totales y dos tareas automáticas: revisar *Entrada* cada 10 minutos y hacer una copia de seguridad cada noche.
   - En **Registro de ejecución** aparecen los links.

## 3. ID de cliente de Google (para "Iniciar sesión con Google")

1. Entrá a <https://console.cloud.google.com> y creá un proyecto nuevo (por ejemplo `finanzas-nirai`). Puede ser el mismo que se creó con la clave de Gemini.
2. **Google Auth Platform → Branding**: nombre de la app `FINANZAS NIRAI TECH IA` y tu email de soporte. En **Audience** elegí *External* y agregá tu Gmail como *usuario de prueba*. No hace falta publicarla: es solo para vos.
3. **Google Auth Platform → Clients → Create client**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: `https://niraitechia.github.io`
   - Guardá y copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`).
4. Volvé a Apps Script y pegalo en la propiedad `OAUTH_CLIENT_ID`.

## 4. Publicar el backend

1. En Apps Script: **Implementar → Nueva implementación → ⚙️ → Aplicación web**.
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Cualquier usuario**. Es necesario para que la página pueda llamarlo. La seguridad la da la verificación del token: solo tu email pasa.
2. Tocá **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

> Si más adelante cambiás `Code.gs`: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión**. Así conservás la misma URL.

## 5. Conectar la app

Tenés dos opciones:

- **En el repo (recomendado):** editá [`v2/js/config.js`](../v2/js/config.js), poné `BACKEND_URL` y `GOOGLE_CLIENT_ID`, y hacé commit. Sirve para todos tus dispositivos.
- **Desde la app:** *Ajustes → Google Drive*, pegá los dos valores y guardá. Esto queda solo en ese navegador.

Después: en **Ajustes**, tocá **Iniciar sesión con Google**. El estado arriba a la derecha tiene que decir ☁️ *Sincronizado*.

Si usabas la versión anterior en ese mismo navegador, en Inicio aparece **"Encontré datos de la versión anterior → Traerlos"**: se migran los meses, las categorías aprendidas y el sueldo.

## 6. GitHub Pages

En el repo: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. La versión nueva queda en <https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/>. El link de siempre sigue mostrando la versión anterior.

En el celular, abrila en Chrome y elegí **⋮ → Agregar a pantalla de inicio**. Queda como una app más.

## 7. Compartir los totales con tu asistente de ADM

En Drive, abrí **FINANZAS NIRAI TECH IA / Reportes mensuales / FINANZAS NIRAI TECH IA — Totales**, tocá **Compartir** y agregá su email como **Lector**.

Esa planilla trae los totales mensuales, trimestrales, semestrales, anuales y por categoría. Se actualiza sola con cada cambio y **no incluye el detalle de cada movimiento**. No compartas la carpeta ni la Base de datos.

---

## Seguridad y datos

| Tema | Cómo está resuelto |
|---|---|
| Autenticación | Google Sign-In (OAuth 2.0 / OpenID). El backend verifica cada token con Google: audiencia = tu Client ID, email = `OWNER_EMAIL`. |
| Credenciales | La clave de Gemini está en las Propiedades del script. `config.js` solo tiene valores públicos. |
| Archivos | El backend solo entrega archivos que estén dentro de la carpeta de la app. |
| Historial | Cada alta o modificación queda en la hoja **Log**, con el valor anterior y el nuevo. Borrar marca `estado = borrado`: no se elimina la fila. |
| Copias | Copia diaria de la base en *Base de datos / Copias de seguridad* (se guardan las últimas 60). También hay un botón de copia manual y otro para descargar `.json`. |
| Conflictos | Gana la versión más nueva de cada movimiento (columna `modificado`). |
| Sin internet | Los cambios se guardan en el dispositivo y se envían solos cuando vuelve la conexión. |
| Duplicados | Hay una huella por movimiento (fecha, importe, comercio, cuota, cuenta o N° de operación de MP), el mismo archivo no se sube dos veces a Drive y se detectan cargas manuales que coinciden con un resumen. |

## Límites a tener en cuenta

- **Apps Script (cuenta gratuita):** 90 minutos diarios de tareas automáticas y 20.000 llamadas externas por día. Para uso personal sobra.
- **Carpeta Entrada:** se revisa cada 10 minutos con un disparador de tiempo de Apps Script. No uso las notificaciones *push* de Drive porque exigen un servidor con dominio verificado, y el disparador es la alternativa oficial y confiable.
- **Gemini gratis:** tiene límites de pedidos por minuto y por día. Si se superan, la app usa el intérprete local y los lectores sin IA.

## Pruebas (para desarrollo)

```bash
node tests/backend.test.js   # backend contra Drive/Sheets emulados
node tests/core.test.js      # intérprete de mensajes, duplicados y cálculos
node tests/e2e.test.js       # Chrome + app + backend (requiere playwright-core y Chrome)
node tests/server.js 8765    # app local con backend emulado: http://localhost:8765/v2/
```
