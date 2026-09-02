const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const { LoginDTO, RegisterDTO } = require('../dto');

const RULES = {
  username: {
    minLength: 4,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/
  },
  password: {
    minLength: 6,
    maxLength: 100
  },
  fullName: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+$/
  }
};

class UserService {
  validateUsername(username) {
    if (!username || username.trim().length === 0) {
      return { valid: false, error: 'Username is required' };
    }
    if (username.length < RULES.username.minLength) {
      return { valid: false, error: `Username must be at least ${RULES.username.minLength} characters` };
    }
    if (username.length > RULES.username.maxLength) {
      return { valid: false, error: `Username must be at most ${RULES.username.maxLength} characters` };
    }
    if (!RULES.username.pattern.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers and underscores' };
    }
    return { valid: true };
  }

  validatePassword(password) {
    if (!password || password.length === 0) {
      return { valid: false, error: 'Password is required' };
    }
    if (password.length < RULES.password.minLength) {
      return { valid: false, error: `Password must be at least ${RULES.password.minLength} characters` };
    }
    if (password.length > RULES.password.maxLength) {
      return { valid: false, error: `Password must be at most ${RULES.password.maxLength} characters` };
    }
    return { valid: true };
  }

  validateFullName(fullName) {
    if (!fullName || fullName.trim().length === 0) {
      return { valid: false, error: 'Full name is required' };
    }
    if (fullName.trim().length < RULES.fullName.minLength) {
      return { valid: false, error: `Full name must be at least ${RULES.fullName.minLength} characters` };
    }
    if (fullName.trim().length > RULES.fullName.maxLength) {
      return { valid: false, error: `Full name must be at most ${RULES.fullName.maxLength} characters` };
    }
    if (!RULES.fullName.pattern.test(fullName)) {
      return { valid: false, error: 'Full name can only contain letters and spaces' };
    }
    return { valid: true };
  }

  async authenticate(loginDTO) {
    if (!loginDTO.isValid()) {
      return { success: false, error: 'credentials_required' };
    }

    const user = await userRepository.findByUsername(loginDTO.username);

    if (!user) {
      return { success: false, error: 'invalid_credentials' };
    }

    if (!user.isActive()) {
      return { success: false, error: 'account_disabled' };
    }

    const valid = await bcrypt.compare(loginDTO.password, user.password);
    if (!valid) {
      return { success: false, error: 'invalid_credentials' };
    }

    return {
      success: true,
      user: user.toSession()
    };
  }

  async register(registerDTO) {
    const nameValidation = this.validateFullName(registerDTO.fullName);
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error };
    }

    const userValidation = this.validateUsername(registerDTO.username);
    if (!userValidation.valid) {
      return { success: false, error: userValidation.error };
    }

    const passValidation = this.validatePassword(registerDTO.password);
    if (!passValidation.valid) {
      return { success: false, error: passValidation.error };
    }

    if (!registerDTO.passwordsMatch()) {
      return { success: false, error: 'passwords_not_match' };
    }

    const existing = await userRepository.findByUsername(registerDTO.username);
    if (existing) {
      return { success: false, error: 'username_exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDTO.password, salt);

    const id = await userRepository.create(registerDTO.fullName, registerDTO.username, hashedPassword);

    return { success: true, id };
  }

  async getAllUsers() {
    return await userRepository.findAll();
  }

  async findWithPhoto(username) {
    return await userRepository.findWithPhoto(username);
  }

  async getUserById(id) {
    if (!id || isNaN(id)) {
      return { success: false, error: 'invalid_id' };
    }
    const user = await userRepository.findById(id);
    if (!user) {
      return { success: false, error: 'user_not_found' };
    }
    return { success: true, user: user.toJSON() };
  }

  async toggleState(id) {
    if (!id || isNaN(id)) {
      return { success: false, error: 'invalid_id' };
    }
    const user = await userRepository.findById(id);
    if (!user) {
      return { success: false, error: 'user_not_found' };
    }
    const newState = user.state === 1 ? 0 : 1;
    await userRepository.updateState(id, newState);
    return { success: true, newState };
  }

  async deleteUser(id) {
    if (!id || isNaN(id)) {
      return { success: false, error: 'invalid_id' };
    }
    const user = await userRepository.findById(id);
    if (!user) {
      return { success: false, error: 'user_not_found' };
    }
    await userRepository.delete(id);
    return { success: true };
  }
}

module.exports = new UserService();
