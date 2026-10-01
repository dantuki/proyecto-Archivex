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
      'Este evaluador no cargó un documento PDF para esta calificación.'
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
          method:
            'GET',

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

const Calificaciones = ({
  usuario
}) => {
  const [
    calificaciones,
    setCalificaciones
  ] = useState([]);

  const [
    cargando,
    setCargando
  ] = useState(true);

  const [
    error,
    setError
  ] = useState(null);

  useEffect(
    () => {
      obtenerCalificaciones();
    },
    []
  );

  const obtenerCalificaciones =
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

        const res =
          await fetch(
            `${API_BASE}/asignaciones/todas`,
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
          setCalificaciones(
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
              'Error al obtener el consolidado de calificaciones.'
          );
        }
      } catch (err) {
        console.error(
          'Error cargando calificaciones:',
          err
        );

        setError(
          err.message ||
            'Error al conectar con el servidor.'
        );
      } finally {
        setCargando(
          false
        );
      }
    };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Consolidado de Calificaciones
          </h2>

          <p className="text-slate-500 text-sm mt-1">
            Revisa los puntajes, comentarios de retroalimentación y descarga los reportes PDF de evaluación de las propuestas.
          </p>
        </div>

        <button
          onClick={
            obtenerCalificaciones
          }
          className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-all shadow-sm w-full md:w-auto text-center"
        >
          🔄 Actualizar Datos
        </button>
      </div>

      {cargando ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500">
            Cargando datos de evaluación...
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
      ) : calificaciones.length ===
        0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-4xl">
            📊
          </span>

          <p className="text-slate-500 font-medium mt-4">
            No se registran propuestas asignadas para evaluar en este momento.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Propuesta
                  </th>

                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Evaluador
                  </th>

                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Estado
                  </th>

                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Puntaje
                  </th>

                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Comentarios
                  </th>

                  <th className="p-4 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Retroalimentación
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {calificaciones.map(
                  (
                    cal
                  ) => (
                    <tr
                      key={
                        cal.asignacion_id
                      }
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">
                          {cal.titulo_propuesta ||
                            'Sin Título'}
                        </div>

                        <div className="text-xs text-slate-400 mt-0.5">
                          {cal.codigoPropuesta ||
                            'SIN-CODIGO'}
                        </div>
                      </td>

                      <td className="p-4 text-slate-600 font-medium">
                        {cal.evaluador_nombre ||
                          'No Asignado'}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            cal.estado_evaluacion ===
                            'Finalizado'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}
                        >
                          {cal.estado_evaluacion ===
                          'Finalizado'
                            ? '✓ Evaluado'
                            : '⏱️ Pendiente'}
                        </span>
                      </td>

                      <td className="p-4 font-bold text-slate-700">
                        {cal.estado_evaluacion ===
                        'Finalizado'
                          ? `${cal.puntaje} / 100`
                          : '-'}
                      </td>

                      <td
                        className="p-4 text-slate-500 text-xs max-w-xs truncate"
                        title={
                          cal.comentarios ||
                          ''
                        }
                      >
                        {cal.estado_evaluacion ===
                        'Finalizado'
                          ? cal.comentarios ||
                            'Sin comentarios'
                          : 'Esperando revisión...'}
                      </td>

                      <td className="p-4">
                        {cal.estado_evaluacion ===
                          'Finalizado' &&
                        cal.archivo_evaluacion ? (
                          <button
                            onClick={() =>
                              descargarDocumento(
                                cal.archivo_evaluacion
                              )
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#5B9BD5] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            📄 Descargar PDF
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Sin Reporte
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calificaciones;