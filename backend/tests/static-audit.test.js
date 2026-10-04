const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const h = require('./helpers');

const read = (...p) => fs.readFileSync(path.join(h.REPO_DIR, ...p), 'utf8').replace(/\r\n/g, '\n');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|sql|md|json|html)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const rel = (file) => path.relative(h.REPO_DIR, file).replace(/\\/g, '/');

const trackedFiles = () => {
  try {
    return execFileSync('git', ['ls-files'], { cwd: h.REPO_DIR, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return null;
  }
};

describe('Auditoría estática de roles', () => {
  const sourceFiles = [
    ...walk(path.join(h.REPO_DIR, 'backend', 'src')),
    ...walk(path.join(h.REPO_DIR, 'frontend', 'src')),
    ...walk(path.join(h.REPO_DIR, 'database')).filter((f) => !f.includes('20261004_remove_docente_role')),
    path.join(h.REPO_DIR, 'README.md')
  ];

  test('Docente como ROLE_REFERENCE: ninguna aparición en código, SQL ni documentación', () => {
    const offenders = [];
    for (const file of sourceFiles) {
      read(rel(file))
        .split('\n')
        .forEach((line, index) => {
          if (/remove_docente_role/.test(line)) return; // documentación de la migración
          if (/['"`]Docente['"`]|\besDocente\b|rol[^\n]{0,40}docente|docente[^\n]{0,40}\brol\b|'docente'|"docente"/i.test(line)) {
            offenders.push(`${rel(file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    assert.deepEqual(offenders, []);
  });

  test('Docente como BUSINESS_TERM: toda aparición restante describe al profesor responsable', () => {
    const business =
      /docente_nombre|docente_correo|AS docente\b|row\.docente\b|Docente Investigador|Docente Responsable|Docente Asociado|nombre del docente|requisitos obligatorios del docente|docentes inscritos|rechazadas por docente/;
    const unexpected = [];
    const business_hits = [];
    for (const file of sourceFiles) {
      read(rel(file))
        .split('\n')
        .forEach((line, index) => {
          if (!/docente/i.test(line) || /remove_docente_role/.test(line)) return;
          if (business.test(line)) business_hits.push(`${rel(file)}:${index + 1}`);
          else unexpected.push(`${rel(file)}:${index + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(unexpected, []);
    assert.ok(business_hits.length > 0);
  });

  test('Listas de roles en backend: exactamente Admin/Profesor/Evaluador', () => {
    const usuario = read('backend', 'src', 'controllers', 'usuarioController.js');
    const match = usuario.match(/const ROLES_VALIDOS = \[([\s\S]*?)\]/);
    const roles = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(roles, ['Admin', 'Profesor', 'Evaluador']);

    const auth = read('backend', 'src', 'controllers', 'authController.js');
    const publicRoles = [...auth.match(/const rolesPublicos = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(publicRoles, ['Profesor', 'Evaluador']);
  });

  test('Frontend: el registro ofrece solo Profesor y Evaluador y envía rol: rolRegistro', () => {
    const login = read('frontend', 'src', 'components', 'Login.jsx');
    const select = login.match(/value=\{rolRegistro\}[\s\S]*?<\/select>/)[0];
    const options = [...select.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(options, ['Profesor', 'Evaluador']);
    assert.match(login, /rol:\s*rolRegistro/);
  });

  test('Frontend: App.jsx define esProfesor solo con "profesor"', () => {
    const app = read('frontend', 'src', 'App.jsx');
    const block = app.match(/const esProfesor =([\s\S]*?);/)[1];
    assert.match(block, /'profesor'/);
    assert.doesNotMatch(block, /docente/i);
  });
});

describe('Auditoría estática de producción', () => {
  test('Sin localhost:5000 ni 127.0.0.1:5000 hardcodeados en frontend/backend', () => {
    const files = [...walk(path.join(h.REPO_DIR, 'frontend', 'src')), ...walk(path.join(h.REPO_DIR, 'backend', 'src'))];
    const hits = [];
    for (const file of files) {
      read(rel(file))
        .split('\n')
        .forEach((line, i) => {
          if (/localhost:5000|127\.0\.0\.1:5000/.test(line)) hits.push(`${rel(file)}:${i + 1}`);
        });
    }
    assert.deepEqual(hits, []);
  });

  test('Referencias localhost restantes son solo respaldos de desarrollo del backend (:5173)', (t) => {
    const hits = [];
    for (const file of walk(path.join(h.REPO_DIR, 'backend', 'src'))) {
      read(rel(file))
        .split('\n')
        .forEach((line, i) => {
          if (/localhost|127\.0\.0\.1/.test(line)) hits.push(`${rel(file)}:${i + 1} ${line.trim()}`);
        });
    }
    t.diagnostic(hits.join(' || '));
    assert.ok(hits.every((l) => /:5173/.test(l)), hits.join('\n'));
  });

  test('Sin secretos versionados (claves privadas, API keys, site keys, valores reales en env)', () => {
    const files = trackedFiles();
    if (!files) return t_skip();
    const patterns = [
      [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'clave privada'],
      [/AIza[0-9A-Za-z_-]{35}/, 'API key de Google'],
      [/\b6L[a-zA-Z0-9_-]{38}\b/, 'clave reCAPTCHA'],
      [
        /\b(MAIL_PASSWORD|DB_PASSWORD|JWT_SECRET|RECAPTCHA_SECRET_KEY)\s*=\s*['"]?(?!replace_with|your_|your-|process\.env)[^\s'"#]{6,}/,
        'valor de secreto en archivo'
      ]
    ];
    const findings = [];
    for (const file of files) {
      if (file.startsWith('backend/tests/') || /\.(png|jpg|ico|lock)$|package-lock\.json$/.test(file)) continue;
      const full = path.join(h.REPO_DIR, file);
      if (!fs.existsSync(full)) continue;
      const text = fs.readFileSync(full, 'utf8');
      const sinComentarios = text
        .split('\n')
        .filter((line) => !/^\s*(\/\/|#|\*)/.test(line))
        .join('\n');
      for (const [regex, label] of patterns) {
        const scope = label === 'valor de secreto en archivo' ? sinComentarios : text;
        if (regex.test(scope)) findings.push(`${file}: ${label}`);
      }
    }
    assert.deepEqual(findings, []);
  });

  test('.env y carpetas de uploads no están versionados y están en .gitignore', () => {
    const ignore = read('.gitignore');
    for (const entry of ['.env', 'backend/uploads/', 'backend/uploads_private/']) {
      assert.ok(ignore.split('\n').some((l) => l.trim() === entry), `.gitignore sin ${entry}`);
    }
    const files = trackedFiles();
    if (files) {
      assert.deepEqual(files.filter((f) => /(^|\/)\.env$|^backend\/uploads(_private)?\//.test(f)), []);
    }
  });

  test('Variables de entorno documentadas para backend y frontend', () => {
    const backend = read('backend', '.env.example');
    for (const key of [
      'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT', 'JWT_SECRET', 'RECAPTCHA_SECRET_KEY',
      'FRONTEND_ORIGIN', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_SECURE', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_FROM',
      'UPLOADS_PUBLIC_DIR', 'UPLOADS_PRIVATE_DIR', 'PORT', 'NODE_ENV'
    ]) {
      assert.match(backend, new RegExp(`^#?\\s*${key}=`, 'm'), `backend/.env.example sin ${key}`);
    }
    const frontend = read('frontend', '.env.example');
    for (const key of ['VITE_API_URL', 'VITE_RECAPTCHA_SITE_KEY']) {
      assert.match(frontend, new RegExp(`^${key}=`, 'm'));
    }
  });

  test('El frontend solo usa variables VITE_ conocidas', () => {
    const used = new Set();
    for (const file of walk(path.join(h.REPO_DIR, 'frontend', 'src'))) {
      for (const m of read(rel(file)).matchAll(/import\.meta\.env\.([A-Z_]+)/g)) used.add(m[1]);
    }
    assert.deepEqual([...used].sort(), ['VITE_API_URL', 'VITE_RECAPTCHA_SITE_KEY']);
  });

  test('Limitadores de tasa conectados a login, registro, recuperación, restablecimiento y verificación', () => {
    const routes = read('backend', 'src', 'routes', 'authRoutes.js');
    for (const [route, limiter] of [
      ['/register', 'registerLimiter'],
      ['/login', 'loginLimiter'],
      ['/forgot-password', 'passwordResetRequestLimiter'],
      ['/reset-password', 'passwordResetLimiter'],
      ['/verify-email', 'emailVerificationLimiter'],
      ['/verify-device', 'emailVerificationLimiter']
    ]) {
      assert.match(routes, new RegExp(`'${route}',\\s*${limiter}`), `${route} sin ${limiter}`);
    }
  });

  test('Engines Node 22 declarados y express.static solo sobre PUBLIC_DIR', () => {
    assert.equal(JSON.parse(read('backend', 'package.json')).engines.node, '>=22');
    assert.equal(JSON.parse(read('frontend', 'package.json')).engines.node, '>=22.12');
    const index = read('backend', 'src', 'index.js');
    assert.doesNotMatch(index, /express\.static\(\s*PRIVATE_DIR/);
    assert.match(index, /trust proxy/);
  });

  test('Secretos requeridos sin valores por defecto inseguros en el código', () => {
    for (const file of ['backend/src/middleware/authMiddleware.js', 'backend/src/controllers/authController.js']) {
      assert.doesNotMatch(read(...file.split('/')), /JWT_SECRET\s*\|\|\s*['"]/, `${file} tiene fallback de JWT_SECRET`);
    }
  });
});

function t_skip() {
  return undefined;
}
