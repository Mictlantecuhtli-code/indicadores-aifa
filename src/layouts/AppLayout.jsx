import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, BarChart3, ListChecks, ClipboardPen, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useState } from 'react';

const navigation = [
  { name: 'Panel directivos', to: '/', icon: BarChart3, exact: true },
  { name: 'Consulta de indicadores', to: '/indicadores', icon: ListChecks },
  { name: 'Captura de indicadores', to: '/captura', icon: ClipboardPen }
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-30 w-72 transform bg-white shadow-xl transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-aifa-blue">AIFA</p>
            <h1 className="text-lg font-bold text-slate-800">Sistema de indicadores</h1>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {navigation.map(item => {
            const Icon = item.icon;
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={() =>
                  classNames(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-aifa-blue text-white shadow-lg shadow-aifa-blue/25'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-6 py-5">
          {profile ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-aifa-light to-aifa-blue font-semibold text-white">
                {profile.nombre?.[0] ?? 'A'}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-slate-800">{profile.nombre}</p>
                <p className="text-xs text-slate-500">{profile.puesto ?? profile.rol}</p>
              </div>
              <button
                onClick={signOut}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-aifa-blue"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sesión no disponible</p>
          )}
        </div>
      </aside>
      <div className="flex flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(prev => !prev)}
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-auto text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400">Panel</p>
              <p className="font-semibold text-slate-700">
                {navigation.find(item => location.pathname.startsWith(item.to))?.name ?? 'Panel'}
              </p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
