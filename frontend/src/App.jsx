import {
  useEffect,
  useState
} from 'react';

import Login from './components/Login';

import InicioCards from './components/InicioCards';

import DatosPersonales from './components/DatosPersonales';

import Noticias from './components/Noticias';

import Convocatorias from './components/Convocatorias';

import ConvocatoriasAbiertas from './components/ConvocatoriasAbiertas';

import CrearConvocatoria from './components/CrearConvocatoria';

import MisSolicitudes from './components/MisSolicitudes';

import RevisarSolicitudes from './components/RevisarSolicitudes';

import EvaluarPropuestas from './components/EvaluarPropuestas';

import Calificaciones from './components/Calificaciones';

import Chat from './components/Chat';

import ControlUsuarios from './components/ControlUsuarios.jsx';

import ReportesAdmin from './components/ReportesAdmin';

import Settings from './components/Settings';

import NotificationBell from './components/NotificationBell';

// ============================================================
// CONFIGURACIÓN DE SEGURIDAD DEL FRONTEND
// ============================================================
//
// El frontend nunca reemplaza la seguridad del backend.
// Estas reglas solamente controlan qué opciones se muestran.
//
// La autorización real continúa siendo responsabilidad del
// backend.
// ============================================================

const ADMIN_EMAIL =
  'aracelly.buitrago@campusucc.edu.co';

// ============================================================
// NORMALIZAR ROL
// ============================================================

const normalizarRol =
  (rol) => {
    return String(
      rol || ''
    )
      .trim()
      .toLowerCase();
  };

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function App() {
  const [
    usuario,
    setUsuario
  ] =
    useState(null);

  const [
    historial,
    setHistorial
  ] =
    useState([
      'inicio'
    ]);

  const [
    convocatoriaSeleccionada,
    setConvocatoriaSeleccionada
  ] =
    useState(null);

  const [
    theme,
    setTheme
  ] = useState(
    () => localStorage.getItem('archivex-theme') || 'system'
  );

  const [textScale, setTextScale] = useState(
    () => localStorage.getItem('archivex-text-scale') || 'normal'
  );

  const aplicarTema = (nuevoTema) => {
    localStorage.setItem('archivex-theme', nuevoTema);
    setTheme(nuevoTema);
  };

  const aplicarEscalaTexto = (nuevaEscala) => {
    const escala = nuevaEscala === 'compact' ? 'compact' : 'normal';
    localStorage.setItem('archivex-text-scale', escala);
    document.documentElement.dataset.textScale = escala;
    setTextScale(escala);
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    aplicar();
    media.addEventListener('change', aplicar);
    return () => media.removeEventListener('change', aplicar);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.textScale = textScale;
  }, [textScale]);

  useEffect(() => {
    if (!usuario) return;
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/settings/preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((preferences) => {
        if (preferences?.theme) aplicarTema(preferences.theme);
        if (preferences?.text_scale) aplicarEscalaTexto(preferences.text_scale);
      })
      .catch(() => {});
  }, [usuario]);

  // ==========================================================
  // ROL DEL USUARIO
  // ==========================================================

  const rolUsuario =
    normalizarRol(
      usuario?.rol
    );

  const emailUsuario =
    String(
      usuario?.email || ''
    )
      .trim()
      .toLowerCase();

  // ==========================================================
  // PERMISOS VISUALES
  // ==========================================================
  //
  // IMPORTANTE:
  // Estas variables no son una barrera de seguridad.
  // El backend vuelve a validar todos los permisos.
  // ==========================================================

  const esAdmin =
    (
      rolUsuario ===
        'admin' ||
      rolUsuario ===
        'administrador'
    ) &&
    emailUsuario ===
      ADMIN_EMAIL;

  const esEvaluador =
    rolUsuario ===
    'evaluador';

  const esProfesor =
    rolUsuario ===
      'profesor' ||
    rolUsuario ===
      'docente';

  const puedeUsarChat =
    esAdmin ||
    esEvaluador;

  const vistaActual =
    historial[
      historial.length - 1
    ] ||
    'inicio';

  // ==========================================================
  // CERRAR SESIÓN
  // ==========================================================

  const handleLogout =
    () => {
      sessionStorage.removeItem(
        'token'
      );

      sessionStorage.removeItem(
        'userId'
      );

      localStorage.removeItem(
        'token'
      );

      localStorage.removeItem(
        'userId'
      );

      setUsuario(
        null
      );

      setHistorial([
        'inicio'
      ]);

      setConvocatoriaSeleccionada(
        null
      );
    };

  // ==========================================================
  // LOGIN
  // ==========================================================

  if (
    !usuario
  ) {
    return (
      <Login
        alAutenticar={
          setUsuario
        }
      />
    );
  }

  // ==========================================================
  // NAVEGACIÓN
  // ==========================================================

  const cambiarVistaLimpia =
    (
      nuevaVista
    ) => {
      setConvocatoriaSeleccionada(
        null
      );

      if (
        nuevaVista ===
        'inicio'
      ) {
        setHistorial([
          'inicio'
        ]);
      } else {
        setHistorial([
          'inicio',
          nuevaVista
        ]);
      }
    };

  const navegarA =
    (
      nuevaVista
    ) => {
      if (
        historial[
          historial.length - 1
        ] !== nuevaVista
      ) {
        setHistorial(
          (
            prev
          ) => [
            ...prev,
            nuevaVista
          ]
        );
      }
    };

  const volverAtras =
    () => {
      if (
        historial.length >
        1
      ) {
        setHistorial(
          (
            prev
          ) =>
            prev.slice(
              0,
              -1
            )
        );
      }
    };

  // ==========================================================
  // RENDERIZAR VISTA
  // ==========================================================

  const renderizarVista =
    () => {
      switch (
        vistaActual
      ) {
        case 'inicio':
          return (
            <InicioCards
              cambiarVista={
                navegarA
              }
              usuario={
                usuario
              }
            />
          );

        case 'datos_personales':
          return (
            <DatosPersonales
              usuario={
                usuario
              }
            />
          );

        case 'noticias':
          return (
            <Noticias
              usuario={
                usuario
              }
            />
          );

        case 'formulario_radicacion':
          return (
            <Convocatorias
              usuario={
                usuario
              }
              convocatoria={
                convocatoriaSeleccionada
              }
            />
          );

        case 'crear_convocatoria':
          return (
            <CrearConvocatoria
              key={convocatoriaSeleccionada?.id || 'nueva-convocatoria'}
              convocatoriaAEditar={
                convocatoriaSeleccionada
              }
              alFinalizar={
                () =>
                  cambiarVistaLimpia(
                    'convocatorias_abiertas'
                  )
              }
            />
          );

        case 'convocatorias_abiertas':
          return (
            <ConvocatoriasAbiertas
              usuario={
                usuario
              }
              alSeleccionarConvocatoria={
                (
                  convocatoria
                ) => {
                  setConvocatoriaSeleccionada(
                    convocatoria
                  );

                  navegarA(
                    'formulario_radicacion'
                  );
                }
              }
              alEditarConvocatoria={
                (
                  convocatoria
                ) => {
                  setConvocatoriaSeleccionada(
                    convocatoria
                  );

                  navegarA(
                    'crear_convocatoria'
                  );
                }
              }
            />
          );

        case 'mis_solicitudes':
          return (
            <MisSolicitudes
              usuario={
                usuario
              }
              alRedireccionarConvocatorias={
                () =>
                  cambiarVistaLimpia(
                    'convocatorias_abiertas'
                  )
              }
            />
          );

        case 'revisar_solicitudes':
          return (
            <RevisarSolicitudes />
          );

        case 'evaluar_propuestas':
          return (
            <EvaluarPropuestas
              usuario={
                usuario
              }
            />
          );

        case 'calificaciones':
          return (
            <Calificaciones
              usuario={
                usuario
              }
            />
          );

        case 'chat':
          return (
            <Chat
              usuario={
                usuario
              }
            />
          );

        case 'control_usuarios':
          return (
            <ControlUsuarios />
          );

        case 'reportes_admin':
          return (
            <ReportesAdmin />
          );

        case 'configuracion':
          return (
            <Settings
              theme={theme}
              onThemeChange={aplicarTema}
              onTextScaleChange={aplicarEscalaTexto}
              onLogout={handleLogout}
              onNavigate={cambiarVistaLimpia}
              usuario={usuario}
            />
          );

        default:
          return (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md mx-auto mt-10">
              <span className="text-4xl">
                🛠️
              </span>

              <h3 className="text-lg font-bold text-slate-700 mt-4">
                Módulo en Construcción
              </h3>

              <p className="text-slate-400 text-sm mt-2">
                Esta sección estará lista en las próximas fases del desarrollo.
              </p>
            </div>
          );
      }
    };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">

      {/* =======================================================
          BARRA LATERAL
          ======================================================= */}

      <aside className="w-64 bg-[#2d3748] text-white flex flex-col shadow-2xl">

        <div
          className="p-6 bg-white border-b border-slate-200 text-center cursor-pointer"
          onClick={() =>
            cambiarVistaLimpia(
              'inicio'
            )
          }
        >
          <h1 className="text-2xl font-extrabold tracking-tight text-[#5B9BD5]">
            ArchiveX
          </h1>
        </div>

        <nav className="flex-1 py-4 space-y-1">

          {/* ====================================================
              INICIO
              ==================================================== */}

          <button
            onClick={() =>
              cambiarVistaLimpia(
                'inicio'
              )
            }
            className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
          >
            <span>
              🏠
            </span>

            Inicio
          </button>

          {/* ====================================================
              CONVOCATORIAS
              ==================================================== */}

          <button
            onClick={() =>
              cambiarVistaLimpia(
                'convocatorias_abiertas'
              )
            }
            className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
          >
            <span>
              📢
            </span>

            Convocatorias
          </button>

          {/* ====================================================
              MIS SOLICITUDES
              ====================================================
              
              Profesor y Docente usan el mismo módulo.
              ==================================================== */}

          {esProfesor && (
            <button
              onClick={() =>
                cambiarVistaLimpia(
                  'mis_solicitudes'
                )
              }
              className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
            >
              <span>
                📁
              </span>

              Mis Solicitudes
            </button>
          )}

          {/* ====================================================
              EVALUADOR
              ==================================================== */}

          {esEvaluador && (
            <button
              onClick={() =>
                cambiarVistaLimpia(
                  'evaluar_propuestas'
                )
              }
              className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
            >
              <span>
                📝
              </span>

              Evaluar Propuestas
            </button>
          )}

          {/* ====================================================
              CHAT
              ==================================================== */}

          {puedeUsarChat && (
            <button
              onClick={() =>
                cambiarVistaLimpia(
                  'chat'
                )
              }
              className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
            >
              <span>
                💬
              </span>

              Chat Interno
            </button>
          )}

          {/* ====================================================
              ADMINISTRACIÓN
              ==================================================== */}

          {esAdmin && (
            <>

              <button
                onClick={() =>
                  cambiarVistaLimpia(
                    'revisar_solicitudes'
                  )
                }
                className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
              >
                <span>
                  📥
                </span>

                Revisar Solicitudes
              </button>

              <button
                onClick={() =>
                  cambiarVistaLimpia(
                    'calificaciones'
                  )
                }
                className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
              >
                <span>
                  📊
                </span>

                Calificaciones
              </button>

              <button
                onClick={() =>
                  cambiarVistaLimpia(
                    'crear_convocatoria'
                  )
                }
                className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
              >
                <span>
                  ➕
                </span>

                Crear Convocatoria
              </button>

              <button
                onClick={() =>
                  cambiarVistaLimpia(
                    'control_usuarios'
                  )
                }
                className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
              >
                <span>
                  👥
                </span>

                Control Usuarios
              </button>

              <button
                onClick={() =>
                  cambiarVistaLimpia(
                    'reportes_admin'
                  )
                }
                className="w-full text-left px-6 py-3 hover:bg-[#5B9BD5] transition-colors flex items-center gap-3 bg-slate-700/40"
              >
                <span>
                  📈
                </span>

                Informes y Reportes
              </button>

            </>
          )}

        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => cambiarVistaLimpia('configuracion')}
            className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#5B9BD5] transition-colors flex items-center gap-3"
          >
            <span>⚙️</span>
            Configuración
          </button>
        </div>

      </aside>

      {/* =======================================================
          CONTENIDO PRINCIPAL
          ======================================================= */}

      <main className="flex-1 flex flex-col relative overflow-hidden">

        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10">

          <div className="flex items-center gap-4">

            {historial.length >
              1 && (
              <button
                onClick={
                  volverAtras
                }
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-[#5B9BD5] bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-all shadow-sm"
              >
                ⬅️ Volver
              </button>
            )}

            <span className="font-semibold text-slate-700">
              Usuario:{' '}

              <strong className="text-slate-900 font-bold">
                {
                  usuario.nombre_completo
                }
              </strong>
            </span>

          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={() => aplicarTema(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl hover:bg-slate-100 text-sm"
              title="Cambiar tema"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <NotificationBell onNavigate={cambiarVistaLimpia} />

            {esAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                Administrador
              </span>
            )}

            {esEvaluador && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Evaluador
              </span>
            )}

            {esProfesor && !esEvaluador && !esAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Profesor
              </span>
            )}

            <button
              onClick={
                handleLogout
              }
              className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-full font-semibold transition-colors"
            >
              Cerrar Sesión
            </button>

          </div>

        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {renderizarVista()}
        </div>

      </main>

    </div>
  );
}

export default App;
