import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

function MisSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cronologia, setCronologia] = useState({});
  const [cronologiaAbierta, setCronologiaAbierta] = useState(null);
  const [cargandoCronologia, setCargandoCronologia] = useState(null);

  const obtenerSolicitudes = async () => {
    setCargando(true);
    setError(null);
    try {
      // Leemos de sessionStorage de manera segura
      const token = sessionStorage.getItem('token');
      const respuesta = await axios.get(`${API_BASE}/postulaciones/mis-solicitudes`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (respuesta.data.status === 'success') {
        setSolicitudes(respuesta.data.data);
      } else {
        throw new Error(respuesta.data.message || 'Error al procesar las solicitudes.');
      }
    } catch (err) {
      console.error("Error al cargar las solicitudes:", err);
      setError(err.response?.data?.message || err.message || 'No se pudieron cargar tus solicitudes.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerSolicitudes();
  }, []);

  const alternarCronologia = async (id) => {
    if (cronologiaAbierta === id) {
      setCronologiaAbierta(null);
      return;
    }
    setCronologiaAbierta(id);
    if (cronologia[id]) return;
    setCargandoCronologia(id);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const respuesta = await axios.get(`${API_BASE}/solicitudes/${id}/cronologia`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCronologia((actual) => ({ ...actual, [id]: respuesta.data.data }));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la cronología.');
    } finally {
      setCargandoCronologia(null);
    }
  };

  const previsualizarDocumento = async (archivoUrl) => {
    if (!archivoUrl) return;
    const ruta = archivoUrl.startsWith('/') ? archivoUrl : `/${archivoUrl}`;
    if (!ruta.includes('/uploads_private/')) {
      window.open(`http://localhost:5000${ruta}`, '_blank', 'noopener,noreferrer');
      return;
    }

    const ventana = window.open('about:blank', '_blank');
    if (ventana) ventana.opener = null;
    try {
      const nombre = ruta.split('/').pop();
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const respuesta = await fetch(`${API_BASE}/archivos-privados/${encodeURIComponent(nombre)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!respuesta.ok) throw new Error('No tienes acceso a este archivo.');
      const url = URL.createObjectURL(await respuesta.blob());
      if (ventana) ventana.location = url;
      else {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.target = '_blank';
        enlace.rel = 'noopener noreferrer';
        enlace.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (previewError) {
      if (ventana) ventana.close();
      setError(previewError.message || 'No se pudo abrir el documento.');
    }
  };

  const estadosFlujo = ['Radicado', 'En Evaluación', 'Correcciones solicitadas', 'Aprobado / Rechazado'];

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'Aprobado':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Rechazado':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'En Evaluación':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Correcciones solicitadas':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Radicado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#5B9BD5]"></div>
        <span className="ml-3 text-slate-600 font-medium">Cargando tu historial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 border border-red-100 p-8 rounded-3xl shadow-lg text-center max-w-md mx-auto mt-10">
        <span className="text-5xl">⚠️</span>
        <h3 className="text-xl font-bold text-slate-800 mt-4">Ha ocurrido un problema</h3>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          {error}
        </p>
        <button
          onClick={obtenerSolicitudes}
          className="mt-5 px-6 py-2.5 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-colors shadow-md text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl w-full text-slate-800 border border-slate-100/80 mt-2 p-8 transition-all duration-300">
      <div className="border-b border-slate-100 pb-5 mb-6">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mis Solicitudes Radicadas</h2>
        <p className="text-sm text-slate-500 mt-1">
          Historial de propuestas de investigación que has enviado. Puedes hacer seguimiento al estado de evaluación y las respuestas del administrador.
        </p>
      </div>

      {solicitudes.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <span className="text-4xl">📁</span>
          <h3 className="text-base font-bold text-slate-700 mt-3">Sin propuestas registradas</h3>
          <p className="text-xs text-slate-400 mt-1">Aún no has radicado ninguna postulación en el sistema.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {solicitudes.map((sol) => (
            <div 
              key={sol.id} 
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col md:flex-row justify-between gap-6"
            >
              <div className="flex-1 space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-extrabold px-3 py-1 bg-slate-100 rounded-lg text-slate-600">
                    {sol.codigoPropuesta || sol.num_solicitud}
                  </span>
                  <span className={`text-xs font-bold px-3 py-0.5 rounded-full border ${getEstadoBadge(sol.estado)}`}>
                    {sol.estado}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-snug">
                    {sol.titulo_propuesta}
                  </h3>
                  <p className="text-xs text-[#5B9BD5] font-semibold mt-1">
                    🎯 Convocatoria: {sol.convocatoria || 'Sin convocatoria'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>🏛️ <strong>Sede:</strong> {sol.nombre_sede || sol.sede || 'Sin sede'}</p>
                  <p>📅 <strong>Radicado el:</strong> {new Date(sol.fecha_radicacion || sol.created_at).toLocaleDateString()}</p>
                  {sol.observaciones && (
                    <p className="sm:col-span-2 italic text-slate-400">
                      💬 <strong>Tus observaciones:</strong> {sol.observaciones}
                    </p>
                  )}
                </div>

                {sol.motivo_decision && (
                  <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                    sol.estado === 'Aprobado' 
                      ? 'bg-green-50/70 border-green-100 text-green-800' 
                      : 'bg-red-50/70 border-red-100 text-red-800'
                  }`}>
                    <strong className="block text-[10px] uppercase font-extrabold tracking-wider mb-1">
                      Retroalimentación de la Administración:
                    </strong>
                    {sol.motivo_decision}
                  </div>
                )}

                <button type="button" onClick={() => alternarCronologia(sol.id)} className="text-sm font-semibold text-blue-700 hover:underline">
                  {cronologiaAbierta === sol.id ? 'Ocultar seguimiento' : 'Ver seguimiento y documentos'}
                </button>

                {cronologiaAbierta === sol.id && (
                  <div className="space-y-5 rounded-xl border border-slate-200 p-4">
                    {cargandoCronologia === sol.id ? <p className="text-sm text-slate-500">Cargando seguimiento...</p> : (
                      <>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 mb-3">Seguimiento</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {estadosFlujo.map((estado, index) => {
                              const estadoActual = cronologia[sol.id]?.estado || sol.estado;
                              const progreso = estadoActual === 'Aprobado' || estadoActual === 'Rechazado'
                                ? 3 : estadosFlujo.indexOf(estadoActual);
                              return <div key={estado} className={`rounded-lg border p-2 text-xs ${index <= progreso ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-400'}`}>
                                <span className="block font-bold">{estado}</span>
                                {index === progreso && <span>Estado actual</span>}
                              </div>;
                            })}
                          </div>
                          <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
                            {(cronologia[sol.id]?.timeline || []).map((evento) => <li key={evento.id} className="text-xs text-slate-600">
                              <p className="font-bold text-slate-800">{evento.estado_anterior ? `${evento.estado_anterior} → ` : ''}{evento.estado_nuevo}</p>
                              <p>{new Date(evento.fecha_cambio).toLocaleString()} · {evento.responsable || 'Sistema'}</p>
                              {evento.motivo_cambio && <p className="mt-1">{evento.motivo_cambio}</p>}
                            </li>)}
                          </ol>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 mb-2">Documentos y versiones</h4>
                          {(cronologia[sol.id]?.documents || []).length ? (
                            <div className="space-y-2">{cronologia[sol.id].documents.map((documento) => <div key={documento.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                              <div>
                                <p className="font-semibold text-slate-700">{documento.tipo_documento} · v{documento.version_no} · {documento.review_status === 'validated' ? 'Validado' : documento.review_status === 'rejected' ? 'Requiere correcciones' : documento.review_status === 'replaced' ? 'Reemplazado' : 'Pendiente'}</p>
                                {documento.review_comment && <p className="mt-1 text-slate-500">{documento.review_comment}</p>}
                              </div>
                              <button type="button" onClick={() => previsualizarDocumento(documento.archivo_url)} className="font-semibold text-blue-700 hover:underline">Vista previa</button>
                            </div>)}</div>
                          ) : <p className="text-xs text-slate-500">No hay documentos indexados para mostrar.</p>}
                        </div>
                        {(cronologia[sol.id]?.comments || []).length > 0 && <div>
                          <h4 className="text-sm font-bold text-slate-800 mb-2">Comentarios de evaluación</h4>
                          <div className="space-y-2">{cronologia[sol.id].comments.map((comentario) => <p key={comentario.id} className="rounded-lg bg-blue-50 p-3 text-xs text-slate-700">
                            <strong>{comentario.autor || 'Evaluador'} · {new Date(comentario.created_at).toLocaleString()}</strong><br />{comentario.comentario}
                          </p>)}</div>
                        </div>}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center gap-2.5 bg-slate-50/50 p-4 rounded-xl border border-slate-100 md:w-56 shrink-0 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1.5 mb-1">
                  Documentación Anexa
                </span>
                {[
                  ['Presupuesto', sol.presupuesto || sol.presupuesto_url],
                  ['Cronograma', sol.cronograma || sol.cronograma_url],
                  ['Honestidad', sol.honestidad || sol.honestidad_url],
                  ['Identidad', sol.id_documento || sol.id_url]
                ].filter(([, url]) => url).map(([tipo, url]) => <button key={tipo} type="button" onClick={() => previsualizarDocumento(url)} className="text-xs text-slate-600 hover:text-[#5B9BD5] font-semibold text-left">{tipo} · vista previa</button>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MisSolicitudes;