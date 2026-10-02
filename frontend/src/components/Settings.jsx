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

const tabs = [
  ['profile', 'Perfil'], ['account', 'Cuenta'], ['security', 'Seguridad'],
  ['notifications', 'Notificaciones'], ['appearance', 'Apariencia'], ['privacy', 'Privacidad']
];

export default function Settings({ theme, onThemeChange, onTextScaleChange, onLogout, onNavigate, usuario }) {
  const [preferences, setPreferences] = useState({
    theme: theme || 'system', text_scale: 'normal', email_notifications: true,
    deadline_notifications: true, notify_comments: true, notify_assignments: true,
    notify_deadlines: true, notify_convocations: true
  });
  const [sessions, setSessions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [adminActivity, setAdminActivity] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [savedPreferences, activeSessions, savedProfile] = await Promise.all([
        request('/preferences'), request('/sessions'), request('/profile')
      ]);
      setPreferences(savedPreferences);
      setSessions(activeSessions);
      setProfile(savedProfile);
      onThemeChange(savedPreferences.theme);
      onTextScaleChange(savedPreferences.text_scale || 'normal');
      if (['admin', 'administrador'].includes(String(usuario?.rol || '').trim().toLowerCase())) {
        const [deletions, activity] = await Promise.all([
          request('/admin/pending-deletions'), request('/admin/activity')
        ]);
        setPendingDeletions(deletions);
        setAdminActivity(activity);
      }
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
      onTextScaleChange(preferences.text_scale);
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

  const revokeAll = async () => {
    setError(''); setMessage('');
    try {
      const data = await request('/sessions/revoke-all', { method: 'POST', body: '{}' });
      setMessage(data.message);
      setTimeout(onLogout, 500);
    } catch (sessionError) { setError(sessionError.message); }
  };

  const requestDeletion = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const data = await request('/account/deletion-request', {
        method: 'POST', body: JSON.stringify({ password: deletePassword, confirmation })
      });
      setMessage(data.message);
      setDeletePassword('');
      setConfirmation('');
    } catch (deletionError) { setError(deletionError.message); }
  };

  const saveProfile = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const data = await request('/profile', { method: 'PUT', body: JSON.stringify(profile) });
      setMessage(data.message);
    } catch (profileError) { setError(profileError.message); }
  };

  const requestEmailChange = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      const data = await request('/email/change', {
        method: 'POST', body: JSON.stringify({ email, password: emailPassword })
      });
      setEmailPassword(''); setMessage(data.message);
    } catch (emailError) { setError(emailError.message); }
  };

  const exportData = async () => {
    setError(''); setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/settings/privacy/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'No fue posible exportar los datos.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = 'archivex-datos-personales.json'; link.click();
      URL.revokeObjectURL(url);
      setMessage('Exportación descargada.');
    } catch (exportError) { setError(exportError.message); }
  };

  const cancelDeletion = async (id) => {
    setError(''); setMessage('');
    try {
      const data = await request(`/admin/pending-deletions/${id}`, { method: 'DELETE' });
      setMessage(data.message);
      setPendingDeletions(pendingDeletions.filter((item) => item.id !== id));
    } catch (deletionError) { setError(deletionError.message); }
  };

  const anonymizeDeletion = async (id) => {
    setError(''); setMessage('');
    try {
      const data = await request(`/admin/pending-deletions/${id}/anonymize`, { method: 'POST', body: '{}' });
      setMessage(data.message);
      setPendingDeletions(pendingDeletions.filter((item) => item.id !== id));
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

      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Secciones de configuración">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === id ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'profile' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
          <div>
            <h3 className="font-bold text-slate-900">Perfil personal y académico</h3>
            <p className="text-sm text-slate-500 mt-1">La foto y el certificado se administran en el perfil existente.</p>
          </div>
          {profile && <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm text-slate-600">Nombre<input disabled value={profile.nombre_completo || ''} className="mt-1 w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-sm" /></label>
            <label className="text-sm text-slate-600">Teléfono<input value={profile.telefono || ''} onChange={(e) => setProfile({ ...profile, telefono: e.target.value })} className="mt-1 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" /></label>
            <label className="text-sm text-slate-600">Dirección<input value={profile.direccion || ''} onChange={(e) => setProfile({ ...profile, direccion: e.target.value })} className="mt-1 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" /></label>
            <label className="text-sm text-slate-600">Nivel educativo<input value={profile.nivel_educativo || ''} onChange={(e) => setProfile({ ...profile, nivel_educativo: e.target.value })} className="mt-1 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" /></label>
            <label className="text-sm text-slate-600">Título o carrera<input value={profile.carrera_titulo || ''} onChange={(e) => setProfile({ ...profile, carrera_titulo: e.target.value })} className="mt-1 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" /></label>
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">Guardar perfil</button>
              <button type="button" onClick={() => onNavigate('datos_personales')} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold">Foto y certificado</button>
            </div>
          </form>}
        </section>
      )}

      {activeTab === 'account' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
          <div>
            <h3 className="font-bold text-slate-900">Cuenta</h3>
            <p className="text-sm text-slate-500 mt-1">Correo actual: {profile?.email} · {profile?.correo_verificado ? 'Verificado' : 'Pendiente de verificación'}</p>
          </div>
          <form onSubmit={requestEmailChange} className="grid sm:grid-cols-2 gap-3">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nuevo correo" className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            <input required type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Contraseña actual" className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
            <button className="sm:col-span-2 justify-self-start px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">Enviar confirmación al nuevo correo</button>
          </form>
        </section>
      )}

      {activeTab === 'security' && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <form onSubmit={changePassword} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-900">Cambiar contraseña</h3>
              <p className="text-sm text-slate-500">Al cambiarla se cerrarán las demás sesiones.</p>
              <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              <input required minLength="8" maxLength="128" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm" />
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">Actualizar contraseña</button>
            </form>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-900">Sesiones activas</h3>
              <div className="space-y-2 max-h-48 overflow-auto">
                {sessions.length === 0 ? <p className="text-sm text-slate-400">No hay sesiones registradas.</p> : sessions.map((session) => (
                  <div key={session.id} className="text-xs rounded-lg bg-slate-50 p-2 text-slate-600">
                    {session.current && <b className="text-emerald-600">Esta sesión · </b>}{session.ip_address || 'IP no disponible'} · {new Date(session.last_seen_at).toLocaleString()} · {session.revoked_at ? 'Cerrada' : new Date(session.expires_at) <= new Date() ? 'Expirada' : 'Activa'}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={revokeOthers} className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-bold">Cerrar otras sesiones</button>
                <button type="button" onClick={revokeAll} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">Cerrar todas</button>
              </div>
            </div>
          </div>
          <form onSubmit={requestDeletion} className="bg-red-50 rounded-2xl p-6 border border-red-100 space-y-4">
            <h3 className="font-bold text-red-900">Eliminar mi cuenta</h3>
            <p className="text-sm text-red-700">Tras confirmar por correo, el acceso se desactivará y la cuenta quedará programada para anonimización en 30 días. Los expedientes institucionales se conservarán.</p>
            <input required type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Contraseña actual" className="w-full p-3 rounded-xl bg-white border border-red-200 text-sm" />
            <input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Escribe ELIMINAR para confirmar" className="w-full p-3 rounded-xl bg-white border border-red-200 text-sm" />
            <button className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">Solicitar eliminación</button>
          </form>
          {['admin', 'administrador'].includes(String(usuario?.rol || '').trim().toLowerCase()) && (
            <>
              <section className="bg-white rounded-2xl p-6 border border-slate-100 space-y-3">
                <h3 className="font-bold text-slate-900">Cuentas pendientes de eliminación</h3>
                {pendingDeletions.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                  <span>{item.nombre_completo} · {item.email} · {new Date(item.deletion_scheduled_at).toLocaleDateString()}</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => cancelDeletion(item.id)} className="text-blue-700 font-semibold">Cancelar solicitud</button>
                    {new Date(item.deletion_scheduled_at) <= new Date() && <button type="button" onClick={() => anonymizeDeletion(item.id)} className="text-red-700 font-semibold">Anonimizar expediente de cuenta</button>}
                  </div>
                </div>)}
                {!pendingDeletions.length && <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>}
              </section>
              <section className="bg-white rounded-2xl p-6 border border-slate-100 space-y-3">
                <h3 className="font-bold text-slate-900">Actividad reciente</h3>
                {adminActivity.map((item) => <div key={item.id} className="border-t border-slate-100 pt-3 text-sm">
                  <p className="font-semibold text-slate-800">{item.titulo_propuesta || `Solicitud #${item.solicitud_id}`} · {item.estado_nuevo}</p>
                  <p className="text-xs text-slate-500">{item.responsable || 'Sistema'} · {new Date(item.fecha_cambio).toLocaleString()}</p>
                  {item.motivo_cambio && <p className="mt-1 text-xs text-slate-600">{item.motivo_cambio}</p>}
                </div>)}
                {!adminActivity.length && <p className="text-sm text-slate-500">No hay movimientos recientes.</p>}
              </section>
            </>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <form onSubmit={savePreferences} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900">Avisos</h3>
          {[
            ['notify_comments', 'Comentarios y cambios de estado'],
            ['notify_assignments', 'Evaluaciones asignadas'],
            ['notify_deadlines', 'Convocatorias próximas a cerrar'],
            ['notify_convocations', 'Nuevas convocatorias disponibles']
          ].map(([key, label]) => <label key={key} className="flex gap-3 items-center text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={Boolean(preferences[key])} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} />{label}
          </label>)}
          <label className="flex gap-3 items-center text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={Boolean(preferences.email_notifications)} onChange={(e) => setPreferences({ ...preferences, email_notifications: e.target.checked })} />Recibir avisos por correo cuando estén disponibles.
          </label>
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">Guardar avisos</button>
        </form>
      )}

      {activeTab === 'appearance' && (
        <form onSubmit={savePreferences} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
          <h3 className="font-bold text-slate-900">Apariencia</h3>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Tema</label>
            <div className="flex flex-wrap gap-2">
              {[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Sistema']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setPreferences({ ...preferences, theme: value })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border ${preferences.theme === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-semibold text-slate-700">Tamaño de texto
            <select value={preferences.text_scale} onChange={(e) => setPreferences({ ...preferences, text_scale: e.target.value })} className="mt-2 block w-full max-w-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
              <option value="compact">Compacto</option><option value="normal">Normal</option>
            </select>
          </label>
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">Guardar apariencia</button>
        </form>
      )}

      {activeTab === 'privacy' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900">Privacidad y datos</h3>
          <p className="text-sm text-slate-500">Descarga un archivo con los datos de tu perfil, solicitudes e historial institucional.</p>
          <button type="button" onClick={exportData} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold">Descargar mis datos</button>
        </section>
      )}
    </div>
  );
}
