import { useEffect, useEffectEvent, useState } from 'react';

import { API_URL } from '../config/api';

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const token = localStorage.getItem('token');

  const load = async () => {
    try {
      const response = await fetch(`${API_URL}/settings/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setItems(await response.json());
    } catch { /* El panel sigue disponible aunque falle una consulta secundaria. */ }
  };

  const cargarNotificaciones = useEffectEvent(() => {
    void load();
  });

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => cargarNotificaciones(), 0);
    const interval = window.setInterval(() => cargarNotificaciones(), 60000);
    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);
  const unread = items.filter((item) => !item.read_at).length;

  const openItem = async (item) => {
    try { await fetch(`${API_URL}/settings/notifications/${item.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }); } catch { /* noop */ }
    setItems(items.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
    const vistas = {
      '/mis-solicitudes': 'mis_solicitudes',
      '/evaluar_propuestas': 'evaluar_propuestas',
      '/convocatorias_abiertas': 'convocatorias_abiertas'
    };
    if (vistas[item.link]) onNavigate(vistas[item.link]);
    setOpen(false);
  };

  return <div className="relative">
    <button type="button" onClick={() => { setOpen(!open); if (!open) load(); }} className="relative p-2 rounded-xl hover:bg-slate-100" title="Notificaciones" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}>🔔
      {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-4 h-4 rounded-full grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-30">
      <div className="p-3 font-bold text-slate-900">Notificaciones</div>
      {items.length === 0 ? <p className="p-3 text-sm text-slate-400">Todo está al día.</p> : items.map((item) => <button key={item.id} onClick={() => openItem(item)} className={`w-full text-left p-3 rounded-xl hover:bg-slate-50 ${item.read_at ? 'opacity-60' : 'bg-blue-50/70'}`}>
        <div className="text-sm font-bold text-slate-800">{item.title}</div><div className="text-xs text-slate-500 mt-1">{item.body}</div>
      </button>)}
    </div>}
  </div>;
}
