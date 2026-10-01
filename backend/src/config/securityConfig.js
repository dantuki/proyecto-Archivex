// ============================================================
// CONFIGURACIÓN DE SEGURIDAD DE ARCHIVEX
// ============================================================
//
// Este archivo centraliza reglas de seguridad que no deben
// variar entre controllers y middleware.
//
// IMPORTANTE:
// El correo del administrador no es un secreto.
// Es una regla de negocio explícita del sistema.
//
// ============================================================

const ADMIN_EMAIL =
  'aracelly.buitrago@campusucc.edu.co';

module.exports = {
  ADMIN_EMAIL
};