const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

describe('Carga de documentos y archivos', () => {
  let server;
  let db;
  let tokens;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    const admin = await h.getAdmin(db);
    const prof = await h.createTestUser(db, { rol: 'Profesor', prefix: 'up' });
    tokens = { admin: await h.loginAs(db, admin), prof: await h.loginAs(db, prof) };
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const submit = async (files, token = tokens.prof) => {
    const { convocatoriaId, sedeId } = await h.getBaseData(db);
    const form = h.buildForm(
      { convocatoria_id: convocatoriaId, sede_id: sedeId, titulo_propuesta: `TEST DATA Upload ${h.rand()}` },
      files
    );
    return h.request(server, 'POST', '/api/solicitudes', { token, form });
  };

  test('PDF, PNG y JPG válidos -> 201 y se almacenan en la carpeta privada', async () => {
    const before = h.privateFileCount();
    const publicBefore = h.publicFileCount();
    const res = await submit([
      h.pdfFile('presupuesto'),
      { field: 'cronograma', name: 'c.png', type: 'image/png', data: h.PNG },
      { field: 'identidad', name: 'i.jpg', type: 'image/jpeg', data: h.JPG }
    ]);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(h.privateFileCount(), before + 3);
    assert.equal(h.publicFileCount(), publicBefore, 'nada debe escribirse en la carpeta pública');
  });

  test('MIME no permitido (con o sin extensión falsa) -> 400 y sin residuos', async () => {
    const before = h.privateFileCount();
    for (const f of [
      { field: 'presupuesto', name: 'macro.exe', type: 'application/x-msdownload', data: Buffer.from('MZ....') },
      { field: 'presupuesto', name: 'documento.pdf', type: 'application/x-msdownload', data: Buffer.from('MZ....') },
      { field: 'presupuesto', name: 'script.pdf', type: 'text/html', data: Buffer.from('<script>alert(1)</script>') }
    ]) {
      const res = await submit([f]);
      assert.equal(res.status, 400, `${f.name}/${f.type} -> ${res.status}`);
    }
    assert.equal(h.privateFileCount(), before);
  });

  test('Extensión falsa con MIME/firma PDF: se acepta pero se guarda con extensión .pdf derivada del MIME', async () => {
    const res = await submit([{ field: 'presupuesto', name: 'evil.exe', type: 'application/pdf', data: h.PDF }]);
    assert.equal(res.status, 201);
    const [rows] = await db.query('SELECT archivo_url FROM documentos_solicitud WHERE solicitud_id = ?', [res.data.data.id]);
    assert.match(rows[0].archivo_url, /\.pdf$/);
    assert.doesNotMatch(rows[0].archivo_url, /evil/);
  });

  test('MIME falso (contenido no coincide con la firma) -> 400 y se elimina el archivo', async () => {
    const before = h.privateFileCount();
    for (const f of [
      { field: 'presupuesto', name: 'falso.pdf', type: 'application/pdf', data: Buffer.from('esto no es un pdf') },
      { field: 'presupuesto', name: 'png-como-pdf.pdf', type: 'application/pdf', data: h.PNG },
      { field: 'cronograma', name: 'pdf-como-png.png', type: 'image/png', data: h.PDF }
    ]) {
      const res = await submit([f]);
      assert.equal(res.status, 400, `${f.name} -> ${res.status}`);
    }
    assert.equal(h.privateFileCount(), before);
  });

  test('Archivo mayor a 10 MB -> 400 y sin residuos', async () => {
    const before = h.privateFileCount();
    const big = Buffer.concat([h.PDF, Buffer.alloc(11 * 1024 * 1024, 0x20)]);
    const res = await submit([{ field: 'presupuesto', name: 'grande.pdf', type: 'application/pdf', data: big }]);
    assert.equal(res.status, 400);
    assert.equal(h.privateFileCount(), before);
  });

  test('Campo de archivo no permitido -> 400', async () => {
    const res = await submit([h.pdfFile('otro_campo')]);
    assert.equal(res.status, 400);
  });

  test('Convocatoria: Admin sube bases PDF válidas; se sirven públicamente desde /uploads', async () => {
    const form = h.buildForm(
      {
        codigo: `TEST-${h.rand()}`,
        titulo: `TEST DATA Convocatoria ${h.rand()}`,
        descripcion: 'Convocatoria con archivo de bases',
        tipo: 'General',
        fecha_inicio: '2030-01-01 00:00:00',
        fecha_cierre: '2030-12-31 00:00:00'
      },
      [h.pdfFile('archivo_bases', 'bases.pdf')]
    );
    const res = await h.request(server, 'POST', '/api/convocatorias', { token: tokens.admin, form });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const [rows] = await db.query('SELECT bases_url FROM convocatorias WHERE codigo = ?', [form.get('codigo')]);
    assert.match(rows[0].bases_url, /^\/uploads\/bases-.*\.pdf$/);
    const served = await h.request(server, 'GET', rows[0].bases_url);
    assert.equal(served.status, 200);
    assert.equal(served.buffer.subarray(0, 4).toString(), '%PDF');
    assert.equal(served.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  test('Convocatoria: PNG o PDF falso -> 400', async () => {
    const before = h.publicFileCount();
    for (const file of [
      { field: 'archivo_bases', name: 'bases.png', type: 'image/png', data: h.PNG },
      { field: 'archivo_bases', name: 'bases.pdf', type: 'application/pdf', data: Buffer.from('no es pdf') }
    ]) {
      const form = h.buildForm(
        {
          codigo: `TEST-${h.rand()}`,
          titulo: `TEST DATA ${h.rand()}`,
          descripcion: 'x',
          tipo: 'General',
          fecha_inicio: '2030-01-01 00:00:00',
          fecha_cierre: '2030-12-31 00:00:00'
        },
        [file]
      );
      const res = await h.request(server, 'POST', '/api/convocatorias', { token: tokens.admin, form });
      assert.equal(res.status, 400, `${file.name} -> ${res.status}`);
    }
    assert.equal(h.publicFileCount(), before);
  });

  test('uploads_private no se sirve con express.static (código y comportamiento)', async () => {
    const source = fs.readFileSync(path.join(h.BACKEND_DIR, 'src/index.js'), 'utf8');
    const statics = [...source.matchAll(/express\.static\(\s*([A-Za-z_]+)/g)].map((m) => m[1]);
    assert.deepEqual(statics, ['PUBLIC_DIR']);
    assert.equal(h.PRIVATE_DIR.startsWith(h.PUBLIC_DIR + path.sep), false);
    const [rows] = await db.query('SELECT archivo_url FROM documentos_solicitud LIMIT 1');
    const file = path.basename(rows[0].archivo_url);
    assert.equal((await h.request(server, 'GET', `/uploads/${file}`)).status, 404);
  });
});
