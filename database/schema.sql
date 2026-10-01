-- ============================================================
-- ARCHIVEX
-- ESQUEMA COMPLETO DE BASE DE DATOS
-- ============================================================
--
-- IMPORTANTE:
-- Este script reconstruye la base de datos desde cero.
--
-- Se utiliza en este momento porque la base está prácticamente
-- vacía y queremos comenzar la nueva evolución de ArchiveX
-- con una estructura consistente.
--
-- NO ejecutar sobre una base con datos importantes sin respaldo.
--
-- ============================================================

CREATE DATABASE IF NOT EXISTS sinfoni_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sinfoni_db;

-- ============================================================
-- 1. LIMPIEZA
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS documentos_solicitud;
DROP TABLE IF EXISTS noticias;
DROP TABLE IF EXISTS login;
DROP TABLE IF EXISTS trazabilidad_solicitudes;
DROP TABLE IF EXISTS asignacion_evaluaciones;
DROP TABLE IF EXISTS solicitudes;
DROP TABLE IF EXISTS convocatorias;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS sedes;
DROP TABLE IF EXISTS participaciones;
DROP TABLE IF EXISTS documentos_proyecto;
DROP TABLE IF EXISTS proyectos_participantes;
DROP TABLE IF EXISTS proyectos;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 2. TABLA: SEDES
-- ============================================================

CREATE TABLE sedes (
  id INT AUTO_INCREMENT PRIMARY KEY,

  nombre_sede VARCHAR(100)
    NOT NULL,

  CONSTRAINT uq_sede_nombre
    UNIQUE (nombre_sede)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. TABLA: USUARIOS
-- ============================================================
--
-- REGLAS IMPORTANTES:
--
-- 1. El único correo autorizado para Admin es:
--
--    aracelly.buitrago@campusucc.edu.co
--
-- 2. El correo administrativo NO puede tener otro rol.
--
-- 3. Ningún otro correo puede tener rol Admin.
--
-- 4. El registro público NO depende de esta tabla para decidir
--    el rol; el backend fuerza Profesor.
--
-- 5. La contraseña permanece hasheada.
-- ============================================================

CREATE TABLE usuarios (

  id INT AUTO_INCREMENT PRIMARY KEY,

  cedula VARCHAR(20)
    NOT NULL,

  nombre_completo VARCHAR(150)
    NOT NULL,

  email VARCHAR(100)
    NOT NULL,

  password VARCHAR(255)
    NOT NULL,

  rol ENUM(
    'Admin',
    'Profesor',
    'Docente',
    'Evaluador'
  )
    NOT NULL
    DEFAULT 'Profesor',

  telefono VARCHAR(20)
    NULL,

  direccion VARCHAR(255)
    NULL,

  foto_url VARCHAR(255)
    NULL,

  nivel_educativo VARCHAR(100)
    NULL,

  carrera_titulo VARCHAR(150)
    NULL,

  certificado_url VARCHAR(255)
    NULL,

  fecha_nacimiento DATE
    NULL,

  correo_verificado BOOLEAN
    NOT NULL
    DEFAULT FALSE,

  correo_verificado_at TIMESTAMP
    NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_usuario_cedula
    UNIQUE (cedula),

  CONSTRAINT uq_usuario_email
    UNIQUE (email),

  -- ========================================================
  -- REGLA 1:
  -- Solo el correo administrativo puede tener Admin.
  -- ========================================================

  CONSTRAINT chk_unico_correo_admin
    CHECK (
      rol <> 'Admin'
      OR LOWER(email) =
        'aracelly.buitrago@campusucc.edu.co'
    ),

  -- ========================================================
  -- REGLA 2:
  -- El correo reservado solo puede pertenecer a Admin.
  -- ========================================================

  CONSTRAINT chk_correo_admin_rol
    CHECK (
      LOWER(email) <>
        'aracelly.buitrago@campusucc.edu.co'
      OR rol = 'Admin'
    )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. TABLA: CONVOCATORIAS
-- ============================================================

CREATE TABLE convocatorias (

  id INT AUTO_INCREMENT PRIMARY KEY,

  codigo VARCHAR(50)
    NOT NULL,

  titulo VARCHAR(255)
    NOT NULL,

  descripcion TEXT
    NOT NULL,

  tipo ENUM(
    'General',
    'Mediana'
  )
    NOT NULL,

  fecha_inicio DATETIME
    NOT NULL,

  fecha_cierre DATETIME
    NOT NULL,

  presupuesto_max VARCHAR(100)
    NULL,

  modalidad VARCHAR(100)
    NULL,

  area_tematica VARCHAR(100)
    NULL,

  bases_url VARCHAR(500)
    NULL,

  plantillas_url VARCHAR(500)
    NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_convocatoria_codigo
    UNIQUE (codigo),

  CONSTRAINT uq_convocatoria_titulo
    UNIQUE (titulo),

  CONSTRAINT chk_convocatoria_fechas
    CHECK (
      fecha_cierre > fecha_inicio
    )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. TABLA: SOLICITUDES
-- ============================================================

CREATE TABLE solicitudes (

  id INT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT
    NOT NULL,

  convocatoria_id INT
    NOT NULL,

  sede_id INT
    NOT NULL,

  num_solicitud VARCHAR(50)
    NOT NULL,

  titulo_propuesta VARCHAR(255)
    NOT NULL,

  observaciones TEXT
    NULL,

  estado ENUM(
    'Borrador',
    'Radicado',
    'En Evaluación',
    'Aprobado',
    'Rechazado'
  )
    NOT NULL
    DEFAULT 'Borrador',

  motivo_decision TEXT
    NULL,

  doc_par_1 VARCHAR(255)
    NULL,

  doc_par_2 VARCHAR(255)
    NULL,

  presupuesto_url VARCHAR(255)
    NULL,

  cronograma_url VARCHAR(255)
    NULL,

  honestidad_url VARCHAR(255)
    NULL,

  id_url VARCHAR(255)
    NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_solicitud_numero
    UNIQUE (num_solicitud),

  CONSTRAINT fk_solicitud_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_solicitud_convocatoria
    FOREIGN KEY (convocatoria_id)
    REFERENCES convocatorias(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_solicitud_sede
    FOREIGN KEY (sede_id)
    REFERENCES sedes(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. TABLA: ASIGNACION_EVALUACIONES
-- ============================================================

CREATE TABLE asignacion_evaluaciones (

  id INT AUTO_INCREMENT PRIMARY KEY,

  solicitud_id INT
    NOT NULL,

  evaluador_id INT
    NOT NULL,

  puntaje DECIMAL(5,2)
    NOT NULL
    DEFAULT 0.00,

  comentarios TEXT
    NULL,

  archivo_evaluacion VARCHAR(255)
    NULL,

  estado_evaluacion ENUM(
    'Asignado',
    'En Progreso',
    'Finalizado'
  )
    NOT NULL
    DEFAULT 'Asignado',

  fecha_asignacion TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_asignacion_solicitud_evaluador
    UNIQUE (
      solicitud_id,
      evaluador_id
    ),

  CONSTRAINT chk_asignacion_puntaje
    CHECK (
      puntaje >= 0
      AND puntaje <= 100
    ),

  CONSTRAINT fk_asignacion_solicitud
    FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_asignacion_evaluador
    FOREIGN KEY (evaluador_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. TABLA: TRAZABILIDAD_SOLICITUDES
-- ============================================================

CREATE TABLE trazabilidad_solicitudes (

  id INT AUTO_INCREMENT PRIMARY KEY,

  solicitud_id INT
    NOT NULL,

  usuario_id INT
    NOT NULL,

  estado_anterior VARCHAR(50)
    NULL,

  estado_nuevo VARCHAR(50)
    NOT NULL,

  motivo_cambio TEXT
    NULL,

  fecha_cambio TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_trazabilidad_solicitud
    FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_trazabilidad_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. TABLA: LOGIN
-- ============================================================
--
-- Se mantiene temporalmente porque el backend actual todavía
-- trabaja con esta estructura.
--
-- El password debe ser exactamente el mismo hash que en
-- usuarios.password.
--
-- Posteriormente podremos migrar hacia una única fuente de
-- autenticación sin romper la aplicación actual.
-- ============================================================

CREATE TABLE login (

  id INT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT
    NOT NULL,

  email VARCHAR(100)
    NOT NULL,

  password VARCHAR(255)
    NOT NULL,

  ultimo_acceso TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_login_email
    UNIQUE (email),

  CONSTRAINT uq_login_usuario
    UNIQUE (usuario_id),

  CONSTRAINT fk_login_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. TABLA: NOTICIAS
-- ============================================================

CREATE TABLE noticias (

  id INT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT
    NOT NULL,

  titulo VARCHAR(255)
    NOT NULL,

  contenido TEXT
    NULL,

  archivo_url VARCHAR(255)
    NULL,

  fecha DATE
    NOT NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_noticia_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. TABLA: DOCUMENTOS_SOLICITUD
-- ============================================================

CREATE TABLE documentos_solicitud (

  id INT AUTO_INCREMENT PRIMARY KEY,

  solicitud_id INT
    NOT NULL,

  nombre_archivo VARCHAR(255)
    NOT NULL,

  tipo_documento ENUM(
    'Presupuesto',
    'Cronograma',
    'Honestidad',
    'Identidad',
    'Otros'
  )
    NOT NULL,

  archivo_url VARCHAR(255)
    NOT NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_documento_solicitud
    FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. TOKENS DE VERIFICACIÓN DE CORREO
-- ============================================================
--
-- Esta tabla queda preparada para la siguiente evolución:
--
-- Registro
--    ↓
-- generación de token
--    ↓
-- envío de correo
--    ↓
-- usuario confirma
--
-- El token real nunca debería almacenarse en texto plano.
-- El backend deberá guardar el hash del token.
-- ============================================================

CREATE TABLE email_verification_tokens (

  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT
    NOT NULL,

  token_hash CHAR(64)
    NOT NULL,

  expires_at DATETIME
    NOT NULL,

  used_at DATETIME
    NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_email_verification_token
    UNIQUE (token_hash),

  CONSTRAINT fk_email_verification_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_email_verification_usuario (
    usuario_id
  ),

  INDEX idx_email_verification_expira (
    expires_at
  )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. TOKENS DE RECUPERACIÓN DE CONTRASEÑA
-- ============================================================
--
-- Flujo futuro:
--
-- "¿Olvidaste tu contraseña?"
--       ↓
-- correo
--       ↓
-- token temporal
--       ↓
-- enlace
--       ↓
-- nueva contraseña
--
-- Igual que en verificación:
-- se almacena el HASH del token, no el token original.
-- ============================================================

CREATE TABLE password_reset_tokens (

  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT
    NOT NULL,

  token_hash CHAR(64)
    NOT NULL,

  expires_at DATETIME
    NOT NULL,

  used_at DATETIME
    NULL,

  created_at TIMESTAMP
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_password_reset_token
    UNIQUE (token_hash),

  CONSTRAINT fk_password_reset_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_password_reset_usuario (
    usuario_id
  ),

  INDEX idx_password_reset_expira (
    expires_at
  )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. DATOS INICIALES
-- ============================================================

INSERT INTO sedes (
  nombre_sede
) VALUES
  ('Apartadó'),
  ('Arauca'),
  ('Barrancabermeja'),
  ('Bogotá'),
  ('Bucaramanga'),
  ('Cali'),
  ('Cartago'),
  ('El Espinal'),
  ('Ibagué'),
  ('Medellín'),
  ('Montería'),
  ('Neiva'),
  ('Pasto'),
  ('Pereira'),
  ('Popayán'),
  ('Quibdó'),
  ('Santa Marta'),
  ('Villavicencio');

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================


