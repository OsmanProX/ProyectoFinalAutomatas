class RegisterDTO {
  constructor({ full_name, username, password, confirm_password, photo, email, phone, birth_date, nickname }) {
    this.fullName = (full_name || '').trim();
    this.username = (username || '').trim().toLowerCase();
    this.password = password || '';
    this.confirmPassword = confirm_password || '';
    this.photo = photo || null;
    this.email = (email || '').trim().toLowerCase();
    this.phone = (phone || '').trim();
    this.birthDate = birth_date || null;
    this.nickname = (nickname || '').trim();
  }

  isValid() {
    return (
      this.fullName.length > 0 &&
      this.username.length > 0 &&
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
