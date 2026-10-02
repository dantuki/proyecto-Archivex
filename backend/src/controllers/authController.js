const bcrypt =
  require('bcrypt');

const jwt =
  require('jsonwebtoken');

const crypto =
  require('crypto');

const pool =
  require('../config/db.js');

const {
  ADMIN_EMAIL
} =
  require('../config/securityConfig');

const {
  enviarCorreoRecuperacion,
  enviarCorreoVerificacion,
  enviarCorreoVerificacionDispositivo
} =
  require('../services/emailService');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const MIN_PASSWORD_LENGTH =
  8;

const MAX_PASSWORD_LENGTH =
  128;

const MAX_NAME_LENGTH =
  150;

const MAX_EMAIL_LENGTH =
  100;

const MAX_CEDULA_LENGTH =
  20;

const JWT_EXPIRATION =
  '24h';

const JWT_ALGORITHM =
  'HS256';

const RECAPTCHA_VERIFY_URL =
  'https://www.google.com/recaptcha/api/siteverify';

const PASSWORD_RESET_TOKEN_BYTES =
  32;

const PASSWORD_RESET_EXPIRATION_MINUTES =
  30;

const EMAIL_VERIFICATION_TOKEN_BYTES =
  32;

const EMAIL_VERIFICATION_EXPIRATION_HOURS =
  24;

const DEVICE_VERIFICATION_EXPIRATION_MINUTES =
  15;

// ============================================================
// OBTENER SECRET JWT
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
      'JWT_SECRET no está configurado correctamente. Debe existir una variable de entorno segura de al menos 32 caracteres.'
    );
  }

  return secret;
};

// ============================================================
// NORMALIZAR EMAIL
// ============================================================

const normalizarEmail = (
  email
) => {
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

  if (!valor) {
    return null;
  }

  if (
    valor.length >
    MAX_EMAIL_LENGTH
  ) {
    return null;
  }

  const patron =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !patron.test(valor)
  ) {
    return null;
  }

  return valor;
};

// ============================================================
// VALIDAR CONTRASEÑA
// ============================================================

const validarPassword = (
  password
) => {
  if (
    typeof password !==
    'string'
  ) {
    return false;
  }

  if (
    password.length <
      MIN_PASSWORD_LENGTH ||
    password.length >
      MAX_PASSWORD_LENGTH
  ) {
    return false;
  }

  return true;
};

// ============================================================
// GENERAR TOKEN DE RECUPERACIÓN
// ============================================================

const generarTokenRecuperacion =
  () => {
    return crypto
      .randomBytes(
        PASSWORD_RESET_TOKEN_BYTES
      )
      .toString(
        'hex'
      );
  };

const generarTokenVerificacion = () => {
  return crypto
    .randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES)
    .toString('hex');
};

// ============================================================
// HASH TOKEN DE RECUPERACIÓN
// ============================================================
//
// El token que llega por correo NO se guarda directamente
// en la base de datos.
//
// Se guarda SHA-256(token).
// ============================================================

const hashToken =
  (
    token
  ) => {
    return crypto
      .createHash(
        'sha256'
      )
      .update(
        token,
        'utf8'
      )
      .digest(
        'hex'
      );
  };

// ============================================================
// VERIFICAR RECAPTCHA
// ============================================================

const verificarRecaptcha =
  async (
    captchaToken
  ) => {
    if (
      !captchaToken ||
      typeof captchaToken !==
        'string'
    ) {
      return {
        success:
          false,

        error:
          'missing-input-response'
      };
    }

    const secretKey =
      process.env
        .RECAPTCHA_SECRET_KEY;

    if (
      typeof secretKey !==
        'string' ||
      !secretKey.trim()
    ) {
      console.error(
        'RECAPTCHA_SECRET_KEY no está configurado en las variables de entorno.'
      );

      return {
        success:
          false,

        error:
          'missing-input-secret'
      };
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        8000
      );

    try {
      const body =
        new URLSearchParams({
          secret:
            secretKey,

          response:
            captchaToken
        });

      const captchaVerify =
        await fetch(
          RECAPTCHA_VERIFY_URL,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            },

            body:
              body.toString(),

            signal:
              controller.signal
          }
        );

      if (
        !captchaVerify.ok
      ) {
        console.error(
          `reCAPTCHA respondió con HTTP ${captchaVerify.status}.`
        );

        return {
          success:
            false,

          error:
            `http-${captchaVerify.status}`
        };
      }

      const captchaResult =
        await captchaVerify.json();

      return {
        success:
          captchaResult.success ===
          true,

        errorCodes:
          Array.isArray(
            captchaResult[
              'error-codes'
            ]
          )
            ? captchaResult[
                'error-codes'
              ]
            : []
      };
    } catch (error) {
      if (
        error?.name ===
        'AbortError'
      ) {
        console.error(
          'La validación reCAPTCHA excedió el tiempo máximo de espera.'
        );

        return {
          success:
            false,

          error:
            'timeout'
        };
      }

      console.error(
        'No fue posible comunicarse con el servicio reCAPTCHA:',
        error.message
      );

      return {
        success:
          false,

        error:
          'service-unavailable'
      };
    } finally {
      clearTimeout(
        timeout
      );
    }
  };

// ============================================================
// GENERAR CÉDULA TEMPORAL
// ============================================================

const generarCedulaTemporal = () => {
  const sufijo =
    crypto
      .randomBytes(
        5
      )
      .toString(
        'hex'
      )
      .toUpperCase();

  return `CC-${sufijo}`.slice(
    0,
    MAX_CEDULA_LENGTH
  );
};

// ============================================================
// REGISTRO PÚBLICO
// ============================================================

const register =
  async (
    req,
    res
  ) => {
    let connection;

    try {
      connection =
        await pool.getConnection();

      const {
        nombre_completo,
        email,
        password,
        cedula,
        rol,
        captchaToken
      } =
        req.body || {};

      if (
        typeof nombre_completo !==
          'string' ||
        !nombre_completo.trim()
      ) {
        return res.status(400).json({
          error:
            'El nombre completo es obligatorio.'
        });
      }

      if (
        typeof email !==
          'string' ||
        !email.trim()
      ) {
        return res.status(400).json({
          error:
            'El correo electrónico es obligatorio.'
        });
      }

      if (
        !validarPassword(
          password
        )
      ) {
        return res.status(400).json({
          error:
            `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`
        });
      }

      if (
        !captchaToken ||
        typeof captchaToken !==
          'string'
      ) {
        return res.status(400).json({
          error:
            'Por favor, completa el reCAPTCHA de seguridad.'
        });
      }

      const cleanedNombre =
        nombre_completo.trim();

      if (
        cleanedNombre.length >
        MAX_NAME_LENGTH
      ) {
        return res.status(400).json({
          error:
            'El nombre completo no puede superar los 150 caracteres.'
        });
      }

      const cleanedEmail =
        normalizarEmail(
          email
        );

      if (
        !cleanedEmail
      ) {
        return res.status(400).json({
          error:
            'El correo electrónico no es válido.'
        });
      }

      if (
        cleanedEmail ===
        ADMIN_EMAIL
      ) {
        return res.status(403).json({
          error:
            'Este correo está reservado para la administración de ArchiveX.'
        });
      }

      if (rol === 'Admin' || rol === 'Administrador') {
        return res.status(403).json({
          error:
            'El rol administrativo está reservado y no puede asignarse mediante el registro público.'
        });
      }

      const rolesPublicos = [
        'Profesor',
        'Docente'
      ];

      if (!rolesPublicos.includes(rol)) {
        return res.status(400).json({
          error:
            'El rol seleccionado no es válido.'
        });
      }

      let cedulaFinal =
        null;

      if (
        cedula !==
          undefined &&
        cedula !==
          null &&
        String(
          cedula
        ).trim()
      ) {
        if (
          typeof cedula !==
          'string'
        ) {
          return res.status(400).json({
            error:
              'La cédula no es válida.'
          });
        }

        cedulaFinal =
          cedula.trim();

        if (
          cedulaFinal.length >
          MAX_CEDULA_LENGTH
        ) {
          return res.status(400).json({
            error:
              'La cédula no puede superar los 20 caracteres.'
          });
        }
      } else {
        cedulaFinal =
          generarCedulaTemporal();
      }

      const captchaResult =
        await verificarRecaptcha(
          captchaToken
        );

      if (
        !captchaResult.success
      ) {
        console.warn(
          'Registro rechazado por validación reCAPTCHA.',
          captchaResult.errorCodes ||
            captchaResult.error ||
            'unknown'
        );

        return res.status(400).json({
          error:
            'La validación del reCAPTCHA ha fallado o expiró.'
        });
      }

      await connection.beginTransaction();

      const [
        existingUser
      ] =
        await connection.query(
          `
            SELECT id
            FROM usuarios
            WHERE email = ?
            LIMIT 1
          `,
          [
            cleanedEmail
          ]
        );

      if (
        existingUser.length >
        0
      ) {
        await connection.rollback();

        return res.status(409).json({
          error:
            'El correo electrónico ya está registrado.'
        });
      }

      const [
        existingCedula
      ] =
        await connection.query(
          `
            SELECT id
            FROM usuarios
            WHERE cedula = ?
            LIMIT 1
          `,
          [
            cedulaFinal
          ]
        );

      if (
        existingCedula.length >
        0
      ) {
        await connection.rollback();

        return res.status(409).json({
          error:
            'La cédula ya está registrada.'
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const rolFinal = rol;

      const [
        userResult
      ] =
        await connection.query(
          `
            INSERT INTO usuarios
            (
              cedula,
              nombre_completo,
              email,
              password,
              rol,
              correo_verificado
            )
            VALUES (?, ?, ?, ?, ?, FALSE)
          `,
          [
            cedulaFinal,
            cleanedNombre,
            cleanedEmail,
            passwordHash,
            rolFinal
          ]
        );

      const nuevoUsuarioId =
        userResult.insertId;

      await connection.query(
        `
          INSERT INTO login
          (
            usuario_id,
            email,
            password
          )
          VALUES (?, ?, ?)
        `,
        [
          nuevoUsuarioId,
          cleanedEmail,
          passwordHash
        ]
      );

      const tokenVerificacion =
        generarTokenVerificacion();

      const tokenVerificacionHash =
        hashToken(tokenVerificacion);

      const tokenVerificacionExpira =
        new Date(
          Date.now() +
            EMAIL_VERIFICATION_EXPIRATION_HOURS *
              60 *
              60 *
              1000
        );

      await connection.query(
        `
          UPDATE email_verification_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE usuario_id = ?
            AND used_at IS NULL
        `,
        [nuevoUsuarioId]
      );

      await connection.query(
        `
          INSERT INTO email_verification_tokens
          (
            usuario_id,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?)
        `,
        [
          nuevoUsuarioId,
          tokenVerificacionHash,
          tokenVerificacionExpira
        ]
      );

      await connection.commit();

      try {
        await enviarCorreoVerificacion({
          to: cleanedEmail,
          name: cleanedNombre,
          token: tokenVerificacion
        });
      } catch (emailError) {
        console.error(
          'No fue posible enviar el correo de verificación:',
          emailError?.code || 'fallo de entrega'
        );

        try {
          await pool.query(
            `
              UPDATE email_verification_tokens
              SET used_at = CURRENT_TIMESTAMP
              WHERE token_hash = ?
                AND used_at IS NULL
            `,
            [tokenVerificacionHash]
          );
        } catch (invalidationError) {
          console.error(
            'No fue posible invalidar el token de verificación:',
            invalidationError?.code || 'error interno'
          );
        }

        return res.status(201).json({
          message:
            'Cuenta creada, pero no se pudo enviar el correo de verificación. Solicita un nuevo enlace desde el inicio de sesión.',
          emailSent: false
        });
      }

      return res.status(201).json({
        message:
          'Cuenta creada exitosamente. Revisa tu correo para verificar la cuenta antes de iniciar sesión.',

        emailSent: true,

        user: {
          id:
            nuevoUsuarioId,

          nombre_completo:
            cleanedNombre,

          email:
            cleanedEmail,

          rol:
            rolFinal
        }
      });
    } catch (error) {
      if (
        connection
      ) {
        try {
          await connection.rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            'Error realizando rollback del registro:',
            rollbackError.message
          );
        }
      }

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
          error:
            'El correo o la cédula ya están registrados.'
        });
      }

      return res.status(500).json({
        error:
          'No fue posible completar el registro en este momento.'
      });
    } finally {
      if (
        connection
      ) {
        connection.release();
      }
    }
  };

// ============================================================
// LOGIN
// ============================================================

const login =
  async (
    req,
    res
  ) => {
    try {
      const {
        email,
        password,
        captchaToken
      } =
        req.body || {};

      if (
        typeof email !==
          'string' ||
        !email.trim()
      ) {
        return res.status(400).json({
          error:
            'El correo electrónico es obligatorio.'
        });
      }

      if (
        typeof password !==
          'string' ||
        !password
      ) {
        return res.status(400).json({
          error:
            'La contraseña es obligatoria.'
        });
      }

      if (
        !captchaToken ||
        typeof captchaToken !==
          'string'
      ) {
        return res.status(400).json({
          error:
            'Por favor, completa el reCAPTCHA de seguridad.'
        });
      }

      const cleanedEmail =
        normalizarEmail(
          email
        );

      if (
        !cleanedEmail
      ) {
        return res.status(400).json({
          error:
            'El correo electrónico no es válido.'
        });
      }

      const captchaResult =
        await verificarRecaptcha(
          captchaToken
        );

      if (
        !captchaResult.success
      ) {
        console.warn(
          'Inicio de sesión rechazado por validación reCAPTCHA.',
          captchaResult.errorCodes ||
            captchaResult.error ||
            'unknown'
        );

        return res.status(400).json({
          error:
            'La validación del reCAPTCHA ha fallado o expiró.'
        });
      }

      const jwtSecret =
        obtenerJwtSecret();

      const [
        loginRows
      ] =
        await pool.query(
          `
            SELECT
              id,
              usuario_id,
              email,
              password
            FROM login
            WHERE email = ?
            LIMIT 1
          `,
          [
            cleanedEmail
          ]
        );

      const loginData =
        loginRows[0];

      if (
        !loginData
      ) {
        return res.status(401).json({
          error:
            'Credenciales incorrectas.'
        });
      }

      const passwordMatch =
        await bcrypt.compare(
          password,
          loginData.password
        );

      if (
        !passwordMatch
      ) {
        return res.status(401).json({
          error:
            'Credenciales incorrectas.'
        });
      }

      const [
        userRows
      ] =
        await pool.query(
          `
            SELECT
              id,
              nombre_completo,
              email,
              rol,
              correo_verificado,
              account_status
            FROM usuarios
            WHERE id = ?
            LIMIT 1
          `,
          [
            loginData.usuario_id
          ]
        );

      const user =
        userRows[0];

      if (
        !user
      ) {
        return res.status(401).json({
          error:
            'Credenciales incorrectas.'
        });
      }

      const emailUsuario =
        normalizarEmail(
          user.email
        );

      const rolUsuario =
        String(
          user.rol || ''
        ).trim();

      if (
        !emailUsuario ||
        !rolUsuario
      ) {
        console.error(
          `Usuario ${user.id} no tiene email o rol válidos configurados.`
        );

        return res.status(401).json({
          error:
            'Credenciales incorrectas.'
        });
      }

      const rolNormalizado =
        rolUsuario
          .toLowerCase();

      const esRolAdmin =
        rolNormalizado ===
          'admin' ||
        rolNormalizado ===
          'administrador';

      const esCorreoAdmin =
        emailUsuario ===
        ADMIN_EMAIL;

      if (
        esRolAdmin &&
        !esCorreoAdmin
      ) {
        console.error(
          `Cuenta ${user.id} tiene rol administrativo con un correo no autorizado.`
        );

        return res.status(403).json({
          error:
            'La cuenta administrativa no está autorizada.'
        });
      }

      if (
        esCorreoAdmin &&
        !esRolAdmin
      ) {
        console.error(
          'El correo administrativo está asociado a un rol distinto de Admin.'
        );

        return res.status(403).json({
          error:
            'La cuenta administrativa está configurada incorrectamente.'
        });
      }

      if (!Boolean(user.correo_verificado)) {
        return res.status(403).json({
          code: 'EMAIL_NOT_VERIFIED',
          error:
            'Debes verificar tu correo electrónico antes de iniciar sesión.'
        });
      }

      if (user.account_status && user.account_status !== 'active') {
        return res.status(403).json({
          error: 'Esta cuenta está desactivada o tiene una eliminación programada.'
        });
      }

      const deviceId = String(req.body?.deviceId || '').trim();
      if (!/^[A-Za-z0-9-]{16,80}$/.test(deviceId)) {
        return res.status(400).json({
          error: 'No se pudo identificar este dispositivo. Recarga la página e intenta nuevamente.'
        });
      }

      const deviceHash = hashToken(deviceId);
      const deviceIp = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
      const deviceUserAgent = String(req.get('user-agent') || '').slice(0, 500) || null;
      const [trustedDevices] = await pool.query(
        `SELECT id FROM trusted_devices
         WHERE usuario_id = ? AND device_hash = ? AND ip_address = ? LIMIT 1`,
        [user.id, deviceHash, deviceIp]
      );

      if (!trustedDevices.length) {
        const deviceToken = crypto.randomBytes(32).toString('hex');
        const deviceTokenHash = hashToken(deviceToken);
        const deviceTokenExpiresAt = new Date(
          Date.now() + DEVICE_VERIFICATION_EXPIRATION_MINUTES * 60 * 1000
        );
        await pool.query(
          `UPDATE login_device_tokens SET used_at = CURRENT_TIMESTAMP
           WHERE usuario_id = ? AND device_hash = ? AND used_at IS NULL`,
          [user.id, deviceHash]
        );
        await pool.query(
          `INSERT INTO login_device_tokens
           (usuario_id, device_hash, ip_address, user_agent, token_hash, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            deviceHash,
            deviceIp,
            deviceUserAgent,
            deviceTokenHash,
            deviceTokenExpiresAt
          ]
        );

        try {
          await enviarCorreoVerificacionDispositivo({
            to: emailUsuario,
            name: user.nombre_completo,
            token: deviceToken
          });
        } catch (emailError) {
          await pool.query(
            `UPDATE login_device_tokens SET used_at = CURRENT_TIMESTAMP
             WHERE token_hash = ? AND used_at IS NULL`,
            [deviceTokenHash]
          );
          console.error('No se pudo enviar confirmación de nuevo dispositivo:', emailError.code || 'fallo de entrega');
          return res.status(503).json({
            code: 'DEVICE_VERIFICATION_REQUIRED',
            error: 'No se pudo enviar el enlace de seguridad. Intenta iniciar sesión nuevamente más tarde.'
          });
        }

        return res.status(403).json({
          code: 'DEVICE_VERIFICATION_REQUIRED',
          error: 'Enviamos un enlace de seguridad a tu correo. Confirma este dispositivo y vuelve a iniciar sesión.'
        });
      }

      await pool.query(
        'UPDATE trusted_devices SET last_seen_at = CURRENT_TIMESTAMP, user_agent = ? WHERE id = ?',
        [deviceUserAgent, trustedDevices[0].id]
      );

      // ------------------------------------------------------
      // GENERAR JWT
      // ------------------------------------------------------

      const sessionId =
        crypto.randomUUID();

      const token =
        jwt.sign(
          {
            id:
              user.id,

            email:
              emailUsuario,

            rol:
              rolUsuario,

            sid:
              sessionId
          },

          jwtSecret,

          {
            expiresIn:
              JWT_EXPIRATION,

            algorithm:
              JWT_ALGORITHM
          }
        );

      await pool.query(
        `
          INSERT INTO login_sessions
          (id, usuario_id, ip_address, user_agent, device_hash, expires_at)
          VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR))
        `,
        [
          sessionId,
          user.id,
          deviceIp,
          deviceUserAgent,
          deviceHash
        ]
      );

      return res.status(200).json({
        message:
          'Ingreso exitoso',

        token,

        user: {
          id:
            user.id,

          nombre_completo:
            user.nombre_completo,

          email:
            emailUsuario,

          rol:
            rolUsuario,

          correo_verificado:
            Boolean(
              user.correo_verificado
            )
        }
      });
    } catch (error) {
      console.error(
        'Error durante el inicio de sesión:',
        error
      );

      return res.status(500).json({
        error:
          'Error interno del servidor en el inicio de sesión.'
      });
    }
  };

// ============================================================
// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ============================================================
//
// Siempre devuelve el mismo mensaje general.
//
// Esto evita revelar si un correo concreto está registrado.
//
// ============================================================

const forgotPassword =
  async (
    req,
    res
  ) => {
    let connection;

    const respuestaGenerica = {
      message:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
    };

    try {
      const {
        email
      } =
        req.body || {};

      const emailNormalizado =
        normalizarEmail(
          email
        );

      if (
        !emailNormalizado
      ) {
        return res.status(200).json(
          respuestaGenerica
        );
      }

      connection =
        await pool.getConnection();

      const [
        usuarios
      ] =
        await connection.query(
          `
            SELECT
              id,
              nombre_completo,
              email,
              rol
            FROM usuarios
            WHERE email = ?
            LIMIT 1
          `,
          [
            emailNormalizado
          ]
        );

      // ------------------------------------------------------
      // NO REVELAR EXISTENCIA DE CUENTA
      // ------------------------------------------------------

      if (
        usuarios.length ===
        0
      ) {
        return res.status(200).json(
          respuestaGenerica
        );
      }

      const usuario =
        usuarios[0];

      // ------------------------------------------------------
      // GENERAR TOKEN
      // ------------------------------------------------------

      const token =
        generarTokenRecuperacion();

      const tokenHash =
        hashToken(
          token
        );

      const expiresAt =
        new Date(
          Date.now() +
            PASSWORD_RESET_EXPIRATION_MINUTES *
              60 *
              1000
        );

      // ------------------------------------------------------
      // TRANSACCIÓN
      // ------------------------------------------------------

      await connection.beginTransaction();

      // ------------------------------------------------------
      // INVALIDAR TOKENS ANTERIORES
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE password_reset_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE usuario_id = ?
            AND used_at IS NULL
        `,
        [
          usuario.id
        ]
      );

      // ------------------------------------------------------
      // GUARDAR HASH
      // ------------------------------------------------------

      await connection.query(
        `
          INSERT INTO password_reset_tokens
          (
            usuario_id,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?)
        `,
        [
          usuario.id,
          tokenHash,
          expiresAt
        ]
      );

      await connection.commit();

      // ------------------------------------------------------
      // ENVIAR CORREO
      // ------------------------------------------------------

      try {
        await enviarCorreoRecuperacion({
          to:
            emailNormalizado,

          name:
            usuario.nombre_completo,

          token
        });
      } catch (
        emailError
      ) {
        console.error(
          'No fue posible enviar el correo de recuperación:',
          emailError?.code || 'fallo de entrega'
        );

        // --------------------------------------------------
        // INVALIDAR TOKEN SI FALLÓ EL CORREO
        // --------------------------------------------------

        await pool.query(
          `
            UPDATE password_reset_tokens
            SET used_at = CURRENT_TIMESTAMP
            WHERE token_hash = ?
              AND used_at IS NULL
          `,
          [
            tokenHash
          ]
        );
      }

      return res.status(200).json(
        respuestaGenerica
      );
    } catch (error) {
      if (
        connection
      ) {
        try {
          await connection.rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            'Error realizando rollback de recuperación:',
            rollbackError.message
          );
        }
      }

      console.error(
        'Error solicitando recuperación de contraseña:',
        error
      );

      return res.status(200).json(
        respuestaGenerica
      );
    } finally {
      if (
        connection
      ) {
        connection.release();
      }
    }
  };

// ============================================================
// RESTABLECER CONTRASEÑA
// ============================================================

const resetPassword =
  async (
    req,
    res
  ) => {
    let connection;

    try {
      const {
        token,
        password
      } =
        req.body || {};

      if (
        typeof token !==
          'string' ||
        !token.trim()
      ) {
        return res.status(400).json({
          error:
            'El token de recuperación es obligatorio.'
        });
      }

      if (
        !validarPassword(
          password
        )
      ) {
        return res.status(400).json({
          error:
            `La nueva contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`
        });
      }

      const tokenNormalizado =
        token.trim();

      const tokenHash =
        hashToken(
          tokenNormalizado
        );

      connection =
        await pool.getConnection();

      await connection.beginTransaction();

      // ------------------------------------------------------
      // BUSCAR TOKEN
      // ------------------------------------------------------

      const [
        tokenRows
      ] =
        await connection.query(
          `
            SELECT
              id,
              usuario_id,
              expires_at,
              used_at
            FROM password_reset_tokens
            WHERE token_hash = ?
            LIMIT 1
          `,
          [
            tokenHash
          ]
        );

      const resetToken =
        tokenRows[0];

      if (
        !resetToken
      ) {
        await connection.rollback();

        return res.status(400).json({
          error:
            'El enlace de recuperación no es válido o ha expirado.'
        });
      }

      if (
        resetToken.used_at
      ) {
        await connection.rollback();

        return res.status(400).json({
          error:
            'El enlace de recuperación ya fue utilizado.'
        });
      }

      const expiresAt =
        new Date(
          resetToken.expires_at
        );

      if (
        Number.isNaN(
          expiresAt.getTime()
        ) ||
        expiresAt.getTime() <=
          Date.now()
      ) {
        await connection.rollback();

        return res.status(400).json({
          error:
            'El enlace de recuperación no es válido o ha expirado.'
        });
      }

      // ------------------------------------------------------
      // BUSCAR USUARIO
      // ------------------------------------------------------

      const [
        userRows
      ] =
        await connection.query(
          `
            SELECT
              id,
              email,
              rol
            FROM usuarios
            WHERE id = ?
            LIMIT 1
          `,
          [
            resetToken.usuario_id
          ]
        );

      const usuario =
        userRows[0];

      if (
        !usuario
      ) {
        await connection.rollback();

        return res.status(400).json({
          error:
            'El enlace de recuperación no es válido.'
        });
      }

      // ------------------------------------------------------
      // HASH NUEVA CONTRASEÑA
      // ------------------------------------------------------

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      // ------------------------------------------------------
      // ACTUALIZAR USUARIO
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE usuarios
          SET
            password = ?
          WHERE id = ?
        `,
        [
          passwordHash,
          usuario.id
        ]
      );

      // ------------------------------------------------------
      // ACTUALIZAR LOGIN
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE login
          SET
            password = ?,
            email = ?
          WHERE usuario_id = ?
        `,
        [
          passwordHash,
          usuario.email,
          usuario.id
        ]
      );

      // ------------------------------------------------------
      // INVALIDAR TOKEN
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE password_reset_tokens
          SET
            used_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          resetToken.id
        ]
      );

      // ------------------------------------------------------
      // INVALIDAR TODOS LOS DEMÁS TOKENS DEL USUARIO
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE password_reset_tokens
          SET
            used_at = CURRENT_TIMESTAMP
          WHERE usuario_id = ?
            AND used_at IS NULL
        `,
        [
          usuario.id
        ]
      );

      await connection.commit();

      return res.status(200).json({
        message:
          'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'
      });
    } catch (error) {
      if (
        connection
      ) {
        try {
          await connection.rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            'Error realizando rollback del restablecimiento:',
            rollbackError.message
          );
        }
      }

      console.error(
        'Error restableciendo contraseña:',
        error
      );

      return res.status(500).json({
        error:
          'No fue posible restablecer la contraseña en este momento.'
      });
    } finally {
      if (
        connection
      ) {
        connection.release();
      }
    }
  };

const verifyEmail = async (req, res) => {
  let connection;

  try {
    const { token } = req.body || {};

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        error: 'El token de verificación es obligatorio.'
      });
    }

    const tokenHash = hashToken(token.trim());
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [tokenRows] = await connection.query(
      `
        SELECT
          id,
          usuario_id,
          expires_at,
          used_at
        FROM email_verification_tokens
        WHERE token_hash = ?
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash]
    );

    const verificationToken = tokenRows[0];
    const expiresAt = verificationToken
      ? new Date(verificationToken.expires_at)
      : null;

    if (
      !verificationToken ||
      verificationToken.used_at ||
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      await connection.rollback();
      return res.status(400).json({
        error: 'El enlace de verificación no es válido o ha expirado.'
      });
    }

    await connection.query(
      `
        UPDATE usuarios
        SET
          correo_verificado = TRUE,
          correo_verificado_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [verificationToken.usuario_id]
    );

    await connection.query(
      `
        UPDATE email_verification_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE usuario_id = ?
          AND used_at IS NULL
      `,
      [verificationToken.usuario_id]
    );

    await connection.commit();

    return res.status(200).json({
      message: 'Correo verificado correctamente. Ya puedes iniciar sesión.'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Error realizando rollback de verificación:',
          rollbackError.message
        );
      }
    }

    console.error('Error verificando correo:', error?.code || 'error interno');

    return res.status(500).json({
      error: 'No fue posible verificar el correo en este momento.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// ============================================================
// REENVIAR VERIFICACIÓN DE CORREO
// ============================================================
//
// La respuesta se mantiene genérica para no revelar qué correos
// tienen una cuenta. También permite recuperar un registro cuyo
// proveedor SMTP estuvo temporalmente caído.
// ============================================================

const resendEmailVerification = async (req, res) => {
  let connection;
  const respuestaGenerica = {
    message:
      'Si existe una cuenta pendiente de verificación, recibirás un nuevo enlace en tu correo.'
  };

  try {
    const email = normalizarEmail(req.body?.email);

    if (!email) {
      return res.status(200).json(respuestaGenerica);
    }

    connection = await pool.getConnection();
    const [usuarios] = await connection.query(
      `
        SELECT id, nombre_completo, email, correo_verificado
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    const usuario = usuarios[0];
    if (!usuario || Boolean(usuario.correo_verificado)) {
      return res.status(200).json(respuestaGenerica);
    }

    const token = generarTokenVerificacion();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRATION_HOURS * 60 * 60 * 1000
    );

    await connection.beginTransaction();
    await connection.query(
      `
        UPDATE email_verification_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE usuario_id = ? AND used_at IS NULL
      `,
      [usuario.id]
    );
    await connection.query(
      `
        INSERT INTO email_verification_tokens (usuario_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `,
      [usuario.id, tokenHash, expiresAt]
    );
    await connection.commit();

    try {
      await enviarCorreoVerificacion({
        to: usuario.email,
        name: usuario.nombre_completo,
        token
      });
    } catch (emailError) {
      console.error(
        'No fue posible reenviar el correo de verificación:',
        emailError?.code || 'fallo de entrega'
      );
      await pool.query(
        `
          UPDATE email_verification_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE token_hash = ? AND used_at IS NULL
        `,
        [tokenHash]
      );
    }

    return res.status(200).json(respuestaGenerica);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error realizando rollback del reenvío:', rollbackError.message);
      }
    }

    console.error('Error reenviando verificación:', error?.code || 'error interno');
    return res.status(200).json(respuestaGenerica);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const verifyDevice = async (req, res) => {
  let connection;
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'El token de seguridad es obligatorio.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, usuario_id, device_hash, ip_address, user_agent, expires_at, used_at
       FROM login_device_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE`,
      [hashToken(token)]
    );
    const verification = rows[0];
    if (!verification || verification.used_at || new Date(verification.expires_at) <= new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'El enlace no es válido o ha expirado.' });
    }

    await connection.query(
      `INSERT INTO trusted_devices (usuario_id, device_hash, ip_address, user_agent)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_agent = VALUES(user_agent),
       trusted_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP`,
      [verification.usuario_id, verification.device_hash, verification.ip_address, verification.user_agent]
    );
    await connection.query(
      `UPDATE login_device_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND device_hash = ? AND used_at IS NULL`,
      [verification.usuario_id, verification.device_hash]
    );
    await connection.commit();
    return res.json({ message: 'Dispositivo verificado. Vuelve al inicio de sesión para continuar.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error verificando dispositivo:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible verificar el dispositivo.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  verifyDevice
};
