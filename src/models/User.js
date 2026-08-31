class User {
  constructor({ id, full_name, username, password, state, create_at }) {
    this.id = id || null;
    this.fullName = full_name || '';
    this.username = username || '';
    this.password = password || '';
    this.state = state !== undefined ? state : 1;
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
      createAt: this.createAt
    };
  }

  toSession() {
    return {
      id: this.id,
      full_name: this.fullName,
      username: this.username
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
