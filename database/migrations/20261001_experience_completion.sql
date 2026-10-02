ALTER TABLE user_preferences
  ADD COLUMN text_scale ENUM('compact', 'normal') NOT NULL DEFAULT 'normal',
  ADD COLUMN notify_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_assignments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_deadlines BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE notifications
  ADD COLUMN event_key VARCHAR(191) NULL;

ALTER TABLE notifications
  ADD UNIQUE INDEX uq_notifications_event_key (event_key);

ALTER TABLE documentos_solicitud
  ADD COLUMN review_status ENUM('pending', 'validated', 'rejected', 'replaced') NOT NULL DEFAULT 'pending',
  ADD COLUMN review_comment TEXT NULL,
  ADD COLUMN reviewed_by INT NULL,
  ADD COLUMN reviewed_at DATETIME NULL,
  ADD COLUMN version_no INT NOT NULL DEFAULT 1,
  ADD COLUMN replaced_by INT NULL;

ALTER TABLE documentos_solicitud
  ADD INDEX idx_documentos_solicitud_tipo_version (solicitud_id, tipo_documento, version_no);

INSERT INTO documentos_solicitud
  (solicitud_id, nombre_archivo, tipo_documento, archivo_url, review_status, version_no)
SELECT s.id, SUBSTRING_INDEX(s.presupuesto_url, '/', -1), 'Presupuesto', s.presupuesto_url, 'pending', 1
FROM solicitudes s
WHERE s.presupuesto_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM documentos_solicitud d WHERE d.solicitud_id = s.id AND d.tipo_documento = 'Presupuesto')
UNION ALL
SELECT s.id, SUBSTRING_INDEX(s.cronograma_url, '/', -1), 'Cronograma', s.cronograma_url, 'pending', 1
FROM solicitudes s
WHERE s.cronograma_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM documentos_solicitud d WHERE d.solicitud_id = s.id AND d.tipo_documento = 'Cronograma')
UNION ALL
SELECT s.id, SUBSTRING_INDEX(s.honestidad_url, '/', -1), 'Honestidad', s.honestidad_url, 'pending', 1
FROM solicitudes s
WHERE s.honestidad_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM documentos_solicitud d WHERE d.solicitud_id = s.id AND d.tipo_documento = 'Honestidad')
UNION ALL
SELECT s.id, SUBSTRING_INDEX(s.id_url, '/', -1), 'Identidad', s.id_url, 'pending', 1
FROM solicitudes s
WHERE s.id_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM documentos_solicitud d WHERE d.solicitud_id = s.id AND d.tipo_documento = 'Identidad');

ALTER TABLE solicitudes
  MODIFY COLUMN estado ENUM(
    'Borrador',
    'Radicado',
    'En Evaluación',
    'Correcciones solicitadas',
    'Aprobado',
    'Rechazado'
  ) NOT NULL DEFAULT 'Borrador';

CREATE TABLE IF NOT EXISTS email_change_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  new_email VARCHAR(100) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_email_change_token UNIQUE (token_hash),
  CONSTRAINT fk_email_change_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_email_change_user (usuario_id, used_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_deletion_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_account_deletion_token UNIQUE (token_hash),
  CONSTRAINT fk_deletion_token_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_deletion_token_user (usuario_id, used_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  documento_id INT NOT NULL,
  usuario_id INT NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_comments_documento FOREIGN KEY (documento_id)
    REFERENCES documentos_solicitud(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_document_comments_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_document_comments_documento (documento_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE user_preferences
  ADD COLUMN notify_convocations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE login_sessions
  ADD COLUMN device_hash CHAR(64) NULL;

CREATE TABLE IF NOT EXISTS trusted_devices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  device_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500) NULL,
  trusted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_trusted_device_ip UNIQUE (usuario_id, device_hash, ip_address),
  CONSTRAINT fk_trusted_device_user FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_trusted_devices_user (usuario_id, device_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_device_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  device_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500) NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_login_device_token UNIQUE (token_hash),
  CONSTRAINT fk_login_device_user FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_login_device_tokens_user (usuario_id, device_hash, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
