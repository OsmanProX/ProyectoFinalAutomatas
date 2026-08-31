class LoginDTO {
  constructor({ username, password }) {
    this.username = (username || '').trim().toLowerCase();
    this.password = password || '';
  }

  isValid() {
    return this.username.length > 0 && this.password.length > 0;
  }
}

module.exports = LoginDTO;
