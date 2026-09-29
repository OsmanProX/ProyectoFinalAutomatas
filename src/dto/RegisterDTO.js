const { ROLES, DEFAULT_ROLE, NOTIFICATION_METHODS, DEFAULT_NOTIFICATION_METHOD } = require('../config/constants');

class RegisterDTO {
  constructor({
    full_name,
    nickname,
    password,
    confirm_password,
    photo,
    email,
    phone,
    birth_date,
    role,
    notification_method
  }) {
    this.fullName = (full_name || '').trim();
    this.nickname = (nickname || '').trim().toLowerCase();
    this.password = password || '';
    this.confirmPassword = confirm_password || '';
    this.photo = photo || null;
    this.email = (email || '').trim().toLowerCase();
    this.phone = (phone || '').trim();
    this.birthDate = birth_date || null;
    this.role = ROLES.includes(role) ? role : DEFAULT_ROLE;
    this.notificationMethod = NOTIFICATION_METHODS.includes(notification_method)
      ? notification_method
      : DEFAULT_NOTIFICATION_METHOD;
  }

  isValid() {
    return (
      this.fullName.length > 0 &&
      this.nickname.length > 0 &&
      this.password.length > 0 &&
      this.confirmPassword.length > 0 &&
      this.email.length > 0
    );
  }

  passwordsMatch() {
    return this.password === this.confirmPassword;
  }
}

module.exports = RegisterDTO;
