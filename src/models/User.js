const { DEFAULT_ROLE, DEFAULT_NOTIFICATION_METHOD } = require('../config/constants');

class User {
  constructor({
    id,
    full_name,
    nickname,
    password,
    state,
    role,
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
    this.role = role || DEFAULT_ROLE;
    this.notificationMethod = notification_method || DEFAULT_NOTIFICATION_METHOD;
    this.photo = photo || null;
    this.email = email || '';
    this.phone = phone || '';
    this.birthDate = birth_date || null;
    this.createAt = create_at || null;
  }

  isActive() {
    return this.state === 1;
  }

  isAdmin() {
    return this.role === 'admin';
  }

  isSupervisor() {
    return this.role === 'supervisor';
  }

  toJSON() {
    return {
      id: this.id,
      fullName: this.fullName,
      nickname: this.nickname,
      state: this.state,
      role: this.role,
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
      role: this.role,
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
