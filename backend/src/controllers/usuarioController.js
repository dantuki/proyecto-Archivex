const Usuario =
  require('../models/usuarioModel');

const bcrypt =
  require('bcrypt');

const pool =
  require('../config/db.js');

const fs =
  require('fs');

const path =
  require('path');

const {
  PUBLIC_DIR,
  PRIVATE_DIR
} =
  require('../config/uploadPaths');

const {
  ADMIN_EMAIL
} =
  require('../config/securityConfig');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ROLES_VALIDOS = [
  'Admin',
  'Profesor',
  'Evaluador'
];

// ============================================================
// UTILIDADES
// ============================================================

const normalizarEmail =
  (email) => {
    if (
      typeof email !==
      'string'
    ) {
      return null;
    }

    const valor =
      email
        .trim()
        .toLowerCase();

    return valor || null;
  };

const esAdminUser =
  (req) => {
    const rol =
      String(
        req.user?.rol || ''
      )
        .trim()
        .toLowerCase();

    const email =
      normalizarEmail(
        req.user?.email
      );

    return (
      (
        rol === 'admin' ||
        rol === 'administrador'
      ) &&
      email ===
        ADMIN_EMAIL
    );
  };

// ============================================================
// OBTENER ID AUTENTICADO
// ============================================================

const obtenerUsuarioAutenticadoId =
  (req) => {
    return (
      req.user?.id ||
      req.user?.usuario_id ||
      req.user?.id_usuario ||
      req.user?.userId
    );
  };

// ============================================================
// VALIDAR ID
// ============================================================

const obtenerIdNumerico =
  (valor) => {
    const id =
      Number.parseInt(
        valor,
        10
      );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return null;
    }

    return id;
  };

// ============================================================
// RESPUESTA SEGURA
// ============================================================

const usuarioSeguro =
  (usuario) => {
    if (
      !usuario ||
      typeof usuario !==
        'object'
    ) {
      return usuario;
    }

    const {
      password,
      contrasena,
      ...datosSeguros
    } = usuario;

    return datosSeguros;
  };

// ============================================================
// RESOLVER ARCHIVO FÍSICO
// ============================================================

const obtenerRutaArchivo =
  (
    archivoUrl,
    directorioBase
  ) => {
    if (!archivoUrl) {
      return null;
    }

    const valorNormalizado =
      String(
        archivoUrl
      )
        .replace(
          /\\/g,
          '/'
        )
        .replace(
          /^\/+/,
          ''
        );

    const nombreArchivo =
      path.basename(
        valorNormalizado
      );

    if (
      !nombreArchivo ||
      nombreArchivo === '.' ||
      nombreArchivo !==
        valorNormalizado
          .split('/')
          .pop()
    ) {
      return null;
    }

    const root =
      path.resolve(
        directorioBase
      );

    const rutaFinal =
      path.resolve(
        root,
        nombreArchivo
      );

    if (
      rutaFinal !== root &&
      !rutaFinal.startsWith(
        `${root}${path.sep}`
      )
    ) {
      return null;
    }

    return rutaFinal;
  };

// ============================================================
// ELIMINAR ARCHIVO
// ============================================================

const eliminarArchivo =
  async (
    archivoUrl,
    directorioBase
  ) => {
    const ruta =
      obtenerRutaArchivo(
        archivoUrl,
        directorioBase
      );

    if (!ruta) {
      return;
    }

    try {
      await fs.promises.unlink(
        ruta
      );
    } catch (error) {
      if (
        error.code !==
        'ENOENT'
      ) {
        console.error(
          'Error al eliminar archivo:',
          error
        );
      }
    }
  };

// ============================================================
// OBTENER ARCHIVOS DE USUARIO
// ============================================================

const obtenerArchivosUsuario =
  async (
    usuarioId
  ) => {
    const archivos = [];

    const [
      usuarioRows
    ] =
      await pool.query(
        `
          SELECT
            foto_url,
            certificado_url
          FROM usuarios
          WHERE id = ?
          LIMIT 1
        `,
        [
          usuarioId
        ]
      );

    if (
      usuarioRows.length >
      0
    ) {
      const usuario =
        usuarioRows[0];

      if (
        usuario.foto_url
      ) {
        archivos.push({
          url:
            usuario.foto_url,
          dir:
            PUBLIC_DIR
        });
      }

      if (
        usuario.certificado_url
      ) {
        archivos.push({
          url:
            usuario.certificado_url,
          dir:
            PRIVATE_DIR
        });
      }
    }

    const [
      noticiasRows
    ] =
      await pool.query(
        `
          SELECT
            archivo_url
          FROM noticias
          WHERE usuario_id = ?
        `,
        [
          usuarioId
        ]
      );

    for (
      const noticia
      of noticiasRows
    ) {
      if (
        noticia.archivo_url
      ) {
        archivos.push({
          url:
            noticia.archivo_url,
          dir:
            PRIVATE_DIR
        });
      }
    }

    const [
      solicitudesRows
    ] =
      await pool.query(
        `
          SELECT
            presupuesto_url,
            cronograma_url,
            honestidad_url,
            id_url
          FROM solicitudes
          WHERE usuario_id = ?
        `,
        [
          usuarioId
        ]
      );

    for (
      const solicitud
      of solicitudesRows
    ) {
      [
        solicitud.presupuesto_url,
        solicitud.cronograma_url,
        solicitud.honestidad_url,
        solicitud.id_url
      ].forEach(
        (
          archivo
        ) => {
          if (
            archivo
          ) {
            archivos.push({
              url:
                archivo,
              dir:
                PRIVATE_DIR
            });
          }
        }
      );
    }

    const [
      documentosRows
    ] =
      await pool.query(
        `
          SELECT
            ds.archivo_url
          FROM documentos_solicitud ds
          INNER JOIN solicitudes s
            ON ds.solicitud_id = s.id
          WHERE s.usuario_id = ?
        `,
        [
          usuarioId
        ]
      );

    for (
      const documento
      of documentosRows
    ) {
      if (
        documento.archivo_url
      ) {
        archivos.push({
          url:
            documento.archivo_url,
          dir:
            PRIVATE_DIR
        });
      }
    }

    const [
      evaluacionesRows
    ] =
      await pool.query(
        `
          SELECT
            ae.archivo_evaluacion
          FROM asignacion_evaluaciones ae
          INNER JOIN solicitudes s
            ON ae.solicitud_id = s.id
          WHERE s.usuario_id = ?
        `,
        [
          usuarioId
        ]
      );

    for (
      const evaluacion
      of evaluacionesRows
    ) {
      if (
        evaluacion.archivo_evaluacion
      ) {
        archivos.push({
          url:
            evaluacion.archivo_evaluacion,
          dir:
            PRIVATE_DIR
        });
      }
    }

    return archivos;
  };

// ============================================================
// GET /api/usuarios
// ============================================================

const getUsuarios =
  async (
    req,
    res
  ) => {
    try {
      if (
        !esAdminUser(req)
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para consultar los usuarios.'
        });
      }

      const usuarios =
        await Usuario.getAll();

      const usuariosSeguros =
        Array.isArray(
          usuarios
        )
          ? usuarios.map(
              usuarioSeguro
            )
          : [];

      return res.status(200).json({
        status:
          'success',
        data:
          usuariosSeguros
      });
    } catch (error) {
      console.error(
        'Error al obtener usuarios:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'Error al obtener los usuarios.'
      });
    }
  };

// ============================================================
// GET /api/usuarios/:id
// ============================================================

const getUsuarioById =
  async (
    req,
    res
  ) => {
    try {
      const idSolicitado =
        obtenerIdNumerico(
          req.params.id
        );

      if (
        !idSolicitado
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }

      const idAutenticado =
        obtenerIdNumerico(
          obtenerUsuarioAutenticadoId(
            req
          )
        );

      if (
        !idAutenticado
      ) {
        return res.status(401).json({
          status:
            'error',
          message:
            'No se pudo identificar al usuario autenticado.'
        });
      }

      if (
        !esAdminUser(req) &&
        idAutenticado !==
          idSolicitado
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permiso para consultar este usuario.'
        });
      }

      const usuario =
        await Usuario.getById(
          idSolicitado
        );

      if (
        !usuario
      ) {
        return res.status(404).json({
          status:
            'fail',
          message:
            'Usuario no encontrado.'
        });
      }

      return res.status(200).json({
        status:
          'success',
        data:
          usuarioSeguro(
            usuario
          )
      });
    } catch (error) {
      console.error(
        'Error al obtener usuario por ID:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'Error al obtener el usuario.'
      });
    }
  };

// ============================================================
// GET /api/usuarios/evaluadores
// ============================================================

const getEvaluadores =
  async (
    req,
    res
  ) => {
    try {
      if (
        !esAdminUser(req)
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para consultar evaluadores.'
        });
      }

      const evaluadores =
        await Usuario.getEvaluadores();

      const evaluadoresSeguros =
        Array.isArray(
          evaluadores
        )
          ? evaluadores.map(
              usuarioSeguro
            )
          : [];

      return res.status(200).json({
        status:
          'success',
        data:
          evaluadoresSeguros
      });
    } catch (error) {
      console.error(
        'Error al obtener evaluadores:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'Error al obtener los evaluadores.'
      });
    }
  };

// ============================================================
// POST /api/usuarios/registro
// ============================================================
//
// Esta ruta ya está protegida y solo puede utilizarla el Admin.
//
// Reglas:
//
// - El Admin puede crear usuarios.
// - Solo Aracelly puede tener rol Admin.
// - El correo de Aracelly está reservado.
// ============================================================

const registrarUsuario =
  async (
    req,
    res
  ) => {
    try {
      if (
        !esAdminUser(req)
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para crear usuarios.'
        });
      }

      const {
        contrasena,
        password,
        rol,
        ...datosUsuario
      } =
        req.body || {};

      const contrasenaOriginal =
        typeof contrasena ===
            'string' &&
        contrasena.trim()
          ? contrasena
          : typeof password ===
              'string' &&
            password.trim()
          ? password
          : null;

      if (
        typeof datosUsuario.nombre_completo !==
          'string' ||
        !datosUsuario.nombre_completo.trim()
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El nombre completo es obligatorio.'
        });
      }

      if (
        typeof datosUsuario.email !==
          'string' ||
        !datosUsuario.email.trim()
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El correo electrónico es obligatorio.'
        });
      }

      if (
        !contrasenaOriginal
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'La contraseña es obligatoria.'
        });
      }

      const nombreFinal =
        datosUsuario.nombre_completo
          .trim();

      if (
        nombreFinal.length >
        150
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El nombre completo no puede superar los 150 caracteres.'
        });
      }

      const emailNormalizado =
        normalizarEmail(
          datosUsuario.email
        );

      if (
        !emailNormalizado
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El correo electrónico no es válido.'
        });
      }

      if (
        emailNormalizado.length >
        100
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El correo electrónico no puede superar los 100 caracteres.'
        });
      }

      const rolFinal =
        ROLES_VALIDOS.includes(
          rol
        )
          ? rol
          : 'Profesor';

      // ------------------------------------------------------
      // REGLA DEL ADMINISTRADOR ÚNICO
      // ------------------------------------------------------

      if (
        rolFinal ===
        'Admin'
      ) {
        if (
          emailNormalizado !==
          ADMIN_EMAIL
        ) {
          return res.status(403).json({
            status:
              'error',
            message:
              'El único correo autorizado para el rol Administrador es el correo institucional configurado para la administración de ArchiveX.'
          });
        }
      }

      if (
        emailNormalizado ===
        ADMIN_EMAIL &&
        rolFinal !==
        'Admin'
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'El correo reservado para la administración solo puede utilizarse con el rol Admin.'
        });
      }

      // ------------------------------------------------------
      // COMPROBAR EMAIL
      // ------------------------------------------------------

      const [
        usuarioExistente
      ] =
        await pool.query(
          `
            SELECT
              id,
              rol
            FROM usuarios
            WHERE email = ?
            LIMIT 1
          `,
          [
            emailNormalizado
          ]
        );

      if (
        usuarioExistente.length >
        0
      ) {
        return res.status(409).json({
          status:
            'error',
          message:
            'El correo electrónico ya está registrado.'
        });
      }

      // ------------------------------------------------------
      // CÉDULA
      // ------------------------------------------------------

      if (
        datosUsuario.cedula
      ) {
        datosUsuario.cedula =
          String(
            datosUsuario.cedula
          ).trim();
      }

      if (
        !datosUsuario.cedula
      ) {
        datosUsuario.cedula =
          `CC-${Date.now()
            .toString()
            .slice(-8)}`;
      }

      if (
        String(
          datosUsuario.cedula
        ).length >
        20
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'La cédula no puede superar los 20 caracteres.'
        });
      }

      // ------------------------------------------------------
      // COMPROBAR CÉDULA
      // ------------------------------------------------------

      const [
        cedulaExistente
      ] =
        await pool.query(
          `
            SELECT id
            FROM usuarios
            WHERE cedula = ?
            LIMIT 1
          `,
          [
            datosUsuario.cedula
          ]
        );

      if (
        cedulaExistente.length >
        0
      ) {
        return res.status(409).json({
          status:
            'error',
          message:
            'La cédula ya está registrada.'
        });
      }

      // ------------------------------------------------------
      // HASH
      // ------------------------------------------------------

      const passwordHash =
        await bcrypt.hash(
          contrasenaOriginal,
          10
        );

      const datosFinales = {
        ...datosUsuario,

        nombre_completo:
          nombreFinal,

        email:
          emailNormalizado,

        rol:
          rolFinal,

        password:
          passwordHash
      };

      const id =
        await Usuario.create(
          datosFinales
        );

      // ------------------------------------------------------
      // SINCRONIZAR LOGIN
      // ------------------------------------------------------

      await pool.query(
        `
          INSERT INTO login
          (
            usuario_id,
            email,
            password
          )
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            password = VALUES(password)
        `,
        [
          id,
          emailNormalizado,
          passwordHash
        ]
      );

      return res.status(201).json({
        status:
          'success',
        message:
          'Usuario creado correctamente.',
        id
      });
    } catch (error) {
      console.error(
        'Error al registrar usuario:',
        error
      );

      if (
        error?.code ===
          'ER_DUP_ENTRY' ||
        error?.errno ===
          1062
      ) {
        return res.status(409).json({
          status:
            'error',
          message:
            'El correo o la cédula ya están registrados.'
        });
      }

      return res.status(500).json({
        status:
          'error',
        message:
          'Error al registrar el usuario.'
      });
    }
  };

// ============================================================
// PUT /api/usuarios/:id
// ============================================================

const updateUsuario =
  async (
    req,
    res
  ) => {
    const archivosNuevos = [];
    let conexion = null;
    let confirmado = false;

    if (
      req.files?.foto?.[0]
    ) {
      archivosNuevos.push({
        tipo:
          'foto',

        filename:
          req.files.foto[0]
            .filename,

        url:
          `/uploads/${req.files.foto[0].filename}`
      });
    }

    if (
      req.files?.certificado?.[0]
    ) {
      archivosNuevos.push({
        tipo:
          'certificado',

        filename:
          req.files.certificado[0]
            .filename,

        url:
          `/uploads_private/${req.files.certificado[0].filename}`
      });
    }

    const limpiarArchivosNuevos =
      async () => {
        await Promise.all(
          archivosNuevos.map(
            async (
              archivo
            ) =>
              eliminarArchivo(
                archivo.url,
                archivo.tipo ===
                  'foto'
                  ? PUBLIC_DIR
                  : PRIVATE_DIR
              )
          )
        );
      };

    try {
      const id =
        obtenerIdNumerico(
          req.params.id
        );

      if (!id) {
        await limpiarArchivosNuevos();

        return res.status(400).json({
          status:
            'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }

      const idAutenticado =
        obtenerIdNumerico(
          obtenerUsuarioAutenticadoId(
            req
          )
        );

      if (!idAutenticado) {
        await limpiarArchivosNuevos();

        return res.status(401).json({
          status:
            'error',
          message:
            'No se pudo identificar al usuario autenticado.'
        });
      }

      const esAdmin =
        esAdminUser(req);

      const esDuenio =
        idAutenticado ===
        id;

      if (
        !esAdmin &&
        !esDuenio
      ) {
        await limpiarArchivosNuevos();

        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permiso para modificar este usuario.'
        });
      }

      const usuarioActual =
        await Usuario.getById(
          id
        );

      if (
        !usuarioActual
      ) {
        await limpiarArchivosNuevos();

        return res.status(404).json({
          status:
            'fail',
          message:
            'Usuario no encontrado para actualizar.'
        });
      }

      const emailActual =
        normalizarEmail(
          usuarioActual.email
        );

      const rolActual =
        String(
          usuarioActual.rol ||
            ''
        ).trim();

      const esCuentaAdmin =
        emailActual ===
          ADMIN_EMAIL &&
        (
          rolActual ===
            'Admin' ||
          rolActual.toLowerCase() ===
            'administrador'
        );

      // ------------------------------------------------------
      // LISTA BLANCA
      // ------------------------------------------------------

      const CAMPOS_PERMITIDOS = [
        'cedula',
        'nombre_completo',
        'email',
        'telefono',
        'direccion',
        'nivel_educativo',
        'carrera_titulo',
        'fecha_nacimiento'
      ];

      const datosActualizar =
        {};

      for (
        const campo of
        CAMPOS_PERMITIDOS
      ) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            campo
          )
        ) {
          datosActualizar[
            campo
          ] =
            req.body[
              campo
            ];
        }
      }

      // ------------------------------------------------------
      // PREVISIÓN DEL ESTADO FINAL
      // ------------------------------------------------------

      const emailSolicitado =
        Object.prototype.hasOwnProperty.call(
          datosActualizar,
          'email'
        )
          ? normalizarEmail(
              datosActualizar.email
            )
          : emailActual;

      const rolSolicitado =
        Object.prototype.hasOwnProperty.call(
          req.body,
          'rol'
        )
          ? String(
              req.body.rol || ''
            ).trim()
          : rolActual;

      if (
        Object.prototype.hasOwnProperty.call(
          datosActualizar,
          'email'
        ) &&
        !emailSolicitado
      ) {
        await limpiarArchivosNuevos();

        return res.status(400).json({
          status:
            'error',
          message:
            'El correo electrónico no es válido.'
        });
      }

      // ------------------------------------------------------
      // PROTECCIÓN DE LA CUENTA ADMINISTRATIVA
      // ------------------------------------------------------

      if (
        esCuentaAdmin &&
        (
          (
            emailSolicitado !==
            ADMIN_EMAIL
          ) ||
          (
            rolSolicitado !==
              'Admin' &&
            rolSolicitado !==
              'Administrador'
          )
        )
      ) {
        await limpiarArchivosNuevos();

        return res.status(403).json({
          status:
            'error',
          message:
            'La cuenta administrativa principal no puede cambiar de correo ni perder su rol administrativo.'
        });
      }

      // ------------------------------------------------------
      // VALIDAR ROL SOLICITADO
      // ------------------------------------------------------

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          'rol'
        )
      ) {
        if (!esAdmin) {
          await limpiarArchivosNuevos();

          return res.status(403).json({
            status:
              'error',
            message:
              'Solo un administrador puede modificar el rol.'
          });
        }

        if (
          !ROLES_VALIDOS.includes(
            rolSolicitado
          )
        ) {
          await limpiarArchivosNuevos();

          return res.status(400).json({
            status:
              'error',
            message:
              'Rol no válido.'
          });
        }

        if (
          rolSolicitado ===
          'Admin' &&
          emailSolicitado !==
            ADMIN_EMAIL
        ) {
          await limpiarArchivosNuevos();

          return res.status(403).json({
            status:
              'error',
            message:
              'El único correo autorizado para el rol Administrador es el correo institucional configurado para la administración de ArchiveX.'
          });
        }

        if (
          emailSolicitado ===
          ADMIN_EMAIL &&
          rolSolicitado !==
            'Admin'
        ) {
          await limpiarArchivosNuevos();

          return res.status(403).json({
            status:
              'error',
            message:
              'El correo reservado para la administración solo puede utilizarse con el rol Admin.'
          });
        }

        datosActualizar.rol =
          rolSolicitado;
      }

      // ------------------------------------------------------
      // CÉDULA
      // ------------------------------------------------------

      if (
        datosActualizar.cedula !==
        undefined
      ) {
        if (
          typeof datosActualizar.cedula !==
          'string'
        ) {
          throw new Error(
            'La cédula no es válida.'
          );
        }

        datosActualizar.cedula =
          datosActualizar.cedula.trim();

        if (
          !datosActualizar.cedula
        ) {
          throw new Error(
            'La cédula no puede estar vacía.'
          );
        }

        if (
          datosActualizar.cedula.length >
          20
        ) {
          throw new Error(
            'La cédula no puede superar los 20 caracteres.'
          );
        }

        const [
          cedulaRows
        ] =
          await pool.query(
            `
              SELECT id
              FROM usuarios
              WHERE cedula = ?
                AND id <> ?
              LIMIT 1
            `,
            [
              datosActualizar.cedula,
              id
            ]
          );

        if (
          cedulaRows.length >
          0
        ) {
          await limpiarArchivosNuevos();

          return res.status(409).json({
            status:
              'error',
            message:
              'La cédula ya está registrada por otro usuario.'
          });
        }
      }

      // ------------------------------------------------------
      // NOMBRE
      // ------------------------------------------------------

      if (
        datosActualizar.nombre_completo !==
        undefined
      ) {
        if (
          typeof datosActualizar.nombre_completo !==
          'string'
        ) {
          throw new Error(
            'El nombre completo no es válido.'
          );
        }

        datosActualizar.nombre_completo =
          datosActualizar.nombre_completo.trim();

        if (
          !datosActualizar.nombre_completo
        ) {
          throw new Error(
            'El nombre completo no puede estar vacío.'
          );
        }

        if (
          datosActualizar.nombre_completo
            .length >
          150
        ) {
          throw new Error(
            'El nombre completo no puede superar los 150 caracteres.'
          );
        }
      }

      // ------------------------------------------------------
      // EMAIL
      // ------------------------------------------------------

      if (
        datosActualizar.email !==
        undefined
      ) {
        if (
          !emailSolicitado
        ) {
          throw new Error(
            'El correo electrónico no es válido.'
          );
        }

        datosActualizar.email =
          emailSolicitado;

        if (
          datosActualizar.email.length >
          100
        ) {
          throw new Error(
            'El correo electrónico no puede superar los 100 caracteres.'
          );
        }

        if (
          datosActualizar.email ===
          ADMIN_EMAIL &&
          (
            rolSolicitado !==
              'Admin' &&
            rolSolicitado !==
              'Administrador'
          )
        ) {
          await limpiarArchivosNuevos();

          return res.status(403).json({
            status:
              'error',
            message:
              'El correo reservado para la administración solo puede utilizarse con el rol Admin.'
          });
        }

        const [
          emailRows
        ] =
          await pool.query(
            `
              SELECT id
              FROM usuarios
              WHERE email = ?
                AND id <> ?
              LIMIT 1
            `,
            [
              datosActualizar.email,
              id
            ]
          );

        if (
          emailRows.length >
          0
        ) {
          await limpiarArchivosNuevos();

          return res.status(409).json({
            status:
              'error',
            message:
              'El correo electrónico ya está registrado por otro usuario.'
          });
        }
      }

      // ------------------------------------------------------
      // CONTRASEÑA
      // ------------------------------------------------------

      const contrasenaSolicitada =
        typeof req.body.contrasena ===
          'string'
          ? req.body.contrasena
          : typeof req.body.password ===
              'string'
            ? req.body.password
            : null;

      if (
        contrasenaSolicitada !==
        null
      ) {
        if (
          !contrasenaSolicitada.trim()
        ) {
          throw new Error(
            'La nueva contraseña no puede estar vacía.'
          );
        }

        if (
          contrasenaSolicitada.length <
          8
        ) {
          throw new Error(
            'La nueva contraseña debe tener al menos 8 caracteres.'
          );
        }

        datosActualizar.password =
          await bcrypt.hash(
            contrasenaSolicitada,
            10
          );
      }

      // ------------------------------------------------------
      // FOTO
      // ------------------------------------------------------

      if (
        req.files?.foto?.[0]
      ) {
        datosActualizar.foto_url =
          `/uploads/${req.files.foto[0].filename}`;
      }

      // ------------------------------------------------------
      // CERTIFICADO
      // ------------------------------------------------------

      if (
        req.files?.certificado?.[0]
      ) {
        datosActualizar.certificado_url =
          `/uploads_private/${req.files.certificado[0].filename}`;
      }

      // ------------------------------------------------------
      // EVITAR UPDATE VACÍO
      // ------------------------------------------------------

      if (
        Object.keys(
          datosActualizar
        ).length ===
        0
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'No se proporcionaron cambios válidos.'
        });
      }

      // ------------------------------------------------------
      // ACTUALIZAR USUARIO Y LOGIN EN UNA TRANSACCIÓN
      // ------------------------------------------------------
      //
      // Solo se sincronizan con login los campos realmente
      // enviados (email y/o hash de la nueva contraseña); si no
      // cambian, login.password no se toca.
      // ------------------------------------------------------

      const datosLogin = {};

      if (
        datosActualizar.email !==
        undefined
      ) {
        datosLogin.email =
          datosActualizar.email;
      }

      if (
        datosActualizar.password !==
        undefined
      ) {
        datosLogin.password =
          datosActualizar.password;
      }

      conexion =
        await pool.getConnection();

      await conexion.beginTransaction();

      const affectedRows =
        await Usuario.update(
          id,
          datosActualizar,
          conexion
        );

      if (
        affectedRows ===
        0
      ) {
        await conexion.rollback();

        await limpiarArchivosNuevos();

        return res.status(404).json({
          status:
            'fail',
          message:
            'Usuario no encontrado para actualizar.'
        });
      }

      await Usuario.syncLogin(
        id,
        datosLogin,
        conexion
      );

      await conexion.commit();

      confirmado =
        true;

      // ------------------------------------------------------
      // ELIMINAR ARCHIVOS ANTERIORES
      // ------------------------------------------------------

      const archivosAnteriores =
        [];

      if (
        req.files?.foto?.[0] &&
        usuarioActual.foto_url
      ) {
        archivosAnteriores.push({
          url:
            usuarioActual.foto_url,
          dir:
            PUBLIC_DIR
        });
      }

      if (
        req.files?.certificado?.[0] &&
        usuarioActual.certificado_url
      ) {
        archivosAnteriores.push({
          url:
            usuarioActual.certificado_url,
          dir:
            PRIVATE_DIR
        });
      }

      await Promise.all(
        archivosAnteriores.map(
          (
            archivo
          ) =>
            eliminarArchivo(
              archivo.url,
              archivo.dir
            )
        )
      );

      const usuarioFinal =
        await Usuario.getById(
          id
        );

      return res.status(200).json({
        status:
          'success',
        message:
          'Usuario actualizado correctamente.',
        data:
          usuarioSeguro(
            usuarioFinal
          )
      });
    } catch (error) {
      if (
        conexion
      ) {
        try {
          await conexion.rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            'Error en rollback de actualización de usuario:',
            rollbackError.message
          );
        }
      }

      // Tras el commit, los archivos nuevos ya están referenciados en la BD.
      if (
        !confirmado
      ) {
        await limpiarArchivosNuevos();
      }

      console.error(
        'Error al actualizar usuario:',
        error
      );

      const mensajesValidacion = [
        'no es válida',
        'no puede estar',
        'no puede superar',
        'debe tener al menos',
        'no puede ser'
      ];

      const esErrorValidacion =
        error instanceof
          Error &&
        mensajesValidacion.some(
          (
            fragmento
          ) =>
            error.message.includes(
              fragmento
            )
        );

      return res.status(
        esErrorValidacion
          ? 400
          : 500
      ).json({
        status:
          'error',
        message:
          esErrorValidacion
            ? error.message
            : 'Error al actualizar el usuario.'
      });
    } finally {
      if (
        conexion
      ) {
        conexion.release();
      }
    }
  };

// ============================================================
// DELETE /api/usuarios/:id
// ============================================================

const deleteUsuario =
  async (
    req,
    res
  ) => {
    try {
      if (
        !esAdminUser(req)
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para eliminar usuarios.'
        });
      }

      const id =
        obtenerIdNumerico(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }

      const usuario =
        await Usuario.getById(
          id
        );

      if (
        !usuario
      ) {
        return res.status(404).json({
          status:
            'fail',
          message:
            'Usuario no encontrado para eliminar.'
        });
      }

      const usuarioEmail =
        normalizarEmail(
          usuario.email
        );

      const usuarioRol =
        String(
          usuario.rol || ''
        )
          .trim()
          .toLowerCase();

      if (
        usuarioEmail ===
          ADMIN_EMAIL &&
        (
          usuarioRol ===
            'admin' ||
          usuarioRol ===
            'administrador'
        )
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'La cuenta administrativa principal no puede eliminarse desde la gestión normal de usuarios.'
        });
      }

      const archivos =
        await obtenerArchivosUsuario(
          id
        );

      const affectedRows =
        await Usuario.delete(
          id
        );

      if (
        affectedRows ===
        0
      ) {
        return res.status(404).json({
          status:
            'fail',
          message:
            'Usuario no encontrado para eliminar.'
        });
      }

      await Promise.all(
        archivos.map(
          (
            archivo
          ) =>
            eliminarArchivo(
              archivo.url,
              archivo.dir
            )
        )
      );

      return res.status(200).json({
        status:
          'success',
        message:
          'Usuario eliminado correctamente.'
      });
    } catch (error) {
      console.error(
        'Error al eliminar usuario:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'Error al eliminar el usuario.'
      });
    }
  };

// ============================================================
// DELETE /api/usuarios/mantenimiento/purgar-todo
// ============================================================

const limpiarTablaDesarrollo =
  async (
    req,
    res
  ) => {
    try {
      if (
        !esAdminUser(req)
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para ejecutar esta operación.'
        });
      }

      if (
        String(
          process.env.NODE_ENV ||
            ''
        ).toLowerCase() ===
        'production'
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'Esta operación está deshabilitada en producción.'
        });
      }

      const [
        usuarios
      ] =
        await pool.query(
          `
            SELECT id
            FROM usuarios
          `
        );

      const archivos =
        [];

      for (
        const usuario of
        usuarios
      ) {
        const archivosUsuario =
          await obtenerArchivosUsuario(
            usuario.id
          );

        archivos.push(
          ...archivosUsuario
        );
      }

      await Usuario.truncate();

      await Promise.all(
        archivos.map(
          (
            archivo
          ) =>
            eliminarArchivo(
              archivo.url,
              archivo.dir
            )
        )
      );

      return res.status(200).json({
        status:
          'success',
        message:
          'Tabla de usuarios purgada correctamente en entorno de desarrollo.'
      });
    } catch (error) {
      console.error(
        'Error al purgar usuarios:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible completar la operación.'
      });
    }
  };

module.exports = {
  getUsuarios,
  getUsuarioById,
  getEvaluadores,
  registrarUsuario,
  updateUsuario,
  deleteUsuario,
  limpiarTablaDesarrollo
};