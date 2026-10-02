import {
  useState,
  useEffect,
  useEffectEvent
} from 'react';

// ============================================================
// CONFIGURACIÓN
// ============================================================

const API_URL =
  'http://localhost:5000';

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
// OBTENER TOKEN
// ============================================================
//
// Preferimos sessionStorage porque representa la sesión activa.
//
// localStorage se mantiene como compatibilidad con la arquitectura
// actual de ArchiveX.
// ============================================================

const obtenerToken =
  () => {
    return (
      sessionStorage.getItem(
        'token'
      ) ||
      localStorage.getItem(
        'token'
      ) ||
      null
    );
  };

// ============================================================
// COMPONENTE
// ============================================================

const ControlUsuarios = () => {

  const [
    usuarios,
    setUsuarios
  ] =
    useState([]);

  const [
    busqueda,
    setBusqueda
  ] =
    useState('');

  const [
    cargando,
    setCargando
  ] =
    useState(true);

  const [
    eliminandoId,
    setEliminandoId
  ] =
    useState(null);

  const [
    error,
    setError
  ] =
    useState(null);

  // ==========================================================
  // CONSULTAR USUARIOS
  // ==========================================================

  const consultarUsuarios =
    async () => {
      try {
        setCargando(
          true
        );

        setError(
          null
        );

        const token =
          obtenerToken();

        if (!token) {
          setError(
            'No existe una sesión autenticada válida.'
          );

          return;
        }

        const respuesta =
          await fetch(
            `${API_URL}/api/usuarios`,
            {
              method:
                'GET',

              headers: {
                Authorization:
                  `Bearer ${token}`,

                Accept:
                  'application/json'
              }
            }
          );

        let resultado =
          null;

        try {
          resultado =
            await respuesta.json();
        } catch {
          resultado =
            null;
        }

        if (
          respuesta.status ===
          401
        ) {
          setError(
            'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.'
          );

          return;
        }

        if (
          respuesta.status ===
          403
        ) {
          setError(
            'No tienes permisos para consultar la administración de usuarios.'
          );

          return;
        }

        if (
          !respuesta.ok
        ) {
          setError(
            resultado?.message ||
              resultado?.error ||
              'No se pudo cargar la lista de usuarios.'
          );

          return;
        }

        if (
          resultado?.status ===
          'success'
        ) {
          setUsuarios(
            Array.isArray(
              resultado.data
            )
              ? resultado.data
              : []
          );

          return;
        }

        setError(
          'No se pudo procesar la lista de usuarios.'
        );
      } catch (err) {
        console.error(
          'Error consultando usuarios:',
          err
        );

        setError(
          'Error de conexión con el servidor de datos.'
        );
      } finally {
        setCargando(
          false
        );
      }
    };

  // ==========================================================
  // CARGA INICIAL
  // ==========================================================

  const cargarUsuariosInicial = useEffectEvent(() => {
    void consultarUsuarios();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => cargarUsuariosInicial(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // ==========================================================
  // ELIMINAR USUARIO
  // ==========================================================

  const eliminarUsuario =
    async (
      id,
      nombre,
      email,
      rol
    ) => {

      const emailNormalizado =
        String(
          email || ''
        )
          .trim()
          .toLowerCase();

      const rolNormalizado =
        normalizarRol(
          rol
        );

      const esAdminPrincipal =
        emailNormalizado ===
          ADMIN_EMAIL &&
        (
          rolNormalizado ===
            'admin' ||
          rolNormalizado ===
            'administrador'
        );

      // --------------------------------------------------------
      // PROTECCIÓN VISUAL DEL ADMIN
      // --------------------------------------------------------

      if (
        esAdminPrincipal
      ) {
        window.alert(
          'La cuenta administrativa principal de ArchiveX no puede eliminarse.'
        );

        return;
      }

      if (
        !window.confirm(
          `¿Estás completamente seguro de eliminar permanentemente al usuario "${nombre}"? Esta acción también puede eliminar información asociada a su cuenta.`
        )
      ) {
        return;
      }

      try {
        setEliminandoId(
          id
        );

        const token =
          obtenerToken();

        if (!token) {
          window.alert(
            'La sesión no es válida. Inicia sesión nuevamente.'
          );

          return;
        }

        const respuesta =
          await fetch(
            `${API_URL}/api/usuarios/${id}`,
            {
              method:
                'DELETE',

              headers: {
                Authorization:
                  `Bearer ${token}`,

                Accept:
                  'application/json'
              }
            }
          );

        let resultado =
          null;

        try {
          resultado =
            await respuesta.json();
        } catch {
          resultado =
            null;
        }

        if (
          respuesta.status ===
          401
        ) {
          window.alert(
            'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.'
          );

          return;
        }

        if (
          respuesta.status ===
          403
        ) {
          window.alert(
            resultado?.message ||
              'No tienes permisos para eliminar este usuario.'
          );

          return;
        }

        if (
          !respuesta.ok
        ) {
          window.alert(
            resultado?.message ||
              resultado?.error ||
              'Error al intentar eliminar el usuario.'
          );

          return;
        }

        if (
          resultado?.status ===
          'success'
        ) {
          window.alert(
            'Usuario removido del sistema de forma correcta.'
          );

          setUsuarios(
            (
              prev
            ) =>
              prev.filter(
                (
                  usuario
                ) =>
                  usuario.id !==
                  id
              )
          );

          return;
        }

        window.alert(
          resultado?.message ||
            'Error al intentar eliminar el usuario.'
        );
      } catch (err) {
        console.error(
          'Error eliminando usuario:',
          err
        );

        window.alert(
          'Error de red al procesar la desvinculación.'
        );
      } finally {
        setEliminandoId(
          null
        );
      }
    };

  // ==========================================================
  // FILTRO
  // ==========================================================

  const terminoBusqueda =
    busqueda
      .trim()
      .toLowerCase();

  const usuariosFiltrados =
    usuarios.filter(
      (
        usuario
      ) => {
        return (
          usuario.nombre_completo
            ?.toLowerCase()
            .includes(
              terminoBusqueda
            ) ||

          usuario.cedula
            ?.toString()
            .includes(
              terminoBusqueda
            ) ||

          usuario.email
            ?.toLowerCase()
            .includes(
              terminoBusqueda
            ) ||

          usuario.rol
            ?.toLowerCase()
            .includes(
              terminoBusqueda
            )
        );
      }
    );

  // ==========================================================
  // INSIGNIA DE ROL
  // ==========================================================

  const obtenerInsigniaRol =
    (
      rol
    ) => {
      const r =
        normalizarRol(
          rol
        );

      if (
        r ===
        'admin' ||
        r ===
        'administrador'
      ) {
        return 'bg-red-50 text-red-700 border-red-100';
      }

      if (
        r ===
        'evaluador'
      ) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      }

      return 'bg-blue-50 text-blue-700 border-blue-100';
    };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-6xl mx-auto">

      {/* ======================================================
          CABECERA
          ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">

        <div>

          <h2 className="text-xl font-bold text-slate-800">
            Control General de Usuarios
          </h2>

          <p className="text-slate-400 text-xs mt-0.5">
            Módulo de administración global para gestión de credenciales y personal de ArchiveX.
          </p>

        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">

          <button
            onClick={
              consultarUsuarios
            }
            disabled={
              cargando
            }
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Refrescar
          </button>

          <div className="w-full sm:w-72">

            <input
              type="text"
              placeholder="Buscar por nombre, cédula o rol..."
              value={
                busqueda
              }
              onChange={
                (
                  e
                ) =>
                  setBusqueda(
                    e.target.value
                  )
              }
              className="w-full text-xs border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#5B9BD5] transition-colors shadow-2xs"
            />

          </div>

        </div>

      </div>

      {/* ======================================================
          AVISO ADMINISTRATIVO
          ====================================================== */}

      <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100">

        <p className="text-xs font-semibold text-blue-800">
          Cuenta administrativa protegida
        </p>

        <p className="text-xs text-blue-700 mt-1">
          La cuenta{' '}
          <strong>
            {ADMIN_EMAIL}
          </strong>{' '}
          es la única cuenta administrativa principal de ArchiveX y no puede eliminarse desde este módulo.
        </p>

      </div>

      {/* ======================================================
          ESTADO DE CARGA
          ====================================================== */}

      {cargando ? (

        <div className="text-center py-12">

          <p className="text-sm text-slate-400">
            Sincronizando registros con la base de datos MySQL...
          </p>

        </div>

      ) : error ? (

        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">

          <p className="text-xs font-semibold text-red-600">
            {error}
          </p>

          <button
            onClick={
              consultarUsuarios
            }
            className="mt-3 px-4 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>

        </div>

      ) : usuariosFiltrados.length ===
        0 ? (

        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">

          <p className="text-xs text-slate-400">
            No se encontraron usuarios que coincidan con los criterios de búsqueda.
          </p>

        </div>

      ) : (

        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-3xs">

          <table className="w-full text-left border-collapse bg-white">

            <thead>

              <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">

                <th className="p-4">
                  Identificación / Cédula
                </th>

                <th className="p-4">
                  Nombre Completo
                </th>

                <th className="p-4">
                  Correo Electrónico
                </th>

                <th className="p-4 text-center">
                  Rol Asignado
                </th>

                <th className="p-4">
                  Contacto Telefónico
                </th>

                <th className="p-4 text-center">
                  Acción Administrativa
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">

              {usuariosFiltrados.map(
                (
                  usuario
                ) => {

                  const emailNormalizado =
                    String(
                      usuario.email ||
                        ''
                    )
                      .trim()
                      .toLowerCase();

                  const rolNormalizado =
                    normalizarRol(
                      usuario.rol
                    );

                  const esAdminPrincipal =
                    emailNormalizado ===
                      ADMIN_EMAIL &&
                    (
                      rolNormalizado ===
                        'admin' ||
                      rolNormalizado ===
                        'administrador'
                    );

                  const eliminando =
                    eliminandoId ===
                    usuario.id;

                  return (
                    <tr
                      key={
                        usuario.id
                      }
                      className="hover:bg-slate-50/60 transition-colors"
                    >

                      <td className="p-4 font-mono font-medium text-slate-600">
                        {
                          usuario.cedula ||
                          'No registrada'
                        }
                      </td>

                      <td className="p-4 font-semibold text-slate-900">
                        {
                          usuario.nombre_completo ||
                          'Sin nombre'
                        }
                      </td>

                      <td className="p-4 text-slate-500">
                        {
                          usuario.email ||
                          'Sin correo'
                        }
                      </td>

                      <td className="p-4 text-center">

                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${obtenerInsigniaRol(usuario.rol)}`}
                        >
                          {
                            usuario.rol ||
                            'Profesor'
                          }
                        </span>

                      </td>

                      <td className="p-4 text-slate-500">
                        {
                          usuario.telefono ||
                          'No registrado'
                        }
                      </td>

                      <td className="p-4 text-center">

                        {esAdminPrincipal ? (

                          <div className="inline-flex flex-col items-center gap-1">

                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg">
                              Cuenta protegida
                            </span>

                            <span className="text-[9px] text-slate-400">
                              Administrador principal
                            </span>

                          </div>

                        ) : (

                          <button
                            onClick={() =>
                              eliminarUsuario(
                                usuario.id,
                                usuario.nombre_completo,
                                usuario.email,
                                usuario.rol
                              )
                            }
                            disabled={
                              eliminando
                            }
                            className="text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {
                              eliminando
                                ? 'Eliminando...'
                                : 'Eliminar Registro'
                            }
                          </button>

                        )}

                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
};

export default ControlUsuarios;