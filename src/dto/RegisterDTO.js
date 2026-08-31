class RegisterDTO {
  constructor({ full_name, username, password, confirm_password }) {
    this.fullName = (full_name || '').trim();
    this.username = (username || '').trim().toLowerCase();
    this.password = password || '';
    this.confirmPassword = confirm_password || '';
  }

  isValid() {
    return (
      this.fullName.length > 0 &&
      this.username.length > 0 &&
      this.password.length > 0 &&
      this.confirmPassword.length > 0
    );
  }

  passwordsMatch() {
    return this.password === this.confirmPassword;
  }
}

module.exports = RegisterDTO;
