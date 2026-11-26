# Vender FINANZAS NIRAI TECH IA — guía para el dueño

**Soporte oficial de Nirai Tech IA:** WhatsApp **11 7237-3270** (https://wa.me/5491172373270). Figura en la guía de instalación, en el cartel del instalador, en la hoja de bienvenida y en el pie de la app.

## Cómo funciona para el cliente
- Cada cliente tiene **su copia** del backend en **su** cuenta de Google. Sus datos quedan en **su** Drive y vos no los ves.
- Todos usan la misma app: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/`. Cuando la mejorás, se actualiza para todos.
- Cada cliente se conecta con su **link personal**: `…/v2/?conectar=XXXX`. Se genera al instalar y le llega por mail.
- Quien entra a `/v2/` sin link personal usa la versión **local gratuita**, que guarda los datos en el navegador. Esa es la versión para compartir.

## Lo que tenés que hacer una sola vez

### 1. Publicar la pantalla de inicio de sesión (Google Cloud)
Mientras esté en "Prueba", solo pueden entrar los "usuarios de prueba".
1. Entrá a <https://console.cloud.google.com> → proyecto **FINANZAS NIRAI TECH IA** → **Google Auth Platform**.
2. **Información de la marca**: completá estos campos.
   - Página principal: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/instalar.html`
   - Política de privacidad: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/privacidad.html`
   - Condiciones del servicio: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/terminos.html`
3. **Público** → **Publicar app** → confirmar. La app solo pide email y perfil (permisos no sensibles), así que no hace falta verificación.

### 2. Crear la planilla instaladora (plantilla)
1. Entrá a <https://sheets.new>.
2. **Extensiones → Apps Script**:
   - pegá [`apps-script/Code.gs`](https://raw.githubusercontent.com/NiraiTechIA/Finanzas-Nirai-Tech-IA/main/apps-script/Code.gs);
   - en ⚙️ activá "Mostrar appsscript.json" y pegá [`apps-script/appsscript.json`](https://raw.githubusercontent.com/NiraiTechIA/Finanzas-Nirai-Tech-IA/main/apps-script/appsscript.json);
   - guardá.
3. En el editor, elegí la función **prepararPlantilla** → **Ejecutar** → autorizá. Deja la hoja de bienvenida lista.
4. En la planilla: **Compartir** → Acceso general: **Cualquier persona con el enlace — Lector**.
5. Copiá el link de la planilla y cambiá el final `/edit…` por `/copy`. Ese es el link del paso 1 del cliente. Cargalo en `v2/js/config.js` → `INSTALL_TEMPLATE_URL`, o pasámelo y lo cargo yo.

> **No uses la plantilla para tus propios datos.** Vos ya tenés tu backend funcionando.

### 3. Antes de cobrar
- El CUIT no se publica por ahora (decisión del dueño). Agregarlo en términos y privacidad cuando se formalice la facturación.
- Hacé que un abogado revise los términos y la privacidad, y consultá a tu contador por la facturación.
- Respondé las solicitudes del **Botón de arrepentimiento** dentro de las 24 hs, con un código de identificación (por ejemplo `ARR-2026-001`).

## Instalación del cliente
Modalidades: **asistida** (el cliente sigue la guía y vos lo acompañás por WhatsApp) o **remota con RustDesk** (el cliente instala RustDesk, te pasa el código y vos hacés los pasos en su computadora; el inicio de sesión de Google lo hace siempre el cliente).

Ver `v2/instalar.html`: tiene ilustraciones de cada pantalla.
1. **Crear mi copia** (link de la plantilla).
2. En la copia: **📊 Finanzas → 1. Instalar**, aceptar los permisos. Crea la carpeta y la base de datos.
3. **Publicar la conexión** (1 minuto):
   - Extensiones → Apps Script → Implementar → Nueva implementación → ⚙️ Aplicación web.
   - Ejecutar como: Yo · Quién tiene acceso: **Cualquier usuario** → Implementar.
   - Copiar la URL y pegarla en **📊 Finanzas → 2. Pegar mi URL publicada**.
4. **Abrir mi app** e iniciar sesión. El link personal también le llega por mail.

> La publicación automática (API de Apps Script) suele fallar en cuentas comunes. Por eso el paso 3 es manual y está explicado como un paso normal. Si en alguna cuenta funciona sola, el paso 3 se saltea.

La IA es opcional: el cliente pega su clave gratuita de Google AI Studio en **Ajustes → Inteligencia artificial**.

## Actualizaciones
- **App (pantallas, lectores, reportes):** se actualiza sola para todos al publicar en GitHub.
- **Backend (`Code.gs`):** cambia poco. Si cambia, el cliente pega el nuevo código en su copia y vuelve a tocar **📊 Finanzas → Instalar**. Su link no cambia.

## Más adelante: dominio propio y código privado (Cloudflare Pages)
Cuando tengas clientes:
1. Comprá un dominio, por ejemplo `niraitech.com.ar` en NIC Argentina o `.com`.
2. Creá una cuenta en Cloudflare y conectá el repo, que pasa a **privado**.
3. Agregá el dominio nuevo en Google Cloud → Clientes → Orígenes autorizados.
4. Cambiá `APP_URL` en `Code.gs`.

La versión anterior sigue en el link de GitHub de siempre.
