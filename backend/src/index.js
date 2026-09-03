const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const Usuario = require('./models/usuarioModel');
const { PUBLIC_DIR } = require('./config/uploadPaths');

// ============================================================
// IMPORTACIÓN DE RUTAS
// ============================================================

const SedeRoutes = require('./routes/sedeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const convocatoriaRoutes = require('./routes/convocatoriaRoutes');
const solicitudRoutes = require('./routes/solicitudRoutes');
const asignacionRoutes = require('./routes/asignacionRoutes');
const authRoutes = require('./routes/authRoutes');
const noticiaRoutes = require('./routes/noticiaRoutes');
const postulacionRoutes = require('./routes/postulacionRoutes');
const reporteRoutes = require('./routes/reporteRoutes');
const fileRoutes = require('./routes/fileRoutes');

// ============================================================
// VARIABLES DE ENTORNO
// ============================================================

dotenv.config();

const app = express();

// ============================================================
// CONFIGURACIÓN CORS
// ============================================================
//
// Ya no usamos:
// cors()
// origin: "*"
//
// En desarrollo se permiten solamente los hosts locales
// habituales del frontend.
//
// Para producción se puede definir:
// FRONTEND_ORIGIN=https://tu-dominio.com
//
// También se permiten múltiples orígenes separados por coma:
// FRONTEND_ORIGIN=https://app1.com,https://app2.com
// ============================================================

const obtenerOrigenesPermitidos = () => {
  const configurado = process.env.FRONTEND_ORIGIN;

  if (!configurado) {
    return [
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
  }

  return configurado
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
};

const origenesPermitidos = obtenerOrigenesPermitidos();

const corsOptions = {
  origin: (origin, callback) => {
    // Las herramientas locales como curl/postman pueden no enviar
    // Origin. No las bloqueamos por ausencia de header.
    if (!origin) {
      return callback(null, true);
    }

    if (origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error('Origen no permitido por la política CORS.')
    );
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// ============================================================
// ARCHIVOS PÚBLICOS
// ============================================================
//
// Solo uploads es público.
//
// IMPORTANTE:
// uploads_private NO se sirve mediante express.static.
// ============================================================

app.use(
  '/uploads',
  express.static(PUBLIC_DIR, {
    dotfiles: 'deny',
    index: false
  })
);

// ============================================================
// SERVIDOR HTTP
// ============================================================

const server = http.createServer(app);

// ============================================================
// JWT PARA WEBSOCKETS
// ============================================================

const obtenerJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'JWT_SECRET no está configurado correctamente.'
    );
  }

  return secret;
};

/**
 * Extrae el token enviado durante el handshake de Socket.IO.
 *
 * Formatos aceptados:
 *
 * socket.auth.token
 *
 * socket.auth.accessToken
 *
 * Authorization: Bearer <token>
 *
 * No aceptamos identidad de usuario enviada libremente
 * como parte del payload de los eventos.
 */
const extraerTokenSocket = (socket) => {
  const authToken =
    socket.handshake.auth?.token ||
    socket.handshake.auth?.accessToken;

  if (
    typeof authToken === 'string' &&
    authToken.trim()
  ) {
    return authToken.trim();
  }

  const authorization =
    socket.handshake.headers?.authorization;

  if (
    typeof authorization === 'string' &&
    authorization.startsWith('Bearer ')
  ) {
    return authorization.slice(7).trim();
  }

  return null;
};


// ============================================================
// TABLA DE CHAT
// ============================================================

const inicializarTablaChat = async () => {
  const queryTabla = `
    CREATE TABLE IF NOT EXISTS chat_mensajes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      remitente_id INT NOT NULL,
      destinatario_id INT NOT NULL,
      mensaje TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (remitente_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,
      FOREIGN KEY (destinatario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  try {
    await db.query(queryTabla);

    console.log(
      'Tabla "chat_mensajes" verificada/creada con éxito.'
    );
  } catch (error) {
    console.error(
      'Error al inicializar la tabla de chat.'
    );
  }
};

// ============================================================
// CONEXIÓN A BASE DE DATOS
// ============================================================

db.query('SELECT 1')
  .then(() => {
    console.log(
      'Conexión exitosa con el motor MySQL'
    );

    return inicializarTablaChat();
  })
  .catch(() => {
    console.error(
      'Error en la conexión con la base de datos.'
    );
  });

// ============================================================
// MONTAJE DE RUTAS
// ============================================================

app.use('/api/sedes', SedeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/convocatorias', convocatoriaRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/asignaciones', asignacionRoutes);

// Ruta antigua mantenida temporalmente por compatibilidad.
app.use('/api/asignacion', asignacionRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/noticias', noticiaRoutes);
app.use('/api/postulaciones', postulacionRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/archivos-privados', fileRoutes);

// ============================================================
// ENDPOINT DE SALUD
// ============================================================

app.get('/', (req, res) => {
  return res.status(200).json({
    mensaje:
      'API de ArchiveX operativa con WebSockets',
    estado: 'Limpio'
  });
});

// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================
//
// Nunca devolvemos:
// - error.message
// - error.sqlMessage
// - detalles SQL
// - stack trace
//
// al cliente.
// ============================================================

app.use((err, req, res, next) => {
  console.error(
    'Error capturado por el manejador global:',
    err
  );

  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number.isInteger(err?.status) &&
    err.status >= 400 &&
    err.status < 600
      ? err.status
      : 500;

  return res.status(status).json({
    status: 'error',
    message:
      status === 500
        ? 'Error interno del servidor.'
        : 'La solicitud no pudo ser procesada.'
  });
});

// ============================================================
// SOCKET.IO
// ============================================================

const ioServer = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (origenesPermitidos.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          'Origen no permitido por la política CORS.'
        )
      );
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

io = ioServer;

// ============================================================
// AUTENTICACIÓN DEL SOCKET
// ============================================================

ioServer.use((socket, next) => {
  try {
    const token = extraerTokenSocket(socket);

    if (!token) {
      return next(
        new Error(
          'No autenticado: se requiere un token de acceso.'
        )
      );
    }

    const jwtSecret = obtenerJwtSecret();

    const payload = jwt.verify(
      token,
      jwtSecret,
      {
        algorithms: ['HS256']
      }
    );

    const usuarioId = Number(
      payload?.id || payload?.sub || 0
    );

    const rol = String(
      payload?.rol || payload?.role || ''
    ).trim();

    if (!usuarioId || !rol) {
      return next(
        new Error(
          'Token WebSocket inválido.'
        )
      );
    }

    // La identidad queda vinculada al socket
    // y NO puede ser reemplazada mediante eventos
    // posteriores enviados por el cliente.
    socket.user = {
      id: usuarioId,
      rol
    };

    return next();
  } catch (error) {
    console.error(
      'Conexión WebSocket rechazada por autenticación.'
    );

    return next(
      new Error(
        'No autenticado: token WebSocket inválido.'
      )
    );
  }
});

// ============================================================
// USUARIOS ACTIVOS
// ============================================================
//
// Permitimos múltiples pestañas/dispositivos
// del mismo usuario.
//
// userId -> Set(socketId)
// ============================================================

const usuariosActivos = new Map();

const agregarSocketUsuario = (
  usuarioId,
  socketId
) => {
  const key = String(usuarioId);

  if (!usuariosActivos.has(key)) {
    usuariosActivos.set(key, new Set());
  }

  usuariosActivos
    .get(key)
    .add(socketId);
};

const eliminarSocketUsuario = (
  usuarioId,
  socketId
) => {
  const key = String(usuarioId);

  const sockets =
    usuariosActivos.get(key);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    usuariosActivos.delete(key);
  }
};

const obtenerSocketsUsuario = (
  usuarioId
) => {
  return (
    usuariosActivos.get(
      String(usuarioId)
    ) || new Set()
  );
};

// ============================================================
// HELPERS DE CHAT
// ============================================================

const normalizarRol = (rol) => {
  const valor = String(
    rol || ''
  ).trim().toLowerCase();

  if (
    valor === 'administrador'
  ) {
    return 'admin';
  }

  return valor;
};

const esAdminSocket = (socket) => {
  return (
    normalizarRol(
      socket.user?.rol
    ) === 'admin'
  );
};

const obtenerIdSocket = (socket) => {
  return Number(
    socket.user?.id || 0
  );
};

// ============================================================
// CONEXIÓN WEBSOCKET
// ============================================================

ioServer.on(
  'connection',
  (socket) => {
    const usuarioId =
      obtenerIdSocket(socket);

    console.log(
      `Usuario autenticado conectado al WebSocket: ${socket.id}`
    );

    agregarSocketUsuario(
      usuarioId,
      socket.id
    );

    // ========================================================
    // EVENTO LEGADO
    // ========================================================
    //
    // El frontend antiguo puede seguir enviando
    // registrar_usuario.
    //
    // PERO ignoramos completamente el userId recibido.
    //
    // La identidad verdadera ya proviene del JWT.
    // ========================================================

    socket.on(
      'registrar_usuario',
      () => {
        socket.emit(
          'usuario_registrado',
          {
            usuario_id: usuarioId
          }
        );
      }
    );

    // ========================================================
    // OBTENER CONTACTOS
    // ========================================================
    //
    // El rol se obtiene del JWT.
    // Nunca confiamos en rolUsuario del cliente.
    // ========================================================

    socket.on(
      'obtener_contactos',
      async () => {
        try {
          const rolUsuario =
            socket.user?.rol;

          const contactos =
            await Usuario.getChatContacts(
              rolUsuario
            );

          socket.emit(
            'lista_contactos',
            contactos
          );
        } catch (error) {
          console.error(
            'Error obteniendo contactos de chat:',
            error
          );

          socket.emit(
            'error_chat',
            'No se pudo cargar la lista de contactos.'
          );
        }
      }
    );

    // ========================================================
    // OBTENER HISTORIAL
    // ========================================================
    //
    // Un usuario solo puede consultar conversaciones:
    //
    // - donde él sea remitente o destinatario
    //
    // Admin puede consultar cualquier conversación.
    // ========================================================

    socket.on(
      'obtener_historial',
      async (payload = {}) => {
        try {
          const remitenteId =
            Number(
              payload.remitente_id
            );

          const destinatarioId =
            Number(
              payload.destinatario_id
            );

          if (
            !Number.isInteger(
              remitenteId
            ) ||
            !Number.isInteger(
              destinatarioId
            ) ||
            remitenteId <= 0 ||
            destinatarioId <= 0
          ) {
            return socket.emit(
              'error_chat',
              'Los identificadores de la conversación no son válidos.'
            );
          }

          const usuarioAutenticadoId =
            obtenerIdSocket(socket);

          const puedeVer =
            esAdminSocket(socket) ||
            remitenteId === usuarioAutenticadoId ||
            destinatarioId === usuarioAutenticadoId;

          if (!puedeVer) {
            return socket.emit(
              'error_chat',
              'No tienes permiso para consultar esta conversación.'
            );
          }

          const [mensajes] =
            await db.query(
              `
                SELECT
                  id,
                  remitente_id,
                  destinatario_id,
                  mensaje,
                  created_at
                FROM chat_mensajes
                WHERE
                  (
                    remitente_id = ?
                    AND destinatario_id = ?
                  )
                  OR
                  (
                    remitente_id = ?
                    AND destinatario_id = ?
                  )
                ORDER BY created_at ASC
              `,
              [
                remitenteId,
                destinatarioId,
                destinatarioId,
                remitenteId
              ]
            );

          return socket.emit(
            'historial_mensajes',
            mensajes
          );
        } catch (error) {
          console.error(
            'Error obteniendo historial de chat:',
            error
          );

          return socket.emit(
            'error_chat',
            'No se pudo recuperar el historial de chat.'
          );
        }
      }
    );

    // ========================================================
    // ENVIAR MENSAJE
    // ========================================================
    //
    // IMPORTANTE:
    // remitente_id enviado por frontend queda IGNORADO.
    //
    // El verdadero remitente es:
    // socket.user.id
    // ========================================================

    socket.on(
      'enviar_mensaje',
      async (payload = {}) => {
        try {
          const destinatarioId =
            Number(
              payload.destinatario_id
            );

          const mensaje =
            typeof payload.mensaje === 'string'
              ? payload.mensaje.trim()
              : '';

          const remitenteId =
            obtenerIdSocket(socket);

          if (
            !Number.isInteger(
              destinatarioId
            ) ||
            destinatarioId <= 0
          ) {
            return socket.emit(
              'error_chat',
              'El destinatario no es válido.'
            );
          }

          if (!mensaje) {
            return socket.emit(
              'error_chat',
              'El mensaje no puede estar vacío.'
            );
          }

          if (mensaje.length > 2000) {
            return socket.emit(
              'error_chat',
              'El mensaje supera el límite permitido de 2000 caracteres.'
            );
          }

          if (
            destinatarioId === remitenteId
          ) {
            return socket.emit(
              'error_chat',
              'No puedes enviarte mensajes a ti mismo.'
            );
          }

          // Verificamos que el destinatario exista.
          const [
            destinatarioRows
          ] = await db.query(
            `
              SELECT id
              FROM usuarios
              WHERE id = ?
              LIMIT 1
            `,
            [destinatarioId]
          );

          if (
            destinatarioRows.length === 0
          ) {
            return socket.emit(
              'error_chat',
              'El usuario destinatario no existe.'
            );
          }

          const [
            result
          ] = await db.query(
            `
              INSERT INTO chat_mensajes
                (
                  remitente_id,
                  destinatario_id,
                  mensaje
                )
              VALUES (?, ?, ?)
            `,
            [
              remitenteId,
              destinatarioId,
              mensaje
            ]
          );

          const nuevoMensaje = {
            id: result.insertId,
            remitente_id:
              remitenteId,
            destinatario_id:
              destinatarioId,
            mensaje,
            created_at:
              new Date()
          };

          // Confirmación al emisor.
          socket.emit(
            'recibir_mensaje',
            nuevoMensaje
          );

          // Envío a todas las conexiones activas
          // del destinatario.
          const socketsDestinatario =
            obtenerSocketsUsuario(
              destinatarioId
            );

          for (
            const socketId
            of socketsDestinatario
          ) {
            ioServer
              .to(socketId)
              .emit(
                'recibir_mensaje',
                nuevoMensaje
              );
          }
        } catch (error) {
          console.error(
            'Error enviando mensaje de chat:',
            error
          );

          socket.emit(
            'error_chat',
            'El mensaje no pudo ser transmitido ni guardado.'
          );
        }
      }
    );

    // ========================================================
    // DESCONECTAR
    // ========================================================

    socket.on(
      'disconnect',
      () => {
        eliminarSocketUsuario(
          usuarioId,
          socket.id
        );

        console.log(
          `Conexión WebSocket cerrada: ${socket.id}`
        );
      }
    );
  }
);

// ============================================================
// ARRANQUE DEL SERVIDOR
// ============================================================

const PORT =
  Number(process.env.PORT) || 5000;

server.listen(
  PORT,
  () => {
    console.log(
      `Servidor ArchiveX híbrido (HTTP + WebSockets) corriendo en puerto ${PORT}`
    );
  }
);