import { useState, useEffect } from 'react';
import { API_URL, BACKEND_ORIGIN } from '../config/api';
import { abrirArchivoPrivado } from '../utils/archivosPrivados';

// CORRECCIÓN: Recibimos la prop 'usuario' de la sesión activa para validar identidades de forma cruzada
export default function DatosPersonales({ usuario }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  // Estados del usuario
  const [userId, setUserId] = useState(null);
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // Estados académicos
  const [nivelEducativo, setNivelEducativo] = useState('');
  const [carreraTitulo, setCarreraTitulo] = useState('');
  const [certificadoUrl, setCertificadoUrl] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  
  // Archivos binarios locales
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [archivoCertificado, setArchivoCertificado] = useState(null);
  const [vistaPreviaFoto, setVistaPreviaFoto] = useState('');

  // CORRECCIÓN: Determinamos el ID real activo priorizando el estado global sobre el almacenamiento persistente
  const idUsuarioActivo = usuario?.id || sessionStorage.getItem('userId') || localStorage.getItem('userId');

  useEffect(() => {
    const cargarDatosPerfil = async () => {
      try {
        setError('');
        // CORRECCIÓN: Buscamos el token de forma segura en ambos almacenes para evitar desincronizaciones
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        if (!token || !idUsuarioActivo) {
          setError('No hay una sesión activa. Vuelve a iniciar sesión.');
          setLoading(false);
          return;
        }

        const idUsuario = parseInt(idUsuarioActivo, 10);
        setUserId(idUsuario);

        const response = await fetch(`${API_URL}/usuarios/${idUsuario}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const resJson = await response.json();

        if (response.ok && resJson && resJson.data) {
          const datosUsuario = Array.isArray(resJson.data) ? resJson.data[0] : resJson.data;
          
          if (datosUsuario) {
            setCedula(datosUsuario.cedula || '');
            setEmail(datosUsuario.email || '');
            setNombreCompleto(datosUsuario.nombre_completo || '');
            setTelefono(datosUsuario.telefono || '');
            setDireccion(datosUsuario.direccion || '');
            setFotoUrl(datosUsuario.foto_url || '');
            setNivelEducativo(datosUsuario.nivel_educativo || '');
            setCarreraTitulo(datosUsuario.carrera_titulo || '');
            setCertificadoUrl(datosUsuario.certificado_url || '');
            
            if (datosUsuario.fecha_nacimiento) {
              setFechaNacimiento(datosUsuario.fecha_nacimiento.split('T')[0]);
            } else {
              setFechaNacimiento('');
            }
          }
        } else {
          setError(resJson.message || 'No se pudo recuperar la información del perfil.');
        }
      } catch {
        setError('Error al conectar con el servidor para traer tu perfil.');
      } finally {
        setLoading(false);
      }
    };

    cargarDatosPerfil();
  }, [idUsuarioActivo]); // CORRECCIÓN: Se dispara automáticamente si cambia el usuario en sesión sin dejar rastro del anterior

  const handleCambioFotoLocal = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivoFoto(file);
    if (vistaPreviaFoto) URL.revokeObjectURL(vistaPreviaFoto);
    setVistaPreviaFoto(URL.createObjectURL(file));
  };

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const formData = new FormData();
    formData.append('nombre_completo', nombreCompleto);
    formData.append('cedula', cedula);
    formData.append('email', email);
    formData.append('telefono', telefono);
    formData.append('direccion', direccion);
    formData.append('nivel_educativo', nivelEducativo);
    formData.append('carrera_titulo', carreraTitulo);
    formData.append('fecha_nacimiento', fechaNacimiento);

    if (archivoFoto) formData.append('foto', archivoFoto);
    if (archivoCertificado) formData.append('certificado', archivoCertificado);

    try {
      const response = await fetch(`${API_URL}/usuarios/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData 
      });

      const resJson = await response.json();

      if (!response.ok) {
        setError(resJson.message || resJson.error || 'Error al guardar el perfil.');
        return;
      }

      if (resJson.data) {
        setFotoUrl(resJson.data.foto_url || '');
        setCertificadoUrl(resJson.data.certificado_url || '');
        if (resJson.data.fecha_nacimiento) {
          setFechaNacimiento(resJson.data.fecha_nacimiento.split('T')[0]);
        }
      }

      setMensajeExito('¡Perfil  actualizado con éxito!');
      setIsEditing(false);
      setArchivoFoto(null);
      setArchivoCertificado(null);
      if (vistaPreviaFoto) URL.revokeObjectURL(vistaPreviaFoto);
      setVistaPreviaFoto('');
      setTimeout(() => setMensajeExito(''), 4000);
    } catch {
      setError('No se pudo establecer conexión con el backend.');
    }
  };

  const ejecutarImpresion = () => {
    window.print();
  };

  const verCertificado = async () => {
    try {
      setError('');
      await abrirArchivoPrivado(certificadoUrl);
    } catch (err) {
      setError(err.message || 'No se pudo abrir el certificado.');
    }
  };

  const formatearFechaVisual = (fechaStr) => {
    if (!fechaStr) return 'No registrada';
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
  };

  if (loading) {
    return <div className="text-center py-10 font-semibold text-slate-500">Cargando datos de perfil corporativo...</div>;
  }

  return (
    <div className="w-full max-w-4xl bg-white shadow-sm rounded-2xl border border-slate-100 p-8 mx-auto mt-6 space-y-6 print:border-0 print:shadow-none print:mt-0">
      
      {error && <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 rounded-xl border border-red-100 text-center print:hidden">⚠️ {error}</div>}
      {mensajeExito && <div className="p-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 text-center print:hidden">🎉 {mensajeExito}</div>}

      <div className="flex justify-between items-center border-b pb-4 border-slate-100 print:hidden">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Sistema de Información para la Investigación</h3>
        <button
          type="button"
          onClick={ejecutarImpresion}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          🖨️ Imprimir Certificado
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Zona Lateral Izquierda: Foto de Perfil e Identificaciones */}
        <div className="flex flex-col items-center w-full md:w-1/3 space-y-4">
          <div className="relative group w-40 h-40">
            {vistaPreviaFoto ? (
              <img 
                src={vistaPreviaFoto} 
                alt="Previsualización" 
                className="w-full h-full object-cover rounded-xl border-4 border-amber-400 shadow-sm" 
              />
            ) : fotoUrl ? (
              <img 
                src={`${BACKEND_ORIGIN}${fotoUrl}`}
                alt="Perfil ArchiveX" 
                className="w-full h-full object-cover rounded-xl border-4 border-slate-100 shadow-sm"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/150";
                }}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold text-5xl shadow-inner uppercase">
                {nombreCompleto ? nombreCompleto.charAt(0) : 'U'}
              </div>
            )}
            
            {isEditing && (
              <label className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-center p-2">
                <span className="text-xl">📷</span>
                <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Subir Foto</span>
                <input type="file" accept="image/*" onChange={handleCambioFotoLocal} className="hidden" />
              </label>
            )}
          </div>

          {/* ID de Investigador */}
          <div className="text-center w-full bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 print:bg-white">
            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">ID Investigador </p>
            <p className="text-indigo-700 font-extrabold text-lg">#{userId || '---'}</p>
          </div>

          <div className="text-center w-full bg-slate-50 p-3 rounded-xl border border-slate-100 print:bg-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento Identidad</p>
            {isEditing ? (
              <input 
                type="text" 
                value={cedula} 
                onChange={(e) => setCedula(e.target.value)} 
                className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-blue-500 font-semibold"
              />
            ) : (
              <p className="text-slate-700 font-bold text-base">{cedula || 'Sin número'}</p>
            )}
          </div>
        </div>

        {/* Zona Central: Datos y Formulario */}
        <form onSubmit={handleGuardarCambios} className="w-full md:w-2/3 space-y-6">
          
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 print:bg-white print:border-0">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre del Investigador</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={nombreCompleto} 
                  onChange={(e) => setNombreCompleto(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              ) : (
                <p className="text-slate-800 text-base font-bold uppercase tracking-tight">{nombreCompleto || 'REGISTRE SU NOMBRE'}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Nacimiento</label>
              {isEditing ? (
                <input 
                  type="date" 
                  value={fechaNacimiento} 
                  onChange={(e) => setFechaNacimiento(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <p className="text-slate-700 text-xs font-bold bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0">
                  {formatearFechaVisual(fechaNacimiento)}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Correo Electrónico</label>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                ) : (
                  <p className="flex-1 text-slate-600 text-xs font-medium bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0">
                    {email || 'No registrado'}
                  </p>
                )}
                
                {!isEditing && email && (
                  <button
                    type="button"
                    onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank')}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 print:hidden"
                    title="Redactar correo en Gmail"
                  >
                    📧 <span className="hidden sm:inline">Contactar</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Teléfono</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={telefono} 
                  onChange={(e) => setTelefono(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              ) : (
                <p className="text-slate-700 text-xs font-semibold bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0">{telefono || 'No registrado'}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dirección Residencia</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={direccion} 
                  onChange={(e) => setDireccion(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              ) : (
                <p className="text-slate-700 text-xs font-semibold bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0">{direccion || 'No registrada'}</p>
              )}
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-4 print:bg-white print:border-0">
            <div className="col-span-2">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider print:text-slate-700">🎓 Formación Profesional</h4>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nivel Alcanzado</label>
              {isEditing ? (
                <select
                  value={nivelEducativo}
                  onChange={(e) => setNivelEducativo(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">Seleccione nivel...</option>
                  <option value="Pregrado / Tecnólogo">Pregrado / Tecnólogo</option>
                  <option value="Especialización">Especialización</option>
                  <option value="Maestría">Maestría</option>
                  <option value="Doctorado">Doctorado</option>
                </select>
              ) : (
                <p className="text-slate-700 text-xs font-bold bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0 uppercase">{nivelEducativo || 'No especificado'}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Programa / Título</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={carreraTitulo} 
                  onChange={(e) => setCarreraTitulo(e.target.value)} 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              ) : (
                <p className="text-slate-700 text-xs font-semibold bg-white px-3 py-2 rounded-lg border border-slate-200/60 print:border-0 print:p-0 italic">{carreraTitulo || 'No registrado'}</p>
              )}
            </div>

            <div className="col-span-2 border-t pt-3 mt-1 border-slate-200/60 print:hidden">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Certificado Vigente (PDF)</label>
              <div className="flex flex-wrap items-center gap-4 mt-1">
                {certificadoUrl && (
                  <button
                    type="button"
                    onClick={verCertificado}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1.5"
                  >
                    📄 Ver Soporte PDF
                  </button>
                )}
                {isEditing && (
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
                    onChange={(e) => setArchivoCertificado(e.target.files[0])}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 print:hidden">
            {isEditing ? (
              <>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    setArchivoFoto(null);
                    setArchivoCertificado(null);
                    if (vistaPreviaFoto) URL.revokeObjectURL(vistaPreviaFoto);
                    setVistaPreviaFoto('');
                  }}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-sm"
                >
                  Guardar Cambios
                </button>
              </>
            ) : (
              <button 
                type="button" 
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                Modificar Datos ArchiveX
              </button>
            )}
          </div>

        </form>
      </div>

    </div>
  );  
}