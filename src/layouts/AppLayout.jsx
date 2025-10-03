import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ListChecks,
  ClipboardPen,
  Users,
  Presentation,
  Menu,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { showToast } from '../ui/feedback.js';

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
  const { profile, signOut, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const logoUrl = useMemo(() => new URL('../../assets/AIFA_logo.png', import.meta.url).href, []);
  const accountMenuRef = useRef(null);

  const normalizedRole = useMemo(
    () => (profile?.rol ?? profile?.puesto)?.toString().toLowerCase() ?? null,
    [profile]
  );

  const accountEmail = useMemo(
    () => (profile?.email ?? profile?.usuario?.email ?? session?.user?.email ?? '').toLowerCase(),
    [profile?.email, profile?.usuario?.email, session?.user?.email]
  );

  const allowedPaths = useMemo(() => {
    if (!normalizedRole) {
      return navigation.map(item => item.to);
    }

    if (normalizedRole.includes('director')) {
      return ['/panel-directivos'];
    }

    if (normalizedRole.includes('capturista')) {
      return ['/visualizacion', '/captura'];
    }

    return navigation.map(item => item.to);
  }, [normalizedRole]);

  const availableNavigation = useMemo(() => {
    const allowedSet = new Set(allowedPaths);
    const filtered = navigation.filter(item => allowedSet.has(item.to));
    return filtered.length ? filtered : navigation;
  }, [allowedPaths]);

  useEffect(() => {
    setMobileOpen(false);
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  const fallbackPath = useMemo(() => {
    if (normalizedRole?.includes('capturista')) {
      return '/captura';
    }

    return '/panel-directivos';
  }, [normalizedRole]);

  useEffect(() => {
    if (!normalizedRole) return;

    const isAllowed = allowedPaths.some(path => {
      if (path === '/') {
        return location.pathname === '/';
      }
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    });

    if (!isAllowed) {
      navigate(fallbackPath, { replace: true });
    }
  }, [allowedPaths, fallbackPath, location.pathname, navigate, normalizedRole]);

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
    setIsAccountMenuOpen(false);
    setMobileOpen(false);
    setIsChangePasswordOpen(false);
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

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handleClickOutside = event => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    if (!isChangePasswordOpen) return;

    const handleEscape = event => {
      if (event.key === 'Escape') {
        setIsChangePasswordOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isChangePasswordOpen]);

  useEffect(() => {
    document.body.style.overflow = isChangePasswordOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isChangePasswordOpen]);

  const resetPasswordForm = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setPasswordVisibility({ currentPassword: false, newPassword: false, confirmPassword: false });
  };

  const handleOpenChangePassword = () => {
    resetPasswordForm();
    setIsAccountMenuOpen(false);
    setIsChangePasswordOpen(true);
  };

  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
    resetPasswordForm();
  };

  const togglePasswordVisibility = field => {
    setPasswordVisibility(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePasswordInputChange = (field, value) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    setPasswordErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validatePasswordForm = () => {
    const errors = {};
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword) {
      errors.currentPassword = 'Capture la contraseña anterior.';
    }

    if (!newPassword) {
      errors.newPassword = ['Capture la nueva contraseña.'];
    } else {
      const newPasswordErrors = [];

      if (newPassword === currentPassword) {
        newPasswordErrors.push('La nueva contraseña debe ser diferente a la anterior.');
      }

      const requirementErrors = [
        { test: newPassword.length >= 8, message: 'Debe tener al menos 8 caracteres.' },
        { test: /[A-Z]/.test(newPassword), message: 'Debe incluir al menos una letra mayúscula.' },
        { test: /[a-z]/.test(newPassword), message: 'Debe incluir al menos una letra minúscula.' },
        { test: /[0-9]/.test(newPassword), message: 'Debe incluir al menos un número.' },
        { test: /[^A-Za-z0-9]/.test(newPassword), message: 'Debe incluir al menos un carácter especial.' }
      ]
        .filter(requirement => !requirement.test)
        .map(requirement => requirement.message);

      if (requirementErrors.length) {
        newPasswordErrors.push(...requirementErrors);
      }

      if (newPasswordErrors.length) {
        errors.newPassword = newPasswordErrors;
      }
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirme la nueva contraseña.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    return errors;
  };

  const handlePasswordSubmit = async event => {
    event.preventDefault();
    const errors = validatePasswordForm();
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    if (!accountEmail) {
      showToast('No se pudo identificar el correo de la cuenta.', { type: 'error' });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { currentPassword, newPassword } = passwordForm;
      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email: accountEmail,
        password: currentPassword
      });

      if (verificationError) {
        setPasswordErrors(prev => ({ ...prev, currentPassword: 'La contraseña anterior no es correcta.' }));
        showToast('La contraseña anterior no es correcta.', { type: 'error' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        throw updateError;
      }

      showToast('Contraseña actualizada correctamente.');
      setIsChangePasswordOpen(false);
      resetPasswordForm();
    } catch (error) {
      console.error('No fue posible actualizar la contraseña', error);
      if (!/contraseña anterior no es correcta/i.test(error?.message ?? '')) {
        showToast('No fue posible actualizar la contraseña. Intente nuevamente.', { type: 'error' });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="relative z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
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
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen(open => !open)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-aifa-green hover:text-aifa-green"
                    aria-haspopup="menu"
                    aria-expanded={isAccountMenuOpen}
                  >
                    <span className="max-w-[10rem] truncate text-left sm:max-w-none">
                      {accountEmail || 'Cuenta'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isAccountMenuOpen ? 'rotate-180 text-aifa-green' : ''}`}
                    />
                  </button>

                  {isAccountMenuOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b border-slate-100 px-4 py-3 text-sm">
                        <p className="font-semibold text-slate-800">{profile.nombre_completo ?? profile.nombre}</p>
                        <p className="mt-1 break-all text-xs uppercase tracking-widest text-slate-400">
                          {profile.puesto ?? profile.rol}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">{accountEmail}</p>
                      </div>
                      <div className="flex flex-col py-1 text-sm text-slate-600">
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 text-left transition hover:bg-emerald-50 hover:text-aifa-green"
                          onClick={handleOpenChangePassword}
                        >
                          <KeyRound className="h-4 w-4" />
                          Cambiar contraseña
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 text-left transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          <LogOut className="h-4 w-4" />
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
            {profile && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Cuenta</p>
                <p className="mt-1 font-semibold text-slate-800">{profile.nombre_completo ?? profile.nombre}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{accountEmail}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                    onClick={() => {
                      setMobileOpen(false);
                      handleOpenChangePassword();
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                    Cambiar contraseña
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={() => {
                      setMobileOpen(false);
                      handleSignOut();
                    }}
                    disabled={isSigningOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
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

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Cambiar contraseña</h2>
                <p className="text-xs text-slate-500">
                  La contraseña debe incluir al menos 8 caracteres, combinando mayúsculas, minúsculas, números y símbolos.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={handleCloseChangePassword}
                aria-label="Cerrar"
              >
                <span className="sr-only">Cerrar modal</span>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <label className="text-sm font-medium text-slate-700">Contraseña anterior</label>
                <div className="relative mt-1">
                  <input
                    type={passwordVisibility.currentPassword ? 'text' : 'password'}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                      passwordErrors.currentPassword ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    value={passwordForm.currentPassword}
                    onChange={event => handlePasswordInputChange('currentPassword', event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    onClick={() => togglePasswordVisibility('currentPassword')}
                    aria-label={passwordVisibility.currentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {passwordVisibility.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-xs text-rose-600">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Nueva contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={passwordVisibility.newPassword ? 'text' : 'password'}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                      passwordErrors.newPassword ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    value={passwordForm.newPassword}
                    onChange={event => handlePasswordInputChange('newPassword', event.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    onClick={() => togglePasswordVisibility('newPassword')}
                    aria-label={passwordVisibility.newPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {passwordVisibility.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {Array.isArray(passwordErrors.newPassword) && passwordErrors.newPassword.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-rose-600">
                    {passwordErrors.newPassword.map((message, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="mt-0.5 block h-1 w-1 rounded-full bg-rose-500" />
                        <span>{message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Confirmar nueva contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                      passwordErrors.confirmPassword ? 'border-rose-400' : 'border-slate-200'
                    }`}
                    value={passwordForm.confirmPassword}
                    onChange={event => handlePasswordInputChange('confirmPassword', event.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    aria-label={passwordVisibility.confirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {passwordVisibility.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-aifa-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isUpdatingPassword}
                >
                  {isUpdatingPassword ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  onClick={handleCloseChangePassword}
                  disabled={isUpdatingPassword}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
