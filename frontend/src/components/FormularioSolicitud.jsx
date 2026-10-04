import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const FormularioSolicitud = () => {
  const [formData, setFormData] = useState({
    usuario_id: localStorage.getItem('userId') || '',
    convocatoria_id: '',
    sede_id: '',
    num_solicitud: '',
    titulo_propuesta: '',
    observaciones: ''
  });
  
  const [convocatorias, setConvocatorias] = useState([]);
  const [archivos, setArchivos] = useState({
    presupuesto: null,
    cronograma: null,
    honestidad: null,
    identidad: null
  });
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Cargar ID de usuario y lista de convocatorias disponibles
  useEffect(() => {
    const cargarConvocatorias = async () => {
      try {
        const response = await axios.get(`${API_URL}/convocatorias`);
        if (response.data.status === 'success') {
          setConvocatorias(response.data.data);
        }
      } catch (err) {
        console.error("Error al traer convocatorias para el formulario:", err);
      }
    };

    cargarConvocatorias();
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e, campo) => {
    setArchivos({
      ...archivos,
      [campo]: e.target.files[0]
    });
  };

  // Encontrar la convocatoria seleccionada actualmente
  const convocatoriaSeleccionada = convocatorias.find(
    c => String(c.id) === String(formData.convocatoria_id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });

    if (!formData.convocatoria_id || !formData.sede_id) {
      setMensaje({ tipo: 'error', texto: 'Por favor seleccione una convocatoria y una sede.' });
      return;
    }

    if (!archivos.presupuesto || !archivos.cronograma || !archivos.honestidad || !archivos.identidad) {
      setMensaje({ tipo: 'error', texto: 'Por favor cargue los 4 documentos obligatorios en formato PDF.' });
      return;
    }

    // Preparar FormData para envío con múltiples archivos binarios
    const dataToSend = new FormData();
    dataToSend.append('usuario_id', formData.usuario_id);
    dataToSend.append('convocatoria_id', formData.convocatoria_id);
    dataToSend.append('sede_id', formData.sede_id);
    dataToSend.append('titulo_propuesta', formData.titulo_propuesta);
    dataToSend.append('observaciones', formData.observaciones);

    // Adjuntar los 4 documentos
    dataToSend.append('presupuesto', archivos.presupuesto);
    dataToSend.append('cronograma', archivos.cronograma);
    dataToSend.append('honestidad', archivos.honestidad);
    dataToSend.append('identidad', archivos.identidad);

    console.log("Enviando Solicitud Completa con 4 documentos...");
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/solicitudes`, dataToSend, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.status === 'success') {
        setMensaje({ tipo: 'success', texto: '¡La solicitud y sus 4 documentos han sido radicados exitosamente!' });
        // Limpiar archivos cargados
        setArchivos({ presupuesto: null, cronograma: null, honestidad: null, identidad: null });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al procesar y almacenar la solicitud en el servidor.' }); 
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-3xl bg-white p-6 rounded-2xl shadow-md">
      
      {mensaje.texto && (
        <div className={`p-3 rounded-xl text-xs font-semibold border ${mensaje.tipo === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Sección Informativa Dinámica: LINK DE PLANTILLAS EN DRIVE */}
      {convocatoriaSeleccionada && convocatoriaSeleccionada.plantillas_url && (
        <div className="bg-[#5B9BD5]/10 border-2 border-[#5B9BD5]/30 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-[#5B9BD5] text-white p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-slate-800 font-bold text-sm">¿No tienes los formatos?</h4>
              <p className="text-xs text-slate-500">Descarga y edita las plantillas oficiales requeridas antes de radicar.</p>
            </div>
          </div>
          <a 
            href={convocatoriaSeleccionada.plantillas_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#5B9BD5] hover:bg-[#4d86b8] text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all shadow-sm hover:shadow-md inline-flex items-center gap-1 shrink-0"
          >
            Descargar Plantillas
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Convocatoria Desplegable */}
        <div className="flex flex-col">
          <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Seleccionar Convocatoria</label>
          <select
            name="convocatoria_id"
            value={formData.convocatoria_id}
            onChange={handleInputChange}
            className="border-2 border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] transition-all bg-slate-50 hover:bg-white text-slate-700 font-medium text-sm"
            required
          >
            <option value="">-- Elija un programa vigente --</option>
            {convocatorias.map(c => (
              <option key={c.id} value={c.id}>{c.titulo} ({c.codigo})</option>
            ))}
          </select>
        </div>
        
        {/* Sede Desplegable */}
        <div className="flex flex-col">
          <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Sede Universitaria</label>
          <select
            name="sede_id"
            value={formData.sede_id}
            onChange={handleInputChange}
            className="border-2 border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] transition-all bg-slate-50 hover:bg-white text-slate-700 font-medium text-sm"
            required
          >
            <option value="">-- Seleccione Destino --</option>
            <option value="1">Sede Pereira</option>
            <option value="2">Sede Cartago</option>
            <option value="3">Sede Ibagué</option>
          </select>
        </div>

        {/* N° Solicitud Oculto */}
        <div className="flex flex-col">
          <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">N° Solicitud</label>
          <input
            type="text"
            value="SE GENERARÁ AUTOMÁTICAMENTE"
            disabled
            className="border-2 border-slate-200 rounded-xl px-4 py-3 bg-slate-100 text-slate-400 font-semibold cursor-not-allowed select-none focus:outline-none text-sm"
          />
        </div>

        {/* ID del Profesor */}
        <div className="flex flex-col">
          <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">ID Investigador Asignado</label>
          <input
            type="text"
            value={`Profesor Conectado: #${formData.usuario_id || 'Cargando...'}`}
            disabled
            className="border-2 border-slate-200 rounded-xl px-4 py-3 bg-indigo-50/50 text-indigo-600 font-bold cursor-not-allowed select-none focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Título de propuesta */}
      <div className="flex flex-col mt-4">
        <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Título de la Propuesta *</label>
        <input
          type="text"
          name="titulo_propuesta"
          value={formData.titulo_propuesta}
          onChange={handleInputChange}
          placeholder="Escriba el título definitivo de su propuesta de investigación"
          className="border-2 border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] transition-all bg-slate-50 hover:bg-white text-slate-700 font-medium text-sm"
          required
        />
      </div>

      {/* Observaciones iniciales */}
      <div className="flex flex-col mt-4">
        <label className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Observaciones Iniciales</label>
        <textarea
          name="observaciones"
          value={formData.observaciones}
          onChange={handleInputChange}
          placeholder="Comentarios o aclaraciones breves para los evaluadores..."
          rows="3"
          className="border-2 border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] transition-all bg-slate-50 hover:bg-white text-slate-700 font-medium text-sm resize-none"
        />
      </div>

      {/* Carga de Documentación Obligatoria en Cuadrícula 2x2 */}
      <div className="bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl mt-8">
        <h3 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Documentación Obligatoria (Formatos PDF)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Presupuesto General */}
          <div className="flex flex-col bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/50 transition-all shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">1. Presupuesto General *</label>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'presupuesto')} 
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer"
              required 
            />
            {archivos.presupuesto && (
              <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold flex items-center gap-1">
                ✓ Listo: {archivos.presupuesto.name}
              </span>
            )}
          </div>

          {/* 2. Cronograma de Actividades */}
          <div className="flex flex-col bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/50 transition-all shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">2. Cronograma de Actividades *</label>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'cronograma')} 
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer"
              required 
            />
            {archivos.cronograma && (
              <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold flex items-center gap-1">
                ✓ Listo: {archivos.cronograma.name}
              </span>
            )}
          </div>

          {/* 3. Declaración de Honestidad */}
          <div className="flex flex-col bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/50 transition-all shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">3. Declaración de Honestidad *</label>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'honestidad')} 
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer"
              required 
            />
            {archivos.honestidad && (
              <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold flex items-center gap-1">
                ✓ Listo: {archivos.honestidad.name}
              </span>
            )}
          </div>

          {/* 4. Soporte Documento Identidad */}
          <div className="flex flex-col bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/50 transition-all shadow-sm">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">4. Soporte Documento Identidad *</label>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'identidad')} 
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer"
              required 
            />
            {archivos.identidad && (
              <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold flex items-center gap-1">
                ✓ Listo: {archivos.identidad.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-[#5B9BD5] to-[#70AD47] text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 mt-8 text-lg uppercase tracking-wide"
      >
        Enviar Propuesta de Investigación
      </button>
    </form>
  );
};

export default FormularioSolicitud;