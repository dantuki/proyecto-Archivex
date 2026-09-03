const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.js');

/**
 * Obtiene el secreto JWT únicamente desde variables de entorno.
 *
 * IMPORTANTE:
 * No existe ningún fallback hardcodeado.
 * Esto evita que la aplicación pueda firmar o verificar tokens
 * utilizando un secreto público conocido.
 */
const obtenerJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'JWT_SECRET no está configurado correctamente. Debe existir una variable de entorno segura de al menos 32 caracteres.'
    );
  }

  return secret;
};

/**
 * Verifica el token de reCAPTCHA contra Google.
 *
 * La verificación falla de forma cerrada:
 * si Google no responde o devuelve un resultado inválido,
 * la autenticación NO continúa.
 */
const verificarRecaptcha = async (captchaToken) => {
  if (!captchaToken || typeof captchaToken !== 'string') {
    return {
      success: false,
      error: 'missing-input-response'
    };
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey || !secretKey.trim()) {
    console.error(
      'RECAPTCHA_SECRET_KEY no está configurado en las variables de entorno.'
    );

    return {
      success: false,
      error: 'missing-input-secret'
    };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: captchaToken
    });

    const captchaVerify = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      }
    );

    if (!captchaVerify.ok) {
      console.error(
        `reCAPTCHA respondió con HTTP ${captchaVerify.status}.`
      );

      return {
        success: false,
        error: `http-${captchaVerify.status}`
      };
    }

    const captchaResult = await captchaVerify.json();

    return {
      success: captchaResult.success === true,
      errorCodes: captchaResult['error-codes'] || []
    };
  } catch (error) {
    console.error(
      'No fue posible comunicarse con el servicio reCAPTCHA:',
      error.message
    );

    return {
      success: false,
      error: 'service-unavailable'
    };
  }
};

/**
 * Registro público.
 *
 * Regla de seguridad:
 * Todo registro público crea exclusivamente usuarios Profesor.
 *
 * Nunca se acepta el rol enviado por el cliente.
 */
const register = async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const {
      nombre_completo,
      email,
      password,
      cedula,
      captchaToken
    } = req.body;

    if (
      typeof nombre_completo !== 'string' ||
      !nombre_completo.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        error: 'Todos los campos obligatorios deben estar completos.'
      });
    }

    if (!captchaToken) {
      return res.status(400).json({
        error: 'Por favor, completa el reCAPTCHA de seguridad.'
      });
    }

    const cleanedNombre = nombre_completo.trim();
    const cleanedEmail = email.trim().toLowerCase();

    const captchaResult = await verificarRecaptcha(captchaToken);

    if (!captchaResult.success) {
      console.warn(
        'Registro rechazado por validación reCAPTCHA.',
        captchaResult.errorCodes || captchaResult.error || 'unknown'
      );

      return res.status(400).json({
        error: 'La validación del reCAPTCHA ha fallado o expiró.'
      });
    }

    const [existingUser] = await connection.query(
      'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
      [cleanedEmail]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        error: 'El correo electrónico ya está registrado.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    /*
     * El registro público NO recibe rol.
     *
     * Aunque alguien envíe:
     *
     * {
     *   "rol": "Admin"
     * }
     *
     * ese valor es ignorado deliberadamente.
     */
    const rolFinal = 'Profesor';

    /*
     * Si no llega una cédula, conservamos el comportamiento actual
     * generando un identificador temporal.
     */
    const cedulaFinal =
      typeof cedula === 'string' && cedula.trim()
        ? cedula.trim()
        : `CC-${Date.now().toString().slice(-8)}`;

    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `
        INSERT INTO usuarios
        (
          cedula,
          nombre_completo,
          email,
          password,
          rol
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        cedulaFinal,
        cleanedNombre,
        cleanedEmail,
        passwordHash,
        rolFinal
      ]
    );

    const nuevoUsuarioId = userResult.insertId;

    /*
     * La tabla login actualmente duplica la contraseña.
     * No la eliminamos todavía porque eso pertenece a la futura
     * refactorización de autenticación.
     */
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

    await connection.commit();

    return res.status(201).json({
      message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      user: {
        id: nuevoUsuarioId,
        nombre_completo: cleanedNombre,
        email: cleanedEmail,
        rol: rolFinal
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Error realizando rollback del registro:',
          rollbackError.message
        );
      }
    }

    console.error('Error al registrar usuario:', error);

    /*
     * Nunca enviamos error.sqlMessage ni error.message
     * al cliente porque podrían revelar estructura interna,
     * SQL o información sensible.
     */
    return res.status(500).json({
      error: 'No fue posible completar el registro en este momento.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Inicio de sesión.
 */
const login = async (req, res) => {
  try {
    const {
      email,
      password,
      captchaToken
    } = req.body;

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        error: 'El correo y la contraseña son obligatorios.'
      });
    }

    if (!captchaToken) {
      return res.status(400).json({
        error: 'Por favor, completa el reCAPTCHA de seguridad.'
      });
    }

    const cleanedEmail = email.trim().toLowerCase();

    const captchaResult = await verificarRecaptcha(captchaToken);

    if (!captchaResult.success) {
      console.warn(
        'Inicio de sesión rechazado por validación reCAPTCHA.',
        captchaResult.errorCodes || captchaResult.error || 'unknown'
      );

      return res.status(400).json({
        error: 'La validación del reCAPTCHA ha fallado o expiró.'
      });
    }

    /*
     * El JWT_SECRET se obtiene en el momento en que realmente
     * necesitamos firmar el token.
     */
    const jwtSecret = obtenerJwtSecret();

    const [loginRows] = await pool.query(
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
      [cleanedEmail]
    );

    const loginData = loginRows[0];

    if (!loginData) {
      return res.status(401).json({
        error: 'Credenciales incorrectas.'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      loginData.password
    );

    if (!isMatch) {
      return res.status(401).json({
        error: 'Credenciales incorrectas.'
      });
    }

    const [userRows] = await pool.query(
      `
        SELECT
          id,
          nombre_completo,
          email,
          rol
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      [loginData.usuario_id]
    );

    const user = userRows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales incorrectas.'
      });
    }

    /*
     * El rol utilizado para el JWT proviene de la base de datos,
     * nunca del frontend.
     */
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        rol: user.rol
      },
      jwtSecret,
      {
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );

    return res.status(200).json({
      message: 'Ingreso exitoso',
      token,
      user
    });
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error);

    return res.status(500).json({
      error: 'Error interno del servidor en el inicio de sesión.'
    });
  }
};

module.exports = {
  register,
  login
};