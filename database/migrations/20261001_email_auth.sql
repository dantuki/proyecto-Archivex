-- Apply once to an existing ArchiveX database before deploying the email flows.
-- MySQL 8.0.29+ / current MariaDB support IF NOT EXISTS on ADD COLUMN.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS correo_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS correo_verificado_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_email_verification_token UNIQUE (token_hash),
  CONSTRAINT fk_email_verification_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_email_verification_usuario (usuario_id),
  INDEX idx_email_verification_expira (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_password_reset_token UNIQUE (token_hash),
  CONSTRAINT fk_password_reset_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_password_reset_usuario (usuario_id),
  INDEX idx_password_reset_expira (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
