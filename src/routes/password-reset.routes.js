const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/password-reset.controller');

// Rutas públicas (el usuario no tiene sesión porque olvidó su contraseña)
router.get('/', (req, res) => passwordResetController.getPage(req, res));
router.post('/codigo', (req, res) => passwordResetController.postRequestCode(req, res));
router.post('/confirmar', (req, res) => passwordResetController.postConfirm(req, res));

module.exports = router;
