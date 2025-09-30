import { signInWithEmail } from '../services/supabaseClient.js';
import { setSession } from '../state/session.js';
import { showToast } from '../ui/feedback.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header class="flex flex-col gap-6 text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-4">
            <img src="./assets/AIFA_logo.png" alt="Logotipo AIFA" class="h-16 w-auto" />
            <div>
              <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Sistema de Indicadores AIFA</p>
              <h1 class="text-2xl font-semibold text-slate-800">Aeropuerto Internacional Felipe Ángeles</h1>
            </div>
          </div>
          <a href="#" class="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800">
            <i class="fa-solid fa-house"></i>
            Inicio
          </a>
        </header>
        <main class="mt-12 grid flex-1 items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div class="space-y-6 text-slate-600">
            <h2 class="text-3xl font-semibold text-slate-900">Sistema de Indicadores</h2>
            <p class="text-base leading-relaxed">
              Consulta en tiempo real la operación del AIFA y registra el avance de los indicadores
              estratégicos de cada área. La plataforma integra mediciones, metas y seguimiento para la
              toma de decisiones de la Dirección.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur">
                <p class="text-xs uppercase tracking-wider text-slate-400">Consultas</p>
                <p class="mt-2 text-lg font-semibold text-slate-800">Panel directivo actualizado</p>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur">
                <p class="text-xs uppercase tracking-wider text-slate-400">Captura</p>
                <p class="mt-2 text-lg font-semibold text-slate-800">Registro seguro de indicadores</p>
              </div>
            </div>
          </div>
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
      window.location.hash = '#dashboard';
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
