import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const Convocatorias = ({ usuario, convocatoria }) => {
  const [formData, setFormData] = useState({
    titulo_propuesta: '',
    sede_vinculacion: '',
    observaciones: ''
  });

  const [archivos, setArchivos] = useState({
    presupuesto: null,
    cronograma: null,
    honestidad: null,
    identidad: null
  });

  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [cargando, setCargando] = useState(false);

  const sedes = [
    "Apartadó", "Arauca", "Barrancabermeja", "Bogotá", "Bucaramanga", 
    "Cali", "Cartago", "El Espinal", "Ibagué", "Medellín", "Montería", 
    "Neiva", "Pasto", "Pereira", "Popayán", "Quibdó", "Santa Marta", "Villavicencio"
  ];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });

    if (!formData.sede_vinculacion) {
      setMensaje({ tipo: 'error', texto: 'Por favor seleccione una sede de vinculación.' });
      return;
    }

    if (!archivos.presupuesto || !archivos.cronograma || !archivos.honestidad || !archivos.identidad) {
      setMensaje({ tipo: 'error', texto: 'Por favor cargue los 4 documentos obligatorios en formato PDF.' });
      return;
    }

    setCargando(true);

    const dataToSend = new FormData();
    // Intenta leer el userId desde props, sessionStorage o localStorage de manera segura
    const userId = usuario?.id || sessionStorage.getItem('userId') || localStorage.getItem('userId') || '';
    
    dataToSend.append('usuario_id', userId);
    dataToSend.append('convocatoriaId', convocatoria?.id || '');
    dataToSend.append('sede', formData.sede_vinculacion); 
    dataToSend.append('titulo_propuesta', formData.titulo_propuesta);
    dataToSend.append('observaciones', formData.observaciones);

    dataToSend.append('presupuesto', archivos.presupuesto);
    dataToSend.append('cronograma', archivos.cronograma);
    dataToSend.append('honestidad', archivos.honestidad);
    dataToSend.append('identidad', archivos.identidad); 

    try {
      // Intentamos obtener el token de sessionStorage o localStorage de manera híbrida
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      
      // CORREGIDO: Ahora apunta a '/api/postulaciones/radicar' para coincidir con tu index.js
      const res = await axios.post(`${API_URL}/postulaciones/radicar`, dataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.status === 'success') {
        setMensaje({ 
          tipo: 'success', 
          texto: '¡Propuesta y documentación radicadas con éxito!' 
        });
        setFormData({ titulo_propuesta: '', sede_vinculacion: '', observaciones: '' });
        setArchivos({ presupuesto: null, cronograma: null, honestidad: null, identidad: null });
      }
    } catch (err) {
      console.error("Error al radicar la postulación:", err);
      setMensaje({ 
        tipo: 'error', 
        texto: err.response?.data?.message || 'Error al procesar la radicación.' 
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
      
      <div className="border-b border-slate-100 pb-6 mb-6">
        <span className="text-xs font-bold text-[#5B9BD5] uppercase tracking-wider block mb-1">
          Postulándote a la convocatoria:
        </span>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
          {convocatoria?.titulo || 'Cargando título...'}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-medium">
          <span className="bg-slate-100 px-3 py-1 rounded-full text-xs">
            ID Identificador: <strong className="text-slate-700">{convocatoria?.codigo || 'N/A'}</strong>
          </span>
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs flex items-center gap-1 font-bold">
            💰 Tope Máx: ${Number(convocatoria?.presupuesto_max || 0).toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      {convocatoria?.plantillas_url && (
        <div className="bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📂</span>
            <div>
              <h4 className="text-slate-800 font-bold text-sm">¿No tienes los formatos oficiales?</h4>
              <p className="text-xs text-slate-500">Descarga y edita las plantillas requeridas en Drive antes de subir tu propuesta.</p>
            </div>
          </div>
          <a
            href={convocatoria.plantillas_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5B9BD5] hover:bg-[#4a85b9] text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all shadow-sm flex items-center gap-2 shrink-0"
          >
            Descargar Plantillas
            <span>➔</span>
          </a>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Radicación de Propuesta</h3>
        <p className="text-slate-400 text-xs mb-6">
          Sube la documentación reglamentaria requerida en formato PDF. Archivex enlazará automáticamente tu perfil académico.
        </p>

        {mensaje.texto && (
          <div className={`p-4 rounded-xl text-sm font-semibold mb-6 border ${
            mensaje.tipo === 'success' 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Código Único de Propuesta (Automático)
              </label>
              <input
                type="text"
                value="SE GENERARÁ AL ENVIAR"
                disabled
                className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-slate-400 font-semibold cursor-not-allowed text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Sede de Vinculación *
              </label>
              <select
                name="sede_vinculacion"
                value={formData.sede_vinculacion}
                onChange={handleInputChange}
                className="border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] bg-white text-slate-700 font-medium text-sm transition-all"
                required
              >
                <option value="">-- Seleccione una sede --</option>
                {sedes.map((sede, index) => (
                  <option key={sede} value={index + 1}>{sede}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
              Título de la Propuesta *
            </label>
            <input
              type="text"
              name="titulo_propuesta"
              value={formData.titulo_propuesta}
              onChange={handleInputChange}
              placeholder="Escriba el título de su investigación científica"
              className="border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] text-slate-700 font-medium text-sm"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
              Observaciones Iniciales
            </label>
            <textarea
              name="observaciones"
              value={formData.observaciones}
              onChange={handleInputChange}
              placeholder="Comentarios adicionales para el comité evaluador..."
              rows="3"
              className="border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#5B9BD5] text-slate-700 font-medium text-sm resize-none"
            />
          </div>

          <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl mt-6">
            <h4 className="text-sm font-bold text-slate-600 mb-4 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
              📂 Documentación Obligatoria (Formatos PDF)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/40 transition-all">
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">
                  1. Presupuesto General *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'presupuesto')}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer w-full"
                  required
                />
                {archivos.presupuesto && (
                  <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold block">
                    ✓ Listo: {archivos.presupuesto.name}
                  </span>
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/40 transition-all">
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">
                  2. Cronograma de Actividades *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'cronograma')}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer w-full"
                  required
                />
                {archivos.cronograma && (
                  <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold block">
                    ✓ Listo: {archivos.cronograma.name}
                  </span>
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/40 transition-all">
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">
                  3. Declaración de Honestidad *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'honestidad')}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer w-full"
                  required
                />
                {archivos.honestidad && (
                  <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold block">
                    ✓ Listo: {archivos.honestidad.name}
                  </span>
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#5B9BD5]/40 transition-all">
                <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">
                  4. Soporte Documento Identidad *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'identidad')}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#5B9BD5]/10 file:text-[#5B9BD5] hover:file:bg-[#5B9BD5]/20 cursor-pointer w-full"
                  required
                />
                {archivos.identidad && (
                  <span className="text-[11px] text-[#70AD47] mt-1.5 font-bold block">
                    ✓ Listo: {archivos.identidad.name}
                  </span>
                )}
              </div>

            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className={`w-full bg-gradient-to-r from-[#5B9BD5] to-[#70AD47] text-white font-bold py-4 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-base uppercase tracking-wider ${
              cargando ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
            }`}
          >
            {cargando ? 'Enviando Propuesta...' : 'Enviar Propuesta de Investigación'}
          </button>
        </form> 
      </div>
    </div>
  );
};

export default Convocatorias;