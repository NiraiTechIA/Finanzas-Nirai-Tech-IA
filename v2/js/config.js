/* Configuración pública de FINANZAS NIRAI TECH IA.
   Nada de esto es secreto. Cada persona conecta SU propio Google Drive con su link personal
   (…/v2/?conectar=XXXX), que se genera al instalar. La clave de Gemini queda en el backend de cada uno. */
window.NIRAI_CONFIG = {
  BACKEND_URL: '',   // vacío a propósito: la app pública arranca en modo local
  GOOGLE_CLIENT_ID: '288188064237-aatf9mti4ioim04pup4m4ok9abdp16ub.apps.googleusercontent.com',
  INSTALL_TEMPLATE_URL: 'https://docs.google.com/spreadsheets/d/1IuVbIOhaIScqmFDIfrrpQxj7dsqWvm4T5vnu_vtOJ8U/copy',   // link de la planilla instaladora terminado en /copy
  CONTACT_EMAIL: 'mauromaejo@gmail.com',
  SUPPORT_PHONE: '11 7237-3270',          // número oficial de Nirai Tech IA
  SUPPORT_WHATSAPP: '5491172373270',
  BRAND: 'Nirai Tech IA',
  TRIAL_URL: 'https://niraitechia.github.io/Finanzas-Nirai-Tech-IA/v2/',   // dónde se prueba gratis (cambiar a la raíz para usar la V1)
  // Clave PÚBLICA para verificar los códigos de activación (la privada la tiene solo el dueño; nunca va acá)
  LICENSE_KEY: { kty: 'EC', crv: 'P-256', x: 'OjiCKmMAOrYubOWQ_hOgT6k0LaHtjIBoZ4f_8ioCyPk', y: 'E3CPmcAB-tFaENTkvvk7BBS53_qyoewnk1WbONjYW0o' },
  PRICES: {                     // editá acá el precio (en pesos)
    unico: 20000                // versión completa: pago único, sin abono (incluye instalación)
  }
};
