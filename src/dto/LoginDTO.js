class LoginDTO {
  constructor({ nickname, password }) {
    this.nickname = (nickname || '').trim().toLowerCase();
    this.password = password || '';
  }

  isValid() {
    return this.nickname.length > 0 && this.password.length > 0;
  }
}

module.exports = LoginDTO;
