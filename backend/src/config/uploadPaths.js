const path = require('path');
const fs = require('fs');

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

const PUBLIC_DIR = path.join(__dirname, '../../uploads');

const PRIVATE_DIR = path.join(
  __dirname,
  '../../uploads_private'
);

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