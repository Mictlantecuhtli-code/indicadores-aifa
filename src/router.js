import { renderDashboard } from './views/dashboard.js';
import { renderIndicators } from './views/indicators.js';
import { renderCapture } from './views/capture.js';
import { renderLogin } from './views/login.js';
import { getSession, subscribe } from './state/session.js';
import { renderLayout, highlightActiveRoute } from './ui/layout.js';
import { signOut } from './services/supabaseClient.js';
import { showToast } from './ui/feedback.js';

const routes = {
  login: renderLogin,
  dashboard: renderDashboard,
  indicators: renderIndicators,
  capture: renderCapture
};

function getRouteFromHash() {
  return (window.location.hash || '#dashboard').replace('#', '');
}

async function ensureAuthenticated(routeId) {
  const session = getSession();
  if (!session && routeId !== 'login') {
    window.location.hash = '#login';
    return false;
  }
  if (session && routeId === 'login') {
    window.location.hash = '#dashboard';
    return false;
  }
  return true;
}

function bindLayoutActions() {
  const signOutButton = document.getElementById('sign-out');
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      try {
        await signOut();
      } catch (error) {
        console.error(error);
      }
      localStorage.clear();
      showToast('Sesión cerrada correctamente', { type: 'success' });
      window.location.hash = '#login';
    });
  }
}

export async function renderRoute() {
  const app = document.getElementById('app');
  const routeId = getRouteFromHash();
  const handler = routes[routeId] ?? renderDashboard;

  const allowed = await ensureAuthenticated(routeId);
  if (!allowed) return;

  if (routeId === 'login') {
    handler(app);
    return;
  }

  app.innerHTML = renderLayout('<div></div>');
  highlightActiveRoute(routeId);
  const content = document.getElementById('content');
  await handler(content);
  bindLayoutActions();
}

export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  subscribe(() => renderRoute());
  renderRoute();
}
