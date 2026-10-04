import { useState } from 'react';
import { API_URL } from '../config/api';

function ReportesAdmin() {
  const [descargando, setDescargando] = useState(null);

  const descargarExcel = async (tipoReporte, nombreArchivo) => {
    setDescargando(tipoReporte);
    try {
      const respuesta = await fetch(`${API_URL}/reportes/${tipoReporte}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token')}`
        }
      });

      if (!respuesta.ok) throw new Error('Error al generar el reporte solicitado');

      const blob = await respuesta.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Ocurrió un error en la descarga: ' + error.message);
    } finally {
      setDescargando(null);
    }
  };

  const tarjetasReportes = [
    { id: 'convocatorias', titulo: 'Reporte General de Convocatorias', desc: 'Métricas de participación global, proyectos postulados y estados de revisión.', icono: '📢', archivo: 'Reporte_Convocatorias_ArchiveX.xlsx' },
    { id: 'sedes-demografia', titulo: 'Demografía por Sedes Universitarias', desc: 'Conteo de docentes inscritos agrupados estrictamente por sede, título y carrera profesional.', icono: '📍', archivo: 'Reporte_Demografia_Sedes.xlsx' },
    { id: 'evaluadores', titulo: 'Control Estratégico de Evaluadores', desc: 'Auditoría de proyectos asignados, revisiones completadas y promedio de puntaje otorgado.', icono: '👥', archivo: 'Reporte_Control_Evaluadores.xlsx' },
    { id: 'proyectos-titulos', titulo: 'Consolidado de Proyectos y Títulos', desc: 'Listado completo de propuestas en borrador, radicadas, aprobadas y rechazadas por docente.', icono: '📁', archivo: 'Reporte_Proyectos_Titulos.xlsx' }
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Centro de Reportes Avanzados</h2>
        <p className="text-sm text-slate-500 mt-1">Genera y descarga informes optimizados con diseño corporativo en formato Excel (ExcelJS).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tarjetasReportes.map((rep) => (
          <div key={rep.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl shadow-inner">{rep.icono}</div>
              <div>
                <h3 className="font-bold text-slate-700 text-base">{rep.titulo}</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{rep.desc}</p>
              </div>
            </div>
            
            <button
              onClick={() => descargarExcel(rep.id, rep.archivo)}
              disabled={descargando !== null}
              className={`w-full mt-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                descargando === rep.id 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                  : 'bg-[#5B9BD5] text-white hover:bg-[#4a8bc4]'
              }`}
            >
              {descargando === rep.id ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"></span>
                  Procesando Archivo...
                </>
              ) : (
                <>Descargar Excel Profesional 📥</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReportesAdmin;