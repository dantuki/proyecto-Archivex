// Recrea archivex_final_test desde schema-hostinger.sql y provisiona el Admin con createAdmin.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

const {
  TEST_DB,
  BACKEND_DIR,
  REPO_DIR,
  TMP_DIR,
  PUBLIC_DIR,
  PRIVATE_DIR,
  ADMIN_EMAIL,
  assertTestDb,
  readDbCredentials,
  buildServerEnv,
  connectDb
} = require('./helpers');

const provisionAdmin = () =>
  new Promise((resolve, reject) => {
    const password = crypto.randomBytes(16).toString('hex');
    const child = spawn(process.execPath, ['src/scripts/createAdmin.js'], {
      cwd: BACKEND_DIR,
      env: buildServerEnv(0),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '';
    let sentName = false;
    let sentPassword = false;
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
      if (!sentName && out.includes('Nombre completo del Administrador:')) {
        sentName = true;
        child.stdin.write('TEST DATA Admin\n');
      }
      if (sentName && !sentPassword && out.includes('Contraseña del Administrador:')) {
        sentPassword = true;
        child.stdin.write(`${password}\n`);
      }
    });
    child.on('exit', (code) => {
      if (code === 0 && out.includes('ADMINISTRADOR CREADO CORRECTAMENTE')) return resolve();
      reject(new Error(`createAdmin.js falló (código ${code}). Salida: ${out.replace(password, '***')}`));
    });
  });

const main = async () => {
  assertTestDb(TEST_DB);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });

  const creds = readDbCredentials();
  const admin = await mysql.createConnection({
    host: creds.DB_HOST,
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    port: Number(creds.DB_PORT)
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const db = await connectDb({ multipleStatements: true });
  await db.query(fs.readFileSync(path.join(REPO_DIR, 'database', 'schema-hostinger.sql'), 'utf8'));

  await provisionAdmin();

  // TEST DATA: convocatoria abierta para crear solicitudes.
  await db.query(
    `INSERT INTO convocatorias (codigo, titulo, descripcion, tipo, fecha_inicio, fecha_cierre,
       presupuesto_max, modalidad, area_tematica)
     VALUES ('TEST-CONV-001', 'TEST DATA Convocatoria', 'Convocatoria de prueba', 'General',
       DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 365 DAY), '1000', 'Presencial', 'Pruebas')`
  );

  const [admins] = await db.query('SELECT id FROM usuarios WHERE email = ?', [ADMIN_EMAIL]);
  await db.end();
  console.log(`Base ${TEST_DB} lista (admin creado con createAdmin.js: ${admins.length === 1}).`);
};

main().catch((error) => {
  console.error('setup-db falló:', error.code || error.message);
  process.exit(1);
});
