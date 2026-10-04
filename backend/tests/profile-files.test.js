const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const h = require('./helpers');

describe('Perfil, foto, certificado privado y soporte de noticias', () => {
  let server;
  let db;
  let admin;
  let tokens;
  let user;
  let other;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    admin = await h.getAdmin(db);
    user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'prof-files' });
    other = await h.createTestUser(db, { rol: 'Profesor', prefix: 'prof-files-other' });
    // La tabla login debe reflejar siempre el mismo hash que usuarios.
    for (const u of [user, other]) {
      await db.query('INSERT INTO login (usuario_id, email, password) SELECT id, email, password FROM usuarios WHERE id = ?', [u.id]);
    }
    tokens = {
      admin: await h.loginAs(db, admin),
      user: await h.loginAs(db, user),
      other: await h.loginAs(db, other)
    };
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const put = (token, id, fields = {}, files = []) =>
    h.request(server, 'PUT', `/api/usuarios/${id}`, { token, form: h.buildForm(fields, files) });

  const hashes = async (id) => {
    const [[u]] = await db.query('SELECT email, password, foto_url, certificado_url, nombre_completo FROM usuarios WHERE id = ?', [id]);
    const [[l]] = await db.query('SELECT email, password FROM login WHERE usuario_id = ?', [id]);
    return { u, l };
  };

  const png = { field: 'foto', name: 'foto.png', type: 'image/png', data: h.PNG };
  const cert = { field: 'certificado', name: 'certificado.pdf', type: 'application/pdf', data: h.PDF };

  test('A. Cambiar solo el nombre -> 200, password intacto en usuarios y login', async () => {
    const before = await hashes(user.id);
    const res = await put(tokens.user, user.id, { nombre_completo: 'TEST DATA Nombre Nuevo' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.data.nombre_completo, 'TEST DATA Nombre Nuevo');
    assert.doesNotMatch(res.buffer.toString('utf8'), /password|\$2[aby]\$/i);
    const after = await hashes(user.id);
    assert.equal(after.u.nombre_completo, 'TEST DATA Nombre Nuevo');
    assert.equal(after.u.password, before.u.password);
    assert.equal(after.l.password, before.l.password);
    assert.equal(after.l.password, after.u.password);
  });

  test('B. Cambiar solo la foto -> 200, foto en PUBLIC_DIR, persiste y es visible por /uploads', async () => {
    const before = await hashes(user.id);
    const res = await put(tokens.user, user.id, {}, [png]);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const fotoUrl = res.data.data.foto_url;
    assert.match(fotoUrl, /^\/uploads\/foto-.*\.png$/);
    const file = path.basename(fotoUrl);
    assert.ok(fs.existsSync(path.join(h.PUBLIC_DIR, file)));
    assert.equal(fs.existsSync(path.join(h.PRIVATE_DIR, file)), false);

    const after = await hashes(user.id);
    assert.equal(after.u.foto_url, fotoUrl);
    assert.equal(after.u.password, before.u.password);
    assert.equal(after.l.password, before.l.password);

    const served = await h.request(server, 'GET', fotoUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');

    const reloaded = await h.request(server, 'GET', `/api/usuarios/${user.id}`, { token: tokens.user });
    assert.equal(reloaded.data.data.foto_url, fotoUrl, 'la foto persiste al recargar el perfil');

    const replaced = await put(tokens.user, user.id, {}, [png]);
    assert.equal(replaced.status, 200);
    assert.notEqual(replaced.data.data.foto_url, fotoUrl);
    assert.equal(fs.existsSync(path.join(h.PUBLIC_DIR, file)), false, 'la foto anterior se elimina tras confirmar');
  });

  test('B2. Foto inválida (MIME o firma falsa) -> 400 sin modificar el perfil', async () => {
    const before = await hashes(user.id);
    const files = h.publicFileCount();
    const bad = [
      { field: 'foto', name: 'f.png', type: 'image/png', data: Buffer.from('no es una imagen') },
      { field: 'foto', name: 'f.gif', type: 'image/gif', data: Buffer.from('GIF89a') }
    ];
    for (const f of bad) {
      assert.equal((await put(tokens.user, user.id, {}, [f])).status, 400);
    }
    assert.equal(h.publicFileCount(), files);
    assert.equal((await hashes(user.id)).u.foto_url, before.u.foto_url);
  });

  test('C. Cambiar solo el certificado -> 200, queda en PRIVATE_DIR y se ve solo por el endpoint privado', async () => {
    const before = await hashes(user.id);
    const res = await put(tokens.user, user.id, {}, [cert]);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const url = res.data.data.certificado_url;
    assert.match(url, /^\/uploads_private\/certificado-.*\.pdf$/);
    const file = path.basename(url);
    assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, file)));
    assert.equal(fs.existsSync(path.join(h.PUBLIC_DIR, file)), false);

    const after = await hashes(user.id);
    assert.equal(after.u.password, before.u.password);
    assert.equal(after.l.password, before.l.password);

    const own = await h.request(server, 'GET', `/api/archivos-privados/${file}`, { token: tokens.user });
    assert.equal(own.status, 200);
    assert.equal(own.buffer.subarray(0, 4).toString(), '%PDF');
    assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${file}`, { token: tokens.admin })).status, 200);
    assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${file}`, { token: tokens.other })).status, 403);
    assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${file}`)).status, 401);
    assert.equal((await h.request(server, 'GET', `/uploads/${file}`)).status, 404);
    assert.equal((await h.request(server, 'GET', `/uploads_private/${file}`)).status, 404);
  });

  test('C2. Reemplazar el certificado elimina el anterior y conserva el nuevo', async () => {
    const first = (await hashes(user.id)).u.certificado_url;
    const res = await put(tokens.user, user.id, {}, [cert]);
    assert.equal(res.status, 200);
    assert.notEqual(res.data.data.certificado_url, first);
    assert.equal(fs.existsSync(path.join(h.PRIVATE_DIR, path.basename(first))), false);
    assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, path.basename(res.data.data.certificado_url))));
  });

  test('D. Cambiar el correo sin contraseña -> 200, email sincronizado y hash conservado', async () => {
    const before = await hashes(user.id);
    const newEmail = `nuevo.${h.rand()}@archivex-test.invalid`;
    const res = await put(tokens.user, user.id, { email: newEmail });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const after = await hashes(user.id);
    assert.equal(after.u.email, newEmail);
    assert.equal(after.l.email, newEmail);
    assert.equal(after.u.password, before.u.password);
    assert.equal(after.l.password, before.l.password);
    user.email = newEmail;
  });

  test('E. Cambiar la contraseña -> hash nuevo idéntico en usuarios y login; corta -> 400', async () => {
    const before = await hashes(user.id);
    const short = await put(tokens.user, user.id, { password: 'corta' });
    assert.equal(short.status, 400);
    assert.deepEqual(await hashes(user.id), before);

    const newPassword = `Nueva-${h.rand()}-Clave`;
    const res = await put(tokens.user, user.id, { password: newPassword });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.doesNotMatch(res.buffer.toString('utf8'), /\$2[aby]\$/);
    const after = await hashes(user.id);
    assert.notEqual(after.u.password, before.u.password);
    assert.equal(after.l.password, after.u.password);
    assert.equal(await bcrypt.compare(newPassword, after.u.password), true);
  });

  test('E2. Correo y contraseña a la vez quedan sincronizados', async () => {
    const newEmail = `ambos.${h.rand()}@archivex-test.invalid`;
    const res = await put(tokens.user, user.id, { email: newEmail, password: `Otra-${h.rand()}-Clave` });
    assert.equal(res.status, 200);
    const { u, l } = await hashes(user.id);
    assert.deepEqual([l.email, l.password], [u.email, u.password]);
  });

  test('H. Si falla la sincronización de login se revierte todo y no se pierde el estado anterior', async () => {
    // login.email es UNIQUE: otro registro de login ya usa el correo solicitado.
    const taken = `ocupado.${h.rand()}@archivex-test.invalid`;
    const [res0] = await db.query('SELECT id FROM usuarios WHERE id = ?', [other.id]);
    assert.equal(res0.length, 1);
    await db.query('UPDATE login SET email = ? WHERE usuario_id = ?', [taken, other.id]);

    const before = await hashes(user.id);
    const publicBefore = h.publicFileCount();
    const res = await put(tokens.user, user.id, { email: taken, nombre_completo: 'TEST DATA no debe guardarse' }, [png]);
    assert.equal(res.status, 500);
    const after = await hashes(user.id);
    assert.deepEqual(after, before, 'usuarios y login permanecen sin cambios parciales');
    assert.equal(h.publicFileCount(), publicBefore, 'la foto nueva no confirmada se elimina');
    assert.ok(!before.u.foto_url || fs.existsSync(path.join(h.PUBLIC_DIR, path.basename(before.u.foto_url))), 'la foto vigente sigue en disco');
  });

  test('El perfil de un usuario sin fila en login se actualiza sin error', async () => {
    const lone = await h.createTestUser(db, { rol: 'Profesor', prefix: 'sinlogin' });
    const token = await h.loginAs(db, lone);
    const res = await put(token, lone.id, { email: `sinlogin.${h.rand()}@archivex-test.invalid` });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  });

  test('G. Usuario ajeno no puede modificar el perfil ni subir archivos (403, sin residuos)', async () => {
    const files = [h.publicFileCount(), h.privateFileCount()];
    const before = await hashes(other.id);
    const res = await put(tokens.user, other.id, { nombre_completo: 'hack' }, [png, cert]);
    assert.equal(res.status, 403);
    assert.deepEqual([h.publicFileCount(), h.privateFileCount()], files);
    assert.deepEqual(await hashes(other.id), before);
  });

  describe('Noticias: soporte adjunto privado', () => {
    let noticia;

    test('F. Crear noticia con soporte -> 201; queda privado y se ve por el endpoint autenticado', async () => {
      const form = h.buildForm(
        { titulo: 'TEST DATA Noticia', contenido: 'Contenido de prueba', fecha: '2030-01-15' },
        [{ field: 'archivo', name: 'soporte.pdf', type: 'application/pdf', data: h.PDF }]
      );
      const created = await h.request(server, 'POST', '/api/noticias', { token: tokens.user, form });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const [[row]] = await db.query('SELECT archivo_url, usuario_id FROM noticias WHERE id = ?', [created.data.id]);
      assert.equal(row.usuario_id, user.id);
      assert.match(row.archivo_url, /^uploads_private\//);
      noticia = { id: created.data.id, file: path.basename(row.archivo_url) };
      assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, noticia.file)));

      const own = await h.request(server, 'GET', `/api/archivos-privados/${noticia.file}`, { token: tokens.user });
      assert.equal(own.status, 200);
      assert.equal(own.buffer.subarray(0, 4).toString(), '%PDF');
      assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${noticia.file}`, { token: tokens.admin })).status, 200);

      const list = await h.request(server, 'GET', `/api/noticias/usuario/${user.id}`, { token: tokens.user });
      assert.equal(list.status, 200);
      assert.ok(list.data.data.some((n) => n.archivo_url === row.archivo_url));
    });

    test('G2. Soporte de noticia: usuario ajeno 403, sin JWT 401, nunca como estático', async () => {
      assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${noticia.file}`, { token: tokens.other })).status, 403);
      assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${noticia.file}`)).status, 401);
      assert.equal((await h.request(server, 'GET', `/uploads/${noticia.file}`)).status, 404);
      assert.equal((await h.request(server, 'GET', `/uploads_private/${noticia.file}`)).status, 404);
      assert.equal((await h.request(server, 'GET', `/api/noticias/usuario/${user.id}`, { token: tokens.other })).status, 403);
    });
  });

  test('Código: el frontend no enlaza directamente a /uploads_private', () => {
    const root = path.join(h.REPO_DIR, 'frontend', 'src');
    for (const file of ['components/DatosPersonales.jsx', 'components/Noticias.jsx']) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      assert.doesNotMatch(text, /href=\{`\$\{BACKEND_ORIGIN\}\$\{(certificadoUrl|item\.archivo_url)\}`\}/, file);
      assert.match(text, /abrirArchivoPrivado/, file);
    }
  });
});
