# 📊 FINANZAS NIRAI TECH IA

Asistente de finanzas personales conectado a Google Drive. Importa resúmenes de tarjeta y de Mercado Pago, registra gastos e ingresos con mensajes en lenguaje natural y muestra dashboard, reportes y alertas.

[![Ver el video (46 s)](docs/video-promo.jpg)](https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/media/promo.mp4)

▶️ [Ver el video promocional](https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/media/promo.mp4)

- **App nueva (v2):** <https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/>
- **Planes y precios:** <https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/planes.html>
- **Soporte (WhatsApp oficial de Nirai Tech IA):** [11 7237-3270](https://wa.me/5491172373270)
- **Versión anterior (la que compartís):** <https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/> — sin cambios
- **Instalación y puesta en producción:** [docs/INSTALACION.md](docs/INSTALACION.md)
- **Guía de uso:** [docs/GUIA.md](docs/GUIA.md)

## Arquitectura

| Capa | Tecnología | Archivos |
|---|---|---|
| Frontend (PC y celular) | HTML + JS sin build, en GitHub Pages | `v2/index.html`, `v2/css/`, `v2/js/` |
| Lectura de archivos | pdf.js y SheetJS, en el navegador | `v2/js/parsers.js`, `v2/js/vendor/` |
| Lógica (clasificación, duplicados, cálculos, intérprete) | JS | `v2/js/core.js` |
| Sincronización y sesión | Google Identity Services + cola offline | `v2/js/api.js` |
| Conexión directa (por defecto) | Drive v3 + Sheets v4 desde el navegador, permiso `drive.file` (sin instalar nada, funciona desde el celular) | `v2/js/gdrive.js` |
| Backend anterior (instalaciones viejas) | Google Apps Script (corre con tu cuenta) | `apps-script/Code.gs` |
| Base de datos | Google Sheets en tu Drive | la crea la app al conectar |
| IA | Gemini con la clave del usuario (guardada en su Drive) | `v2/js/gdrive.js`, `apps-script/Code.gs` |

## Pruebas

```bash
node tests/backend.test.js && node tests/core.test.js && node tests/e2e.test.js && node tests/directo.test.js
```

La versión anterior sigue en la raíz (`index.html`), con el mismo link de siempre.
