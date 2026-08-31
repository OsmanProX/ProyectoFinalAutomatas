class DashboardDTO {
  constructor(users) {
    this.users = users.map(user => ({
      id: user.id,
      fullName: user.fullName || user.full_name,
      username: user.username,
      state: user.state,
      stateLabel: user.state === 1 ? 'active' : 'inactive',
      createAt: user.createAt || user.create_at
    }));
  }

  toJSON() {
    return {
      users: this.users,
      count: this.users.length,
      activeCount: this.users.filter(u => u.state === 1).length,
      inactiveCount: this.users.filter(u => u.state === 0).length
    };
  }
}

module.exports = DashboardDTO;
