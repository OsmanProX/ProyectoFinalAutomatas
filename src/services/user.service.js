const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const { ROLES, NOTIFICATION_METHODS } = require('../config/constants');
const { LoginDTO, RegisterDTO } = require('../dto');

const RULES = {
  nickname: {
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
  validateNickname(nickname) {
    if (!nickname || nickname.trim().length === 0) {
      return { valid: false, error: 'validation_nickname_required' };
    }
    if (nickname.length < RULES.nickname.minLength) {
      return { valid: false, error: 'validation_nickname_min' };
    }
    if (nickname.length > RULES.nickname.maxLength) {
      return { valid: false, error: 'validation_nickname_max' };
    }
    if (!RULES.nickname.pattern.test(nickname)) {
      return { valid: false, error: 'validation_nickname_pattern' };
    }
    return { valid: true };
  }

  validateRole(role) {
    if (!role || !ROLES.includes(role)) {
      return { valid: false, error: 'validation_role_invalid' };
    }
    return { valid: true };
  }

  validateNotificationMethod(notificationMethod) {
    if (!notificationMethod || !NOTIFICATION_METHODS.includes(notificationMethod)) {
      return { valid: false, error: 'validation_notification_invalid' };
    }
    return { valid: true };
  }

  validatePassword(password) {
    if (!password || password.length === 0) {
      return { valid: false, error: 'validation_password_required' };
    }
    if (password.length < RULES.password.minLength) {
      return { valid: false, error: 'validation_password_min' };
    }
    if (password.length > RULES.password.maxLength) {
      return { valid: false, error: 'validation_password_max' };
    }
    return { valid: true };
  }

  validateFullName(fullName) {
    if (!fullName || fullName.trim().length === 0) {
      return { valid: false, error: 'validation_fullname_required' };
    }
    if (fullName.trim().length < RULES.fullName.minLength) {
      return { valid: false, error: 'validation_fullname_min' };
    }
    if (fullName.trim().length > RULES.fullName.maxLength) {
      return { valid: false, error: 'validation_fullname_max' };
    }
    if (!RULES.fullName.pattern.test(fullName)) {
      return { valid: false, error: 'validation_fullname_pattern' };
    }
    return { valid: true };
  }

  async authenticate(loginDTO) {
    if (!loginDTO.isValid()) {
      return { success: false, error: 'credentials_required' };
    }

    const user = await userRepository.findByNickname(loginDTO.nickname);

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

    const nicknameValidation = this.validateNickname(registerDTO.nickname);
    if (!nicknameValidation.valid) {
      return { success: false, error: nicknameValidation.error };
    }

    const roleValidation = this.validateRole(registerDTO.role);
    if (!roleValidation.valid) {
      return { success: false, error: roleValidation.error };
    }

    const notificationValidation = this.validateNotificationMethod(registerDTO.notificationMethod);
    if (!notificationValidation.valid) {
      return { success: false, error: notificationValidation.error };
    }

    const passValidation = this.validatePassword(registerDTO.password);
    if (!passValidation.valid) {
      return { success: false, error: passValidation.error };
    }

    if (!registerDTO.passwordsMatch()) {
      return { success: false, error: 'passwords_not_match' };
    }

    const existing = await userRepository.findByNickname(registerDTO.nickname);
    if (existing) {
      return { success: false, error: 'nickname_exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDTO.password, salt);

    const id = await userRepository.create({
      fullName: registerDTO.fullName,
      nickname: registerDTO.nickname,
      password: hashedPassword,
      photo: registerDTO.photo,
      email: registerDTO.email,
      phone: registerDTO.phone,
      birthDate: registerDTO.birthDate,
      role: registerDTO.role,
      notificationMethod: registerDTO.notificationMethod
    });

    return { success: true, id };
  }

  async getAllUsers() {
    return await userRepository.findAll();
  }

  async findWithPhoto(nickname) {
    return await userRepository.findWithPhoto(nickname);
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
