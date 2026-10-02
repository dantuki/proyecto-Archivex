const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const db = require('./config/db');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const Usuario = require('./models/usuarioModel');
const { procesarBajasVencidas } = require('./controllers/settingsController');
const {
  PUBLIC_DIR
} = require('./config/uploadPaths');

// ============================================================
// IMPORTACIÓN DE RUTAS
// ============================================================

const SedeRoutes =
  require('./routes/sedeRoutes');

const usuarioRoutes =
  require('./routes/usuarioRoutes');

const convocatoriaRoutes =
  require('./routes/convocatoriaRoutes');

const solicitudRoutes =
  require('./routes/solicitudRoutes');

const asignacionRoutes =
  require('./routes/asignacionRoutes');

const authRoutes =
  require('./routes/authRoutes');

const settingsRoutes =
  require('./routes/settingsRoutes');

const noticiaRoutes =
  require('./routes/noticiaRoutes');

const postulacionRoutes =
  require('./routes/postulacionRoutes');

const reporteRoutes =
  require('./routes/reporteRoutes');

const fileRoutes =
  require('./routes/fileRoutes');

// ============================================================
// VARIABLES DE ENTORNO
// ============================================================

dotenv.config();

const app =
  express();

// ============================================================
// CONFIGURACIÓN CORS
// ============================================================

const obtenerOrigenesPermitidos = () => {
  const configurado =
    process.env.FRONTEND_ORIGIN;

  if (!configurado) {
    return [
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
  }

  return configurado
    .split(',')
    .map(
      (origen) =>
        origen.trim()
    )
    .filter(Boolean);
};

const origenesPermitidos =
  obtenerOrigenesPermitidos();

const validarOrigen = (
  origin,
  callback
) => {
  if (!origin) {
    return callback(
      null,
      true
    );
  }

  if (
    origenesPermitidos.includes(
      origin
    )
  ) {
    return callback(
      null,
      true
    );
  }

  return callback(
    new Error(
      'Origen no permitido por la política CORS.'
    )
  );
};

const corsOptions = {
  origin:
    validarOrigen,

  methods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'OPTIONS'
  ],

  credentials:
    true,

  optionsSuccessStatus:
    204
};

app.use(
  cors(corsOptions)
);

// ============================================================
// HEADERS DE SEGURIDAD
// ============================================================

app.use(
  helmet()
);

app.use(
  express.json({
    limit:
      '1mb'
  })
);

// ============================================================
// ARCHIVOS PÚBLICOS
// ============================================================
//
// Solo uploads se sirve de forma estática.
//
// uploads_private NO se sirve mediante express.static.
// ============================================================

app.use(
  '/uploads',
  express.static(
    PUBLIC_DIR,
    {
      dotfiles:
        'deny',
      index:
        false
    }
  )
);

// ============================================================
// SERVIDOR HTTP
// ============================================================

const server =
  http.createServer(
    app
  );

// ============================================================
// JWT PARA WEBSOCKETS
// ============================================================

const obtenerJwtSecret = () => {
  const secret =
    process.env.JWT_SECRET;

  if (
    typeof secret !==
      'string' ||
    secret.trim().length <
      32
  ) {
    throw new Error(
      'JWT_SECRET no está configurado correctamente.'
    );
  }

  return secret;
};

const extraerTokenSocket = (
  socket
) => {
  const authToken =
    socket.handshake.auth?.token ||
    socket.handshake.auth?.accessToken;

  if (
    typeof authToken ===
      'string' &&
    authToken.trim()
  ) {
    return authToken.trim();
  }

  const authorization =
    socket.handshake.headers
      ?.authorization;

  if (
    typeof authorization ===
      'string' &&
    authorization
      .toLowerCase()
      .startsWith(
        'bearer '
      )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return null;
};

// ============================================================
// TABLA DE CHAT
// ============================================================

const inicializarTablaChat =
  async () => {
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

      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4;
    `;

    try {
      await db.query(
        queryTabla
      );

      console.log(
        'Tabla "chat_mensajes" verificada/creada con éxito.'
      );
    } catch (error) {
      console.error(
        'Error al inicializar la tabla de chat:',
        error
      );

      throw error;
    }
  };

// ============================================================
// CONEXIÓN A BASE DE DATOS
// ============================================================

db.query(
  'SELECT 1'
)
  .then(
    async () => {
      console.log(
        'Conexión exitosa con el motor MySQL'
      );

      await inicializarTablaChat();
    }
  )
  .catch(
    (error) => {
      console.error(
        'Error en la conexión con la base de datos:',
        error.message
      );
    }
  );

// ============================================================
// MONTAJE DE RUTAS
// ============================================================

app.use(
  '/api/sedes',
  SedeRoutes
);

app.use(
  '/api/usuarios',
  usuarioRoutes
);

app.use(
  '/api/convocatorias',
  convocatoriaRoutes
);

app.use(
  '/api/solicitudes',
  solicitudRoutes
);

// ============================================================
// API OFICIAL DE ASIGNACIONES
// ============================================================
//
// Se mantiene una única ruta oficial:
//
// /api/asignaciones
//
// La ruta antigua /api/asignacion fue retirada después de
// migrar el frontend.
// ============================================================

app.use(
  '/api/asignaciones',
  asignacionRoutes
);

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/settings',
  settingsRoutes
);

app.use(
  '/api/noticias',
  noticiaRoutes
);

app.use(
  '/api/postulaciones',
  postulacionRoutes
);

app.use(
  '/api/reportes',
  reporteRoutes
);

app.use(
  '/api/archivos-privados',
  fileRoutes
);

// ============================================================
// ENDPOINT DE SALUD
// ============================================================

app.get(
  '/',
  (req, res) => {
    return res.status(200).json({
      mensaje:
        'API de ArchiveX operativa con WebSockets',
      estado:
        'Limpio'
    });
  }
);

// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      'Error capturado por el manejador global:',
      err
    );

    if (
      res.headersSent
    ) {
      return next(
        err
      );
    }

    let status =
      Number.isInteger(
        err?.status
      ) &&
      err.status >= 400 &&
      err.status < 600
        ? err.status
        : 500;

    if (
      err?.message ===
      'Origen no permitido por la política CORS.'
    ) {
      status =
        403;
    }

    return res
      .status(status)
      .json({
        status:
          'error',

        message:
          status === 500
            ? 'Error interno del servidor.'
            : 'La solicitud no pudo ser procesada.'
      });
  }
);

// ============================================================
// SOCKET.IO
// ============================================================

const ioServer =
  new Server(
    server,
    {
      cors: {
        origin:
          validarOrigen,

        methods: [
          'GET',
          'POST'
        ],

        credentials:
          true
      },

      maxHttpBufferSize:
        1e6
    }
  );

// ============================================================
// AUTENTICACIÓN DEL SOCKET
// ============================================================

ioServer.use(
  (
    socket,
    next
  ) => {
    try {
      const token =
        extraerTokenSocket(
          socket
        );

      if (!token) {
        return next(
          new Error(
            'No autenticado: se requiere un token de acceso.'
          )
        );
      }

      const jwtSecret =
        obtenerJwtSecret();

      const payload =
        jwt.verify(
          token,
          jwtSecret,
          {
            algorithms:
              ['HS256']
          }
        );

      const usuarioId =
        Number(
          payload?.id ||
          payload?.sub ||
          0
        );

      const rol =
        String(
          payload?.rol ||
          payload?.role ||
          ''
        ).trim();

      if (
        !Number.isInteger(
          usuarioId
        ) ||
        usuarioId <=
          0 ||
        !rol
      ) {
        return next(
          new Error(
            'Token WebSocket inválido.'
          )
        );
      }

      socket.user = {
        id:
          usuarioId,
        rol:
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
  }
);

// ============================================================
// USUARIOS ACTIVOS
// ============================================================
//
// userId -> Set(socketId)
// ============================================================

const usuariosActivos =
  new Map();

const agregarSocketUsuario = (
  usuarioId,
  socketId
) => {
  const key =
    String(
      usuarioId
    );

  if (
    !usuariosActivos.has(
      key
    )
  ) {
    usuariosActivos.set(
      key,
      new Set()
    );
  }

  usuariosActivos
    .get(key)
    .add(
      socketId
    );
};

const eliminarSocketUsuario = (
  usuarioId,
  socketId
) => {
  const key =
    String(
      usuarioId
    );

  const sockets =
    usuariosActivos.get(
      key
    );

  if (!sockets) {
    return;
  }

  sockets.delete(
    socketId
  );

  if (
    sockets.size ===
      0
  ) {
    usuariosActivos.delete(
      key
    );
  }
};

const obtenerSocketsUsuario = (
  usuarioId
) => {
  return (
    usuariosActivos.get(
      String(
        usuarioId
      )
    ) ||
    new Set()
  );
};

// ============================================================
// HELPERS DE CHAT
// ============================================================

const normalizarRol = (
  rol
) => {
  const valor =
    String(
      rol || ''
    )
      .trim()
      .toLowerCase();

  if (
    valor ===
    'administrador'
  ) {
    return 'admin';
  }

  return valor;
};

const esAdminSocket = (
  socket
) => {
  return (
    normalizarRol(
      socket.user?.rol
    ) ===
    'admin'
  );
};

const esEvaluadorSocket = (
  socket
) => {
  return (
    normalizarRol(
      socket.user?.rol
    ) ===
    'evaluador'
  );
};

const puedeUsarChatSocket = (
  socket
) => {
  return (
    esAdminSocket(
      socket
    ) ||
    esEvaluadorSocket(
      socket
    )
  );
};

const obtenerIdSocket = (
  socket
) => {
  return Number(
    socket.user?.id ||
      0
  );
};

// ============================================================
// VALIDAR DESTINATARIO DEL CHAT
// ============================================================
//
// Regla:
//
// Admin -> Evaluador
// Evaluador -> Admin
//
// El rol del destinatario se consulta directamente en BD.
// ============================================================

const puedeComunicarseConUsuario =
  async (
    socket,
    destinatarioId
  ) => {
    const rolRemitente =
      normalizarRol(
        socket.user?.rol
      );

    const [
      rows
    ] = await db.query(
      `
        SELECT
          id,
          rol
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      [
        destinatarioId
      ]
    );

    if (
      rows.length ===
      0
    ) {
      return {
        permitido:
          false,
        existe:
          false
      };
    }

    const rolDestinatario =
      normalizarRol(
        rows[0].rol
      );

    if (
      rolRemitente ===
      'admin'
    ) {
      return {
        permitido:
          rolDestinatario ===
          'evaluador',
        existe:
          true
      };
    }

    if (
      rolRemitente ===
      'evaluador'
    ) {
      return {
        permitido:
          rolDestinatario ===
          'admin',
        existe:
          true
      };
    }

    return {
      permitido:
        false,
      existe:
        true
    };
  };

// ============================================================
// VALIDAR CONVERSACIÓN
// ============================================================

const puedeConsultarConversacion =
  (
    socket,
    otroUsuarioId
  ) => {
    const rol =
      normalizarRol(
        socket.user?.rol
      );

    return (
      rol === 'admin' ||
      rol === 'evaluador'
    );
  };

// ============================================================
// CONEXIÓN WEBSOCKET
// ============================================================

ioServer.on(
  'connection',
  (socket) => {
    const usuarioId =
      obtenerIdSocket(
        socket
      );

    console.log(
      `Usuario autenticado conectado al WebSocket: ${socket.id}`
    );

    agregarSocketUsuario(
      usuarioId,
      socket.id
    );

    // ========================================================
    // REGISTRAR USUARIO
    // ========================================================

    socket.on(
      'registrar_usuario',
      () => {
        if (
          !puedeUsarChatSocket(
            socket
          )
        ) {
          return socket.emit(
            'error_chat',
            'No tienes permisos para utilizar el chat interno.'
          );
        }

        socket.emit(
          'usuario_registrado',
          {
            usuario_id:
              usuarioId
          }
        );
      }
    );

    // ========================================================
    // OBTENER CONTACTOS
    // ========================================================

    socket.on(
      'obtener_contactos',
      async () => {
        try {
          if (
            !puedeUsarChatSocket(
              socket
            )
          ) {
            return socket.emit(
              'error_chat',
              'No tienes permisos para utilizar el chat interno.'
            );
          }

          const contactos =
            await Usuario.getChatContacts(
              socket.user?.rol
            );

          return socket.emit(
            'lista_contactos',
            contactos
          );
        } catch (error) {
          console.error(
            'Error obteniendo contactos de chat:',
            error
          );

          return socket.emit(
            'error_chat',
            'No se pudo cargar la lista de contactos.'
          );
        }
      }
    );

    // ========================================================
    // OBTENER HISTORIAL
    // ========================================================

    socket.on(
      'obtener_historial',
      async (
        payload = {}
      ) => {
        try {
          if (
            !puedeUsarChatSocket(
              socket
            )
          ) {
            return socket.emit(
              'error_chat',
              'No tienes permisos para utilizar el chat interno.'
            );
          }

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
            remitenteId <=
              0 ||
            destinatarioId <=
              0 ||
            remitenteId ===
              destinatarioId
          ) {
            return socket.emit(
              'error_chat',
              'Los identificadores de la conversación no son válidos.'
            );
          }

          const usuarioAutenticadoId =
            obtenerIdSocket(
              socket
            );

          const participa =
            remitenteId ===
              usuarioAutenticadoId ||
            destinatarioId ===
              usuarioAutenticadoId;

          if (
            !participa
          ) {
            return socket.emit(
              'error_chat',
              'No tienes permiso para consultar esta conversación.'
            );
          }

          const otroUsuarioId =
            remitenteId ===
              usuarioAutenticadoId
              ? destinatarioId
              : remitenteId;

          if (
            !puedeConsultarConversacion(
              socket,
              otroUsuarioId
            )
          ) {
            return socket.emit(
              'error_chat',
              'No tienes permiso para consultar esta conversación.'
            );
          }

          const comunicacion =
            await puedeComunicarseConUsuario(
              socket,
              otroUsuarioId
            );

          if (
            !comunicacion.existe
          ) {
            return socket.emit(
              'error_chat',
              'El usuario de la conversación no existe.'
            );
          }

          if (
            !comunicacion.permitido
          ) {
            return socket.emit(
              'error_chat',
              'Esta conversación no está permitida para tu rol.'
            );
          }

          const [
            mensajes
          ] = await db.query(
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

    socket.on(
      'enviar_mensaje',
      async (
        payload = {}
      ) => {
        try {
          if (
            !puedeUsarChatSocket(
              socket
            )
          ) {
            return socket.emit(
              'error_chat',
              'No tienes permisos para utilizar el chat interno.'
            );
          }

          const destinatarioId =
            Number(
              payload.destinatario_id
            );

          const mensaje =
            typeof payload.mensaje ===
              'string'
              ? payload.mensaje.trim()
              : '';

          // La identidad real siempre sale del JWT.
          const remitenteId =
            obtenerIdSocket(
              socket
            );

          if (
            !Number.isInteger(
              destinatarioId
            ) ||
            destinatarioId <=
              0
          ) {
            return socket.emit(
              'error_chat',
              'El destinatario no es válido.'
            );
          }

          if (
            !mensaje
          ) {
            return socket.emit(
              'error_chat',
              'El mensaje no puede estar vacío.'
            );
          }

          if (
            mensaje.length >
            2000
          ) {
            return socket.emit(
              'error_chat',
              'El mensaje supera el límite permitido de 2000 caracteres.'
            );
          }

          if (
            destinatarioId ===
            remitenteId
          ) {
            return socket.emit(
              'error_chat',
              'No puedes enviarte mensajes a ti mismo.'
            );
          }

          // --------------------------------------------------
          // VALIDAR DESTINATARIO
          // --------------------------------------------------

          const comunicacion =
            await puedeComunicarseConUsuario(
              socket,
              destinatarioId
            );

          if (
            !comunicacion.existe
          ) {
            return socket.emit(
              'error_chat',
              'El usuario destinatario no existe.'
            );
          }

          if (
            !comunicacion.permitido
          ) {
            return socket.emit(
              'error_chat',
              'No puedes enviar mensajes a este usuario.'
            );
          }

          // --------------------------------------------------
          // PERSISTIR
          // --------------------------------------------------

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
            id:
              result.insertId,

            remitente_id:
              remitenteId,

            destinatario_id:
              destinatarioId,

            mensaje,

            created_at:
              new Date()
          };

          // --------------------------------------------------
          // CONFIRMACIÓN AL EMISOR
          // --------------------------------------------------

          socket.emit(
            'recibir_mensaje',
            nuevoMensaje
          );

          // --------------------------------------------------
          // ENVIAR AL DESTINATARIO
          // --------------------------------------------------

          const socketsDestinatario =
            obtenerSocketsUsuario(
              destinatarioId
            );

          for (
            const socketId
            of socketsDestinatario
          ) {
            ioServer
              .to(
                socketId
              )
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
  Number(
    process.env.PORT
  ) || 5000;

const programarAnonimizacionDeCuentas = () => {
  const procesar = async () => {
    try {
      const total = await procesarBajasVencidas();
      if (total > 0) {
        console.info(`Se anonimizaron ${total} cuentas vencidas; los expedientes institucionales se conservaron.`);
      }
    } catch (error) {
      console.error('No fue posible procesar las bajas vencidas:', error.code || 'error interno');
    }
  };

  void procesar();
  const intervalo = setInterval(() => void procesar(), 24 * 60 * 60 * 1000);
  intervalo.unref();
};

server.listen(
  PORT,
  () => {
    console.log(
      `Servidor ArchiveX híbrido (HTTP + WebSockets) corriendo en puerto ${PORT}`
    );
    programarAnonimizacionDeCuentas();
  }
);
