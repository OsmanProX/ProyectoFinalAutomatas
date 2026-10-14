const { DEFAULT_ROLE, DEFAULT_NOTIFICATION_METHOD } = require('../config/constants');

/**
 * La columna roles.active es BIT(1); mysql2 la devuelve como Buffer.
 */
function bitToBool(value) {
  if (value === null || value === undefined) return false;
  if (Buffer.isBuffer(value)) return value[0] === 1;
  return value === 1 || value === true || value === '1';
}

class User {
  constructor({
    id,
    full_name,
    nickname,
    password,
    state,
    role,
    id_Roles,
    role_name,
    role_active,
    notification_method,
    photo,
    email,
    phone,
    birth_date,
    create_at
  }) {
    this.id = id || null;
    this.fullName = full_name || '';
    this.nickname = nickname || '';
    this.password = password || '';
    this.state = state !== undefined ? state : 1;
    this.role = role || DEFAULT_ROLE;                    // enum viejo (legacy)
    this.idRole = id_Roles !== undefined ? id_Roles : null;
    this.roleName = role_name || null;                   // nombre desde tabla roles (JOIN)
    this.roleActive = role_active !== undefined ? bitToBool(role_active) : true;
    this.notificationMethod = notification_method || DEFAULT_NOTIFICATION_METHOD;
    this.photo = photo || null;
    this.email = email || '';
    this.phone = phone || '';
    this.birthDate = birth_date || null;
    this.createAt = create_at || null;
  }

  roleDisplayName() {
    return this.roleName || this.role;
  }

  isActive() {
    return this.state === 1;
  }

  isAdmin() {
    const name = (this.roleName || this.role || '').toString().toUpperCase();
    return name === 'ADMIN';
  }

  isSupervisor() {
    const name = (this.roleName || this.role || '').toString().toUpperCase();
    return name === 'SUPERVISOR';
  }

  toJSON() {
    return {
      id: this.id,
      fullName: this.fullName,
      nickname: this.nickname,
      state: this.state,
      role: this.roleDisplayName(),
      idRole: this.idRole,
      roleActive: this.roleActive,
      notificationMethod: this.notificationMethod,
      photo: this.photo,
      email: this.email,
      phone: this.phone,
      birthDate: this.birthDate,
      createAt: this.createAt
    };
  }

  toSession() {
    return {
      id: this.id,
      full_name: this.fullName,
      nickname: this.nickname,
      role: this.roleDisplayName(),
      id_role: this.idRole,
      role_active: this.roleActive,
      notification_method: this.notificationMethod,
      photo: this.photo,
      email: this.email,
      phone: this.phone
    };
  }

  static fromRow(row) {
    if (!row) return null;
    return new User(row);
  }

  static fromRows(rows) {
    return rows.map(row => new User(row));
  }
}

module.exports = User;