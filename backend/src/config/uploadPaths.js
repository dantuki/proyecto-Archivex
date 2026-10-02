const path = require('path');
const fs = require('fs');

// Este módulo se carga antes de dotenv.config() en index.js.
require('dotenv').config();

// ============================================================
// RUTAS DE ALMACENAMIENTO DE ARCHIVOS
// ============================================================
//
// PUBLIC_DIR:
// Archivos que el sistema considera públicos, como las bases
// de las convocatorias y las fotos de perfil.
//
// PRIVATE_DIR:
// Documentos que NO deben ser servidos mediante express.static,
// como documentos de solicitudes, certificados y evaluaciones.
//
// IMPORTANTE:
// uploads_private está FUERA de uploads/.
// Si estuviera dentro de uploads/, una ruta como:
//   app.use('/uploads', express.static(...))
// podría seguir sirviendo esos archivos.
//

// Rutas absolutas opcionales para almacenamiento persistente fuera del
// directorio desplegado; sin ellas se usan las carpetas locales.
const resolverDirectorio = (valor, porDefecto) => {
  const configurado = String(valor || '').trim();

  if (!configurado) {
    return porDefecto;
  }

  if (!path.isAbsolute(configurado)) {
    throw new Error(
      'UPLOADS_PUBLIC_DIR y UPLOADS_PRIVATE_DIR deben ser rutas absolutas.'
    );
  }

  return path.resolve(configurado);
};

const PUBLIC_DIR = resolverDirectorio(
  process.env.UPLOADS_PUBLIC_DIR,
  path.join(__dirname, '../../uploads')
);

const PRIVATE_DIR = resolverDirectorio(
  process.env.UPLOADS_PRIVATE_DIR,
  path.join(__dirname, '../../uploads_private')
);

// uploads_private nunca debe quedar dentro de uploads (se serviría con express.static).
const relativo = path.relative(PUBLIC_DIR, PRIVATE_DIR);

if (
  relativo === '' ||
  (!relativo.startsWith('..') && !path.isAbsolute(relativo))
) {
  throw new Error(
    'UPLOADS_PRIVATE_DIR no puede estar dentro de UPLOADS_PUBLIC_DIR.'
  );
}

// Crear las carpetas si no existen.
[PUBLIC_DIR, PRIVATE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = {
  PUBLIC_DIR,
  PRIVATE_DIR
};