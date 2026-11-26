# Vender FINANZAS NIRAI TECH IA — guía para el dueño

**Soporte oficial de Nirai Tech IA:** WhatsApp **11 7237-3270** (https://wa.me/5491172373270). Figura en la guía de activación y en el pie de la app.

## Cómo funciona para el cliente (modo directo, desde noviembre 2026)
- **No se instala nada.** El cliente abre su link, toca **Conectar con Google**, acepta el permiso y listo. Funciona igual desde el **celular** o la PC.
- La app usa Google Drive y Google Sheets directamente desde el navegador, con el permiso **`drive.file`**: solo ve los archivos que ella misma crea. Los datos quedan en **el Drive del cliente** (carpeta *FINANZAS NIRAI TECH IA*) y vos no los ves.
- Link para clientes que pagaron: **`https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/?conectar=google`** + la guía `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/instalar.html`.
- Quien entra a `/v2/` sin ese link usa la **prueba gratis** (datos solo en el navegador) y no ve nada de Google.
- ⚠️ El link es el mismo para todos los clientes: no es una llave. Alguien que lo reciba de un cliente podría usarlo. Para bloquearlo de verdad hace falta un servidor de licencias (se puede agregar más adelante).
- Diferencias con la instalación vieja (planilla + Apps Script): no hay carpeta «Entrada» que se revise sola ni copia a las 3 AM. La copia de seguridad se hace una vez por día **al abrir la app**. Google da el permiso por **1 hora**: después aparece el botón «Conectar con Google» y se renueva con un toque (lo cargado mientras tanto queda guardado y se sube solo).
- Las instalaciones viejas con link `?conectar=AKfy…` (la tuya, por ejemplo) **siguen funcionando igual**.

## Lo que tenés que hacer una sola vez (Google Cloud)
Entrá a <https://console.cloud.google.com> → proyecto de la app (el del ID de cliente `288188064237-…`).
1. **APIs y servicios → Biblioteca**: buscá y tocá **Habilitar** en **Google Drive API** y en **Google Sheets API**.
2. **Google Auth Platform → Acceso a los datos → Agregar o quitar permisos**: tildá `…/auth/drive.file` («Ver, editar, crear y borrar solo los archivos específicos de Google Drive que uses con esta app») → Actualizar → **Guardar**. Es un permiso **no sensible**: no requiere la verificación de Google.
3. **Información de la marca**: nombre *FINANZAS NIRAI TECH IA*, mail de soporte, y estos links:
   - Página principal: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/planes.html`
   - Política de privacidad: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/privacidad.html`
   - Condiciones del servicio: `https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/terminos.html`
   - **No subas logo** por ahora: con logo Google pide verificar la marca (tarda días).
4. **Público**: el estado tiene que ser **En producción** (botón «Publicar app»). Si queda «En prueba», solo entran los mails cargados como usuarios de prueba.
5. **Clientes → tu ID de cliente web → Orígenes autorizados de JavaScript**: tiene que estar `https://niraitechia.github.io` (ya debería estar).

Si falta el paso 1, la app avisa: «Falta activar Google Drive API / Sheets API».

### Antes de cobrar
- El CUIT no se publica por ahora (decisión del dueño). Agregarlo en términos y privacidad cuando se formalice la facturación.
- Hacé que un abogado revise los términos y la privacidad, y consultá a tu contador por la facturación.
- Respondé las solicitudes del **Botón de arrepentimiento** dentro de las 24 hs, con un código de identificación (por ejemplo `ARR-2026-001`).

## Activación del cliente
> La guía `v2/instalar.html` **no está enlazada** en la app ni en la página de planes: se la mandás al cliente **después de que paga**, junto con el link `?conectar=google`.

1. El cliente abre el link (celular o PC) y toca **Conectar con Google**.
2. Elige su cuenta y acepta el permiso (si aparece una casilla, la tilda).
3. Listo: en su Drive aparece la carpeta con la base de datos, los resúmenes, las copias y la planilla **Totales**.

Si necesita ayuda: **asistida** por WhatsApp o **remota con RustDesk** (el inicio de sesión de Google lo hace siempre el cliente).

La IA es opcional: el cliente pega su clave gratuita de Google AI Studio en **Ajustes → Inteligencia artificial**. Queda guardada en su propio Drive (hoja «Privado» de su base de datos).

## Actualizaciones
- **App (pantallas, lectores, reportes):** se actualiza sola para todos al publicar en GitHub.
- **Modo directo:** no hay nada que actualizar del lado del cliente.
- **Instalaciones viejas (`Code.gs`):** si cambia, se pega el nuevo código en la copia y se vuelve a tocar **📊 Finanzas → Instalar**. El link no cambia.

## Más adelante: dominio propio y código privado (Cloudflare Pages)
Cuando tengas clientes:
1. Comprá un dominio, por ejemplo `niraitech.com.ar` en NIC Argentina o `.com`.
2. Creá una cuenta en Cloudflare y conectá el repo, que pasa a **privado**.
3. Agregá el dominio nuevo en Google Cloud → Clientes → Orígenes autorizados.
4. Cambiá `APP_URL` en `Code.gs`.

La versión anterior sigue en el link de GitHub de siempre.
