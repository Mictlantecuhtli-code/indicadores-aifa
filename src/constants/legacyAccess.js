const ROUTES_BY_ROLE = {
  DIRECTOR: ['dashboard', 'visualizacion'],
  SUBDIRECTOR: ['dashboard', 'visualizacion', 'indicators', 'capture'],
  CAPTURISTA: ['visualizacion', 'capture'],
  ADMIN: ['dashboard', 'visualizacion', 'indicators', 'capture', 'users']
};

export function getRoutesForRole(role) {
  if (!role) {
    return ['dashboard'];
  }

  const normalizedRole = role.toUpperCase();
  return ROUTES_BY_ROLE[normalizedRole] ?? ['dashboard'];
}

export function getDefaultRouteForRole(role) {
  const routes = getRoutesForRole(role);

  if (!routes.length) {
    return 'dashboard';
  }

  if (routes.includes('capture') && role?.toUpperCase() === 'CAPTURISTA') {
    return 'capture';
  }

  return routes[0];
}

export function isRouteAllowedForRole(routeId, role) {
  const routes = getRoutesForRole(role);
  return routes.includes(routeId);
}
