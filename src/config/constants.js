const ROLES = ['admin', 'supervisor', 'analitico'];

const DEFAULT_ROLE = 'analitico';

const REGISTER_ROLE = DEFAULT_ROLE;

const REGISTER_ROLE_OPTIONS = [DEFAULT_ROLE];

const NOTIFICATION_METHODS = ['whatsapp', 'correo_electronico', 'ambos'];

const DEFAULT_NOTIFICATION_METHOD = 'correo_electronico';

const ACTIVE_STATE = 1;

const INACTIVE_STATE = 0;

const INITIAL_USER_STATE = INACTIVE_STATE;

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  REGISTER_ROLE,
  REGISTER_ROLE_OPTIONS,
  NOTIFICATION_METHODS,
  DEFAULT_NOTIFICATION_METHOD,
  ACTIVE_STATE,
  INACTIVE_STATE,
  INITIAL_USER_STATE
};
