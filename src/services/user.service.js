const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const userPhotoRepository = require('../repositories/user-photo.repository');
const roleRepository = require('../repositories/role.repository');
const { isValidImageDataUrl } = require('../utils/image');
const {
  ROLES,
  NOTIFICATION_METHODS,
  INACTIVE_STATE,
  INITIAL_USER_STATE,
  REGISTER_ROLE
} = require('../config/constants');
const { LoginDTO, RegisterDTO } = require('../dto');
const {
  isValidEmail,
  isValidPhone,
  normalizeEmailForComparison
} = require('../utils/validators');

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

  validateEmail(email) {
    if (!email || email.length === 0) {
      return { valid: false, error: 'validation_email_required' };
    }
    if (!isValidEmail(email)) {
      return { valid: false, error: 'validation_email_invalid' };
    }
    return { valid: true };
  }

  /** Fecha opcional: formato AAAA-MM-DD, año de 4 dígitos, desde 1900 y no futura */
  validateBirthDate(birthDate) {
    if (!birthDate) return { valid: true };
    const texto = String(birthDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return { valid: false, error: 'validation_birth_date_invalid' };
    const fecha = new Date(`${texto}T00:00:00Z`);
    const hoy = new Date().toISOString().slice(0, 10);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto
      || texto < '1900-01-01' || texto > hoy) {
      return { valid: false, error: 'validation_birth_date_invalid' };
    }
    return { valid: true };
  }

  validatePhone(phone) {
    if (!phone || phone.length === 0) {
      return { valid: true };
    }
    if (!isValidPhone(phone)) {
      return { valid: false, error: 'validation_phone_invalid' };
    }
    return { valid: true };
  }

  /**
   * Foto original (obligatoria) y foto modificada con filtros/stickers (opcional).
   * Ambas deben ser imágenes reales en formato data URL.
   */
  validatePhotos(photo, photoModified) {
    if (!photo) {
      return { valid: false, error: 'validation_photo_required' };
    }
    if (!isValidImageDataUrl(photo) || (photoModified && !isValidImageDataUrl(photoModified))) {
      return { valid: false, error: 'validation_photo_invalid' };
    }
    return { valid: true };
  }

  /**
   * Valida los campos del registro SIN tocar la base de datos ni la API facial.
   * El controlador la llama antes de procesar la foto, para mostrar primero el
   * error del campo (contraseña corta, apodo inválido...) y no gastar una llamada
   * a la API de rostro. register() vuelve a validar todo igual.
   * @returns {{ success: boolean, error?: string }}
   */
  validateFields(registerDTO) {
    const validaciones = [
      () => this.validateFullName(registerDTO.fullName),
      () => this.validateNickname(registerDTO.nickname),
      () => this.validateRole(registerDTO.role),
      () => this.validateEmail(registerDTO.email),
      () => this.validatePhone(registerDTO.phone),
      () => this.validateBirthDate(registerDTO.birthDate),
      () => this.validateNotificationMethod(registerDTO.notificationMethod),
      () => this.validatePassword(registerDTO.password),
      () => (registerDTO.passwordsMatch() ? { valid: true } : { valid: false, error: 'passwords_not_match' }),
      () => this.validatePhotos(registerDTO.photo, registerDTO.photoModified)
    ];
    for (const validar of validaciones) {
      const resultado = validar();
      if (!resultado.valid) return { success: false, error: resultado.error };
    }
    return { success: true };
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
      return {
        success: false,
        error: user.state === INACTIVE_STATE ? 'account_pending' : 'account_disabled'
      };
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

    const emailValidation = this.validateEmail(registerDTO.email);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error };
    }

    const phoneValidation = this.validatePhone(registerDTO.phone);
    if (!phoneValidation.valid) {
      return { success: false, error: phoneValidation.error };
    }

    const birthDateValidation = this.validateBirthDate(registerDTO.birthDate);
    if (!birthDateValidation.valid) {
      return { success: false, error: birthDateValidation.error };
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

    const photoValidation = this.validatePhotos(registerDTO.photo, registerDTO.photoModified);
    if (!photoValidation.valid) {
      return { success: false, error: photoValidation.error };
    }

    // El apodo debe ser ÚNICO: el login (contraseña, rostro y API) y "Recuperar
    // contraseña" buscan al usuario por apodo; con apodos repetidos el segundo
    // usuario no podría entrar. MySQL compara sin distinguir mayúsculas ni tildes
    // (Kevin = kevin = kévin), por eso el mensaje lo explica.
    const existing = await userRepository.findByNickname(registerDTO.nickname);
    if (existing) {
      return { success: false, error: 'nickname_exists' };
    }

    const emailTaken = await userRepository.findByEmail(
      registerDTO.email,
      normalizeEmailForComparison(registerDTO.email)
    );
    if (emailTaken) {
      return { success: false, error: 'email_exists' };
    }

    const roleRow = await roleRepository.findRegisterRole();
    if (!roleRow) {
      return { success: false, error: 'role_not_found' };
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
      idRole: roleRow.id,
      notificationMethod: registerDTO.notificationMethod,
      state: INITIAL_USER_STATE
    });

    // Foto modificada (filtros/stickers); si no la personalizó se usa la original
    await userPhotoRepository.saveModified(id, registerDTO.photoModified || registerDTO.photo);

    return { success: true, id, state: INITIAL_USER_STATE };
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

  /**
   * Fija el estado del usuario en un valor concreto (1 = activo, 0 = inactivo).
   * Lo usa la pagina Gestion de usuarios desde el select de Estado.
   */
  async setUserState(id, state) {
    if (!id || isNaN(id)) {
      return { success: false, error: 'invalid_id' };
    }
    const newState = Number(state);
    if (newState !== 0 && newState !== 1) {
      return { success: false, error: 'invalid_state' };
    }
    const user = await userRepository.findById(id);
    if (!user) {
      return { success: false, error: 'user_not_found' };
    }
    await userRepository.updateState(id, newState);
    return { success: true, state: newState };
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

  async getUsersWithPhoto() {
    return await userRepository.findAllWithPhoto();
  }

  /**
   * Cambia el rol de un usuario. Solo se permiten los roles del sistema:
   * ADMIN, SUPERVISOR o ANALISTA.
   */
  async updateUserRole(id, idRole) {
    if (!id || isNaN(id) || !idRole || isNaN(idRole)) {
      return { success: false, error: 'invalid_id' };
    }

    const user = await userRepository.findById(id);
    if (!user) {
      return { success: false, error: 'user_not_found' };
    }

    const role = await roleRepository.findById(Number(idRole));
    if (!role) {
      return { success: false, error: 'role_not_found' };
    }

    const allowed = ['ADMIN', 'SUPERVISOR', 'ANALISTA'];
    if (!allowed.includes(role.name.toUpperCase())) {
      return { success: false, error: 'role_not_allowed' };
    }

    await userRepository.updateRole(id, role.id);
    return { success: true, roleName: role.name };
  }
}

module.exports = new UserService();
