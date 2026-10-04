const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const h = require('./helpers');

const SCHEMA_HOSTINGER = path.join(h.REPO_DIR, 'database', 'schema-hostinger.sql');
const SCHEMA_DEV = path.join(h.REPO_DIR, 'database', 'schema.sql');
const MIGRATION = path.join(h.REPO_DIR, 'database', 'migrations', '20261004_remove_docente_role.sql');
const ENUM_FINAL = "ENUM(\n    'Admin',\n    'Profesor',\n    'Evaluador'\n  )";
const rd = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('Base de datos, migración y anonimización', () => {
  let db;
  let server;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  test('archivex_final_test: 20 tablas, 18 sedes y ENUM de rol exacto', async () => {
    const [tables] = await db.query('SHOW TABLES');
    assert.equal(tables.length, 20);
    const names = tables.map((row) => Object.values(row)[0]);
    assert.ok(names.includes('chat_mensajes'), 'chat_mensajes debe venir en el esquema');
    const [sedes] = await db.query('SELECT COUNT(*) AS n FROM sedes');
    assert.equal(sedes[0].n, 18);
    const [col] = await db.query("SHOW COLUMNS FROM usuarios LIKE 'rol'");
    assert.equal(col[0].Type, "enum('Admin','Profesor','Evaluador')");
  });

  test('Esquemas SQL: ENUM de rol sin Docente y sin CREATE DATABASE/USE/DROP en el esquema Hostinger', () => {
    for (const file of [SCHEMA_HOSTINGER, SCHEMA_DEV]) {
      const sql = rd(file);
      assert.ok(sql.includes(ENUM_FINAL), `${path.basename(file)} no tiene el ENUM final`);
      assert.doesNotMatch(sql, /'Docente'/);
    }
    const hostinger = rd(SCHEMA_HOSTINGER).replace(/--.*$/gm, '');
    assert.doesNotMatch(hostinger, /CREATE\s+DATABASE|DROP\s+(DATABASE|TABLE)|^\s*USE\s+|GRANT\s|DEFINER|TRIGGER|PROCEDURE|SUPER/im);
    assert.equal((hostinger.match(/CREATE TABLE/g) || []).length, 20);
  });

  test('Migración 20261004: convierte un usuario Docente antiguo a Profesor y fija el ENUM', async () => {
    const name = `${h.TEST_DB}_migration`;
    h.assertTestDb(name);
    const creds = h.readDbCredentials();
    const admin = await mysql.createConnection({
      host: creds.DB_HOST,
      user: creds.DB_USER,
      password: creds.DB_PASSWORD,
      port: Number(creds.DB_PORT)
    });
    try {
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      const conn = await h.connectDb({ database: name, multipleStatements: true });
      try {
        const legacy = rd(SCHEMA_HOSTINGER).replace(
          ENUM_FINAL,
          "ENUM(\n    'Admin',\n    'Profesor',\n    'Docente',\n    'Evaluador'\n  )"
        );
        assert.notEqual(legacy, rd(SCHEMA_HOSTINGER));
        await conn.query(legacy);
        await conn.query(
          `INSERT INTO usuarios (cedula, nombre_completo, email, password, rol)
           VALUES ('LEG1', 'TEST DATA Docente antiguo', 'docente.antiguo@archivex-test.invalid', 'x', 'Docente')`
        );
        await conn.query(fs.readFileSync(MIGRATION, 'utf8'));
        const [rows] = await conn.query("SELECT rol FROM usuarios WHERE cedula = 'LEG1'");
        assert.equal(rows[0].rol, 'Profesor');
        const [col] = await conn.query("SHOW COLUMNS FROM usuarios LIKE 'rol'");
        assert.equal(col[0].Type, "enum('Admin','Profesor','Evaluador')");
        assert.equal(col[0].Default, 'Profesor');
        await assert.rejects(
          conn.query("INSERT INTO usuarios (cedula, nombre_completo, email, password, rol) VALUES ('LEG2','x','x2@archivex-test.invalid','x','Docente')"),
          /Data truncated|Incorrect|rol/i
        );
      } finally {
        await conn.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.end();
    }
  });

  test('schema.sql (desarrollo) y schema-hostinger.sql generan exactamente la misma estructura', async () => {
    const dev = rd(SCHEMA_DEV)
      .replace(/^CREATE DATABASE[\s\S]*?;\s*/m, '')
      .replace(/^USE\s+\w+;\s*$/m, '');
    assert.doesNotMatch(dev, /sinfoni_db/, 'nunca se debe ejecutar contra sinfoni_db');

    const creds = h.readDbCredentials();
    const admin = await mysql.createConnection({
      host: creds.DB_HOST,
      user: creds.DB_USER,
      password: creds.DB_PASSWORD,
      port: Number(creds.DB_PORT)
    });
    const names = [`${h.TEST_DB}_parity_dev`, `${h.TEST_DB}_parity_hostinger`];
    const ddl = [];
    try {
      for (const [index, name] of names.entries()) {
        h.assertTestDb(name);
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
        await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        const conn = await h.connectDb({ database: name, multipleStatements: true });
        try {
          await conn.query(index === 0 ? dev : rd(SCHEMA_HOSTINGER));
          const [tables] = await conn.query('SHOW TABLES');
          const result = {};
          for (const row of tables) {
            const table = Object.values(row)[0];
            const [[create]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
            result[table] = create['Create Table'];
          }
          ddl.push(result);
        } finally {
          await conn.end();
        }
      }
    } finally {
      for (const name of names) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await admin.end();
    }
    assert.deepEqual(Object.keys(ddl[0]).sort(), Object.keys(ddl[1]).sort());
    assert.equal(Object.keys(ddl[1]).length, 20);
    for (const table of Object.keys(ddl[1])) {
      assert.equal(ddl[0][table], ddl[1][table], `la tabla ${table} difiere entre los esquemas`);
    }
  });

  test('Anonimización: la cuenta queda deshabilitada y conserva su rol original', async () => {
    const adminUser = await h.getAdmin(db);
    const token = await h.loginAs(db, adminUser);
    const user = await h.createTestUser(db, { rol: 'Evaluador', prefix: 'anon' });
    await db.query(
      `UPDATE usuarios SET account_status = 'pending_deletion',
         deletion_requested_at = DATE_SUB(NOW(), INTERVAL 31 DAY),
         deletion_scheduled_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
       WHERE id = ?`,
      [user.id]
    );
    const res = await h.request(server, 'POST', `/api/settings/admin/pending-deletions/${user.id}/anonymize`, { token });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const [rows] = await db.query('SELECT rol, account_status, nombre_completo, email, correo_verificado FROM usuarios WHERE id = ?', [user.id]);
    assert.equal(rows[0].rol, 'Evaluador');
    assert.equal(rows[0].account_status, 'disabled');
    assert.equal(rows[0].nombre_completo, 'Cuenta eliminada');
    assert.notEqual(rows[0].email, user.email);
    assert.equal(rows[0].correo_verificado, 0);
  });

  test('Anonimización: una cuenta que aún no vence no se anonimiza (409)', async () => {
    const adminUser = await h.getAdmin(db);
    const token = await h.loginAs(db, adminUser);
    const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'anon' });
    await db.query(
      `UPDATE usuarios SET account_status = 'pending_deletion', deletion_scheduled_at = DATE_ADD(NOW(), INTERVAL 10 DAY) WHERE id = ?`,
      [user.id]
    );
    const res = await h.request(server, 'POST', `/api/settings/admin/pending-deletions/${user.id}/anonymize`, { token });
    assert.equal(res.status, 409);
    const [rows] = await db.query('SELECT account_status FROM usuarios WHERE id = ?', [user.id]);
    assert.equal(rows[0].account_status, 'pending_deletion');
  });
});
