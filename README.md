# ArchiveX

ArchiveX es una aplicación institucional para gestionar convocatorias académicas, perfiles, postulaciones, documentos y evaluaciones. Incluye autenticación por roles, verificación de correo, recuperación de contraseña, notificaciones y seguimiento de solicitudes.

## Stack

- Backend: Node.js, Express en CommonJS, MySQL, Nodemailer y Socket.IO.
- Frontend: React, Vite y Tailwind CSS.
- Archivos de solicitudes y evaluación: almacenamiento privado servido mediante rutas autenticadas.

## Requisitos

- Node.js 22 (backend `>=22`, frontend `>=22.12`).
- MySQL 8.0.29+.
- Una cuenta SMTP para entregar correo. Para Gmail se requiere una contraseña de aplicación.
- Credenciales válidas de reCAPTCHA para el registro y el inicio de sesión.

## Base de datos

- `database/schema.sql`: solo para desarrollo local. Crea `sinfoni_db`, elimina y vuelve a crear las tablas y carga las sedes iniciales.
- `database/schema-hostinger.sql`: para Hostinger. Se importa dentro de una base ya creada desde el panel; no usa `CREATE DATABASE`, `USE`, `DROP` ni privilegios especiales. Incluye todas las tablas (también `chat_mensajes`) y las sedes iniciales. Importarlo una sola vez sobre una base vacía.

Para una instalación local desde cero, ejecuta `database/schema.sql` contra una base de desarrollo vacía:

```sh
mysql -u <usuario_mysql> -p < database/schema.sql
```

El esquema selecciona `sinfoni_db`, elimina y vuelve a crear las tablas de ArchiveX y carga las sedes iniciales. **No lo ejecutes sobre una base con datos que deban conservarse.** El esquema incluye las tablas, campos, índices, enums y claves foráneas requeridos por la versión actual; una instalación nueva no necesita ejecutar los archivos de `database/migrations/`.

Para una base existente, conserva una copia de seguridad y aplica en orden las migraciones de `database/migrations/` que todavía no se hayan ejecutado:

1. `20261001_email_auth.sql`
2. `20261001_user_experience.sql`
3. `20261001_experience_completion.sql`
4. `20261004_remove_docente_role.sql` (convierte usuarios `Docente` en `Profesor` y deja el rol como `Admin`, `Profesor`, `Evaluador`)

No apliques migraciones que ya estén reflejadas en la base.

## Variables de entorno

Configura los valores localmente en `backend/.env`. No los subas al repositorio. El backend necesita:

- Base de datos: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- Aplicación: `PORT`, `NODE_ENV`, `JWT_SECRET` (mínimo 32 caracteres), `RECAPTCHA_SECRET_KEY`, `FRONTEND_ORIGIN`.
- SMTP: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`.
- `MAIL_FROM` es opcional; si se omite se usa `MAIL_USER` como remitente.
- Archivos subidos (opcionales): `UPLOADS_PUBLIC_DIR` y `UPLOADS_PRIVATE_DIR`, rutas absolutas. `UPLOADS_PRIVATE_DIR` no puede estar dentro de `UPLOADS_PUBLIC_DIR`. Sin ellas se usan `backend/uploads` y `backend/uploads_private`.

`FRONTEND_ORIGIN` admite orígenes separados por comas, sin barra final (por ejemplo `https://app.midominio.com`); el primero se utiliza para construir enlaces de verificación y recuperación.

El frontend se configura con variables `VITE_*` en `frontend/.env`, que se incrustan al compilar:

- `VITE_API_URL`: URL pública de la API incluyendo `/api` (por ejemplo `https://api.midominio.com/api`). De ella se derivan el origen de archivos públicos y la URL de Socket.IO. Si se omite, se asume la API en el mismo origen (`/api`).
- `VITE_RECAPTCHA_SITE_KEY`: clave pública de reCAPTCHA. El dominio de producción debe estar registrado para esa clave. La clave secreta se mantiene únicamente en `backend/.env`.

Para desarrollo local crea `frontend/.env` con `VITE_API_URL=http://localhost:5000/api` y tu `VITE_RECAPTCHA_SITE_KEY`.

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
- El registro público solo admite `Profesor` y `Evaluador`; nunca puede crear un Administrador. Los roles oficiales son `Admin`, `Profesor` y `Evaluador`.
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
- Dashboard con métricas disponibles para Admin, Evaluador y Profesor.

## Despliegue en Hostinger

Arquitectura: frontend estático y backend Node.js separados, en subdominios distintos (por ejemplo `app.midominio.com` y `api.midominio.com`). Usa Node 22 en ambos.

Base de datos: crea la base MySQL en el panel e importa `database/schema-hostinger.sql`. Usa sus credenciales en `DB_*` (en Hostinger llevan prefijo).

Backend (aplicación Node.js, directorio raíz `backend`):

- Instalación: `npm ci --omit=dev`. Sin paso de build.
- Inicio: `npm start`.
- Variables: `NODE_ENV=production`, `DB_*`, `JWT_SECRET`, `RECAPTCHA_SECRET_KEY`, `FRONTEND_ORIGIN=https://app.midominio.com`, `MAIL_*` y `PORT` si el panel lo asigna.
- Define `UPLOADS_PUBLIC_DIR` y `UPLOADS_PRIVATE_DIR` con rutas absolutas fuera del directorio desplegado para que los archivos no se pierdan en un redeploy.
- El backend confía en un único proxy inverso (`trust proxy` = 1) para obtener la IP real del cliente.

Frontend (sitio estático, directorio raíz `frontend`):

- Instalación: `npm ci`. Build: `npm run build`. Salida: `dist`.
- Variables de build: `VITE_API_URL=https://api.midominio.com/api` y `VITE_RECAPTCHA_SITE_KEY`. Recompila si cambian.

Registra el dominio del frontend en la consola de reCAPTCHA y activa SSL en ambos subdominios.

## Verificación de cambios

Frontend:

```sh
cd frontend
npm run build
npm run lint
```

Backend: desde `backend`, usa `node --check` sobre los archivos JavaScript de `src/`. No hay una suite automatizada de pruebas backend configurada actualmente.
