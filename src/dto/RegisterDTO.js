const {
  NOTIFICATION_METHODS,
  DEFAULT_NOTIFICATION_METHOD,
  REGISTER_ROLE
} = require('../config/constants');
const { normalizeEmail, normalizePhone } = require('../utils/validators');

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
    notification_method
  }) {
    this.fullName = (full_name || '').trim();
    this.nickname = (nickname || '').trim().toLowerCase();
    this.password = password || '';
    this.confirmPassword = confirm_password || '';
    this.photo = photo || null;
    this.email = normalizeEmail(email);
    this.phone = normalizePhone(phone);
    this.birthDate = birth_date || null;
    this.role = REGISTER_ROLE;
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

  toFormValues() {
    return {
      fullName: this.fullName,
      nickname: this.nickname,
      email: this.email,
      phone: this.phone,
      birthDate: this.birthDate,
      photo: this.photo,
      notificationMethod: this.notificationMethod
    };
  }

  passwordsMatch() {
    return this.password === this.confirmPassword;
  }
}

module.exports = RegisterDTO;
