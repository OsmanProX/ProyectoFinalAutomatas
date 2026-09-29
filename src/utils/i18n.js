const translations = {
  es: {
    // Login
    login_title: "Iniciar Sesión",
    login_nickname: "Apodo",
    login_password: "Contraseña",
    login_submit: "Entrar",
    login_no_account: "¿No tienes cuenta?",
    login_register: "Regístrate aquí",
    login_error: "Apodo o contraseña incorrectos",
    login_success: "Sesión iniciada correctamente",
    login_or: "o",
    login_face: "Login con Rostro",
    login_face_verify: "Verificar",
    login_face_cancel: "Cancelar",

    // Register
    register_title: "Crear Cuenta",
    register_full_name: "Nombre completo",
    register_nickname: "Apodo",
    register_role: "Rol",
    register_notification: "Método de notificación",
    register_password: "Contraseña",
    register_confirm_password: "Confirmar contraseña",
    register_submit: "Registrarse",
    register_has_account: "¿Ya tienes cuenta?",
    register_login: "Inicia sesión",
    register_error_password: "Las contraseñas no coinciden",
    register_error_exists: "El apodo ya existe",
    register_success: "Cuenta creada correctamente",
    register_email: "Correo electrónico",
    register_phone: "Teléfono",
    register_birth_date: "Fecha de nacimiento",
    register_photo: "Foto de perfil",
    register_take_photo: "Tomar foto",
    register_upload_photo: "Subir imagen",
    register_capture_photo: "Capturar foto",
    register_crop_photo: "Recortar foto",
    register_cancel_photo: "Cancelar foto",
    register_photo_required: "Debe tomar o subir una foto",
    register_camera_error: "No se pudo acceder a la cámara",
    register_invalid_image: "Seleccione una imagen válida",

    // Roles
    role_admin: "Administrador",
    role_supervisor: "Supervisor",
    role_analitico: "Analítico",

    // Metodos de notificacion
    notification_whatsapp: "WhatsApp",
    notification_email: "Correo Electrónico",
    notification_both: "Ambos tipos",

    // Login facial
    face_prompt_nickname: "Ingrese su apodo primero",
    face_loading_models: "Cargando modelos...",
    face_camera_error: "No se pudo acceder a la cámara",
    face_ready_hint: 'Presione "Verificar" cuando su rostro sea visible',
    face_detecting: "Detectando rostro...",
    face_verifying: "Verificando identidad...",
    face_no_face: "No se detectó rostro. Intente de nuevo.",
    face_verified: "Rostro verificado. Similitud:",
    face_no_match: "Rostro no coincide",
    face_user_not_found: "Apodo no encontrado",
    face_no_photo: "Usuario sin foto registrada",
    face_account_disabled: "Cuenta desactivada",
    face_connection_error: "Error de conexión",

    // Validation errors
    validation_required: "Este campo es obligatorio",
    validation_nickname_required: "El apodo es obligatorio",
    validation_nickname_min: "El apodo debe tener al menos 4 caracteres",
    validation_nickname_max: "El apodo debe tener maximo 30 caracteres",
    validation_nickname_pattern: "El apodo solo puede contener letras, numeros y guiones bajos",
    validation_role_invalid: "Debe seleccionar un rol valido",
    validation_notification_invalid: "Debe seleccionar un metodo de notificacion valido",
    validation_password_required: "La contrasena es obligatoria",
    validation_password_min: "La contraseña debe tener al menos 6 caracteres",
    validation_password_max: "La contraseña debe tener maximo 100 caracteres",
    validation_fullname_required: "El nombre es obligatorio",
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
    dashboard_nickname: "Apodo",
    dashboard_role: "Rol",
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
    login_nickname: "Nickname",
    login_password: "Password",
    login_submit: "Enter",
    login_no_account: "Don't have an account?",
    login_register: "Sign up here",
    login_error: "Incorrect nickname or password",
    login_success: "Logged in successfully",
    login_or: "or",
    login_face: "Face Login",
    login_face_verify: "Verify",
    login_face_cancel: "Cancel",

    // Register
    register_title: "Create Account",
    register_full_name: "Full name",
    register_nickname: "Nickname",
    register_role: "Role",
    register_notification: "Notification method",
    register_password: "Password",
    register_confirm_password: "Confirm password",
    register_submit: "Register",
    register_has_account: "Already have an account?",
    register_login: "Log in",
    register_error_password: "Passwords do not match",
    register_error_exists: "Nickname already exists",
    register_success: "Account created successfully",
    register_email: "Email",
    register_phone: "Phone",
    register_birth_date: "Birth date",
    register_photo: "Profile photo",
    register_take_photo: "Take photo",
    register_upload_photo: "Upload image",
    register_capture_photo: "Capture photo",
    register_crop_photo: "Crop photo",
    register_cancel_photo: "Cancel photo",
    register_photo_required: "You must take or upload a photo",
    register_camera_error: "Could not access the camera",
    register_invalid_image: "Please select a valid image",

    // Roles
    role_admin: "Administrator",
    role_supervisor: "Supervisor",
    role_analitico: "Analyst",

    // Notification methods
    notification_whatsapp: "WhatsApp",
    notification_email: "Email",
    notification_both: "Both types",

    // Face login
    face_prompt_nickname: "Please enter your nickname first",
    face_loading_models: "Loading models...",
    face_camera_error: "Could not access the camera",
    face_ready_hint: 'Press "Verify" when your face is visible',
    face_detecting: "Detecting face...",
    face_verifying: "Verifying identity...",
    face_no_face: "No face detected. Please try again.",
    face_verified: "Face verified. Similarity:",
    face_no_match: "Face does not match",
    face_user_not_found: "Nickname not found",
    face_no_photo: "User has no registered photo",
    face_account_disabled: "Account disabled",
    face_connection_error: "Connection error",

    // Validation errors
    validation_required: "This field is required",
    validation_nickname_required: "Nickname is required",
    validation_nickname_min: "Nickname must be at least 4 characters",
    validation_nickname_max: "Nickname must be at most 30 characters",
    validation_nickname_pattern: "Nickname can only contain letters, numbers and underscores",
    validation_role_invalid: "You must select a valid role",
    validation_notification_invalid: "You must select a valid notification method",
    validation_password_required: "Password is required",
    validation_password_min: "Password must be at least 6 characters",
    validation_password_max: "Password must be at most 100 characters",
    validation_fullname_required: "Full name is required",
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
    dashboard_nickname: "Nickname",
    dashboard_role: "Role",
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
