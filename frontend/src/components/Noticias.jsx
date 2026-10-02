import { useState, useEffect, useEffectEvent } from 'react';
import { API_URL, BACKEND_ORIGIN } from '../config/api';

export default function Noticias({ onVolver }) {
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estado para controlar qué registro está desplegado (guarda el ID)
  const [expandidoId, setExpandidoId] = useState(null);

  // Estados para el formulario (Crear / Editar)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState('');
  const [archivo, setArchivo] = useState(null);

  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  const cargarNoticias = async () => {
    if (!userId) {
      setError('No se pudo identificar tu sesión de usuario.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/noticias/usuario/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resJson = await response.json();
      if (response.ok) {
        setNoticias(resJson.data || []);
      } else {
        setError(resJson.error || 'Error al procesar el historial.');
      }
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const cargarNoticiasIniciales = useEffectEvent(() => {
    void cargarNoticias();
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => cargarNoticiasIniciales(), 0);
    return () => window.clearTimeout(timeout);
  }, [userId]);

  const toggleExpandir = (id) => {
    setExpandidoId(expandidoId === id ? null : id);
  };

  const abrirCrear = () => {
    setEditandoId(null);
    setTitulo('');
    setContenido('');
    setFecha(new Date().toISOString().split('T')[0]);
    setArchivo(null);
    setModalAbierto(true);
  };

  const abrirEditar = (item) => {
    setEditandoId(item.id);
    setTitulo(item.titulo);
    setContenido(item.contenido || '');
    setFecha(item.fecha.split('T')[0]);
    setArchivo(null);
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('usuario_id', userId);
    formData.append('titulo', titulo);
    formData.append('contenido', contenido);
    formData.append('fecha', fecha);
    if (archivo) formData.append('archivo', archivo);

    const url = editandoId 
      ? `${API_URL}/noticias/${editandoId}`
      : `${API_URL}/noticias`;
    
    const method = editandoId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        setModalAbierto(false);
        cargarNoticias();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Ocurrió un error al guardar');
      }
    } catch {
      alert('Error de red al intentar guardar los datos.');
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás completamente seguro de eliminar este registro?')) return;
    try {
      const response = await fetch(`${API_URL}/noticias/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        if (expandidoId === id) setExpandidoId(null);
        cargarNoticias();
      } else {
        alert('No se pudo eliminar el registro.');
      }
    } catch {
      alert('Error al conectar con el servidor.');
    }
  };

  return (
    /* Cambiado a max-w-7xl para darle una amplitud brutal en el escritorio */
    <div className="w-full max-w-7xl mx-auto mt-6 space-y-6 p-4">
      
      {/* Barra de acciones superior */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
        <button 
          onClick={onVolver}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 flex items-center gap-1.5"
        >
          <span>←</span> Volver al Panel
        </button>
        
        <button 
          onClick={abrirCrear}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 hover:shadow-none transition-all duration-200 flex items-center gap-1.5"
        >
          <span>+</span> Agregar Documento / Noticia
        </button>
      </div>

      {/* Contenedor Principal Estilizado */}
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-100">
        
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-[#619c8f] to-[#528479] px-6 py-5 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl bg-white/10 p-2 rounded-xl">📰</span>
            <div>
              <h2 className="font-bold tracking-wider uppercase text-sm">Noticias e Historial Documental</h2>
              <p className="text-[10px] text-teal-100 uppercase tracking-widest mt-0.5 font-semibold">Módulo de Recursos Humanos</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full border border-white/10">
            Registros: {noticias.length}
          </span>
        </div>
        
        {error && <div className="p-4 text-xs font-semibold text-red-600 bg-red-50 text-center border-b border-red-100">⚠️ {error}</div>}

        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 font-semibold tracking-wide uppercase">Cargando tu historial personalizado...</div>
        ) : noticias.length === 0 ? (
          <div className="p-20 text-center text-slate-400 text-xs font-bold bg-slate-50/30 uppercase tracking-widest space-y-2">
            <div className="text-3xl opacity-40">📂</div>
            <p>No tienes documentos ni publicaciones registradas aún.</p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="px-6 py-3.5 w-36">Fecha</th>
                  <th className="px-6 py-3.5">Detalle del Registro</th>
                  <th className="px-6 py-3.5 text-center w-52">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {noticias.map((item) => {
                  const estaExpandido = expandidoId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-bold whitespace-nowrap align-top pt-5">
                        {new Date(item.fecha).toLocaleDateString('es-CO', { timeZone: 'UTC' })}
                      </td>
                      
                      <td className="px-6 py-4 break-words align-top">
                        <button
                          type="button"
                          onClick={() => toggleExpandir(item.id)}
                          className="text-[#c23616] font-bold uppercase tracking-wide text-[13px] mb-1 leading-snug hover:underline text-left flex items-center gap-2 focus:outline-none w-full"
                        >
                          <span className="text-[10px] text-slate-400 transition-transform duration-200">
                            {estaExpandido ? '▼' : '▶'}
                          </span>
                          <span>{item.titulo}</span>
                        </button>

                        {estaExpandido && (
                          /* Se aumentó el max-w-xl a max-w-4xl para que el texto aproveche el nuevo ancho */
                          <div className="mt-2.5 pl-4 border-l-2 border-slate-200 space-y-2.5 animate-fade-in">
                            {item.contenido && (
                              <p className="text-slate-600 normal-case font-medium text-xs leading-relaxed max-w-4xl whitespace-pre-wrap">
                                {item.contenido}
                              </p>
                            )}
                            {item.archivo_url && (
                              <div className="pt-1">
                                <a 
                                  href={`${BACKEND_ORIGIN}${item.archivo_url}`}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-bold transition-colors border border-blue-100 shadow-sm"
                                >
                                  📎 Ver Soporte Adjunto
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap align-top pt-4">
                        <button 
                          onClick={() => abrirEditar(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all border border-slate-200"
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          onClick={() => handleEliminar(item.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all border border-red-100"
                        >
                          🗑️ Borrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EMERGENTE (CREAR / EDITAR) */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editandoId ? '📝 Editar Soporte / Publicación' : '✨ Nuevo Registro de Historial'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Completa los campos para actualizar tu repositorio personal.</p>
            </div>
            
            <form onSubmit={handleGuardar} className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Título Oficial</label>
                  <span className={`text-[9px] font-bold ${255 - titulo.length <= 15 ? 'text-red-500' : 'text-slate-400'}`}>
                    {255 - titulo.length} caract.
                  </span>
                </div>
                <input 
                  type="text" 
                  required 
                  maxLength={255}
                  value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Acta de Grado, Certificado de Ponencia"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#619c8f] focus:bg-white transition-all text-slate-800 font-semibold"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider">Descripción o Resumen</label>
                  <span className={`text-[9px] font-bold ${500 - contenido.length <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                    {500 - contenido.length} caract.
                  </span>
                </div>
                <textarea 
                  value={contenido} 
                  maxLength={500}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Detalles sobre el documento o noticia..."
                  rows="3"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#619c8f] focus:bg-white transition-all text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1 text-[10px] tracking-wider">Fecha del Registro</label>
                <input 
                  type="date" 
                  required
                  value={fecha} 
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#619c8f] focus:bg-white transition-all font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1 text-[10px] tracking-wider">Cargar Documento Digital</label>
                <div className="mt-1 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center">
                  <input 
                    type="file" 
                    onChange={(e) => setArchivo(e.target.files[0])}
                    className="w-full text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-sm transition-colors uppercase text-[10px] tracking-wider"
                >
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}