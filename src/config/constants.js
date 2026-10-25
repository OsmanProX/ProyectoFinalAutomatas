const ROLES = ['admin', 'supervisor', 'analitico'];

const DEFAULT_ROLE = 'analitico';

const REGISTER_ROLE = DEFAULT_ROLE;

const REGISTER_ROLE_OPTIONS = [DEFAULT_ROLE];

const NOTIFICATION_METHODS = ['whatsapp', 'correo_electronico', 'ambos'];

const DEFAULT_NOTIFICATION_METHOD = 'correo_electronico';

const ACTIVE_STATE = 1;

const INACTIVE_STATE = 0;

// Los usuarios nuevos nacen ACTIVOS (pueden iniciar sesion de inmediato)
const INITIAL_USER_STATE = ACTIVE_STATE;

const MENU_ITEMS = [
  { key: 'inicio',   route: '/users/dashboard', icon: '&#127968;', labelKey: 'nav_home' },
  { key: 'usuarios', route: '/users',             icon: '&#128101;', labelKey: 'dashboard_users' },
  { key: 'analisis', route: '/analyze',         icon: '&#128196;', labelKey: 'nav_analysis' },
  { key: 'perfil',   route: '/perfil',          icon: '&#128100;', labelKey: 'nav_profile' },
  { key: 'roles',    route: '/roles',           icon: '&#128272;', labelKey: 'nav_roles' }
];

const MENU_KEYS = MENU_ITEMS.map(item => item.key);

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  REGISTER_ROLE,
  REGISTER_ROLE_OPTIONS,
  NOTIFICATION_METHODS,
  DEFAULT_NOTIFICATION_METHOD,
  ACTIVE_STATE,
  INACTIVE_STATE,
  INITIAL_USER_STATE,
  MENU_ITEMS,
  MENU_KEYS
};
