-- Apply once to an existing ArchiveX database. Roles become Admin, Profesor, Evaluador.
-- Existing 'Docente' users were treated as Profesor, so they are converted first.
-- Back up the database before running; not needed on a fresh install.

UPDATE usuarios SET rol = 'Profesor' WHERE rol = 'Docente';

ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM('Admin', 'Profesor', 'Evaluador')
    NOT NULL DEFAULT 'Profesor';
