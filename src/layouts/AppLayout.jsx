import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ListChecks, ClipboardPen, LogOut, Users, Presentation, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const navigation = [
  { name: 'Panel directivos', to: '/panel-directivos', icon: BarChart3 },
  { name: 'Visualización', to: '/visualizacion', icon: Presentation },
  { name: 'Consulta de indicadores', to: '/indicadores', icon: ListChecks },
  { name: 'Captura de indicadores', to: '/captura', icon: ClipboardPen },
  { name: 'Administración de usuarios', to: '/usuarios', icon: Users }
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const logoUrl = useMemo(() => new URL('../../assets/AIFA_logo.png', import.meta.url).href, []);

  const availableNavigation = useMemo(() => {
    const role = (profile?.rol ?? profile?.puesto)?.toString().toLowerCase();

    if (role?.includes('director')) {
      return navigation.filter(item => item.to === '/panel-directivos');
    }

    return navigation;
  }, [profile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isDirector = useMemo(() => {
    const role = (profile?.rol ?? profile?.puesto)?.toString().toLowerCase();
    return role?.includes('director');
  }, [profile]);

  useEffect(() => {
    if (!isDirector) return;

    const isDashboardRoute = location.pathname === '/panel-directivos' || location.pathname.startsWith('/panel-directivos/');

    if (!isDashboardRoute) {
      navigate('/panel-directivos', { replace: true });
    }
  }, [isDirector, location.pathname, navigate]);

  const activeNavigation = useMemo(() => {
    const items = availableNavigation.length ? availableNavigation : navigation;

    return (
      items.find(item =>
        item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
      ) ?? items[0]
    );
  }, [availableNavigation, location.pathname]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('No fue posible cerrar la sesión', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="relative z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center gap-4">
            <img src={logoUrl} alt="Logotipo AIFA" className="h-12 w-auto" />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-aifa-blue">AIFA</p>
              <h1 className="text-sm font-semibold text-slate-700">Sistema de indicadores</h1>
            </div>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {availableNavigation.map(item => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={() =>
                    classNames(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-aifa-green text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-3">
            {profile ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-semibold text-slate-800">{profile.nombre_completo ?? profile.nombre}</p>
                  <p className="text-[11px] uppercase tracking-widest text-slate-400">{profile.puesto ?? profile.rol}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-aifa-green hover:text-aifa-green disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sesión no disponible</p>
            )}
            <button
              onClick={() => setMobileOpen(open => !open)}
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-aifa-green hover:text-aifa-green lg:hidden"
              aria-label="Abrir navegación"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-inner lg:hidden">
            <nav className="flex flex-col gap-2">
              {availableNavigation.map(item => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={() =>
                      classNames(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-aifa-green text-white shadow'
                          : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 text-sm uppercase tracking-widest text-slate-400">
            {activeNavigation.name}
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
