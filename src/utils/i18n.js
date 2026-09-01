const translations = {
  es: {
    // Login
    login_title: "Iniciar Sesión",
    login_username: "Usuario",
    login_password: "Contraseña",
    login_submit: "Entrar",
    login_no_account: "¿No tienes cuenta?",
    login_register: "Regístrate aquí",
    login_error: "Usuario o contraseña incorrectos",
    login_success: "Sesión iniciada correctamente",

    // Register
    register_title: "Crear Cuenta",
    register_full_name: "Nombre completo",
    register_username: "Usuario",
    register_password: "Contraseña",
    register_confirm_password: "Confirmar contraseña",
    register_submit: "Registrarse",
    register_has_account: "¿Ya tienes cuenta?",
    register_login: "Inicia sesión",
    register_error_password: "Las contraseñas no coinciden",
    register_error_exists: "El usuario ya existe",
    register_success: "Cuenta creada correctamente",

    // Validation errors
    validation_required: "Este campo es obligatorio",
    validation_username_min: "El usuario debe tener al menos 4 caracteres",
    validation_username_max: "El usuario debe tener maximo 30 caracteres",
    validation_username_pattern: "El usuario solo puede contener letras, numeros y guiones bajos",
    validation_password_min: "La contraseña debe tener al menos 6 caracteres",
    validation_password_max: "La contraseña debe tener maximo 100 caracteres",
    validation_fullname_min: "El nombre debe tener al menos 2 caracteres",
    validation_fullname_max: "El nombre debe tener maximo 100 caracteres",
    validation_fullname_pattern: "El nombre solo puede contener letras y espacios",
    validation_server_error: "Error del servidor",

    // Dashboard
    dashboard_title: "Panel de Control",
    dashboard_welcome: "Bienvenido",
    dashboard_users: "Usuarios",
    dashboard_actions: "Acciones",
    dashboard_logout: "Cerrar Sesión",
    dashboard_id: "ID",
    dashboard_full_name: "Nombre",
    dashboard_username: "Usuario",
    dashboard_state: "Estado",
    dashboard_created: "Creado",
    dashboard_active: "Activo",
    dashboard_inactive: "Inactivo",

    // General
    nav_home: "Inicio",
    nav_language: "Idioma",
    switch_lang: "English"
  },
  en: {
    // Login
    login_title: "Log In",
    login_username: "Username",
    login_password: "Password",
    login_submit: "Enter",
    login_no_account: "Don't have an account?",
    login_register: "Sign up here",
    login_error: "Incorrect username or password",
    login_success: "Logged in successfully",

    // Register
    register_title: "Create Account",
    register_full_name: "Full name",
    register_username: "Username",
    register_password: "Password",
    register_confirm_password: "Confirm password",
    register_submit: "Register",
    register_has_account: "Already have an account?",
    register_login: "Log in",
    register_error_password: "Passwords do not match",
    register_error_exists: "Username already exists",
    register_success: "Account created successfully",

    // Validation errors
    validation_required: "This field is required",
    validation_username_min: "Username must be at least 4 characters",
    validation_username_max: "Username must be at most 30 characters",
    validation_username_pattern: "Username can only contain letters, numbers and underscores",
    validation_password_min: "Password must be at least 6 characters",
    validation_password_max: "Password must be at most 100 characters",
    validation_fullname_min: "Full name must be at least 2 characters",
    validation_fullname_max: "Full name must be at most 100 characters",
    validation_fullname_pattern: "Full name can only contain letters and spaces",
    validation_server_error: "Server error",

    // Dashboard
    dashboard_title: "Dashboard",
    dashboard_welcome: "Welcome",
    dashboard_users: "Users",
    dashboard_actions: "Actions",
    dashboard_logout: "Log Out",
    dashboard_id: "ID",
    dashboard_full_name: "Full Name",
    dashboard_username: "Username",
    dashboard_state: "State",
    dashboard_created: "Created",
    dashboard_active: "Active",
    dashboard_inactive: "Inactive",

    // General
    nav_home: "Home",
    nav_language: "Language",
    switch_lang: "Español"
  }
};

function getTranslation(lang) {
  return translations[lang] || translations['es'];
}

module.exports = { translations, getTranslation };
