const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const ioClient = h.resolveSocketClient();

describe('Chat (Socket.IO)', { skip: ioClient ? false : 'socket.io-client no está instalado (frontend/node_modules)' }, () => {
  let server;
  let db;
  let admin;
  let u;
  let tokens;
  const sockets = [];

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    admin = await h.getAdmin(db);
    u = {
      evA: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'chat' }),
      evB: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'chat' }),
      prof: await h.createTestUser(db, { rol: 'Profesor', prefix: 'chat' })
    };
    tokens = {
      admin: await h.loginAs(db, admin),
      evA: await h.loginAs(db, u.evA),
      evB: await h.loginAs(db, u.evB),
      prof: await h.loginAs(db, u.prof)
    };
  });

  after(async () => {
    for (const s of sockets) s.close();
    await server.stop();
    await db.end();
  });

  const connect = (token) =>
    new Promise((resolve, reject) => {
      const socket = ioClient.io(server.baseUrl, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnection: false
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));
      setTimeout(() => reject(new Error('timeout de conexión')), 5000);
    });

  const once = (socket, event, ms = 4000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), ms);
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  test('Sin JWT o con JWT inválido la conexión es rechazada', async () => {
    await assert.rejects(connect(undefined), /No autenticado/);
    await assert.rejects(connect('token.invalido.firma'), /No autenticado/);
    await assert.rejects(connect(h.signToken(u.evA, { expiresIn: -60 })), /No autenticado/);
  });

  test('JWT válido permite conectar y registrar al usuario con la identidad del JWT', async () => {
    const socket = await connect(tokens.evA);
    const registered = once(socket, 'usuario_registrado');
    socket.emit('registrar_usuario', { usuario_id: u.evB.id });
    assert.equal((await registered).usuario_id, u.evA.id);
  });

  test('Admin -> Evaluador: el mensaje se entrega y se persiste con remitente = JWT', async () => {
    const adminSocket = await connect(tokens.admin);
    const evSocket = await connect(tokens.evA);
    const received = once(evSocket, 'recibir_mensaje');
    adminSocket.emit('enviar_mensaje', { destinatario_id: u.evA.id, mensaje: 'Hola Evaluador (prueba)' });
    const msg = await received;
    assert.equal(msg.remitente_id, admin.id);
    assert.equal(msg.mensaje, 'Hola Evaluador (prueba)');
    const [rows] = await db.query('SELECT remitente_id, destinatario_id FROM chat_mensajes WHERE id = ?', [msg.id]);
    assert.deepEqual([rows[0].remitente_id, rows[0].destinatario_id], [admin.id, u.evA.id]);
  });

  test('Evaluador -> Admin permitido', async () => {
    const adminSocket = await connect(tokens.admin);
    const evSocket = await connect(tokens.evA);
    const received = once(adminSocket, 'recibir_mensaje');
    evSocket.emit('enviar_mensaje', { destinatario_id: admin.id, mensaje: 'Respuesta del Evaluador' });
    assert.equal((await received).remitente_id, u.evA.id);
  });

  test('No se puede suplantar al remitente: remitente_id del payload se ignora', async () => {
    const evSocket = await connect(tokens.evA);
    const adminSocket = await connect(tokens.admin);
    const received = once(adminSocket, 'recibir_mensaje');
    evSocket.emit('enviar_mensaje', {
      destinatario_id: admin.id,
      remitente_id: u.evB.id,
      usuario_id: u.evB.id,
      mensaje: 'Intento de suplantación'
    });
    const msg = await received;
    assert.equal(msg.remitente_id, u.evA.id);
    const [rows] = await db.query('SELECT remitente_id FROM chat_mensajes WHERE id = ?', [msg.id]);
    assert.equal(rows[0].remitente_id, u.evA.id);
  });

  test('Evaluador -> Evaluador y Evaluador -> Profesor no permitidos', async () => {
    const evSocket = await connect(tokens.evA);
    for (const destinatario_id of [u.evB.id, u.prof.id]) {
      const error = once(evSocket, 'error_chat');
      evSocket.emit('enviar_mensaje', { destinatario_id, mensaje: 'no permitido' });
      assert.match(await error, /No puedes enviar mensajes/);
    }
    const [rows] = await db.query('SELECT id FROM chat_mensajes WHERE destinatario_id IN (?, ?)', [u.evB.id, u.prof.id]);
    assert.equal(rows.length, 0);
  });

  test('Profesor puede conectar el socket pero no obtiene el chat administrativo', async () => {
    const socket = await connect(tokens.prof);
    for (const [event, payload] of [
      ['registrar_usuario', {}],
      ['obtener_contactos', {}],
      ['enviar_mensaje', { destinatario_id: admin.id, mensaje: 'hola' }]
    ]) {
      const error = once(socket, 'error_chat');
      socket.emit(event, payload);
      assert.match(await error, /No tienes permisos/);
    }
    const [rows] = await db.query('SELECT id FROM chat_mensajes WHERE remitente_id = ?', [u.prof.id]);
    assert.equal(rows.length, 0);
  });

  test('Historial: no se puede consultar una conversación ajena', async () => {
    const evSocket = await connect(tokens.evA);
    const error = once(evSocket, 'error_chat');
    evSocket.emit('obtener_historial', { remitente_id: u.evB.id, destinatario_id: admin.id });
    assert.match(await error, /No tienes permiso/);
  });

  test('Mensajes vacíos, demasiado largos o a uno mismo se rechazan', async () => {
    const evSocket = await connect(tokens.evA);
    for (const [payload, pattern] of [
      [{ destinatario_id: admin.id, mensaje: '   ' }, /vacío/],
      [{ destinatario_id: admin.id, mensaje: 'x'.repeat(2001) }, /2000/],
      [{ destinatario_id: u.evA.id, mensaje: 'yo' }, /ti mismo/]
    ]) {
      const error = once(evSocket, 'error_chat');
      evSocket.emit('enviar_mensaje', payload);
      assert.match(await error, pattern);
    }
  });

  test(
    'Socket con sesión revocada debería rechazarse (FINDING-SOCKET-01)',
    { todo: 'El middleware de Socket.IO solo verifica la firma del JWT, no login_sessions' },
    async () => {
      const sid = await h.createSession(db, u.evA.id, { revoked: true });
      await assert.rejects(connect(h.signToken(u.evA, { sid })));
    }
  );

  test(
    'Socket con JWT Admin de otro correo debería rechazarse (FINDING-SOCKET-02)',
    { todo: 'El socket no aplica la regla del Admin único (solo authMiddleware HTTP)' },
    async () => {
      await assert.rejects(connect(h.signToken(admin, { email: 'otro.admin@archivex-test.invalid' })));
    }
  );
});
