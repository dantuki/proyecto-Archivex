# ArchiveX

ArchiveX es una aplicación institucional para gestionar convocatorias académicas, perfiles, postulaciones, documentos y evaluaciones. Incluye autenticación por roles, verificación de correo, recuperación de contraseña, notificaciones y seguimiento de solicitudes.

## Stack

- Backend: Node.js, Express en CommonJS, MySQL, Nodemailer y Socket.IO.
- Frontend: React, Vite y Tailwind CSS.
- Archivos de solicitudes y evaluación: almacenamiento privado servido mediante rutas autenticadas.

## Requisitos

- Node.js compatible con Vite 8 (20.19+ o 22.12+).
- MySQL 8.0.29+.
- Una cuenta SMTP para entregar correo. Para Gmail se requiere una contraseña de aplicación.
- Credenciales válidas de reCAPTCHA para el registro y el inicio de sesión.

## Base de datos

Para una instalación local desde cero, ejecuta `database/schema.sql` contra una base de desarrollo vacía:

```sh
mysql -u <usuario_mysql> -p < database/schema.sql
```

El esquema selecciona `sinfoni_db`, elimina y vuelve a crear las tablas de ArchiveX y carga las sedes iniciales. **No lo ejecutes sobre una base con datos que deban conservarse.** El esquema incluye las tablas, campos, índices, enums y claves foráneas requeridos por la versión actual; una instalación nueva no necesita ejecutar los archivos de `database/migrations/`.

Para una base existente, conserva una copia de seguridad y aplica en orden las migraciones de `database/migrations/` que todavía no se hayan ejecutado:

1. `20261001_email_auth.sql`
2. `20261001_user_experience.sql`
3. `20261001_experience_completion.sql`

No apliques migraciones que ya estén reflejadas en la base.

## Variables de entorno

Configura los valores localmente en `backend/.env`. No los subas al repositorio. El backend necesita:

- Base de datos: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- Aplicación: `PORT`, `JWT_SECRET` (mínimo 32 caracteres), `RECAPTCHA_SECRET_KEY`, `FRONTEND_ORIGIN`.
- SMTP: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`.
- `MAIL_FROM` es opcional; si se omite se usa `MAIL_USER` como remitente.

`FRONTEND_ORIGIN` admite orígenes separados por comas; el primero se utiliza para construir enlaces de verificación y recuperación. El frontend permite configurar `VITE_API_URL`; por defecto usa `http://localhost:5000/api`.

La clave pública de sitio reCAPTCHA está configurada en el formulario de `frontend/src/components/Login.jsx`; para usar otro dominio, configura allí la clave pública correspondiente. La clave secreta del proveedor se mantiene únicamente en `backend/.env`.

## Instalación y ejecución

Instala las dependencias de cada aplicación por separado.

Backend:

```sh
cd backend
npm install
npm run dev
```

Frontend, en otra terminal:

```sh
cd frontend
npm install
npm run dev
```

Vite mostrará la URL local cuando el servidor esté listo. El backend usa `PORT` y, si no se configura, escucha en el puerto 5000.

## Correo SMTP

Todos los correos transaccionales usan Nodemailer y el transporter de `backend/src/config/mailConfig.js`. En desarrollo se registran de forma redactada el tipo/código de error y los datos de entrega disponibles; nunca se deben registrar contraseñas o secretos.

Para verificar la conexión y realizar un envío de prueba a `MAIL_USER`:

```sh
cd backend
npm run verify:mail
```

Este comando envía un mensaje real a la cuenta configurada en `MAIL_USER`.

## Roles y seguridad

- El correo reservado para el único Administrador es `aracelly.buitrago@campusucc.edu.co`.
- El registro público solo admite `Profesor`, `Docente` y `Evaluador`; nunca puede crear un Administrador.
- Después de crear la base vacía, provisiona el Admin desde `backend` con `node src/scripts/createAdmin.js`. El script usa el correo reservado y solicita el nombre y la contraseña durante la ejecución; no guardes la contraseña en el repositorio.
- Las cuentas nuevas deben verificar su correo antes del primer acceso.
- Los inicios de sesión desde un dispositivo o una IP no confiables requieren confirmación por correo.
- Los tokens de verificación y recuperación se almacenan como hashes, tienen vencimiento y son de un solo uso.
- Las solicitudes de eliminación requieren contraseña y confirmación por correo. A los 30 días el proceso anonimiza la cuenta y conserva solicitudes y trazabilidad institucional.
- Los directorios `backend/uploads/` y `backend/uploads_private/` contienen archivos locales y no deben añadirse a Git.

## Funcionalidades

- Perfil académico y gestión de foto/certificado.
- Preferencias por usuario: tema, escala de texto y notificaciones.
- Historial de sesiones, cambio de contraseña, cierre de sesiones y cambio verificado de correo.
- Notificaciones internas y por correo para actividad de solicitudes, documentos, evaluaciones y convocatorias.
- Seguimiento cronológico de postulaciones, revisión y comentarios de documentos, previsualización privada y versiones reemplazadas.
- Dashboard con métricas disponibles para Admin, Evaluador, Profesor y Docente.

## Verificación de cambios

Frontend:

```sh
cd frontend
npm run build
npm run lint
```

Backend: desde `backend`, usa `node --check` sobre los archivos JavaScript de `src/`. No hay una suite automatizada de pruebas backend configurada actualmente.
