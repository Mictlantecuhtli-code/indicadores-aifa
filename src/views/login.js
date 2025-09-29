import { signInWithEmail } from '../services/supabaseClient.js';
import { setSession } from '../state/session.js';
import { showToast } from '../ui/feedback.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-8 space-y-6">
        <div class="space-y-2 text-center">
          <h1 class="text-2xl font-semibold text-slate-900">Panel de Indicadores</h1>
          <p class="text-slate-500 text-sm">Inicia sesión con tus credenciales institucionales.</p>
        </div>
        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-600 mb-1" for="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ejemplo@aifa.gob.mx"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-600 mb-1" for="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              class="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            class="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            <i class="fa-solid fa-right-to-bracket"></i>
            Iniciar sesión
          </button>
        </form>
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
}
