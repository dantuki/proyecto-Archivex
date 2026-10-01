const readline =
  require('readline');

const bcrypt =
  require('bcrypt');

const crypto =
  require('crypto');

const pool =
  require('../config/db.js');

const {
  ADMIN_EMAIL
} =
  require('../config/securityConfig');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ADMIN_ROLE =
  'Admin';

const MIN_PASSWORD_LENGTH =
  8;

const BCRYPT_ROUNDS =
  12;

// ============================================================
// INTERFAZ DE TERMINAL
// ============================================================

const rl =
  readline.createInterface({
    input:
      process.stdin,

    output:
      process.stdout
  });

// ============================================================
// PREGUNTA SIMPLE
// ============================================================

const preguntar =
  (
    texto
  ) =>
    new Promise(
      (
        resolve
      ) => {
        rl.question(
          texto,
          resolve
        );
      }
    );

// ============================================================
// PREGUNTA DE CONTRASEÑA
// ============================================================
//
// En Windows CMD no existe un modo de ocultar caracteres de
// forma completamente portable con readline estándar.
//
// Por seguridad, el valor se solicita directamente y NO se
// almacena en ningún archivo.
//
// ============================================================

const preguntarPassword =
  () =>
    new Promise(
      (
        resolve
      ) => {
        rl.question(
          'Contraseña del Administrador: ',
          resolve
        );
      }
    );

// ============================================================
// GENERAR CÉDULA TEMPORAL
// ============================================================

const generarCedulaAdmin =
  () => {
    const sufijo =
      crypto
        .randomBytes(
          5
        )
        .toString(
          'hex'
        )
        .toUpperCase();

    return `CC-ADM-${sufijo}`
      .slice(
        0,
        20
      );
  };

// ============================================================
// NORMALIZAR EMAIL
// ============================================================

const normalizarEmail =
  (
    email
  ) =>
    String(
      email || ''
    )
      .trim()
      .toLowerCase();

// ============================================================
// MAIN
// ============================================================

const main =
  async () => {
    let connection;

    try {
      console.log(
        '\n============================================================'
      );

      console.log(
        'ARCHIVEX - PROVISIONAMIENTO DEL ADMINISTRADOR PRINCIPAL'
      );

      console.log(
        '============================================================\n'
      );

      console.log(
        `Correo administrativo reservado: ${ADMIN_EMAIL}\n`
      );

      // ------------------------------------------------------
      // DATOS DEL ADMIN
      // ------------------------------------------------------

      const nombre =
        (
          await preguntar(
            'Nombre completo del Administrador: '
          )
        ).trim();

      if (
        !nombre ||
        nombre.length >
          150
      ) {
        throw new Error(
          'El nombre completo es obligatorio y no puede superar los 150 caracteres.'
        );
      }

      const password =
        await preguntarPassword();

      if (
        typeof password !==
          'string' ||
        password.length <
          MIN_PASSWORD_LENGTH
      ) {
        throw new Error(
          `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
        );
      }

      if (
        password.length >
        128
      ) {
        throw new Error(
          'La contraseña no puede superar los 128 caracteres.'
        );
      }

      // ------------------------------------------------------
      // CONEXIÓN
      // ------------------------------------------------------

      connection =
        await pool.getConnection();

      await connection.beginTransaction();

      // ------------------------------------------------------
      // COMPROBAR ADMINS EXISTENTES
      // ------------------------------------------------------

      const [
        admins
      ] =
        await connection.query(
          `
            SELECT
              id,
              nombre_completo,
              email,
              rol
            FROM usuarios
            WHERE rol IN ('Admin', 'Administrador')
          `
        );

      if (
        admins.length >
        1
      ) {
        throw new Error(
          'La base de datos contiene más de una cuenta administrativa. No se puede continuar hasta normalizar la información.'
        );
      }

      if (
        admins.length ===
        1
      ) {
        const adminActual =
          admins[0];

        const emailActual =
          normalizarEmail(
            adminActual.email
          );

        if (
          emailActual !==
          ADMIN_EMAIL
        ) {
          throw new Error(
            `Ya existe una cuenta Admin con un correo diferente al permitido: ${adminActual.email}`
          );
        }

        console.log(
          `Ya existe la cuenta administrativa (${adminActual.email}).`
        );

        console.log(
          'No se creará otra cuenta Admin.'
        );

        await connection.rollback();

        return;
      }

      // ------------------------------------------------------
      // COMPROBAR CORREO RESERVADO
      // ------------------------------------------------------

      const [
        usuarioPorEmail
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
            ADMIN_EMAIL
          ]
        );

      if (
        usuarioPorEmail.length >
        0
      ) {
        const usuarioExistente =
          usuarioPorEmail[0];

        throw new Error(
          `El correo administrativo ya pertenece a un usuario con rol "${usuarioExistente.rol}". Debe corregirse manualmente antes de continuar.`
        );
      }

      // ------------------------------------------------------
      // COMPROBAR CORREO EN LOGIN
      // ------------------------------------------------------

      const [
        loginPorEmail
      ] =
        await connection.query(
          `
            SELECT
              id,
              usuario_id,
              email
            FROM login
            WHERE email = ?
            LIMIT 1
          `,
          [
            ADMIN_EMAIL
          ]
        );

      if (
        loginPorEmail.length >
        0
      ) {
        throw new Error(
          'El correo administrativo ya existe en la tabla login, pero no tiene una cuenta Admin válida en usuarios. La base necesita normalización antes de continuar.'
        );
      }

      // ------------------------------------------------------
      // GENERAR CÉDULA
      // ------------------------------------------------------

      const cedula =
        generarCedulaAdmin();

      // ------------------------------------------------------
      // HASH
      // ------------------------------------------------------

      const passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      // ------------------------------------------------------
      // CREAR ADMIN
      // ------------------------------------------------------

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
              correo_verificado,
              correo_verificado_at
            )
            VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
          `,
          [
            cedula,
            nombre,
            ADMIN_EMAIL,
            passwordHash,
            ADMIN_ROLE
          ]
        );

      const adminId =
        userResult.insertId;

      // ------------------------------------------------------
      // CREAR CREDENCIAL DE LOGIN
      // ------------------------------------------------------

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
          adminId,
          ADMIN_EMAIL,
          passwordHash
        ]
      );

      // ------------------------------------------------------
      // CONFIRMAR
      // ------------------------------------------------------

      await connection.commit();

      console.log(
        '\n============================================================'
      );

      console.log(
        'ADMINISTRADOR CREADO CORRECTAMENTE'
      );

      console.log(
        '============================================================'
      );

      console.log(
        `ID: ${adminId}`
      );

      console.log(
        `Correo: ${ADMIN_EMAIL}`
      );

      console.log(
        `Rol: ${ADMIN_ROLE}`
      );

      console.log(
        'Correo verificado: Sí'
      );

      console.log(
        '\nLa contraseña fue almacenada únicamente como hash.'
      );

      console.log(
        'No se guardó la contraseña en el código ni en el esquema SQL.'
      );

      console.log(
        '\n============================================================\n'
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
            'Error realizando rollback:',
            rollbackError.message
          );
        }
      }

      console.error(
        '\nNo fue posible crear el Administrador:',
        error.message
      );

      process.exitCode =
        1;
    } finally {
      if (
        connection
      ) {
        connection.release();
      }

      await pool.end();

      rl.close();
    }
  };

main();