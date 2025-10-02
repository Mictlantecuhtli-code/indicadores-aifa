import { signInWithEmail } from '../services/supabaseClient.js';
import { setSession } from '../state/session.js';
import { showToast } from '../ui/feedback.js';
import { getDefaultRouteForRole } from '../constants/legacyAccess.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header class="flex flex-col items-center text-center">
          <img src="./assets/AIFA_logo.png" alt="Logotipo AIFA" class="h-20 w-auto mb-4" />
          <div>
            <h1 class="text-2xl font-bold text-slate-800">Sistema de Indicadores AIFA</h1>
            <p class="text-sm text-slate-500 mt-1">Aeropuerto Internacional Felipe Ángeles</p>
          </div>
        </header>
        <main class="mt-12 flex flex-1 items-center justify-center">
          <div class="mx-auto w-full max-w-md">
            <div class="rounded-[28px] border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
              <div class="space-y-2 text-center">
                <h3 class="text-xl font-semibold text-slate-900">Inicia sesión</h3>
                <p class="text-sm text-slate-500">Utiliza tus credenciales institucionales para acceder.</p>
              </div>
              <form id="login-form" class="mt-6 space-y-5">
                <div class="space-y-2">
                  <label class="block text-sm font-semibold text-slate-600" for="email">Correo electrónico</label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <i class="fa-solid fa-envelope"></i>
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autocomplete="email"
                      class="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      placeholder="correo@aifa.aero"
                    />
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="block text-sm font-semibold text-slate-600" for="password">Contraseña</label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <i class="fa-solid fa-lock"></i>
                    </span>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autocomplete="current-password"
                      class="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-700 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    />
                    <button
                      type="button"
                      id="toggle-password"
                      class="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                      aria-label="Mostrar contraseña"
                    >
                      <i class="fa-solid fa-eye" id="eye-icon"></i>
                    </button>
                  </div>
                </div>
                
                <div class="flex items-center justify-between text-sm">
                  <label class="flex items-center gap-2 text-slate-500">
                    <input
                      id="remember"
                      name="remember"
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Recordarme
                  </label>
                  <a href="https://indicadores.aifa.gob.mx/" target="_blank" rel="noopener" class="font-semibold text-primary-600 hover:text-primary-700">
                    ¿Olvidó su contraseña?
                  </a>
                </div>
                <button
                  type="submit"
                  class="w-full rounded-2xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-100"
                >
                  <span class="inline-flex items-center justify-center gap-2">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                    Iniciar sesión
                  </span>
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.classList.add('opacity-70');

    const formData = new FormData(form);
    const credentials = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      const { data } = await signInWithEmail(credentials);
      setSession(data);
      const defaultRoute = getDefaultRouteForRole(data?.perfil?.rol_principal);
      window.location.hash = `#${defaultRoute}`;
    } catch (error) {
      console.error(error);
      showToast(error.message ?? 'No fue posible iniciar sesión.', { type: 'error' });
    } finally {
      submit.disabled = false;
      submit.classList.remove('opacity-70');
    }
  });
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');

  if (togglePassword && passwordInput && eyeIcon) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      
      // Cambiar el ícono
      if (type === 'password') {
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      } else {
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      }
    });
  }
}
