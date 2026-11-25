# 💹 FINANZAS NIRAI TECH IA

Asistente de finanzas personales conectado a Google Drive. Importa resúmenes de tarjeta y de Mercado Pago, registra gastos e ingresos con mensajes en lenguaje natural y muestra dashboard, reportes y alertas.

- **App:** <https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/>
- **Instalación y puesta en producción:** [docs/INSTALACION.md](docs/INSTALACION.md)
- **Guía de uso:** [docs/GUIA.md](docs/GUIA.md)

## Arquitectura

| Capa | Tecnología | Archivos |
|---|---|---|
| Frontend (PC y celular) | HTML + JS sin build, en GitHub Pages | `index.html`, `css/`, `js/` |
| Lectura de archivos | pdf.js y SheetJS, en el navegador | `js/parsers.js`, `js/vendor/` |
| Lógica (clasificación, duplicados, cálculos, intérprete) | JS | `js/core.js` |
| Sincronización y sesión | Google Identity Services + cola offline | `js/api.js` |
| Backend | Google Apps Script (corre con tu cuenta) | `apps-script/Code.gs` |
| Base de datos | Google Sheets en tu Drive | creada por `setup()` |
| IA | Gemini (clave solo en el backend) | `apps-script/Code.gs` |

## Pruebas

```bash
node tests/backend.test.js && node tests/core.test.js && node tests/e2e.test.js
```

La versión anterior quedó en `legacy/index-v1.html`.
