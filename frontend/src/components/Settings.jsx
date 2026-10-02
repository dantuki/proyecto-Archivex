import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const request = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/settings${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'No fue posible completar la acción.');
  return data;
};

export default function Settings({ theme, onThemeChange, onLogout }) {
  const [preferences, setPreferences] = useState({
    theme: theme || 'system', email_notifications: true, deadline_notifications: true
  });
  const [sessions, setSessions] = useState([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [savedPreferences, activeSessions] = await Promise.all([
        request('/preferences'), request('/sessions')
      ]);
      setPreferences(savedPreferences);
      setSessions(activeSessions);
      onThemeChange(savedPreferences.theme);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => { load(); }, []);

  const savePreferences = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    try {
      await request('/preferences', { method: 'PUT', body: JSON.stringify(preferences) });
      onThemeChange(preferences.theme);
      setMessage('Preferencias guardadas.');
    } catch (saveError) { setError(saveError.message); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const data = await request('/password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword(''); setNewPassword(''); setMessage(data.message);
      await load();
    } catch (passwordError) { setError(passwordError.message); }
  };

  const revokeOthers = async () => {
    setError(''); setMessage('');
    try {
      const data = await request('/sessions/revoke-others', { method: 'POST', body: '{}' });
      setMessage(data.message); await load();
    } catch (sessionError) { setError(sessionError.message); }
  };

  const requestDeletion = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const data = await request('/account/deletion-request', {
        method: 'POST', body: JSON.stringify({ password: deletePassword, confirmation })
      });
      setMessage(data.message);
      setTimeout(onLogout, 1200);
    } catch (deletionError) { setError(deletionError.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Mi cuenta</p>
        <h2 className="text-3xl font-black text-slate-900 mt-1">Configuración</h2>
        <p className="text-slate-500 mt-2">Personaliza ArchiveX y controla la seguridad de tu cuenta.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">⚠️ {error}</div>}
      {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">✓ {message}</div>}

      <form onSubmit={savePreferences} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
        <h3 className="font-bold text-slate-900">Apariencia y avisos</h3>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Tema</label>
          <div className="flex flex-wrap gap-2">
            {[['light', '☀️ Claro'], ['dark', '🌙 Oscuro'], ['system', '💻 Sistema']].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPreferences({ ...preferences, theme: value })}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${preferences.theme === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex gap-3 items-center text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(preferences.email_notifications)} onChange={(e) => setPreferences({ ...preferences, email_notifications: e.target.checked })} />
          Recibir correos sobre cambios importantes de mis solicitudes.
        </label>
        <label className="flex gap-3 items-center text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(preferences.deadline_notifications)} onChange={(e) => setPreferences({ ...preferences, deadline_notifications: e.target.checked })} />
          Recibir recordatorios de cierres y fechas límite.
        </label>
        <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Guardar preferencias</button>
      </form>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={changePassword} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900">Seguridad</h3>
          <p className="text-sm text-slate-500">Cambia tu contraseña. Se cerrarán las demás sesiones activas.</p>
          <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
          <input required minLength="8" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña (mínimo 8 caracteres)" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
          <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">Cambiar contraseña</button>
        </form>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900">Sesiones activas</h3>
          <p className="text-sm text-slate-500">Revisa desde dónde está abierta tu cuenta.</p>
          <div className="space-y-2 max-h-32 overflow-auto">
            {sessions.length === 0 ? <p className="text-sm text-slate-400">No hay sesiones registradas todavía.</p> : sessions.map((session) => (
              <div key={session.id} className="text-xs rounded-lg bg-slate-50 p-2 text-slate-600">
                {session.current && <b className="text-emerald-600">Esta sesión · </b>}{session.ip_address || 'IP no disponible'} · {new Date(session.last_seen_at).toLocaleString()}
              </div>
            ))}
          </div>
          <button type="button" onClick={revokeOthers} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-bold">Cerrar otras sesiones</button>
        </div>
      </div>

      <form onSubmit={requestDeletion} className="bg-red-50 rounded-2xl p-6 border border-red-100 space-y-4">
        <h3 className="font-bold text-red-900">Eliminar mi cuenta</h3>
        <p className="text-sm text-red-700">Tu acceso se desactivará inmediatamente y la eliminación quedará programada para dentro de 30 días. No se borran expedientes institucionales automáticamente.</p>
        <input required type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Tu contraseña actual" className="w-full p-3 rounded-xl bg-white border border-red-200 text-sm" />
        <input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Escribe ELIMINAR para confirmar" className="w-full p-3 rounded-xl bg-white border border-red-200 text-sm" />
        <button className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Solicitar eliminación</button>
      </form>
    </div>
  );
}
