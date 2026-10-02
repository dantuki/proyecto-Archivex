import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const formatearFechaParaInput = (fechaString) => {
  if (!fechaString) return '';
  const date = new Date(fechaString);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

function CrearConvocatoria({ alFinalizar, convocatoriaAEditar }) {
  const [formData, setFormData] = useState(() => ({
    codigo: convocatoriaAEditar?.codigo || '',
    titulo: convocatoriaAEditar?.titulo || '',
    descripcion: convocatoriaAEditar?.descripcion || '',
    tipo: convocatoriaAEditar?.tipo || 'General',
    fecha_inicio: formatearFechaParaInput(convocatoriaAEditar?.fecha_inicio),
    fecha_cierre: formatearFechaParaInput(convocatoriaAEditar?.fecha_cierre),
    presupuesto_max: convocatoriaAEditar?.presupuesto_max || '',
    modalidad: convocatoriaAEditar?.modalidad || '',
    area_tematica: convocatoriaAEditar?.area_tematica || '',
    ejes: convocatoriaAEditar?.ejes || '',
    requisitos: convocatoriaAEditar?.requisitos || '',
    bases_url: convocatoriaAEditar?.bases_url || '',
    plantillas_url: convocatoriaAEditar?.plantillas_url || ''
  }));

  const [archivoBases, setArchivoBases] = useState(null);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [cargando, setCargando] = useState(false);

  const esEdicion = !!convocatoriaAEditar;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const token = localStorage.getItem('token'); 

      const data = new FormData();
      data.append('titulo', formData.titulo);
      data.append('descripcion', formData.descripcion);
      data.append('tipo', formData.tipo);
      data.append('fecha_inicio', formData.fecha_inicio);
      data.append('fecha_cierre', formData.fecha_cierre);
      data.append('presupuesto_max', formData.presupuesto_max);
      data.append('modalidad', formData.modalidad);
      data.append('area_tematica', formData.area_tematica);
      data.append('ejes', formData.ejes);
      data.append('requisitos', formData.requisitos);
      data.append('plantillas_url', formData.plantillas_url);

      if (esEdicion) {
        data.append('codigo', formData.codigo);
        data.append('bases_url', formData.bases_url);
      }

      if (archivoBases) {
        data.append('archivo_bases', archivoBases);
      }

      let response;
      if (esEdicion) {
        response = await axios.put(`${API_URL}/convocatorias/${convocatoriaAEditar.id}`, data, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        response = await axios.post(`${API_URL}/convocatorias`, data, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      if (response.data.status === 'success') {
        setMensaje({
          tipo: 'success',
          texto: esEdicion 
            ? '¡Convocatoria actualizada con éxito!' 
            : `¡Convocatoria creada con éxito! Código: ${response.data.data.codigo}`
        });

        if (alFinalizar) {
          setTimeout(() => alFinalizar(), 1500);
        }
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error de conexión con el servidor';
      setMensaje({ tipo: 'error', texto: msg });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-3xl w-full text-slate-800 border border-slate-100 mt-2 mx-auto">
      <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {esEdicion ? 'Editar Convocatoria' : 'Crear Nueva Convocatoria'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {esEdicion ? 'Modifique los campos de la convocatoria seleccionada.' : 'Sube una nueva oferta de investigación al sistema.'}
          </p>
        </div>
        {alFinalizar && (
          <button 
            onClick={alFinalizar}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
          >
            ← Cancelar y Volver
          </button>
        )}
      </div>

      {mensaje.texto && (
        <div className={`p-4 rounded-xl text-sm mb-5 font-semibold ${mensaje.tipo === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Título de la Convocatoria *</label>
          <input
            type="text"
            name="titulo"
            value={formData.titulo}
            onChange={handleInputChange}
            placeholder="Ej: Convocatoria Interna para Proyectos de Innovación 2026"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Descripción del Programa *</label>
          <textarea
            name="descripcion"
            rows="2"
            value={formData.descripcion}
            onChange={handleInputChange}
            placeholder="Escriba un resumen detallado del enfoque de la convocatoria..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Código</label>
            <input
              type="text"
              value={esEdicion ? formData.codigo : "AUTOMÁTICO"}
              disabled
              className="w-full px-4 py-2.5 border rounded-xl text-sm bg-slate-200 text-slate-400 border-slate-300 font-bold text-center select-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Tipo de Convocatoria *</label>
            <select
              name="tipo"
              value={formData.tipo}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
              required
            >
              <option value="General">General</option>
              <option value="Mediana">Mediana</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Modalidad de Financiación</label>
            <input
              type="text"
              name="modalidad"
              value={formData.modalidad}
              onChange={handleInputChange}
              placeholder="Ej: Financiación Total"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Área Temática *</label>
            <select
              name="area_tematica"
              value={formData.area_tematica}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
              required
            >
              <option value="">Seleccione un Área Temática...</option>
              <option value="Medicina y Ciencias de la Salud">Medicina y Ciencias de la Salud</option>
              <option value="Tecnología e Informática">Tecnología e Informática</option>
              <option value="Ingeniería y Ciencias Físicas">Ingeniería y Ciencias Físicas</option>
              <option value="Ciencias Sociales y Humanidades">Ciencias Sociales y Humanidades</option>
              <option value="Ciencias Naturales y Exactas">Ciencias Naturales y Exactas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">URL de Plantillas / Formatos</label>
            <input
              type="url"
              name="plantillas_url"
              value={formData.plantillas_url}
              onChange={handleInputChange}
              placeholder="Ej: https://drive.google.com/drive/..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Ejes Temáticos de Investigación *</label>
            <textarea
              name="ejes"
              rows="2"
              value={formData.ejes}
              onChange={handleInputChange}
              placeholder="Ejes de investigación requeridos (separados por comas)..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Requisitos de Postulación *</label>
            <textarea
              name="requisitos"
              rows="2"
              value={formData.requisitos}
              onChange={handleInputChange}
              placeholder="Escriba los requisitos obligatorios del docente..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm resize-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Fecha de Inicio *</label>
            <input
              type="datetime-local"
              name="fecha_inicio"
              value={formData.fecha_inicio}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Fecha de Cierre *</label>
            <input
              type="datetime-local"
              name="fecha_cierre"
              value={formData.fecha_cierre}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Presupuesto Máximo</label>
            <input
              type="text"
              name="presupuesto_max"
              value={formData.presupuesto_max}
              onChange={handleInputChange}
              placeholder="Ej: $15,000,000 COP"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Cargar Archivo de Bases (PDF) *</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setArchivoBases(e.target.files[0])}
              required={!esEdicion}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B9BD5] text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300"
            />
            {esEdicion && formData.bases_url && (
              <p className="text-xs text-blue-600 mt-1 truncate">
                📄 <a href={formData.bases_url} target="_blank" rel="noreferrer" className="underline hover:text-blue-800 font-semibold">Ver PDF cargado actualmente</a>
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full py-3 bg-gradient-to-r from-[#5B9BD5] to-[#70AD47] text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity uppercase tracking-wider text-sm mt-2 disabled:opacity-50"
        >
          {cargando 
            ? 'Procesando cambios en Base de Datos...' 
            : esEdicion 
              ? 'Guardar Cambios de Convocatoria' 
              : 'Publicar Convocatoria en Archivex'}
        </button>
      </form>
    </div>
  );
}

export default CrearConvocatoria;