const normalizar = (valor) => String(valor || '').trim().replace(/\/+$/, '');

// Sin VITE_API_URL se asume que la API se sirve en el mismo origen (/api).
export const API_URL = normalizar(import.meta.env.VITE_API_URL) || '/api';

// El origen del backend es la API sin el sufijo /api.
export const BACKEND_ORIGIN = API_URL.replace(/\/api$/, '');

export const SOCKET_URL = BACKEND_ORIGIN;

export const RECAPTCHA_SITE_KEY = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
