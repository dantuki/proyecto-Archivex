import { useState, useEffect, useEffectEvent } from 'react';
import axios from 'axios';

import { API_URL, BACKEND_ORIGIN } from '../config/api';

const API_BASE = API_URL;

function obtenerToken() {
  return (
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    ''
  );
}

async function descargarDocumentoSeguro(nombreArchivo) {
  if (!nombreArchivo) {
    alert(
      'Este documento no fue cargado correctamente o no está disponible.'
    );
    return;
  }

  // ----------------------------------------------------------
  // URL EXTERNA
  // ----------------------------------------------------------

  if (
    typeof nombreArchivo === 'string' &&
    /^https?:\/\//i.test(nombreArchivo)
  ) {
    window.open(
      nombreArchivo,
      '_blank',
      'noopener,noreferrer'
    );

    return;
  }

  let valorLimpio =
    String(nombreArchivo)
      .trim()
      .replace(/^\/+/, '');

  // ----------------------------------------------------------
  // ARCHIVO PÚBLICO LEGACY
  // ----------------------------------------------------------
  //
  // Solo se mantiene compatibilidad temporal con archivos
  // antiguos que sigan físicamente en /uploads.
  // ----------------------------------------------------------

  if (
    valorLimpio.startsWith('uploads/')
  ) {
    const nombrePublico =
      valorLimpio.replace(
        /^uploads\//,
        ''
      );

    window.open(
      `${BACKEND_ORIGIN}/uploads/${encodeURIComponent(
        nombrePublico
      )}`,
      '_blank',
      'noopener,noreferrer'
    );

    return;
  }

  // ----------------------------------------------------------
  // ARCHIVO PRIVADO
  // ----------------------------------------------------------

  const nombrePrivado =
    valorLimpio
      .replace(
        /^uploads_private\//,
        ''
      );

  try {
    const token =
      obtenerToken();

    if (!token) {
      alert(
        'Tu sesión no es válida. Inicia sesión nuevamente.'
      );
      return;
    }

    const respuesta =
      await fetch(
        `${API_BASE}/archivos-privados/${encodeURIComponent(
          nombrePrivado
        )}`,
        {
          method:
            'GET',

          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    if (!respuesta.ok) {
      let mensaje =
        'No fue posible acceder al documento.';

      try {
        const datos =
          await respuesta.json();

        mensaje =
          datos?.message ||
          datos?.error ||
          mensaje;
      } catch {
        // La respuesta puede no ser JSON.
      }

      alert(
        mensaje
      );

      return;
    }

    const blob =
      await respuesta.blob();

    const url =
      URL.createObjectURL(
        blob
      );

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );

    // Liberar posteriormente el object URL.
    setTimeout(() => {
      URL.revokeObjectURL(
        url
      );
    }, 60000);
  } catch (error) {
    console.error(
      'Error descargando documento privado:',
      error
    );

    alert(
      'No fue posible abrir el documento.'
    );
  }
}

function FilaSolicitud({
  sol,
  evaluadores,
  descargarDocumento,
  getBadgeStyles,
  onActualizarEstado,
  onAsignarEvaluador
}) {
  const [
    nuevoEstado,
    setNuevoEstado
  ] = useState(
    sol.estado
  );

  const [
    motivo,
    setMotivo
  ] = useState(
    sol.motivo_decision || ''
  );

  const [
    mostrarMotivoInput,
    setMostrarMotivoInput
  ] = useState(
    sol.estado ===
      'Rechazado'
  );

  const [
    mostrarEvaluadorInput,
    setMostrarEvaluadorInput
  ] = useState(
    false
  );

  const [
    evaluadorSeleccionado,
    setEvaluadorSeleccionado
  ] = useState(
    sol.evaluador_id || ''
  );

  const [
    enviando,
    setEnviando
  ] = useState(
    false
  );

  const [documentos, setDocumentos] = useState([]);
  const [mostrarDocumentos, setMostrarDocumentos] = useState(false);
  const [comentariosDocumento, setComentariosDocumento] = useState({});
  const [errorDocumento, setErrorDocumento] = useState('');

  const handleEstadoChange =
    async (
      e
    ) => {
      const estadoSeleccionado =
        e.target.value;

      setNuevoEstado(
        estadoSeleccionado
      );

      if (
        estadoSeleccionado ===
        'Rechazado'
      ) {
        setMostrarMotivoInput(
          true
        );

        setMostrarEvaluadorInput(
          false
        );
      } else if (
        estadoSeleccionado ===
        'En Evaluación'
      ) {
        setMostrarEvaluadorInput(
          true
        );

        setMostrarMotivoInput(
          false
        );
      } else {
        setMostrarMotivoInput(
          false
        );

        setMostrarEvaluadorInput(
          false
        );

        await guardarCambioEstado(
          estadoSeleccionado,
          null
        );
      }
    };

  const cargarDocumentos = async () => {
    setErrorDocumento('');
    if (mostrarDocumentos) {
      setMostrarDocumentos(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/solicitudes/${sol.id}/cronologia`, {
        headers: { Authorization: `Bearer ${obtenerToken()}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No fue posible cargar documentos.');
      setDocumentos(data.data.documents || []);
      setMostrarDocumentos(true);
    } catch (error) {
      setErrorDocumento(error.message);
    }
  };

  const revisarDocumento = async (documento, status) => {
    setErrorDocumento('');
    try {
      const response = await fetch(
        `${API_BASE}/solicitudes/${sol.id}/documentos/${documento.id}/revision`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${obtenerToken()}`
          },
          body: JSON.stringify({ status, comment: comentariosDocumento[documento.id] || '' })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No fue posible guardar la revisión.');
      setDocumentos(documentos.map((item) => item.id === documento.id
        ? { ...item, review_status: status, review_comment: comentariosDocumento[documento.id] || '' }
        : item));
    } catch (error) {
      setErrorDocumento(error.message);
    }
  };

  const handleCancelarAccion =
    () => {
      setNuevoEstado(
        sol.estado
      );

      setMotivo(
        sol.motivo_decision || ''
      );

      setMostrarMotivoInput(
        sol.estado ===
          'Rechazado'
      );

      setMostrarEvaluadorInput(
        false
      );

      setEvaluadorSeleccionado(
        sol.evaluador_id || ''
      );
    };

  const guardarCambioEstado =
    async (
      estadoDestino,
      motivoTexto,
      silencioso = false
    ) => {
      setEnviando(
        true
      );

      try {
        const token =
          obtenerToken();

        if (!token) {
          throw new Error(
            'Sesión no válida.'
          );
        }

        const respuesta =
          await axios.put(
            `${API_BASE}/postulaciones/${sol.id}/estado`,
            {
              estado:
                estadoDestino,

              motivo_decision:
                estadoDestino ===
                'Rechazado'
                  ? motivoTexto
                  : null
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (
          respuesta.data.status ===
          'success'
        ) {
          onActualizarEstado(
            sol.id,
            estadoDestino,
            estadoDestino ===
              'Rechazado'
              ? motivoTexto
              : null
          );

          if (
            !silencioso
          ) {
            if (
              estadoDestino !==
              'Rechazado'
            ) {
              alert(
                'Estado actualizado correctamente.'
              );
            } else {
              alert(
                'Propuesta rechazada con éxito.'
              );
            }
          }
        } else {
          alert(
            'No se pudo actualizar el estado de la propuesta.'
          );

          handleCancelarAccion();
        }
      } catch (err) {
        console.error(
          'Error al actualizar estado:',
          err
        );

        alert(
          err.response?.data?.message ||
          err.message ||
          'Ocurrió un error al actualizar el estado.'
        );

        handleCancelarAccion();
      } finally {
        setEnviando(
          false
        );
      }
    };

  const handleConfirmarRechazo =
    async () => {
      if (
        !motivo.trim()
      ) {
        alert(
          'Error: Para rechazar una propuesta debes escribir obligatoriamente el motivo.'
        );

        return;
      }

      await guardarCambioEstado(
        'Rechazado',
        motivo
      );
    };

  const handleConfirmarAsignacion =
    async () => {
      if (
        !evaluadorSeleccionado
      ) {
        alert(
          'Error: Debes seleccionar un evaluador de la lista.'
        );

        return;
      }

      setEnviando(
        true
      );

      try {
        const token =
          obtenerToken();

        if (!token) {
          throw new Error(
            'Sesión no válida.'
          );
        }

        // ==================================================
        // MIGRACIÓN DEFINITIVA
        // ==================================================
        //
        // Antes:
        // /api/asignacion
        //
        // Ahora:
        // /api/asignaciones
        // ==================================================

        const respuesta =
          await axios.post(
            `${API_BASE}/asignaciones`,
            {
              postulacionId:
                sol.id,

              evaluadorId:
                parseInt(
                  evaluadorSeleccionado,
                  10
                )
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (
          respuesta.data.status ===
          'success'
        ) {
          if (
            sol.estado !==
            'En Evaluación'
          ) {
            await guardarCambioEstado(
              'En Evaluación',
              null,
              true
            );
          }

          onAsignarEvaluador(
            sol.id,
            evaluadorSeleccionado
          );

          alert(
            'Evaluador asignado correctamente.'
          );

          setMostrarEvaluadorInput(
            false
          );
        } else {
          alert(
            'No se pudo completar la asignación del evaluador.'
          );
        }
      } catch (err) {
        console.error(
          'Error al asignar evaluador:',
          err
        );

        alert(
          err.response?.data?.message ||
          err.message ||
          'Ocurrió un error al asignar el evaluador.'
        );
      } finally {
        setEnviando(
          false
        );
      }
    };

  return (
    <tr className="hover:bg-slate-50/40 transition-colors group border-b border-slate-100">
      <td className="py-5 px-6 max-w-xs">
        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/50 mb-1.5">
          {sol.codigoPropuesta ||
            'SIN CÓDIGO'}
        </span>

        <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-[#5B9BD5] transition-colors">
          {sol.titulo_propuesta}
        </h3>

        {sol.observaciones && (
          <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-1">
            Nota: "{sol.observaciones}"
          </p>
        )}

        {sol.estado ===
          'Rechazado' &&
          sol.motivo_decision &&
          !mostrarMotivoInput && (
            <div className="mt-2 p-2 bg-red-50/60 border border-red-100/50 rounded-xl text-[11px] text-red-700 leading-relaxed">
              <strong>
                Motivo registrado:
              </strong>{' '}
              {sol.motivo_decision}
            </div>
          )}

        {sol.evaluador_nombre && (
          <div className="mt-2 p-2.5 bg-blue-50/60 border border-blue-100/50 rounded-xl text-[11px] text-blue-700 leading-relaxed space-y-1 shadow-sm">
            <div>
              <strong>
                Evaluador asignado:
              </strong>{' '}
              <span className="font-semibold text-slate-800">
                {sol.evaluador_nombre}
              </span>
            </div>

            {sol.puntaje !==
              undefined &&
              sol.puntaje !==
                null && (
                <div className="text-[10px] text-blue-800 bg-white/50 px-2 py-1.5 rounded-lg border border-blue-100 mt-1">
                  <strong>
                    Calificación:
                  </strong>{' '}
                  <span className="font-extrabold">
                    {sol.puntaje} / 100
                  </span>
                </div>
              )}

            {sol.comentarios && (
              <div className="text-[10px] text-slate-600 italic bg-white/70 p-2 rounded-lg border border-blue-100/30 mt-1 max-h-16 overflow-y-auto">
                <strong>
                  Comentarios:
                </strong>{' '}
                "{sol.comentarios}"
              </div>
            )}
          </div>
        )}
      </td>

      <td className="py-5 px-6">
        <div className="font-semibold text-slate-800">
          {sol.docente_nombre ||
            'Docente Asociado'}
        </div>

        <div className="text-xs text-slate-500 mt-0.5">
          {sol.docente_correo ||
            'Correo no especificado'}
        </div>

        <div className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-slate-500 bg-slate-100/60 px-2 py-0.5 rounded-md border border-slate-200/40">
          📍{' '}
          {sol.nombre_sede ||
            `Sede (ID: ${sol.sede})`}
        </div>
      </td>

      <td className="py-5 px-6">
        <div className="grid grid-cols-2 gap-1.5 max-w-[280px]">
          <button
            onClick={() =>
              descargarDocumento(
                sol.presupuesto
              )
            }
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center justify-center gap-1"
            title="Presupuesto"
          >
            📋 Presupuesto
          </button>

          <button
            onClick={() =>
              descargarDocumento(
                sol.cronograma
              )
            }
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center justify-center gap-1"
            title="Cronograma"
          >
            📅 Cronograma
          </button>

          <button
            onClick={() =>
              descargarDocumento(
                sol.honestidad
              )
            }
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center justify-center gap-1"
            title="Declaración de Honestidad"
          >
            ✍️ Honestidad
          </button>

          <button
            onClick={() =>
              descargarDocumento(
                sol.id_documento
              )
            }
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center justify-center gap-1"
            title="Soporte de Identidad"
          >
            🪪 Identidad
          </button>

          {sol.archivo_evaluacion && (
            <button
              onClick={() =>
                descargarDocumento(
                  sol.archivo_evaluacion
                )
              }
              className="col-span-2 mt-1 px-2.5 py-2 rounded-xl text-[10px] font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              title="Descargar Acta de Evaluación Final"
            >
              📄 Ver Acta de Evaluación
            </button>
          )}
        </div>
        <button type="button" onClick={cargarDocumentos} className="mt-2 text-[10px] font-bold text-blue-700 hover:underline">
          {mostrarDocumentos ? 'Ocultar revisión documental' : 'Revisar documentos y versiones'}
        </button>
        {errorDocumento && <p className="mt-2 text-[10px] text-red-600">{errorDocumento}</p>}
        {mostrarDocumentos && <div className="mt-2 space-y-2 min-w-[280px]">
          {documentos.map((documento) => <div key={documento.id} className="rounded-lg border border-slate-200 bg-white p-2 text-left">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <strong>{documento.tipo_documento} · v{documento.version_no}</strong>
              <span>{documento.review_status === 'validated' ? 'Validado' : documento.review_status === 'rejected' ? 'Requiere corrección' : documento.review_status === 'replaced' ? 'Reemplazado' : 'Pendiente'}</span>
            </div>
            <button type="button" onClick={() => descargarDocumento(documento.archivo_url)} className="my-1 text-[10px] text-blue-700 underline">Vista previa del PDF</button>
            {documento.review_status !== 'replaced' && <>
              <textarea value={comentariosDocumento[documento.id] ?? documento.review_comment ?? ''}
                onChange={(event) => setComentariosDocumento({ ...comentariosDocumento, [documento.id]: event.target.value })}
                placeholder="Comentario para el propietario" maxLength={5000}
                className="w-full rounded border border-slate-200 p-2 text-[10px]" />
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => revisarDocumento(documento, 'validated')} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Validar</button>
                <button type="button" onClick={() => revisarDocumento(documento, 'rejected')} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Solicitar corrección</button>
              </div>
            </>}
            {documento.review_comment && <p className="mt-1 text-[10px] text-slate-500">{documento.review_comment}</p>}
          </div>)}
          {!documentos.length && <p className="text-[10px] text-slate-500">No hay documentos indexados.</p>}
        </div>}
      </td>

      <td className="py-5 px-6">
        <div className="flex flex-col gap-2 min-w-[170px]">
          <select
            value={nuevoEstado}
            onChange={
              handleEstadoChange
            }
            disabled={enviando}
            className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none transition-all cursor-pointer ${getBadgeStyles(
              nuevoEstado
            )}`}
          >
            <option value="Radicado">
              📁 Radicado
            </option>

            <option value="En Evaluación">
              🔍 En Evaluación
            </option>

            <option value="Correcciones solicitadas">
              📝 Correcciones solicitadas
            </option>

            <option value="Aprobado">
              ✅ Aprobado
            </option>

            <option value="Rechazado">
              ❌ Rechazado
            </option>
          </select>

          <button
            onClick={() => {
              if (
                mostrarEvaluadorInput
              ) {
                handleCancelarAccion();
              } else {
                setMostrarEvaluadorInput(
                  true
                );
                setMostrarMotivoInput(
                  false
                );
              }
            }}
            className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-[#5B9BD5] border border-slate-200 hover:border-[#5B9BD5]/20 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            {sol.evaluador_id
              ? '👥 Cambiar Evaluador'
              : '👥 Asignar Evaluador'}
          </button>

          {mostrarEvaluadorInput && (
            <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl space-y-2 mt-1 shadow-sm">
              <label className="block text-[9px] uppercase font-extrabold text-amber-800 tracking-wider">
                Seleccionar Evaluador *
              </label>

              <select
                value={
                  evaluadorSeleccionado
                }
                onChange={(e) =>
                  setEvaluadorSeleccionado(
                    e.target.value
                  )
                }
                disabled={enviando}
                className="w-full p-2 border border-amber-200 rounded-lg text-[11px] focus:ring-2 focus:ring-amber-200 outline-none bg-white text-slate-700 font-medium"
              >
                <option value="">
                  -- Elige un evaluador --
                </option>

                {evaluadores.map(
                  (ev) => (
                    <option
                      key={ev.id}
                      value={ev.id}
                    >
                      {ev.nombre_completo}{' '}
                      (
                      {ev.email ||
                        ev.correo ||
                        'sin correo'}
                      )
                    </option>
                  )
                )}
              </select>

              <div className="flex gap-1.5">
                <button
                  onClick={
                    handleConfirmarAsignacion
                  }
                  disabled={
                    enviando ||
                    !evaluadorSeleccionado
                  }
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {enviando
                    ? 'Asignando...'
                    : 'Confirmar'}
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancelarAccion
                  }
                  disabled={
                    enviando
                  }
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {mostrarMotivoInput && (
            <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl space-y-2 mt-1 shadow-sm">
              <label className="block text-[9px] uppercase font-extrabold text-red-700 tracking-wider">
                Motivo de Rechazo Obligatorio *
              </label>

              <textarea
                value={motivo}
                onChange={(e) =>
                  setMotivo(
                    e.target.value
                  )
                }
                placeholder="Especifica el por qué..."
                rows="2"
                disabled={
                  enviando
                }
                className="w-full p-2 border border-red-200 rounded-lg text-[11px] focus:ring-2 focus:ring-red-200 outline-none resize-none bg-white text-slate-700"
                required
              />

              <div className="flex gap-1.5">
                <button
                  onClick={
                    handleConfirmarRechazo
                  }
                  disabled={
                    enviando
                  }
                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {enviando
                    ? 'Guardando...'
                    : 'Confirmar'}
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancelarAccion
                  }
                  disabled={
                    enviando
                  }
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <span className="text-[10px] text-slate-400 text-center font-medium">
            Registrado:{' '}
            {sol.fecha_radicacion
              ? new Date(
                  sol.fecha_radicacion
                ).toLocaleDateString()
              : 'Recientemente'}
          </span>
        </div>
      </td>
    </tr>
  );
}

function RevisarSolicitudes() {
  const [
    solicitudes,
    setSolicitudes
  ] = useState([]);

  const [
    evaluadores,
    setEvaluadores
  ] = useState([]);

  const [
    cargando,
    setCargando
  ] = useState(true);

  const [
    error,
    setError
  ] = useState(null);

  const [
    busqueda,
    setBusqueda
  ] = useState('');

  const [
    filtroEstado,
    setFiltroEstado
  ] = useState(
    'Todos'
  );

  const obtenerDatos =
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
          throw new Error(
            'Sesión no válida.'
          );
        }

        const respuestaPost =
          await axios.get(
            `${API_BASE}/postulaciones`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (
          respuestaPost.data.status ===
          'success'
        ) {
          const listado =
            Array.isArray(
              respuestaPost.data.data
            )
              ? respuestaPost.data.data
              : respuestaPost.data.data
                  ?.postulaciones ||
                [];

          setSolicitudes(
            listado
          );
        } else {
          throw new Error(
            respuestaPost.data.message ||
              'Error al obtener solicitudes.'
          );
        }

        const respuestaEv =
          await axios.get(
            `${API_BASE}/usuarios/evaluadores`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (
          respuestaEv.data.status ===
          'success'
        ) {
          setEvaluadores(
            respuestaEv.data.data ||
              []
          );
        }
      } catch (err) {
        console.error(
          'Error al cargar datos en panel de revisión:',
          err
        );

        setError(
          err.response?.data?.message ||
          err.message
        );
      } finally {
        setCargando(
          false
        );
      }
    };

  const cargarDatosIniciales = useEffectEvent(() => {
    void obtenerDatos();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => cargarDatosIniciales(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const descargarDocumento =
    (
      nombreArchivo
    ) => {
      descargarDocumentoSeguro(
        nombreArchivo
      );
    };

  const handleActualizarEstadoLocal =
    (
      id,
      nuevoEstado,
      motivoDecision
    ) => {
      setSolicitudes(
        (prev) =>
          prev.map(
            (sol) =>
              sol.id ===
              id
                ? {
                    ...sol,
                    estado:
                      nuevoEstado,
                    motivo_decision:
                      motivoDecision
                  }
                : sol
          )
      );
    };

  const handleAsignarEvaluadorLocal =
    (
      id,
      evaluadorId
    ) => {
      const evaluadorEncontrado =
        evaluadores.find(
          (ev) =>
            ev.id ===
            parseInt(
              evaluadorId,
              10
            )
        );

      setSolicitudes(
        (prev) =>
          prev.map(
            (sol) =>
              sol.id ===
              id
                ? {
                    ...sol,
                    evaluador_id:
                      evaluadorId,
                    evaluador_nombre:
                      evaluadorEncontrado
                        ? evaluadorEncontrado.nombre_completo
                        : 'Evaluador asignado'
                  }
                : sol
          )
      );
    };

  const solicitudesFiltradas =
    solicitudes.filter(
      (sol) => {
        const termino =
          busqueda.toLowerCase();

        const coincideTexto =
          sol.codigoPropuesta
            ?.toLowerCase()
            .includes(
              termino
            ) ||
          sol.titulo_propuesta
            ?.toLowerCase()
            .includes(
              termino
            ) ||
          sol.docente_nombre
            ?.toLowerCase()
            .includes(
              termino
            );

        const coincideEstado =
          filtroEstado ===
            'Todos' ||
          sol.estado ===
            filtroEstado;

        return (
          coincideTexto &&
          coincideEstado
        );
      }
    );

  const getBadgeStyles =
    (
      estado
    ) => {
      switch (
        estado
      ) {
        case 'Aprobado':
          return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';

        case 'Rechazado':
          return 'bg-rose-50 text-rose-700 border-rose-200/60';

        case 'En Evaluación':
          return 'bg-amber-50 text-amber-700 border-amber-200/60';

        case 'Radicado':
          return 'bg-blue-50 text-blue-700 border-blue-200/60';

        default:
          return 'bg-slate-50 text-slate-700 border-slate-200/60';
      }
    };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 mb-8 gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#5B9BD5]/10 text-[#5B9BD5] mb-2 uppercase tracking-wide">
            🛡️ Consola del Administrador
          </span>

          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Revisión de Solicitudes
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Gestiona, descarga la documentación y actualiza los estados de las propuestas de investigación radicadas.
          </p>
        </div>

        <button
          onClick={
            obtenerDatos
          }
          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-[#5B9BD5] bg-white border border-slate-200 hover:border-[#5B9BD5]/30 rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          🔄 Sincronizar Bandeja
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Buscar por código de propuesta, título o nombre del docente..."
            value={
              busqueda
            }
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/20 focus:border-[#5B9BD5] transition-all text-sm font-medium text-slate-700"
          />

          <span className="absolute left-4 top-3.5 text-slate-400 text-sm">
            🔍
          </span>
        </div>

        <div>
          <select
            value={
              filtroEstado
            }
            onChange={(e) =>
              setFiltroEstado(
                e.target.value
              )
            }
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/20 focus:border-[#5B9BD5] transition-all text-sm text-slate-700 font-semibold"
          >
            <option value="Todos">
              Filtro: Todos los Estados
            </option>

            <option value="Radicado">
              Radicado
            </option>

            <option value="En Evaluación">
              En Evaluación
            </option>

            <option value="Aprobado">
              Aprobado
            </option>

            <option value="Rechazado">
              Rechazado
            </option>
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-[#5B9BD5] rounded-full">
            <span className="sr-only">
              Cargando...
            </span>
          </div>

          <p className="text-slate-500 text-sm font-medium mt-4">
            Consultando base de datos de ArchiveX...
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50/50 p-8 rounded-3xl border border-red-100/60 text-center max-w-md mx-auto">
          <span className="text-4xl">
            ❌
          </span>

          <h3 className="text-lg font-bold text-red-800 mt-4">
            Error de Comunicación
          </h3>

          <p className="text-red-600 text-xs mt-1 leading-relaxed">
            {error}
          </p>
        </div>
      ) : solicitudesFiltradas.length ===
        0 ? (
        <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 text-center">
          <span className="text-5xl">
            📁
          </span>

          <h3 className="text-lg font-bold text-slate-700 mt-4">
            No se encontraron propuestas
          </h3>

          <p className="text-slate-400 text-sm mt-1">
            No hay solicitudes que coincidan con los filtros aplicados.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-md border border-slate-100/80 overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4.5 px-6">
                    Propuesta / Código
                  </th>

                  <th className="py-4.5 px-6">
                    Autor / Sede
                  </th>

                  <th className="py-4.5 px-6">
                    Documentación Requerida (PDFs)
                  </th>

                  <th className="py-4.5 px-6">
                    Estado de Evaluación
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {solicitudesFiltradas.map(
                  (sol) => (
                    <FilaSolicitud
                      key={`${sol.id}:${sol.estado}:${sol.motivo_decision || ''}`}
                      sol={sol}
                      evaluadores={
                        evaluadores
                      }
                      descargarDocumento={
                        descargarDocumento
                      }
                      getBadgeStyles={
                        getBadgeStyles
                      }
                      onActualizarEstado={
                        handleActualizarEstadoLocal
                      }
                      onAsignarEvaluador={
                        handleAsignarEvaluadorLocal
                      }
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default RevisarSolicitudes;