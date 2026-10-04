// Infraestructura de pruebas: solo usa la base aislada archivex_final_test.
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const TEST_DB = 'archivex_final_test';
const BACKEND_DIR = path.resolve(__dirname, '../..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');
const TMP_DIR = path.join(os.tmpdir(), 'archivex-final-test');
const PUBLIC_DIR = path.join(TMP_DIR, 'uploads');
const PRIVATE_DIR = path.join(TMP_DIR, 'uploads_private');
const ADMIN_EMAIL = 'aracelly.buitrago@campusucc.edu.co';

// Valor exclusivo de pruebas; el servidor de test se inicia con este secreto.
const TEST_JWT_SECRET = 'archivex-final-test-only-jwt-secret-0123456789';

const assertTestDb = (name) => {
  if (name !== TEST_DB && !String(name).startsWith(`${TEST_DB}_`)) {
    throw new Error(`Base no permitida para pruebas: ${name}`);
  }
};

// Credenciales de MySQL: se leen sin cargar el resto de backend/.env en el proceso.
const readDbCredentials = () => {
  let parsed = {};
  const envPath = path.join(BACKEND_DIR, '.env');
  if (fs.existsSync(envPath)) {
    parsed = dotenv.parse(fs.readFileSync(envPath));
  }
  const pick = (key, fallback) => process.env[key] ?? parsed[key] ?? fallback;
  return {
    DB_HOST: pick('DB_HOST', 'localhost'),
    DB_USER: pick('DB_USER', 'root'),
    DB_PASSWORD: pick('DB_PASSWORD', ''),
    DB_PORT: String(pick('DB_PORT', '3306')),
    envKeys: Object.keys(parsed)
  };
};

const buildServerEnv = (port) => {
  const creds = readDbCredentials();
  const overrides = {
    DB_HOST: creds.DB_HOST,
    DB_USER: creds.DB_USER,
    DB_PASSWORD: creds.DB_PASSWORD,
    DB_PORT: creds.DB_PORT,
    DB_NAME: TEST_DB,
    NODE_ENV: 'test',
    PORT: String(port || 0),
    JWT_SECRET: TEST_JWT_SECRET,
    RECAPTCHA_SECRET_KEY: 'test-invalid-recaptcha-secret',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    // SMTP inexistente: ningún correo real puede salir durante las pruebas.
    MAIL_HOST: '127.0.0.1',
    MAIL_PORT: '9',
    MAIL_SECURE: 'false',
    MAIL_USER: 'test@archivex-test.invalid',
    MAIL_PASSWORD: 'test-invalid',
    MAIL_FROM: 'ArchiveX Test <test@archivex-test.invalid>',
    UPLOADS_PUBLIC_DIR: PUBLIC_DIR,
    UPLOADS_PRIVATE_DIR: PRIVATE_DIR
  };
  const env = { ...process.env, ...overrides };
  // Evita que dotenv cargue cualquier otro valor real de backend/.env en el hijo.
  for (const key of creds.envKeys) {
    if (!(key in overrides)) env[key] = '';
  }
  assertTestDb(env.DB_NAME);
  return env;
};

const connectDb = async ({ database = TEST_DB, multipleStatements = false } = {}) => {
  if (database) assertTestDb(database);
  const creds = readDbCredentials();
  return mysql.createConnection({
    host: creds.DB_HOST,
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    port: Number(creds.DB_PORT),
    database: database || undefined,
    multipleStatements
  });
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });

const startServer = async () => {
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: BACKEND_DIR,
    env: buildServerEnv(port),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`El servidor de pruebas no arrancó:\n${logs.join('')}`)),
      30000
    );
    const check = () => {
      const text = logs.join('');
      if (/corriendo en puerto/.test(text) && /Conexión exitosa/.test(text)) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', check);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`El servidor terminó con código ${code}:\n${logs.join('')}`));
    });
  });

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    logs,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode) return resolve();
        child.once('exit', () => resolve());
        child.kill();
      })
  };
};

const request = async (
  server,
  method,
  urlPath,
  { token, json, form, headers = {}, rawAuth } = {}
) => {
  const h = { ...headers };
  if (rawAuth !== undefined) h.Authorization = rawAuth;
  else if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(server.baseUrl + urlPath, { method, headers: h, body, redirect: 'manual' });
  const buffer = Buffer.from(await res.arrayBuffer());
  let data = null;
  if ((res.headers.get('content-type') || '').includes('json')) {
    try {
      data = JSON.parse(buffer.toString('utf8'));
    } catch {
      data = null;
    }
  }
  return { status: res.status, data, buffer, headers: res.headers };
};

const hash = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const rand = () => crypto.randomBytes(5).toString('hex');

// ---------- fixtures (TEST DATA) ----------

const createTestUser = async (db, { rol, prefix = 'u', verified = true, status = 'active' }) => {
  const id = rand();
  const email = `${prefix}.${rol.toLowerCase()}.${id}@archivex-test.invalid`;
  const passwordPlain = crypto.randomBytes(12).toString('hex');
  const password = await bcrypt.hash(passwordPlain, 4);
  const [result] = await db.query(
    `INSERT INTO usuarios (cedula, nombre_completo, email, password, rol,
       correo_verificado, correo_verificado_at, account_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`T${id}`, `TEST DATA ${rol} ${id}`, email, password, rol, verified ? 1 : 0, verified ? new Date() : null, status]
  );
  await db.query('INSERT INTO user_preferences (usuario_id, email_notifications) VALUES (?, 0)', [result.insertId]);
  return { id: result.insertId, email, rol, passwordPlain };
};

const getAdmin = async (db) => {
  const [rows] = await db.query('SELECT id, email, rol FROM usuarios WHERE email = ?', [ADMIN_EMAIL]);
  if (!rows[0]) throw new Error('El Admin de prueba no existe; ejecuta npm test (setup-db).');
  return rows[0];
};

const getBaseData = async (db) => {
  const [conv] = await db.query("SELECT id FROM convocatorias WHERE codigo = 'TEST-CONV-001'");
  const [sede] = await db.query('SELECT id FROM sedes ORDER BY id LIMIT 1');
  return { convocatoriaId: conv[0].id, sedeId: sede[0].id };
};

const createSession = async (db, userId, { expiresSql = 'DATE_ADD(NOW(), INTERVAL 1 HOUR)', revoked = false } = {}) => {
  const sid = crypto.randomUUID();
  await db.query(
    `INSERT INTO login_sessions (id, usuario_id, expires_at, revoked_at)
     VALUES (?, ?, ${expiresSql}, ${revoked ? 'NOW()' : 'NULL'})`,
    [sid, userId]
  );
  return sid;
};

const signToken = (user, { sid, expiresIn = '1h', secret = TEST_JWT_SECRET, rol, email } = {}) =>
  jwt.sign(
    { id: user.id, email: email ?? user.email, rol: rol ?? user.rol, ...(sid ? { sid } : {}) },
    secret,
    { algorithm: 'HS256', expiresIn }
  );

// Token válido con sesión registrada, equivalente al que emite el login real.
const loginAs = async (db, user, options = {}) => {
  const sid = await createSession(db, user.id);
  return signToken(user, { sid, ...options });
};

// ---------- archivos de prueba ----------

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('TESTPNG')
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('TESTJPG')]);

const buildForm = (fields = {}, files = []) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  for (const f of files) {
    form.append(f.field, new Blob([f.data], { type: f.type }), f.name);
  }
  return form;
};

const pdfFile = (field, name = `${field}.pdf`) => ({ field, name, type: 'application/pdf', data: PDF });

const privateFileCount = () => (fs.existsSync(PRIVATE_DIR) ? fs.readdirSync(PRIVATE_DIR).length : 0);
const publicFileCount = () => (fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR).length : 0);

const createSolicitudViaApi = async (server, db, token, { title = 'TEST DATA Propuesta', files } = {}) => {
  const { convocatoriaId, sedeId } = await getBaseData(db);
  const form = buildForm(
    { convocatoria_id: convocatoriaId, sede_id: sedeId, titulo_propuesta: `${title} ${rand()}` },
    files || [pdfFile('presupuesto'), pdfFile('cronograma'), pdfFile('honestidad'), pdfFile('identidad')]
  );
  const res = await request(server, 'POST', '/api/solicitudes', { token, form });
  return res;
};

const resolveSocketClient = () => {
  try {
    return require(require.resolve('socket.io-client', {
      paths: [path.join(REPO_DIR, 'frontend', 'node_modules'), BACKEND_DIR]
    }));
  } catch {
    return null;
  }
};

module.exports = {
  TEST_DB,
  BACKEND_DIR,
  REPO_DIR,
  TMP_DIR,
  PUBLIC_DIR,
  PRIVATE_DIR,
  ADMIN_EMAIL,
  TEST_JWT_SECRET,
  assertTestDb,
  readDbCredentials,
  buildServerEnv,
  connectDb,
  startServer,
  request,
  hash,
  rand,
  createTestUser,
  getAdmin,
  getBaseData,
  createSession,
  signToken,
  loginAs,
  PDF,
  PNG,
  JPG,
  buildForm,
  pdfFile,
  privateFileCount,
  publicFileCount,
  createSolicitudViaApi,
  resolveSocketClient
};
