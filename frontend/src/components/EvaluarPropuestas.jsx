import { useState, useEffect } from 'react';

const API_BASE =
  'http://localhost:5000/api';

const obtenerToken = () => {
  return (
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    ''
  );
};

const descargarDocumento = async (
  nombreArchivo
) => {
  if (!nombreArchivo) {
    alert(
      'Este documento no está disponible o no fue cargado.'
    );
    return;
  }

  if (
    typeof nombreArchivo ===
      'string' &&
    /^https?:\/\//i.test(
      nombreArchivo
    )
  ) {
    window.open(
      nombreArchivo,
      '_blank',
      'noopener,noreferrer'
    );

    return;
  }

  let valorLimpio =
    String(
      nombreArchivo
    )
      .trim()
      .replace(
        /^\/+/,
        ''
      );

  if (
    valorLimpio.startsWith(
      'uploads/'
    )
  ) {
    const nombrePublico =
      valorLimpio.replace(
        /^uploads\//,
        ''
      );

    window.open(
      `http://localhost:5000/uploads/${encodeURIComponent(
        nombrePublico
      )}`,
      '_blank',
      'noopener,noreferrer'
    );

    return;
  }

  const nombrePrivado =
    valorLimpio.replace(
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

    const response =
      await fetch(
        `${API_BASE}/archivos-privados/${encodeURIComponent(
          nombrePrivado
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

    if (!response.ok) {
      let message =
        'No fue posible acceder al documento.';

      try {
        const data =
          await response.json();

        message =
          data?.message ||
          data?.error ||
          message;
      } catch {
        // Respuesta no JSON.
      }

      alert(
        message
      );
      return;
    }

    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(
        blob
      );

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );

    setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      60000
    );
  } catch (error) {
    console.error(
      'Error descargando documento:',
      error
    );

    alert(
      'No fue posible abrir el documento.'
    );
  }
};

const EvaluarPropuestas = ({
  usuario
}) => {
  const [
    asignaciones,
    setAsignaciones
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
    propuestaSeleccionada,
    setPropuestaSeleccionada
  ] = useState(null);

  const [
    puntaje,
    setPuntaje
  ] = useState('');

  const [
    comentarios,
    setComentarios
  ] = useState('');

  const [
    archivoEvaluacion,
    setArchivoEvaluacion
  ] = useState(null);

  const [
    guardando,
    setGuardando
  ] = useState(false);

  const [
    mensajeExito,
    setMensajeExito
  ] = useState('');

  useEffect(
    () => {
      if (usuario?.id) {
        obtenerAsignaciones();
      }
    },
    [usuario]
  );

  const obtenerAsignaciones =
    async () => {
      if (!usuario?.id) {
        return;
      }

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

        const res =
          await fetch(
            `${API_BASE}/asignaciones/evaluador/${usuario.id}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        const resData =
          await res.json();

        if (
          res.ok &&
          resData.status ===
            'success'
        ) {
          setAsignaciones(
            Array.isArray(
              resData.data
            )
              ? resData.data
              : []
          );
        } else {
          setError(
            resData.error ||
              resData.message ||
              'Error al cargar las propuestas asignadas.'
          );
        }
      } catch (err) {
        console.error(
          'Error cargando asignaciones:',
          err
        );

        setError(
          err.message ||
            'No se pudo conectar con el servidor.'
        );
      } finally {
        setCargando(
          false
        );
      }
    };

  const abrirCalificacion =
    (propuesta) => {
      setPropuestaSeleccionada(
        propuesta
      );

      setPuntaje(
        propuesta.puntaje ??
          ''
      );

      setComentarios(
        propuesta.comentarios ||
          ''
      );

      setArchivoEvaluacion(
        null
      );

      setMensajeExito(
        ''
      );
    };

  const descargarPlantillaCalificacion =
    () => {
      const confirmar =
        window.confirm(
          '¿Deseas descargar la Plantilla de Calificación oficial para Evaluadores ArchiveX?\n\n(Nota: Si el archivo definitivo aún no se ha subido al servidor, se procesará una plantilla modelo por defecto).'
        );

      if (
        confirmar
      ) {
        window.open(
          '/plantillas/plantilla_evaluacion.docx',
          '_blank',
          'noopener,noreferrer'
        );
      }
    };

  const guardarCalificacion =
    async (
      e
    ) => {
      e.preventDefault();

      const pts =
        Number(
          puntaje
        );

      if (
        Number.isNaN(
          pts
        ) ||
        pts <
          0 ||
        pts >
          100
      ) {
        alert(
          'Por favor ingresa un puntaje válido entre 0 y 100.'
        );

        return;
      }

      if (
        !comentarios.trim()
      ) {
        alert(
          'Por favor añade comentarios de retroalimentación.'
        );

        return;
      }

      try {
        setGuardando(
          true
        );

        const token =
          obtenerToken();

        if (!token) {
          throw new Error(
            'Sesión no válida.'
          );
        }

        const formData =
          new FormData();

        formData.append(
          'puntaje',
          pts
        );

        formData.append(
          'comentarios',
          comentarios.trim()
        );

        if (
          archivoEvaluacion
        ) {
          formData.append(
            'archivo_evaluacion',
            archivoEvaluacion
          );
        }

        const res =
          await fetch(
            `${API_BASE}/asignaciones/${propuestaSeleccionada.asignacion_id}/calificar`,
            {
              method:
                'PUT',

              headers: {
                Authorization:
                  `Bearer ${token}`
              },

              body:
                formData
            }
          );

        const resData =
          await res.json();

        if (
          res.ok &&
          resData.status ===
            'success'
        ) {
          setMensajeExito(
            '¡Evaluación guardada y finalizada exitosamente!'
          );

          setArchivoEvaluacion(
            null
          );

          await obtenerAsignaciones();

          setTimeout(
            () => {
              setPropuestaSeleccionada(
                null
              );
            },
            2000
          );
        } else {
          alert(
            resData.message ||
              resData.error ||
              'Ocurrió un error al registrar la calificación.'
          );
        }
      } catch (err) {
        console.error(
          'Error guardando calificación:',
          err
        );

        alert(
          err.message ||
            'Error de conexión con el servidor.'
        );
      } finally {
        setGuardando(
          false
        );
      }
    };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Panel de Evaluaciones
          </h2>

          <p className="text-slate-500 text-sm mt-1">
            Aquí puedes ver, descargar la documentación y calificar los proyectos de investigación asignados a tu perfil.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={
              descargarPlantillaCalificacion
            }
            className="px-4 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
          >
            📥 Descargar Plantilla Evaluador
          </button>

          <button
            onClick={
              obtenerAsignaciones
            }
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-all shadow-sm w-full md:w-auto justify-center"
          >
            🔄 Actualizar Lista
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500">
            Cargando propuestas asignadas...
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 text-red-600 rounded-2xl border border-red-100 shadow-sm">
          <p className="font-bold">
            Error del Servidor
          </p>

          <p className="text-xs mt-1">
            {error}
          </p>
        </div>
      ) : asignaciones.length ===
        0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-4xl">
            📁
          </span>

          <p className="text-slate-500 font-medium mt-4">
            No tienes propuestas asignadas en este momento.
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 ${
            propuestaSeleccionada
              ? 'lg:grid-cols-3'
              : 'lg:grid-cols-1'
          } gap-6`}
        >
          <div
            className={
              propuestaSeleccionada
                ? 'lg:col-span-2 space-y-4'
                : 'space-y-4'
            }
          >
            {asignaciones.map(
              (
                asig
              ) => (
                <div
                  key={
                    asig.asignacion_id
                  }
                  className={`p-6 bg-white rounded-2xl shadow-sm border transition-all ${
                    propuestaSeleccionada?.asignacion_id ===
                    asig.asignacion_id
                      ? 'border-[#5B9BD5] ring-2 ring-[#5B9BD5]/10'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                      {asig.codigoPropuesta ||
                        'SIN-CODIGO'}
                    </span>

                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        asig.estado_evaluacion ===
                        'Finalizado'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}
                    >
                      {asig.estado_evaluacion ===
                      'Finalizado'
                        ? '✓ Evaluado'
                        : '⏱️ Pendiente de Calificar'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-2">
                    {
                      asig.titulo_propuesta
                    }
                  </h3>

                  <p className="text-slate-500 text-sm mb-3">
                    <strong>
                      Docente Responsable:
                    </strong>{' '}
                    {
                      asig.docente_nombre
                    }
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <span className="w-full text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1 block">
                      Documentación del Proyecto:
                    </span>

                    {asig.presupuesto && (
                      <button
                        onClick={() =>
                          descargarDocumento(
                            asig.presupuesto
                          )
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        📋 Presupuesto
                      </button>
                    )}

                    {asig.cronograma && (
                      <button
                        onClick={() =>
                          descargarDocumento(
                            asig.cronograma
                          )
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        📅 Cronograma
                      </button>
                    )}

                    {asig.honestidad && (
                      <button
                        onClick={() =>
                          descargarDocumento(
                            asig.honestidad
                          )
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        ✍️ Honestidad
                      </button>
                    )}

                    {asig.id_documento && (
                      <button
                        onClick={() =>
                          descargarDocumento(
                            asig.id_documento
                          )
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-white hover:bg-blue-50 hover:text-[#5B9BD5] border border-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        🪪 Identidad
                      </button>
                    )}
                  </div>

                  {asig.estado_evaluacion ===
                    'Finalizado' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/60 mb-4 text-xs space-y-1">
                      <p className="text-slate-700">
                        <strong>
                          Puntaje de evaluación:
                        </strong>{' '}
                        {
                          asig.puntaje
                        }{' '}
                        / 100
                      </p>

                      <p className="text-slate-600">
                        <strong>
                          Comentarios registrados:
                        </strong>{' '}
                        "{asig.comentarios}"
                      </p>

                      {asig.archivo_evaluacion && (
                        <button
                          onClick={() =>
                            descargarDocumento(
                              asig.archivo_evaluacion
                            )
                          }
                          className="mt-2 text-xs font-bold text-[#5B9BD5] hover:text-[#4a8bc4] flex items-center gap-1 cursor-pointer"
                        >
                          📄 Ver Archivo de Calificación Adjunto
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        abrirCalificacion(
                          asig
                        )
                      }
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm border cursor-pointer ${
                        asig.estado_evaluacion ===
                        'Finalizado'
                          ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#5B9BD5] text-white hover:bg-[#4a8bc4] border-transparent'
                      }`}
                    >
                      {asig.estado_evaluacion ===
                      'Finalizado'
                        ? '📝 Re-evaluar'
                        : '✏️ Calificar Propuesta'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {propuestaSeleccionada && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800">
                  Evaluando Propuesta
                </h3>

                <button
                  onClick={() =>
                    setPropuestaSeleccionada(
                      null
                    )
                  }
                  className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">
                  Título del Proyecto:
                </span>

                <p className="text-slate-700 text-sm font-semibold">
                  {
                    propuestaSeleccionada.titulo_propuesta
                  }
                </p>
              </div>

              {mensajeExito && (
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold text-center border border-emerald-100">
                  {
                    mensajeExito
                  }
                </div>
              )}

              <form
                onSubmit={
                  guardarCalificacion
                }
                className="space-y-4 text-sm"
              >
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Puntaje (0 - 100)
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    required
                    value={
                      puntaje
                    }
                    onChange={(e) =>
                      setPuntaje(
                        e.target.value
                      )
                    }
                    placeholder="Ej. 85.5"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/30 focus:border-[#5B9BD5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Comentarios de Retroalimentación
                  </label>

                  <textarea
                    rows={5}
                    required
                    value={
                      comentarios
                    }
                    onChange={(e) =>
                      setComentarios(
                        e.target.value
                      )
                    }
                    placeholder="Escribe aquí las observaciones..."
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/30 focus:border-[#5B9BD5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Documento de Evaluación (PDF con Firma)
                  </label>

                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) =>
                      setArchivoEvaluacion(
                        e.target.files?.[0] ||
                          null
                      )
                    }
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5B9BD5]/30 focus:border-[#5B9BD5] bg-white text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={
                      guardando
                    }
                    className="flex-1 bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 text-xs cursor-pointer"
                  >
                    {guardando
                      ? 'Guardando...'
                      : '✓ Guardar Calificación'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPropuestaSeleccionada(
                        null
                      )
                    }
                    className="bg-slate-100 text-slate-600 font-bold py-2 px-4 rounded-xl hover:bg-slate-200 transition-colors text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluarPropuestas;