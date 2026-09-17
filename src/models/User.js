class User {
  constructor({ id, full_name, username, password, state, photo, email, phone, birth_date, nickname, create_at }) {
    this.id = id || null;
    this.fullName = full_name || '';
    this.username = username || '';
    this.password = password || '';
    this.state = state !== undefined ? state : 1;
    this.photo = photo || null;
    this.email = email || '';
    this.phone = phone || '';
    this.birthDate = birth_date || null;
    this.nickname = nickname || '';
    this.createAt = create_at || null;
  }

  isActive() {
    return this.state === 1;
  }

  toJSON() {
    return {
      id: this.id,
      fullName: this.fullName,
      username: this.username,
      state: this.state,
      photo: this.photo,
      email: this.email,
      phone: this.phone,
      birthDate: this.birthDate,
      nickname: this.nickname,
      createAt: this.createAt
    };
  }

  toSession() {
    return {
      id: this.id,
      full_name: this.fullName,
      username: this.username,
      photo: this.photo,
      email: this.email,
      nickname: this.nickname
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
