import { useState, useEffect, useEffectEvent } from 'react';
import axios from 'axios';

import { API_URL } from '../config/api';

const API_BASE = API_URL;

function ConvocatoriasAbiertas({ alSeleccionarConvocatoria, alEditarConvocatoria, usuario }) {
  const [convocatorias, setConvocatorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const esAdmin = usuario?.rol === 'Admin';

  const obtenerConvocatorias = async () => {
    try {
      setCargando(true);
      const response = await axios.get(`${API_BASE}/convocatorias`);
      if (response.data.status === 'success') {
        setConvocatorias(response.data.data);
      }
    } catch (err) {
      setError('No se pudieron cargar las convocatorias desde el servidor.');
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const cargarInicial = useEffectEvent(() => {
    void obtenerConvocatorias();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => cargarInicial(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta convocatoria? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_BASE}/convocatorias/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.status === 'success') {
        alert('Convocatoria eliminada correctamente');
        setConvocatorias(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al intentar eliminar la convocatoria');
    }
  };

  const formatearFecha = (fechaString) => {
    if (!fechaString) return 'Sin fecha';
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (cargando) {
    return (
      <div className="text-center bg-white/95 p-8 rounded-xl shadow-lg mt-10">
        <p className="text-slate-600 font-semibold animate-pulse">Cargando convocatorias activas...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mt-2">
      <div className="mb-6 text-left flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 drop-shadow-sm">
            Convocatorias Vigentes
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Seleccione la convocatoria de su interés para radicar la documentación de su propuesta.
          </p>
        </div>
        {esAdmin && (
          <button 
            onClick={obtenerConvocatorias}
            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            🔄 Sincronizar Base de Datos
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-center mb-6">
          {error}
        </div>
      )}

      {convocatorias.length === 0 ? (
        <div className="text-center bg-white/90 backdrop-blur-sm p-12 rounded-2xl border border-slate-200 shadow-xl">
          <span className="text-5xl">📭</span>
          <h3 className="text-xl font-bold text-slate-700 mt-4">No hay convocatorias registradas</h3>
          <p className="text-slate-500 text-sm mt-1">Vuelve más tarde o crea una desde el panel de administración.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {convocatorias.map((conv) => (
            <div key={conv.id} className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-md border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:shadow-xl transition-all">
              <div className="flex-1 space-y-2 text-left w-full">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {conv.codigo}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Cierre: {formatearFecha(conv.fecha_cierre)}
                  </span>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {conv.tipo}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800">{conv.titulo}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{conv.descripcion}</p>
                
                <div className="flex flex-wrap gap-6 pt-2 text-xs font-semibold text-slate-500">
                  <div>💰 Topes: <span className="text-slate-700">{conv.presupuesto_max || 'No especificado'}</span></div>
                  <div>📋 Modalidad: <span className="text-slate-700">{conv.modalidad || 'No específica'}</span></div>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col gap-2 flex-shrink-0">
                {esAdmin ? (
                  <>
                    <button
                      onClick={() => alEditarConvocatoria(conv)}
                      className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition text-xs uppercase tracking-wider"
                    >
                      Editar ✏️
                    </button>
                    <button
                      onClick={() => handleEliminar(conv.id)}
                      className="w-full px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md transition text-xs uppercase tracking-wider"
                    >
                      Eliminar 🗑️
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => alSeleccionarConvocatoria(conv)}
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-[#5B9BD5] to-[#70AD47] text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity uppercase tracking-wider text-xs"
                  >
                    Postularse 🚀
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConvocatoriasAbiertas;