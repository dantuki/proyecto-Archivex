import { API_URL } from '../config/api';

// Los archivos privados se piden con el JWT y se muestran desde un blob local.
export async function abrirArchivoPrivado(archivoUrl) {
  const nombre = String(archivoUrl || '').split('/').pop();
  if (!nombre) throw new Error('El archivo no está disponible.');

  const ventana = window.open('about:blank', '_blank');
  if (ventana) ventana.opener = null;

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const respuesta = await fetch(`${API_URL}/archivos-privados/${encodeURIComponent(nombre)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!respuesta.ok) throw new Error('No tienes acceso a este archivo.');

    const url = URL.createObjectURL(await respuesta.blob());
    if (ventana) {
      ventana.location = url;
    } else {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (ventana) ventana.close();
    throw error;
  }
}
